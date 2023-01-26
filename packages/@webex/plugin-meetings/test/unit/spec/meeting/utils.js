import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import Metrics from '@webex/plugin-meetings/src/metrics/index';

describe('plugin-meetings', () => {
  describe('Meeting utils function', () => {
    const sandbox = sinon.createSandbox();
    const meeting = {};

    beforeEach(() => {
      Metrics.postEvent = sinon.stub();
      const logger = {
        info: sandbox.stub(),
        log: sandbox.stub(),
        error: sandbox.stub(),
        warn: sandbox.stub(),
      };

      LoggerConfig.set({
        verboseEvents: true,
        enable: true,
      });
      LoggerProxy.set(logger);

      meeting.closeLocalStream = sinon.stub().returns(Promise.resolve());
      meeting.closeLocalShare = sinon.stub().returns(Promise.resolve());
      meeting.closeRemoteTracks = sinon.stub().returns(Promise.resolve());
      meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());

      meeting.unsetLocalVideoTrack = sinon.stub();
      meeting.unsetLocalShareTrack = sinon.stub();
      meeting.unsetRemoteTracks = sinon.stub();
      meeting.unsetPeerConnections = sinon.stub();
      meeting.reconnectionManager = {cleanUp: sinon.stub()};
      meeting.roap = {stop: sinon.stub()};
      meeting.stopKeepAlive = sinon.stub();
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe('#cleanup', () => {
      it('do clean up on meeting object', async () => {
        await MeetingUtil.cleanUp(meeting);
        assert.calledOnce(meeting.closeLocalStream);
        assert.calledOnce(meeting.closeLocalStream);
        assert.calledOnce(meeting.closeLocalShare);
        assert.calledOnce(meeting.closeRemoteTracks);
        assert.calledOnce(meeting.closePeerConnections);

        assert.calledOnce(meeting.unsetLocalVideoTrack);
        assert.calledOnce(meeting.unsetLocalShareTrack);
        assert.calledOnce(meeting.unsetRemoteTracks);
        assert.calledOnce(meeting.unsetPeerConnections);
        assert.calledOnce(meeting.reconnectionManager.cleanUp);
        assert.calledOnce(meeting.roap.stop);
        assert.calledOnce(meeting.stopKeepAlive);
      });
    });

    describe('logging', () => {
      const fakeDevice = sinon.fake.returns({
        deviceId: 'device-1',
      });

      const mockTrack = {
        getSettings: fakeDevice,
      };

      it('#log - should log [info, warn, error, log] to console', () => {
        LoggerProxy.logger.log('test log');
        assert.calledOnce(LoggerProxy.logger.log);

        LoggerProxy.logger.info('test info');
        assert.calledOnce(LoggerProxy.logger.info);

        LoggerProxy.logger.error('test error');
        assert.calledOnce(LoggerProxy.logger.error);

        LoggerProxy.logger.warn('test warn');
        assert.calledOnce(LoggerProxy.logger.warn);
      });

      describe('#handleAudioLogging', () => {
        it('should not log if called without track', () => {
          MeetingUtil.handleAudioLogging();
          assert(!LoggerProxy.logger.log.called, 'log not called');
        });

        it('should log audioTrack settings', () => {
          assert(MeetingUtil.handleAudioLogging, 'method is defined');
          MeetingUtil.handleAudioLogging(mockTrack);
          assert(LoggerProxy.logger.log.called, 'log called');
        });
      });

      describe('#handleVideoLogging', () => {
        it('should not log if called without track', () => {
          MeetingUtil.handleVideoLogging(null);
          assert(!LoggerProxy.logger.log.called, 'log not called');
        });

        it('should log videoTrack settings', () => {
          assert(MeetingUtil.handleVideoLogging, 'method is defined');
          MeetingUtil.handleVideoLogging(mockTrack);
          assert(LoggerProxy.logger.log.called, 'log called');
        });
      });

      describe('#handleDeviceLogging', () => {
        it('should not log if called without devices', () => {
          MeetingUtil.handleDeviceLogging();
          assert(!LoggerProxy.logger.log.called, 'log not called');
        });

        it('should log device settings', () => {
          const mockDevices = [{deviceId: 'device-1'}, {deviceId: 'device-2'}];

          assert(MeetingUtil.handleDeviceLogging, 'is defined');
          MeetingUtil.handleDeviceLogging(mockDevices);
          assert(LoggerProxy.logger.log.called, 'log called');
        });
      });
    });

    describe('joinMeeting', () => {
      it('#Should call `meetingRequest.joinMeeting', async () => {
        const meeting = {
          meetingJoinUrl: 'meetingJoinUrl',
          locusUrl: 'locusUrl',
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {});

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.inviteeAddress, 'meetingJoinUrl');
      });

      it('#Should fallback sipUrl if meetingJoinUrl does not exists', async () => {
        const meeting = {
          sipUri: 'sipUri',
          locusUrl: 'locusUrl',
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {});

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.inviteeAddress, 'sipUri');
      });

      it('#Should fallback to meetingNumber if meetingJoinUrl/sipUrl  does not exists', async () => {
        const meeting = {
          meetingNumber: 'meetingNumber',
          locusUrl: 'locusUrl',
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {});

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.isUndefined(parameter.inviteeAddress);
        assert.equal(parameter.meetingNumber, 'meetingNumber');
      });
    });

    describe('getUserDisplayHintsFromLocusInfo', () => {
      it('returns display hints', () => {
        assert.deepEqual(MeetingUtil.getUserDisplayHintsFromLocusInfo(), []);

        assert.deepEqual(MeetingUtil.getUserDisplayHintsFromLocusInfo({}), []);

        assert.deepEqual(MeetingUtil.getUserDisplayHintsFromLocusInfo({parsedLocus: {}}), []);

        assert.deepEqual(
          MeetingUtil.getUserDisplayHintsFromLocusInfo({parsedLocus: {info: {}}}),
          []
        );

        assert.deepEqual(
          MeetingUtil.getUserDisplayHintsFromLocusInfo({
            parsedLocus: {info: {userDisplayHints: []}},
          }),
          []
        );

        assert.deepEqual(
          MeetingUtil.getUserDisplayHintsFromLocusInfo({
            parsedLocus: {
              info: {
                userDisplayHints: ['HINT_1'],
              },
            },
          }),
          ['HINT_1']
        );
      });
    });

    describe('canInviteNewParticipants', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canInviteNewParticipants(['ADD_GUEST']), true);
        assert.deepEqual(MeetingUtil.canInviteNewParticipants([]), false);
      });
    });

    describe('canAdmitParticipant', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canAdmitParticipant(['ROSTER_WAITING_TO_JOIN']), true);
        assert.deepEqual(MeetingUtil.canAdmitParticipant([]), false);
      });
    });

    describe('canUserRaiseHand', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canUserRaiseHand(['RAISE_HAND']), true);
        assert.deepEqual(MeetingUtil.canUserRaiseHand([]), false);
      });
    });

    describe('canUserLowerAllHands', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canUserLowerAllHands(['LOWER_ALL_HANDS']), true);
        assert.deepEqual(MeetingUtil.canUserLowerAllHands([]), false);
      });
    });

    describe('canUserLowerSomeoneElsesHand', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.canUserLowerSomeoneElsesHand(['LOWER_SOMEONE_ELSES_HAND']),
          true
        );
        assert.deepEqual(MeetingUtil.canUserLowerSomeoneElsesHand([]), false);
      });
    });

    describe('bothLeaveAndEndMeetingAvailable', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.bothLeaveAndEndMeetingAvailable(['LEAVE_TRANSFER_HOST_END_MEETING']),
          true
        );
        assert.deepEqual(MeetingUtil.bothLeaveAndEndMeetingAvailable(['LEAVE_END_MEETING']), true);
        assert.deepEqual(
          MeetingUtil.bothLeaveAndEndMeetingAvailable([
            'LEAVE_TRANSFER_HOST_END_MEETING',
            'LEAVE_END_MEETING',
          ]),
          true
        );
        assert.deepEqual(MeetingUtil.bothLeaveAndEndMeetingAvailable([]), false);
      });
    });

    describe('canUserLock', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.canUserLock(['LOCK_CONTROL_LOCK', 'LOCK_STATUS_UNLOCKED']),
          true
        );
        assert.deepEqual(MeetingUtil.canUserLock(['LOCK_CONTROL_LOCK']), false);
        assert.deepEqual(MeetingUtil.canUserLock(['LOCK_STATUS_UNLOCKED']), false);
        assert.deepEqual(MeetingUtil.canUserLock([]), false);
      });
    });

    describe('canUserUnlock', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.canUserUnlock(['LOCK_CONTROL_UNLOCK', 'LOCK_STATUS_LOCKED']),
          true
        );
        assert.deepEqual(MeetingUtil.canUserUnlock(['LOCK_CONTROL_UNLOCK']), false);
        assert.deepEqual(MeetingUtil.canUserUnlock(['LOCK_STATUS_LOCKED']), false);
        assert.deepEqual(MeetingUtil.canUserUnlock([]), false);
      });
    });

    [
      {functionName: 'canEnableClosedCaption', displayHint: 'CAPTION_START'},
      {functionName: 'canStartTranscribing', displayHint: 'TRANSCRIPTION_CONTROL_START'},
      {functionName: 'canStopTranscribing', displayHint: 'TRANSCRIPTION_CONTROL_STOP'},
      {functionName: 'isClosedCaptionActive', displayHint: 'CAPTION_STATUS_ACTIVE'},
      {functionName: 'isWebexAssistantActive', displayHint: 'WEBEX_ASSISTANT_STATUS_ACTIVE'},
      {functionName: 'canViewCaptionPanel', displayHint: 'ENABLE_CAPTION_PANEL'},
      {functionName: 'isRealTimeTranslationEnabled', displayHint: 'DISPLAY_REAL_TIME_TRANSLATION'},
      {functionName: 'canSelectSpokenLanguages', displayHint: 'DISPLAY_NON_ENGLISH_ASR'},
      {functionName: 'waitingForOthersToJoin', displayHint: 'WAITING_FOR_OTHERS'},
    ].forEach(({functionName, displayHint}) => {
      describe(functionName, () => {
        it('works as expected', () => {
          assert.deepEqual(MeetingUtil[functionName]([displayHint]), true);
          assert.deepEqual(MeetingUtil[functionName]([]), false);
        });
      });
    });
  });
});
