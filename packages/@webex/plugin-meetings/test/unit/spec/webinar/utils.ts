import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {sanitizeParams} from '@webex/plugin-meetings/src/webinar/utils';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

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
    });
  });
});
