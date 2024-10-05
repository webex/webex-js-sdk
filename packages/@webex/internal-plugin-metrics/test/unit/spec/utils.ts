import {assert} from '@webex/test-helper-chai';
import {Utils} from '@webex/internal-plugin-metrics';

describe('internal-plugin-metrics', () => {
  describe('generateCommonErrorMetadata', () => {
    it('should return JSON stringified error object', () => {
      const error = new Error('test error');
      const result = Utils.generateCommonErrorMetadata(error);
      assert.deepEqual(result, JSON.stringify({
        message: 'test error',
        name: 'Error',
        stack: error.stack
      }))
    });

    it('should return error if not instanceof Error', () => {
      const error = 'test error';
      const result = Utils.generateCommonErrorMetadata(error);
     assert.deepEqual(result, 'test error')
    });
  });
})
