/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import jwt from 'jsonwebtoken';
import {cloneDeep, forEach, isEqual, isUndefined} from 'lodash';
import sinon from 'sinon';
import * as internalMediaModule from '@webex/internal-media-core';
import StateMachine from 'javascript-state-machine';
import uuid from 'uuid';
import {assert} from '@webex/test-helper-chai';
import {Credentials, Token, WebexPlugin} from '@webex/webex-core';
import Support from '@webex/internal-plugin-support';
import MockWebex from '@webex/test-helper-mock-webex';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import {
  FLOOR_ACTION,
  SHARE_STATUS,
  MEETING_INFO_FAILURE_REASON,
  PASSWORD_STATUS,
  EVENTS,
  EVENT_TRIGGERS,
  _SIP_URI_,
  _MEETING_ID_,
  MEETING_REMOVED_REASON,
  LOCUSINFO,
  PC_BAIL_TIMEOUT,
  DISPLAY_HINTS,
  SELF_POLICY,
} from '@webex/plugin-meetings/src/constants';
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import {
  ConnectionState,
  Event,
  Errors,
  ErrorType,
  RemoteTrackType,
  MediaType,
} from '@webex/internal-media-core';
import {LocalTrackEvents} from '@webex/media-helpers';
import * as StatsAnalyzerModule from '@webex/plugin-meetings/src/statsAnalyzer';
import * as MuteStateModule from '@webex/plugin-meetings/src/meeting/muteState';
import EventsScope from '@webex/plugin-meetings/src/common/events/events-scope';
import Meetings, {CONSTANTS} from '@webex/plugin-meetings';
import Meeting from '@webex/plugin-meetings/src/meeting';
import Members from '@webex/plugin-meetings/src/members';
import * as MembersImport from '@webex/plugin-meetings/src/members';
import Roap from '@webex/plugin-meetings/src/roap';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import MeetingRequest from '@webex/plugin-meetings/src/meeting/request';
import * as MeetingRequestImport from '@webex/plugin-meetings/src/meeting/request';
import LocusInfo from '@webex/plugin-meetings/src/locus-info';
import MediaProperties from '@webex/plugin-meetings/src/media/properties';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import Media from '@webex/plugin-meetings/src/media/index';
import ReconnectionManager from '@webex/plugin-meetings/src/reconnection-manager';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import RecordingUtil from '@webex/plugin-meetings/src/recording-controller/util';
import ControlsOptionsUtil from '@webex/plugin-meetings/src/controls-options-manager/util';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import TriggerProxy from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';
import * as ReceiveSlotManagerModule from '@webex/plugin-meetings/src/multistream/receiveSlotManager';

import LLM from '@webex/internal-plugin-llm';
import Mercury from '@webex/internal-plugin-mercury';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import SimultaneousInterpretation from '@webex/plugin-meetings/src/interpretation';
import {REACTION_RELAY_TYPES} from '../../../../src/reactions/constants';
import locus from '../fixture/locus';
import {
  UserNotJoinedError,
  MeetingNotActiveError,
  UserInLobbyError,
  NoMediaEstablishedYetError,
} from '../../../../src/common/errors/webex-errors';
import WebExMeetingsErrors from '../../../../src/common/errors/webex-meetings-error';
import ParameterError from '../../../../src/common/errors/parameter';
import PasswordError from '../../../../src/common/errors/password-error';
import CaptchaError from '../../../../src/common/errors/captcha-error';
import PermissionError from '../../../../src/common/errors/permission';
import IntentToJoinError from '../../../../src/common/errors/intent-to-join';
import DefaultSDKConfig from '../../../../src/config';
import testUtils from '../../../utils/testUtils';
import {
  MeetingInfoV2CaptchaError,
  MeetingInfoV2PasswordError,
  MeetingInfoV2PolicyError,
} from '../../../../src/meeting-info/meeting-info-v2';
import {ANNOTATION_POLICY} from '../../../../src/annotation/constants';

// Non-stubbed function
const {getDisplayMedia} = Media;

describe('plugin-meetings', () => {
  const logger = {
    info: () => {},
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {},
  };

  beforeEach(() => {
    sinon.stub(Metrics, 'sendBehavioralMetric');
  });
  afterEach(() => {
    sinon.restore();
  });

  before(() => {
    const MediaStream = {
      getVideoTracks: () => [
        {
          applyConstraints: () => {},
        },
      ],
    };

    Object.defineProperty(global.window.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getDisplayMedia: sinon.stub().returns(Promise.resolve(MediaStream)),
        enumerateDevices: sinon.stub().returns(
          Promise.resolve([
            {
              deviceId: '',
              kind: 'audioinput',
              label: '',
              groupId: '29d9339cc77bffdd24cb69ee80f6d3200481099bcd0f29267558672de0430777',
            },
            {
              deviceId: '',
              kind: 'videoinput',
              label: '',
              groupId: '08d4f8200e7e4a3425ecf75b7edea9ae4acd934019f2a52217554bcc8e46604d',
            },
            {
              deviceId: '',
              kind: 'audiooutput',
              label: '',
              groupId: '29d9339cc77bffdd24cb69ee80f6d3200481099bcd0f29267558672de0430777',
            },
          ])
        ),
        getSupportedConstraints: sinon.stub().returns({
          sampleRate: true,
        }),
      },
    });

    Object.defineProperty(global.window.navigator, 'permissions', {
      writable: true,
      value: {
        query: sinon.stub().callsFake(async (arg) => {
          return {state: 'granted', name: arg.name};
        }),
      },
    });

    Object.defineProperty(global.window, 'MediaStream', {
      writable: true,
      value: MediaStream,
    });
    LoggerConfig.set({verboseEvents: true, enable: false});
    LoggerProxy.set(logger);
  });

  let webex;
  let meeting;
  let uuid1;
  let uuid2;
  let uuid3;
  let uuid4;
  let url1;
  let url2;
  let test1;
  let test2;
  let test3;
  let test4;
  let testDestination;
  let membersSpy;
  let meetingRequestSpy;
  let correlationId;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        meetings: Meetings,
        credentials: Credentials,
        support: Support,
        llm: LLM,
        mercury: Mercury,
      },
      config: {
        credentials: {
          client_id: 'mock-client-id',
        },
        meetings: {
          reconnection: {
            enabled: false,
          },
          mediaSettings: {},
          metrics: {},
          stats: {},
          experimental: {enableUnifiedMeetings: true},
          degradationPreferences: {maxMacroblocksLimit: 8192},
        },
        metrics: {
          type: ['behavioral'],
        },
      },
    });

    webex.internal.support.submitLogs = sinon.stub().returns(Promise.resolve());
    webex.internal.services = {get: sinon.stub().returns('locus-url')};
    webex.credentials.getOrgId = sinon.stub().returns('fake-org-id');
    webex.internal.metrics.submitClientMetrics = sinon.stub().returns(Promise.resolve());
    webex.meetings.uploadLogs = sinon.stub().returns(Promise.resolve());
    webex.internal.llm.on = sinon.stub();
    membersSpy = sinon.spy(MembersImport, 'default');
    meetingRequestSpy = sinon.spy(MeetingRequestImport, 'default');

    sinon.stub(TriggerProxy, 'trigger').returns(true);
    Metrics.initialSetup(webex);
    MediaUtil.createMediaStream = sinon.stub().callsFake((tracks) => {
      return {
        getTracks: () => tracks,
      };
    });

    uuid1 = uuid.v4();
    uuid2 = uuid.v4();
    uuid3 = uuid.v4();
    uuid4 = uuid.v4();
    url1 = `https://example.com/${uuid.v4()}`;
    url2 = `https://example2.com/${uuid.v4()}`;
    test1 = `test-${uuid.v4()}`;
    test2 = `test2-${uuid.v4()}`;
    test3 = `test3-${uuid.v4()}`;
    test4 = `test4-${uuid.v4()}`;
    testDestination = `testDestination-${uuid.v4()}`;
    correlationId = uuid.v4();

    meeting = new Meeting(
      {
        userId: uuid1,
        resource: uuid2,
        deviceUrl: uuid3,
        locus: {url: url1},
        destination: testDestination,
        destinationType: _MEETING_ID_,
        correlationId,
      },
      {
        parent: webex,
      }
    );

    meeting.members.selfId = uuid1;
  });

  describe('meeting index', () => {
    describe('Public Api Contract', () => {
      describe('#constructor', () => {
        it('should have created a meeting object with public properties', () => {
          assert.exists(meeting);
          assert.exists(meeting.webex);
          assert.exists(meeting.options);
          assert.exists(meeting.attrs);
          assert.exists(meeting.id);
          assert.exists(meeting.correlationId);
          assert.equal(meeting.userId, uuid1);
          assert.equal(meeting.resource, uuid2);
          assert.equal(meeting.deviceUrl, uuid3);
          assert.equal(meeting.correlationId, correlationId);
          assert.deepEqual(meeting.meetingInfo, {});
          assert.instanceOf(meeting.members, Members);
          assert.calledOnceWithExactly(
            membersSpy,
            {
              locusUrl: meeting.locusUrl,
              receiveSlotManager: meeting.receiveSlotManager,
              mediaRequestManagers: meeting.mediaRequestManagers,
              meeting,
            },
            {parent: meeting.webex}
          );
          assert.instanceOf(meeting.roap, Roap);
          assert.instanceOf(meeting.reconnectionManager, ReconnectionManager);
          assert.isNull(meeting.audio);
          assert.isNull(meeting.video);
          assert.instanceOf(meeting.meetingFiniteStateMachine, StateMachine);
          assert.isNull(meeting.conversationUrl);
          assert.equal(meeting.locusUrl, url1);
          assert.isNull(meeting.sipUri);
          assert.isNull(meeting.partner);
          assert.isNull(meeting.type);
          assert.isNull(meeting.owner);
          assert.isNull(meeting.hostId);
          assert.isNull(meeting.policy);
          assert.instanceOf(meeting.meetingRequest, MeetingRequest);
          assert.calledOnceWithExactly(
            meetingRequestSpy,
            {
              meeting,
            },
            {parent: meeting.webex}
          );
          assert.instanceOf(meeting.locusInfo, LocusInfo);
          assert.equal(meeting.fetchMeetingInfoTimeoutId, undefined);
          assert.instanceOf(meeting.mediaProperties, MediaProperties);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.UNKNOWN);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.meetingInfoFailureReason, undefined);
          assert.equal(meeting.destination, testDestination);
          assert.equal(meeting.destinationType, _MEETING_ID_);
          assert.instanceOf(meeting.breakouts, Breakouts);
          assert.instanceOf(meeting.simultaneousInterpretation, SimultaneousInterpretation);
        });
        it('creates MediaRequestManager instances', () => {
          assert.instanceOf(meeting.mediaRequestManagers.audio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.video, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareAudio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareVideo, MediaRequestManager);
        });

        it('uses meeting id as correlation id if not provided in constructor', () => {
          const newMeeting = new Meeting({
            userId: uuid1,
            resource: uuid2,
            deviceUrl: uuid3,
            locus: {url: url1},
            destination: testDestination,
            destinationType: _MEETING_ID_,
          },
          {
            parent: webex,
          });
          assert.equal(newMeeting.correlationId, newMeeting.id);
        })

        describe('creates ReceiveSlot manager instance', () => {
          let mockReceiveSlotManagerCtor;
          let providedCreateSlotCallback;
          let providedFindMemberIdByCsiCallback;

          beforeEach(() => {
            mockReceiveSlotManagerCtor = sinon
              .stub(ReceiveSlotManagerModule, 'ReceiveSlotManager')
              .callsFake((createSlotCallback, findMemberIdByCsiCallback) => {
                providedCreateSlotCallback = createSlotCallback;
                providedFindMemberIdByCsiCallback = findMemberIdByCsiCallback;

                return {updateMemberIds: sinon.stub()};
              });

            meeting = new Meeting(
              {
                userId: uuid1,
                resource: uuid2,
                deviceUrl: uuid3,
                locus: {url: url1},
                destination: testDestination,
                destinationType: _MEETING_ID_,
              },
              {
                parent: webex,
              }
            );

            meeting.mediaProperties.webrtcMediaConnection = {createReceiveSlot: sinon.stub()};
          });

          it('calls ReceiveSlotManager constructor', () => {
            assert.calledOnce(mockReceiveSlotManagerCtor);
            assert.isDefined(providedCreateSlotCallback);
            assert.isDefined(providedFindMemberIdByCsiCallback);
          });

          it('calls createReceiveSlot on the webrtc media connection in the createSlotCallback', async () => {
            assert.isDefined(providedCreateSlotCallback);

            await providedCreateSlotCallback(MediaType.VideoMain);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.createReceiveSlot);
            assert.calledWith(
              meeting.mediaProperties.webrtcMediaConnection.createReceiveSlot,
              MediaType.VideoMain
            );
          });

          it('rejects createSlotCallback if there is no webrtc media connection', () => {
            assert.isDefined(providedCreateSlotCallback);

            meeting.mediaProperties.webrtcMediaConnection.createReceiveSlot.rejects({});

            assert.isRejected(providedCreateSlotCallback(MediaType.VideoMain));
          });

          it('calls findMemberByCsi in findMemberIdByCsiCallback and returns the right value', () => {
            assert.isDefined(providedFindMemberIdByCsiCallback);

            const fakeMember = {id: 'aaa-bbb'};

            sinon.stub(meeting.members, 'findMemberByCsi').returns(fakeMember);

            const memberId = providedFindMemberIdByCsiCallback(123);

            assert.calledOnce(meeting.members.findMemberByCsi);
            assert.calledWith(meeting.members.findMemberByCsi, 123);
            assert.equal(memberId, fakeMember.id);
          });

          it('returns undefined if findMemberByCsi does not find the member', () => {
            assert.isDefined(providedFindMemberIdByCsiCallback);

            sinon.stub(meeting.members, 'findMemberByCsi').returns(undefined);

            const memberId = providedFindMemberIdByCsiCallback(123);

            assert.calledOnce(meeting.members.findMemberByCsi);
            assert.calledWith(meeting.members.findMemberByCsi, 123);
            assert.equal(memberId, undefined);
          });
        });
      });

      describe('#isLocusCall', () => {
        it('returns true if it is a call', () => {
          meeting.type = 'CALL';

          assert.isTrue(meeting.isLocusCall());
        });

        it('returns false if it is not a call', () => {
          meeting.type = 'MEETING';

          assert.isFalse(meeting.isLocusCall());
        });
      });

      describe('#invite', () => {
        it('should have #invite', () => {
          assert.exists(meeting.invite);
        });
        beforeEach(() => {
          meeting.members.addMember = sinon.stub().returns(Promise.resolve(test1));
        });
        it('should proxy members #addMember and return a promise', async () => {
          const invite = meeting.invite(uuid1, false);

          assert.exists(invite.then);
          await invite;
          assert.calledOnce(meeting.members.addMember);
          assert.calledWith(meeting.members.addMember, uuid1, false);
        });
      });
      describe('#cancelPhoneInvite', () => {
        it('should have #invite', () => {
          assert.exists(meeting.cancelPhoneInvite);
        });
        beforeEach(() => {
          meeting.members.cancelPhoneInvite = sinon.stub().returns(Promise.resolve(test1));
        });
        it('should proxy members #cancelPhoneInvite and return a promise', async () => {
          const cancel = meeting.cancelPhoneInvite(uuid1);

          assert.exists(cancel.then);
          await cancel;
          assert.calledOnce(meeting.members.cancelPhoneInvite);
          assert.calledWith(meeting.members.cancelPhoneInvite, uuid1);
        });
      });
      describe('#admit', () => {
        it('should have #admit', () => {
          assert.exists(meeting.admit);
        });
        beforeEach(() => {
          meeting.members.admitMembers = sinon.stub().returns(Promise.resolve(test1));
        });
        it('should proxy members #admitMembers and return a promise', async () => {
          const admit = meeting.members.admitMembers([uuid1]);

          assert.exists(admit.then);
          await admit;
          assert.calledOnce(meeting.members.admitMembers);
          assert.calledWith(meeting.members.admitMembers, [uuid1]);
        });
        it('should call from a breakout session if caller is in a breakout session', async () => {
          const locusUrls = {
            authorizingLocusUrl: 'authorizingLocusUrl',
            mainLocusUrl: 'mainLocusUrl',
          };
          await meeting.admit([uuid1], locusUrls);
          assert.calledOnce(meeting.members.admitMembers);
          assert.calledWith(meeting.members.admitMembers, [uuid1], locusUrls);

          meeting.breakouts.set('locusUrl', 'authorizingLocusUrl');
          meeting.breakouts.set('mainLocusUrl', 'mainLocusUrl');
          await meeting.admit([uuid1]);
          const args = meeting.members.admitMembers.getCall(1).args;
          assert.deepEqual(args, [[uuid1], locusUrls]);
        });
      });
      describe('#getMembers', () => {
        it('should have #getMembers', () => {
          assert.exists(meeting.getMembers);
        });
        it('should get the members object as an instance and return Members', async () => {
          const members = meeting.getMembers();

          assert.instanceOf(members, Members);
        });
      });

      describe('#joinWithMedia', () => {
        it('should have #joinWithMedia', () => {
          assert.exists(meeting.joinWithMedia);
        });

        describe('resolution', () => {
          it('should success and return a promise', async () => {
            meeting.join = sinon.stub().returns(Promise.resolve(test1));
            meeting.addMedia = sinon.stub().returns(Promise.resolve(test4));

            const joinOptions = {correlationId: '12345'};
            const mediaOptions = {audioEnabled: test1, allowMediaInLobby: true};

            const result = await meeting.joinWithMedia({
              joinOptions,
              mediaOptions,
            });
            assert.calledOnceWithExactly(meeting.join, joinOptions);
            assert.calledOnceWithExactly(meeting.addMedia, mediaOptions);
            assert.deepEqual(result, {join: test1, media: test4});
          });
        });

        describe('rejection', () => {
          it('should error out and return a promise', async () => {
            meeting.join = sinon.stub().returns(Promise.reject());
            assert.isRejected(meeting.joinWithMedia({}));
          });
        });
      });

      describe('#isTranscriptionSupported', () => {
        it('should return false if the feature is not supported for the meeting', () => {
          meeting.locusInfo.controls = {transcribe: {transcribing: false}};

          assert.equal(meeting.isTranscriptionSupported(), false);
        });
        it('should return true if webex assitant is enabled', () => {
          meeting.locusInfo.controls = {transcribe: {transcribing: true}};

          assert.equal(meeting.isTranscriptionSupported(), true);
        });
      });
      describe('#receiveTranscription', () => {
        it('should invoke subscribe method to invoke the callback', () => {
          meeting.monitorTranscriptionSocketConnection = sinon.stub();
          meeting.initializeTranscription = sinon.stub();

          meeting.receiveTranscription().then(() => {
            assert.equal(true, false);
            assert.calledOnce(meeting.initializeTranscription);
            assert.calledOnce(meeting.monitorTranscriptionSocketConnection);
          });
        });

        it("should throw error if request doesn't work", async () => {
          meeting.request = sinon.stub().returns(Promise.reject());

          try {
            await meeting.receiveTranscription();
          } catch (err) {
            assert(err, {});
          }
        });
      });
      describe('#stopReceivingTranscription', () => {
        it('should get invoked', () => {
          meeting.transcription = {
            closeSocket: sinon.stub(),
          };

          meeting.stopReceivingTranscription();
          assert.calledOnce(meeting.transcription.closeSocket);
        });
      });
      describe('#isReactionsSupported', () => {
        it('should return false if the feature is not supported for the meeting', () => {
          meeting.locusInfo.controls = {reactions: {enabled: false}};

          assert.equal(meeting.isReactionsSupported(), false);
        });
        it('should return true if the feature is not supported for the meeting', () => {
          meeting.locusInfo.controls = {reactions: {enabled: true}};

          assert.equal(meeting.isReactionsSupported(), true);
        });
      });

      describe('#pstnUpdate', () => {
        beforeEach(() => {
          meeting.locusInfo.self = {state: 'IDLE'};
          meeting.dialOutUrl = 'dialout:///8167d5ec-40c8-49b8-b49a-8717dbaa7d3a';
        });

        it('checks event MEETING_SELF_PHONE_AUDIO_UPDATE can return reason', () => {
          const fakePayload = {
            newSelf: {
              pstnDevices: [
                {
                  attendeeId: 'test-id',
                  url: 'dialout:///8167d5ec-40c8-49b8-b49a-8717dbaa7d3a',
                  deviceType: 'PROVISIONAL',
                  state: 'LEFT',
                  reason: 'FAILURE',
                },
              ],
            },
          };

          meeting.pstnUpdate(fakePayload);

          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'setUpLocusSelfListener',
            },
            EVENT_TRIGGERS.MEETING_SELF_PHONE_AUDIO_UPDATE,
            {
              dialIn: {
                status: '',
                attendeeId: undefined,
              },
              dialOut: {
                status: 'LEFT',
                attendeeId: 'test-id',
                reason: 'FAILURE',
              },
            }
          );
        });

        it('checks event MEETING_SELF_PHONE_AUDIO_UPDATE can return undefined reason', () => {
          const fakePayload = {
            newSelf: {
              pstnDevices: [
                {
                  attendeeId: 'test-id',
                  url: 'dialout:///8167d5ec-40c8-49b8-b49a-8717dbaa7d3a',
                  deviceType: 'PROVISIONAL',
                  state: 'LEFT',
                },
              ],
            },
          };

          meeting.pstnUpdate(fakePayload);

          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'setUpLocusSelfListener',
            },
            EVENT_TRIGGERS.MEETING_SELF_PHONE_AUDIO_UPDATE,
            {
              dialIn: {
                status: '',
                attendeeId: undefined,
              },
              dialOut: {
                status: 'LEFT',
                attendeeId: 'test-id',
                reason: undefined,
              },
            }
          );
        });
      });

      describe('#processRelayEvent', () => {
        it('should process a Reaction event type', () => {
          meeting.isReactionsSupported = sinon.stub().returns(true);
          meeting.config.receiveReactions = true;
          const fakeSendersName = 'Fake reactors name';
          meeting.members.membersCollection.get = sinon.stub().returns({name: fakeSendersName});
          const fakeReactionPayload = {
            type: 'fake_type',
            codepoints: 'fake_codepoints',
            shortcodes: 'fake_shortcodes',
            tone: {
              type: 'fake_tone_type',
              codepoints: 'fake_tone_codepoints',
              shortcodes: 'fake_tone_shortcodes',
            },
          };
          const fakeSenderPayload = {
            participantId: 'fake_participant_id',
          };
          const fakeProcessedReaction = {
            reaction: fakeReactionPayload,
            sender: {
              id: fakeSenderPayload.participantId,
              name: fakeSendersName,
            },
          };
          const fakeRelayEvent = {
            data: {
              relayType: REACTION_RELAY_TYPES.REACTION,
              reaction: fakeReactionPayload,
              sender: fakeSenderPayload,
            },
          };
          meeting.processRelayEvent(fakeRelayEvent);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'join',
            },
            EVENT_TRIGGERS.MEETING_RECEIVE_REACTIONS,
            fakeProcessedReaction
          );
        });
      });
      describe('#join', () => {
        let sandbox = null;
        let setCorrelationIdSpy;
        const joinMeetingResult = 'JOIN_MEETINGS_OPTION_RESULT';

        beforeEach(() => {
          sandbox = sinon.createSandbox();
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should have #join', () => {
          assert.exists(meeting.join);
        });
        beforeEach(() => {
          setCorrelationIdSpy = sinon.spy(meeting, 'setCorrelationId');
          meeting.setLocus = sinon.stub().returns(true);
          webex.meetings.registered = true;
          meeting.updateLLMConnection = sinon.stub();
        });
        describe('successful', () => {
          beforeEach(() => {
            sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve(joinMeetingResult));
          });

          it('should join the meeting and return promise', async () => {
            const join = meeting.join();

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.initiated',
              payload: {trigger: 'user-interaction', isRoapCallEnabled: true},
              options: {meetingId: meeting.id},
            });

            assert.exists(join.then);
            const result = await join;

            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
            assert.equal(result, joinMeetingResult);
          });

          it('should call updateLLMConnection upon joining if config value is set', async () => {
            meeting.config.enableAutomaticLLM = true;
            await meeting.join();

            assert.calledOnce(meeting.updateLLMConnection);
          });

          it('should not call updateLLMConnection upon joining if config value is not set', async () => {
            await meeting.join();

            assert.notCalled(meeting.updateLLMConnection);
          });

          it('should invoke `receiveTranscription()` if receiveTranscription is set to true', async () => {
            meeting.isTranscriptionSupported = sinon.stub().returns(true);
            meeting.receiveTranscription = sinon.stub().returns(Promise.resolve());

            await meeting.join({receiveTranscription: true});
            assert.calledOnce(meeting.receiveTranscription);
          });

          it('should not create new correlation ID on join immediately after create', async () => {
            await meeting.join();
            sinon.assert.notCalled(setCorrelationIdSpy);
          });

          it('should create new correlation ID when already joined', async () => {
            meeting.hasJoinedOnce = true;
            await meeting.join();
            sinon.assert.called(setCorrelationIdSpy);
          });

          it('should use provided correlation ID and not regenerate one when already joined', async () => {
            meeting.hasJoinedOnce = true;
            await meeting.join({correlationId: '123'});
            sinon.assert.called(setCorrelationIdSpy);
            assert.equal(meeting.correlationId, '123');
          });

          it('should send Meeting Info CA events if meetingInfo is not empty', async () => {
            meeting.meetingInfo = {info: 'info', meetingLookupUrl: 'url'};

            const join = meeting.join();

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.initiated',
              payload: {trigger: 'user-interaction', isRoapCallEnabled: true},
              options: {meetingId: meeting.id},
            });

            assert.exists(join.then);
            const result = await join;

            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
            assert.equal(result, joinMeetingResult);

            assert.calledThrice(webex.internal.newMetrics.submitClientEvent);

            assert.deepEqual(webex.internal.newMetrics.submitClientEvent.getCall(0).args[0], {
              name: 'client.call.initiated',
              payload: {
                trigger: 'user-interaction',
                isRoapCallEnabled: true,
              },
              options: {meetingId: meeting.id},
            });

            assert.deepEqual(webex.internal.newMetrics.submitClientEvent.getCall(1).args[0], {
              name: 'client.meetinginfo.request',
              options: {meetingId: meeting.id},
            });
            assert.deepEqual(webex.internal.newMetrics.submitClientEvent.getCall(2).args[0], {
              name: 'client.meetinginfo.response',
              payload: {
                identifiers: {meetingLookupUrl: 'url'},
              },
              options: {meetingId: meeting.id},
            });
          });

          it('should not send Meeting Info CA events if meetingInfo is empty', async () => {
            meeting.meetingInfo = {};

            const join = meeting.join();

            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.initiated',
              payload: {trigger: 'user-interaction', isRoapCallEnabled: true},
              options: {meetingId: meeting.id},
            });

            assert.exists(join.then);
            const result = await join;

            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
            assert.equal(result, joinMeetingResult);

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);

            assert.equal(
              webex.internal.newMetrics.submitClientEvent.getCall(0).args[0].name,
              'client.call.initiated'
            );
          });
        });
        describe('failure', () => {
          beforeEach(() => {
            sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.reject());
            meeting.logger.log = sinon.stub().returns(true);
          });

          describe('guest join', () => {
            beforeEach(() => {
              MeetingUtil.isPinOrGuest = sinon.stub().returns(true);
              MeetingUtil.hasOwner = sinon.stub().returns(false);
            });
            it('should try to join the meeting and return intent failure promise', async () => {
              await meeting.join().catch(() => {
                assert.calledOnce(MeetingUtil.joinMeeting);
              });
            });
            it('should succeed when called again after IntentToJoinError error', async () => {
              let joinSucceeded = false;

              try {
                await meeting.join();
                joinSucceeded = true;
              } catch (e) {
                assert.instanceOf(e, IntentToJoinError);
              }
              assert.isFalse(joinSucceeded);

              // IntentToJoinError means that client should call join() again
              // with moderator and pin explicitly set
              MeetingUtil.joinMeeting = sinon.stub().returns(Promise.resolve());
              await meeting.join({pin: '1234', moderator: false});
              assert.calledWith(MeetingUtil.joinMeeting, meeting, {moderator: false, pin: '1234'});
            });
          });

          it('should throw error if device is not registered', async () => {
            webex.meetings.registered = false;
            await meeting.join().catch((error) => {
              assert.equal(error.message, 'Meeting:index#join --> Device not registered');
            });
          });

          it('should post error event if failed', async () => {
            await meeting.join().catch(() => {
              assert.deepEqual(
                webex.internal.newMetrics.submitClientEvent.getCall(1).args[0].name,
                'client.locus.join.response'
              );
              assert.match(
                webex.internal.newMetrics.submitClientEvent.getCall(1).args[0].options.rawError,
                {
                  code: 2,
                  error: null,
                  joinOptions: {},
                  sdkMessage:
                    'There was an issue joining the meeting, meeting could be in a bad state.',
                }
              );
            });
          });
          it('should fail if password is required', async () => {
            meeting.passwordStatus = PASSWORD_STATUS.REQUIRED;
            await assert.isRejected(meeting.join(), PasswordError);
          });
          it('should fail if captcha is required', async () => {
            meeting.requiredCaptcha = {captchaId: 'aaa'};
            await assert.isRejected(meeting.join(), CaptchaError);
          });
          describe('total failure', () => {
            beforeEach(() => {
              MeetingUtil.isPinOrGuest = sinon.stub().returns(false);
            });
          });
          it('should try to join the meeting and return promise reject', async () => {
            await meeting.join().catch(() => {
              assert.calledOnce(MeetingUtil.joinMeeting);
            });
          });
        });
      });

      describe('#addMedia', () => {
        const muteStateStub = {
          handleClientRequest: sinon.stub().returns(Promise.resolve(true)),
          applyClientStateLocally: sinon.stub().returns(Promise.resolve(true)),
        };

        let fakeMediaConnection;

        beforeEach(() => {
          fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          };
          meeting.mediaProperties.setMediaDirection = sinon.stub().returns(true);
          meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
          meeting.mediaProperties.getCurrentConnectionType = sinon.stub().resolves('udp');
          meeting.audio = muteStateStub;
          meeting.video = muteStateStub;
          sinon.stub(Media, 'createMediaConnection').returns(fakeMediaConnection);
          meeting.setMercuryListener = sinon.stub().returns(true);
          meeting.setupMediaConnectionListeners = sinon.stub();
          meeting.setMercuryListener = sinon.stub();
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .resolves({turnServerInfo: {}, turnDiscoverySkippedReason: undefined});
        });

        it('should have #addMedia', () => {
          assert.exists(meeting.addMedia);
        });

        it('should reject promise if meeting is not active', async () => {
          const result = await assert.isRejected(meeting.addMedia());

          assert.instanceOf(result, MeetingNotActiveError);
        });

        it('should reject promise if user already in left state', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.locusInfo.parsedLocus = {self: {state: 'LEFT'}};
          const result = await assert.isRejected(meeting.addMedia());

          assert.instanceOf(result, UserNotJoinedError);
        });

        it('should reject promise if user is in lobby ', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.locusInfo.parsedLocus = {self: {state: 'IDLE'}};
          meeting.isUserUnadmitted = true;

          try {
            await meeting.addMedia();
            assert.fail('addMedia should have thrown an exception.');
          } catch (err) {
            assert.instanceOf(err, UserInLobbyError);
          }
        });

        it('should reset the statsAnalyzer to null if addMedia throws an error', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock to return an incomplete object - this will cause addMedia to fail
          // because some methods (like on() or initiateOffer()) are missing
          Media.createMediaConnection = sinon.stub().returns({
            close: sinon.stub(),
          });
          // set a statsAnalyzer on the meeting so that we can check that it gets reset to null
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          const error = await assert.isRejected(meeting.addMedia());

          assert.isNull(meeting.statsAnalyzer);
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE, {
            correlation_id: meeting.correlationId,
            locus_id: meeting.locusUrl.split('/').pop(),
            reason: error.message,
            stack: error.stack,
            code: error.code,
            turnDiscoverySkippedReason: undefined,
            turnServerUsed: true,
            isMultistream: false,
            signalingState: 'unknown',
            connectionState: 'unknown',
            iceConnectionState: 'unknown',
          });
        });

        it('checks metrics called with skipped reason config', async () => {
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .resolves({turnServerInfo: undefined, turnDiscoverySkippedReason: 'config'});
          meeting.meetingState = 'ACTIVE';
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
            assert(Metrics.sendBehavioralMetric.calledOnce);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: err.message,
              stack: err.stack,
              code: err.code,
              turnDiscoverySkippedReason: 'config',
              turnServerUsed: false,
              isMultistream: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
            });
          });
        });

        it('should reset the webrtcMediaConnection to null if addMedia throws an error', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock so that a media connection is created, but its initiateOffer() method fails
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().throws(new Error('fake error')),
            close: sinon.stub(),
          });
          const result = await assert.isRejected(meeting.addMedia());

          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            sinon.match({
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: result.message,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              isMultistream: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
            })
          );

          assert.instanceOf(result, Error);
          assert.isNull(meeting.mediaProperties.webrtcMediaConnection);
        });

        it('should include the peer connection properties correctly for multistream', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock to return an incomplete object - this will cause addMedia to fail
          // because some methods (like on() or initiateOffer()) are missing
          Media.createMediaConnection = sinon.stub().returns({
            close: sinon.stub(),
            multistreamConnection: {
              pc: {
                pc: {
                  signalingState: 'have-local-offer',
                  connectionState: 'connecting',
                  iceConnectionState: 'checking',
                },
              },
            },
          });
          // set a statsAnalyzer on the meeting so that we can check that it gets reset to null
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          const error = await assert.isRejected(meeting.addMedia());

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            sinon.match({
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              code: error.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              isMultistream: false,
              signalingState: 'have-local-offer',
              connectionState: 'connecting',
              iceConnectionState: 'checking',
            })
          );

          assert.isNull(meeting.statsAnalyzer);
          assert(Metrics.sendBehavioralMetric.calledOnce);
        });

        it('should include the peer connection properties correctly for transcoded', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock to return an incomplete object - this will cause addMedia to fail
          // because some methods (like on() or initiateOffer()) are missing
          Media.createMediaConnection = sinon.stub().returns({
            close: sinon.stub(),
            mediaConnection: {
              pc: {
                signalingState: 'have-local-offer',
                connectionState: 'connecting',
                iceConnectionState: 'checking',
              },
            },
          });
          // set a statsAnalyzer on the meeting so that we can check that it gets reset to null
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          const error = await assert.isRejected(meeting.addMedia());

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            sinon.match({
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              code: error.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              isMultistream: false,
              signalingState: 'have-local-offer',
              connectionState: 'connecting',
              iceConnectionState: 'checking',
            })
          );

          assert.isNull(meeting.statsAnalyzer);
          assert(Metrics.sendBehavioralMetric.calledOnce);
        });

        it('should work the second time addMedia is called in case the first time fails', async () => {
          meeting.meetingState = 'ACTIVE';

          // setup the mock to cause addMedia() to fail
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().throws(new Error('fake error')),
            close: sinon.stub(),
          });

          await assert.isRejected(meeting.addMedia());

          // reset the mock to a good one, that doesn't fail
          Media.createMediaConnection = sinon.stub().returns(fakeMediaConnection);

          try {
            await meeting.addMedia({
              mediaSettings: {},
            });
          } catch (err) {
            assert.fail('should not throw an error');
          }
        });

        it('if an error occurs after media request has already been sent, and the user waits until the server kicks them out, a UserNotJoinedError should be thrown when attempting to addMedia again', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock to cause addMedia() to fail
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().throws(new Error('fake error')),
            close: sinon.stub(),
          });
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
          });
          // After a couple seconds, server kicks user out
          meeting.locusInfo.parsedLocus = {self: {state: 'LEFT'}};
          await meeting.addMedia().catch((err) => {
            assert.instanceOf(err, UserNotJoinedError);
          });
        });

        it('if an error occurs after media request has already been sent, and the user does NOT wait until the server kicks them out, the user should be able to addMedia successfully', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock to cause addMedia() to fail
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().throws(new Error('fake error')),
            close: sinon.stub(),
          });
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
          });

          Media.createMediaConnection = sinon.stub().returns(fakeMediaConnection);
          await meeting.addMedia().catch((err) => {
            assert.fail('No error should appear: ', err);
          });
        });

        const checkWorking = ({allowMediaInLobby} = {}) => {
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(meeting.mediaProperties.setMediaDirection);
          assert.calledOnce(Media.createMediaConnection);
          assert.calledWith(
            Media.createMediaConnection,
            false,
            meeting.getMediaConnectionDebugId(),
            webex,
            meeting.id,
            sinon.match({turnServerInfo: undefined})
          );
          assert.calledOnce(meeting.setMercuryListener);
          assert.calledOnce(fakeMediaConnection.initiateOffer);
          assert.equal(meeting.allowMediaInLobby, allowMediaInLobby);
        };

        it('should attach the media and return promise', async () => {
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .resolves({turnServerInfo: undefined, turnDiscoverySkippedReason: undefined});

          meeting.meetingState = 'ACTIVE';
          const media = meeting.addMedia({
            mediaSettings: {},
          });

          assert.exists(media);
          await media;

          checkWorking();
        });

        it('should attach the media and return promise when in the lobby if allowMediaInLobby is set', async () => {
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .resolves({turnServerInfo: undefined, turnDiscoverySkippedReason: undefined});

          meeting.meetingState = 'ACTIVE';
          meeting.locusInfo.parsedLocus = {self: {state: 'IDLE'}};
          meeting.isUserUnadmitted = true;
          const media = meeting.addMedia({
            allowMediaInLobby: true,
          });

          assert.exists(media);
          await media;

          checkWorking({allowMediaInLobby: true});
        });

        it('should pass the turn server info to the peer connection', async () => {
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';

          meeting.meetingState = 'ACTIVE';
          Media.createMediaConnection.resetHistory();

          meeting.roap.doTurnDiscovery = sinon.stub().resolves({
            turnServerInfo: {
              url: FAKE_TURN_URL,
              username: FAKE_TURN_USER,
              password: FAKE_TURN_PASSWORD,
            },
            turnServerSkippedReason: undefined,
          });
          const media = meeting.addMedia({
            mediaSettings: {},
          });

          assert.exists(media);
          await media;
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(Media.createMediaConnection);
          assert.calledWith(
            Media.createMediaConnection,
            false,
            meeting.getMediaConnectionDebugId(),
            webex,
            meeting.id,
            sinon.match({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
            })
          );
          assert.calledOnce(fakeMediaConnection.initiateOffer);
        });

        it('should attach the media and return WebExMeetingsErrors when connection does not reach CONNECTED state', async () => {
          meeting.meetingState = 'ACTIVE';
          fakeMediaConnection.getConnectionState = sinon.stub().returns(ConnectionState.Connecting);
          const clock = sinon.useFakeTimers();
          const media = meeting.addMedia({
            mediaSettings: {},
          });

          await clock.tickAsync(
            4000 /* meetingState timer, hardcoded inside addMedia */ +
              PC_BAIL_TIMEOUT /* connection state timer */
          );
          await testUtils.flushPromises();

          assert.exists(media);
          await media.catch((err) => {
            assert.instanceOf(err, WebExMeetingsErrors);
          });

          clock.restore();
        });

        it('should reject if waitForMediaConnectionConnected() rejects', async () => {
          webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode = sinon
            .stub()
            .returns({});
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.waitForMediaConnectionConnected.rejects(new Error('fake error'));

          let errorThrown = false;

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch(() => {
              errorThrown = true;
            });

          assert.calledTwice(webex.internal.newMetrics.submitClientEvent);

          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.ice.end',
            payload: {
              canProceed: false,
              icePhase: 'JOIN_MEETING_FINAL',
              errors: [{}],
            },
            options: {
              meetingId: meeting.id,
            },
          });

          assert.isTrue(errorThrown);
        });

        it('should send ADD_MEDIA_SUCCESS metrics', async () => {
          meeting.meetingState = 'ACTIVE';
          await meeting.addMedia({
            mediaSettings: {},
          });

          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ADD_MEDIA_SUCCESS, {
            correlation_id: meeting.correlationId,
            locus_id: meeting.locusUrl.split('/').pop(),
            connectionType: 'udp',
            isMultistream: false,
          });

          assert.called(webex.internal.newMetrics.submitClientEvent);
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.media-engine.ready',
            options: {
              meetingId: meeting.id,
            },
          });
        });

        describe('handles StatsAnalyzer events', () => {
          let prevConfigValue;
          let statsAnalyzerStub;

          beforeEach(async () => {
            meeting.meetingState = 'ACTIVE';
            prevConfigValue = meeting.config.stats.enableStatsAnalyzer;

            meeting.config.stats.enableStatsAnalyzer = true;

            statsAnalyzerStub = new EventsScope();
            // mock the StatsAnalyzer constructor
            sinon.stub(StatsAnalyzerModule, 'StatsAnalyzer').returns(statsAnalyzerStub);

            await meeting.addMedia({
              mediaSettings: {},
            });
          });

          afterEach(() => {
            meeting.config.stats.enableStatsAnalyzer = prevConfigValue;
          });

          it('LOCAL_MEDIA_STARTED triggers "meeting:media:local:start" event and sends metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.LOCAL_MEDIA_STARTED,
              {type: 'audio'}
            );

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'addMedia',
              },
              EVENT_TRIGGERS.MEETING_MEDIA_LOCAL_STARTED,
              {
                type: 'audio',
              }
            );
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.tx.start',
              payload: {mediaType: 'audio'},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('LOCAL_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.LOCAL_MEDIA_STOPPED,
              {type: 'video'}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.tx.stop',
              payload: {mediaType: 'video'},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('REMOTE_MEDIA_STARTED triggers "meeting:media:remote:start" event and sends metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.REMOTE_MEDIA_STARTED,
              {type: 'video'}
            );

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'addMedia',
              },
              EVENT_TRIGGERS.MEETING_MEDIA_REMOTE_STARTED,
              {
                type: 'video',
              }
            );
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.rx.start',
              payload: {mediaType: 'video'},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('REMOTE_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.REMOTE_MEDIA_STOPPED,
              {type: 'audio'}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.rx.stop',
              payload: {mediaType: 'audio'},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('calls submitMQE correctly', async () => {
            const fakeData = {intervalMetadata: {bla: 'bla'}};

            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.MEDIA_QUALITY,
              {data: fakeData, networkType: 'wifi'}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitMQE, {
              name: 'client.mediaquality.event',
              options: {
                meetingId: meeting.id,
                networkType: 'wifi',
              },
              payload: {
                intervals: [fakeData],
              },
            });
          });
        });

        it('should pass bundlePolicy to createMediaConnection', async () => {
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';

          meeting.meetingState = 'ACTIVE';
          Media.createMediaConnection.resetHistory();

          meeting.roap.doTurnDiscovery = sinon.stub().resolves({
            turnServerInfo: {
              url: FAKE_TURN_URL,
              username: FAKE_TURN_USER,
              password: FAKE_TURN_PASSWORD,
            },
            turnServerSkippedReason: undefined,
          });
          const media = meeting.addMedia({
            mediaSettings: {},
            bundlePolicy: 'bundlePolicy-value',
          });

          assert.exists(media);
          await media;
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(Media.createMediaConnection);
          assert.calledWith(
            Media.createMediaConnection,
            false,
            meeting.getMediaConnectionDebugId(),
            webex,
            meeting.id,
            sinon.match({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
              bundlePolicy: 'bundlePolicy-value',
            })
          );
          assert.calledOnce(fakeMediaConnection.initiateOffer);
        });

        it('succeeds even if getDevices() throws', async () => {
          meeting.meetingState = 'ACTIVE';

          sinon.stub(internalMediaModule, 'getDevices').rejects(new Error('fake error'));

          await meeting.addMedia();
        });
      });

      /* This set of tests are like semi-integration tests, they use real MuteState, Media, LocusMediaRequest and Roap classes.
         They mock the @webex/internal-media-core and sending of /media http requests to Locus.
         Their main purpose is to test that we send the right http requests to Locus and make right calls
         to @webex/internal-media-core when addMedia, updateMedia, publishTracks, unpublishTracks are called
         in various combinations.
      */
      [true, false].forEach((isMultistream) =>
        describe(`addMedia/updateMedia semi-integration tests (${
          isMultistream ? 'multistream' : 'transcoded'
        })`, () => {
          const webrtcAudioTrack = {
            id: 'underlying audio track',
            getSettings: sinon.stub().returns({deviceId: 'fake device id for audio track'}),
          };

          let fakeMicrophoneTrack;
          let fakeRoapMediaConnection;
          let fakeMultistreamRoapMediaConnection;
          let roapMediaConnectionConstructorStub;
          let multistreamRoapMediaConnectionConstructorStub;
          let locusMediaRequestStub; // stub for /media requests to Locus

          const roapOfferMessage = {messageType: 'OFFER', sdp: 'sdp', seq: '1', tieBreaker: '123'};

          let expectedMediaConnectionConfig;
          let expectedDebugId;

          let clock;

          beforeEach(() => {
            clock = sinon.useFakeTimers();

            meeting.deviceUrl = 'deviceUrl';
            meeting.config.deviceType = 'web';
            meeting.isMultistream = isMultistream;
            meeting.meetingState = 'ACTIVE';
            meeting.mediaId = 'fake media id';
            meeting.selfUrl = 'selfUrl';
            meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
            meeting.mediaProperties.getCurrentConnectionType = sinon.stub().resolves('udp');
            meeting.setMercuryListener = sinon.stub();
            meeting.locusInfo.onFullLocus = sinon.stub();
            meeting.webex.meetings.reachability = {
              isAnyClusterReachable: sinon.stub().resolves(true),
            };
            meeting.roap.doTurnDiscovery = sinon
              .stub()
              .resolves({turnServerInfo: {}, turnDiscoverySkippedReason: 'reachability'});

            StaticConfig.set({bandwidth: {audio: 1234, video: 5678, startBitrate: 9876}});

            // setup things that are expected to be the same across all the tests and are actually irrelevant for these tests
            expectedDebugId = `MC-${meeting.id.substring(0, 4)}`;
            expectedMediaConnectionConfig = {
              iceServers: [{urls: undefined, username: '', credential: ''}],
              skipInactiveTransceivers: false,
              requireH264: true,
              sdpMunging: {
                convertPort9to0: false,
                addContentSlides: true,
                bandwidthLimits: {
                  audio: StaticConfig.meetings.bandwidth.audio,
                  video: StaticConfig.meetings.bandwidth.video,
                },
                startBitrate: StaticConfig.meetings.bandwidth.startBitrate,
                periodicKeyframes: 20,
                disableExtmap: !meeting.config.enableExtmap,
                disableRtx: !meeting.config.enableRtx,
              },
            };

            // setup stubs
            fakeMicrophoneTrack = {
              id: 'fake mic',
              on: sinon.stub(),
              off: sinon.stub(),
              setUnmuteAllowed: sinon.stub(),
              setMuted: sinon.stub(),
              setPublished: sinon.stub(),
              muted: false,
              underlyingTrack: webrtcAudioTrack,
            };

            fakeRoapMediaConnection = {
              id: 'roap media connection',
              close: sinon.stub(),
              getConnectionState: sinon.stub().returns(ConnectionState.Connected),
              initiateOffer: sinon.stub().resolves({}),
              update: sinon.stub().resolves({}),
              on: sinon.stub(),
            };

            fakeMultistreamRoapMediaConnection = {
              id: 'multistream roap media connection',
              close: sinon.stub(),
              getConnectionState: sinon.stub().returns(ConnectionState.Connected),
              initiateOffer: sinon.stub().resolves({}),
              publishTrack: sinon.stub().resolves({}),
              unpublishTrack: sinon.stub().resolves({}),
              on: sinon.stub(),
              requestMedia: sinon.stub(),
              createReceiveSlot: sinon.stub().resolves({on: sinon.stub()}),
              enableMultistreamAudio: sinon.stub(),
            };

            roapMediaConnectionConstructorStub = sinon
              .stub(internalMediaModule, 'RoapMediaConnection')
              .returns(fakeRoapMediaConnection);

            multistreamRoapMediaConnectionConstructorStub = sinon
              .stub(internalMediaModule, 'MultistreamRoapMediaConnection')
              .returns(fakeMultistreamRoapMediaConnection);

            locusMediaRequestStub = sinon
              .stub(WebexPlugin.prototype, 'request')
              .resolves({body: {locus: {fullState: {}}}});
          });

          afterEach(() => {
            clock.restore();
          });

          // helper function that waits until all promises are resolved and any queued up /media requests to Locus are sent out
          const stableState = async () => {
            await testUtils.flushPromises();
            clock.tick(1); // needed because LocusMediaRequest uses Lodash.defer()
          };

          const resetHistory = () => {
            locusMediaRequestStub.resetHistory();
            fakeRoapMediaConnection.update.resetHistory();
            fakeMultistreamRoapMediaConnection.publishTrack.resetHistory();
            fakeMultistreamRoapMediaConnection.unpublishTrack.resetHistory();
          };

          const getRoapListener = () => {
            const roapMediaConnectionToCheck = isMultistream
              ? fakeMultistreamRoapMediaConnection
              : fakeRoapMediaConnection;

            for (let idx = 0; idx < roapMediaConnectionToCheck.on.callCount; idx += 1) {
              if (
                roapMediaConnectionToCheck.on.getCall(idx).args[0] === Event.ROAP_MESSAGE_TO_SEND
              ) {
                return roapMediaConnectionToCheck.on.getCall(idx).args[1];
              }
            }
            assert.fail(
              'listener for "roap:messageToSend" (Event.ROAP_MESSAGE_TO_SEND) was not registered'
            );
          };

          // simulates a Roap offer being generated by the RoapMediaConnection
          const simulateRoapOffer = async () => {
            const roapListener = getRoapListener();

            await roapListener({roapMessage: roapOfferMessage});
            await stableState();
          };

          const checkSdpOfferSent = ({audioMuted, videoMuted}) => {
            const {sdp, seq, tieBreaker} = roapOfferMessage;

            assert.calledWith(locusMediaRequestStub, {
              method: 'PUT',
              uri: `${meeting.selfUrl}/media`,
              body: {
                device: {url: meeting.deviceUrl, deviceType: meeting.config.deviceType},
                correlationId: meeting.correlationId,
                localMedias: [
                  {
                    localSdp: `{"audioMuted":${audioMuted},"videoMuted":${videoMuted},"roapMessage":{"messageType":"OFFER","sdps":["${sdp}"],"version":"2","seq":"${seq}","tieBreaker":"${tieBreaker}"}}`,
                    mediaId: 'fake media id',
                  },
                ],
                clientMediaPreferences: {
                  preferTranscoding: !meeting.isMultistream,
                  joinCookie: undefined,
                },
              },
            });
          };

          const checkLocalMuteSentToLocus = ({audioMuted, videoMuted}) => {
            assert.calledWith(locusMediaRequestStub, {
              method: 'PUT',
              uri: `${meeting.selfUrl}/media`,
              body: {
                device: {url: meeting.deviceUrl, deviceType: meeting.config.deviceType},
                correlationId: meeting.correlationId,
                localMedias: [
                  {
                    localSdp: `{"audioMuted":${audioMuted},"videoMuted":${videoMuted}}`,
                    mediaId: 'fake media id',
                  },
                ],
                clientMediaPreferences: {
                  preferTranscoding: !meeting.isMultistream,
                },
                respOnlySdp: true,
                usingResource: null,
              },
            });
          };

          const checkMediaConnectionCreated = ({
            mediaConnectionConfig,
            localTracks,
            direction,
            remoteQualityLevel,
            expectedDebugId,
            meetingId,
          }) => {
            if (isMultistream) {
              const {iceServers} = mediaConnectionConfig;

              assert.calledOnceWithMatch(
                multistreamRoapMediaConnectionConstructorStub,
                {
                  iceServers,
                  enableMainAudio: direction.audio !== 'inactive',
                  enableMainVideo: true,
                },
                meetingId
              );

              Object.values(localTracks).forEach((track) => {
                if (track) {
                  assert.calledOnceWithExactly(
                    fakeMultistreamRoapMediaConnection.publishTrack,
                    track
                  );
                }
              });
            } else {
              assert.calledOnceWithExactly(
                roapMediaConnectionConstructorStub,
                mediaConnectionConfig,
                {
                  localTracks: {
                    audio: localTracks.audio?.underlyingTrack,
                    video: localTracks.video?.underlyingTrack,
                    screenShareVideo: localTracks.screenShareVideo?.underlyingTrack,
                  },
                  direction,
                  remoteQualityLevel,
                },
                expectedDebugId
              );
            }
          };

          it('addMedia() works correctly when media is enabled without tracks to publish', async () => {
            await meeting.addMedia();
            await simulateRoapOffer();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localTracks: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShareVideo: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});

            // and that it was the only /media request that was sent
            assert.calledOnce(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is enabled with tracks to publish', async () => {
            await meeting.addMedia({localTracks: {microphone: fakeMicrophoneTrack}});
            await simulateRoapOffer();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localTracks: {
                audio: fakeMicrophoneTrack,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShareVideo: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: false, videoMuted: true});

            // and no other local mute requests were sent to Locus
            assert.calledOnce(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is enabled with tracks to publish and track is muted', async () => {
            fakeMicrophoneTrack.muted = true;

            await meeting.addMedia({localTracks: {microphone: fakeMicrophoneTrack}});
            await simulateRoapOffer();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localTracks: {
                audio: fakeMicrophoneTrack,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShareVideo: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});

            // and no other local mute requests were sent to Locus
            assert.calledOnce(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is disabled with tracks to publish', async () => {
            await meeting.addMedia({
              localTracks: {microphone: fakeMicrophoneTrack},
              audioEnabled: false,
            });
            await simulateRoapOffer();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localTracks: {
                audio: fakeMicrophoneTrack,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'inactive',
                video: 'sendrecv',
                screenShareVideo: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});

            // and no other local mute requests were sent to Locus
            assert.calledOnce(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is disabled with no tracks to publish', async () => {
            await meeting.addMedia({audioEnabled: false});
            await simulateRoapOffer();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localTracks: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'inactive',
                video: 'sendrecv',
                screenShareVideo: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});

            // and no other local mute requests were sent to Locus
            assert.calledOnce(locusMediaRequestStub);
          });

          describe('publishTracks()/unpublishTracks() calls', () => {
            [
              {mediaEnabled: true, expected: {direction: 'sendrecv', localMuteSentValue: false}},
              {
                mediaEnabled: false,
                expected: {direction: 'inactive', localMuteSentValue: undefined},
              },
            ].forEach(({mediaEnabled, expected}) => {
              it(`first publishTracks() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();

                resetHistory();

                await meeting.publishTracks({microphone: fakeMicrophoneTrack});
                await stableState();

                if (expected.localMuteSentValue !== undefined) {
                  // check local mute was sent and it was the only /media request
                  checkLocalMuteSentToLocus({
                    audioMuted: expected.localMuteSentValue,
                    videoMuted: true,
                  });
                  assert.calledOnce(locusMediaRequestStub);
                } else {
                  assert.notCalled(locusMediaRequestStub);
                }
                if (isMultistream) {
                  assert.calledOnceWithExactly(
                    fakeMultistreamRoapMediaConnection.publishTrack,
                    fakeMicrophoneTrack
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {audio: webrtcAudioTrack, video: null, screenShareVideo: null},
                    direction: {
                      audio: expected.direction,
                      video: 'sendrecv',
                      screenShareVideo: 'recvonly',
                    },
                    remoteQualityLevel: 'HIGH',
                  });
                }
              });

              it(`second publishTracks() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();
                await meeting.publishTracks({microphone: fakeMicrophoneTrack});
                await stableState();

                resetHistory();

                const webrtcAudioTrack2 = {id: 'underlying audio track 2'};
                const fakeMicrophoneTrack2 = {
                  id: 'fake mic 2',
                  on: sinon.stub(),
                  off: sinon.stub(),
                  setUnmuteAllowed: sinon.stub(),
                  setMuted: sinon.stub(),
                  setPublished: sinon.stub(),
                  muted: false,
                  underlyingTrack: webrtcAudioTrack2,
                };

                await meeting.publishTracks({microphone: fakeMicrophoneTrack2});
                await stableState();

                // only the roap media connection should be updated
                if (isMultistream) {
                  assert.calledOnceWithExactly(
                    fakeMultistreamRoapMediaConnection.publishTrack,
                    fakeMicrophoneTrack2
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {audio: webrtcAudioTrack2, video: null, screenShareVideo: null},
                    direction: {
                      audio: expected.direction,
                      video: 'sendrecv',
                      screenShareVideo: 'recvonly',
                    },
                    remoteQualityLevel: 'HIGH',
                  });
                }

                // and no other roap messages or local mute requests were sent
                assert.notCalled(locusMediaRequestStub);
              });

              it(`unpublishTracks() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();
                await meeting.publishTracks({microphone: fakeMicrophoneTrack});
                await stableState();

                resetHistory();

                await meeting.unpublishTracks([fakeMicrophoneTrack]);
                await stableState();

                // the roap media connection should be updated
                if (isMultistream) {
                  assert.calledOnceWithExactly(
                    fakeMultistreamRoapMediaConnection.unpublishTrack,
                    fakeMicrophoneTrack
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {audio: null, video: null, screenShareVideo: null},
                    direction: {
                      audio: expected.direction,
                      video: 'sendrecv',
                      screenShareVideo: 'recvonly',
                    },
                    remoteQualityLevel: 'HIGH',
                  });
                }

                if (expected.localMuteSentValue !== undefined) {
                  // and local mute sent to Locus
                  checkLocalMuteSentToLocus({
                    audioMuted:
                      !expected.localMuteSentValue /* negation, because we're un-publishing */,
                    videoMuted: true,
                  });
                  assert.calledOnce(locusMediaRequestStub);
                } else {
                  assert.notCalled(locusMediaRequestStub);
                }
              });
            });
          });

          describe('updateMedia()', () => {
            const addMedia = async (enableMedia, track) => {
              await meeting.addMedia({audioEnabled: enableMedia, localTracks: {microphone: track}});
              await simulateRoapOffer();

              resetHistory();
            };

            const checkAudioEnabled = (expectedTrack, expectedDirection) => {
              if (isMultistream) {
                assert.calledOnceWithExactly(
                  fakeMultistreamRoapMediaConnection.enableMultistreamAudio,
                  expectedDirection !== 'inactive'
                );
              } else {
                assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                  localTracks: {audio: expectedTrack, video: null, screenShareVideo: null},
                  direction: {
                    audio: expectedDirection,
                    video: 'sendrecv',
                    screenShareVideo: 'recvonly',
                  },
                  remoteQualityLevel: 'HIGH',
                });
              }
            };

            it('updateMedia() disables media when nothing is published', async () => {
              await addMedia(true);

              await meeting.updateMedia({audioEnabled: false});

              // the roap media connection should be updated
              checkAudioEnabled(null, 'inactive');

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledOnce(locusMediaRequestStub);
            });

            it('updateMedia() enables media when nothing is published', async () => {
              await addMedia(false);

              await meeting.updateMedia({audioEnabled: true});

              // the roap media connection should be updated
              checkAudioEnabled(null, 'sendrecv');

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledOnce(locusMediaRequestStub);
            });

            it('updateMedia() disables media when track is published', async () => {
              await addMedia(true, fakeMicrophoneTrack);

              await meeting.updateMedia({audioEnabled: false});
              await stableState();

              // the roap media connection should be updated
              checkAudioEnabled(webrtcAudioTrack, 'inactive');

              checkLocalMuteSentToLocus({audioMuted: true, videoMuted: true});

              locusMediaRequestStub.resetHistory();

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledOnce(locusMediaRequestStub);
            });

            it('updateMedia() enables media when track is published', async () => {
              await addMedia(false, fakeMicrophoneTrack);

              await meeting.updateMedia({audioEnabled: true});
              await stableState();

              // the roap media connection should be updated
              checkAudioEnabled(webrtcAudioTrack, 'sendrecv');

              checkLocalMuteSentToLocus({audioMuted: false, videoMuted: true});

              locusMediaRequestStub.resetHistory();

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: false, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledOnce(locusMediaRequestStub);
            });
          });

          [
            {mute: true, title: 'muting a track before confluence is created'},
            {mute: false, title: 'unmuting a track before confluence is created'},
          ].forEach(({mute, title}) =>
            it(title, async () => {
              // initialize the microphone mute state to opposite of what we do in the test
              fakeMicrophoneTrack.muted = !mute;

              await meeting.addMedia({localTracks: {microphone: fakeMicrophoneTrack}});
              await stableState();

              resetHistory();

              assert.equal(fakeMicrophoneTrack.on.getCall(0).args[0], LocalTrackEvents.Muted);
              const mutedListener = fakeMicrophoneTrack.on.getCall(0).args[1];
              // simulate track being muted
              mutedListener({trackState: {muted: mute}});

              await stableState();

              // nothing should happen
              assert.notCalled(locusMediaRequestStub);
              assert.notCalled(fakeRoapMediaConnection.update);

              // now simulate roap offer
              await simulateRoapOffer();

              // it should be sent with the right mute status
              checkSdpOfferSent({audioMuted: mute, videoMuted: true});

              // nothing else should happen
              assert.calledOnce(locusMediaRequestStub);
              assert.notCalled(fakeRoapMediaConnection.update);
            })
          );
        })
      );

      describe('#acknowledge', () => {
        it('should have #acknowledge', () => {
          assert.exists(meeting.acknowledge);
        });
        beforeEach(() => {
          meeting.meetingRequest.acknowledgeMeeting = sinon.stub().returns(Promise.resolve());
        });
        it('should acknowledge incoming and return a promise', async () => {
          const ack = meeting.acknowledge('INCOMING', false);

          assert.exists(ack.then);
          await ack;
          assert.calledOnce(meeting.meetingRequest.acknowledgeMeeting);
        });
        it('should acknowledge a non incoming and return a promise', async () => {
          const ack = meeting.acknowledge(test1, false);

          assert.exists(ack.then);
          await ack;
          assert.notCalled(meeting.meetingRequest.acknowledgeMeeting);
        });
      });
      describe('#decline', () => {
        it('should have #decline', () => {
          assert.exists(meeting.decline);
        });
        beforeEach(() => {
          meeting.meetingRequest.declineMeeting = sinon.stub().returns(Promise.resolve());
          meeting.meetingFiniteStateMachine.ring();
        });
        it('should decline the meeting and trigger meeting destroy for 1:1', async () => {
          await meeting.decline();
          assert.calledOnce(meeting.meetingRequest.declineMeeting);
        });
      });
      describe('#leave', () => {
        let sandbox;

        it('should have #leave', () => {
          assert.exists(meeting.leave);
        });

        it('should reject if meeting is already inactive', async () => {
          await meeting.leave().catch((err) => {
            assert.instanceOf(err, MeetingNotActiveError);
          });
        });

        it('should reject if meeting is already left', async () => {
          meeting.meetingState = 'ACTIVE';
          await meeting.leave().catch((err) => {
            assert.instanceOf(err, UserNotJoinedError);
          });
        });

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.meetingFiniteStateMachine.ring();
          meeting.meetingFiniteStateMachine.join();
          meeting.meetingRequest.leaveMeeting = sinon
            .stub()
            .returns(Promise.resolve({body: 'test'}));
          meeting.locusInfo.onFullLocus = sinon.stub().returns(true);
          meeting.cleanupLocalTracks = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteTracks').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetRemoteTracks = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetPeerConnections = sinon.stub().returns(true);
          meeting.logger.error = sinon.stub().returns(true);
          meeting.updateLLMConnection = sinon.stub().returns(Promise.resolve());

          // A meeting needs to be joined to leave
          meeting.meetingState = 'ACTIVE';
          meeting.state = 'JOINED';
        });
        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });
        it('should leave the meeting and return promise', async () => {
          const leave = meeting.leave();

          assert.exists(leave.then);
          await leave;
          assert.calledOnce(meeting.meetingRequest.leaveMeeting);
          assert.calledOnce(meeting.cleanupLocalTracks);
          assert.calledOnce(meeting.closeRemoteTracks);
          assert.calledOnce(meeting.closePeerConnections);
          assert.calledOnce(meeting.unsetRemoteTracks);
          assert.calledOnce(meeting.unsetPeerConnections);
        });

        it('should reset call diagnostic latencies correctly', async () => {
          const leave = meeting.leave();

          assert.exists(leave.then);
          await leave;
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent, {
            name: 'internal.reset.join.latencies',
          });
        });

        describe('after audio/video is defined', () => {
          let handleClientRequest;

          beforeEach(() => {
            handleClientRequest = sinon.stub().returns(Promise.resolve(true));

            meeting.audio = {handleClientRequest};
            meeting.video = {handleClientRequest};
          });

          it('should delete audio and video state machines when leaving the meeting', async () => {
            const leave = meeting.leave();

            assert.exists(leave.then);
            await leave;

            assert.isNull(meeting.audio);
            assert.isNull(meeting.video);
          });
        });
        it('should leave the meeting without leaving resource', async () => {
          const leave = meeting.leave({resourceId: null});

          assert.exists(leave.then);
          await leave;
          assert.calledWith(meeting.meetingRequest.leaveMeeting, {
            locusUrl: meeting.locusUrl,
            correlationId: meeting.correlationId,
            selfId: meeting.selfId,
            resourceId: null,
            deviceUrl: meeting.deviceUrl,
          });
        });
        it('should leave the meeting on the resource', async () => {
          const leave = meeting.leave();

          assert.exists(leave.then);
          await leave;
          assert.calledWith(meeting.meetingRequest.leaveMeeting, {
            locusUrl: meeting.locusUrl,
            correlationId: meeting.correlationId,
            selfId: meeting.selfId,
            resourceId: meeting.resourceId,
            deviceUrl: meeting.deviceUrl,
          });
        });
        it('should leave the meeting on the resource with reason', async () => {
          const leave = meeting.leave({
            resourceId: meeting.resourceId,
            reason: MEETING_REMOVED_REASON.CLIENT_LEAVE_REQUEST,
          });

          assert.exists(leave.then);
          await leave;
          assert.calledWith(meeting.meetingRequest.leaveMeeting, {
            locusUrl: meeting.locusUrl,
            correlationId: meeting.correlationId,
            selfId: meeting.selfId,
            resourceId: meeting.resourceId,
            deviceUrl: meeting.deviceUrl,
            reason: MEETING_REMOVED_REASON.CLIENT_LEAVE_REQUEST,
          });
        });
      });
      describe('#requestScreenShareFloor', () => {
        it('should have #requestScreenShareFloor', () => {
          assert.exists(meeting.requestScreenShareFloor);
        });
        beforeEach(() => {
          meeting.locusInfo.mediaShares = [{name: 'content', url: url1}];
          meeting.locusInfo.self = {url: url1};
          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.shareVideoTrack = {};
          meeting.mediaProperties.mediaDirection.sendShare = true;
          meeting.state = 'JOINED';
        });
        it('should send the share', async () => {
          const share = meeting.requestScreenShareFloor();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
        });
      });

      describe('#sendDTMF', () => {
        it('should have #sendDTMF', () => {
          assert.exists(meeting.sendDTMF);
        });

        it('should call the meetingRequest sendDTMF method', async () => {
          const tones = '123';

          meeting.meetingRequest.sendDTMF = sinon.stub().returns(Promise.resolve());

          meeting.locusInfo.self = {
            enableDTMF: true,
            url: url2,
          };

          await meeting.sendDTMF(tones);

          assert.calledWith(meeting.meetingRequest.sendDTMF, {
            locusUrl: meeting.locusInfo.self.url,
            deviceUrl: meeting.deviceUrl,
            tones,
          });
        });

        describe('when meeting does not have a locus', () => {
          it('should throw an error', () => {
            assert.isRejected(meeting.sendDTMF('123'));
          });
        });

        describe('when meeting does not have DTMF enabled', () => {
          it('should throw an error', () => {
            meeting.locusInfo.self = {
              enableDTMF: false,
              url: url2,
            };

            assert.isRejected(meeting.sendDTMF('123'));
          });
        });
      });

      describe('#updateMedia', () => {
        let sandbox;

        const createFakeLocalTrack = () => ({
          underlyingTrack: {id: 'fake underlying track'},
        });
        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.audio = {enable: sinon.stub()};
          meeting.video = {enable: sinon.stub()};
          meeting.mediaProperties.audioTrack = createFakeLocalTrack();
          meeting.mediaProperties.videoTrack = createFakeLocalTrack();
          meeting.mediaProperties.shareVideoTrack = createFakeLocalTrack();
          meeting.mediaProperties.mediaDirection = {
            sendAudio: true,
            sendVideo: true,
            sendShare: true,
            receiveAudio: true,
            receiveVideo: true,
            receiveShare: true,
          };
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        forEach(
          [
            {audioEnabled: true, enableMultistreamAudio: true},
            {audioEnabled: false, enableMultistreamAudio: false},
          ],
          ({audioEnabled, enableMultistreamAudio}) => {
            it(`should call enableMultistreamAudio with ${enableMultistreamAudio} if it is a multistream connection and audioEnabled: ${audioEnabled}`, async () => {
              meeting.mediaProperties.webrtcMediaConnection = {
                enableMultistreamAudio: sinon.stub().resolves({}),
              };
              meeting.isMultistream = true;

              await meeting.updateMedia({audioEnabled});

              assert.calledOnceWithExactly(
                meeting.mediaProperties.webrtcMediaConnection.enableMultistreamAudio,
                enableMultistreamAudio
              );
              assert.calledOnceWithExactly(meeting.audio.enable, meeting, enableMultistreamAudio);
            });
          }
        );

        it('should use a queue if currently busy', async () => {
          sandbox.stub(meeting, 'canUpdateMedia').returns(false);
          meeting.mediaProperties.webrtcMediaConnection = {
            update: sinon.stub().resolves({}),
          };

          let myPromiseResolved = false;

          meeting.updateMedia({audioEnabled: false, videoEnabled: false}).then(() => {
            myPromiseResolved = true;
          });

          // verify that nothing was done
          assert.notCalled(meeting.mediaProperties.webrtcMediaConnection.update);

          // now trigger processing of the queue
          meeting.canUpdateMedia.restore();
          sandbox.stub(meeting, 'canUpdateMedia').returns(true);

          meeting.processNextQueuedMediaUpdate();
          await testUtils.flushPromises();

          // and check that update is called with the original args
          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.update);
          assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.update, {
            localTracks: {
              audio: meeting.mediaProperties.audioTrack.underlyingTrack,
              video: meeting.mediaProperties.videoTrack.underlyingTrack,
              screenShareVideo: meeting.mediaProperties.shareVideoTrack.underlyingTrack,
            },
            direction: {
              audio: 'inactive',
              video: 'inactive',
              screenShareVideo: 'sendrecv',
            },
            remoteQualityLevel: 'HIGH',
          });
          assert.isTrue(myPromiseResolved);
        });
      });

      describe('#changeVideoLayout', () => {
        describe('when media direction has recieve video and there is remoteStream', () => {
          let mediaDirection;
          const layoutTypeSingle = 'Single';

          beforeEach(() => {
            mediaDirection = {
              sendAudio: true,
              sendVideo: true,
              sendShare: false,
              receiveVideo: true,
            };
            meeting.mediaProperties.mediaDirection = mediaDirection;
            meeting.mediaProperties.remoteVideoTrack = sinon
              .stub()
              .returns({mockTrack: 'mockTrack'});

            meeting.meetingRequest.changeVideoLayoutDebounced = sinon
              .stub()
              .returns(Promise.resolve());

            meeting.locusInfo.self = {
              url: url2,
            };
          });

          it('should listen once for CONTROLS_MEETING_LAYOUT_UPDATED', async () => {
            // const spy = sinon.spy(TriggerProxy, 'trigger');
            const spy = sinon.spy(meeting.locusInfo, 'once');

            await meeting.changeVideoLayout('Equal');

            assert.calledWith(spy, LOCUSINFO.EVENTS.CONTROLS_MEETING_LAYOUT_UPDATED);
          });

          it('should have receiveVideo true and remote video track should exist', () => {
            assert.equal(meeting.mediaProperties.mediaDirection.receiveVideo, true);
            assert.exists(meeting.mediaProperties.remoteVideoTrack);
          });

          it('has layoutType which exists in the list of allowed layoutTypes and should call meetingRequest changeVideoLayoutDebounced method', async () => {
            const layoutType = 'Equal';

            await meeting.changeVideoLayout(layoutType);

            assert(CONSTANTS.LAYOUT_TYPES.includes(layoutType));
            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType,
              main: undefined,
              content: undefined,
            });
          });

          it("doesn't have layoutType which exists in the list of allowed layoutTypes should throw an error", async () => {
            const layoutType = 'Invalid Layout';

            assert.isRejected(meeting.changeVideoLayout(layoutType));
          });

          it('should send no layoutType when layoutType is not provided', async () => {
            await meeting.changeVideoLayout(undefined, {main: {width: 100, height: 200}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: undefined,
              main: {width: 100, height: 200},
              content: undefined,
            });
          });

          it('throws if trying to send renderInfo for content when not receiving content', async () => {
            assert.isRejected(
              meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1280, height: 720}})
            );
          });

          it('calls changeVideoLayoutDebounced with renderInfo for main and content', async () => {
            // first set only the main renderInfo
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 100, height: 200}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 100, height: 200},
              content: undefined,
            });

            meeting.mediaProperties.mediaDirection.receiveShare = true;
            meeting.mediaProperties.remoteShare = sinon.stub().returns({mockTrack: 'mockTrack'});

            // now call it again with just content
            await meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 500, height: 600}});
            // it should call changeVideoLayoutDebounced with content and previous main value
            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 100, height: 200},
              content: {width: 500, height: 600},
            });

            // and now call with both
            await meeting.changeVideoLayout(layoutTypeSingle, {
              main: {width: 300, height: 400},
              content: {width: 700, height: 800},
            });

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 300, height: 400},
              content: {width: 700, height: 800},
            });

            // and now set just the layoutType, the previous main and content values should be used
            const layoutType = 'Equal';

            await meeting.changeVideoLayout(layoutType);

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType,
              main: {width: 300, height: 400},
              content: {width: 700, height: 800},
            });
          });

          it('does not call changeVideoLayoutDebounced if renderInfo main changes only very slightly', async () => {
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1024, height: 768}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 1024, height: 768},
              content: undefined,
            });
            meeting.meetingRequest.changeVideoLayoutDebounced.resetHistory();

            // now send main with width/height different by just 2px - it should be ignored
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1026, height: 768}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1022, height: 768}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1024, height: 770}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1024, height: 766}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);
          });

          it('does not call changeVideoLayoutDebounced if renderInfo content changes only very slightly', async () => {
            meeting.mediaProperties.mediaDirection.receiveShare = true;
            meeting.mediaProperties.remoteShare = sinon.stub().returns({mockTrack: 'mockTrack'});

            await meeting.changeVideoLayout(layoutTypeSingle, {
              main: {width: 500, height: 510},
              content: {width: 1024, height: 768},
            });

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 500, height: 510},
              content: {width: 1024, height: 768},
            });
            meeting.meetingRequest.changeVideoLayoutDebounced.resetHistory();

            // now send main with width/height different by just 2px - it should be ignored
            await meeting.changeVideoLayout(layoutTypeSingle, {
              content: {width: 1026, height: 768},
            });
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {
              content: {width: 1022, height: 768},
            });
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {
              content: {width: 1024, height: 770},
            });
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {
              content: {width: 1024, height: 766},
            });
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);
          });

          it('rounds the width and height values to nearest integers', async () => {
            meeting.mediaProperties.mediaDirection.receiveShare = true;
            meeting.mediaProperties.remoteShare = sinon.stub().returns({mockTrack: 'mockTrack'});

            await meeting.changeVideoLayout(layoutTypeSingle, {
              main: {width: 500.5, height: 510.09},
              content: {width: 1024.2, height: 768.85},
            });

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 501, height: 510},
              content: {width: 1024, height: 769},
            });
          });
        });

        it('should throw error when there is no remote stream', () => {
          const layoutType = 'Equal';

          const mediaDirection = {
            sendAudio: true,
            sendVideo: true,
            sendShare: false,
            receiveVideo: true,
          };

          meeting.mediaProperties.mediaDirection = mediaDirection;
          assert.isRejected(meeting.changeVideoLayout(layoutType));
        });

        it('should throw error when mediaDirection.receiveVideo is false', () => {
          const layoutType = 'Equal';

          const mediaDirection = {
            sendAudio: true,
            sendVideo: true,
            sendShare: false,
            receiveVideo: false,
          };

          meeting.mediaProperties.mediaDirection = mediaDirection;
          meeting.mediaProperties.remoteVideoTrack = sinon.stub().returns({mockTrack: 'mockTrack'});
          assert.isRejected(meeting.changeVideoLayout(layoutType));
        });
      });

      describe('#setRemoteQualityLevel', () => {
        let mediaDirection;

        beforeEach(() => {
          mediaDirection = {receiveAudio: true, receiveVideo: true, receiveShare: false};
          meeting.updateTranscodedMediaConnection = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.mediaDirection = mediaDirection;
        });

        it('should have #setRemoteQualityLevel', () => {
          assert.exists(meeting.setRemoteQualityLevel);
        });

        it('should set mediaProperty with the proper level', () =>
          meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.equal(meeting.mediaProperties.remoteQualityLevel, CONSTANTS.QUALITY_LEVELS.LOW);
          }));

        it('should call Meeting.updateTranscodedMediaConnection()', () =>
          meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.calledOnce(meeting.updateTranscodedMediaConnection);
          }));

        it('should error if set to a invalid level', () => {
          assert.isRejected(meeting.setRemoteQualityLevel('invalid'));
        });

        it('should error if receiveVideo is set to false', () => {
          meeting.mediaProperties.mediaDirection = {receiveVideo: false};
          assert.isRejected(meeting.setRemoteQualityLevel('LOW'));
        });
      });

      describe('#usePhoneAudio', () => {
        beforeEach(() => {
          meeting.meetingRequest.dialIn = sinon
            .stub()
            .returns(Promise.resolve({body: {locus: 'testData'}}));
          meeting.meetingRequest.dialOut = sinon
            .stub()
            .returns(Promise.resolve({body: {locus: 'testData'}}));
        });

        it('with no parameters triggers dial-in, delegating request to meetingRequest correctly', async () => {
          await meeting.usePhoneAudio();
          const DIAL_IN_URL = meeting.dialInUrl;

          assert.calledWith(meeting.meetingRequest.dialIn, {
            correlationId: meeting.correlationId,
            dialInUrl: DIAL_IN_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
          });
          assert.notCalled(meeting.meetingRequest.dialOut);

          meeting.meetingRequest.dialIn.resetHistory();

          // try again. the dial in urls should match
          await meeting.usePhoneAudio();

          assert.calledWith(meeting.meetingRequest.dialIn, {
            correlationId: meeting.correlationId,
            dialInUrl: DIAL_IN_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
          });
          assert.notCalled(meeting.meetingRequest.dialOut);
        });

        it('given a phone number, triggers dial-out, delegating request to meetingRequest correctly', async () => {
          const phoneNumber = '+442088241000';

          await meeting.usePhoneAudio(phoneNumber);
          const DIAL_OUT_URL = meeting.dialOutUrl;

          assert.calledWith(meeting.meetingRequest.dialOut, {
            correlationId: meeting.correlationId,
            dialOutUrl: DIAL_OUT_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
            phoneNumber,
          });
          assert.notCalled(meeting.meetingRequest.dialIn);

          meeting.meetingRequest.dialOut.resetHistory();

          // try again. the dial out urls should match
          await meeting.usePhoneAudio(phoneNumber);

          assert.calledWith(meeting.meetingRequest.dialOut, {
            correlationId: meeting.correlationId,
            dialOutUrl: DIAL_OUT_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
            phoneNumber,
          });
          assert.notCalled(meeting.meetingRequest.dialIn);
        });

        it('rejects if the request failed (dial in)', () => {
          const error = 'something bad happened';

          meeting.meetingRequest.dialIn = sinon.stub().returns(Promise.reject(error));

          return meeting
            .usePhoneAudio()
            .then(() => Promise.reject(new Error('Promise resolved when it should have rejected')))
            .catch((e) => {
              assert.equal(e, error);

              return Promise.resolve();
            });
        });

        it('rejects if the request failed (dial out)', async () => {
          const error = 'something bad happened';

          meeting.meetingRequest.dialOut = sinon.stub().returns(Promise.reject(error));

          return meeting
            .usePhoneAudio('+441234567890')
            .then(() => Promise.reject(new Error('Promise resolved when it should have rejected')))
            .catch((e) => {
              assert.equal(e, error);

              return Promise.resolve();
            });
        });
      });

      describe('#isJoined', () => {
        it('should returns isJoined correctly', () => {
          meeting.joinedWith = undefined;
          assert.equal(meeting.isJoined(), false);

          meeting.joinedWith = {state: 'NOT_JOINED'};
          assert.equal(meeting.isJoined(), false);

          meeting.joinedWith = {state: 'JOINED'};
          assert.equal(meeting.isJoined(), true);
        });
      });

      describe('#fetchMeetingInfo', () => {
        const FAKE_DESTINATION = 'something@somecompany.com';
        const FAKE_TYPE = _SIP_URI_;
        const FAKE_TIMEOUT_FETCHMEETINGINFO_ID = '123456';
        const FAKE_PASSWORD = '123abc';
        const FAKE_CAPTCHA_CODE = 'a1b2c3XYZ';
        const FAKE_CAPTCHA_ID = '987654321';
        const FAKE_CAPTCHA_IMAGE_URL = 'http://captchaimage';
        const FAKE_CAPTCHA_AUDIO_URL = 'http://captchaaudio';
        const FAKE_CAPTCHA_REFRESH_URL = 'http://captcharefresh';
        const FAKE_INSTALLED_ORG_ID = '123456';
        const FAKE_EXTRA_PARAMS = {
          mtid: 'm9fe0afd8c435e892afcce9ea25b97046',
          joinTXId: 'TSmrX61wNF',
        };
        let FAKE_OPTIONS;
        const FAKE_MEETING_INFO = {
          conversationUrl: 'some_convo_url',
          locusUrl: 'some_locus_url',
          sipUrl: 'some_sip_url', // or sipMeetingUri
          meetingNumber: '123456', // this.config.experimental.enableUnifiedMeetings
          hostId: 'some_host_id', // this.owner;
        };
        const FAKE_MEETING_INFO_LOOKUP_URL = 'meetingLookupUrl';

        const FAKE_SDK_CAPTCHA_INFO = {
          captchaId: FAKE_CAPTCHA_ID,
          verificationImageURL: FAKE_CAPTCHA_IMAGE_URL,
          verificationAudioURL: FAKE_CAPTCHA_AUDIO_URL,
          refreshURL: FAKE_CAPTCHA_REFRESH_URL,
        };
        const FAKE_WBXAPPAPI_CAPTCHA_INFO = {
          captchaID: `${FAKE_CAPTCHA_ID}-2`,
          verificationImageURL: `${FAKE_CAPTCHA_IMAGE_URL}-2`,
          verificationAudioURL: `${FAKE_CAPTCHA_AUDIO_URL}-2`,
          refreshURL: `${FAKE_CAPTCHA_REFRESH_URL}-2`,
        };

        beforeEach(() => {
          meeting.locusId = 'locus-id';
          meeting.id = 'meeting-id';
          FAKE_OPTIONS = {meetingId: meeting.id};
        });

        it('calls meetingInfoProvider with all the right parameters and parses the result', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .resolves({body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL}),
          };
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.config.installedOrgID = FAKE_INSTALLED_ORG_ID;
          meeting.parseMeetingInfo = sinon.stub().returns(undefined);

          await meeting.fetchMeetingInfo({
            password: FAKE_PASSWORD,
            captchaCode: FAKE_CAPTCHA_CODE,
            extraParams: FAKE_EXTRA_PARAMS,
          });

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            FAKE_PASSWORD,
            {code: FAKE_CAPTCHA_CODE, id: FAKE_CAPTCHA_ID},
            FAKE_INSTALLED_ORG_ID,
            meeting.locusId,
            FAKE_EXTRA_PARAMS,
            FAKE_OPTIONS
          );

          assert.calledWith(
            meeting.parseMeetingInfo,
            {body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL},
            FAKE_DESTINATION
          );
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
        });

        it('calls meetingInfoProvider with all the right parameters and parses the result when random delay is applied', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .resolves({body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL}),
          };
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.parseMeetingInfo = sinon.stub().returns(undefined);
          meeting.fetchMeetingInfoTimeoutId = FAKE_TIMEOUT_FETCHMEETINGINFO_ID;

          const clock = sinon.useFakeTimers();
          const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

          await meeting.fetchMeetingInfo({});

          // clear timer
          assert.calledWith(clearTimeoutSpy, FAKE_TIMEOUT_FETCHMEETINGINFO_ID);
          clock.restore();
          assert.isUndefined(meeting.fetchMeetingInfoTimeoutId);

          // meeting info provider
          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            null,
            null,
            undefined,
            meeting.locusId,
            {},
            {meetingId: meeting.id}
          );

          // parseMeeting info
          assert.calledWith(
            meeting.parseMeetingInfo,
            {body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL},
            FAKE_DESTINATION
          );

          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
        });

        it('fails if captchaCode is provided when captcha not needed', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .resolves({body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL}),
          };
          meeting.requiredCaptcha = null;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              captchaCode: FAKE_CAPTCHA_CODE,
            }),
            Error,
            'fetchMeetingInfo() called with captchaCode when captcha was not required'
          );

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
        });

        it('fails if password is provided when not required', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .resolves({body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL}),
          };
          meeting.passwordStatus = PASSWORD_STATUS.NOT_REQUIRED;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              password: FAKE_PASSWORD,
            }),
            Error,
            'fetchMeetingInfo() called with password when password was not required'
          );

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
        });

        it('handles meetingInfoProvider requiring password', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2PasswordError(403004, FAKE_MEETING_INFO)),
          };

          await assert.isRejected(meeting.fetchMeetingInfo({}), PasswordError);

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            null,
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.meetingInfoFailureCode, 403004);
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
        });

        it('handles meetingInfoProvider policy error', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2PolicyError(123456, FAKE_MEETING_INFO, 'a message')),
          };

          await assert.isRejected(meeting.fetchMeetingInfo({}), PermissionError);

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            null,
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.meetingInfoFailureCode, 123456);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.POLICY);
        });

        it('handles meetingInfoProvider requiring captcha because of wrong password', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO)),
          };
          meeting.requiredCaptcha = null;

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              password: 'aaa',
            }),
            CaptchaError
          );

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            'aaa',
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, {});
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.meetingInfoFailureCode, 423005);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: FAKE_CAPTCHA_ID,
            verificationImageURL: FAKE_CAPTCHA_IMAGE_URL,
            verificationAudioURL: FAKE_CAPTCHA_AUDIO_URL,
            refreshURL: FAKE_CAPTCHA_REFRESH_URL,
          });
        });

        it('handles meetingInfoProvider requiring captcha because of wrong captcha', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO)),
          };
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              password: 'aaa',
              captchaCode: 'bbb',
            }),
            CaptchaError
          );

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            'aaa',
            {code: 'bbb', id: FAKE_CAPTCHA_ID},
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, {});
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.WRONG_CAPTCHA);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, FAKE_SDK_CAPTCHA_INFO);
        });

        it('handles successful response when good password is passed', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().resolves({
              statusCode: 200,
              body: FAKE_MEETING_INFO,
            }),
          };
          meeting.passwordStatus = PASSWORD_STATUS.REQUIRED;

          await meeting.fetchMeetingInfo({
            password: 'aaa',
          });

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            'aaa',
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: undefined,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.VERIFIED);
          assert.equal(meeting.requiredCaptcha, null);
        });

        it('refreshes captcha when captcha was required and we received 403 error code', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          const refreshedCaptcha = {
            captchaID: FAKE_WBXAPPAPI_CAPTCHA_INFO.captchaID,
            verificationImageURL: FAKE_WBXAPPAPI_CAPTCHA_INFO.verificationImageURL,
            verificationAudioURL: FAKE_WBXAPPAPI_CAPTCHA_INFO.verificationAudioURL,
          };

          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2PasswordError(403004, FAKE_MEETING_INFO)),
          };
          meeting.meetingRequest.refreshCaptcha = sinon.stub().returns(
            Promise.resolve({
              body: refreshedCaptcha,
            })
          );
          meeting.passwordStatus = PASSWORD_STATUS.REQUIRED;
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              password: 'aaa',
              captchaCode: 'bbb',
            })
          );

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            'aaa',
            {code: 'bbb', id: FAKE_CAPTCHA_ID},
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id}
          );

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: refreshedCaptcha.captchaID,
            verificationImageURL: refreshedCaptcha.verificationImageURL,
            verificationAudioURL: refreshedCaptcha.verificationAudioURL,
            refreshURL: FAKE_SDK_CAPTCHA_INFO.refreshURL, // refresh url doesn't change
          });
        });
      });

      describe('#refreshCaptcha', () => {
        it('fails if no captcha required', async () => {
          assert.isRejected(meeting.refreshCaptcha(), Error);
        });
        it('sends correct request to captcha service refresh url', async () => {
          const REFRESH_URL =
            'https://something.webex.com/captchaservice/v1/captchas/refresh?blablabla=something&captchaID=xxx';
          const EXPECTED_REFRESH_URL =
            'https://something.webex.com/captchaservice/v1/captchas/refresh?blablabla=something&captchaID=xxx&siteFullName=something.webex.com';

          const FAKE_SDK_CAPTCHA_INFO = {
            captchaId: 'some id',
            verificationImageURL: 'some image url',
            verificationAudioURL: 'some audio url',
            refreshURL: REFRESH_URL,
          };

          const FAKE_REFRESHED_CAPTCHA = {
            captchaID: 'some id',
            verificationImageURL: 'some image url',
            verificationAudioURL: 'some audio url',
          };

          // setup the meeting so that a captcha is required
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO)),
          };

          await assert.isRejected(
            meeting.fetchMeetingInfo({
              password: '',
            }),
            CaptchaError
          );

          assert.deepEqual(meeting.requiredCaptcha, FAKE_SDK_CAPTCHA_INFO);
          meeting.meetingRequest.refreshCaptcha = sinon
            .stub()
            .returns(Promise.resolve({body: FAKE_REFRESHED_CAPTCHA}));

          // test the captcha refresh
          await meeting.refreshCaptcha();

          assert.calledWith(meeting.meetingRequest.refreshCaptcha, {
            captchaRefreshUrl: EXPECTED_REFRESH_URL,
            captchaId: FAKE_SDK_CAPTCHA_INFO.captchaId,
          });

          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: FAKE_REFRESHED_CAPTCHA.captchaID,
            verificationImageURL: FAKE_REFRESHED_CAPTCHA.verificationImageURL,
            verificationAudioURL: FAKE_REFRESHED_CAPTCHA.verificationAudioURL,
            refreshURL: FAKE_SDK_CAPTCHA_INFO.refreshURL, // refresh url doesn't change
          });
        });
      });

      describe('#verifyPassword', () => {
        it('calls fetchMeetingInfo() with the passed password and captcha code', async () => {
          // simulate successful case
          meeting.fetchMeetingInfo = sinon.stub().resolves();
          const result = await meeting.verifyPassword('password', 'captcha id');

          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.VERIFY_PASSWORD_SUCCESS
          );
          assert.equal(result.isPasswordValid, true);
          assert.equal(result.requiredCaptcha, null);
          assert.equal(result.failureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.calledWith(meeting.fetchMeetingInfo, {
            password: 'password',
            captchaCode: 'captcha id',
          });
        });
        it('handles PasswordError returned by fetchMeetingInfo', async () => {
          meeting.fetchMeetingInfo = sinon.stub().callsFake(() => {
            meeting.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD;

            return Promise.reject(new PasswordError());
          });
          const result = await meeting.verifyPassword('password', 'captcha id');

          assert.equal(result.isPasswordValid, false);
          assert.equal(result.requiredCaptcha, null);
          assert.equal(result.failureReason, MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD);
        });
        it('handles CaptchaError returned by fetchMeetingInfo', async () => {
          const FAKE_CAPTCHA = {captchaId: 'some catcha id...'};

          meeting.fetchMeetingInfo = sinon.stub().callsFake(() => {
            meeting.meetingInfoFailureReason = MEETING_INFO_FAILURE_REASON.WRONG_CAPTCHA;
            meeting.requiredCaptcha = FAKE_CAPTCHA;

            return Promise.reject(new CaptchaError());
          });
          const result = await meeting.verifyPassword('password', 'captcha id');

          assert.equal(result.isPasswordValid, false);
          assert.deepEqual(result.requiredCaptcha, FAKE_CAPTCHA);
          assert.equal(result.failureReason, MEETING_INFO_FAILURE_REASON.WRONG_CAPTCHA);
        });
      });

      describe('#mediaNegotiatedEvent', () => {
        it('should have #mediaNegotiatedEvent', () => {
          assert.exists(meeting.mediaNegotiatedEvent);
        });
        beforeEach(() => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
        });

        it('should trigger `MEDIA_NEGOTIATED`', () => {
          meeting.mediaNegotiatedEvent();

          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'mediaNegotiatedEvent'},
            'media:negotiated'
          );
        });
      });

      describe('#postMetrics', () => {
        it('should have #postMetrics', () => {
          assert.exists(meeting.postMetrics);
        });

        it('should trigger `submitClientEvent`', async () => {
          await meeting.postMetrics('client.call.leave');
          console.log({s: webex.internal.newMetrics.submitClientEvent.getCall(0).args[0]});
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.call.leave',
            options: {meetingId: meeting.id},
          });
        });
      });

      describe('#endMeeting for all', () => {
        let sandbox;

        it('should have #endMeetingForAll', () => {
          assert.exists(meeting.endMeetingForAll);
        });

        it('should reject if meeting is already ended', async () => {
          await meeting.endMeetingForAll().catch((err) => {
            assert.instanceOf(err, MeetingNotActiveError);
          });
        });
        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.meetingFiniteStateMachine.ring();
          meeting.meetingFiniteStateMachine.join();
          meeting.meetingRequest.endMeetingForAll = sinon
            .stub()
            .returns(Promise.resolve({body: 'test'}));
          meeting.locusInfo.onFullLocus = sinon.stub().returns(true);
          meeting.cleanupLocalTracks = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteTracks').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetRemoteTracks = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetPeerConnections = sinon.stub().returns(true);
          meeting.logger.error = sinon.stub().returns(true);
          meeting.updateLLMConnection = sinon.stub().returns(Promise.resolve());

          // A meeting needs to be joined to end
          meeting.meetingState = 'ACTIVE';
          meeting.state = 'JOINED';
        });
        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });
        it('should end the meeting for all and return promise', async () => {
          const endMeetingForAll = meeting.endMeetingForAll();

          assert.exists(endMeetingForAll.then);
          await endMeetingForAll;
          assert.calledOnce(meeting?.meetingRequest?.endMeetingForAll);
          assert.calledOnce(meeting?.cleanupLocalTracks);
          assert.calledOnce(meeting?.closeRemoteTracks);
          assert.calledOnce(meeting?.closePeerConnections);
          assert.calledOnce(meeting?.unsetRemoteTracks);
          assert.calledOnce(meeting?.unsetPeerConnections);
        });
      });

      describe('#moveTo', () => {
        let sandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          sandbox.stub(meeting, 'cleanupLocalTracks');

          sandbox.stub(meeting.mediaProperties, 'setMediaDirection');

          sandbox.stub(meeting.reconnectionManager, 'reconnectMedia').returns(Promise.resolve());
          sandbox
            .stub(MeetingUtil, 'joinMeeting')
            .returns(
              Promise.resolve(MeetingUtil.parseLocusJoin({body: {locus, mediaConnections: []}}))
            );
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should throw an error if resourceId not passed', async () => {
          try {
            await meeting.moveTo();
          } catch (err) {
            assert.instanceOf(err, ParameterError);
            assert.equal(err.sdkMessage, 'Cannot move call without a resourceId.');
          }
        });

        it('should submitClientEvent on moveTo ', async () => {
          await meeting.moveTo('resourceId');
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.media.capabilities',
            payload: {
              mediaCapabilities: {
                rx: {
                  audio: false,
                  share: true,
                  share_audio: false,
                  video: false,
                  whiteboard: false,
                },
                tx: {
                  audio: false,
                  share: false,
                  share_audio: false,
                  video: false,
                  whiteboard: false,
                },
              },
            },
            options: {meetingId: meeting.id},
          });
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.call.move-media',
            options: {meetingId: meeting.id},
          });
        });

        it('should call `MeetingUtil.joinMeetingOptions` with resourceId', async () => {
          sinon.spy(MeetingUtil, 'joinMeetingOptions');
          await meeting.moveTo('resourceId');

          assert.calledWith(MeetingUtil.joinMeetingOptions, meeting, {
            resourceId: 'resourceId',
            moveToResource: true,
          });
        });

        it('should reconnectMedia after DX joins after moveTo', async () => {
          await meeting.moveTo('resourceId');

          await meeting.locusInfo.emitScoped(
            {
              file: 'locus-info',
              function: 'updateSelf',
            },
            'SELF_OBSERVING'
          );

          // beacuse we are calling callback so we need to wait

          assert.called(meeting.cleanupLocalTracks);

          // give queued Promise callbacks a chance to run
          await Promise.resolve();

          assert.called(meeting.mediaProperties.setMediaDirection);

          assert.calledWith(meeting.reconnectionManager.reconnectMedia, {
            mediaDirection: {
              sendVideo: false,
              receiveVideo: false,
              sendAudio: false,
              receiveAudio: false,
              sendShare: false,
              receiveShare: true,
            },
          });
        });

        it('should throw an error if moveTo call fails', async () => {
          MeetingUtil.joinMeeting = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveTo('resourceId');
          } catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.MOVE_TO_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: sinon.match.any,
              stack: sinon.match.any,
            });
          }
          Metrics.sendBehavioralMetric.reset();
          meeting.reconnectionManager.reconnectMedia = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveTo('resourceId');

            await meeting.locusInfo.emitScoped(
              {
                file: 'locus-info',
                function: 'updateSelf',
              },
              'SELF_OBSERVING'
            );
          } catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.MOVE_TO_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: sinon.match.any,
              stack: sinon.match.any,
            });
          }
        });
      });

      describe('#moveFrom', () => {
        let sandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          sandbox
            .stub(MeetingUtil, 'joinMeeting')
            .returns(
              Promise.resolve(MeetingUtil.parseLocusJoin({body: {locus, mediaConnections: []}}))
            );
          sandbox.stub(MeetingUtil, 'leaveMeeting').returns(Promise.resolve());
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should throw an error if resourceId not passed', async () => {
          try {
            await meeting.moveFrom();
          } catch (err) {
            assert.instanceOf(err, ParameterError);

            assert.equal(err.sdkMessage, 'Cannot move call without a resourceId.');
          }
        });

        it('should submitClientEvent on moveFrom ', async () => {
          await meeting.moveFrom('resourceId');

          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.call.move-media',
            options: {meetingId: meeting.id},
          });
        });

        it('should call `MeetingUtil.joinMeetingOptions` with resourceId', async () => {
          sinon.spy(MeetingUtil, 'joinMeetingOptions');
          await meeting.moveFrom('resourceId');

          assert.calledWith(MeetingUtil.joinMeetingOptions, meeting);
          assert.calledWith(MeetingUtil.leaveMeeting, meeting, {
            resourceId: 'resourceId',
            correlationId: meeting.correlationId,
            moveMeeting: true,
          });

          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.MOVE_FROM_SUCCESS);
        });

        it('should throw an error if moveFrom call fails', async () => {
          MeetingUtil.joinMeeting = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveFrom('resourceId');
          } catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.MOVE_FROM_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: sinon.match.any,
              stack: sinon.match.any,
            });
          }
        });
      });
      describe('Local tracks publishing', () => {
        let audioTrack;
        let videoTrack;
        let audioShareTrack;
        let videoShareTrack;
        let createMuteStateStub;
        let LocalDisplayTrackConstructorStub;
        let LocalMicrophoneTrackConstructorStub;
        let LocalCameraTrackConstructorStub;
        let fakeLocalDisplayTrack;
        let fakeLocalMicrophoneTrack;
        let fakeLocalCameraTrack;

        beforeEach(() => {
          audioTrack = {
            id: 'audio track',
            getSettings: sinon.stub().returns({}),
            on: sinon.stub(),
            off: sinon.stub(),
          };
          videoTrack = {
            id: 'video track',
            getSettings: sinon.stub().returns({}),
            on: sinon.stub(),
            off: sinon.stub(),
          };
          audioShareTrack = {
            id: 'share track',
            on: sinon.stub(),
            off: sinon.stub(),
            getSettings: sinon.stub(),
          };
          videoShareTrack = {
            id: 'share track',
            on: sinon.stub(),
            off: sinon.stub(),
            getSettings: sinon.stub().returns({}),
          };
          meeting.requestScreenShareFloor = sinon.stub().resolves({});
          meeting.releaseScreenShareFloor = sinon.stub().resolves({});
          meeting.mediaProperties.mediaDirection = {
            sendAudio: 'fake value', // using non-boolean here so that we can check that these values are untouched in tests
            sendVideo: 'fake value',
            sendShare: false,
          };
          meeting.isMultistream = true;
          meeting.mediaProperties.webrtcMediaConnection = {
            publishTrack: sinon.stub().resolves({}),
            unpublishTrack: sinon.stub().resolves({}),
          };
          meeting.audio = {handleLocalTrackChange: sinon.stub()};
          meeting.video = {handleLocalTrackChange: sinon.stub()};

          const createFakeLocalTrack = (originalTrack) => ({
            on: sinon.stub(),
            off: sinon.stub(),
            stop: sinon.stub(),
            originalTrack,
          });

          // setup mock constructors for webrtc-core local track classes in such a way
          // that they return the original track correctly (this is needed for unpublish() API tests)
          LocalDisplayTrackConstructorStub = sinon
            .stub(InternalMediaCoreModule, 'LocalDisplayTrack')
            .callsFake((stream) => {
              fakeLocalDisplayTrack = createFakeLocalTrack(stream.getTracks()[0]);
              return fakeLocalDisplayTrack;
            });
          LocalMicrophoneTrackConstructorStub = sinon
            .stub(InternalMediaCoreModule, 'LocalMicrophoneTrack')
            .callsFake((stream) => {
              fakeLocalMicrophoneTrack = createFakeLocalTrack(stream.getTracks()[0]);
              return fakeLocalMicrophoneTrack;
            });
          LocalCameraTrackConstructorStub = sinon
            .stub(InternalMediaCoreModule, 'LocalCameraTrack')
            .callsFake((stream) => {
              fakeLocalCameraTrack = createFakeLocalTrack(stream.getTracks()[0]);
              return fakeLocalCameraTrack;
            });

          createMuteStateStub = sinon
            .stub(MuteStateModule, 'createMuteState')
            .returns({id: 'fake mute state instance'});
        });
        describe('#publishTracks', () => {
          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(meeting.publishTracks({audio: {id: 'some audio track'}}));
          });

          const checkAudioPublished = (track) => {
            assert.calledOnceWithExactly(meeting.audio.handleLocalTrackChange, meeting);
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, track);
            assert.equal(meeting.mediaProperties.audioTrack, track);
            // check that sendAudio hasn't been touched
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, 'fake value');
          };

          const checkVideoPublished = (track) => {
            assert.calledOnceWithExactly(meeting.video.handleLocalTrackChange, meeting);
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, track);
            assert.equal(meeting.mediaProperties.videoTrack, track);
            // check that sendVideo hasn't been touched
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, 'fake value');
          };

          const checkScreenShareVideoPublished = (track) => {
            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, track);
            assert.equal(meeting.mediaProperties.shareVideoTrack, track);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, true);
          };

          const checkScreenShareAudioPublished = (track) => {
            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, track);
            assert.equal(meeting.mediaProperties.shareAudioTrack, track);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, true);
          };

          it('requests screen share floor and publishes the screen share video track', async () => {
            await meeting.publishTracks({screenShare: {video: videoShareTrack}});

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkScreenShareVideoPublished(videoShareTrack);
          });

          it('requests screen share floor and publishes the screen share audio track', async () => {
            await meeting.publishTracks({screenShare: {audio: audioShareTrack}});

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkScreenShareAudioPublished(audioShareTrack);
          });

          it('does not request screen share floor when publishing video share track if already sharing audio', async () => {
            await meeting.publishTracks({screenShare: {audio: audioShareTrack}});
            assert.calledOnce(meeting.requestScreenShareFloor);

            meeting.requestScreenShareFloor.reset();
            await meeting.publishTracks({screenShare: {video: videoShareTrack}});
            assert.notCalled(meeting.requestScreenShareFloor);
          });

          it('does not request screen share floor when publishing audio share track if already sharing video', async () => {
            await meeting.publishTracks({screenShare: {video: videoShareTrack}});
            assert.calledOnce(meeting.requestScreenShareFloor);

            meeting.requestScreenShareFloor.reset();
            await meeting.publishTracks({screenShare: {audio: audioShareTrack}});
            assert.notCalled(meeting.requestScreenShareFloor);
          });

          it('updates MuteState instance and publishes the track for main audio', async () => {
            await meeting.publishTracks({microphone: audioTrack});

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkAudioPublished(audioTrack);
          });

          it('updates MuteState instance and publishes the track for main video', async () => {
            await meeting.publishTracks({camera: videoTrack});

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkVideoPublished(videoTrack);
          });

          it('publishes audio, video and screen share together', async () => {
            await meeting.publishTracks({
              microphone: audioTrack,
              camera: videoTrack,
              screenShare: {
                video: videoShareTrack,
                audio: audioShareTrack,
              },
            });

            assert.callCount(meeting.mediaProperties.webrtcMediaConnection.publishTrack, 4);
            checkAudioPublished(audioTrack);
            checkVideoPublished(videoTrack);
            checkScreenShareVideoPublished(videoShareTrack);
            checkScreenShareAudioPublished(audioShareTrack);
          });
        });
        it('creates instance and publishes with annotation info', async () => {
          const annotationInfo = {
            version: '1',
            policy: ANNOTATION_POLICY.APPROVAL,
          };
          await meeting.publishTracks({annotationInfo});
          assert.equal(meeting.annotationInfo, annotationInfo);
        });

        describe('unpublishTracks', () => {
          beforeEach(async () => {
            await meeting.publishTracks({
              microphone: audioTrack,
              camera: videoTrack,
              screenShare: {video: videoShareTrack, audio: audioShareTrack},
            });
          });

          const checkAudioUnpublished = () => {
            assert.calledWith(
              meeting.mediaProperties.webrtcMediaConnection.unpublishTrack,
              audioTrack
            );

            assert.equal(meeting.mediaProperties.audioTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, 'fake value');
          };

          const checkVideoUnpublished = () => {
            assert.calledWith(
              meeting.mediaProperties.webrtcMediaConnection.unpublishTrack,
              videoTrack
            );

            assert.equal(meeting.mediaProperties.videoTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, 'fake value');
          };

          // share direction will remain true if only one of the two share tracks are unpublished
          const checkScreenShareVideoUnpublished = (shareDirection = true) => {
            assert.calledWith(
              meeting.mediaProperties.webrtcMediaConnection.unpublishTrack,
              videoShareTrack
            );

            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.equal(meeting.mediaProperties.shareVideoTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, shareDirection);
          };

          // share direction will remain true if only one of the two share tracks are unpublished
          const checkScreenShareAudioUnpublished = (shareDirection = true) => {
            assert.calledWith(
              meeting.mediaProperties.webrtcMediaConnection.unpublishTrack,
              audioShareTrack
            );

            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.equal(meeting.mediaProperties.shareAudioTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, shareDirection);
          };

          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(
              meeting.unpublishTracks([audioTrack, videoTrack, videoShareTrack, audioShareTrack])
            );
          });

          it('un-publishes the tracks correctly (all 4 together)', async () => {
            await meeting.unpublishTracks([
              audioTrack,
              videoTrack,
              videoShareTrack,
              audioShareTrack,
            ]);

            assert.equal(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack.callCount, 4);
            checkAudioUnpublished();
            checkVideoUnpublished();
            checkScreenShareVideoUnpublished(false);
            checkScreenShareAudioUnpublished(false);
          });

          it('un-publishes the audio track correctly', async () => {
            await meeting.unpublishTracks([audioTrack]);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkAudioUnpublished();
          });

          it('un-publishes the video track correctly', async () => {
            await meeting.unpublishTracks([videoTrack]);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkVideoUnpublished();
          });

          it('un-publishes the screen share video track correctly', async () => {
            await meeting.unpublishTracks([videoShareTrack]);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkScreenShareVideoUnpublished();
          });

          it('un-publishes the screen share audio track correctly', async () => {
            await meeting.unpublishTracks([audioShareTrack]);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkScreenShareAudioUnpublished();
          });

          it('releases share floor and sets send direction to false when both screen share tracks are undefined', async () => {
            await meeting.unpublishTracks([videoShareTrack, audioShareTrack]);

            assert.calledOnce(meeting.releaseScreenShareFloor);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, false);
          });

          it('does not release share floor when audio is released and video still exists', async () => {
            await meeting.unpublishTracks([audioShareTrack]);
            assert.notCalled(meeting.releaseScreenShareFloor);
          });

          it('does not release share floor when video is released and audio still exists', async () => {
            await meeting.unpublishTracks([videoShareTrack]);
            assert.notCalled(meeting.releaseScreenShareFloor);
          });
        });
      });
    });

    describe('#enableMusicMode', () => {
      beforeEach(() => {
        meeting.isMultistream = true;
        meeting.mediaProperties.webrtcMediaConnection = {
          setCodecParameters: sinon.stub().resolves({}),
          deleteCodecParameters: sinon.stub().resolves({}),
        };
      });
      [{shouldEnableMusicMode: true}, {shouldEnableMusicMode: false}].forEach(
        ({shouldEnableMusicMode}) => {
          it(`fails if there is no media connection for shouldEnableMusicMode: ${shouldEnableMusicMode}`, async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(meeting.enableMusicMode(shouldEnableMusicMode));
          });
        }
      );

      it('should set the codec parameters when shouldEnableMusicMode is true', async () => {
        await meeting.enableMusicMode(true);
        assert.calledOnceWithExactly(
          meeting.mediaProperties.webrtcMediaConnection.setCodecParameters,
          MediaType.AudioMain,
          {
            maxaveragebitrate: '64000',
            maxplaybackrate: '48000',
          }
        );
        assert.notCalled(meeting.mediaProperties.webrtcMediaConnection.deleteCodecParameters);
      });

      it('should set the codec parameters when shouldEnableMusicMode is false', async () => {
        await meeting.enableMusicMode(false);
        assert.calledOnceWithExactly(
          meeting.mediaProperties.webrtcMediaConnection.deleteCodecParameters,
          MediaType.AudioMain,
          ['maxaveragebitrate', 'maxplaybackrate']
        );
        assert.notCalled(meeting.mediaProperties.webrtcMediaConnection.setCodecParameters);
      });
    });

    describe('Public Event Triggers', () => {
      let sandbox;
      const {ENDED} = CONSTANTS;

      beforeEach(() => {
        const fakeMediaTrack = () => ({stop: () => {}, readyState: ENDED});

        sandbox = sinon.createSandbox();
        sandbox.stub(Media, 'stopTracks').returns(Promise.resolve());
        sandbox.stub(meeting.mediaProperties, 'audioTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'videoTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'shareVideoTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'shareAudioTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'remoteAudioTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'remoteVideoTrack').value(fakeMediaTrack());
        sandbox.stub(meeting.mediaProperties, 'remoteShare').value(fakeMediaTrack());
      });
      afterEach(() => {
        sandbox.restore();
        sandbox = null;
      });

      describe('#reconnect', () => {
        it('should have #reconnect', () => {
          assert.exists(meeting.reconnect);
        });
        describe('successful reconnect', () => {
          beforeEach(() => {
            meeting.config.reconnection.enabled = true;
            meeting.currentMediaStatus = {audio: true};
            meeting.reconnectionManager = new ReconnectionManager(meeting);
            meeting.reconnectionManager.reconnect = sinon.stub().returns(Promise.resolve());
            meeting.reconnectionManager.reset = sinon.stub().returns(true);
            meeting.reconnectionManager.cleanup = sinon.stub().returns(true);
          });

          it('should throw error if media not established before trying reconenct', async () => {
            meeting.currentMediaStatus = null;
            await meeting.reconnect().catch((err) => {
              assert.instanceOf(err, ParameterError);
            });
          });

          it('should trigger reconnection success', async () => {
            await meeting.reconnect();
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {file: 'meeting/index', function: 'reconnect'},
              'meeting:reconnectionSuccess'
            );
          });

          it('should reset after reconnection success', async () => {
            await meeting.reconnect();
            assert.calledOnce(meeting.reconnectionManager.reset);
          });
        });

        describe('unsuccessful reconnect', () => {
          beforeEach(() => {
            meeting.config.reconnection.enabled = true;
            meeting.currentMediaStatus = {audio: true};
            meeting.reconnectionManager = new ReconnectionManager(meeting);
            meeting.reconnectionManager.reconnect = sinon
              .stub()
              .returns(Promise.reject(new Error()));
            meeting.reconnectionManager.reset = sinon.stub().returns(true);
          });

          it('should trigger an unsuccessful reconnection', async () => {
            await assert.isRejected(meeting.reconnect());
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {file: 'meeting/index', function: 'reconnect'},
              'meeting:reconnectionFailure',
              {error: sinon.match.any}
            );
          });

          it('should send metrics on reconnect failure', async () => {
            await assert.isRejected(meeting.reconnect());
            assert(Metrics.sendBehavioralMetric.calledOnce);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.MEETING_RECONNECT_FAILURE,
              {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: sinon.match.any,
                stack: sinon.match.any,
              }
            );
          });

          it('should upload logs on reconnect failure', async () => {
            await assert.isRejected(meeting.reconnect());
            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {file: 'meeting/index', function: 'reconnect'},
              EVENTS.REQUEST_UPLOAD_LOGS,
              sinon.match.instanceOf(Meeting)
            );
          });

          it('should reset after an unsuccessful reconnection', async () => {
            await assert.isRejected(meeting.reconnect());
            assert.calledOnce(meeting.reconnectionManager.reset);
          });
        });
      });
      describe('#closeRemoteStream', () => {
        it('should stop remote tracks, and trigger a media:stopped event when the remote tracks are stopped', async () => {
          await meeting.closeRemoteTracks();

          assert.equal(TriggerProxy.trigger.callCount, 4);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteTracks'},
            'media:stopped',
            {type: 'remoteAudio'}
          );
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteTracks'},
            'media:stopped',
            {type: 'remoteVideo'}
          );
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteTracks'},
            'media:stopped',
            {type: 'remoteShare'}
          );
        });
      });
      describe('#setupMediaConnectionListeners', () => {
        let eventListeners;

        beforeEach(() => {
          eventListeners = {};
          meeting.statsAnalyzer = {startAnalyzer: sinon.stub()};
          meeting.mediaProperties.webrtcMediaConnection = {
            // mock the on() method and store all the listeners
            on: sinon.stub().callsFake((event, listener) => {
              eventListeners[event] = listener;
            }),
          };
          MediaUtil.createMediaStream.returns({id: 'stream'});
        });

        it('should register for all the correct RoapMediaConnection events', () => {
          meeting.setupMediaConnectionListeners();
          assert.isFunction(eventListeners[Event.ROAP_STARTED]);
          assert.isFunction(eventListeners[Event.ROAP_DONE]);
          assert.isFunction(eventListeners[Event.ROAP_FAILURE]);
          assert.isFunction(eventListeners[Event.ROAP_MESSAGE_TO_SEND]);
          assert.isFunction(eventListeners[Event.REMOTE_TRACK_ADDED]);
          assert.isFunction(eventListeners[Event.CONNECTION_STATE_CHANGED]);
        });

        it('should trigger a media:ready event when REMOTE_TRACK_ADDED is fired', () => {
          meeting.setupMediaConnectionListeners();
          eventListeners[Event.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.AUDIO,
          });
          assert.equal(TriggerProxy.trigger.getCall(1).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(1).args[3], {
            type: 'remoteAudio',
            stream: {id: 'stream'},
          });

          eventListeners[Event.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.VIDEO,
          });
          assert.equal(TriggerProxy.trigger.getCall(2).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(2).args[3], {
            type: 'remoteVideo',
            stream: {id: 'stream'},
          });

          eventListeners[Event.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.SCREENSHARE_VIDEO,
          });
          assert.equal(TriggerProxy.trigger.getCall(3).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(3).args[3], {
            type: 'remoteShare',
            stream: {id: 'stream'},
          });
        });

        describe('submitClientEvent on connectionFailed', () => {
          it('sends client.ice.end when connectionFailed on CONNECTION_STATE_CHANGED event', () => {
            webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
              sinon.stub().returns({});
            meeting.setupMediaConnectionListeners();
            eventListeners[Event.CONNECTION_STATE_CHANGED]({
              state: 'Failed',
            });
            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.ice.end',
              payload: {
                canProceed: false,
                icePhase: 'IN_MEETING',
                errors: [{}],
              },
              options: {
                meetingId: meeting.id,
              },
            });
          });
        });

        describe('should send correct metrics for ROAP_FAILURE event', () => {
          const fakeErrorMessage = 'test error';
          const fakeRootCauseName = 'root cause name';
          const fakeErrorName = 'test error name';

          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
          });

          const checkMetricSent = (event, error) => {
            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: event,
              payload: {
                canProceed: false,
              },
              options: {showToUser: true, rawError: error, meetingId: meeting.id},
            });
          };

          const checkBehavioralMetricSent = (
            metricName,
            expectedCode,
            expectedReason,
            expectedMetadataType
          ) => {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              metricName,
              {
                code: expectedCode,
                correlation_id: meeting.correlationId,
                reason: expectedReason,
                stack: sinon.match.any,
              },
              {
                type: expectedMetadataType,
              }
            );
          };

          it('should send metrics for SdpOfferCreationError error', () => {
            const fakeError = new Errors.SdpOfferCreationError(fakeErrorMessage, {
              name: fakeErrorName,
              cause: {name: fakeRootCauseName},
            });

            eventListeners[Event.ROAP_FAILURE](fakeError);

            checkMetricSent('client.media-engine.local-sdp-generated', fakeError);
            checkBehavioralMetricSent(
              BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE,
              Errors.ErrorCode.SdpOfferCreationError,
              fakeErrorMessage,
              fakeRootCauseName
            );
          });

          it('should send metrics for SdpOfferHandlingError error', () => {
            const fakeError = new Errors.SdpOfferHandlingError(fakeErrorMessage, {
              name: fakeErrorName,
              cause: {name: fakeRootCauseName},
            });

            eventListeners[Event.ROAP_FAILURE](fakeError);

            checkMetricSent('client.media-engine.remote-sdp-received', fakeError);
            checkBehavioralMetricSent(
              BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE,
              Errors.ErrorCode.SdpOfferHandlingError,
              fakeErrorMessage,
              fakeRootCauseName
            );
          });

          it('should send metrics for SdpAnswerHandlingError error', () => {
            const fakeError = new Errors.SdpAnswerHandlingError(fakeErrorMessage, {
              name: fakeErrorName,
              cause: {name: fakeRootCauseName},
            });

            eventListeners[Event.ROAP_FAILURE](fakeError);

            checkMetricSent('client.media-engine.remote-sdp-received', fakeError);
            checkBehavioralMetricSent(
              BEHAVIORAL_METRICS.PEERCONNECTION_FAILURE,
              Errors.ErrorCode.SdpAnswerHandlingError,
              fakeErrorMessage,
              fakeRootCauseName
            );
          });

          it('should send metrics for SdpError error', () => {
            // SdpError is usually without a cause
            const fakeError = new Errors.SdpError(fakeErrorMessage, {name: fakeErrorName});

            eventListeners[Event.ROAP_FAILURE](fakeError);

            checkMetricSent('client.media-engine.local-sdp-generated', fakeError);
            // expectedMetadataType is the error name in this case
            checkBehavioralMetricSent(
              BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE,
              Errors.ErrorCode.SdpError,
              fakeErrorMessage,
              fakeErrorName
            );
          });

          it('should send metrics for IceGatheringError error', () => {
            // IceGatheringError is usually without a cause
            const fakeError = new Errors.IceGatheringError(fakeErrorMessage, {
              name: fakeErrorName,
            });

            eventListeners[Event.ROAP_FAILURE](fakeError);

            checkMetricSent('client.media-engine.local-sdp-generated', fakeError);
            // expectedMetadataType is the error name in this case
            checkBehavioralMetricSent(
              BEHAVIORAL_METRICS.INVALID_ICE_CANDIDATE,
              Errors.ErrorCode.IceGatheringError,
              fakeErrorMessage,
              fakeErrorName
            );
          });
        });

        describe('handles Event.ROAP_MESSAGE_TO_SEND correctly', () => {
          let sendRoapOKStub;
          let sendRoapMediaRequestStub;
          let sendRoapAnswerStub;
          let sendRoapErrorStub;

          beforeEach(() => {
            sendRoapOKStub = sinon.stub(meeting.roap, 'sendRoapOK').resolves({});
            sendRoapMediaRequestStub = sinon
              .stub(meeting.roap, 'sendRoapMediaRequest')
              .resolves({});
            sendRoapAnswerStub = sinon.stub(meeting.roap, 'sendRoapAnswer').resolves({});
            sendRoapErrorStub = sinon.stub(meeting.roap, 'sendRoapError').resolves({});

            meeting.setupMediaConnectionListeners();
          });

          it('handles OK message correctly', () => {
            eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {messageType: 'OK', seq: 1},
            });

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.remote-sdp-received',
              options: {meetingId: meeting.id},
            });

            assert.calledOnce(sendRoapOKStub);
            assert.calledWith(sendRoapOKStub, {
              seq: 1,
              mediaId: meeting.mediaId,
              correlationId: meeting.correlationId,
            });
          });

          it('handles OFFER message correctly', () => {
            eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'OFFER',
                seq: 1,
                sdp: 'fake sdp',
                tieBreaker: 12345,
              },
            });

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.local-sdp-generated',
              options: {meetingId: meeting.id},
            });

            assert.calledOnce(sendRoapMediaRequestStub);
            assert.calledWith(sendRoapMediaRequestStub, {
              seq: 1,
              sdp: 'fake sdp',
              tieBreaker: 12345,
              meeting,
              reconnect: false,
            });
          });

          it('handles ANSWER message correctly', () => {
            eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'ANSWER',
                seq: 10,
                sdp: 'fake sdp answer',
                tieBreaker: 12345,
              },
            });

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.remote-sdp-received',
              options: {meetingId: meeting.id},
            });

            assert.calledOnce(sendRoapAnswerStub);
            assert.calledWith(sendRoapAnswerStub, {
              seq: 10,
              sdp: 'fake sdp answer',
              mediaId: meeting.mediaId,
              correlationId: meeting.correlationId,
            });
          });

          it('sends metrics if fails to send roap ANSWER message', async () => {
            sendRoapAnswerStub.rejects(new Error('sending answer failed'));

            await eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'ANSWER',
                seq: 10,
                sdp: 'fake sdp answer',
                tieBreaker: 12345,
              },
            });
            await testUtils.flushPromises();

            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWithMatch(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.ROAP_ANSWER_FAILURE,
              {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: 'sending answer failed',
              }
            );
          });

          [ErrorType.CONFLICT, ErrorType.DOUBLECONFLICT].forEach((errorType) =>
            it(`handles ERROR message indicating glare condition correctly (errorType=${errorType})`, () => {
              eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
                roapMessage: {
                  messageType: 'ERROR',
                  seq: 10,
                  errorType,
                  tieBreaker: 12345,
                },
              });

              assert.calledOnce(Metrics.sendBehavioralMetric);
              assert.calledWithMatch(
                Metrics.sendBehavioralMetric,
                BEHAVIORAL_METRICS.ROAP_GLARE_CONDITION,
                {
                  correlation_id: meeting.correlationId,
                  locus_id: meeting.locusUrl.split('/').pop(),
                  sequence: 10,
                }
              );

              assert.calledOnce(sendRoapErrorStub);
              assert.calledWith(sendRoapErrorStub, {
                seq: 10,
                errorType,
                mediaId: meeting.mediaId,
                correlationId: meeting.correlationId,
              });
            })
          );

          it('handles ERROR message indicating other errors correctly', () => {
            eventListeners[Event.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'ERROR',
                seq: 10,
                errorType: ErrorType.FAILED,
                tieBreaker: 12345,
              },
            });

            assert.notCalled(Metrics.sendBehavioralMetric);

            assert.calledOnce(sendRoapErrorStub);
            assert.calledWith(sendRoapErrorStub, {
              seq: 10,
              errorType: ErrorType.FAILED,
              mediaId: meeting.mediaId,
              correlationId: meeting.correlationId,
            });
          });
        });

        describe('audio and video source count change events', () => {
          beforeEach(() => {
            TriggerProxy.trigger.resetHistory();
            meeting.setupMediaConnectionListeners();
          });

          it('registers for audio and video source count changed', () => {
            assert.isFunction(eventListeners[Event.VIDEO_SOURCES_COUNT_CHANGED]);
            assert.isFunction(eventListeners[Event.AUDIO_SOURCES_COUNT_CHANGED]);
          });

          it('forwards the VIDEO_SOURCES_COUNT_CHANGED event as "media:remoteVideoSourceCountChanged"', () => {
            const numTotalSources = 10;
            const numLiveSources = 6;
            const mediaContent = 'SLIDES';

            sinon.stub(meeting.mediaRequestManagers.video, 'setNumCurrentSources');

            eventListeners[Event.VIDEO_SOURCES_COUNT_CHANGED](
              numTotalSources,
              numLiveSources,
              mediaContent
            );

            assert.calledOnceWithExactly(
              TriggerProxy.trigger,
              meeting,
              sinon.match.object,
              'media:remoteVideoSourceCountChanged',
              {
                numTotalSources,
                numLiveSources,
                mediaContent,
              }
            );
          });

          it('forwards the AUDIO_SOURCES_COUNT_CHANGED event as "media:remoteAudioSourceCountChanged"', () => {
            const numTotalSources = 5;
            const numLiveSources = 2;
            const mediaContent = 'MAIN';

            eventListeners[Event.AUDIO_SOURCES_COUNT_CHANGED](
              numTotalSources,
              numLiveSources,
              mediaContent
            );

            assert.calledOnceWithExactly(
              TriggerProxy.trigger,
              meeting,
              sinon.match.object,
              'media:remoteAudioSourceCountChanged',
              {
                numTotalSources,
                numLiveSources,
                mediaContent,
              }
            );
          });

          it('calls setNumCurrentSources() when receives VIDEO_SOURCES_COUNT_CHANGED event for MAIN', () => {
            const numTotalSources = 20;
            const numLiveSources = 10;

            const setNumCurrentSourcesSpy = sinon.stub(
              meeting.mediaRequestManagers.video,
              'setNumCurrentSources'
            );

            eventListeners[Event.VIDEO_SOURCES_COUNT_CHANGED](
              numTotalSources,
              numLiveSources,
              'MAIN'
            );

            assert.calledOnceWithExactly(setNumCurrentSourcesSpy, numTotalSources, numLiveSources);
          });

          it('does not call setNumCurrentSources() when receives VIDEO_SOURCES_COUNT_CHANGED event for SLIDES', () => {
            const numTotalSources = 20;
            const numLiveSources = 10;

            const setNumCurrentSourcesSpy = sinon.stub(
              meeting.mediaRequestManagers.video,
              'setNumCurrentSources'
            );

            eventListeners[Event.VIDEO_SOURCES_COUNT_CHANGED](
              numTotalSources,
              numLiveSources,
              'SLIDES'
            );

            assert.notCalled(setNumCurrentSourcesSpy);
          });
        });
      });
      describe('#setUpLocusInfoSelfListener', () => {
        it('listens to the self unadmitted guest event', (done) => {
          meeting.startKeepAlive = sinon.stub();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_UNADMITTED_GUEST', test1);
          assert.calledOnceWithExactly(meeting.startKeepAlive);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            'meeting:self:lobbyWaiting',
            {payload: test1}
          );
          done();
        });
        it('listens to the self admitted guest event', (done) => {
          meeting.stopKeepAlive = sinon.stub();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_ADMITTED_GUEST', test1);
          assert.calledOnceWithExactly(meeting.stopKeepAlive);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            'meeting:self:guestAdmitted',
            {payload: test1}
          );
          done();
        });

        it('listens to the breakouts changed event', () => {
          meeting.breakouts.updateBreakoutSessions = sinon.stub();

          const payload = 'payload';

          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'SELF_MEETING_BREAKOUTS_CHANGED',
            payload
          );

          assert.calledOnceWithExactly(meeting.breakouts.updateBreakoutSessions, payload);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
          );
        });

        it('listens to the self roles changed event', () => {
          const payload = {oldRoles: [], newRoles: ['COHOST', 'MODERATOR']};
          meeting.breakouts.updateCanManageBreakouts = sinon.stub();
          meeting.simultaneousInterpretation.updateCanManageInterpreters = sinon.stub();

          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_ROLES_CHANGED', payload);

          assert.calledOnceWithExactly(meeting.breakouts.updateCanManageBreakouts, true);
          assert.calledOnceWithExactly(
            meeting.simultaneousInterpretation.updateCanManageInterpreters,
            true
          );
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            EVENT_TRIGGERS.MEETING_SELF_ROLES_CHANGED,
            {payload}
          );
        });

        it('listens to the interpretation changed event', () => {
          meeting.simultaneousInterpretation.updateSelfInterpretation = sinon.stub();

          const payload = 'payload';

          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'SELF_MEETING_INTERPRETATION_CHANGED',
            payload
          );

          assert.calledOnceWithExactly(
            meeting.simultaneousInterpretation.updateSelfInterpretation,
            payload
          );
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            EVENT_TRIGGERS.MEETING_INTERPRETATION_UPDATE
          );
        });
      });

      describe('#setUpBreakoutsListener', () => {
        it('listens to the closing event from breakouts and triggers the closing event', () => {
          TriggerProxy.trigger.reset();
          meeting.breakouts.trigger('BREAKOUTS_CLOSING');

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_CLOSING
          );
        });

        it('listens to the message event from breakouts and triggers the message event', () => {
          TriggerProxy.trigger.reset();

          const messageEvent = 'message';

          meeting.breakouts.trigger('MESSAGE', messageEvent);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_MESSAGE,
            messageEvent
          );
        });

        it('listens to the members update event from breakouts and triggers the breakouts update event', () => {
          TriggerProxy.trigger.reset();
          meeting.breakouts.trigger('MEMBERS_UPDATE');

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
          );
        });

        it('should not trigger ASK_RETURN_TO_MAIN before joined', () => {
          TriggerProxy.trigger.reset();
          meeting.joinedWith = {state: 'NOT_JOINED'};
          meeting.breakouts.trigger('ASK_RETURN_TO_MAIN');
          assert.notCalled(TriggerProxy.trigger);
        });

        it('listens to the ask return to main event from breakouts and triggers the ask return to main event from meeting', () => {
          TriggerProxy.trigger.reset();
          meeting.joinedWith = {state: 'JOINED'};
          meeting.breakouts.trigger('ASK_RETURN_TO_MAIN');
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_RETURN_TO_MAIN
          );
        });

        it('listens to the leave event from breakouts and triggers the breakout leave event', () => {
          TriggerProxy.trigger.reset();
          meeting.breakouts.trigger('LEAVE_BREAKOUT');
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_LEAVE
          );
        });

        it('listens to the breakout ask for help event and triggers the ask for help event', () => {
          TriggerProxy.trigger.reset();
          const helpEvent = {sessionId: 'sessionId', participant: 'participant'};
          meeting.breakouts.trigger('ASK_FOR_HELP', helpEvent);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_ASK_FOR_HELP,
            helpEvent
          );
        });

        it('listens to the preAssignments update event from breakouts and triggers the update event', () => {
          TriggerProxy.trigger.reset();
          meeting.breakouts.trigger('PRE_ASSIGNMENTS_UPDATE');

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpBreakoutsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_PRE_ASSIGNMENTS_UPDATE
          );
        });
      });

      describe('#setupLocusControlsListener', () => {
        it('listens to the locus breakouts update event', () => {
          const locus = {
            breakout: 'breakout',
          };

          meeting.breakouts.updateBreakout = sinon.stub();
          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_MEETING_BREAKOUT_UPDATED',
            locus
          );

          assert.calledOnceWithExactly(meeting.breakouts.updateBreakout, locus.breakout);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
          );
        });

        it('listens to CONTROLS_MUTE_ON_ENTRY_CHANGED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_MUTE_ON_ENTRY_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_MUTE_ON_ENTRY_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_SHARE_CONTROL_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_SHARE_CONTROL_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_SHARE_CONTROL_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_DISALLOW_UNMUTE_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_DISALLOW_UNMUTE_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_DISALLOW_UNMUTE_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_REACTIONS_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_REACTIONS_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_REACTIONS_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_VIEW_THE_PARTICIPANTS_LIST_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_VIEW_THE_PARTICIPANTS_LIST_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_VIEW_THE_PARTICIPANTS_LIST_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_RAISE_HAND_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_RAISE_HAND_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_RAISE_HAND_UPDATED,
            {state}
          );
        });

        it('listens to MEETING_CONTROLS_VIDEO_UPDATED', async () => {
          const state = {example: 'value'};

          await meeting.locusInfo.emitScoped(
            {function: 'test', file: 'test'},
            LOCUSINFO.EVENTS.CONTROLS_VIDEO_CHANGED,
            {state}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_CONTROLS_VIDEO_UPDATED,
            {state}
          );
        });

        it('listens to the timing that user joined into breakout', async () => {
          const mainLocusUrl = 'mainLocusUrl123';

          meeting.meetingRequest.getLocusStatusByUrl = sinon.stub().returns(Promise.resolve());

          await meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_JOIN_BREAKOUT_FROM_MAIN',
            {mainLocusUrl}
          );

          assert.calledOnceWithExactly(meeting.meetingRequest.getLocusStatusByUrl, mainLocusUrl);
          const error = {statusCode: 403};
          meeting.meetingRequest.getLocusStatusByUrl.rejects(error);
          meeting.locusInfo.clearMainSessionLocusCache = sinon.stub();
          await meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_JOIN_BREAKOUT_FROM_MAIN',
            {mainLocusUrl}
          );

          assert.calledOnce(meeting.locusInfo.clearMainSessionLocusCache);

          const otherError = new Error('something wrong');
          meeting.meetingRequest.getLocusStatusByUrl.rejects(otherError);
          meeting.locusInfo.clearMainSessionLocusCache = sinon.stub();
          await meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_JOIN_BREAKOUT_FROM_MAIN',
            {mainLocusUrl}
          );

          assert.notCalled(meeting.locusInfo.clearMainSessionLocusCache);
        });

        it('listens to the locus interpretation update event', () => {
          const interpretation = {
            siLanguages: [{languageCode: 20, languageName: 'en'}],
          };

          meeting.simultaneousInterpretation.updateInterpretation = sinon.stub();
          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_MEETING_INTERPRETATION_UPDATED',
            {interpretation}
          );

          assert.calledOnceWithExactly(
            meeting.simultaneousInterpretation.updateInterpretation,
            interpretation
          );
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_INTERPRETATION_UPDATE
          );
        });
      });

      describe('#setUpLocusUrlListener', () => {
        it('listens to the locus url update event', (done) => {
          const newLocusUrl = 'newLocusUrl/12345';

          meeting.members = {locusUrlUpdate: sinon.stub().returns(Promise.resolve(test1))};
          meeting.recordingController = {setLocusUrl: sinon.stub().returns(undefined)};
          meeting.controlsOptionsManager = {setLocusUrl: sinon.stub().returns(undefined)};

          meeting.breakouts.locusUrlUpdate = sinon.stub();
          meeting.annotation.locusUrlUpdate = sinon.stub();
          meeting.simultaneousInterpretation.locusUrlUpdate = sinon.stub();

          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'LOCUS_INFO_UPDATE_URL',
            newLocusUrl
          );
          assert.calledWith(meeting.members.locusUrlUpdate, newLocusUrl);
          assert.calledOnceWithExactly(meeting.breakouts.locusUrlUpdate, newLocusUrl);
          assert.calledOnceWithExactly(meeting.annotation.locusUrlUpdate, newLocusUrl);
          assert.calledWith(meeting.members.locusUrlUpdate, newLocusUrl);
          assert.calledWith(meeting.recordingController.setLocusUrl, newLocusUrl);
          assert.calledWith(meeting.controlsOptionsManager.setLocusUrl, newLocusUrl);
          assert.calledWith(meeting.simultaneousInterpretation.locusUrlUpdate, newLocusUrl);
          assert.equal(meeting.locusUrl, newLocusUrl);
          assert(meeting.locusId, '12345');
          done();
        });
      });

      describe('#setUpLocusServicesListener', () => {
        it('listens to the locus services update event', (done) => {
          const newLocusServices = {
            services: {
              record: {
                url: 'url',
              },
              approval: {
                url: 'url',
              },
            },
          };

          meeting.recordingController = {
            setServiceUrl: sinon.stub().returns(undefined),
            setSessionId: sinon.stub().returns(undefined),
          };
          meeting.annotation = {
            approvalUrlUpdate: sinon.stub().returns(undefined),
          };
          meeting.simultaneousInterpretation = {
            approvalUrlUpdate: sinon.stub().returns(undefined),
          };

          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'LINKS_SERVICES',
            newLocusServices
          );

          assert.calledWith(
            meeting.recordingController.setServiceUrl,
            newLocusServices.services.record.url
          );
          assert.calledWith(
            meeting.annotation.approvalUrlUpdate,
            newLocusServices.services.approval.url
          );
          assert.calledWith(
            meeting.simultaneousInterpretation.approvalUrlUpdate,
            newLocusServices.services.approval.url
          );
          assert.calledOnce(meeting.recordingController.setSessionId);
          done();
        });
      });

      describe('#setUpLocusInfoMediaInactiveListener', () => {
        it('listens to disconnect due to un activity ', (done) => {
          TriggerProxy.trigger.reset();
          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            EVENTS.DISCONNECT_DUE_TO_INACTIVITY,
            {reason: 'inactive'}
          );
          assert.calledTwice(TriggerProxy.trigger);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoMediaInactiveListener'},
            EVENTS.REQUEST_UPLOAD_LOGS,
            meeting
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoMediaInactiveListener'},
            EVENT_TRIGGERS.MEETING_SELF_LEFT,
            'inactive'
          );

          done();
        });

        it('listens to disconnect due to in activity and rejoin', (done) => {
          TriggerProxy.trigger.reset();
          sinon.stub(meeting, 'reconnect');

          meeting.config.reconnection.autoRejoin = true;
          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            EVENTS.DISCONNECT_DUE_TO_INACTIVITY,
            {reason: 'inactive'}
          );
          assert.calledOnce(TriggerProxy.trigger);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoMediaInactiveListener'},
            EVENTS.REQUEST_UPLOAD_LOGS,
            meeting
          );

          assert.calledOnce(meeting.reconnect);

          meeting.reconnect.restore();

          done();
        });
      });

      describe('#setUpLocusInfoMeetingListener', () => {
        it('listens to destroy meeting event from locus info  ', (done) => {
          TriggerProxy.trigger.reset();
          sinon.stub(meeting.reconnectionManager, 'cleanUp');
          sinon.spy(MeetingUtil, 'cleanUp');

          meeting.locusInfo.emit({function: 'test', file: 'test'}, EVENTS.DESTROY_MEETING, {
            shouldLeave: false,
            reason: 'ended',
          });
          assert.calledOnce(TriggerProxy.trigger);
          assert.calledOnce(MeetingUtil.cleanUp);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoMeetingListener',
            },
            EVENTS.DESTROY_MEETING,
            {
              reason: 'ended',
              meetingId: meeting.id,
            }
          );
          done();
        });
      });

      describe('#setUpInterpretationListener', () => {
        it('listens to the support languages update event from interpretation and triggers the update event', () => {
          TriggerProxy.trigger.reset();
          meeting.simultaneousInterpretation.trigger('SUPPORT_LANGUAGES_UPDATE');

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpInterpretationListener'},
            EVENT_TRIGGERS.MEETING_INTERPRETATION_SUPPORT_LANGUAGES_UPDATE
          );
        });

        it('listens to the handoff request event from interpretation and triggers the update event', () => {
          TriggerProxy.trigger.reset();
          const payload = {};
          meeting.simultaneousInterpretation.trigger('HANDOFF_REQUESTS_ARRIVED', payload);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpInterpretationListener'},
            EVENT_TRIGGERS.MEETING_INTERPRETATION_HANDOFF_REQUESTS_ARRIVED,
            payload
          );
        });
      });
    });
    describe('Private Detailed API and Helpers', () => {
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(meeting.mediaProperties, 'unsetRemoteTracks').returns(Promise.resolve());
      });

      afterEach(() => {
        sandbox.restore();
        sandbox = null;
      });

      describe('#releaseScreenShareFloor', () => {
        it('should have #releaseScreenShareFloor', () => {
          assert.exists(meeting.releaseScreenShareFloor);
        });
        beforeEach(() => {
          meeting.selfId = 'some self id';
          meeting.locusInfo.mediaShares = [
            {name: 'content', url: url1, floor: {beneficiary: {id: meeting.selfId}}},
          ];
          meeting.locusInfo.self = {url: url2};
          meeting.mediaProperties = {mediaDirection: {sendShare: true}};
          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
        });
        it('should call changeMeetingFloor()', async () => {
          meeting.screenShareFloorState = 'GRANTED';
          const share = meeting.releaseScreenShareFloor();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
        });
        it('should not call changeMeetingFloor() if someone else already has the floor', async () => {
          // change selfId so that it doesn't match the beneficiary id from meeting.locusInfo.mediaShares
          meeting.selfId = 'new self id';

          const share = meeting.releaseScreenShareFloor();

          assert.exists(share.then);
          await share;
          assert.notCalled(meeting.meetingRequest.changeMeetingFloor);
        });
      });

      describe('#setSipUri', () => {
        it('should set the sip Uri and return null', () => {
          assert.notOk(meeting.sipUri);
          meeting.setSipUri(test1);
          assert.equal(meeting.sipUri, test1);
        });
      });

      describe('#setSelfUserPolicies', () => {
        it('sets correctly when policy data is present in token', () => {
          assert.notOk(meeting.selfUserPolicies);

          const dummyToken = 'some data';
          const policyData = {permission: {userPolicies: {a: true}}};

          sinon.stub(jwt, 'decode').returns(policyData);

          meeting.setSelfUserPolicies(dummyToken);

          assert.deepEqual(meeting.selfUserPolicies, {a: true});
        });

        it('handles missing permission data', () => {
          assert.notOk(meeting.selfUserPolicies);

          const dummyToken = 'some data';
          const policyData = {};

          sinon.stub(jwt, 'decode').returns(policyData);

          meeting.setSelfUserPolicies(dummyToken);

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });

        it('handles missing policy data', () => {
          assert.notOk(meeting.selfUserPolicies);

          const dummyToken = 'some data';
          const policyData = {permission: {}};

          sinon.stub(jwt, 'decode').returns(policyData);

          meeting.setSelfUserPolicies(dummyToken);

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });

        it('handles missing token', () => {
          assert.notOk(meeting.selfUserPolicies);

          meeting.setSelfUserPolicies();

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });
      });

      describe('#unsetRemoteTracks', () => {
        it('should unset the remote tracks and return null', () => {
          meeting.mediaProperties.unsetRemoteTracks = sinon.stub().returns(true);
          meeting.unsetRemoteTracks();
          assert.calledOnce(meeting.mediaProperties.unsetRemoteTracks);
        });
      });
      // TODO: remove
      describe('#setMercuryListener', () => {
        it('should listen to mercury events', () => {
          meeting.reconnect = sinon.stub().returns(true);
          meeting.webex.internal.mercury.on = sinon.stub().returns(true);
          meeting.setMercuryListener(test1, test2);
          assert.instanceOf(meeting.reconnectionManager, ReconnectionManager);
          assert.calledTwice(meeting.webex.internal.mercury.on);
        });
      });
      describe('#closePeerConnections', () => {
        it('should close the webrtc media connection, and return a promise', async () => {
          meeting.mediaProperties.webrtcMediaConnection = {close: sinon.stub()};
          const pcs = meeting.closePeerConnections();

          assert.exists(pcs.then);
          await pcs;
          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.close);
        });
      });
      describe('#unsetPeerConnections', () => {
        it('should unset the peer connections', () => {
          meeting.mediaProperties.unsetPeerConnection = sinon.stub().returns(true);
          meeting.webex.internal.mercury.off = sinon.stub().returns(true);
          meeting.unsetPeerConnections();
          assert.calledOnce(meeting.mediaProperties.unsetPeerConnection);
        });
      });

      describe('#parseMeetingInfo', () => {
        const checkParseMeetingInfo = (expectedInfoToParse) => {
          assert.equal(meeting.conversationUrl, expectedInfoToParse.conversationUrl);
          assert.equal(meeting.locusUrl, expectedInfoToParse.locusUrl);
          assert.equal(meeting.sipUri, expectedInfoToParse.sipUri);
          assert.equal(meeting.meetingNumber, expectedInfoToParse.meetingNumber);
          assert.equal(meeting.meetingJoinUrl, expectedInfoToParse.meetingJoinUrl);
          assert.equal(meeting.owner, expectedInfoToParse.owner);
          assert.equal(meeting.permissionToken, expectedInfoToParse.permissionToken);
          assert.deepEqual(meeting.selfUserPolicies, expectedInfoToParse.selfUserPolicies);
        };

        it('should parse meeting info from api return when locus meeting object is not available, set values, and return null', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_MEETING_INFO = {
            body: {
              conversationUrl: uuid1,
              locusUrl: url1,
              meetingJoinUrl: url2,
              meetingNumber: '12345',
              permissionToken:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX0sImlhdCI6MTY4OTE2NDEwMn0.9uL_U7QUdYyMerrgHC_gCKOax2j_bz04u8Ikbv9KiXU',
              sipMeetingUri: test1,
              sipUrl: test1,
              owner: test2,
            },
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            selfUserPolicies: {a: true},
            permissionToken:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX0sImlhdCI6MTY4OTE2NDEwMn0.9uL_U7QUdYyMerrgHC_gCKOax2j_bz04u8Ikbv9KiXU',
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse meeting info from locus meeting object if possible, else from api return, set values, and return null', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_LOCUS_MEETING = {
            conversationUrl: 'locusConvURL',
            url: 'locusUrl',
            info: {
              webExMeetingId: 'locusMeetingId',
              sipUri: 'locusSipUri',
              owner: 'locusOwner',
            },
          };
          const FAKE_MEETING_INFO = {
            body: {
              conversationUrl: uuid1,
              locusUrl: url1,
              meetingJoinUrl: url2,
              meetingNumber: '12345',
              permissionToken: 'abc',
              sipMeetingUri: test1,
              sipUrl: test1,
              owner: test2,
            },
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_LOCUS_MEETING);
          const expectedInfoToParse = {
            conversationUrl: 'locusConvURL',
            locusUrl: 'locusUrl',
            sipUri: 'locusSipUri',
            meetingNumber: 'locusMeetingId',
            meetingJoinUrl: url2,
            owner: 'locusOwner',
            permissionToken: 'abc',
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse meeting info from api return, set values, and return null', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_MEETING_INFO = {
            body: {
              conversationUrl: uuid1,
              locusUrl: url1,
              meetingJoinUrl: url2,
              meetingNumber: '12345',
              permissionToken: 'abc',
              sipMeetingUri: test1,
              sipUrl: test1,
              owner: test2,
            },
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken: 'abc',
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse meeting info, set values, and return null when destination is a string', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_STRING_DESTINATION = 'sipUrl';
          const FAKE_MEETING_INFO = {
            body: {
              conversationUrl: uuid1,
              locusUrl: url1,
              meetingJoinUrl: url2,
              meetingNumber: '12345',
              permissionToken: 'abc',
              sipMeetingUri: test1,
              sipUrl: test1,
              owner: test2,
            },
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_STRING_DESTINATION);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken: 'abc',
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse interpretation info correctly', () => {
          const parseInterpretationInfo = sinon.spy(MeetingUtil, 'parseInterpretationInfo');
          const mockToggleOnData = {
            body: {
              meetingSiteSetting: {
                enableHostInterpreterControlSI: true,
              },
              turnOnSimultaneousInterpretation: true,
              simultaneousInterpretation: {
                currentSIInterpreter: false,
                siLanguages: [
                  {
                    languageCode: 'ar',
                    languageGroupId: 4,
                  },
                ],
              },
            },
          };
          meeting.parseMeetingInfo(mockToggleOnData);
          assert.calledOnceWithExactly(parseInterpretationInfo, meeting, mockToggleOnData.body);
        });
      });

      describe('#setCorrelationId', () => {
        it('should set the correlationId and return undefined', () => {
          assert.ok(meeting.correlationId);
          meeting.setCorrelationId(uuid1);
          assert.equal(meeting.correlationId, uuid1);
        });
      });

      describe('#setUpLocusInfoAssignHostListener', () => {
        let locusInfoOnSpy;
        let inMeetingActionsSetSpy;

        beforeEach(() => {
          locusInfoOnSpy = sinon.spy(meeting.locusInfo, 'on');
          inMeetingActionsSetSpy = sinon.spy(meeting.inMeetingActions, 'set');
        });

        afterEach(() => {
          locusInfoOnSpy.restore();
          inMeetingActionsSetSpy.restore();
        });

        it('registers the correct event', () => {
          meeting.setUpLocusInfoAssignHostListener();

          assert.calledOnce(locusInfoOnSpy);

          assert.equal(locusInfoOnSpy.firstCall.args[0], 'LOCUS_INFO_CAN_ASSIGN_HOST');
          const callback = locusInfoOnSpy.firstCall.args[1];

          const payload = {canAssignHost: true};

          callback(payload);

          assert.calledWith(inMeetingActionsSetSpy, payload);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoAssignHostListener',
            },
            'meeting:actionsUpdate',
            meeting.inMeetingActions.get()
          );

          TriggerProxy.trigger.resetHistory();

          callback(payload);

          assert.notCalled(TriggerProxy.trigger);
        });
      });

      describe('#setUpLocusInfoMeetingInfoListener', () => {
        let locusInfoOnSpy;
        let inMeetingActionsSetSpy;
        let canUserLockSpy;
        let canUserUnlockSpy;
        let canUserStartSpy;
        let canUserStopSpy;
        let canUserPauseSpy;
        let canUserResumeSpy;
        let canSetMuteOnEntrySpy;
        let canUnsetMuteOnEntrySpy;
        let canSetDisallowUnmuteSpy;
        let canUnsetDisallowUnmuteSpy;
        let canUserRaiseHandSpy;
        let bothLeaveAndEndMeetingAvailableSpy;
        let canUserLowerAllHandsSpy;
        let canUserLowerSomeoneElsesHandSpy;
        let waitingForOthersToJoinSpy;
        let handleDataChannelUrlChangeSpy;
        let canSendReactionsSpy;
        let canUserRenameSelfAndObservedSpy;
        let canUserRenameOthersSpy;
        let canShareWhiteBoardSpy;
        let hasHintsSpy;

        beforeEach(() => {
          locusInfoOnSpy = sinon.spy(meeting.locusInfo, 'on');
          canUserLockSpy = sinon.spy(MeetingUtil, 'canUserLock');
          canUserUnlockSpy = sinon.spy(MeetingUtil, 'canUserUnlock');
          canUserStartSpy = sinon.spy(RecordingUtil, 'canUserStart');
          canUserStopSpy = sinon.spy(RecordingUtil, 'canUserStop');
          canUserPauseSpy = sinon.spy(RecordingUtil, 'canUserPause');
          canUserResumeSpy = sinon.spy(RecordingUtil, 'canUserResume');
          canSetMuteOnEntrySpy = sinon.spy(ControlsOptionsUtil, 'canSetMuteOnEntry');
          canUnsetMuteOnEntrySpy = sinon.spy(ControlsOptionsUtil, 'canUnsetMuteOnEntry');
          canSetDisallowUnmuteSpy = sinon.spy(ControlsOptionsUtil, 'canSetDisallowUnmute');
          canUnsetDisallowUnmuteSpy = sinon.spy(ControlsOptionsUtil, 'canUnsetDisallowUnmute');
          inMeetingActionsSetSpy = sinon.spy(meeting.inMeetingActions, 'set');
          canUserRaiseHandSpy = sinon.spy(MeetingUtil, 'canUserRaiseHand');
          canUserLowerAllHandsSpy = sinon.spy(MeetingUtil, 'canUserLowerAllHands');
          bothLeaveAndEndMeetingAvailableSpy = sinon.spy(
            MeetingUtil,
            'bothLeaveAndEndMeetingAvailable'
          );
          canUserLowerSomeoneElsesHandSpy = sinon.spy(MeetingUtil, 'canUserLowerSomeoneElsesHand');
          waitingForOthersToJoinSpy = sinon.spy(MeetingUtil, 'waitingForOthersToJoin');
          handleDataChannelUrlChangeSpy = sinon.spy(meeting, 'handleDataChannelUrlChange');
          canSendReactionsSpy = sinon.spy(MeetingUtil, 'canSendReactions');
          canUserRenameSelfAndObservedSpy = sinon.spy(MeetingUtil, 'canUserRenameSelfAndObserved');
          canUserRenameOthersSpy = sinon.spy(MeetingUtil, 'canUserRenameOthers');
          canShareWhiteBoardSpy = sinon.spy(MeetingUtil, 'canShareWhiteBoard');
        });

        afterEach(() => {
          locusInfoOnSpy.restore();
          inMeetingActionsSetSpy.restore();
          waitingForOthersToJoinSpy.restore();
        });

        forEach(
          [
            {
              actionName: 'canShareApplication',
              callType: 'CALL',
              expectedEnabled: true,
            },
            {
              actionName: 'canShareApplication',
              callType: 'MEETING',
              expectedEnabled: false,
            },
            {
              actionName: 'canShareDesktop',
              callType: 'CALL',
              expectedEnabled: true,
            },
            {
              actionName: 'canShareDesktop',
              callType: 'MEETING',
              expectedEnabled: false,
            },
            {
              actionName: 'canShareContent',
              callType: 'CALL',
              expectedEnabled: true,
            },
            {
              actionName: 'canShareContent',
              callType: 'MEETING',
              expectedEnabled: false,
            },
          ],
          ({actionName, callType, expectedEnabled}) => {
            it(`${actionName} is ${expectedEnabled} when the call type is ${callType}`, () => {
              meeting.type = callType;
              meeting.setUpLocusInfoMeetingInfoListener();

              const callback = locusInfoOnSpy.thirdCall.args[1];

              const payload = {
                info: {
                  userDisplayHints: [],
                },
              };

              callback(payload);

              assert.equal(meeting.inMeetingActions.get()[actionName], expectedEnabled);
            });
          }
        );

        forEach(
          [
            {
              actionName: 'canShareFile',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_FILE],
              requiredPolicies: [SELF_POLICY.SUPPORT_FILE_SHARE],
            },
            {
              actionName: 'canShareApplication',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_APPLICATION],
              requiredPolicies: [SELF_POLICY.SUPPORT_APP_SHARE],
            },
            {
              actionName: 'canShareCamera',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_CAMERA],
              requiredPolicies: [SELF_POLICY.SUPPORT_CAMERA_SHARE],
            },
            {
              actionName: 'canBroadcastMessageToBreakout',
              requiredDisplayHints: [DISPLAY_HINTS.BROADCAST_MESSAGE_TO_BREAKOUT],
              requiredPolicies: [SELF_POLICY.SUPPORT_BROADCAST_MESSAGE],
            },
            {
              actionName: 'canShareDesktop',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_DESKTOP],
              requiredPolicies: [SELF_POLICY.SUPPORT_DESKTOP_SHARE],
            },
            {
              actionName: 'canTransferFile',
              requiredDisplayHints: [],
              requiredPolicies: [SELF_POLICY.SUPPORT_FILE_TRANSFER],
            },
            {
              actionName: 'canShareDesktop',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_DESKTOP],
              requiredPolicies: [],
              enableUnifiedMeetings: false,
            },
            {
              actionName: 'canShareApplication',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_APPLICATION],
              requiredPolicies: [],
              enableUnifiedMeetings: false,
            },
            {
              actionName: 'canAnnotate',
              requiredDisplayHints: [],
              requiredPolicies: [SELF_POLICY.SUPPORT_ANNOTATION],
            },
          ],
          ({actionName, requiredDisplayHints, requiredPolicies, enableUnifiedMeetings}) => {
            it(`${actionName} is enabled when the conditions are met`, () => {
              meeting.selfUserPolicies = {};

              meeting.config.experimental.enableUnifiedMeetings = isUndefined(enableUnifiedMeetings)
                ? true
                : enableUnifiedMeetings;

              forEach(requiredPolicies, (policy) => {
                meeting.selfUserPolicies[policy] = true;
              });

              meeting.setUpLocusInfoMeetingInfoListener();

              const callback = locusInfoOnSpy.thirdCall.args[1];

              const payload = {
                info: {
                  userDisplayHints: requiredDisplayHints,
                },
              };

              callback(payload);

              assert.isTrue(meeting.inMeetingActions.get()[actionName]);
            });

            if (requiredDisplayHints.length !== 0) {
              it(`${actionName} is disabled when the required display hints are missing`, () => {
                meeting.selfUserPolicies = {};

                forEach(requiredPolicies, (policy) => {
                  meeting.selfUserPolicies[policy] = true;
                });

                meeting.setUpLocusInfoMeetingInfoListener();

                const callback = locusInfoOnSpy.thirdCall.args[1];

                const payload = {
                  info: {
                    userDisplayHints: [],
                  },
                };

                callback(payload);

                assert.isFalse(meeting.inMeetingActions.get()[actionName]);
              });
            }

            it(`${actionName} is disabled when the required policies are missing`, () => {
              meeting.selfUserPolicies = {};

              meeting.setUpLocusInfoMeetingInfoListener();

              const callback = locusInfoOnSpy.thirdCall.args[1];

              const payload = {
                info: {
                  userDisplayHints: requiredDisplayHints,
                },
              };

              callback(payload);

              assert.isFalse(meeting.inMeetingActions.get()[actionName]);
            });
          }
        );

        it('registers the correct MEETING_INFO_UPDATED event', () => {
          // Due to import tree issues, hasHints must be stubed within the scope of the `it`.
          const restorableHasHints = ControlsOptionsUtil.hasHints;
          ControlsOptionsUtil.hasHints = sinon.stub().returns(true);
          ControlsOptionsUtil.hasPolicies = sinon.stub().returns(true);

          const setUserPolicySpy = sinon.spy(meeting.recordingController, 'setUserPolicy');
          meeting.selfUserPolicies = {a: true};

          meeting.setUpLocusInfoMeetingInfoListener();

          assert.calledThrice(locusInfoOnSpy);

          assert.equal(locusInfoOnSpy.firstCall.args[0], 'MEETING_LOCKED');
          assert.equal(locusInfoOnSpy.secondCall.args[0], 'MEETING_UNLOCKED');
          assert.equal(locusInfoOnSpy.thirdCall.args[0], 'MEETING_INFO_UPDATED');
          const callback = locusInfoOnSpy.thirdCall.args[1];

          const payload = {
            info: {
              userDisplayHints: ['LOCK_CONTROL_UNLOCK'],
              datachannelUrl: 'some url',
            },
          };

          callback(payload);

          assert.calledWith(canUserLockSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserUnlockSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserStartSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserStopSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserPauseSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserResumeSpy, payload.info.userDisplayHints);
          assert.calledWith(canSetMuteOnEntrySpy, payload.info.userDisplayHints);
          assert.calledWith(canUnsetMuteOnEntrySpy, payload.info.userDisplayHints);
          assert.calledWith(canSetDisallowUnmuteSpy, payload.info.userDisplayHints);
          assert.calledWith(canUnsetDisallowUnmuteSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserRaiseHandSpy, payload.info.userDisplayHints);
          assert.calledWith(bothLeaveAndEndMeetingAvailableSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserLowerAllHandsSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserLowerSomeoneElsesHandSpy, payload.info.userDisplayHints);
          assert.calledWith(waitingForOthersToJoinSpy, payload.info.userDisplayHints);
          assert.calledWith(handleDataChannelUrlChangeSpy, payload.info.datachannelUrl);
          assert.calledWith(canSendReactionsSpy, null, payload.info.userDisplayHints);
          assert.calledWith(canUserRenameSelfAndObservedSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserRenameOthersSpy, payload.info.userDisplayHints);
          assert.calledWith(canShareWhiteBoardSpy, payload.info.userDisplayHints);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.MUTE_ALL],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.UNMUTE_ALL],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_HARD_MUTE],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_HARD_MUTE],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_REACTIONS],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_REACTIONS],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_SHOW_DISPLAY_NAME],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CONTROL],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_FILE],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_FILE_SHARE],
            policies: {a: true},
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_APPLICATION],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_APP_SHARE],
            policies: {a: true},
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CAMERA],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_CAMERA_SHARE],
            policies: {a: true},
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_DESKTOP],
            displayHints: payload.info.userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_DESKTOP_SHARE],
            policies: {a: true},
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CONTENT],
            displayHints: payload.info.userDisplayHints,
          });

          assert.calledWith(setUserPolicySpy, {a: true});

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoMeetingInfoListener',
            },
            'meeting:actionsUpdate',
            meeting.inMeetingActions.get()
          );

          TriggerProxy.trigger.resetHistory();

          callback(payload);

          assert.notCalled(TriggerProxy.trigger);

          ControlsOptionsUtil.hasHints = restorableHasHints;
        });
      });

      describe('#handleDataChannelUrlChange', () => {
        let updateLLMConnectionSpy;

        beforeEach(() => {
          updateLLMConnectionSpy = sinon.spy(meeting, 'updateLLMConnection');
        });

        const check = async (url, expectedCalled) => {
          meeting.handleDataChannelUrlChange(url);

          assert.notCalled(updateLLMConnectionSpy);

          await testUtils.waitUntil(0);

          if (expectedCalled) {
            assert.calledWith(updateLLMConnectionSpy);
          } else {
            assert.notCalled(updateLLMConnectionSpy);
          }
        };

        it('calls deferred updateLLMConnection if datachannelURL is set and the enableAutomaticLLM is true', async () => {
          meeting.config.enableAutomaticLLM = true;
          check('some url', true);
        });

        it('does not call updateLLMConnection if datachannelURL is undefined', async () => {
          meeting.config.enableAutomaticLLM = true;
          check(undefined, false);
        });

        it('does not call updateLLMConnection if enableAutomaticLLM is false', async () => {
          check('some url', false);
        });
      });

      describe('#updateLLMConnection', () => {
        beforeEach(() => {
          webex.internal.llm.isConnected = sinon.stub().returns(false);
          webex.internal.llm.getLocusUrl = sinon.stub();
          webex.internal.llm.registerAndConnect = sinon
            .stub()
            .returns(Promise.resolve('something'));
          webex.internal.llm.disconnectLLM = sinon.stub().returns(Promise.resolve());
          meeting.webex.internal.llm.on = sinon.stub();
          meeting.webex.internal.llm.off = sinon.stub();
          meeting.processRelayEvent = sinon.stub();
        });

        it('does not connect if the call is not joined yet', async () => {
          meeting.joinedWith = {state: 'any other state'};
          webex.internal.llm.getLocusUrl.returns('a url');

          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.notCalled(webex.internal.llm.registerAndConnect);
          assert.notCalled(webex.internal.llm.disconnectLLM);
          assert.equal(result, undefined);
          assert.notCalled(meeting.webex.internal.llm.on);
        });

        it('returns undefined if llm is already connected and the locus url is unchanged', async () => {
          meeting.joinedWith = {state: 'JOINED'};
          webex.internal.llm.isConnected.returns(true);
          webex.internal.llm.getLocusUrl.returns('a url');

          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.notCalled(webex.internal.llm.registerAndConnect);
          assert.notCalled(webex.internal.llm.disconnectLLM);
          assert.equal(result, undefined);
          assert.notCalled(meeting.webex.internal.llm.on);
        });

        it('connects if not already connected', async () => {
          meeting.joinedWith = {state: 'JOINED'};
          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.notCalled(webex.internal.llm.disconnectLLM);
          assert.calledWith(webex.internal.llm.registerAndConnect, 'a url', 'a datachannel url');
          assert.equal(result, 'something');
          assert.calledOnceWithExactly(
            meeting.webex.internal.llm.off,
            'event:relay.event',
            meeting.processRelayEvent
          );
          assert.calledOnceWithExactly(
            meeting.webex.internal.llm.on,
            'event:relay.event',
            meeting.processRelayEvent
          );
        });

        it('disconnects if first if the locus url has changed', async () => {
          meeting.joinedWith = {state: 'JOINED'};
          webex.internal.llm.isConnected.returns(true);
          webex.internal.llm.getLocusUrl.returns('a url');

          meeting.locusInfo = {url: 'a different url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.calledWith(webex.internal.llm.disconnectLLM);
          assert.calledWith(
            webex.internal.llm.registerAndConnect,
            'a different url',
            'a datachannel url'
          );
          assert.equal(result, 'something');
          assert.calledWithExactly(
            meeting.webex.internal.llm.off,
            'event:relay.event',
            meeting.processRelayEvent
          );
          assert.calledTwice(meeting.webex.internal.llm.off);
          assert.calledOnceWithExactly(
            meeting.webex.internal.llm.on,
            'event:relay.event',
            meeting.processRelayEvent
          );
        });

        it('disconnects when the state is not JOINED', async () => {
          meeting.joinedWith = {state: 'any other state'};
          webex.internal.llm.isConnected.returns(true);
          webex.internal.llm.getLocusUrl.returns('a url');

          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.calledWith(webex.internal.llm.disconnectLLM);
          assert.notCalled(webex.internal.llm.registerAndConnect);
          assert.equal(result, undefined);
          assert.calledOnceWithExactly(
            meeting.webex.internal.llm.off,
            'event:relay.event',
            meeting.processRelayEvent
          );
        });
      });

      describe('#setLocus', () => {
        beforeEach(() => {
          meeting.locusInfo.initialSetup = sinon.stub().returns(true);
        });

        it('should read the locus object, set on the meeting and return null', () => {
          meeting.setLocus({
            mediaConnections: [test1],
            locusUrl: url1,
            locusId: uuid1,
            selfId: uuid2,
            mediaId: uuid3,
            host: {id: uuid4},
          });
          assert.calledOnce(meeting.locusInfo.initialSetup);
          assert.calledWith(meeting.locusInfo.initialSetup, {
            mediaConnections: [test1],
            locusUrl: url1,
            locusId: uuid1,
            selfId: uuid2,
            mediaId: uuid3,
            host: {id: uuid4},
          });
          assert.equal(meeting.mediaConnections, test1);
          assert.equal(meeting.locusUrl, url1);
          assert.equal(meeting.locusId, uuid1);
          assert.equal(meeting.selfId, uuid2);
          assert.equal(meeting.mediaId, uuid3);
          assert.equal(meeting.hostId, uuid4);
        });
      });

      describe('preferred video device', () => {
        describe('#getVideoDeviceId', () => {
          it('returns the preferred video device', () => {
            const videoDevice = 'video1';

            sandbox.stub(meeting.mediaProperties, 'videoDeviceId').value(videoDevice);

            assert.equal(meeting.mediaProperties.getVideoDeviceId(), videoDevice);
          });
          it('returns null if the preferred video device is not set', () => {
            sandbox.stub(meeting.mediaProperties, 'videoDeviceId').value(undefined);

            assert.equal(meeting.mediaProperties.getVideoDeviceId(), null);
          });
        });
        describe('#setVideoDeviceId', () => {
          it('sets the preferred video device', () => {
            const videoDevice = 'video1';

            sandbox.stub(meeting.mediaProperties, 'videoDeviceId').value(undefined);
            meeting.mediaProperties.setVideoDeviceId(videoDevice);

            assert.equal(meeting.mediaProperties.videoDeviceId, videoDevice);
          });
        });
      });

      describe('whiteboard share', () => {
        describe('#startWhiteboardShare', () => {
          beforeEach(() => {
            meeting.locusInfo.mediaShares = [{name: 'whiteboard', url: url1}];
            meeting.locusInfo.self = {url: url1};
            meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
          });
          it('should have #startWhiteboardShare', () => {
            assert.exists(meeting.startWhiteboardShare);
          });
          it('should send the whiteboard share', async () => {
            const whiteboardShare = meeting.startWhiteboardShare({
              channelUrl: url2,
            });

            assert.exists(whiteboardShare.then);
            await whiteboardShare;
            assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
          });
        });
        describe('#stopWhiteboardShare', () => {
          it('should have #stopWhiteboardShare', () => {
            assert.exists(meeting.stopWhiteboardShare);
          });
          beforeEach(() => {
            meeting.locusInfo.mediaShares = [{name: 'whiteboard', url: url1}];
            meeting.locusInfo.self = {url: url1};
            meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
          });
          it('should stop the whiteboard share', async () => {
            const whiteboardShare = meeting.stopWhiteboardShare();

            assert.exists(whiteboardShare.then);
            await whiteboardShare;
            assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
          });
        });
      });
      describe('share scenarios', () => {
        describe('triggerAnnotationInfoEvent', () => {
          it('check triggerAnnotationInfoEvent event', () => {
            TriggerProxy.trigger.reset();
            const annotationInfo = {version: '1', policy: 'Approval'};
            const expectAnnotationInfo = {annotationInfo, meetingId: meeting.id};
            meeting.webex.meetings = {};
            meeting.triggerAnnotationInfoEvent({annotation: annotationInfo}, {});
            assert.calledWith(
              TriggerProxy.trigger,
              {},
              {
                file: 'meeting/index',
                function: 'triggerAnnotationInfoEvent',
              },
              'meeting:updateAnnotationInfo',
              expectAnnotationInfo
            );

            TriggerProxy.trigger.reset();
            meeting.triggerAnnotationInfoEvent(
              {annotation: annotationInfo},
              {annotation: annotationInfo}
            );
            assert.notCalled(TriggerProxy.trigger);

            TriggerProxy.trigger.reset();
            const annotationInfoUpdate = {version: '1', policy: 'AnnotationNotAllowed'};
            const expectAnnotationInfoUpdated = {
              annotationInfo: annotationInfoUpdate,
              meetingId: meeting.id,
            };
            meeting.triggerAnnotationInfoEvent(
              {annotation: annotationInfoUpdate},
              {annotation: annotationInfo}
            );
            assert.calledWith(
              TriggerProxy.trigger,
              {},
              {
                file: 'meeting/index',
                function: 'triggerAnnotationInfoEvent',
              },
              'meeting:updateAnnotationInfo',
              expectAnnotationInfoUpdated
            );

            TriggerProxy.trigger.reset();
            meeting.triggerAnnotationInfoEvent(null, {annotation: annotationInfoUpdate});
            assert.notCalled(TriggerProxy.trigger);
          });
        });

        describe('setUpLocusMediaSharesListener', () => {
          beforeEach(() => {
            meeting.selfId = '9528d952-e4de-46cf-8157-fd4823b98377';
          });

          const USER_IDS = {
            ME: '9528d952-e4de-46cf-8157-fd4823b98377',
            REMOTE_A: '5be7e7b0-b304-48da-8083-83bd72b5300d',
            REMOTE_B: 'd4d102a1-17ce-4e17-9b08-bded3de467e4',
          };

          const RESOURCE_URLS = {
            WHITEBOARD_A:
              'https://board-a.wbx2.com/board/api/v1/channels/49cfb550-5517-11eb-a2af-1b9e4bc3da13',
            WHITEBOARD_B:
              'https://board-a.wbx2.com/board/api/v1/channels/977a7330-54f4-11eb-b1ef-91f5eefc7bf3',
          };

          const generateContent = (
            beneficiaryId = null,
            disposition = null,
            annotation = undefined
          ) => ({
            beneficiaryId,
            disposition,
          });
          const generateWhiteboard = (
            beneficiaryId = null,
            disposition = null,
            resourceUrl = null
          ) => ({beneficiaryId, disposition, resourceUrl});

          const generateData = (
            payload,
            isGranting,
            isContent,
            beneficiaryId,
            resourceUrl,
            isAccepting,
            otherBeneficiaryId,
            annotation,
            url,
            shareInstanceId
          ) => {
            const newPayload = cloneDeep(payload);

            newPayload.previous = cloneDeep(payload.current);

            const eventTrigger = {
              share: [],
              member: {
                eventName: EVENT_TRIGGERS.MEMBERS_CONTENT_UPDATE,
                eventPayload: {
                  activeSharingId: null,
                  endedSharingId: null,
                },
              },
            };

            let shareStatus = null;
            const activeSharingId = {
              whiteboard: null,
              content: null,
            };

            if (isGranting) {
              if (isContent) {
                activeSharingId.content = beneficiaryId;
                newPayload.current.content = generateContent(
                  beneficiaryId,
                  FLOOR_ACTION.GRANTED,
                  annotation
                );

                if (isEqual(newPayload.current, newPayload.previous)) {
                  eventTrigger.member = null;
                } else {
                  if (newPayload.current.whiteboard.beneficiaryId) {
                    if (newPayload.current.whiteboard.disposition === FLOOR_ACTION.GRANTED) {
                      newPayload.current.whiteboard.disposition = FLOOR_ACTION.RELEASED;
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                        functionName: 'stopWhiteboardShare',
                      });
                      eventTrigger.member.eventPayload.endedSharingId =
                        newPayload.current.whiteboard.beneficiaryId;
                    }
                  }

                  if (newPayload.previous.content.beneficiaryId) {
                    if (
                      newPayload.previous.content.beneficiaryId !==
                      newPayload.current.content.beneficiaryId
                    ) {
                      if (newPayload.previous.content.beneficiaryId === USER_IDS.ME) {
                        eventTrigger.share.push({
                          eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                          functionName: 'localShare',
                        });
                      } else if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                        eventTrigger.share.push({
                          eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                          functionName: 'remoteShare',
                        });
                      }
                      eventTrigger.member.eventPayload.endedSharingId =
                        newPayload.previous.content.beneficiaryId;
                    }
                  }

                  if (isAccepting) {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                      functionName: 'stopWhiteboardShare',
                    });
                  }

                  if (beneficiaryId === USER_IDS.ME) {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_LOCAL,
                      functionName: 'share',
                    });
                  } else {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE,
                      functionName: 'remoteShare',
                      eventPayload: {
                        memberId: beneficiaryId,
                        url,
                        shareInstanceId,
                        annotationInfo: undefined,
                      },
                    });
                  }
                }

                if (beneficiaryId === USER_IDS.ME) {
                  shareStatus = SHARE_STATUS.LOCAL_SHARE_ACTIVE;
                } else {
                  shareStatus = SHARE_STATUS.REMOTE_SHARE_ACTIVE;
                }
              } else {
                newPayload.current.whiteboard = generateWhiteboard(
                  beneficiaryId,
                  FLOOR_ACTION.GRANTED,
                  resourceUrl
                );

                if (newPayload.current.content.beneficiaryId) {
                  if (newPayload.current.content.disposition === FLOOR_ACTION.GRANTED) {
                    newPayload.current.content.disposition = FLOOR_ACTION.RELEASED;
                    if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                        functionName: 'localShare',
                      });
                    } else {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                        functionName: 'remoteShare',
                      });
                    }

                    eventTrigger.member.eventPayload.endedSharingId =
                      newPayload.current.content.beneficiaryId;
                  }
                }

                if (newPayload.previous.content.beneficiaryId) {
                  if (
                    newPayload.previous.content.beneficiaryId !==
                    newPayload.current.content.beneficiaryId
                  ) {
                    if (newPayload.previous.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                        functionName: 'localShare',
                      });
                    } else if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                        functionName: 'remoteShare',
                      });
                    }
                    eventTrigger.member.eventPayload.endedSharingId =
                      newPayload.previous.content.beneficiaryId;
                  }
                }

                if (newPayload.previous.whiteboard.beneficiaryId) {
                  if (
                    newPayload.previous.whiteboard.beneficiaryId !==
                    newPayload.current.whiteboard.beneficiaryId
                  ) {
                    eventTrigger.member.eventPayload.endedSharingId =
                      newPayload.previous.whiteboard.beneficiaryId;
                  }
                }

                activeSharingId.whiteboard = beneficiaryId;

                eventTrigger.share.push({
                  eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
                  functionName: 'startWhiteboardShare',
                  eventPayload: {resourceUrl, memberId: beneficiaryId},
                });

                shareStatus = SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE;
              }

              if (eventTrigger.member) {
                eventTrigger.member.eventPayload.activeSharingId = beneficiaryId;
              }
            } else {
              eventTrigger.member.eventPayload.endedSharingId = beneficiaryId;

              if (isContent) {
                newPayload.current.content.disposition = FLOOR_ACTION.RELEASED;

                if (beneficiaryId === USER_IDS.ME) {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                    functionName: 'localShare',
                  });
                } else {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                    functionName: 'remoteShare',
                  });
                }

                shareStatus = SHARE_STATUS.NO_SHARE;
              } else {
                newPayload.current.whiteboard.disposition = FLOOR_ACTION.RELEASED;

                if (isAccepting) {
                  newPayload.current.content.disposition = FLOOR_ACTION.ACCEPTED;
                  newPayload.current.content.beneficiaryId = otherBeneficiaryId;

                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
                    functionName: 'startWhiteboardShare',
                    eventPayload: {resourceUrl, memberId: beneficiaryId},
                  });

                  shareStatus = SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE;
                } else {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                    functionName: 'stopWhiteboardShare',
                  });

                  shareStatus = SHARE_STATUS.NO_SHARE;
                }
              }
            }

            return {
              payload: newPayload,
              eventTrigger,
              shareStatus,
              activeSharingId,
            };
          };

          const blankPayload = {
            previous: {
              content: generateContent(),
              whiteboard: generateWhiteboard(),
            },
            current: {
              content: generateContent(),
              whiteboard: generateWhiteboard(),
            },
          };

          const payloadTestHelper = (data) => {
            assert.equal(meeting.shareStatus, SHARE_STATUS.NO_SHARE);

            // Called once --> members:update (ignore)
            let callCounter = 1;

            data.forEach((d, index) => {
              meeting.locusInfo.emit(
                {function: 'test', file: 'test'},
                EVENTS.LOCUS_INFO_UPDATE_MEDIA_SHARES,
                d.payload
              );

              assert.equal(meeting.shareStatus, data[index].shareStatus);

              callCounter +=
                data[index].eventTrigger.share.length + (data[index].eventTrigger.member ? 1 : 0);

              assert.callCount(TriggerProxy.trigger, callCounter);

              assert.equal(
                meeting.members.mediaShareWhiteboardId,
                data[index].activeSharingId.whiteboard
              );
              assert.equal(
                meeting.members.mediaShareContentId,
                data[index].activeSharingId.content
              );
            });

            assert.callCount(TriggerProxy.trigger, callCounter);

            // Start with 1 to ignore members:update trigger

            let i = 1;
            let offset = 2;

            while (i < callCounter) {
              const index = Math.floor(i / offset);

              const {share, member} = data[index].eventTrigger;

              for (let idx = 0; idx < share.length; idx += 1) {
                const shareCallArgs = TriggerProxy.trigger.getCall(i + idx).args;
                const {functionName, eventName, eventPayload} = share[idx];
                const fileName =
                  functionName === 'remoteShare' ? 'meetings/index' : 'meeting/index';

                assert.deepEqual(shareCallArgs[1], {
                  file: fileName,
                  function: functionName,
                });

                assert.equal(shareCallArgs[2], eventName);

                if (functionName === 'startWhiteboardShare') {
                  assert.deepEqual(shareCallArgs[3], eventPayload);
                }

                if (
                  functionName === 'remoteShare' &&
                  eventName === EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE
                ) {
                  assert.deepEqual(shareCallArgs[3], eventPayload);
                }
              }

              // Check Trigger --> members:content:update
              if (member) {
                const memberCallArgs = TriggerProxy.trigger.getCall(i + share.length).args;

                assert.deepEqual(memberCallArgs[1], {
                  file: 'members',
                  function: 'locusMediaSharesUpdate',
                });
                assert.equal(memberCallArgs[2], member.eventName);

                // Check payload --> {activeSharingId, endedSharingId}
                assert.deepEqual(memberCallArgs[3], member.eventPayload);

                i += 1;
              }

              i += share.length;

              if (share.length + 1 > offset) {
                offset = (offset + share.length + 1) / 2;
              } else if (share.length + 1 < offset) {
                offset = share.length + 1 + 0.5;
              }
            }
          };

          it('should have #setUpLocusMediaSharesListener', () => {
            assert.exists(meeting.setUpLocusMediaSharesListener);
          });

          describe('Whiteboard A --> Whiteboard B', () => {
            it('Scenario #1: you share both whiteboards', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_B
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #2: you share whiteboard A and remote person A shares whiteboard B', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_B
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares whiteboard A and you share whiteboard B', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_B
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares both whiteboards', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_B
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares whiteboard A and remote person B shares whiteboard B', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_B,
                RESOURCE_URLS.WHITEBOARD_B
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3]);
            });
          });

          describe('Whiteboard A --> Desktop', () => {
            it('Scenario #1: you share whiteboard and then share desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                false,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A,
                true,
                USER_IDS.ME
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                true,
                USER_IDS.ME
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #2: you share whiteboard A and remote person A shares desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                false,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A,
                true,
                USER_IDS.REMOTE_A
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                true,
                USER_IDS.ME
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #3: remote person A shares whiteboard and you share desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                false,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A,
                true,
                USER_IDS.ME
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                true,
                USER_IDS.REMOTE_A
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #4: remote person A shares whiteboard and then shares desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                false,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A,
                true,
                USER_IDS.REMOTE_A
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                true,
                USER_IDS.REMOTE_A
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #5: remote person A shares whiteboard and remote person B shares desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data2 = generateData(
                data1.payload,
                false,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A,
                true,
                USER_IDS.REMOTE_B
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.REMOTE_B,
                undefined,
                true,
                USER_IDS.REMOTE_A
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3, data4]);
            });
          });

          describe('Desktop --> Whiteboard A', () => {
            it('Scenario #1: you share desktop and then share whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #2: you share desktop and remote person A shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares desktop and you share whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares desktop and then shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.ME,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares desktop and remote person B shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.REMOTE_A,
                RESOURCE_URLS.WHITEBOARD_A
              );
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });
          });
          describe('Desktop A --> Desktop B', () => {
            it('Scenario #1: you share desktop A and then share desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(data1.payload, false, true, USER_IDS.ME);
              const data3 = generateData(data2.payload, true, true, USER_IDS.ME);
              const data4 = generateData(data3.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #2: you share desktop A and remote person A shares desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(data1.payload, true, true, USER_IDS.REMOTE_A);
              const data3 = generateData(data2.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares desktop A and you share desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, true, USER_IDS.ME);
              const data3 = generateData(data2.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares desktop A and then shares desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, true, USER_IDS.REMOTE_A);
              const data3 = generateData(data2.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares desktop A and remote person B shares desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, true, USER_IDS.REMOTE_B);
              const data3 = generateData(data2.payload, false, true, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3]);
            });
          });
        });
      });

      describe('#startKeepAlive', () => {
        let clock;
        const defaultKeepAliveUrl = 'keep.alive.url';
        const defaultKeepAliveSecs = 23;
        const defaultExpectedInterval = (defaultKeepAliveSecs - 1) * 750;

        beforeEach(() => {
          clock = sinon.useFakeTimers();
        });
        afterEach(() => {
          clock.restore();
        });

        const progressTime = async (interval) => {
          await clock.tickAsync(interval);
          await testUtils.flushPromises();
        };

        it('startKeepAlive starts the keep alive', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: defaultKeepAliveSecs,
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await testUtils.flushPromises();
          assert.notCalled(meeting.meetingRequest.keepAlive);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {
            keepAliveUrl: defaultKeepAliveUrl,
          });
          await progressTime(defaultExpectedInterval);
          assert.calledTwice(meeting.meetingRequest.keepAlive);
          assert.alwaysCalledWithExactly(meeting.meetingRequest.keepAlive, {
            keepAliveUrl: defaultKeepAliveUrl,
          });
        });
        it('startKeepAlive handles existing keepAliveTimerId', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());
          logger.warn = sinon.spy();

          meeting.keepAliveTimerId = 7;
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: defaultKeepAliveSecs,
          };
          meeting.startKeepAlive();
          assert.equal(meeting.keepAliveTimerId, 7);
          await progressTime(defaultExpectedInterval);
          assert.notCalled(meeting.meetingRequest.keepAlive);
        });
        it('startKeepAlive handles missing keepAliveUrl', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());
          logger.warn = sinon.spy();

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveSecs: defaultKeepAliveSecs,
          };
          meeting.startKeepAlive();
          assert.isNull(meeting.keepAliveTimerId);
          await progressTime(defaultExpectedInterval);
          assert.notCalled(meeting.meetingRequest.keepAlive);
        });
        it('startKeepAlive handles missing keepAliveSecs', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());
          logger.warn = sinon.spy();

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
          };
          meeting.startKeepAlive();
          assert.isNull(meeting.keepAliveTimerId);
          await progressTime(1);
          assert.notCalled(meeting.meetingRequest.keepAlive);
        });
        it('startKeepAlive handles too low keepAliveSecs', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());
          logger.warn = sinon.spy();

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: 1,
          };
          meeting.startKeepAlive();
          assert.isNull(meeting.keepAliveTimerId);
          await progressTime(1);
          assert.notCalled(meeting.meetingRequest.keepAlive);
        });
        it('failed keepAlive stops the keep alives', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.reject());

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: defaultKeepAliveSecs,
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await testUtils.flushPromises();
          assert.notCalled(meeting.meetingRequest.keepAlive);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {
            keepAliveUrl: defaultKeepAliveUrl,
          });
          assert.isNull(meeting.keepAliveTimerId);
          await progressTime(defaultExpectedInterval);
          assert.calledOnce(meeting.meetingRequest.keepAlive);
        });
      });
      describe('#stopKeepAlive', () => {
        let clock;
        const defaultKeepAliveUrl = 'keep.alive.url';
        const defaultKeepAliveSecs = 23;
        const defaultExpectedInterval = (defaultKeepAliveSecs - 1) * 750;

        beforeEach(() => {
          clock = sinon.useFakeTimers();
        });
        afterEach(() => {
          clock.restore();
        });

        const progressTime = async (interval) => {
          await clock.tickAsync(interval);
          await testUtils.flushPromises();
        };

        it('stopKeepAlive stops the keep alive', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());

          assert.isNull(meeting.keepAliveTimerId);
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: defaultKeepAliveSecs,
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {
            keepAliveUrl: defaultKeepAliveUrl,
          });

          meeting.stopKeepAlive();
          assert.isNull(meeting.keepAliveTimerId);
          await progressTime(defaultExpectedInterval);
          assert.calledOnce(meeting.meetingRequest.keepAlive);
        });
        it('stopKeepAlive handles missing keepAliveTimerId', async () => {
          assert.isNull(meeting.keepAliveTimerId);
          meeting.stopKeepAlive();
        });
      });

      describe('#sendReaction', () => {
        it('should have #sendReaction', () => {
          assert.exists(meeting.sendReaction);
        });

        beforeEach(() => {
          meeting.meetingRequest.sendReaction = sinon.stub().returns(Promise.resolve());
        });

        it('should send reaction with the right data and return a promise', async () => {
          meeting.locusInfo.controls = {reactions: {reactionChannelUrl: 'Fake URL'}};

          const reactionPromise = meeting.sendReaction('thumb_down', 'light');

          assert.exists(reactionPromise.then);
          await reactionPromise;
          assert.calledOnceWithExactly(meeting.meetingRequest.sendReaction, {
            reactionChannelUrl: 'Fake URL',
            reaction: {
              type: 'thumb_down',
              codepoints: '1F44E',
              shortcodes: ':thumbsdown:',
              tone: {
                type: 'light_skin_tone',
                codepoints: '1F3FB',
                shortcodes: ':skin-tone-2:',
              },
            },
            participantId: meeting.members.selfId,
          });
        });

        it('should fail sending a reaction if data channel is undefined', async () => {
          meeting.locusInfo.controls = {reactions: {reactionChannelUrl: undefined}};

          await assert.isRejected(
            meeting.sendReaction('thumb_down', 'light'),
            Error,
            'Error sending reaction, service url not found.'
          );

          assert.notCalled(meeting.meetingRequest.sendReaction);
        });

        it('should fail sending a reaction if reactionType is invalid ', async () => {
          meeting.locusInfo.controls = {reactions: {reactionChannelUrl: 'Fake URL'}};

          await assert.isRejected(
            meeting.sendReaction('invalid_reaction', 'light'),
            Error,
            'invalid_reaction is not a valid reaction.'
          );

          assert.notCalled(meeting.meetingRequest.sendReaction);
        });

        it('should send a reaction with default skin tone if provided skinToneType is invalid ', async () => {
          meeting.locusInfo.controls = {reactions: {reactionChannelUrl: 'Fake URL'}};

          const reactionPromise = meeting.sendReaction('thumb_down', 'invalid_skin_tone');

          assert.exists(reactionPromise.then);
          await reactionPromise;
          assert.calledOnceWithExactly(meeting.meetingRequest.sendReaction, {
            reactionChannelUrl: 'Fake URL',
            reaction: {
              type: 'thumb_down',
              codepoints: '1F44E',
              shortcodes: ':thumbsdown:',
              tone: {type: 'normal_skin_tone', codepoints: '', shortcodes: ''},
            },
            participantId: meeting.members.selfId,
          });
        });

        it('should send a reaction with default skin tone if none provided', async () => {
          meeting.locusInfo.controls = {reactions: {reactionChannelUrl: 'Fake URL'}};

          const reactionPromise = meeting.sendReaction('thumb_down');

          assert.exists(reactionPromise.then);
          await reactionPromise;
          assert.calledOnceWithExactly(meeting.meetingRequest.sendReaction, {
            reactionChannelUrl: 'Fake URL',
            reaction: {
              type: 'thumb_down',
              codepoints: '1F44E',
              shortcodes: ':thumbsdown:',
              tone: {type: 'normal_skin_tone', codepoints: '', shortcodes: ''},
            },
            participantId: meeting.members.selfId,
          });
        });
      });
      describe('#toggleReactions', () => {
        it('should have #toggleReactions', () => {
          assert.exists(meeting.toggleReactions);
        });

        beforeEach(() => {
          meeting.meetingRequest.toggleReactions = sinon.stub().returns(Promise.resolve());
        });

        it('should toggle the reactions with the right data and return a promise', async () => {
          meeting.locusUrl = 'locusUrl';
          meeting.locusInfo.controls = {reactions: {enabled: false}};

          const togglePromise = meeting.toggleReactions(true);

          assert.exists(togglePromise.then);
          await togglePromise;
          assert.calledOnceWithExactly(meeting.meetingRequest.toggleReactions, {
            locusUrl: 'locusUrl',
            enable: true,
            requestingParticipantId: meeting.members.selfId,
          });
        });

        it('should resolve immediately if already enabled', async () => {
          meeting.locusUrl = 'locusUrl';
          meeting.locusInfo.controls = {reactions: {enabled: true}};

          const togglePromise = meeting.toggleReactions(true);

          const response = await togglePromise;

          assert.equal(response, 'Reactions are already enabled.');
          assert.notCalled(meeting.meetingRequest.toggleReactions);
        });

        it('should resolve immediately if already disabled', async () => {
          meeting.locusUrl = 'locusUrl';
          meeting.locusInfo.controls = {reactions: {enabled: false}};

          const togglePromise = meeting.toggleReactions(false);

          const response = await togglePromise;

          assert.equal(response, 'Reactions are already disabled.');
          assert.notCalled(meeting.meetingRequest.toggleReactions);
        });

        it('should toggle reactions on if controls is undefined and enable = true', async () => {
          meeting.locusUrl = 'locusUrl';
          meeting.locusInfo.controls = undefined;

          const togglePromise = meeting.toggleReactions(true);

          assert.exists(togglePromise.then);
          await togglePromise;
          assert.calledOnceWithExactly(meeting.meetingRequest.toggleReactions, {
            locusUrl: 'locusUrl',
            enable: true,
            requestingParticipantId: meeting.members.selfId,
          });
        });
      });

      describe('SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED locus event', () => {
        let spy;

        beforeEach('setup sinon', () => {
          spy = sinon.spy();
        });

        const testEmit = async (muted) => {
          await meeting.locusInfo.emitScoped(
            {},
            LOCUSINFO.EVENTS.SELF_REMOTE_VIDEO_MUTE_STATUS_UPDATED,
            {
              muted,
            }
          );

          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoSelfListener',
            },
            muted
              ? EVENT_TRIGGERS.MEETING_SELF_VIDEO_MUTED_BY_OTHERS
              : EVENT_TRIGGERS.MEETING_SELF_VIDEO_UNMUTED_BY_OTHERS,
            {
              payload: {
                muted,
              },
            }
          );
        };

        it('emits the expected event when muted', async () => {
          await testEmit(true);
        });

        it('emits the expected event when not muted', async () => {
          await testEmit(false);
        });
      });
    });
  });
});
