import {assert} from '@webex/test-helper-chai';

import {RESERVED_KEYS} from '../../../../src/core/constants';
import {JsonRejection, inspectJson, nullPrototypeRecord, readOwn} from '../../../../src/core/json';

describe('core/json', () => {
  describe('nullPrototypeRecord', () => {
    it('produces an object that cannot reach Object.prototype', () => {
      const record = nullPrototypeRecord<number>();

      assert.isNull(Object.getPrototypeOf(record));
      assert.isUndefined((record as Record<string, unknown>).toString);
      assert.isUndefined((record as Record<string, unknown>).constructor);
    });
  });

  describe('readOwn', () => {
    it('reads own properties', () => {
      assert.equal(readOwn({a: 1}, 'a'), 1);
    });

    it('ignores inherited properties', () => {
      assert.isUndefined(readOwn(Object.create({inherited: 'yes'}), 'inherited'));
      assert.isUndefined(readOwn({}, 'toString'));
      assert.isUndefined(readOwn({}, 'constructor'));
    });

    [null, undefined, 42, 'text', true].forEach((value) => {
      it(`returns undefined for ${String(value)}`, () => {
        assert.isUndefined(readOwn(value, 'anything'));
      });
    });
  });

  describe('inspectJson: reserved keys', () => {
    /**
     * @param value - Value to inspect.
     * @returns The rejection reason, or `undefined` when the value was accepted.
     */
    const rejection = (value: unknown): string | undefined => {
      const result = inspectJson(value, RESERVED_KEYS);

      return result.ok ? undefined : result.rejection;
    };

    RESERVED_KEYS.forEach((key) => {
      it(`finds '${key}' at the top level`, () => {
        const result = inspectJson(JSON.parse(`{"${key}": {}}`), RESERVED_KEYS);

        assert.isFalse(result.ok);
        assert.equal(result.ok ? '' : result.rejection, JsonRejection.RESERVED_KEY);
        assert.equal(result.ok ? '' : result.key, key);
      });

      it(`finds '${key}' nested inside an array`, () => {
        const value = JSON.parse(`{"a": [1, {"b": {"${key}": 1}}]}`);
        const result = inspectJson(value, RESERVED_KEYS);

        assert.isFalse(result.ok);
        assert.equal(result.ok ? '' : result.key, key);
      });
    });

    it('accepts clean values', () => {
      assert.isUndefined(rejection({a: [1, 2, {b: 'c'}], d: null}));
      assert.isUndefined(rejection('a string'));
      assert.isUndefined(rejection(null));
    });

    it('does not confuse a reserved name used as a value', () => {
      assert.isUndefined(rejection({name: '__proto__'}));
    });

    it('terminates on a self-referential structure', () => {
      const cyclic: Record<string, unknown> = {a: 1};

      cyclic.self = cyclic;

      // Reported as a cycle rather than accepted. The old `findReservedKey` returned
      // `undefined` here, which is indistinguishable from "clean".
      assert.equal(rejection(cyclic), JsonRejection.CYCLE);
    });

    it('rejects, rather than accepts, a structure deeper than the walk limit', () => {
      let deep: Record<string, unknown> = {};

      for (let index = 0; index < 500; index += 1) {
        deep = {next: deep};
      }

      assert.equal(rejection(deep), JsonRejection.TOO_DEEP);
    });
  });
});
