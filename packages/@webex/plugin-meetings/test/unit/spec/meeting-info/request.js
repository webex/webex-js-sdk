/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import Device from '@webex/internal-plugin-device';
import Mercury from '@webex/internal-plugin-mercury';
import Meetings from '@webex/plugin-meetings/src/meetings';
import {_LOCUS_ID_} from '@webex/plugin-meetings/src/constants';

import MeetingInfoRequest from '../../../../src/meeting-info/request';

describe('plugin-meetings', () => {
  let webex;
  let meetingInfoRequest = null;

  describe('meeting-info request', () => {
    beforeEach(() => {
      webex = new MockWebex({
        children: {
          device: Device,
          mercury: Mercury,
          meetings: Meetings,
        },
      });

      Object.assign(webex.internal, {
        device: {
          deviceType: 'FAKE_DEVICE',
          register: sinon.stub().returns(Promise.resolve()),
          unregister: sinon.stub().returns(Promise.resolve()),
        },
        mercury: {
          connect: sinon.stub().returns(Promise.resolve()),
          disconnect: sinon.stub().returns(Promise.resolve()),
          on: () => {},
          off: () => {},
        },
      });

      meetingInfoRequest = new MeetingInfoRequest(webex);
    });

    describe('#fetchMeetingInfo', () => {
      beforeEach(() => {
        webex.meetings.handleLocusMercury = sinon.stub().returns(true);
        webex.internal.mercury.on = sinon.stub().returns((type, callback) => {
          callback();
        });
      });

      it('Should call request with valid parameter', () => {
        meetingInfoRequest.fetchMeetingInfo({
          type: _LOCUS_ID_,
          destination: 'locus_url',
        });

        assert.calledWith(webex.request, {method: 'PUT', uri: 'locus_url/meetingInfo'});
      });
    });
  });
});
