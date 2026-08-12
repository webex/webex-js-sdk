import {assert} from '@webex/test-helper-chai';

import {RESERVED_KEYS} from '../../../../src/core/constants';
import {findReservedKey, nullPrototypeRecord, readOwn} from '../../../../src/core/json';

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

  describe('findReservedKey', () => {
    RESERVED_KEYS.forEach((key) => {
      it(`finds '${key}' at the top level`, () => {
        assert.equal(findReservedKey(JSON.parse(`{"${key}": {}}`), RESERVED_KEYS), key);
      });

      it(`finds '${key}' nested inside an array`, () => {
        const value = JSON.parse(`{"a": [1, {"b": {"${key}": 1}}]}`);

        assert.equal(findReservedKey(value, RESERVED_KEYS), key);
      });
    });

    it('accepts clean values', () => {
      assert.isUndefined(findReservedKey({a: [1, 2, {b: 'c'}], d: null}, RESERVED_KEYS));
      assert.isUndefined(findReservedKey('a string', RESERVED_KEYS));
      assert.isUndefined(findReservedKey(null, RESERVED_KEYS));
    });

    it('does not confuse a reserved name used as a value', () => {
      assert.isUndefined(findReservedKey({name: '__proto__'}, RESERVED_KEYS));
    });

    it('terminates on a self-referential structure', () => {
      const cyclic: Record<string, unknown> = {a: 1};

      cyclic.self = cyclic;

      assert.isUndefined(findReservedKey(cyclic, RESERVED_KEYS));
    });

    it('terminates on a structure deeper than the walk limit', () => {
      let deep: Record<string, unknown> = {};

      for (let index = 0; index < 500; index += 1) {
        deep = {next: deep};
      }

      assert.isUndefined(findReservedKey(deep, RESERVED_KEYS));
    });
  });
});
