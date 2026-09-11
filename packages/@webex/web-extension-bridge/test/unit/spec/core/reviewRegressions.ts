import {assert} from '@webex/test-helper-chai';

import {DEFAULT_CHANNEL, RESERVED_KEYS} from '../../../../src/core/constants';
import {BridgeError} from '../../../../src/core/errors';
import {MAX_WALK_DEPTH, JsonRejection, inspectJson} from '../../../../src/core/json';
import {EnvelopeKind, EnvelopeSource, createEnvelope} from '../../../../src/core/protocol';
import {RateLimiter, rateLimitKey} from '../../../../src/core/rateLimit';
import {PayloadRejection, checkPayload} from '../../../../src/core/serialize';
import {DropReason, validateEnvelope} from '../../../../src/core/validate';
import {createWebBridgeWith} from '../../../../src/web/webBridge';
import {createFakeWindow} from '../../lib/fakeWindow';

/**
 * Regressions for the defects raised in PR review.
 *
 * Kept together, and named after the behaviour rather than the module, because each of
 * these is a case that used to pass through silently. A future refactor that
 * reintroduces any of them should fail here with an obvious name, not somewhere deep
 * in an integration spec.
 */
describe('core review regressions', () => {
  const CHANNEL = DEFAULT_CHANNEL;
  const SESSION = 'session-token';

  /**
   * @param depth - How deeply to nest.
   * @param leaf - Value to place at the bottom.
   * @returns A chain of objects `depth` levels deep.
   */
  const nest = (depth: number, leaf: unknown): unknown => {
    let node: unknown = leaf;

    for (let index = 0; index < depth; index += 1) {
      node = {next: node};
    }

    return node;
  };

  describe('nested non-JSON values are rejected before sending', () => {
    const cases: [string, unknown][] = [
      ['a nested function', {a: {b: (): void => undefined}}],
      ['a top-level function property', {a: (): void => undefined}],
      ['a nested undefined', {a: {b: undefined}}],
      ['NaN', {a: Number.NaN}],
      ['Infinity', {a: Number.POSITIVE_INFINITY}],
      ['-Infinity', {a: Number.NEGATIVE_INFINITY}],
      ['a nested symbol value', {a: {b: Symbol('nope')}}],
      ['a function inside an array', [1, (): void => undefined]],
      ['a Date, which is not a JSON value', {at: new Date()}],
      ['a Map', {m: new Map()}],
      ['a class instance', {c: new (class Thing {})()}],
      ['a sparse array hole', [1, , 3]],
    ];

    cases.forEach(([why, payload]) => {
      it(`refuses ${why}`, () => {
        const result = checkPayload(payload, 65536);

        assert.isFalse(result.ok);
        assert.equal(
          result.ok ? '' : result.rejection,
          PayloadRejection.NOT_SERIALISABLE,
          // These all used to be accepted: `JSON.stringify` drops functions, symbols
          // and `undefined`, and rewrites NaN/Infinity to null, so it returned a string
          // and the bridge went on to send the *original* object.
          `${why} must not be treated as serialisable`
        );
      });
    });

    it('still accepts ordinary JSON', () => {
      const result = checkPayload(
        {a: 1, b: 'two', c: [true, null, {d: 0.5}], e: {}},
        65536
      );

      assert.isTrue(result.ok);
    });

    it('accepts a value shared by two branches, which is not a cycle', () => {
      const shared = {v: 1};

      assert.isTrue(checkPayload({left: shared, right: shared}, 65536).ok);
    });

    it('still refuses a true cycle', () => {
      const cyclic: Record<string, unknown> = {};

      cyclic.self = cyclic;

      const result = checkPayload(cyclic, 65536);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.NOT_SERIALISABLE);
    });

    it('refuses a symbol-keyed property on an array, not only on an object', () => {
      const array: unknown[] = [1, 2];

      (array as unknown as Record<symbol, unknown>)[Symbol('extra')] = 'dropped in transit';

      assert.isFalse(checkPayload(array, 65536).ok);
    });

    it('refuses an extra string key on an array', () => {
      const array: unknown[] = [1, 2];

      (array as unknown as Record<string, unknown>).extra = 'dropped in transit';

      assert.isFalse(checkPayload(array, 65536).ok);
    });

    it('refuses an Array subclass, which arrives as a plain array', () => {
      class Mine extends Array {}

      const instance = Mine.from([1, 2]);

      assert.isFalse(checkPayload(instance, 65536).ok);
    });

    it('refuses an accessor property without invoking it', () => {
      let invoked = false;
      const payload = {
        get trap(): string {
          invoked = true;

          return 'value';
        },
      };

      const result = checkPayload(payload, 65536);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.NOT_SERIALISABLE);
      // Reading it would run caller code inside a message handler, and a getter is read
      // twice on the way out — so one returning different values each time could pass
      // validation and send something else.
      assert.isFalse(invoked, 'the getter must never be called');
    });

    it('refuses an accessor on an ARRAY INDEX without invoking it', () => {
      // The first cut of this fix checked descriptors on the object branch only and
      // still read array indices with `items[index]`. An array index can carry a getter
      // just as an object key can, and that one gap re-opened every check below it: the
      // getter ran, and a getter returning something benign on its first read and a
      // `__proto__` key, a `NaN`, or an exponentially expanding DAG on its second passed
      // validation and was then sent.
      let reads = 0;
      const hostile: unknown[] = [];

      Object.defineProperty(hostile, 0, {
        get(): unknown {
          reads += 1;

          return reads === 1 ? 1 : {['__proto__']: {polluted: true}};
        },
        enumerable: true,
        configurable: true,
      });

      const result = checkPayload(hostile, 65536);

      assert.isFalse(result.ok, 'an array carrying an accessor must be refused');
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.NOT_SERIALISABLE);
      assert.equal(reads, 0, 'the array-index getter must never be called');
    });

    it('refuses a setter on an array index', () => {
      const hostile: unknown[] = [];

      Object.defineProperty(hostile, 0, {
        set(): void {
          /* no-op */
        },
        enumerable: true,
        configurable: true,
      });

      assert.isFalse(checkPayload(hostile, 65536).ok);
    });

    it('refuses a non-enumerable own property, which is dropped in transit', () => {
      const payload: Record<string, unknown> = {a: 1};

      Object.defineProperty(payload, 'hidden', {
        value: 2,
        enumerable: false,
        writable: true,
        configurable: true,
      });

      // `JSON.stringify` and structured clone both omit it, so the payload would arrive
      // different from what was sent — the same fidelity rule as symbol keys.
      assert.isFalse(checkPayload(payload, 65536).ok);
    });

    it('accepts ordinary dense arrays of every size', () => {
      [0, 1, 2, 3, 10, 100].forEach((length) => {
        const array = Array.from({length}, (_unused, index) => index);

        assert.isTrue(checkPayload(array, 1048576).ok, `length ${length} must be accepted`);
      });
    });

    it('returns a rejection rather than throwing for a hostile getter', () => {
      const payload = {
        get boom(): never {
          throw new Error('from inside a payload');
        },
      };

      // Before this guard the raw Error escaped `checkPayload`, so `publish()` threw
      // something that was not a BridgeError.
      const result = checkPayload(payload, 65536);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.NOT_SERIALISABLE);
    });

    it('refuses an exponentially expanding DAG quickly, rather than hanging', () => {
      // A diamond chain: every level references the same child twice. Only ~60 distinct
      // objects in memory, but JSON has no way to express a shared reference, so
      // `JSON.stringify` writes 2^60 nodes. Structured clone *preserves* the sharing, so
      // this survives `postMessage` intact and reaches the validator — which runs before
      // any rate limiter can bound it.
      let node: unknown = {leaf: true};

      for (let index = 0; index < MAX_WALK_DEPTH - 4; index += 1) {
        node = {a: node, b: node};
      }

      const started = Date.now();
      const result = checkPayload(node, 1048576);
      const elapsed = Date.now() - started;

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.TOO_LARGE);
      assert.isBelow(elapsed, 1000, 'must be refused by the expansion budget, not walked');
    });

    it('accepts a modestly shared subtree and walks it once', () => {
      // Sharing itself is fine — the cost is what is bounded. This expands to a few
      // hundred nodes, well inside the budget.
      let node: unknown = {leaf: true};

      for (let index = 0; index < 8; index += 1) {
        node = {a: node, b: node};
      }

      assert.isTrue(checkPayload(node, 1048576).ok);
    });

    it('still reports a cycle reached through a shared subtree', () => {
      const child: Record<string, unknown> = {};
      const root: Record<string, unknown> = {left: child, right: child};

      child.back = root;

      const result = checkPayload(root, 65536);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.NOT_SERIALISABLE);
    });

    it('does not let the memo excuse a subtree that overflows at a deeper position', () => {
      // The subtree is cleared once at a shallow depth. Re-encountered near the bound it
      // must be re-checked, not waved through: "it fitted before" is only sound when the
      // second position is at least as shallow as the first.
      const subtree = nest(20, {leaf: true});
      const deep = nest(MAX_WALK_DEPTH - 10, subtree);
      const payload = {shallow: subtree, deep};

      const result = checkPayload(payload, 1048576);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.TOO_DEEP);
    });
  });

  describe('depth overflow is a rejection, not a clean result', () => {
    it('rejects a payload nested past the walk bound', () => {
      const result = checkPayload(nest(MAX_WALK_DEPTH + 5, 1), 1048576);

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.rejection, PayloadRejection.TOO_DEEP);
    });

    it('does not let a reserved key hide below the bound', () => {
      // The original defect: the walk returned `undefined` on depth overflow, which is
      // the same value it returns for "nothing reserved found", so a `__proto__` buried
      // deeper than the bound passed the reserved-key rule entirely.
      const buried = nest(MAX_WALK_DEPTH + 10, {['__proto__']: {polluted: true}});
      const result = checkPayload(buried, 1048576);

      assert.isFalse(result.ok);
      assert.notEqual(result.ok ? '' : result.rejection, undefined);
    });

    it('reports depth overflow distinctly from a reserved key', () => {
      const deep = inspectJson(nest(MAX_WALK_DEPTH + 1, 1), RESERVED_KEYS);
      const reserved = inspectJson({['__proto__']: 1}, RESERVED_KEYS);

      assert.equal(deep.ok ? '' : deep.rejection, JsonRejection.TOO_DEEP);
      assert.equal(reserved.ok ? '' : reserved.rejection, JsonRejection.RESERVED_KEY);
    });

    it('accepts a payload just inside the bound', () => {
      assert.isTrue(checkPayload(nest(MAX_WALK_DEPTH - 2, 1), 1048576).ok);
    });
  });

  describe('publish() only ever throws a BridgeError', () => {
    it('normalises a postMessage failure into INVALID_PAYLOAD', () => {
      const win = createFakeWindow('https://app.example.com');

      // Validation and the structured clone algorithm should agree, so this branch is
      // unreachable by construction. It is asserted anyway: the cost of them ever
      // disagreeing is the one exception out of `publish()` that is not coded, and a
      // caller's `catch (e) { if (e instanceof BridgeError) ... }` silently misses it.
      // Constructed and attached first: the bridge posts a HELLO during construction,
      // and `publish()` refuses outright while disconnected. This test is about the hop
      // after both of those.
      const bridge = createWebBridgeWith(win, {allowedOrigins: ['https://app.example.com']});

      win.inject({
        data: createEnvelope({
          channel: DEFAULT_CHANNEL,
          kind: EnvelopeKind.HELLO,
          source: EnvelopeSource.EXTENSION,
          topic: 'bridge.control',
          id: 'hello-from-relay',
          session: 'relay-session',
        }),
        origin: 'https://app.example.com',
        source: win,
      });

      assert.isTrue(bridge.isConnected, 'the handshake must complete first');

      const originalPost = win.postMessage.bind(win);

      (win as {postMessage: (message: unknown, target: string) => void}).postMessage = () => {
        throw new Error('DataCloneError stand-in');
      };

      try {
        bridge.publish('demo.topic', {a: 1});
        assert.fail('expected a rejection');
      } catch (error) {
        assert.instanceOf(error, BridgeError, 'must be a BridgeError, not a raw Error');
        assert.equal((error as BridgeError).code, 'INVALID_PAYLOAD');
      } finally {
        (win as {postMessage: (message: unknown, target: string) => void}).postMessage =
          originalPost;
        bridge.destroy();
      }
    });
  });

  describe('rate limiting cannot be bypassed by cycling topics', () => {
    it('caps a tab in aggregate however many topic names it invents', () => {
      let time = 0;
      const limiter = new RateLimiter({
        perSecond: 5,
        aggregatePerSecond: 10,
        maxKeys: 4,
        now: () => time,
      });

      let allowed = 0;

      for (let index = 0; index < 500; index += 1) {
        if (limiter.allow(rateLimitKey(1, `topic-${index}`))) {
          allowed += 1;
        }
      }

      // Before the fix every one of these took the new-key path, evicted a bucket and
      // received a full budget, so all 500 were allowed.
      assert.equal(allowed, 10);
      assert.isAtMost(limiter.size, 4);
    });

    it('still bounds the per-topic map', () => {
      let time = 0;
      const limiter = new RateLimiter({perSecond: 5, maxKeys: 4, now: () => time});

      for (let index = 0; index < 1000; index += 1) {
        time += 1000;
        limiter.allow(rateLimitKey(1, `topic-${index}`));
      }

      assert.isAtMost(limiter.size, 4);
    });

    it('keeps tabs independent of one another', () => {
      let time = 0;
      const limiter = new RateLimiter({perSecond: 2, aggregatePerSecond: 2, now: () => time});

      assert.isTrue(limiter.allow(rateLimitKey(1, 'a')));
      assert.isTrue(limiter.allow(rateLimitKey(1, 'b')));
      assert.isFalse(limiter.allow(rateLimitKey(1, 'c')));

      // A second tab has its own aggregate budget.
      assert.isTrue(limiter.allow(rateLimitKey(2, 'a')));
    });

    it('spends no token at either level on a refused message', () => {
      let time = 0;
      const limiter = new RateLimiter({perSecond: 1, aggregatePerSecond: 50, now: () => time});

      assert.isTrue(limiter.allow(rateLimitKey(1, 'a')));
      assert.isFalse(limiter.allow(rateLimitKey(1, 'a')));
      assert.isFalse(limiter.allow(rateLimitKey(1, 'a')));

      // The three refusals above must not have drained the aggregate bucket, so
      // another topic on the same tab is still free to send.
      assert.isTrue(limiter.allow(rateLimitKey(1, 'b')));
    });

    it('refills both levels over time', () => {
      let time = 0;
      const limiter = new RateLimiter({perSecond: 2, aggregatePerSecond: 2, now: () => time});

      assert.isTrue(limiter.allow(rateLimitKey(1, 'a')));
      assert.isTrue(limiter.allow(rateLimitKey(1, 'a')));
      assert.isFalse(limiter.allow(rateLimitKey(1, 'a')));

      time += 1000;

      assert.isTrue(limiter.allow(rateLimitKey(1, 'a')));
    });
  });

  describe('envelope validation completes the wire contract', () => {
    /**
     * @param overrides - Fields to set on the envelope.
     * @returns A validation result for an envelope built from those fields.
     */
    const validate = (overrides: Record<string, unknown>) => {
      const envelope = createEnvelope({
        channel: CHANNEL,
        kind: EnvelopeKind.PUSH,
        source: EnvelopeSource.PAGE,
        topic: 'demo.topic',
        id: 'id-1',
        session: SESSION,
        ...overrides,
      } as never);

      return validateEnvelope(envelope, {
        channel: CHANNEL,
        expectedSource: EnvelopeSource.PAGE,
        session: SESSION,
        maxPayloadBytes: 65536,
        now: Date.now(),
      });
    };

    it('refuses a correlationId on a PUSH', () => {
      const result = validate({kind: EnvelopeKind.PUSH, correlationId: 'req-1'});

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.reason, DropReason.INVALID_CORRELATION_ID);
    });

    it('refuses a correlationId on a REQUEST', () => {
      const result = validate({kind: EnvelopeKind.REQUEST, correlationId: 'req-1'});

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.reason, DropReason.INVALID_CORRELATION_ID);
    });

    it('refuses a correlationId on a HELLO', () => {
      const result = validate({kind: EnvelopeKind.HELLO, correlationId: 'req-1'});

      assert.isFalse(result.ok);
      assert.equal(result.ok ? '' : result.reason, DropReason.INVALID_CORRELATION_ID);
    });

    it('still accepts a null correlationId on a PUSH', () => {
      assert.isTrue(validate({kind: EnvelopeKind.PUSH}).ok);
    });

    it('accepts a well-formed failed RESPONSE', () => {
      const result = validate({
        kind: EnvelopeKind.RESPONSE,
        correlationId: 'req-1',
        ok: false,
        error: {code: 'HANDLER_ERROR', message: 'The handler failed'},
      });

      assert.isTrue(result.ok);
    });

    const badErrors: [string, unknown][] = [
      ['a missing error', undefined],
      ['a null error', null],
      ['a string error', 'HANDLER_ERROR'],
      ['an array error', ['HANDLER_ERROR']],
      ['an error with no code', {message: 'nope'}],
      ['an error with a non-string code', {code: 7, message: 'nope'}],
      ['an error with an empty code', {code: '', message: 'nope'}],
      ['an error with a non-string message', {code: 'HANDLER_ERROR', message: 7}],
      ['an error carrying an unknown key', {code: 'HANDLER_ERROR', message: 'x', extra: 1}],
    ];

    badErrors.forEach(([why, error]) => {
      it(`refuses a failed RESPONSE with ${why}`, () => {
        const result = validate({
          kind: EnvelopeKind.RESPONSE,
          correlationId: 'req-1',
          ok: false,
          ...(error === undefined ? {} : {error}),
        });

        assert.isFalse(result.ok, `${why} should not validate`);
        assert.equal(result.ok ? '' : result.reason, DropReason.INVALID_ERROR);
      });
    });

    it('does not demand an error on a successful RESPONSE', () => {
      const result = validate({
        kind: EnvelopeKind.RESPONSE,
        correlationId: 'req-1',
        ok: true,
        payload: {value: 1},
      });

      assert.isTrue(result.ok);
    });
  });
});
