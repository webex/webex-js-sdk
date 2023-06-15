import {assert} from '@webex/test-helper-chai';
import {anonymizeIPAddress, clearEmpty, userAgentToString} from '../../../../src/call-diagnostic/call-diagnostic-metrics.util';
import sinon from 'sinon';
import * as anonymize from 'ip-anonymize';


describe('internal-plugin-metrics', () => {
  // describe('userAgentToString', () => {
  //   it('returns the correct result', () => {
  //     const res = userAgentToString({clientName: 'client-name', webexVersion: '123'});
  //     assert.equal(res, 'webex-js-sdk/test-123 client=client-name; (os=linux/5)');
  //   })
  // })

  // describe('anonymizeIPAddress', () => {
  //   it('calls the correct function', () => {
  //     const anonymizeSpy = sinon.stub(anonymize, 'default');
  //     anonymizeIPAddress("1.1.1.1");
  //     assert.calledOnce(anonymizeSpy)
  //     assert.calledWith(anonymizeSpy, "1.1.1.1", 28, 96);
  //   })
  // })

  describe('clearEmpty', () => {
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
      clearEmpty(obj);
      console.log(obj);
      assert.deepEqual(obj, {nested: {arr: ['test']}});
    });

    it('should not modify non-empty objects and arrays', () => {
      const obj = {
        foo: 'bar',
        arr: [1, 2, 3],
      };
      clearEmpty(obj);
      assert.deepEqual(obj, {foo: 'bar', arr: [1, 2, 3]});
    });

    it('should not modify non-object and non-array values', () => {
      const obj = {
        prop1: 'value1',
        prop2: 123,
      };
      clearEmpty(obj);
      assert.deepEqual(obj, {prop1: 'value1', prop2: 123});
    });

    it('should handle nested empty objects and arrays', () => {
      const obj = {
        foo: {
          bar: {},
          baz: [],
        },
      };
      clearEmpty(obj);
      assert.deepEqual(obj, {foo: {}});
    });

    it('should handle an empty input object', () => {
      const obj = {};
      clearEmpty(obj);
      assert.deepEqual(obj, {});
    });
  });
});
