/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import Device from '@webex/internal-plugin-device';
import Mercury from '@webex/internal-plugin-mercury';
import {
  DESTINATION_TYPE,
  WBXAPPAPI_SERVICE,
} from '@webex/plugin-meetings/src/constants';

import Meetings from '@webex/plugin-meetings/src/meetings';
import MeetingInfo, {
  MeetingInfoV2PasswordError,
  MeetingInfoV2CaptchaError,
  MeetingInfoV2AdhocMeetingError,
  MeetingInfoV2PolicyError,
} from '@webex/plugin-meetings/src/meeting-info/meeting-info-v2';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/utilv2';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import {forEach} from 'lodash';

describe('plugin-meetings', () => {
  const conversation = {
    displayName: 'displayName',
    url: 'conversationUrl',
    encryptionKeyUrl: 'encryptionKeyUrl',
    kmsResourceObjectUrl: 'kmsResourceObjectUrl',
    participants: {
      items: [
        {
          id: '344ea183-9d5d-4e77-aed',
          emailAddress: 'testUser1@cisco.com',
          entryUUID: '344ea183-9d5d-4e77-',
        },
        {
          id: '40b446fe-175c-4628-8a9d',
          emailAddress: 'testUser2@cisco.com',
          entryUUID: '40b446fe-175c-4628',
        },
      ],
    },
  };
  let webex;
  let meetingInfo = null;

  beforeEach(() => {
    sinon.stub(Metrics, 'sendBehavioralMetric');
  });
  afterEach(() => {
    sinon.restore();
  });

  describe('Meeting Info V2', () => {
    beforeEach(() => {
      webex = new MockWebex({
        children: {
          device: Device,
          mercury: Mercury,
          meetings: Meetings,
        },
      });

      webex.meetings.preferredWebexSite = 'go.webex.com';
      webex.config.meetings = {
        experimental: {enableUnifiedMeetings: true, enableAdhocMeetings: true},
      };

      Object.assign(webex.internal, {
        device: {
          deviceType: 'FAKE_DEVICE',
          register: sinon.stub().returns(Promise.resolve()),
          unregister: sinon.stub().returns(Promise.resolve()),
          userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
        },
        mercury: {
          connect: sinon.stub().returns(Promise.resolve()),
          disconnect: sinon.stub().returns(Promise.resolve()),
          on: () => {},
          off: () => {},
        },
        conversation: {
          get: sinon.stub().returns(Promise.resolve(conversation)),
        },
      });

      meetingInfo = new MeetingInfo(webex);
    });

    describe('#fetchMeetingInfo', () => {
      it('should fetch meeting info for the destination type', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon
          .stub(MeetingInfoUtil, 'getDestinationType')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo({
          type: DESTINATION_TYPE.MEETING_ID,
          destination: '1234323',
        });

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {meetingKey: '1234323'},
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
      });

      it('should fetch meeting info for the personal meeting room type', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon
          .stub(MeetingInfoUtil, 'getDestinationType')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo({
          type: DESTINATION_TYPE.PERSONAL_ROOM,
        });

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {meetingKey: '1234323'},
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
      });

      it('should use the direct uri for the request if it exists', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon
          .stub(MeetingInfoUtil, 'getDestinationType')
          .returns(Promise.resolve({type: DESTINATION_TYPE.SIP_URI, destination: 'example@something.webex.com'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        sinon.stub(MeetingInfoUtil, 'getDirectMeetingInfoURI').returns('https://example.com');
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('example@something.webex.com', DESTINATION_TYPE.SIP_URI);

        assert.calledWith(MeetingInfoUtil.getDestinationType, {
          destination: 'example@something.webex.com',
          type: DESTINATION_TYPE.SIP_URI,
          webex,
        });
        assert.calledWith(MeetingInfoUtil.getDirectMeetingInfoURI, {
          destination: 'example@something.webex.com',
          type: DESTINATION_TYPE.SIP_URI,
        });
        assert.calledWith(webex.request, {
          method: 'POST',
          uri: 'https://example.com',
          body: {meetingKey: '1234323'},
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
        MeetingInfoUtil.getDirectMeetingInfoURI.restore();
      });

      it('should fetch meeting info with provided password and captcha code', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323'}};

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, 'abc', {
          id: '999',
          code: 'aabbcc11',
        });

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {
            supportHostKey: true,
            supportCountryList: true,
            meetingKey: '1234323',
            password: 'abc',
            captchaID: '999',
            captchaVerifyCode: 'aabbcc11',
          },
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
        );
      });

      it('should fetch meeting info with provided installedOrgID', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323'}};
        const installedOrgID = '123456';

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, null, null, installedOrgID);

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {
            supportHostKey: true,
            supportCountryList: true,
            meetingKey: '1234323',
            installedOrgID,
          },
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
        );
      });

      it('should fetch meeting info with provided locusId', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323'}};
        const locusId = 'eccd5c1b-d42d-35e3-a1b9-3021030a6d84';

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, null, null, null, locusId);

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {
            supportHostKey: true,
            supportCountryList: true,
            meetingKey: '1234323',
            locusId,
          },
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
        );
      });

      it('should fetch meeting info with provided extraParams', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323'}};
        const extraParams = {mtid: 'm9fe0afd8c435e892afcce9ea25b97046', joinTXId: 'TSmrX61wNF'}

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, null, null, null, null, extraParams);

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {
            supportHostKey: true,
            supportCountryList: true,
            meetingKey: '1234323',
            ...extraParams,
          },
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
        );
      });

      it('create adhoc meeting when conversationUrl passed with enableAdhocMeetings toggle', async () => {
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());
        await meetingInfo.fetchMeetingInfo('conversationUrl', DESTINATION_TYPE.CONVERSATION_URL);

        assert.calledWith(meetingInfo.createAdhocSpaceMeeting, 'conversationUrl');
        assert.notCalled(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('create adhoc meeting when conversationUrl and installedOrgID passed with enableAdhocMeetings toggle', async () => {
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());

        const installedOrgID = '12345'

        await meetingInfo.fetchMeetingInfo(
          'conversationUrl',
          DESTINATION_TYPE.CONVERSATION_URL,
          null,
          null,
          installedOrgID
        );

        assert.calledOnceWithExactly(
          meetingInfo.createAdhocSpaceMeeting,
          'conversationUrl',
          installedOrgID
        );
        assert.notCalled(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });


      it('should not call createAdhocSpaceMeeting if enableAdhocMeetings toggle is off', async () => {
        webex.config.meetings.experimental.enableAdhocMeetings = false;
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());

        await meetingInfo.fetchMeetingInfo('conversationUrl', DESTINATION_TYPE.CONVERSATION_URL);

        assert.notCalled(meetingInfo.createAdhocSpaceMeeting);
        assert.called(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('should not call createAdhocSpaceMeeting if enableAdhocMeetings toggle is on but preferredWebexSite', async () => {
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());
        webex.meetings.preferredWebexSite = undefined;

        await meetingInfo.fetchMeetingInfo('conversationUrl', DESTINATION_TYPE.CONVERSATION_URL);

        assert.notCalled(meetingInfo.createAdhocSpaceMeeting);
        assert.called(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('should throw an error MeetingInfoV2AdhocMeetingError if not able to start adhoc meeting for a conversation', async () => {
        webex.config.meetings.experimental.enableAdhocMeetings = true;

        webex.request = sinon.stub().rejects({stack: 'a stack', message: 'a message', statusCode: 403, body: {code: 400000}});
        try {
          await meetingInfo.createAdhocSpaceMeeting('conversationUrl');
        } catch (err) {
          assert.instanceOf(err, MeetingInfoV2AdhocMeetingError);
          assert.deepEqual(
            err.message,
            'Failed starting the adhoc meeting, Please contact support team , code=400000'
          );
          assert.equal(err.wbxAppApiCode, 400000);
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADHOC_MEETING_FAILURE,
            {reason: 'a message', stack: 'a stack'}
          );
        }
      });

      forEach(
        [
          {errorCode: 403049, sendCAevents: false},
          {errorCode: 403049, sendCAevents: true},
          {errorCode: 403049},
          {errorCode: 403104, sendCAevents: false},
          {errorCode: 403104, sendCAevents: true},
          {errorCode: 403104},
          {errorCode: 403103, sendCAevents: false},
          {errorCode: 403103, sendCAevents: true},
          {errorCode: 403103},
          {errorCode: 403048, sendCAevents: false},
          {errorCode: 403048, sendCAevents: true},
          {errorCode: 403048},
          {errorCode: 403102, sendCAevents: false},
          {errorCode: 403102, sendCAevents: true},
          {errorCode: 403102},
          {errorCode: 403101, sendCAevents: false},
          {errorCode: 403101, sendCAevents: true},
          {errorCode: 403101},
        ],
        ({errorCode, sendCAevents}) => {
          it(`should throw a MeetingInfoV2PolicyError for error code ${errorCode}`, async () => {
            const message = 'a message';
            const meetingInfoData = 'meeting info';

            webex.request = sinon.stub().rejects({
              statusCode: 403,
              body: {message, code: errorCode, data: {meetingInfo: meetingInfoData}},
              url: 'http://api-url.com',
            });
            try {
              await meetingInfo.fetchMeetingInfo(
                '1234323',
                DESTINATION_TYPE.MEETING_ID,
                'abc',
                {
                  id: '999',
                  code: 'aabbcc11',
                },
                null,
                null,
                {},
                {meetingId: 'meeting-id', sendCAevents}
              );
              assert.fail('fetchMeetingInfo should have thrown, but has not done that');
            } catch (err) {
              const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
              const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

              if (sendCAevents) {
                assert.deepEqual(submitInternalEventCalls[0].args[0], {
                  name: 'internal.client.meetinginfo.request',
                });

                assert.deepEqual(submitClientEventCalls[0].args[0], {
                  name: 'client.meetinginfo.request',
                  options: {
                    meetingId: 'meeting-id'
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
                    meetingId: 'meeting-id',
                    rawError: {
                      statusCode: 403,
                      body: {message, code: errorCode, data: {meetingInfo: meetingInfoData}},
                      url: 'http://api-url.com',
                    },
                  },
                });
              } else {
                assert.notCalled(webex.internal.newMetrics.submitClientEvent);
              }

              assert.instanceOf(err, MeetingInfoV2PolicyError);
              assert.deepEqual(err.message, `${message}, code=${errorCode}`);
              assert.equal(err.wbxAppApiCode, errorCode);
              assert.deepEqual(err.meetingInfo, meetingInfoData);
              assert(Metrics.sendBehavioralMetric.calledOnce);
              assert.calledWith(
                Metrics.sendBehavioralMetric,
                BEHAVIORAL_METRICS.MEETING_INFO_POLICY_ERROR,
                {code: errorCode}
              );
            }
          });
        }
      );

      forEach(
        [
          {meetingId: '123', sendCAevents: true, shouldSendCAevents: true},
          {sendCAevents: true, shouldSendCAevents: false},
          {meetingId: '123', sendCAevents: false, shouldSendCAevents: false},
          {shouldSendCAevents: false},
          {meetingId: '123', sendCAevents: true, shouldSendCAevents: true, confIdStr: '999'},
        ],
        ({meetingId, sendCAevents, shouldSendCAevents, confIdStr}) => {
          it('should send CA metric if meetingId is provided and send CA events is authorized', async () => {
            const requestResponse = {statusCode: 200, body: {meetingKey: '1234323', meetingId: '123', confID: '321'}};
            if (confIdStr) {
              requestResponse.body.confIdStr = confIdStr;
            }
            const extraParams = {mtid: 'm9fe0afd8c435e892afcce9ea25b97046', joinTXId: 'TSmrX61wNF'}

            webex.request.resolves(requestResponse);

            const result = await meetingInfo.fetchMeetingInfo(
              '1234323',
              DESTINATION_TYPE.MEETING_ID,
              null,
              null,
              null,
              null,
              extraParams,
              {meetingId, sendCAevents}
            );

            assert.calledWith(webex.request, {
              method: 'POST',
              service: WBXAPPAPI_SERVICE,
              resource: 'meetingInfo',
              body: {
                supportHostKey: true,
                supportCountryList: true,
                meetingKey: '1234323',
                ...extraParams,
              },
            });
            assert.deepEqual(result, requestResponse);
            assert(Metrics.sendBehavioralMetric.calledOnce);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
            );

            const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
            const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

            if(shouldSendCAevents) {
              assert.deepEqual(submitInternalEventCalls[0].args[0], {
                name: 'internal.client.meetinginfo.request',
              });
              assert.deepEqual(submitClientEventCalls[0].args[0], {
                name: 'client.meetinginfo.request',
                options: {
                  meetingId,
                }
              });

              assert.deepEqual(submitInternalEventCalls[1].args[0], {
                name: 'internal.client.meetinginfo.response',
              });
              assert.deepEqual(submitClientEventCalls[1].args[0], {
                name: 'client.meetinginfo.response',
                payload: {
                  identifiers: {
                    meetingLookupUrl: result?.url,
                  },
                },
                options: {
                  meetingId,
                  globalMeetingId: requestResponse.body?.meetingId,
                  webexConferenceIdStr: confIdStr ? requestResponse.body?.confIdStr : requestResponse.body?.confID,
                }
              });
            } else {
              assert.notCalled(webex.internal.newMetrics.submitClientEvent);
              assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            }
          })
        }
      )

      it('should send CA metric if meetingId is provided and send CA events is authorized', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323', confID: '123', meetingId: '321'}};
        const extraParams = {mtid: 'm9fe0afd8c435e892afcce9ea25b97046', joinTXId: 'TSmrX61wNF'}

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo(
          '1234323',
          DESTINATION_TYPE.MEETING_ID,
          null,
          null,
          null,
          null,
          extraParams,
          {meetingId: 'meetingId', sendCAevents: true}
        );

        assert.calledWith(webex.request, {
          method: 'POST',
          service: WBXAPPAPI_SERVICE,
          resource: 'meetingInfo',
          body: {
            supportHostKey: true,
            supportCountryList: true,
            meetingKey: '1234323',
            ...extraParams,
          },
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS
        );

        const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
        const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

        assert.deepEqual(submitInternalEventCalls[0].args[0], {
          name: 'internal.client.meetinginfo.request',
        });
        assert.deepEqual(submitClientEventCalls[0].args[0], {
          name: 'client.meetinginfo.request',
          options: {
            meetingId: 'meetingId',
          }
        });

        assert.deepEqual(submitInternalEventCalls[1].args[0], {
          name: 'internal.client.meetinginfo.response',
        });
        assert.deepEqual(submitClientEventCalls[1].args[0], {
          name: 'client.meetinginfo.response',
          payload: {
            identifiers: {
              meetingLookupUrl: result?.url,
            },
          },
          options: {
            meetingId: 'meetingId',
            globalMeetingId: requestResponse.body?.meetingId,
            webexConferenceIdStr: requestResponse.body?.confID,
          }
        });
      });

      forEach(
        [
          {sendCAevents: true},
          {sendCAevents: false},
        ],
        ({sendCAevents}) => {
          it(`should not send CA metric if meetingId is not provided disregarding if sendCAevents is ${sendCAevents}`, async () => {
            const message = 'a message';
            const meetingInfoData = 'meeting info';

            webex.request = sinon.stub().rejects({
              statusCode: 403,
              body: {message, code: 403102, data: {meetingInfo: meetingInfoData}},
              url: 'http://api-url.com',
            });
            try {
              await meetingInfo.fetchMeetingInfo(
                '1234323',
                DESTINATION_TYPE.MEETING_ID,
                'abc',
                {
                  id: '999',
                  code: 'aabbcc11',
                },
                null,
                null,
                undefined,
                {meetingId: undefined, sendCAevents}
              );
              assert.fail('fetchMeetingInfo should have thrown, but has not done that');
            } catch (err) {
              assert.notCalled(webex.internal.newMetrics.submitClientEvent);
              assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            }
          });
        }
      );

      it('should throw MeetingInfoV2PasswordError for 403 response', async () => {
        const FAKE_MEETING_INFO = {blablabla: 'some_fake_meeting_info'};

        webex.request = sinon
          .stub()
          .rejects({statusCode: 403, body: {code: 403000, data: {meetingInfo: FAKE_MEETING_INFO}}});

        try {
          await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, 'abc', {
            id: '999',
            code: 'aabbcc11',
          });
          assert.fail('fetchMeetingInfo should have thrown, but has not done that');
        } catch (err) {
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.VERIFY_PASSWORD_ERROR);
          assert.instanceOf(err, MeetingInfoV2PasswordError);
          assert.deepEqual(err.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(err.wbxAppApiCode, 403000);
        }
      });

      describe('should throw MeetingInfoV2CaptchaError for 423 response', () => {
        const runTest = async (wbxAppApiCode, expectedIsPasswordRequired) => {
          webex.request = sinon.stub().rejects({
            statusCode: 423,
            body: {
              code: wbxAppApiCode,
              captchaID: 'fake_captcha_id',
              verificationImageURL: 'fake_image_url',
              verificationAudioURL: 'fake_audio_url',
              refreshURL: 'fake_refresh_url',
            },
          });
          try {
            await meetingInfo.fetchMeetingInfo('1234323', DESTINATION_TYPE.MEETING_ID, 'abc', {
              id: '999',
              code: 'aabbcc11',
            });
            assert.fail('fetchMeetingInfo should have thrown, but has not done that');
          } catch (err) {
            assert(Metrics.sendBehavioralMetric.calledOnce);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.VERIFY_CAPTCHA_ERROR
            );
            assert.instanceOf(err, MeetingInfoV2CaptchaError);
            assert.deepEqual(err.captchaInfo, {
              captchaId: 'fake_captcha_id',
              verificationImageURL: 'fake_image_url',
              verificationAudioURL: 'fake_audio_url',
              refreshURL: 'fake_refresh_url',
            });
            assert.equal(err.wbxAppApiCode, wbxAppApiCode);
            assert.equal(err.isPasswordRequired, expectedIsPasswordRequired);
          }
        };

        it('should throw MeetingInfoV2CaptchaError for 423 response (wbxappapi code 423005)', async () => {
          await runTest(423005, true);
        });

        it('should throw MeetingInfoV2CaptchaError for 423 response (wbxappapi code 423006)', async () => {
          await runTest(423006, true);
        });

        it('should throw MeetingInfoV2CaptchaError for 423 response (wbxappapi code 423001)', async () => {
          await runTest(423001, false);
        });
      });

      it('should throw an error and not fetch with an "empty" body', async () => {
        const body = {supportHostKey: 'foo', supportCountryList: 'bar'};
        const requestResponse = {statusCode: 200, body};

        sinon
          .stub(MeetingInfoUtil, 'getDestinationType')
          .returns(Promise.resolve({type: DESTINATION_TYPE.LOCUS_ID, destination: '123456'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        webex.request.resolves(requestResponse);

        try {
          await meetingInfo.fetchMeetingInfo({
            type: DESTINATION_TYPE.LOCUS_ID,
          });
          assert.fail('fetchMeetingInfo should have thrown, but has not done that');
        } catch (err) {
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_FAILURE,
            {
              reason: 'Not enough information to fetch meeting info',
              destinationType: DESTINATION_TYPE.LOCUS_ID,
              webExMeetingId: undefined,
              sipUri: undefined,
            }
          );
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_FAILURE
          );
          assert.deepEqual(err.message, 'Not enough information to fetch meeting info');
        }

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
      });
    });

    describe('createAdhocSpaceMeeting', () => {
      const conversationUrl = 'https://conversationUrl/xxx';
      const installedOrgID = '12345';

      const setup = () => {
        const invitee = [];

        invitee.push({
          email: conversation.participants.items[0].emailAddress,
          ciUserUuid: conversation.participants.items[0].entryUUID,
        });

        invitee.push({
          email: conversation.participants.items[1].emailAddress,
          ciUserUuid: conversation.participants.items[1].entryUUID,
        });

        return {invitee}
      }

      it('Make a request to /spaceInstant when conversationUrl', async () => {
        const {invitee} = setup();

        webex.request.resolves({
          statusCode: 200,
          body: conversation
        });

        const result = await meetingInfo.createAdhocSpaceMeeting(conversationUrl,installedOrgID);

        assert.calledWith(
          webex.request,
          {uri:conversationUrl, qs: {includeParticipants: true}, disableTransform: true}
        )

        assert.calledWith(webex.request, {
          method: 'POST',
          uri: 'https://go.webex.com/wbxappapi/v2/meetings/spaceInstant',
          body: {
            title: conversation.displayName,
            spaceUrl: conversation.url,
            keyUrl: conversation.encryptionKeyUrl,
            kroUrl: conversation.kmsResourceObjectUrl,
            invitees: invitee,
            installedOrgID: installedOrgID
          },
        });
        assert.calledOnce(Metrics.sendBehavioralMetric);
        assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ADHOC_MEETING_SUCCESS);
        assert.deepEqual(result, {
          body: conversation,
          statusCode: 200
        });
      });
      it('Make a request to /spaceInstant when conversationUrl with installed org ID', async () => {
        const {invitee} = setup();
        webex.request = sinon.stub().resolves({
          body: conversation,
        });
        await meetingInfo.createAdhocSpaceMeeting(conversationUrl, installedOrgID);

        assert.calledWith(webex.request, {
          uri: conversationUrl,
          qs: {includeParticipants: true},
          disableTransform: true,
        });
        assert.calledWith(webex.request, {
          method: 'POST',
          uri: 'https://go.webex.com/wbxappapi/v2/meetings/spaceInstant',
          body: {
            title: conversation.displayName,
            spaceUrl: conversation.url,
            keyUrl: conversation.encryptionKeyUrl,
            kroUrl: conversation.kmsResourceObjectUrl,
            invitees: invitee,
            installedOrgID,
          },
        });
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ADHOC_MEETING_SUCCESS);
      });


      forEach(
        [
          {errorCode: 403049},
          {errorCode: 403104},
          {errorCode: 403103},
          {errorCode: 403048},
          {errorCode: 403102},
          {errorCode: 403101},
        ],
        ({errorCode}) => {
          it(`should throw a MeetingInfoV2PolicyError for error code ${errorCode}`, async () => {
            const message = 'a message';
            const meetingInfoData = 'meeting info';

            webex.request = sinon.stub().rejects({
              statusCode: 403,
              body: {message, code: errorCode, data: {meetingInfo: meetingInfoData}},
            });
            try {
              await meetingInfo.createAdhocSpaceMeeting(conversationUrl, installedOrgID);
              assert.fail('createAdhocSpaceMeeting should have thrown, but has not done that');
            } catch (err) {
              assert.instanceOf(err, MeetingInfoV2PolicyError);
              assert.deepEqual(err.message, `${message}, code=${errorCode}`);
              assert.equal(err.wbxAppApiCode, errorCode);
              assert.deepEqual(err.meetingInfo, meetingInfoData);

              assert(Metrics.sendBehavioralMetric.calledOnce);
              assert.calledWith(
                Metrics.sendBehavioralMetric,
                BEHAVIORAL_METRICS.MEETING_INFO_POLICY_ERROR,
                {code: errorCode}
              );

            }
          });
        }
      );
    });
  });
});
