import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {DESTINATION_TYPE} from '@webex/plugin-meetings/src/constants';

import MeetingInfo from '@webex/plugin-meetings/src/meeting-info/index';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/util';
import MeetingInfoRequest from '@webex/plugin-meetings/src/meeting-info/request';

const flushPromises = () => new Promise(setImmediate);

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
      const checkResolvedFetchMeetingInfo = async ({meetingId, sendCAevents, shouldSendCAMetrics, confIdStrProp}) => {
        const body = {meetingKey: '1234323', url: 'url-123', confID: '123', meetingId: '321'};
        const bodyConfIdStr = {meetingKey: '1234323', url: 'url-123', confIdStr: '123', meetingId: '321'};

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .resolves({type: 'MEETING_ID', destination: '123456'});
        sinon.stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo').returns(Promise.resolve(confIdStrProp ? bodyConfIdStr : body));

        await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, null, null, null, null, null, {
          meetingId,
          sendCAevents,
        });

        const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
        const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

        if (shouldSendCAMetrics) {
          assert.deepEqual(submitInternalEventCalls[0].args[0], {
            name: 'internal.client.meetinginfo.request',
          });

          assert.deepEqual(submitClientEventCalls[0].args[0], {
            name: 'client.meetinginfo.request',
            options: {
              meetingId,
            },
          });

          assert.deepEqual(submitInternalEventCalls[1].args[0], {
            name: 'internal.client.meetinginfo.response',
          });

          assert.deepEqual(submitClientEventCalls[1].args[0], {
            name: 'client.meetinginfo.response',
            payload: {
              identifiers: {
                meetingLookupUrl: 'url-123',
              },
            },
            options: {
              meetingId,
              webexConferenceIdStr: '123',
              globalMeetingId: '321'
            },
          });
        } else {
          assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
          assert.notCalled(webex.internal.newMetrics.submitClientEvent);
        }
      }
      it('should send ca events if meetingId present and send CA events is authorized', async () => {
        checkResolvedFetchMeetingInfo({meetingId: 'meetingId', sendCAevents: true, shouldSendCAMetrics: true});
      });

      it('should send ca events if meetingId present and send CA events is authorized and confIdStrProp is true', async () => {
        checkResolvedFetchMeetingInfo({meetingId: 'meetingId', sendCAevents: true, shouldSendCAMetrics: true, confIdStrProp: true});
      });

      it('should not send ca events if meetingId not present even if CA events are authorized', async () => {
        checkResolvedFetchMeetingInfo({sendCAevents: true, shouldSendCAMetrics: false});
      });

      it('should not send ca events if CA events are not authorized', async () => {
        checkResolvedFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false});
      });

      it('should not send ca events if meeting id is not present and CA events are not authorized', async () => {
        checkResolvedFetchMeetingInfo({shouldSendCAMetrics: false});
      });

      const checkFailingFetchMeetingInfo = async ({meetingId, sendCAevents, shouldSendCAMetrics}) => {
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
            DESTINATION_TYPE.MEETING_ID,
            null,
            null,
            null,
            null,
            null,
            {
              meetingId,
              sendCAevents,
            }
          );
        } catch (err) {
          const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

          if(shouldSendCAMetrics) {  
            assert.deepEqual(submitInternalEventCalls[0].args[0], {
              name: 'internal.client.meetinginfo.request',
            });

            assert.deepEqual(submitClientEventCalls[0].args[0], {
              name: 'client.meetinginfo.request',
              options: {
                meetingId: 'meetingId',
              },
            });

            assert.deepEqual(submitInternalEventCalls[1].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
  
            assert.deepEqual(submitClientEventCalls[1].args[0], {
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
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }
        }
      }

      it('should send ca events when fails if meetingId present and CA events are authorized', async () => {
        checkFailingFetchMeetingInfo({meetingId: 'meetingId', sendCAevents: true, shouldSendCAMetrics: true})
      });

      it('should not send ca events when fails if meetingId present and CA events are not authorized', async () => {
        checkFailingFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false})
      });

      it('should not send ca events when fails if meetingId not present even if CA events are authorized', async () => {
        checkFailingFetchMeetingInfo({sendCAevents: true, shouldSendCAMetrics: false})
      });

      it('should not send ca events when fails if meetingId not present and CA events are not authorized', async () => {
        checkFailingFetchMeetingInfo({shouldSendCAMetrics: false})
      });

      const checkRetryFetchMeetingInfo = async ({meetingId, sendCAevents, shouldSendCAMetrics}) => {
        const reject = {
          statusCode: 403,
          body: {message: 'msg', code: 403102, data: {meetingInfo: {}}},
          url: 'http://api-url.com',
        };

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .resolves({type: 'MEETING_LINK', destination: '123456', url: 'success-url-123'});
        const requestStub = sinon
          .stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo')
          .rejects(reject);

        try {
          await meetingInfo.fetchMeetingInfo(
            '1234323',
            DESTINATION_TYPE.MEETING_ID,
            null,
            null,
            null,
            null,
            null,
            {
              meetingId,
              sendCAevents,
            }
          );
          assert.fail('fetchMeetingInfo should have thrown, but has not done that');
        } catch (err) {
          let submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          let submitClientEventCalls = webex.internal.newMetrics.submitClientlEvent.getCalls();

          if(shouldSendCAMetrics) {
            assert.deepEqual(submitInternalEventCalls[0].args[0], {
              name: 'internal.client.meetinginfo.request',
            });

            assert.deepEqual(submitClientEventCalls[0].args[0], {
              name: 'client.meetinginfo.request',
            });

            assert.deepEqual(submitInternalEventCalls[1].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
  
            assert.deepEqual(submitClientEventCalls[1].args[0], {
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

            assert.deepEqual(submitInternalEventCalls[2].args[0], {
              name: 'internal.client.meetinginfo.request',
            });
  
            assert.deepEqual(submitClientEventCalls[2].args[0], {
              name: 'client.meetinginfo.request',
              payload: {
                identifiers: {
                  meetingLookupUrl: 'success-url-123',
                },
              },
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }

          requestStub.resolves({});

          await flushPromises();

          submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

          if(shouldSendInternalCAMetrics) {
            assert.deepEqual(submitInternalEventCalls[3].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
          }

          if(shouldSendCAMetrics) {
            assert.deepEqual(submitClientEventCalls[3].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }
        }
      }

      it('should send ca events when in the retry as well if meetingId present and CA events are authorized', async () => {
        checkRetryFetchMeetingInfo({meetingId: 'meetingId', sendCAevents: true, shouldSendCAMetrics: true})
      });

      it('should not send ca events when in the retry as well if meetingId not present and CA events are authorized', async () => {
        checkRetryFetchMeetingInfo({sendCAevents: true, shouldSendCAMetrics: false})
      });

      it('should not send ca events when in the retry as well if meetingId present and CA events are not authorized', async () => {
        checkRetryFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false})
      });

      it('should not send ca events when in the retry as well if meetingId not present and CA events are not authorized', async () => {
        checkRetryFetchMeetingInfo({shouldSendCAMetrics: false})
      });
    });
  });
});
