import {assert} from '@webex/test-helper-chai';
import {millisToMinutesAndSeconds} from '@webex/internal-plugin-voicea/src/utils';

describe('Voicea utils', () => {
  describe('#millisToMinutesAndSeconds()', () => {
    it('returns the correct timestamp', () => {
      const result = millisToMinutesAndSeconds(2000);

      assert.equal(result, '0:02');
    });
  });
});
