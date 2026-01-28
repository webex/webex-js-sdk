import chai from 'chai';
import {sanitizeParams} from '@webex/plugin-meetings/src/webinar/utils';

const {assert} = chai;

describe('plugin-meetings', () => {
  describe('webinar utils', () => {
    describe('#sanitizeParams', () => {
      it('sanitizes params by removing undefined, "", or null values', () => {
        const input = {
          a: 1,
          b: undefined,
          c: null,
          d: 'test',
          e: false,
          f: '',
        };
        const expectedOutput = {
          a: 1,
          d: 'test',
          e: false,
        };
        const result = sanitizeParams(input);
        assert.deepEqual(result, expectedOutput);
      });

      it('returns an empty object when all values are invalid', () => {
        const input = {
          a: undefined,
          b: null,
          c: '',
        };
        const expectedOutput = {};
        const result = sanitizeParams(input);
        assert.deepEqual(result, expectedOutput);
      });
    });
  });
});
