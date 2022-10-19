/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import Device from '@webex/internal-plugin-device';
import Mercury from '@webex/internal-plugin-mercury';
import {
  _MEETING_ID_,
  _PERSONAL_ROOM_,
  _CONVERSATION_URL_,
  _SIP_URI_,
  WBXAPPAPI_SERVICE
} from '@webex/plugin-meetings/src/constants';

import Meetings from '@webex/plugin-meetings/src/meetings';
import MeetingInfo, {MeetingInfoV2PasswordError, MeetingInfoV2CaptchaError, MeetingInfoV2AdhocMeetingError} from '@webex/plugin-meetings/src/meeting-info/meeting-info-v2';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/utilv2';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';

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
          entryUUID: '344ea183-9d5d-4e77-'

        },
        {
          id: '40b446fe-175c-4628-8a9d',
          emailAddress: 'testUser2@cisco.com',
          entryUUID: '40b446fe-175c-4628'
        }
      ]
    }
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
          meetings: Meetings
        }
      });

      webex.meetings.preferredWebexSite = 'go.webex.com';
      webex.config.meetings = {experimental: {enableUnifiedMeetings: true, enableAdhocMeetings: true}};

      Object.assign(webex.internal, {
        device: {
          deviceType: 'FAKE_DEVICE',
          register: sinon.stub().returns(Promise.resolve()),
          unregister: sinon.stub().returns(Promise.resolve()),
          userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e'
        },
        mercury: {
          connect: sinon.stub().returns(Promise.resolve()),
          disconnect: sinon.stub().returns(Promise.resolve()),
          on: () => {},
          off: () => {}
        },
        conversation: {
          get: sinon.stub().returns(Promise.resolve(conversation))
        }
      });


      meetingInfo = new MeetingInfo(webex);
    });

    describe('#fetchMeetingInfo', () => {
      it('should fetch meeting info for the destination type', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon.stub(MeetingInfoUtil, 'getDestinationType').returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo({
          type: _MEETING_ID_,
          destination: '1234323'
        });

        assert.calledWith(webex.request, {
          method: 'POST', service: WBXAPPAPI_SERVICE, resource: 'meetingInfo', body: {meetingKey: '1234323'}
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
      });

      it('should fetch meeting info for the personal meeting room  type', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon.stub(MeetingInfoUtil, 'getDestinationType').returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo({
          type: _PERSONAL_ROOM_
        });

        assert.calledWith(webex.request, {
          method: 'POST', service: WBXAPPAPI_SERVICE, resource: 'meetingInfo', body: {meetingKey: '1234323'}
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
      });

      it('should use the direct uri for the request if it exists', async () => {
        const body = {meetingKey: '1234323'};
        const requestResponse = {statusCode: 200, body};

        sinon.stub(MeetingInfoUtil, 'getDestinationType').returns(Promise.resolve({type: _SIP_URI_, destination: 'example@something.webex.com'}));
        sinon.stub(MeetingInfoUtil, 'getRequestBody').returns(Promise.resolve(body));
        sinon.stub(MeetingInfoUtil, 'getDirectMeetingInfoURI').returns('https://example.com');
        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo(
          'example@something.webex.com',
          _SIP_URI_,
        );

        assert.calledWith(MeetingInfoUtil.getDestinationType, {destination: 'example@something.webex.com', type: _SIP_URI_, webex});
        assert.calledWith(MeetingInfoUtil.getDirectMeetingInfoURI, {destination: 'example@something.webex.com', type: _SIP_URI_});
        assert.calledWith(webex.request, {
          method: 'POST', uri: 'https://example.com', body: {meetingKey: '1234323'}
        });
        assert.deepEqual(result, requestResponse);

        MeetingInfoUtil.getDestinationType.restore();
        MeetingInfoUtil.getRequestBody.restore();
        MeetingInfoUtil.getDirectMeetingInfoURI.restore();
      });

      it('should fetch meeting info with provided password and captcha code', async () => {
        const requestResponse = {statusCode: 200, body: {meetingKey: '1234323'}};

        webex.request.resolves(requestResponse);

        const result = await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, 'abc', {id: '999', code: 'aabbcc11'});

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
            captchaVerifyCode: 'aabbcc11'
          }
        });
        assert.deepEqual(result, requestResponse);
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.FETCH_MEETING_INFO_V1_SUCCESS,
        );
      });

      it('create adhoc meeting when conversationUrl passed with enableAdhocMeetings toggle', async () => {
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());
        await meetingInfo.fetchMeetingInfo('conversationUrl', _CONVERSATION_URL_);

        assert.calledWith(meetingInfo.createAdhocSpaceMeeting, 'conversationUrl');
        assert.notCalled(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('should not call createAdhocSpaceMeeting if enableAdhocMeetings toggle is off', async () => {
        webex.config.meetings.experimental.enableAdhocMeetings = false;
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());

        await meetingInfo.fetchMeetingInfo('conversationUrl', _CONVERSATION_URL_);

        assert.notCalled(meetingInfo.createAdhocSpaceMeeting);
        assert.called(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('should not call createAdhocSpaceMeeting if enableAdhocMeetings toggle is on but preferredWebexSite', async () => {
        sinon.stub(meetingInfo, 'createAdhocSpaceMeeting').returns(Promise.resolve());
        webex.meetings.preferredWebexSite = undefined;

        await meetingInfo.fetchMeetingInfo('conversationUrl', _CONVERSATION_URL_);

        assert.notCalled(meetingInfo.createAdhocSpaceMeeting);
        assert.called(webex.request);
        meetingInfo.createAdhocSpaceMeeting.restore();
      });

      it('should throw an error MeetingInfoV2AdhocMeetingError if not able to start adhoc meeting for a conversation', async () => {
        webex.config.meetings.experimental.enableAdhocMeetings = true;

        webex.request = sinon.stub().rejects({statusCode: 403, body: {code: 400000}});
        try {
          await meetingInfo.createAdhocSpaceMeeting('conversationUrl');
        }
        catch (err) {
          assert.instanceOf(err, MeetingInfoV2AdhocMeetingError);
          assert.deepEqual(err.message, 'Failed starting the adhoc meeting, Please contact support team , code=400000');
          assert.equal(err.wbxAppApiCode, 400000);
        }
      });

      it('should throw MeetingInfoV2PasswordError for 403 response', async () => {
        const FAKE_MEETING_INFO = {blablabla: 'some_fake_meeting_info'};

        webex.request = sinon.stub().rejects({statusCode: 403, body: {code: 403000, data: {meetingInfo: FAKE_MEETING_INFO}}});

        try {
          await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, 'abc', {id: '999', code: 'aabbcc11'});
          assert.fail('fetchMeetingInfo should have thrown, but has not done that');
        }
        catch (err) {
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.VERIFY_PASSWORD_ERROR,
          );
          assert.instanceOf(err, MeetingInfoV2PasswordError);
          assert.deepEqual(err.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(err.wbxAppApiCode, 403000);
        }
      });

      describe('should throw MeetingInfoV2CaptchaError for 423 response', () => {
        const runTest = async (wbxAppApiCode, expectedIsPasswordRequired) => {
          webex.request = sinon.stub().rejects(
            {
              statusCode: 423,
              body: {
                code: wbxAppApiCode,
                captchaID: 'fake_captcha_id',
                verificationImageURL: 'fake_image_url',
                verificationAudioURL: 'fake_audio_url',
                refreshURL: 'fake_refresh_url'
              }
            }
          );
          try {
            await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, 'abc', {id: '999', code: 'aabbcc11'});
            assert.fail('fetchMeetingInfo should have thrown, but has not done that');
          }
          catch (err) {
            assert(Metrics.sendBehavioralMetric.calledOnce);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.VERIFY_CAPTCHA_ERROR,
            );
            assert.instanceOf(err, MeetingInfoV2CaptchaError);
            assert.deepEqual(err.captchaInfo, {
              captchaId: 'fake_captcha_id',
              verificationImageURL: 'fake_image_url',
              verificationAudioURL: 'fake_audio_url',
              refreshURL: 'fake_refresh_url'
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
    });


    describe('createAdhocSpaceMeeting', () => {
      it('Make a request to /instantSpace when conversationUrl', async () => {
        const conversationUrl = 'https://conversationUrl/xxx';
        const invitee = [];

        invitee.push({
          email: conversation.participants.items[0].emailAddress,
          ciUserUuid: conversation.participants.items[0].entryUUID
        });

        invitee.push({
          email: conversation.participants.items[1].emailAddress,
          ciUserUuid: conversation.participants.items[1].entryUUID
        });

        await meetingInfo.createAdhocSpaceMeeting(conversationUrl);

        assert.calledWith(webex.internal.conversation.get, {url: conversationUrl},
          {includeParticipants: true, disableTransform: true});

        assert.calledWith(webex.request, {
          method: 'POST',
          uri: 'https://go.webex.com/wbxappapi/v2/meetings/spaceInstant',
          body: {
            title: conversation.displayName,
            spaceUrl: conversation.url,
            keyUrl: conversation.encryptionKeyUrl,
            kroUrl: conversation.kmsResourceObjectUrl,
            invitees: invitee
          }
        });
        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.ADHOC_MEETING_SUCCESS,
        );
      });
    });
  });
});
