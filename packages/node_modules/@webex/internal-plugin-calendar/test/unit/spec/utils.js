import {assert} from '@webex/test-helper-chai';

import CalendarUtils from '../../../src/util';

describe('Calendar utils', () => {
  describe('#calculateEndTime()', () => {
    it('return the end time for meeting', () => {
      const result = CalendarUtils.calculateEndTime({start: '2020-02-21T18:57:00.000Z', durationMinutes: 30});

      assert.equal(new Date(result.endTime).toISOString(), '2020-02-21T19:27:00.000Z');
    });
  });
});
