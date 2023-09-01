import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import Metrics from '@webex/plugin-meetings/src/metrics/index';
import {SELF_POLICY} from '@webex/plugin-meetings/src/constants';
import {DISPLAY_HINTS} from '@webex/plugin-meetings/src/constants';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-meetings', () => {
  let webex;
  describe('Meeting utils function', () => {
    const sandbox = sinon.createSandbox();
    const meeting = {};

    beforeEach(() => {
      webex = new MockWebex({});
      const logger = {
        info: sandbox.stub(),
        log: sandbox.stub(),
        error: sandbox.stub(),
        warn: sandbox.stub(),
        debug: sandbox.stub(),
      };

      LoggerConfig.set({
        verboseEvents: true,
        enable: true,
      });
      LoggerProxy.set(logger);

      meeting.cleanupLocalTracks = sinon.stub().returns(Promise.resolve());
      meeting.closeRemoteTracks = sinon.stub().returns(Promise.resolve());
      meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());

      meeting.unsetRemoteTracks = sinon.stub();
      meeting.unsetPeerConnections = sinon.stub();
      meeting.reconnectionManager = {cleanUp: sinon.stub()};
      meeting.stopKeepAlive = sinon.stub();
      meeting.updateLLMConnection = sinon.stub();
      meeting.breakouts = {cleanUp: sinon.stub()};
      meeting.annotaion = {cleanUp: sinon.stub()};
      meeting.getWebexObject = sinon.stub().returns(webex);
      meeting.simultaneousInterpretation = {cleanUp: sinon.stub()};
      meeting.trigger = sinon.stub();
    });

    afterEach(() => {
      sandbox.restore();
      sinon.restore();
    });

    describe('#cleanup', () => {
      it('do clean up on meeting object', async () => {
        await MeetingUtil.cleanUp(meeting);
        assert.calledOnce(meeting.cleanupLocalTracks);
        assert.calledOnce(meeting.closeRemoteTracks);
        assert.calledOnce(meeting.closePeerConnections);

        assert.calledOnce(meeting.unsetRemoteTracks);
        assert.calledOnce(meeting.unsetPeerConnections);
        assert.calledOnce(meeting.reconnectionManager.cleanUp);
        assert.calledOnce(meeting.stopKeepAlive);
        assert.calledOnce(meeting.updateLLMConnection);
        assert.calledOnce(meeting.breakouts.cleanUp);
        assert.calledOnce(meeting.simultaneousInterpretation.cleanUp);
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

    describe('addSequence', () => {
      it('should add the sequence object to a request body', () => {
        const body = {};

        MeetingUtil.addSequence({
          locusInfo: {
            sequence: 'sequence'
          }
        }, body);

        assert.deepEqual(body, {
          sequence: 'sequence'
        });
      });

      it('should work with an undefined meeting', () => {
        const body = {};

        MeetingUtil.addSequence(
          undefined,
          body
        );

        assert.deepEqual(body, {});
      });

      it('should work with an undefined locusInfo', () => {
        const body = {};

        MeetingUtil.addSequence({}, body);

        assert.deepEqual(body, {});
      });

      it('should work with an undefined sequence', () => {
        const body = {};

        MeetingUtil.addSequence({locusInfo: {}}, body);

        assert.deepEqual(body, {});
      });
    });

    describe('updateLocusWithDelta', () => {
      it('should call handleLocusDelta with the new delta locus', () => {
        const meeting = {
          locusInfo: {
            handleLocusDelta: sinon.stub()
          },
        };

        const originalResponse = {
          body: {
            locus: 'locus'
          },
        };

        const response = MeetingUtil.updateLocusWithDelta(meeting, originalResponse);

        assert.deepEqual(response, originalResponse);
        assert.calledOnceWithExactly(meeting.locusInfo.handleLocusDelta, 'locus', meeting);
      });

      it('should handle locus being missing from the response', () => {
        const meeting = {
          locusInfo: {
            handleLocusDelta: sinon.stub(),
          },
        };

        const originalResponse = {
          body: {},
        };

        const response = MeetingUtil.updateLocusWithDelta(meeting, originalResponse);

        assert.deepEqual(response, originalResponse);
        assert.notCalled(meeting.locusInfo.handleLocusDelta);
      });

      it('should work with an undefined meeting', () => {
        const originalResponse = {
          body: {
            locus: 'locus',
          },
        };

        const response = MeetingUtil.updateLocusWithDelta(undefined, originalResponse);
        assert.deepEqual(response, originalResponse);
      });
    });

    describe('generateLocusDeltaRequest', () => {

      afterEach(() => {
        WeakRef.prototype.deref.restore();
      });

      it('generates the correct wrapper function', async () => {
        const updateLocusWithDeltaSpy = sinon.spy(MeetingUtil, 'updateLocusWithDelta');
        const addSequenceSpy = sinon.spy(MeetingUtil, 'addSequence');

        const meeting = {
          request: sinon.stub().returns(Promise.resolve('result')),
        }

        const locusDeltaRequest = MeetingUtil.generateLocusDeltaRequest(meeting);

        const options = {
          some: 'option',
          body: {}
        };

        let result = await locusDeltaRequest(options);

        assert.equal(result, 'result');
        assert.calledOnceWithExactly(updateLocusWithDeltaSpy, meeting, 'result');
        assert.calledOnceWithExactly(addSequenceSpy, meeting, options.body);

        updateLocusWithDeltaSpy.resetHistory();
        addSequenceSpy.resetHistory();

        // body missing from options
        result = await locusDeltaRequest({});
        assert.equal(result, 'result');
        assert.calledOnceWithExactly(updateLocusWithDeltaSpy, meeting, 'result');
        assert.calledOnceWithExactly(addSequenceSpy, meeting, options.body);

        // meeting disappears so the WeakRef returns undefined
        sinon.stub(WeakRef.prototype, 'deref').returns(undefined);

        result = await locusDeltaRequest(options);
        assert.equal(result, undefined);

      });

    });

    describe('selfSupportsFeature', () => {
      it('returns true if there are no user policies', () => {
        assert.equal(
          MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_ANNOTATION, undefined),
          true
        );
      });

      it('returns true if policy is true', () => {
        assert.equal(
          MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_ANNOTATION, {
            [SELF_POLICY.SUPPORT_ANNOTATION]: true
          }),
          true
        );
      });

      it('returns false if policy is false', () => {
        assert.equal(
          MeetingUtil.selfSupportsFeature(SELF_POLICY.SUPPORT_ANNOTATION, {
            [SELF_POLICY.SUPPORT_ANNOTATION]: false,
          }),
          false
        );
      });
    });

    describe('remoteUpdateAudioVideo', () => {
      it('#Should call meetingRequest.locusMediaRequest with correct parameters', async () => {
        const meeting = {
          id: 'meeting-id',
          mediaId: '12345',
          selfUrl: 'self url',
          locusInfo: {
            sequence: {},
          },
          locusMediaRequest: {
            send: sinon.stub().resolves({body: {}, headers: {}}),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        await MeetingUtil.remoteUpdateAudioVideo(meeting, true, false);

        assert.calledOnceWithExactly(meeting.locusMediaRequest.send, {
          mediaId: '12345',
          muteOptions: {
            audioMuted: true,
            videoMuted: false,
          },
          selfUrl: 'self url',
          sequence: {},
          type: 'LocalMute',
        });

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.locus.media.request',
          options: {meetingId: meeting.id},
        });

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.locus.media.response',
          options: {meetingId: meeting.id},
        });
      });
    });

    describe('joinMeeting', () => {
      it('#Should call `meetingRequest.joinMeeting', async () => {
        const meeting = {
          meetingJoinUrl: 'meetingJoinUrl',
          locusUrl: 'locusUrl',
          meetingRequest: {
            joinMeeting: sinon.stub().returns(
              Promise.resolve({
                body: {mediaConnections: 'mediaConnections'},
                headers: {
                  trackingid: 'trackingId',
                },
              })
            ),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {});

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.inviteeAddress, 'meetingJoinUrl');
        assert.equal(parameter.preferTranscoding, true);

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.locus.join.request',
          options: {meetingId: meeting.id},
        });

        assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
          name: 'client.locus.join.response',
          payload: {
            trigger: 'loci-update',
            identifiers: {
              trackingId: 'trackingId',
            },
          },
          options: {
            meetingId: meeting.id,
            mediaConnections: 'mediaConnections',
          },
        });
      });

      it('#Should call meetingRequest.joinMeeting with breakoutsSupported=true when passed in as true', async () => {
        const meeting = {
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {
          breakoutsSupported: true,
        });

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.breakoutsSupported, true);
      });

      it('#Should call meetingRequest.joinMeeting with liveAnnotationSupported=true when passed in as true', async () => {
        const meeting = {
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {
          liveAnnotationSupported: true,
        });

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.liveAnnotationSupported, true);
      });

      it('#Should call meetingRequest.joinMeeting with locale=en_UK, deviceCapabilities=["TEST"] when they are passed in as those values', async () => {
        const meeting = {
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {
          locale: 'en_UK',
          deviceCapabilities: ['TEST'],
        });

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.equal(parameter.locale, 'en_UK');
        assert.deepEqual(parameter.deviceCapabilities, ['TEST']);
      });

      it('#Should call meetingRequest.joinMeeting with preferTranscoding=false when multistream is enabled', async () => {
        const meeting = {
          isMultistream: true,
          meetingJoinUrl: 'meetingJoinUrl',
          locusUrl: 'locusUrl',
          meetingRequest: {
            joinMeeting: sinon.stub().returns(Promise.resolve({body: {}, headers: {}})),
          },
          getWebexObject: sinon.stub().returns(webex)
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
          getWebexObject: sinon.stub().returns(webex)
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
          getWebexObject: sinon.stub().returns(webex)
        };

        MeetingUtil.parseLocusJoin = sinon.stub();
        await MeetingUtil.joinMeeting(meeting, {});

        assert.calledOnce(meeting.meetingRequest.joinMeeting);
        const parameter = meeting.meetingRequest.joinMeeting.getCall(0).args[0];

        assert.isUndefined(parameter.inviteeAddress);
        assert.equal(parameter.meetingNumber, 'meetingNumber');
      });
    });

    describe('joinMeetingOptions', () => {
      it('sends client events correctly', async () => {
        MeetingUtil.joinMeeting = sinon.stub().rejects({});
        MeetingUtil.isPinOrGuest = sinon.stub().returns(true);
        const meeting = {
          id: 'meeting-id',
          mediaId: '12345',
          selfUrl: 'self url',
          locusInfo: {
            sequence: {},
          },
          locusMediaRequest: {
            send: sinon.stub().resolves({body: {}, headers: {}}),
          },
          getWebexObject: sinon.stub().returns(webex)
        };

        try {
          await MeetingUtil.joinMeetingOptions(meeting, {pin: true});

          assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.pin.collected',
            options: {
              meetingId: meeting.id,
            },
          });
        } catch (err) {
          assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.pin.prompt',
            options: {
              meetingId: meeting.id,
            },
          });
        }
      });

    })

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

    describe('canShareWhiteBoard', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canShareWhiteBoard(['SHARE_WHITEBOARD']), true);
        assert.deepEqual(MeetingUtil.canShareWhiteBoard([]), false);
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

    describe('canBroadcastMessageToBreakout', () => {
      it('works as expected', () => {
        assert.deepEqual(MeetingUtil.canBroadcastMessageToBreakout(['BROADCAST_MESSAGE_TO_BREAKOUT'], {
          [SELF_POLICY.SUPPORT_BROADCAST_MESSAGE]: true
        }), true);
        assert.deepEqual(MeetingUtil.canBroadcastMessageToBreakout([], {[SELF_POLICY.SUPPORT_BROADCAST_MESSAGE]: true}), false);
        assert.deepEqual(MeetingUtil.canBroadcastMessageToBreakout(['BROADCAST_MESSAGE_TO_BREAKOUT'], {[SELF_POLICY.SUPPORT_BROADCAST_MESSAGE]: false}), false);
        assert.deepEqual(MeetingUtil.canBroadcastMessageToBreakout(['BROADCAST_MESSAGE_TO_BREAKOUT'], undefined), false);

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


    describe('parseInterpretationInfo', () => {
      let meetingInfo = {};
      beforeEach(() => {
        meeting.simultaneousInterpretation = {
          updateMeetingSIEnabled: sinon.stub(),
          updateHostSIEnabled: sinon.stub(),
          updateInterpretation: sinon.stub(),
          siLanguages: [],
        };
      });
      it('should update simultaneous interpretation settings with SI and host enabled', () => {
        meetingInfo.turnOnSimultaneousInterpretation = true;
        meetingInfo.meetingSiteSetting = {
          enableHostInterpreterControlSI: true,
        };
        meetingInfo.simultaneousInterpretation = {
          currentSIInterpreter: true,
          siLanguages: [
            { languageCode: 'en', languageGroupId: 1 },
            { languageCode: 'es', languageGroupId: 2 },
          ],
        };

        MeetingUtil.parseInterpretationInfo(meeting, meetingInfo);
        assert.calledWith(meeting.simultaneousInterpretation.updateMeetingSIEnabled, true, true);
        assert.calledWith(meeting.simultaneousInterpretation.updateHostSIEnabled, true);
        assert.calledWith(meeting.simultaneousInterpretation.updateInterpretation, [
          { languageName: 'en', languageCode: 1 },
          { languageName: 'es', languageCode: 2 },
        ]);
      });

      it('should update simultaneous interpretation settings with host SI disabled', () => {
        meetingInfo.meetingSiteSetting.enableHostInterpreterControlSI = false;
        meetingInfo.simultaneousInterpretation.currentSIInterpreter = false;
        MeetingUtil.parseInterpretationInfo(meeting, meetingInfo);
        assert.calledWith(meeting.simultaneousInterpretation.updateMeetingSIEnabled, true, false);
        assert.calledWith(meeting.simultaneousInterpretation.updateHostSIEnabled, false);
        assert.calledWith(meeting.simultaneousInterpretation.updateInterpretation, [
          { languageName: 'en', languageCode: 1 },
          { languageName: 'es', languageCode: 2 },
        ]);
      });
      it('should update simultaneous interpretation settings with SI disabled', () => {
        meetingInfo.turnOnSimultaneousInterpretation = false;
        MeetingUtil.parseInterpretationInfo(meeting, meetingInfo);
        assert.calledWith(meeting.simultaneousInterpretation.updateMeetingSIEnabled, false, false);
        assert.calledWith(meeting.simultaneousInterpretation.updateHostSIEnabled, false);
      });

      it('should not update simultaneous interpretation settings for invalid input', () => {
        // Call the function with invalid inputs
        MeetingUtil.parseInterpretationInfo(null, null);

        // Ensure that the update functions are not called
        assert.notCalled(meeting.simultaneousInterpretation.updateMeetingSIEnabled);
        assert.notCalled(meeting.simultaneousInterpretation.updateHostSIEnabled);
        assert.notCalled(meeting.simultaneousInterpretation.updateInterpretation);
      });
    });
  });
});
