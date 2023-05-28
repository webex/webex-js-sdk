import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import Metrics from '@webex/plugin-meetings/src/metrics/index';
import {DISPLAY_HINTS} from '@webex/plugin-meetings/src/constants';

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
      meeting.stopKeepAlive = sinon.stub();
      meeting.updateLLMConnection = sinon.stub();
      meeting.breakouts = {cleanUp: sinon.stub()};
      meeting.annotaion = {cleanUp: sinon.stub()};
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
        assert.calledOnce(meeting.stopKeepAlive);
        assert.calledOnce(meeting.updateLLMConnection);
        assert.calledOnce(meeting.breakouts.cleanUp);
      });
    });

    describe('logging', () => {
      const fakeDevice = sinon.fake.returns({
        deviceId: 'device-1',
      });

      const mockTrack = {
        underlyingTrack: {
          getSettings: fakeDevice,
        },
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

    describe('remoteUpdateAudioVideo', () => {
      it('#Should call meetingRequest.locusMediaRequest with correct parameters', async () => {
        const meeting = {
          mediaId: '12345',
          selfUrl: 'self url',
          locusMediaRequest: {
            send: sinon.stub().resolves({body: {}, headers: {}}),
          },
        };

        await MeetingUtil.remoteUpdateAudioVideo(meeting, true, false);

        assert.calledOnce(meeting.locusMediaRequest.send);
        const parameter = meeting.locusMediaRequest.send.getCall(0).args[0];

        assert.equal(parameter.type, 'LocalMute');
        assert.equal(parameter.selfUrl, 'self url');
        assert.equal(parameter.mediaId, '12345');
        assert.deepEqual(parameter.muteOptions, {audioMuted: true, videoMuted :false});
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
        assert.equal(parameter.preferTranscoding, true);
      });

      it('#Should call meetingRequest.joinMeeting with breakoutsSupported=true when passed in as true', async () => {
        const meeting = {
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {
          breakoutsSupported: true,
        });

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.breakoutsSupported, true);
      });

      it('#Should call meetingRequest.joinMeeting with preferTranscoding=false when multistream is enabled', async () => {
        const meeting = {
          isMultistream: true,
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
        assert.equal(parameter.preferTranscoding, false);
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

    describe('canUserRenameSelfAndObserved', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.canUserRenameSelfAndObserved(['CAN_RENAME_SELF_AND_OBSERVED']),
          true
        );
        assert.deepEqual(MeetingUtil.canUserRenameSelfAndObserved([]), false);
      });
    });

    describe('canUserRenameOthers', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canUserRenameOthers(['CAN_RENAME_OTHERS']), true);
        assert.deepEqual(MeetingUtil.canUserRenameOthers([]), false);
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
      {functionName: 'isSaveTranscriptsEnabled', displayHint: 'SAVE_TRANSCRIPTS_ENABLED'},
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

    describe('canManageBreakout', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canManageBreakout(['BREAKOUT_MANAGEMENT']), true);
        assert.deepEqual(MeetingUtil.canManageBreakout([]), false);
      });
    });

    describe('isSuppressBreakoutSupport', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.isSuppressBreakoutSupport(['UCF_SUPPRESS_BREAKOUTS_SUPPORT']),
          true
        );
        assert.deepEqual(MeetingUtil.isSuppressBreakoutSupport([]), false);
      });
    });

    describe('canAdmitLobbyToBreakout', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canAdmitLobbyToBreakout(['DISABLE_LOBBY_TO_BREAKOUT']), false);
        assert.deepEqual(MeetingUtil.canAdmitLobbyToBreakout([]), true);
      });
    });

    describe('canUserAskForHelp', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canUserAskForHelp(['DISABLE_ASK_FOR_HELP']), false);
        assert.deepEqual(MeetingUtil.canUserAskForHelp([]), true);
      });
    });

    describe('isBreakoutPreassignmentsEnabled', () => {
      it('works as expected', () => {
        assert.deepEqual(
          MeetingUtil.isBreakoutPreassignmentsEnabled(['DISABLE_BREAKOUT_PREASSIGNMENTS']),
          false
        );
        assert.deepEqual(MeetingUtil.isBreakoutPreassignmentsEnabled([]), true);
      });
    });
  });
});
