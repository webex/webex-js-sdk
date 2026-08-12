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

/** Guards the reserved-key walk against a payload built purely to exhaust the stack. */
const MAX_WALK_DEPTH = 64;

/**
 * Report whether any object key anywhere in the value is a reserved key.
 *
 * Rejecting is deliberate rather than sanitising: a payload that carries
 * `__proto__` is either an attack or a bug, and silently rewriting it would hide
 * both. Consumers who legitimately need such a key can nest it inside a string.
 *
 * @param value - Value to inspect. Arrays and plain objects are walked.
 * @param reserved - Key names to reject.
 * @returns The offending key, or `undefined` when the value is clean.
 */
export function findReservedKey(value: unknown, reserved: readonly string[]): string | undefined {
  const seen = new WeakSet<object>();

  const walk = (node: unknown, depth: number): string | undefined => {
    if (typeof node !== 'object' || node === null || depth > MAX_WALK_DEPTH) {
      return undefined;
    }

    if (seen.has(node)) {
      return undefined;
    }
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, depth + 1);

        if (found !== undefined) {
          return found;
        }
      }

      return undefined;
    }

    for (const key of Object.getOwnPropertyNames(node)) {
      if (reserved.includes(key)) {
        return key;
      }

      const found = walk((node as Record<string, unknown>)[key], depth + 1);

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  };

  return walk(value, 0);
}
