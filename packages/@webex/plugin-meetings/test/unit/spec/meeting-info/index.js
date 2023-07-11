import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {_MEETING_ID_} from '@webex/plugin-meetings/src/constants';

import MeetingInfo from '@webex/plugin-meetings/src/meeting-info/index';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/util';
import MeetingInfoRequest from '@webex/plugin-meetings/src/meeting-info/request';

describe('plugin-meetings', () => {
  let webex;
  let meetingInfo = null;

  afterEach(() => {
    sinon.restore();
  });

  describe('Meeting Info V1', () => {
    beforeEach(() => {
      webex = new MockWebex({});

      meetingInfo = new MeetingInfo(webex);
    });

    describe('#fetchMeetingInfo', () => {
      it('should send ca events if meetingId present', async () => {
        const body = {meetingKey: '1234323'};

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo').returns(Promise.resolve(body));

        await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, null, null, null, null, null, {
          meetingId: 'meetingId',
        });

        const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();

        assert(submitInternalEventCalls[0].args, {
          name: 'internal.client.meetinginfo.request',
        });
        assert(submitInternalEventCalls[1].args, {
          name: 'internal.client.meetinginfo.response',
        });
      });

      it('should not send ca events if meetingId not present', async () => {
        const body = {meetingKey: '1234323'};

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo').returns(Promise.resolve(body));

        await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, null, null, null, null, null);

        assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
      });

      it('should send ca events when fails and if meetingId present', async () => {
        const reject = {
          statusCode: 403,
          body: {message: 'msg', code: 403102, data: {meetingInfo: {}}},
          url: 'http://api-url.com',
        };

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon
          .stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo')
          .returns(Promise.reject(reject));

        try {
          await meetingInfo.fetchMeetingInfo(
            '1234323',
            _MEETING_ID_,
            null,
            null,
            null,
            null,
            null,
            {
              meetingId: 'meetingId',
            }
          );
        } catch (err) {
          const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();

          assert(submitInternalEventCalls[0].args, {
            name: 'internal.client.meetinginfo.request',
          });

          assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.meetinginfo.response',
            payload: {
              identifiers: {
                meetingLookupUrl: 'http://api-url.com',
              },
            },
            options: {
              meetingId: 'meetingId',
              rawError: err,
            },
          });
        }
      });
    });
  });
});
