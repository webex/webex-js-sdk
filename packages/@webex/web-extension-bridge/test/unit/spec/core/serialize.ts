import {assert} from '@webex/test-helper-chai';

import {BridgeError} from '../../../../src/core/errors';
import {
  PayloadRejection,
  assertPayload,
  assertTopic,
  checkPayload,
  isValidTopic,
  utf8ByteLength,
} from '../../../../src/core/serialize';

describe('core/serialize', () => {
  describe('utf8ByteLength', () => {
    [
      {input: '', bytes: 0},
      {input: 'abc', bytes: 3},
      {input: '£', bytes: 2},
      {input: '€', bytes: 3},
      {input: '😀', bytes: 4},
    ].forEach(({input, bytes}) => {
      it(`measures '${input}' as ${bytes} bytes`, () => {
        assert.equal(utf8ByteLength(input), bytes);
      });
    });

    it('measures bytes rather than code units, so multi-byte text cannot bypass the cap', () => {
      const text = '😀'.repeat(10);

      assert.equal(text.length, 20);
      assert.equal(utf8ByteLength(text), 40);
    });
  });

  describe('checkPayload', () => {
    it('accepts undefined at no cost', () => {
      assert.deepEqual(checkPayload(undefined, 10), {ok: true, bytes: 0});
    });

    [null, true, 0, 'text', [1, 2], {a: {b: [null]}}].forEach((payload) => {
      it(`accepts ${JSON.stringify(payload)}`, () => {
        assert.isTrue(checkPayload(payload, 1024).ok);
      });
    });

    it('rejects a payload over the cap', () => {
      const result = checkPayload('x'.repeat(100), 50);

      assert.deepEqual(result, {ok: false, rejection: PayloadRejection.TOO_LARGE});
    });

    it('accepts a payload exactly at the cap', () => {
      // 10 characters plus two quote marks.
      assert.isTrue(checkPayload('x'.repeat(10), 12).ok);
      assert.isFalse(checkPayload('x'.repeat(10), 11).ok);
    });

    it('rejects a circular structure', () => {
      const cyclic: Record<string, unknown> = {};

      cyclic.self = cyclic;

      assert.deepEqual(checkPayload(cyclic, 1024), {
        ok: false,
        rejection: PayloadRejection.NOT_SERIALISABLE,
      });
    });

    [
      {name: 'a function', value: () => undefined},
      {name: 'a symbol', value: Symbol('nope')},
    ].forEach(({name, value}) => {
      it(`rejects ${name}`, () => {
        assert.deepEqual(checkPayload(value, 1024), {
          ok: false,
          rejection: PayloadRejection.NOT_SERIALISABLE,
        });
      });
    });

    it('rejects a BigInt, which JSON cannot represent', () => {
      assert.deepEqual(checkPayload({big: BigInt(1)}, 1024), {
        ok: false,
        rejection: PayloadRejection.NOT_SERIALISABLE,
      });
    });

    it('rejects a reserved key and names it', () => {
      const result = checkPayload(JSON.parse('{"__proto__": {"a": 1}}'), 1024);

      assert.isFalse(result.ok);
      assert.equal(result.ok === false && result.rejection, PayloadRejection.RESERVED_KEY);
      assert.equal(result.ok === false && result.key, '__proto__');
    });
  });

  describe('assertPayload', () => {
    it('is silent for a valid payload', () => {
      assert.doesNotThrow(() => assertPayload({a: 1}, 1024, 'demo'));
    });

    it('throws INVALID_PAYLOAD with the topic attached', () => {
      try {
        assertPayload('x'.repeat(100), 10, 'demo.topic');
        assert.fail('expected a throw');
      } catch (error) {
        assert.instanceOf(error, BridgeError);
        assert.equal((error as BridgeError).code, 'INVALID_PAYLOAD');
        assert.equal((error as BridgeError).topic, 'demo.topic');
      }
    });
  });

  describe('topics', () => {
    ['a', 'demo.topic', 'a_b-c', 'ns:topic', 'A1', 'x'.repeat(128)].forEach((topic) => {
      it(`accepts '${topic.length > 20 ? `${topic.length} chars` : topic}'`, () => {
        assert.isTrue(isValidTopic(topic));
        assert.doesNotThrow(() => assertTopic(topic));
      });
    });

    [
      {name: 'empty', topic: ''},
      {name: 'too long', topic: 'x'.repeat(129)},
      {name: 'a slash', topic: 'a/b'},
      {name: 'a space', topic: 'a b'},
      {name: 'a newline', topic: 'a\nb'},
      {name: 'a wildcard', topic: '*'},
      {name: 'a number', topic: 42},
      {name: 'null', topic: null},
      {name: 'undefined', topic: undefined},
    ].forEach(({name, topic}) => {
      it(`rejects ${name}`, () => {
        assert.isFalse(isValidTopic(topic));
        assert.throws(() => assertTopic(topic));
      });
    });

    it('rejects a topic that only partly matches, so an anchored pattern is required', () => {
      assert.isFalse(isValidTopic('good\nrm -rf /'));
      assert.isFalse(isValidTopic(' leading'));
      assert.isFalse(isValidTopic('trailing '));
    });

    it('accepts reserved property names, which are safe because topics are only Map keys', () => {
      // The charset admits these. They are harmless because no code path ever uses a
      // topic as an object property name; handler and limiter lookups all use a Map.
      assert.isTrue(isValidTopic('__proto__'));
      assert.isTrue(isValidTopic('constructor'));
    });
  });
});
