/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {_PERSONAL_ROOM_} from '@webex/plugin-meetings/src/constants';
import PersonalMeetingRoom from '@webex/plugin-meetings/src/personal-meeting-room';

describe('personal-meeting-room', () => {
  let meetingInfo;
  let pmr;

  beforeEach(() => {
    meetingInfo = {
      fetchMeetingInfo: sinon.stub().returns(Promise.resolve({body: {isPmr: true}})),
    };
    pmr = new PersonalMeetingRoom({meetingInfo}, {parent: {}});
  });

  describe('#get()', () => {
    it('returns personal meeting room info', async () => {
      await pmr.get();
      assert.calledOnce(meetingInfo.fetchMeetingInfo);
      assert.calledWith(meetingInfo.fetchMeetingInfo, {type: _PERSONAL_ROOM_});
    });
  });
});
