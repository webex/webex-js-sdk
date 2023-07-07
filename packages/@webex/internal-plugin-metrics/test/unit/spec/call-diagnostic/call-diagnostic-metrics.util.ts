import {assert} from '@webex/test-helper-chai';
import {
  clearEmptyKeysRecursively,
  isLocusServiceErrorCode,
} from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';

describe('internal-plugin-metrics', () => {
  describe('clearEmptyKeysRecursively', () => {
    it('should clear empty objects and empty nested objects recursively', () => {
      const obj = {
        foo: '',
        bar: {},
        baz: [],
        nested: {
          prop: {},
          arr: ['test'],
        },
      };
      clearEmptyKeysRecursively(obj);
      console.log(obj);
      assert.deepEqual(obj, {nested: {arr: ['test']}});
    });

    it('should not modify non-empty objects and arrays', () => {
      const obj = {
        foo: 'bar',
        arr: [1, 2, 3],
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {foo: 'bar', arr: [1, 2, 3]});
    });

    it('should not modify non-object and non-array values', () => {
      const obj = {
        prop1: 'value1',
        prop2: 123,
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {prop1: 'value1', prop2: 123});
    });

    it('should handle nested empty objects and arrays', () => {
      const obj = {
        foo: {
          bar: {},
          baz: [],
        },
      };
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {foo: {}});
    });

    it('should handle an empty input object', () => {
      const obj = {};
      clearEmptyKeysRecursively(obj);
      assert.deepEqual(obj, {});
    });
  });

  describe('isLocusServiceErrorCode', () => {
    [
      [10000, false],
      [2400000, true],
      ['2400000', true],
      [2400001, true],
      ['2400001', true],
      [240000, false],
      [14000000, false],
    ].forEach(([error, expected]) => {
      it(`for code ${error} returns the correct result`, () => {
        //@ts-ignore
        assert.deepEqual(isLocusServiceErrorCode(error), expected);
      });
    });
  });
});
