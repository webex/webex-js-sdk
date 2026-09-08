/**
 * The only payload shape the bridge transports. Anything that is not
 * JSON-serialisable is rejected before it reaches a transport.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};

/**
 * Create an object with no prototype.
 *
 * Every map built from data that crossed a trust boundary goes through this, so a
 * `__proto__` or `constructor` key in that data cannot reach `Object.prototype`.
 *
 * @returns An empty, prototype-less record.
 */
export function nullPrototypeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/**
 * Read an own property without consulting the prototype chain.
 *
 * @param source - Value to read from. May be anything, including `null`.
 * @param key - Property name.
 * @returns The own property value, or `undefined` when absent.
 */
export function readOwn(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }

  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return undefined;
  }

  return (source as Record<string, unknown>)[key];
}

/** Guards the payload walk against a value built purely to exhaust the stack. */
export const MAX_WALK_DEPTH = 64;

/** Why {@link inspectJson} refused a value. */
export const JsonRejection = {
  /** A value outside the {@link JsonValue} grammar: function, symbol, `undefined`,
   *  `NaN`/`Infinity`, `BigInt`, `Date`, class instance, and so on. */
  NOT_JSON: 'NOT_JSON',
  /** A reserved key appeared as an own property name somewhere in the value. */
  RESERVED_KEY: 'RESERVED_KEY',
  /** Nesting exceeded {@link MAX_WALK_DEPTH}, so the value could not be fully checked. */
  TOO_DEEP: 'TOO_DEEP',
  /** The value refers back to itself. */
  CYCLE: 'CYCLE',
  /**
   * The value's *expanded* form is over budget. A shared subtree counts once in memory
   * but once per referencing path in JSON, so this can fire for a value that looks small.
   */
  TOO_LARGE: 'TOO_LARGE',
} as const;

export type JsonRejection = (typeof JsonRejection)[keyof typeof JsonRejection];

export type JsonInspection = {ok: true} | {ok: false; rejection: JsonRejection; key?: string};

const OBJECT_PROTOTYPE: unknown = Object.prototype;
const ARRAY_PROTOTYPE: unknown = Array.prototype;

/**
 * @param node - Non-null object to classify.
 * @returns Whether the object is a plain data object rather than a class instance,
 *   `Date`, `Map`, boxed primitive, or anything else with behaviour attached.
 */
function isPlainObject(node: object): boolean {
  const proto: unknown = Object.getPrototypeOf(node);

  return proto === OBJECT_PROTOTYPE || proto === null;
}

/**
 * Recursively check a value against the {@link JsonValue} grammar, the reserved-key
 * rule, and the depth bound — in one walk, so no path through the value escapes any
 * of the three checks.
 *
 * Validating the value itself rather than inspecting `JSON.stringify` output is
 * deliberate. `JSON.stringify` silently drops function/`undefined`/symbol properties
 * and rewrites `NaN` and `Infinity` to `null`, so a "successful" stringify says
 * nothing about whether the *original* object is transportable. The page hop clones
 * the original via `postMessage`, where a nested function throws `DataCloneError`
 * instead of the documented `BridgeError`; the runtime hop would deliver `null` where
 * the sender wrote `NaN`. Both are avoided by rejecting up front.
 *
 * Rejecting reserved keys is likewise deliberate rather than sanitising: a payload
 * that carries `__proto__` is either an attack or a bug, and silently rewriting it
 * would hide both. Consumers who legitimately need such a key can nest it in a string.
 *
 * Depth overflow is a rejection, not a clean result. Returning "no problem found" for
 * a value that was never fully walked would let a `__proto__` key buried below the
 * bound bypass the reserved-key rule entirely.
 *
 * `maxExpandedNodes` bounds the walk, and — more importantly — bounds the
 * `JSON.stringify` the caller runs afterwards. JSON has no way to express a shared
 * reference, so stringify writes a shared subtree once per path that reaches it. Sixty
 * levels of `{a: child, b: child}` is a sixty-object value in memory and 2^60 nodes on
 * the way out, and structured clone *preserves* shared references, so such a value
 * survives `postMessage` intact and arrives at a validator that runs before any rate
 * limiter. Counting expanded nodes as the walk proceeds, with a memo and saturating
 * arithmetic, is what makes both this function and the caller's stringify safe.
 *
 * @param value - Value to inspect.
 * @param reserved - Key names to reject.
 * @param maxExpandedNodes - Cap on expanded node count. Every node costs at least one
 *   byte of output, so passing the byte cap is a sound and conservative bound.
 * @returns `{ok: true}`, or the reason the value was refused.
 */
export function inspectJson(
  value: unknown,
  reserved: readonly string[],
  maxExpandedNodes = Number.MAX_SAFE_INTEGER
): JsonInspection {
  // Ancestors only, not every object ever seen: a DAG that repeats a shared child is
  // legal JSON input, and both `JSON.stringify` and structured clone expand it. Only a
  // true back-reference is a cycle, so a node is removed again once its branch is done.
  const ancestors = new Set<object>();

  // Because ancestors are forgotten, a shared subtree would otherwise be re-walked once
  // per path that reaches it, which is the 2^60 case described above. This memo makes
  // the walk linear in *distinct* nodes.
  //
  // It records the shallowest depth at which a node was cleared, together with the
  // expanded weight measured there. Reusing an entry at a shallower or equal depth is
  // sound: less depth consumed means at least as much remaining, so a subtree that
  // fitted before still fits, and its weight does not depend on where it sits. The
  // reverse is not true — a subtree that fitted at depth 5 can overflow at depth 40 —
  // which is why the depth is stored rather than a bare "seen" flag.
  const cleared = new Map<object, {depth: number; weight: number}>();

  /** Weight of a leaf. Every JSON node costs at least one byte of output. */
  const LEAF = 1;

  /** Saturated at the cap, so a wide DAG cannot overflow the arithmetic itself. */
  const cap = maxExpandedNodes + 1;
  const add = (a: number, b: number): number => Math.min(a + b, cap);

  type WalkResult =
    | {ok: true; weight: number}
    | {ok: false; rejection: JsonRejection; key?: string};

  const walk = (node: unknown, depth: number): WalkResult => {
    if (node === null) {
      return {ok: true, weight: LEAF};
    }

    const type = typeof node;

    if (type === 'string') {
      // A long string is one node but many bytes, so it is charged by length. The
      // caller's byte cap is the authority; this only has to be a lower bound.
      return {ok: true, weight: Math.min((node as string).length + 2, cap)};
    }

    if (type === 'boolean') {
      return {ok: true, weight: LEAF};
    }

    if (type === 'number') {
      // `NaN` and `Infinity` stringify to `null`, so they would otherwise reach a
      // handler as a value the sender never wrote.
      return Number.isFinite(node as number)
        ? {ok: true, weight: LEAF}
        : {ok: false, rejection: JsonRejection.NOT_JSON};
    }

    if (type !== 'object') {
      // function, symbol, bigint, undefined
      return {ok: false, rejection: JsonRejection.NOT_JSON};
    }

    const object = node as object;

    if (ancestors.has(object)) {
      return {ok: false, rejection: JsonRejection.CYCLE};
    }

    const memo = cleared.get(object);

    if (memo && depth <= memo.depth) {
      return {ok: true, weight: memo.weight};
    }

    if (depth >= MAX_WALK_DEPTH) {
      return {ok: false, rejection: JsonRejection.TOO_DEEP};
    }

    ancestors.add(object);

    try {
      const result = walkOwnProperties(object, depth);

      if (result.ok) {
        if (result.weight > maxExpandedNodes) {
          return {ok: false, rejection: JsonRejection.TOO_LARGE};
        }

        cleared.set(object, {depth, weight: result.weight});
      }

      return result;
    } finally {
      ancestors.delete(object);
    }
  };

  /**
   * @param object - Object or array whose own properties should be walked.
   * @param depth - Depth of `object` itself.
   * @returns Its expanded weight, or the reason it was refused.
   */
  const walkOwnProperties = (object: object, depth: number): WalkResult => {
    // `Array.isArray` is true for `class Mine extends Array {}` too, and such an
    // instance arrives as a plain array with its class identity gone. Require the exact
    // prototype instead, so "what was sent" and "what arrives" cannot differ.
    if (Object.getPrototypeOf(object) === ARRAY_PROTOTYPE) {
      const items = object as unknown[];
      let weight = LEAF;

      for (let index = 0; index < items.length; index += 1) {
        // Read through the descriptor, exactly as the object branch does. Indexing with
        // `items[index]` would invoke an accessor, and an array index can carry one just
        // as an object key can — which defeats every check below it, because the value
        // validated is then not the value sent. A sparse array's holes surface here as a
        // missing descriptor; they stringify to `null`, so they are treated as the
        // missing values they are rather than silently substituted.
        const descriptor = Object.getOwnPropertyDescriptor(items, index);

        if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
          return {ok: false, rejection: JsonRejection.NOT_JSON};
        }

        const found = walk(descriptor.value, depth + 1);

        if (!found.ok) {
          return found;
        }

        weight = add(weight, found.weight);

        // Checked inside the loop, not only at the end, so a value already over budget
        // stops being walked at the moment that becomes known.
        if (weight > maxExpandedNodes) {
          return {ok: false, rejection: JsonRejection.TOO_LARGE};
        }
      }

      // An array may carry extra string keys as well as symbol keys, and both are
      // dropped in transit. `length` plus the indices is the whole of a JSON array.
      if (Object.getOwnPropertyNames(items).length !== items.length + 1) {
        return {ok: false, rejection: JsonRejection.NOT_JSON};
      }

      return symbolCheck(items, weight);
    }

    if (!isPlainObject(object)) {
      return {ok: false, rejection: JsonRejection.NOT_JSON};
    }

    let weight = LEAF;

    for (const key of Object.getOwnPropertyNames(object)) {
      if (reserved.includes(key)) {
        return {ok: false, rejection: JsonRejection.RESERVED_KEY, key};
      }

      const descriptor = Object.getOwnPropertyDescriptor(object, key);

      // Accessors are refused without ever being invoked. Reading one would run
      // arbitrary caller code inside a message handler — where it can throw straight
      // past the `BridgeError` contract — and a getter is read twice on the way out
      // (once here, once by `JSON.stringify` or the structured clone), so one returning
      // a different value each time could pass validation and send something else.
      //
      // Non-enumerable data properties are refused for the same fidelity reason as
      // symbol keys: `JSON.stringify` and structured clone both drop them, so the
      // payload would arrive different from what was sent.
      if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
        return {ok: false, rejection: JsonRejection.NOT_JSON};
      }

      const found = walk(descriptor.value, depth + 1);

      if (!found.ok) {
        return found;
      }

      weight = add(add(weight, found.weight), key.length + 3);

      if (weight > maxExpandedNodes) {
        return {ok: false, rejection: JsonRejection.TOO_LARGE};
      }
    }

    return symbolCheck(object, weight);
  };

  const result = walk(value, 0);

  return result.ok ? {ok: true} : result;
}

/**
 * @param object - Object or array to check.
 * @param weight - Weight to carry through on success.
 * @returns A rejection when the value carries symbol-keyed properties, which both
 *   `JSON.stringify` and structured clone drop — so the payload would arrive different
 *   from what was sent.
 */
function symbolCheck(
  object: object,
  weight: number
): {ok: true; weight: number} | {ok: false; rejection: JsonRejection} {
  return Object.getOwnPropertySymbols(object).length > 0
    ? {ok: false, rejection: JsonRejection.NOT_JSON}
    : {ok: true, weight};
}

/*
 * `findReservedKey` used to live here, returning the offending key or `undefined`.
 * It is deliberately gone rather than kept as a wrapper around `inspectJson`.
 *
 * The whole point of the change above is that "no reserved key found" and "I could not
 * finish looking" must not be the same answer — that collision was the bypass. A
 * boolean-ish shim over the new result would reintroduce it for every caller who
 * reached for the convenient signature, since `TOO_DEEP`, `CYCLE` and `NOT_JSON` would
 * all flatten back to `undefined`.
 *
 * Use `inspectJson` and handle the rejection you get.
 */
