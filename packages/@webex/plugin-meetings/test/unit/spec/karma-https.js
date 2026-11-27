import {assert} from '@webex/test-helper-chai';

const checkKarmaHttps = require('../../utils/check-karma-https');

describe('meeting browser HTTPS preflight', () => {
  [undefined, '', 'false', '1'].forEach((value) => {
    it(`explains setup when KARMA_HTTPS is ${
      value === undefined ? 'unset' : JSON.stringify(value)
    }`, () => {
      const error = assert.throws(() => checkKarmaHttps({KARMA_HTTPS: value}));

      assert.include(error.message, 'Meeting browser tests require HTTPS');
      assert.include(error.message, 'From the repository root');
      assert.include(error.message, 'yarn setup:karma-https');
      assert.include(error.message, 'KARMA_HTTPS=true');
      assert.include(error.message, '.env file');
      assert.include(error.message, 'yarn workspace @webex/plugin-meetings test:browser');
    });
  });

  it('allows the run when KARMA_HTTPS=true', () => {
    assert.doesNotThrow(() => checkKarmaHttps({KARMA_HTTPS: 'true'}));
  });
});
