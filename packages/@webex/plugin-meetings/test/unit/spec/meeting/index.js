/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {cloneDeep, forEach, isEqual, isUndefined} from 'lodash';
import sinon from 'sinon';
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import StateMachine from 'javascript-state-machine';
import uuid from 'uuid';
import {assert, expect} from '@webex/test-helper-chai';
import {Credentials, WebexPlugin} from '@webex/webex-core';
import Support from '@webex/internal-plugin-support';
import MockWebex from '@webex/test-helper-mock-webex';
import StaticConfig from '@webex/plugin-meetings/src/common/config';
import ReconnectionNotStartedError from '@webex/plugin-meetings/src/common/errors/reconnection-not-started';
import {Defer} from '@webex/common';
import {
  FLOOR_ACTION,
  SHARE_STATUS,
  MEETING_INFO_FAILURE_REASON,
  PASSWORD_STATUS,
  EVENTS,
  EVENT_TRIGGERS,
  DESTINATION_TYPE,
  MEETING_REMOVED_REASON,
  LOCUSINFO,
  ICE_AND_DTLS_CONNECTION_TIMEOUT,
  DISPLAY_HINTS,
  SELF_POLICY,
  IP_VERSION,
  NETWORK_STATUS,
  ONLINE,
  OFFLINE,
  ROAP_OFFER_ANSWER_EXCHANGE_TIMEOUT,
} from '@webex/plugin-meetings/src/constants';
import {
  ConnectionState,
  MediaConnectionEventNames,
  StatsAnalyzerEventNames,
  Errors,
  ErrorType,
  RemoteTrackType,
  MediaType,
} from '@webex/internal-media-core';
import {LocalStreamEventNames} from '@webex/media-helpers';
import EventsScope from '@webex/plugin-meetings/src/common/events/events-scope';
import Meetings, {CONSTANTS} from '@webex/plugin-meetings';
import Meeting from '@webex/plugin-meetings/src/meeting';
import Members from '@webex/plugin-meetings/src/members';
import * as MembersImport from '@webex/plugin-meetings/src/members';
import Roap from '@webex/plugin-meetings/src/roap';
import MeetingRequest from '@webex/plugin-meetings/src/meeting/request';
import * as MeetingRequestImport from '@webex/plugin-meetings/src/meeting/request';
import LocusInfo from '@webex/plugin-meetings/src/locus-info';
import MediaProperties from '@webex/plugin-meetings/src/media/properties';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import MeetingsUtil from '@webex/plugin-meetings/src/meetings/util';
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
import * as SendSlotManagerModule from '@webex/plugin-meetings/src/multistream/sendSlotManager';
import {CallDiagnosticUtils} from '@webex/internal-plugin-metrics';
import * as LocusMediaRequestModule from '@webex/plugin-meetings/src/meeting/locusMediaRequest';

import CallDiagnosticLatencies from '@webex/internal-plugin-metrics/src/call-diagnostic/call-diagnostic-metrics-latencies';
import LLM from '@webex/internal-plugin-llm';
import Mercury from '@webex/internal-plugin-mercury';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
import SimultaneousInterpretation from '@webex/plugin-meetings/src/interpretation';
import Webinar from '@webex/plugin-meetings/src/webinar';
import {REACTION_RELAY_TYPES} from '../../../../src/reactions/constants';
import locus from '../fixture/locus';
import {
  UserNotJoinedError,
  MeetingNotActiveError,
  UserInLobbyError,
  AddMediaFailed,
} from '../../../../src/common/errors/webex-errors';
import WebExMeetingsErrors from '../../../../src/common/errors/webex-meetings-error';
import ParameterError from '../../../../src/common/errors/parameter';
import PasswordError from '../../../../src/common/errors/password-error';
import CaptchaError from '../../../../src/common/errors/captcha-error';
import PermissionError from '../../../../src/common/errors/permission';
import IntentToJoinError from '../../../../src/common/errors/intent-to-join';
import testUtils from '../../../utils/testUtils';
import {
  MeetingInfoV2CaptchaError,
  MeetingInfoV2PasswordError,
  MeetingInfoV2PolicyError,
} from '../../../../src/meeting-info/meeting-info-v2';
import {
  DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
  ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
  ICE_AND_REACHABILITY_FAILED_CLIENT_CODE,
  ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
  ICE_FAILURE_CLIENT_CODE,
  MISSING_ROAP_ANSWER_CLIENT_CODE,
} from '@webex/internal-plugin-metrics/src/call-diagnostic/config';
import CallDiagnosticMetrics from '@webex/internal-plugin-metrics/src/call-diagnostic/call-diagnostic-metrics';
import {ERROR_DESCRIPTIONS} from '@webex/internal-plugin-metrics/src/call-diagnostic/config';
import MeetingCollection from '@webex/plugin-meetings/src/meetings/collection';

import {EVENT_TRIGGERS as VOICEAEVENTS} from '@webex/internal-plugin-voicea';

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
    webex.meetings.reachability = {
      isAnyPublicClusterReachable: sinon.stub().resolves(true),
      getReachabilityResults: sinon.stub().resolves(undefined),
      getReachabilityMetrics: sinon.stub().resolves({}),
    };
    webex.internal.llm.on = sinon.stub();
    webex.internal.newMetrics.callDiagnosticLatencies = new CallDiagnosticLatencies(
      {},
      {parent: webex}
    );
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
        destinationType: DESTINATION_TYPE.MEETING_ID,
        correlationId,
        selfId: uuid1,
      },
      {
        parent: webex,
      }
    );

    meeting.members.selfId = uuid1;
    meeting.selfId = uuid1;
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
          assert.deepEqual(meeting.callStateForMetrics, {correlationId});
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
          assert.equal(meeting.destinationType, DESTINATION_TYPE.MEETING_ID);
          assert.instanceOf(meeting.breakouts, Breakouts);
          assert.instanceOf(meeting.simultaneousInterpretation, SimultaneousInterpretation);
          assert.instanceOf(meeting.webinar, Webinar);
        });
        it('creates MediaRequestManager instances', () => {
          assert.instanceOf(meeting.mediaRequestManagers.audio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.video, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareAudio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareVideo, MediaRequestManager);
        });

        it('uses meeting id as correlation id if not provided in constructor', () => {
          const newMeeting = new Meeting(
            {
              userId: uuid1,
              resource: uuid2,
              deviceUrl: uuid3,
              locus: {url: url1},
              destination: testDestination,
              destinationType: DESTINATION_TYPE.MEETING_ID,
            },
            {
              parent: webex,
            }
          );
          assert.equal(newMeeting.correlationId, newMeeting.id);
          assert.deepEqual(newMeeting.callStateForMetrics, {correlationId: newMeeting.id});
        });

        it('correlationId can be provided in callStateForMetrics', () => {
          const newMeeting = new Meeting(
            {
              userId: uuid1,
              resource: uuid2,
              deviceUrl: uuid3,
              locus: {url: url1},
              destination: testDestination,
              destinationType: DESTINATION_TYPE.MEETING_ID,
              callStateForMetrics: {
                correlationId: uuid4,
                joinTrigger: 'fake-join-trigger',
                loginType: 'fake-login-type',
              },
            },
            {
              parent: webex,
            }
          );
          assert.equal(newMeeting.correlationId, uuid4);
          assert.deepEqual(newMeeting.callStateForMetrics, {
            correlationId: uuid4,
            joinTrigger: 'fake-join-trigger',
            loginType: 'fake-login-type',
          });
        });

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
                destinationType: DESTINATION_TYPE.MEETING_ID,
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

        describe('creates SendSlot manager instance', () => {
          let mockSendSlotManagerCtor;

          beforeEach(() => {
            mockSendSlotManagerCtor = sinon.stub(SendSlotManagerModule, 'default');

            meeting = new Meeting(
              {
                userId: uuid1,
                resource: uuid2,
                deviceUrl: uuid3,
                locus: {url: url1},
                destination: testDestination,
                destinationType: DESTINATION_TYPE.MEETING_ID,
              },
              {
                parent: webex,
              }
            );

            meeting.mediaProperties.webrtcMediaConnection = {createSendSlot: sinon.stub()};
          });

          it('calls SendSlotManager constructor', () => {
            assert.calledOnce(mockSendSlotManagerCtor);
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

        const fakeRoapMessage = {id: 'fake TURN discovery message'};
        const fakeReachabilityResults = {id: 'fake reachability'};
        const fakeTurnServerInfo = {id: 'fake turn info'};
        const fakeJoinResult = {id: 'join result'};

        const joinOptions = {correlationId: '12345'};
        const mediaOptions = {audioEnabled: true, allowMediaInLobby: true};

        let generateTurnDiscoveryRequestMessageStub;
        let handleTurnDiscoveryHttpResponseStub;
        let abortTurnDiscoveryStub;
        let addMediaInternalStub;

        beforeEach(() => {
          meeting.join = sinon.stub().returns(Promise.resolve(fakeJoinResult));
          addMediaInternalStub = sinon
            .stub(meeting, 'addMediaInternal')
            .returns(Promise.resolve(test4));

          webex.meetings.reachability.getReachabilityResults.resolves(fakeReachabilityResults);

          generateTurnDiscoveryRequestMessageStub = sinon
            .stub(meeting.roap, 'generateTurnDiscoveryRequestMessage')
            .resolves({roapMessage: fakeRoapMessage});
          handleTurnDiscoveryHttpResponseStub = sinon
            .stub(meeting.roap, 'handleTurnDiscoveryHttpResponse')
            .resolves({turnServerInfo: fakeTurnServerInfo, turnDiscoverySkippedReason: undefined});
          abortTurnDiscoveryStub = sinon.stub(meeting.roap, 'abortTurnDiscovery');
        });

        it('should work as expected', async () => {
          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          // check that TURN discovery is done with join and addMediaInternal() called
          assert.calledOnceWithExactly(meeting.join, {
            ...joinOptions,
            roapMessage: fakeRoapMessage,
            reachability: fakeReachabilityResults,
          });
          assert.calledOnceWithExactly(generateTurnDiscoveryRequestMessageStub, meeting, true);
          assert.calledOnceWithExactly(
            handleTurnDiscoveryHttpResponseStub,
            meeting,
            fakeJoinResult
          );
          assert.calledOnceWithExactly(
            meeting.addMediaInternal,
            sinon.match.any,
            fakeTurnServerInfo,
            false,
            mediaOptions
          );

          assert.deepEqual(result, {join: fakeJoinResult, media: test4});

          // resets joinWithMediaRetryInfo
          assert.deepEqual(meeting.joinWithMediaRetryInfo, {
            isRetry: false,
            prevJoinResponse: undefined,
          });
        });

        it("should not call handleTurnDiscoveryHttpResponse if we don't send a TURN discovery request with join", async () => {
          generateTurnDiscoveryRequestMessageStub.resolves({roapMessage: undefined});

          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          // check that TURN discovery is done with join and addMediaInternal() called
          assert.calledOnceWithExactly(meeting.join, {
            ...joinOptions,
            roapMessage: undefined,
            reachability: fakeReachabilityResults,
          });
          assert.calledOnceWithExactly(generateTurnDiscoveryRequestMessageStub, meeting, true);
          assert.notCalled(handleTurnDiscoveryHttpResponseStub);
          assert.notCalled(abortTurnDiscoveryStub);
          assert.calledOnceWithExactly(
            meeting.addMediaInternal,
            sinon.match.any,
            undefined,
            false,
            mediaOptions
          );

          assert.deepEqual(result, {join: fakeJoinResult, media: test4});
          assert.equal(meeting.turnServerUsed, false);
        });

        it('should call abortTurnDiscovery() if we do not get a TURN server info', async () => {
          handleTurnDiscoveryHttpResponseStub.resolves({
            turnServerInfo: undefined,
            turnDiscoverySkippedReason: 'missing http response',
          });

          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          // check that TURN discovery is done with join and addMediaInternal() called
          assert.calledOnceWithExactly(meeting.join, {
            ...joinOptions,
            roapMessage: fakeRoapMessage,
            reachability: fakeReachabilityResults,
          });
          assert.calledOnceWithExactly(generateTurnDiscoveryRequestMessageStub, meeting, true);
          assert.calledOnceWithExactly(
            handleTurnDiscoveryHttpResponseStub,
            meeting,
            fakeJoinResult
          );
          assert.calledOnceWithExactly(abortTurnDiscoveryStub);
          assert.calledOnceWithExactly(
            meeting.addMediaInternal,
            sinon.match.any,
            undefined,
            false,
            mediaOptions
          );

          assert.deepEqual(result, {join: fakeJoinResult, media: test4});
        });

        it('should reject if join() fails', async () => {
          const error = new Error('fake');
          meeting.join = sinon.stub().returns(Promise.reject(error));
          meeting.locusUrl = null; // when join fails, we end up with null locusUrl

          await assert.isRejected(meeting.joinWithMedia({mediaOptions: {allowMediaInLobby: true}}));

          assert.calledTwice(abortTurnDiscoveryStub);

          assert.calledTwice(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: undefined,
              reason: error.message,
              stack: error.stack,
              leaveErrorReason: undefined,
              isRetry: false,
            },
            {
              type: error.name,
            }
          );
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: undefined,
              reason: error.message,
              stack: error.stack,
              leaveErrorReason: undefined,
              isRetry: true,
            },
            {
              type: error.name,
            }
          );

          // resets joinWithMediaRetryInfo
          assert.deepEqual(meeting.joinWithMediaRetryInfo, {
            isRetry: false,
            prevJoinResponse: undefined,
          });
        });

        it('should resolve if join() fails the first time but succeeds the second time', async () => {
          const error = new Error('fake');
          meeting.join = sinon
            .stub()
            .onFirstCall()
            .returns(Promise.reject(error))
            .onSecondCall()
            .returns(Promise.resolve(fakeJoinResult));
          const leaveStub = sinon.stub(meeting, 'leave').resolves();

          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          assert.calledOnce(abortTurnDiscoveryStub);
          assert.calledTwice(meeting.join);
          assert.notCalled(leaveStub);

          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              leaveErrorReason: undefined,
              isRetry: false,
            },
            {
              type: error.name,
            }
          );

          assert.deepEqual(result, {join: fakeJoinResult, media: test4});

          // resets joinWithMediaRetryInfo
          assert.deepEqual(meeting.joinWithMediaRetryInfo, {
            isRetry: false,
            prevJoinResponse: undefined,
          });
        });

        it('should fail if called with allowMediaInLobby:false', async () => {
          meeting.join = sinon.stub().returns(Promise.resolve(test1));
          meeting.addMediaInternal = sinon.stub().returns(Promise.resolve(test4));

          await assert.isRejected(
            meeting.joinWithMedia({mediaOptions: {allowMediaInLobby: false}})
          );
        });

        it('should call leave() if addMediaInternal() fails and ignore leave() failure', async () => {
          const leaveError = new Error('leave error');
          const addMediaError = new Error('fake addMedia error');

          const leaveStub = sinon.stub(meeting, 'leave').rejects(leaveError);
          meeting.addMediaInternal = sinon.stub().rejects(addMediaError);

          await assert.isRejected(
            meeting.joinWithMedia({
              joinOptions: {resourceId: 'some resource'},
              mediaOptions: {allowMediaInLobby: true},
            }),
            addMediaError
          );

          assert.calledOnce(leaveStub);
          assert.calledOnceWithExactly(leaveStub, {
            resourceId: 'some resource',
            reason: 'joinWithMedia failure',
          });

          // Behavioral metric is sent on both calls of joinWithMedia
          assert.calledTwice(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: addMediaError.message,
              stack: addMediaError.stack,
              leaveErrorReason: undefined,
              isRetry: false,
            },
            {
              type: addMediaError.name,
            }
          );
          assert.calledWith(
            Metrics.sendBehavioralMetric.secondCall,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: addMediaError.message,
              stack: addMediaError.stack,
              leaveErrorReason: leaveError.message,
              isRetry: true,
            },
            {
              type: addMediaError.name,
            }
          );
        });

        it('should not call leave() if addMediaInternal() fails the first time and succeeds the second time and should only call join() once', async () => {
          const addMediaError = new Error('fake addMedia error');
          const leaveStub = sinon.stub(meeting, 'leave');

          meeting.addMediaInternal = sinon
            .stub()
            .onFirstCall()
            .rejects(addMediaError)
            .onSecondCall()
            .resolves(test4);

          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          assert.deepEqual(result, {join: fakeJoinResult, media: test4});

          assert.calledOnce(meeting.join);
          assert.notCalled(leaveStub);

          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: addMediaError.message,
              stack: addMediaError.stack,
              leaveErrorReason: undefined,
              isRetry: false,
            },
            {
              type: addMediaError.name,
            }
          );
        });

        it('should send the right CA events when media connection fails', async () => {
          const fakeClientError = {id: 'error'};

          const fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
            forceRtcMetricsSend: sinon.stub().resolves(),
          };

          // setup the stubs so that media connection always fails on waitForMediaConnectionConnected()
          addMediaInternalStub.restore();
          meeting.join.returns(
            Promise.resolve({id: 'join result', roapMessage: 'fake TURN discovery response'})
          );

          sinon.stub(Media, 'createMediaConnection').returns(fakeMediaConnection);
          sinon.stub(meeting, 'waitForRemoteSDPAnswer').resolves();
          sinon.stub(meeting.roap, 'doTurnDiscovery').resolves({turnServerInfo: 'fake turn info'});
          sinon
            .stub(meeting.mediaProperties, 'waitForMediaConnectionConnected')
            .rejects(new Error('fake error'));

          webex.meetings.reachability.isWebexMediaBackendUnreachable = sinon.stub().resolves(false);
          webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode = sinon
            .stub()
            .returns(fakeClientError);

          // call joinWithMedia() - it should fail
          await assert.isRejected(
            meeting.joinWithMedia({
              joinOptions,
              mediaOptions,
            })
          );

          // check the right CA events have been sent:
          // calls at index 0 and 2 to submitClientEvent are for "client.media.capabilities" which we don't care about in this test
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent.getCall(1), {
            name: 'client.ice.end',
            payload: {
              canProceed: false,
              icePhase: 'JOIN_MEETING_RETRY',
              errors: [fakeClientError],
            },
            options: {
              meetingId: meeting.id,
            },
          });
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent.getCall(3), {
            name: 'client.ice.end',
            payload: {
              canProceed: false,
              icePhase: 'JOIN_MEETING_FINAL',
              errors: [fakeClientError],
            },
            options: {
              meetingId: meeting.id,
            },
          });
        });

        it('should force TURN discovery on the 2nd attempt, if addMediaInternal() fails the first time', async () => {
          const addMediaError = new Error('fake addMedia error');

          const fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          };

          /* Setup the stubs so that the first call to addMediaInternal() fails
             and the 2nd call calls the real implementation - so that we can check that
             addMediaInternal() eventually calls meeting.roap.doTurnDiscovery() with isForced=true.
             As a result we need to also stub a few other methods like createMediaConnection() and waitForRemoteSDPAnswer() */
          sinon.stub(Media, 'createMediaConnection').returns(fakeMediaConnection);
          sinon.stub(meeting, 'waitForRemoteSDPAnswer').resolves();

          addMediaInternalStub.onFirstCall().rejects(addMediaError);
          addMediaInternalStub.onSecondCall().callsFake((...args) => {
            return addMediaInternalStub.wrappedMethod.bind(meeting)(...args);
          });

          sinon.stub(meeting.roap, 'doTurnDiscovery').resolves({turnServerInfo: 'fake turn info'});

          const result = await meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          assert.deepEqual(result, {join: fakeJoinResult, media: undefined});

          assert.calledOnce(meeting.join);

          // first addMediaInternal() call without forcing TURN
          assert.calledWith(
            meeting.addMediaInternal.firstCall,
            sinon.match.any,
            fakeTurnServerInfo,
            false,
            mediaOptions
          );

          // second addMediaInternal() call with forcing TURN
          assert.calledWith(
            meeting.addMediaInternal.secondCall,
            sinon.match.any,
            undefined,
            true,
            mediaOptions
          );

          // now check that TURN is actually forced by addMediaInternal(),
          // we're not checking the isReconnecting param value, because it depends on the full sequence of things
          // being done correctly (like SDP offer creation) and some of these are stubbed in this test
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, sinon.match.any, true);
        });

        it('should return the right icePhase in icePhaseCallback on 1st attempt and retry', async () => {
          const addMediaError = new Error('fake addMedia error');

          const icePhaseCallbacks = [];
          const addMediaInternalResults = [];

          meeting.addMediaInternal = sinon
            .stub()
            .callsFake((icePhaseCallback, _turnServerInfo, _forceTurnDiscovery) => {
              const defer = new Defer();

              icePhaseCallbacks.push(icePhaseCallback);
              addMediaInternalResults.push(defer);
              return defer.promise;
            });

          const result = meeting.joinWithMedia({
            joinOptions,
            mediaOptions,
          });

          await testUtils.flushPromises();

          // check the callback works correctly on the 1st attempt
          assert.equal(icePhaseCallbacks.length, 1);
          assert.equal(icePhaseCallbacks[0](), 'JOIN_MEETING_RETRY');

          // now trigger the failure, so that joinWithMedia() does a retry
          addMediaInternalResults[0].reject(addMediaError);

          await testUtils.flushPromises();

          // check the callback works correctly on the 2nd attempt
          assert.equal(icePhaseCallbacks.length, 2);
          assert.equal(icePhaseCallbacks[1](), 'JOIN_MEETING_FINAL');

          // trigger 2nd failure
          addMediaInternalResults[1].reject(addMediaError);

          await assert.isRejected(result);
        });

        it('should not attempt a retry if we fail to create the offer on first atttempt', async () => {
          const addMediaError = new Error('fake addMedia error');
          addMediaError.name = 'SdpOfferCreationError';

          meeting.addMediaInternal.rejects(addMediaError);

          await assert.isRejected(
            meeting.joinWithMedia({
              joinOptions,
              mediaOptions,
            }),
            addMediaError
          );

          // check that only 1 attempt was done
          assert.calledOnce(meeting.join);
          assert.calledOnce(meeting.addMediaInternal);
          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.JOIN_WITH_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: addMediaError.message,
              stack: addMediaError.stack,
              leaveErrorReason: undefined,
              isRetry: false,
            },
            {
              type: addMediaError.name,
            }
          );
        });
      });

      describe('#isTranscriptionSupported', () => {
        it('should return false if the feature is not supported for the meeting', () => {
          meeting.locusInfo.controls = {transcribe: {caption: false}};

          assert.equal(meeting.isTranscriptionSupported(), false);
        });
        it('should return true if webex assitant is enabled', () => {
          meeting.locusInfo.controls = {transcribe: {caption: true}};

          assert.equal(meeting.isTranscriptionSupported(), true);
        });
      });

      describe('#startTranscription', () => {
        beforeEach(() => {
          webex.internal.voicea.on = sinon.stub();
          webex.internal.voicea.off = sinon.stub();
          webex.internal.voicea.listenToEvents = sinon.stub();
          webex.internal.voicea.turnOnCaptions = sinon.stub();
        });

        it('should subscribe to events for the first time and avoid subscribing for future transcription starts', async () => {
          meeting.joinedWith = {
            state: 'JOINED',
          };
          meeting.areVoiceaEventsSetup = false;
          meeting.roles = ['MODERATOR'];

          await meeting.startTranscription();

          assert.equal(webex.internal.voicea.on.callCount, 4);
          assert.equal(meeting.areVoiceaEventsSetup, true);
          assert.equal(webex.internal.voicea.listenToEvents.callCount, 1);
          assert.called(webex.internal.voicea.turnOnCaptions);

          await meeting.startTranscription();
          assert.equal(webex.internal.voicea.on.callCount, 4);
          assert.equal(meeting.areVoiceaEventsSetup, true);
          assert.equal(webex.internal.voicea.listenToEvents.callCount, 1);
          assert.calledTwice(webex.internal.voicea.turnOnCaptions);
        });

        it('should listen to events and turnOnCaptions for all users', async () => {
          meeting.joinedWith = {
            state: 'JOINED',
          };
          meeting.areVoiceaEventsSetup = false;

          await meeting.startTranscription();

          assert.equal(webex.internal.voicea.on.callCount, 4);
          assert.equal(meeting.areVoiceaEventsSetup, true);
          assert.equal(webex.internal.voicea.listenToEvents.callCount, 1);
          assert.calledOnce(webex.internal.voicea.turnOnCaptions);
        });

        it("should throw error if request doesn't work", async () => {
          meeting.request = sinon.stub().returns(Promise.reject());

          try {
            await meeting.startTranscription();
          } catch (err) {
            assert(err, {});
          }
        });
      });

      describe('#stopTranscription', () => {
        beforeEach(() => {
          webex.internal.voicea.on = sinon.stub();
          webex.internal.voicea.off = sinon.stub();
          webex.internal.voicea.listenToEvents = sinon.stub();
          webex.internal.voicea.turnOnCaptions = sinon.stub();
        });

        it('should stop listening to voicea events and also trigger a stop event', () => {
          meeting.stopTranscription();
          assert.equal(webex.internal.voicea.off.callCount, 4);
          assert.equal(meeting.areVoiceaEventsSetup, false);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'triggerStopReceivingTranscriptionEvent',
            },
            EVENT_TRIGGERS.MEETING_STOPPED_RECEIVING_TRANSCRIPTION
          );
        });
      });

      describe('#setCaptionLanguage', () => {
        beforeEach(() => {
          meeting.isTranscriptionSupported = sinon.stub();
          meeting.transcription = {languageOptions: {}};
          webex.internal.voicea.on = sinon.stub();
          webex.internal.voicea.off = sinon.stub();
          webex.internal.voicea.setCaptionLanguage = sinon.stub();
          webex.internal.voicea.requestLanguage = sinon.stub();
        });

        afterEach(() => {
          // Restore the original methods after each test
          sinon.restore();
        });

        it('should reject if transcription is not supported', (done) => {
          meeting.isTranscriptionSupported.returns(false);

          meeting.setCaptionLanguage('fr').catch((error) => {
            assert.equal(error.message, 'Webex Assistant is not enabled/supported');
            done();
          });
        });

        it('should resolve with the language code on successful language update', (done) => {
          meeting.isTranscriptionSupported.returns(true);
          const languageCode = 'fr';

          meeting.setCaptionLanguage(languageCode).then((resolvedLanguageCode) => {
            assert.calledWith(webex.internal.voicea.requestLanguage, languageCode);
            assert.equal(resolvedLanguageCode, languageCode);
            assert.equal(
              meeting.transcription.languageOptions.currentCaptionLanguage,
              languageCode
            );
            done();
          });

          assert.calledOnceWithMatch(
            webex.internal.voicea.on,
            VOICEAEVENTS.CAPTION_LANGUAGE_UPDATE
          );

          // Trigger the event
          const voiceaListenerLangugeUpdate = webex.internal.voicea.on.getCall(0).args[1];
          voiceaListenerLangugeUpdate({statusCode: 200, languageCode});
        });

        it('should reject if the statusCode in payload is not 200', (done) => {
          meeting.isTranscriptionSupported.returns(true);
          const languageCode = 'fr';
          const rejectPayload = {
            statusCode: 400,
            message: 'some error message',
          };

          meeting.setCaptionLanguage(languageCode).catch((payload) => {
            assert.equal(payload, rejectPayload);
            done();
          });

          assert.calledOnceWithMatch(
            webex.internal.voicea.on,
            VOICEAEVENTS.CAPTION_LANGUAGE_UPDATE
          );

          // Trigger the event
          const voiceaListenerLangugeUpdate = webex.internal.voicea.on.getCall(0).args[1];
          voiceaListenerLangugeUpdate(rejectPayload);
        });
      });

      describe('#setSpokenLanguage', () => {
        beforeEach(() => {
          meeting.isTranscriptionSupported = sinon.stub();
          meeting.transcription = {languageOptions: {}};
          webex.internal.voicea.on = sinon.stub();
          webex.internal.voicea.off = sinon.stub();
          webex.internal.voicea.setSpokenLanguage = sinon.stub();
          meeting.roles = ['MODERATOR'];
        });

        afterEach(() => {
          // Restore the original methods after each test
          sinon.restore();
        });

        it('should reject if transcription is not supported', (done) => {
          meeting.isTranscriptionSupported.returns(false);

          meeting.setSpokenLanguage('fr').catch((error) => {
            assert.equal(error.message, 'Webex Assistant is not enabled/supported');
            done();
          });
        });

        it('should reject if current user is not a host', (done) => {
          meeting.isTranscriptionSupported.returns(true);
          meeting.roles = ['COHOST'];

          meeting.setSpokenLanguage('fr').catch((error) => {
            assert.equal(error.message, 'Only host can set spoken language');
            done();
          });
        });

        it('should resolve with the language code on successful language update', (done) => {
          meeting.isTranscriptionSupported.returns(true);
          const languageCode = 'fr';

          meeting.setSpokenLanguage(languageCode).then((resolvedLanguageCode) => {
            assert.calledWith(webex.internal.voicea.setSpokenLanguage, languageCode);
            assert.equal(resolvedLanguageCode, languageCode);
            assert.equal(meeting.transcription.languageOptions.currentSpokenLanguage, languageCode);
            done();
          });

          assert.calledOnceWithMatch(webex.internal.voicea.on, VOICEAEVENTS.SPOKEN_LANGUAGE_UPDATE);

          // Trigger the event
          const voiceaListenerLangugeUpdate = webex.internal.voicea.on.getCall(0).args[1];
          voiceaListenerLangugeUpdate({languageCode});
        });

        it('should reject if the language code does not exist in payload', (done) => {
          meeting.isTranscriptionSupported.returns(true);
          const languageCode = 'fr';
          const rejectPayload = {
            message: 'some error message',
          };

          meeting.setSpokenLanguage(languageCode).catch((payload) => {
            assert.equal(payload, rejectPayload);
            done();
          });

          assert.calledOnceWithMatch(webex.internal.voicea.on, VOICEAEVENTS.SPOKEN_LANGUAGE_UPDATE);

          // Trigger the event
          const voiceaListenerLangugeUpdate = webex.internal.voicea.on.getCall(0).args[1];
          voiceaListenerLangugeUpdate(rejectPayload);
        });
      });

      describe('transcription events', () => {
        beforeEach(() => {
          meeting.trigger = sinon.stub();
        });

        it('should trigger meeting:caption-received event', () => {
          meeting.voiceaListenerCallbacks[VOICEAEVENTS.NEW_CAPTION]({});
          assert.calledWith(meeting.trigger, EVENT_TRIGGERS.MEETING_CAPTION_RECEIVED);
        });

        it('should trigger meeting:receiveTranscription:started event', () => {
          meeting.voiceaListenerCallbacks[VOICEAEVENTS.VOICEA_ANNOUNCEMENT]({});
          assert.calledWith(
            meeting.trigger,
            EVENT_TRIGGERS.MEETING_STARTED_RECEIVING_TRANSCRIPTION
          );
        });

        it('should trigger meeting:caption-received event', () => {
          meeting.voiceaListenerCallbacks[VOICEAEVENTS.NEW_CAPTION]({});
          assert.calledWith(meeting.trigger, EVENT_TRIGGERS.MEETING_CAPTION_RECEIVED);
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

      describe('#handleLLMOnline', () => {
        beforeEach(() => {
          webex.internal.llm.off = sinon.stub();
        });

        it('turns off llm online, emits transcription connected events', () => {
          meeting.handleLLMOnline();
          assert.calledOnceWithExactly(webex.internal.llm.off, 'online', meeting.handleLLMOnline);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'handleLLMOnline',
            },
            EVENT_TRIGGERS.MEETING_TRANSCRIPTION_CONNECTED
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
          meeting.updateLLMConnection = sinon.stub().returns(Promise.resolve());
        });

        describe('successful', () => {
          beforeEach(() => {
            sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve(joinMeetingResult));
          });

          it('should join the meeting and return promise', async () => {
            const join = meeting.join({pstnAudioType: 'dial-in'});
            meeting.config.enableAutomaticLLM = true;

            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.initiated',
              payload: {
                trigger: 'user-interaction',
                isRoapCallEnabled: true,
                pstnAudioType: 'dial-in',
              },
              options: {meetingId: meeting.id},
            });

            assert.exists(join.then);
            const result = await join;

            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
            assert.equal(result, joinMeetingResult);
            assert.calledWith(webex.internal.llm.on, 'online', meeting.handleLLMOnline);
          });

          [true, false].forEach((enableMultistream) => {
            it(`should instantiate LocusMediaRequest with correct parameters (enableMultistream=${enableMultistream})`, async () => {
              meeting.config.deviceType = 'web';
              meeting.webex.meetings.geoHintInfo = {regionCode: 'EU', countryCode: 'UK'};

              const mockLocusMediaRequestCtor = sinon
                .stub(LocusMediaRequestModule, 'LocusMediaRequest')
                .returns({
                  id: 'fake LocusMediaRequest instance',
                });

              await meeting.join({enableMultistream});

              assert.calledOnceWithExactly(
                mockLocusMediaRequestCtor,
                {
                  correlationId: meeting.correlationId,
                  meetingId: meeting.id,
                  device: {
                    url: meeting.deviceUrl,
                    deviceType: meeting.config.deviceType,
                    countryCode: 'UK',
                    regionCode: 'EU',
                  },
                  preferTranscoding: !enableMultistream,
                },
                {
                  parent: meeting.webex,
                }
              );
            });
          });

          it('should take trigger from meeting joinTrigger if available', () => {
            meeting.updateCallStateForMetrics({joinTrigger: 'fake-join-trigger'});
            const join = meeting.join();

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.call.initiated',
              payload: {trigger: 'fake-join-trigger', isRoapCallEnabled: true},
              options: {meetingId: meeting.id},
            });
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
            MeetingUtil.isPinOrGuest = sinon.stub().returns(false);
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
        describe('lmm, transcription & permissionTokenRefresh decoupling', () => {
          beforeEach(() => {
            sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve(joinMeetingResult));
          });

          describe('llm', () => {
            it('makes sure that join does not wait for update llm connection promise', async () => {
              const defer = new Defer();

              meeting.config.enableAutomaticLLM = true;
              meeting.updateLLMConnection = sinon.stub().returns(defer.promise);

              const result = await meeting.join();

              assert.equal(result, joinMeetingResult);

              defer.resolve();
            });

            it('should call updateLLMConnection as part of joining if config value is set', async () => {
              meeting.config.enableAutomaticLLM = true;
              meeting.updateLLMConnection = sinon.stub().resolves();

              await meeting.join();

              assert.calledOnce(meeting.updateLLMConnection);
            });

            it('should not call updateLLMConnection as part of joining if config value is not set', async () => {
              meeting.updateLLMConnection = sinon.stub().resolves();
              await meeting.join();

              assert.notCalled(meeting.updateLLMConnection);
            });

            it('handles catching error of llm connection later, and join still resolves', async () => {
              const defer = new Defer();

              meeting.config.enableAutomaticLLM = true;
              meeting.updateLLMConnection = sinon.stub().returns(defer.promise);

              const result = await meeting.join();

              assert.equal(result, joinMeetingResult);

              defer.reject(new Error('bad day', {cause: 'bad weather'}));

              try {
                await defer.promise;
              } catch (err) {
                assert.deepEqual(Metrics.sendBehavioralMetric.getCalls()[0].args, [
                  BEHAVIORAL_METRICS.JOIN_SUCCESS,
                  {correlation_id: meeting.correlationId},
                ]);

                assert.deepEqual(Metrics.sendBehavioralMetric.getCalls()[1].args, [
                  BEHAVIORAL_METRICS.LLM_CONNECTION_AFTER_JOIN_FAILURE,
                  {
                    correlation_id: meeting.correlationId,
                    reason: err.message,
                    stack: err.stack,
                  },
                ]);
              }
            });
          });

          describe('refreshPermissionToken', () => {
            it('should continue if permissionTokenRefresh fails with a generic error', async () => {
              meeting.checkAndRefreshPermissionToken = sinon.stub().rejects(new Error('bad day'));
              const stateMachineFailSpy = sinon.spy(meeting.meetingFiniteStateMachine, 'fail');

              try {
                const result = await meeting.join();
                assert.notCalled(stateMachineFailSpy);
                assert.equal(result, joinMeetingResult);
                assert.calledOnceWithExactly(
                  meeting.checkAndRefreshPermissionToken,
                  30,
                  'ttl-join'
                );
              } catch (error) {
                assert.fail('join should not throw an Error');
              }
            });

            it('should throw if permissionTokenRefresh fails with a captcha error', async () => {
              meeting.checkAndRefreshPermissionToken = sinon
                .stub()
                .rejects(new CaptchaError('bad captcha'));
              const stateMachineFailSpy = sinon.spy(meeting.meetingFiniteStateMachine, 'fail');
              const joinMeetingOptionsSpy = sinon.spy(MeetingUtil, 'joinMeetingOptions');

              try {
                await meeting.join();
                assert.fail('join should have thrown a Captcha Error.');
              } catch (error) {
                assert.calledOnce(stateMachineFailSpy);
                assert.calledOnceWithExactly(
                  meeting.checkAndRefreshPermissionToken,
                  30,
                  'ttl-join'
                );
                assert.instanceOf(error, CaptchaError);
                assert.equal(error.message, 'bad captcha');
                // should not get to the end promise chain, which does do the join
                assert.notCalled(joinMeetingOptionsSpy);
              }
            });

            it('should throw if permissionTokenRefresh fails with a password error', async () => {
              meeting.checkAndRefreshPermissionToken = sinon
                .stub()
                .rejects(new PasswordError('bad password'));
              const stateMachineFailSpy = sinon.spy(meeting.meetingFiniteStateMachine, 'fail');
              const joinMeetingOptionsSpy = sinon.spy(MeetingUtil.joinMeetingOptions);

              try {
                await meeting.join();
                assert.fail('join should have thrown a Password Error.');
              } catch (error) {
                assert.calledOnce(stateMachineFailSpy);
                assert.calledOnceWithExactly(
                  meeting.checkAndRefreshPermissionToken,
                  30,
                  'ttl-join'
                );
                assert.instanceOf(error, PasswordError);
                assert.equal(error.message, 'bad password');
                // should not get to the end promise chain, which does do the join
                assert.notCalled(joinMeetingOptionsSpy);
              }
            });

            it('should throw if permissionTokenRefresh fails with a permission error', async () => {
              meeting.checkAndRefreshPermissionToken = sinon
                .stub()
                .rejects(new PermissionError('bad permission'));
              const stateMachineFailSpy = sinon.spy(meeting.meetingFiniteStateMachine, 'fail');
              const joinMeetingOptionsSpy = sinon.spy(MeetingUtil.joinMeetingOptions);

              try {
                await meeting.join();
                assert.fail('join should have thrown a Permission Error.');
              } catch (error) {
                assert.calledOnce(stateMachineFailSpy);
                assert.calledOnceWithExactly(
                  meeting.checkAndRefreshPermissionToken,
                  30,
                  'ttl-join'
                );
                assert.instanceOf(error, PermissionError);
                assert.equal(error.message, 'bad permission');
                // should not get to the end promise chain, which does do the join
                assert.notCalled(joinMeetingOptionsSpy);
              }
            });
          });
        });
      });

      describe('#addMedia', () => {
        const muteStateStub = {
          handleClientRequest: sinon.stub().returns(Promise.resolve(true)),
        };

        let fakeMediaConnection;

        beforeEach(async () => {
          fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          };
          meeting.mediaProperties.setMediaDirection = sinon.stub().returns(true);
          meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
          meeting.mediaProperties.getCurrentConnectionInfo = sinon
            .stub()
            .resolves({connectionType: 'udp', selectedCandidatePairChanges: 2, numTransports: 1});
          meeting.audio = muteStateStub;
          meeting.video = muteStateStub;
          sinon.stub(Media, 'createMediaConnection').returns(fakeMediaConnection);
          sinon.stub(meeting, 'setupMediaConnectionListeners');
          sinon.stub(meeting, 'setMercuryListener');
          sinon
            .stub(meeting.roap, 'doTurnDiscovery')
            .resolves({turnServerInfo: {}, turnDiscoverySkippedReason: undefined});
          sinon.stub(meeting, 'waitForRemoteSDPAnswer').resolves();

          // normally the first Roap message we send is creating confluence, so mock LocusMediaRequest.isConfluenceCreated()
          // to return false the first time it's called and true the 2nd time, to simulate how it would happen for real
          meeting.locusMediaRequest = {
            isConfluenceCreated: sinon
              .stub()
              .onFirstCall()
              .returns(false)
              .onSecondCall()
              .returns(true),
          };
        });

        it('should have #addMedia', () => {
          assert.exists(meeting.addMedia);
        });

        it('should reject promise if meeting is not active and the meeting in lobby is not enabled', async () => {
          const result = await assert.isRejected(meeting.addMedia({allowMediaInLobby: false}));

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

        it('should send metrics and reset the statsAnalyzer to null if addMedia throws an error without a turn server retry', async () => {
          meeting.meetingState = 'ACTIVE';

          meeting.webex.meetings.reachability = {
            getReachabilityMetrics: sinon.stub().resolves({
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
            }),
          };

          const forceRtcMetricsSend = sinon.stub().resolves();

          // setup the mock to return an incomplete object - this will cause addMedia to fail
          // because some methods (like on() or initiateOffer()) are missing
          Media.createMediaConnection = sinon.stub().returns({
            close: sinon.stub(),
            forceRtcMetricsSend,
          });
          // set a statsAnalyzer on the meeting so that we can check that it gets reset to null
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          const error = await assert.isRejected(meeting.addMedia());

          assert.calledOnce(forceRtcMetricsSend);

          assert.isNull(meeting.statsAnalyzer);
          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert(Metrics.sendBehavioralMetric.calledTwice);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              latency: undefined,
            }
          );
          assert.calledWith(
            Metrics.sendBehavioralMetric.secondCall,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              code: error.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              isMultistream: false,
              isJoinWithMediaRetry: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              iceCandidatesCount: 0,
            }
          );
        });

        it('should reset the webrtcMediaConnection to null if addMedia throws an error', async () => {
          meeting.meetingState = 'ACTIVE';
          // setup the mock so that a media connection is created, but its initiateOffer() method fails
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().throws(new Error('fake error')),
            close: sinon.stub(),
          });
          const result = await assert.isRejected(meeting.addMedia());

          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert(Metrics.sendBehavioralMetric.calledTwice);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              latency: undefined,
            }
          );
          assert.calledWith(
            Metrics.sendBehavioralMetric.secondCall,
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

        it('should send metrics and reset the statsAnalyzer to null if waitForRemoteSDPAnswer fails', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.webex.meetings.reachability = {
            getReachabilityMetrics: sinon.stub().resolves({
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
            }),
          };

          meeting.waitForRemoteSDPAnswer = sinon.stub().rejects();

          // set a statsAnalyzer on the meeting so that we can check that it gets reset to null
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};

          const error = await assert.isRejected(meeting.addMedia());

          assert.isNull(meeting.statsAnalyzer);
          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert(Metrics.sendBehavioralMetric.calledTwice);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              latency: undefined,
            }
          );
          assert.calledWith(
            Metrics.sendBehavioralMetric.secondCall,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: error.message,
              stack: error.stack,
              code: error.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              isMultistream: false,
              isJoinWithMediaRetry: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              iceCandidatesCount: 0,
            }
          );
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

          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert(Metrics.sendBehavioralMetric.calledTwice);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              latency: undefined,
            }
          );
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

          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert(Metrics.sendBehavioralMetric.calledTwice);
          assert.calledWith(
            Metrics.sendBehavioralMetric.firstCall,
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              latency: undefined,
            }
          );
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

        it('sends correct CA event when times out waiting for SDP answer', async () => {
          const eventListeners = {};
          const clock = sinon.useFakeTimers();

          // these 2 are stubbed, we need the real versions:
          meeting.waitForRemoteSDPAnswer.restore();
          meeting.setupMediaConnectionListeners.restore();

          meeting.meetingState = 'ACTIVE';

          // setup a mock media connection that will trigger an offer when initiateOffer() is called
          Media.createMediaConnection = sinon.stub().returns({
            initiateOffer: sinon.stub().callsFake(() => {
              // simulate offer being generated
              eventListeners[MediaConnectionEventNames.LOCAL_SDP_OFFER_GENERATED]();

              return Promise.resolve();
            }),
            close: sinon.stub(),
            on: (event, listener) => {
              eventListeners[event] = listener;
            },
            forceRtcMetricsSend: sinon.stub().resolves(),
          });

          const getErrorPayloadForClientErrorCodeStub =
            (webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
              sinon
                .stub()
                .callsFake(({clientErrorCode}) => ({errorCode: clientErrorCode, fatal: true})));

          const result = meeting.addMedia();
          await testUtils.flushPromises();

          // simulate timeout waiting for the SDP answer that never comes
          await clock.tickAsync(ROAP_OFFER_ANSWER_EXCHANGE_TIMEOUT);

          await assert.isRejected(result);

          assert.calledOnceWithExactly(getErrorPayloadForClientErrorCodeStub, {
            clientErrorCode: 2007,
          });
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.media-engine.remote-sdp-received',
            payload: {
              canProceed: false,
              errors: [{errorCode: 2007, fatal: true}],
            },
            options: {
              meetingId: meeting.id,
              rawError: sinon.match.instanceOf(Error),
            },
          });
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
          assert(webex.internal.newMetrics.submitInternalEvent.calledTwice);
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.firstCall, {
            name: 'internal.client.add-media.turn-discovery.start',
          });
          assert.calledWith(webex.internal.newMetrics.submitInternalEvent.secondCall, {
            name: 'internal.client.add-media.turn-discovery.end',
          });
          assert.calledOnce(meeting.mediaProperties.setMediaDirection);
          assert.calledOnce(Media.createMediaConnection);
          assert.calledWith(
            Media.createMediaConnection,
            false,
            meeting.getMediaConnectionDebugId(),
            webex,
            meeting.id,
            meeting.correlationId,
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
            turnDiscoverySkippedReason: undefined,
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
            meeting.correlationId,
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

          await clock.tickAsync(ICE_AND_DTLS_CONNECTION_TIMEOUT);
          await testUtils.flushPromises();

          assert.exists(media);
          await media.catch((err) => {
            assert.instanceOf(err, WebExMeetingsErrors);
          });

          clock.restore();
        });

        it('should reject if waitForMediaConnectionConnected() rejects after turn server retry', async () => {
          const FAKE_ERROR = {fatal: true};
          const getErrorPayloadForClientErrorCodeStub =
            (webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
              sinon.stub().returns(FAKE_ERROR));
          webex.meetings.reachability = {
            isWebexMediaBackendUnreachable: sinon.stub().resolves(false),
            getReachabilityMetrics: sinon.stub().resolves(),
          };
          const MOCK_CLIENT_ERROR_CODE = 2004;
          const generateClientErrorCodeForIceFailureStub = sinon
            .stub(CallDiagnosticUtils, 'generateClientErrorCodeForIceFailure')
            .returns(MOCK_CLIENT_ERROR_CODE);
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';
          let errorThrown = undefined;

          // Stub doTurnDiscovery so that on the first call we skip turn discovery
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .onFirstCall()
            .returns({
              turnServerInfo: undefined,
              turnDiscoverySkippedReason: 'reachability',
            })
            .onSecondCall()
            .returns({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
              turnDiscoverySkippedReason: undefined,
            });
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.waitForMediaConnectionConnected.rejects({iceConnected: false});

          const forceRtcMetricsSend = sinon.stub().resolves();
          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            forceRtcMetricsSend,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
              assert.instanceOf(err, AddMediaFailed);
            });

          assert.calledTwice(generateClientErrorCodeForIceFailureStub);
          assert.calledWith(generateClientErrorCodeForIceFailureStub, {
            signalingState: 'unknown',
            iceConnected: false,
            turnServerUsed: false,
            unreachable: false,
          });
          assert.calledWith(generateClientErrorCodeForIceFailureStub, {
            signalingState: 'unknown',
            iceConnected: false,
            turnServerUsed: true,
            unreachable: false,
          });

          assert.calledTwice(getErrorPayloadForClientErrorCodeStub);
          assert.alwaysCalledWithExactly(getErrorPayloadForClientErrorCodeStub, {
            clientErrorCode: MOCK_CLIENT_ERROR_CODE,
          });

          assert.calledThrice(webex.internal.newMetrics.submitClientEvent);
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.firstCall, {
            name: 'client.media.capabilities',
            payload: {
              mediaCapabilities: {
                rx: {
                  audio: false,
                  share: false,
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
            options: {
              meetingId: meeting.id,
            },
          });
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.secondCall, {
            name: 'client.ice.end',
            payload: {
              canProceed: true,
              icePhase: 'JOIN_MEETING_RETRY',
              errors: [FAKE_ERROR],
            },
            options: {
              meetingId: meeting.id,
            },
          });
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.thirdCall, {
            name: 'client.ice.end',
            payload: {
              canProceed: false,
              icePhase: 'JOIN_MEETING_FINAL',
              errors: [FAKE_ERROR],
            },
            options: {
              meetingId: meeting.id,
            },
          });

          // Turn discovery internal events are sent twice this time as we go through establishMediaConnection a second time on the retry
          const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          assert.equal(submitInternalEventCalls.length, 4);
          assert.deepEqual(submitInternalEventCalls[0].args, [
            {
              name: 'internal.client.add-media.turn-discovery.start',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[1].args, [
            {
              name: 'internal.client.add-media.turn-discovery.end',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[2].args, [
            {
              name: 'internal.client.add-media.turn-discovery.start',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[3].args, [
            {
              name: 'internal.client.add-media.turn-discovery.end',
            },
          ]);

          const sendBehavioralMetricCalls = Metrics.sendBehavioralMetric.getCalls();
          assert.equal(sendBehavioralMetricCalls.length, 3);
          assert.deepEqual(sendBehavioralMetricCalls[0].args, [
            BEHAVIORAL_METRICS.ADD_MEDIA_RETRY,
            {
              correlation_id: meeting.correlationId,
              state: meeting.state,
              meetingState: meeting.meetingState,
              reason: 'forcingTurnTls',
            },
          ]);
          assert.deepEqual(sendBehavioralMetricCalls[1].args, [
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: true,
              latency: undefined,
            },
          ]);
          assert.deepEqual(sendBehavioralMetricCalls[2].args, [
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: errorThrown.message,
              stack: errorThrown.stack,
              code: errorThrown.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              retriedWithTurnServer: true,
              isMultistream: false,
              isJoinWithMediaRetry: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              iceCandidatesCount: 0,
            },
          ]);

          // Check that doTurnDiscovery is called with th4 correct value of isForced
          const doTurnDiscoveryCalls = meeting.roap.doTurnDiscovery.getCalls();
          assert.equal(doTurnDiscoveryCalls.length, 2);
          assert.deepEqual(doTurnDiscoveryCalls[0].args, [meeting, false, false]);
          assert.deepEqual(doTurnDiscoveryCalls[1].args.slice(1), [true, true]);

          // Some clean up steps happens twice
          assert.calledTwice(forceRtcMetricsSend);
          assert.calledTwice(closeMediaConnectionStub);
          assert.isNull(meeting.mediaProperties.webrtcMediaConnection);

          assert.isOk(errorThrown);
        });

        it('should resolve if waitForMediaConnectionConnected() rejects the first time but resolves the second time', async () => {
          const FAKE_ERROR = {fatal: true};
          webex.meetings.reachability = {
            isWebexMediaBackendUnreachable: sinon
              .stub()
              .onCall(0)
              .rejects()
              .onCall(1)
              .resolves(true)
              .onCall(2)
              .resolves(false),
            getReachabilityMetrics: sinon.stub().resolves({}),
          };
          const getErrorPayloadForClientErrorCodeStub =
            (webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
              sinon.stub().returns(FAKE_ERROR));
          const MOCK_CLIENT_ERROR_CODE = 2004;
          const generateClientErrorCodeForIceFailureStub = sinon
            .stub(CallDiagnosticUtils, 'generateClientErrorCodeForIceFailure')
            .returns(MOCK_CLIENT_ERROR_CODE);
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';
          let errorThrown = undefined;

          meeting.meetingState = 'ACTIVE';
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .onFirstCall()
            .returns({
              turnServerInfo: undefined,
              turnDiscoverySkippedReason: 'reachability',
            })
            .onSecondCall()
            .returns({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
              turnDiscoverySkippedReason: undefined,
            });
          meeting.mediaProperties.waitForMediaConnectionConnected = sinon
            .stub()
            .onFirstCall()
            .rejects()
            .onSecondCall()
            .resolves();

          const forceRtcMetricsSend = sinon.stub().resolves();
          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            forceRtcMetricsSend,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
            });

          assert.calledOnce(generateClientErrorCodeForIceFailureStub);
          assert.calledWith(generateClientErrorCodeForIceFailureStub, {
            signalingState: 'unknown',
            iceConnected: undefined,
            turnServerUsed: false,
            unreachable: false,
          });

          assert.calledOnce(getErrorPayloadForClientErrorCodeStub);
          assert.calledWith(getErrorPayloadForClientErrorCodeStub, {
            clientErrorCode: MOCK_CLIENT_ERROR_CODE,
          });

          assert.calledThrice(webex.internal.newMetrics.submitClientEvent);
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.firstCall, {
            name: 'client.media.capabilities',
            payload: {
              mediaCapabilities: {
                rx: {
                  audio: false,
                  share: false,
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
            options: {
              meetingId: meeting.id,
            },
          });
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.secondCall, {
            name: 'client.ice.end',
            payload: {
              canProceed: true,
              icePhase: 'JOIN_MEETING_RETRY',
              errors: [FAKE_ERROR],
            },
            options: {
              meetingId: meeting.id,
            },
          });
          assert.calledWith(webex.internal.newMetrics.submitClientEvent.thirdCall, {
            name: 'client.media-engine.ready',
            options: {
              meetingId: meeting.id,
            },
          });

          // Turn discovery internal events are sent twice this time as we go through establishMediaConnection a second time on the retry
          const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          assert.equal(submitInternalEventCalls.length, 4);
          assert.deepEqual(submitInternalEventCalls[0].args, [
            {
              name: 'internal.client.add-media.turn-discovery.start',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[1].args, [
            {
              name: 'internal.client.add-media.turn-discovery.end',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[2].args, [
            {
              name: 'internal.client.add-media.turn-discovery.start',
            },
          ]);
          assert.deepEqual(submitInternalEventCalls[3].args, [
            {
              name: 'internal.client.add-media.turn-discovery.end',
            },
          ]);

          const sendBehavioralMetricCalls = Metrics.sendBehavioralMetric.getCalls();
          assert.equal(sendBehavioralMetricCalls.length, 3);
          assert.deepEqual(sendBehavioralMetricCalls[0].args, [
            BEHAVIORAL_METRICS.ADD_MEDIA_RETRY,
            {
              correlation_id: meeting.correlationId,
              state: meeting.state,
              meetingState: meeting.meetingState,
              reason: 'forcingTurnTls',
            },
          ]);
          assert.deepEqual(sendBehavioralMetricCalls[1].args, [
            BEHAVIORAL_METRICS.TURN_DISCOVERY_LATENCY,
            {
              correlation_id: meeting.correlationId,
              turnServerUsed: true,
              retriedWithTurnServer: true,
              latency: undefined,
            },
          ]);
          assert.deepEqual(sendBehavioralMetricCalls[2].args, [
            BEHAVIORAL_METRICS.ADD_MEDIA_SUCCESS,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              connectionType: 'udp',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              isMultistream: false,
              retriedWithTurnServer: true,
              isJoinWithMediaRetry: false,
              iceCandidatesCount: 0,
            },
          ]);
          meeting.roap.doTurnDiscovery;

          // Check that doTurnDiscovery is called with th4 correct value of isForced
          const doTurnDiscoveryCalls = meeting.roap.doTurnDiscovery.getCalls();
          assert.equal(doTurnDiscoveryCalls.length, 2);
          assert.deepEqual(doTurnDiscoveryCalls[0].args, [meeting, false, false]);
          assert.deepEqual(doTurnDiscoveryCalls[1].args, [meeting, true, true]);

          assert.calledOnce(forceRtcMetricsSend);
          assert.calledOnce(closeMediaConnectionStub);

          assert.isNotOk(errorThrown);
        });

        it('should call join if state is LEFT after first media connection attempt', async () => {
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';
          let errorThrown = undefined;

          meeting.meetingState = 'ACTIVE';
          meeting.state = 'LEFT';
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .onFirstCall()
            .returns({
              turnServerInfo: undefined,
              turnDiscoverySkippedReason: 'reachability',
            })
            .onSecondCall()
            .returns({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
              turnDiscoverySkippedReason: undefined,
            });
          meeting.mediaProperties.waitForMediaConnectionConnected = sinon
            .stub()
            .onFirstCall()
            .rejects()
            .onSecondCall()
            .resolves();
          meeting.join = sinon.stub().resolves();

          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
            });

          assert.isNotOk(errorThrown);
          assert.calledOnceWithExactly(meeting.join, {rejoin: true});
        });

        it('should reject if join attempt fails if state is LEFT after first media connection attempt', async () => {
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';
          let errorThrown = undefined;

          meeting.meetingState = 'ACTIVE';
          meeting.state = 'LEFT';
          meeting.roap.doTurnDiscovery = sinon
            .stub()
            .onFirstCall()
            .returns({
              turnServerInfo: undefined,
              turnDiscoverySkippedReason: 'reachability',
            })
            .onSecondCall()
            .returns({
              turnServerInfo: {
                url: FAKE_TURN_URL,
                username: FAKE_TURN_USER,
                password: FAKE_TURN_PASSWORD,
              },
              turnDiscoverySkippedReason: undefined,
            });
          meeting.mediaProperties.waitForMediaConnectionConnected = sinon
            .stub()
            .onFirstCall()
            .rejects()
            .onSecondCall()
            .resolves();
          meeting.join = sinon.stub().rejects();

          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
            });

          assert.isOk(errorThrown);
          assert.calledOnceWithExactly(meeting.join, {rejoin: true});
        });

        it('should send ADD_MEDIA_SUCCESS metrics', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.webex.meetings.reachability = {
            getReachabilityMetrics: sinon.stub().resolves({
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
            }),
          };
          meeting.iceCandidatesCount = 3;

          await meeting.addMedia({
            mediaSettings: {},
          });

          assert.calledTwice(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric.secondCall,
            BEHAVIORAL_METRICS.ADD_MEDIA_SUCCESS,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              connectionType: 'udp',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              isMultistream: false,
              retriedWithTurnServer: false,
              isJoinWithMediaRetry: false,
              someReachabilityMetric1: 'some value1',
              someReachabilityMetric2: 'some value2',
              iceCandidatesCount: 3,
            }
          );

          assert.called(webex.internal.newMetrics.submitClientEvent);
          assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.media-engine.ready',
            options: {
              meetingId: meeting.id,
            },
          });
        });

        it('should not send TURN_DISCOVERY_LATENCY metric if doTurnDiscovery fails', async () => {
          let errorThrown = undefined;

          // doTurnDiscovery returns undefined if something fails
          meeting.roap.doTurnDiscovery = sinon.stub().returns({
            turnServerInfo: undefined,
            turnDiscoverySkippedReason: undefined,
          });
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.waitForMediaConnectionConnected.rejects({iceConnected: false});

          const forceRtcMetricsSend = sinon.stub().resolves();
          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            forceRtcMetricsSend,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
              assert.instanceOf(err, AddMediaFailed);
            });

          // Check that the only metric sent is ADD_MEDIA_FAILURE
          assert.calledOnceWithExactly(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: errorThrown.message,
              stack: errorThrown.stack,
              code: errorThrown.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              isMultistream: false,
              isJoinWithMediaRetry: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              iceCandidatesCount: 0,
            }
          );

          assert.isOk(errorThrown);
        });

        it('should send ICE_CANDIDATE_ERROR metric if media connection fails and ice candidate errors have been gathered', async () => {
          let errorThrown = undefined;

          meeting.roap.doTurnDiscovery = sinon.stub().returns({
            turnServerInfo: undefined,
            turnDiscoverySkippedReason: undefined,
          });
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.waitForMediaConnectionConnected.rejects({iceConnected: false});

          const forceRtcMetricsSend = sinon.stub().resolves();
          const closeMediaConnectionStub = sinon.stub();
          Media.createMediaConnection = sinon.stub().returns({
            close: closeMediaConnectionStub,
            forceRtcMetricsSend,
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),
            on: sinon.stub(),
          });

          meeting.iceCandidateErrors.set('701_error', 2);
          meeting.iceCandidateErrors.set('701_turn_host_lookup_received_error', 1);

          await meeting
            .addMedia({
              mediaSettings: {},
            })
            .catch((err) => {
              errorThrown = err;
              assert.instanceOf(err, AddMediaFailed);
            });

          // Check that the only metric sent is ADD_MEDIA_FAILURE
          assert.calledOnceWithExactly(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ADD_MEDIA_FAILURE,
            {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              reason: errorThrown.message,
              stack: errorThrown.stack,
              code: errorThrown.code,
              turnDiscoverySkippedReason: undefined,
              turnServerUsed: true,
              retriedWithTurnServer: false,
              isMultistream: false,
              isJoinWithMediaRetry: false,
              signalingState: 'unknown',
              connectionState: 'unknown',
              iceConnectionState: 'unknown',
              selectedCandidatePairChanges: 2,
              numTransports: 1,
              '701_error': 2,
              '701_turn_host_lookup_received_error': 1,
              iceCandidatesCount: 0,
            }
          );

          assert.isOk(errorThrown);
        });

        describe('handles StatsAnalyzer events', () => {
          let prevConfigValue;
          let statsAnalyzerStub;

          beforeEach(async () => {
            meeting.meetingState = 'ACTIVE';
            meeting.remoteShareInstanceId = '1234';
            prevConfigValue = meeting.config.stats.enableStatsAnalyzer;

            meeting.config.stats.enableStatsAnalyzer = true;

            statsAnalyzerStub = new EventsScope();
            // mock the StatsAnalyzer constructor
            sinon.stub(InternalMediaCoreModule, 'StatsAnalyzer').returns(statsAnalyzerStub);

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
              StatsAnalyzerEventNames.LOCAL_MEDIA_STARTED,
              {mediaType: 'audio'}
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
                mediaType: 'audio',
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
              StatsAnalyzerEventNames.LOCAL_MEDIA_STOPPED,
              {mediaType: 'video'}
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
              StatsAnalyzerEventNames.REMOTE_MEDIA_STARTED,
              {mediaType: 'video'}
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
                mediaType: 'video',
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
              StatsAnalyzerEventNames.REMOTE_MEDIA_STOPPED,
              {mediaType: 'audio'}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.rx.stop',
              payload: {mediaType: 'audio'},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('REMOTE_MEDIA_STARTED triggers "meeting:media:remote:start" event and sends metrics for share', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerEventNames.REMOTE_MEDIA_STARTED,
              {mediaType: 'share'}
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
                mediaType: 'share',
              }
            );
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.rx.start',
              payload: {mediaType: 'share', shareInstanceId: meeting.remoteShareInstanceId},
              options: {
                meetingId: meeting.id,
              },
            });

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.render.start',
              payload: {mediaType: 'share', shareInstanceId: meeting.remoteShareInstanceId},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('REMOTE_MEDIA_STOPPED triggers the right metrics for share', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerEventNames.REMOTE_MEDIA_STOPPED,
              {mediaType: 'share'}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.rx.stop',
              payload: {mediaType: 'share', shareInstanceId: meeting.remoteShareInstanceId},
              options: {
                meetingId: meeting.id,
              },
            });

            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media.render.stop',
              payload: {mediaType: 'share', shareInstanceId: meeting.remoteShareInstanceId},
              options: {
                meetingId: meeting.id,
              },
            });
          });

          it('calls submitMQE correctly', async () => {
            const fakeData = {intervalMetadata: {bla: 'bla'}, networkType: 'wifi'};

            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerEventNames.MEDIA_QUALITY,
              {data: fakeData}
            );

            assert.calledWithMatch(webex.internal.newMetrics.submitMQE, {
              name: 'client.mediaquality.event',
              options: {
                meetingId: meeting.id,
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
            turnDiscoverySkippedReason: undefined,
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
            meeting.correlationId,
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

          sinon.stub(InternalMediaCoreModule, 'getDevices').rejects(new Error('fake error'));

          await meeting.addMedia();
        });

        describe('CA ice failures checks', () => {
          [
            {
              clientErrorCode: ICE_FAILURE_CLIENT_CODE,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.ICE_FAILURE,
              },
            },
            {
              clientErrorCode: MISSING_ROAP_ANSWER_CLIENT_CODE,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.MISSING_ROAP_ANSWER,
                category: 'media',
              },
            },
            {
              clientErrorCode: DTLS_HANDSHAKE_FAILED_CLIENT_CODE,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.DTLS_HANDSHAKE_FAILED,
              },
            },
            {
              clientErrorCode: ICE_FAILED_WITHOUT_TURN_TLS_CLIENT_CODE,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.ICE_FAILED_WITHOUT_TURN_TLS,
              },
            },
            {
              clientErrorCode: ICE_FAILED_WITH_TURN_TLS_CLIENT_CODE,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.ICE_FAILED_WITH_TURN_TLS,
                category: 'media',
              },
            },
            {
              clientErrorCode: ICE_AND_REACHABILITY_FAILED_CLIENT_CODE,
              unreachable: true,
              expectedErrorPayload: {
                errorDescription: ERROR_DESCRIPTIONS.ICE_AND_REACHABILITY_FAILED,
                category: 'expected',
              },
            },
          ].forEach(({clientErrorCode, expectedErrorPayload, unreachable}) => {
            it(`should handle all ice failures correctly for ${clientErrorCode}`, async () => {
              // setting the method to the real implementation
              // because newMetrics is mocked completely in the webex-mock
              // the reason for this is that we want to test this on integration level
              const CD = new CallDiagnosticMetrics({}, {parent: webex});
              webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
                CD.getErrorPayloadForClientErrorCode;

              webex.meetings.reachability = {
                isWebexMediaBackendUnreachable: sinon.stub().resolves(unreachable || false),
              };

              const generateClientErrorCodeForIceFailureStub = sinon
                .stub(CallDiagnosticUtils, 'generateClientErrorCodeForIceFailure')
                .returns(clientErrorCode);

              meeting.meetingState = 'ACTIVE';
              meeting.mediaProperties.waitForMediaConnectionConnected.rejects({
                iceConnected: false,
              });

              let errorThrown = false;

              await meeting
                .addMedia({
                  mediaSettings: {},
                })
                .catch(() => {
                  errorThrown = true;
                });

              assert.calledOnceWithExactly(generateClientErrorCodeForIceFailureStub, {
                signalingState: 'unknown',
                iceConnected: false,
                turnServerUsed: true,
                unreachable: unreachable || false,
              });

              const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

              assert.deepEqual(submitClientEventCalls[0].args, [
                {
                  name: 'client.media.capabilities',
                  payload: {
                    mediaCapabilities: {
                      rx: {
                        audio: false,
                        share: false,
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
                  options: {
                    meetingId: meeting.id,
                  },
                },
              ]);

              assert.deepEqual(submitClientEventCalls[1].args, [
                {
                  name: 'client.ice.end',
                  payload: {
                    canProceed: false,
                    icePhase: 'JOIN_MEETING_FINAL',
                    errors: [
                      {
                        fatal: true,
                        shownToUser: false,
                        name: 'other',
                        category: 'media',
                        errorCode: clientErrorCode,
                        serviceErrorCode: undefined,
                        rawErrorMessage: undefined,
                        ...expectedErrorPayload,
                      },
                    ],
                  },
                  options: {
                    meetingId: meeting.id,
                  },
                },
              ]);

              assert.isTrue(errorThrown);
            });
          });
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
          let fakeMicrophoneStream;
          let fakeRoapMediaConnection;
          let fakeMultistreamRoapMediaConnection;
          let roapMediaConnectionConstructorStub;
          let multistreamRoapMediaConnectionConstructorStub;
          let locusMediaRequestStub; // stub for /media requests to Locus

          const roapOfferMessage = {messageType: 'OFFER', sdp: 'sdp', seq: '1', tieBreaker: '123'};
          const roapOKMessage = {messageType: 'OK', seq: '1'};

          let expectedMediaConnectionConfig;
          let expectedDebugId;

          let clock;

          beforeEach(async () => {
            clock = sinon.useFakeTimers();

            sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);

            meeting.deviceUrl = 'deviceUrl';
            meeting.config.deviceType = 'web';
            meeting.isMultistream = isMultistream;
            meeting.meetingState = 'ACTIVE';
            meeting.selfUrl = 'selfUrl';
            meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
            meeting.mediaProperties.getCurrentConnectionInfo = sinon
              .stub()
              .resolves({connectionType: 'udp', selectedCandidatePairChanges: 2, numTransports: 1});
            meeting.setMercuryListener = sinon.stub();
            meeting.locusInfo.onFullLocus = sinon.stub();
            meeting.webex.meetings.geoHintInfo = {regionCode: 'EU', countryCode: 'UK'};
            meeting.roap.doTurnDiscovery = sinon.stub().resolves({
              turnServerInfo: {
                url: 'turns:turn-server-url:443?transport=tcp',
                username: 'turn user',
                password: 'turn password',
              },
              turnDiscoverySkippedReason: 'reachability',
            });
            meeting.deferSDPAnswer = new Defer();
            meeting.deferSDPAnswer.resolve();
            meeting.webex.meetings.meetingCollection = new MeetingCollection();
            meeting.webex.meetings.meetingCollection.set(meeting);

            StaticConfig.set({bandwidth: {audio: 1234, video: 5678, startBitrate: 9876}});

            // setup things that are expected to be the same across all the tests and are actually irrelevant for these tests
            expectedDebugId = `MC-${meeting.id.substring(0, 4)}`;
            expectedMediaConnectionConfig = {
              iceServers: [
                {
                  urls: 'turn:turn-server-url:5004?transport=tcp',
                  username: 'turn user',
                  credential: 'turn password',
                },
                {
                  urls: 'turns:turn-server-url:443?transport=tcp',
                  username: 'turn user',
                  credential: 'turn password',
                },
              ],
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
            fakeMicrophoneStream = {
              on: sinon.stub(),
              off: sinon.stub(),
              getSettings: sinon.stub().returns({
                deviceId: 'some device id',
              }),
              userMuted: false,
              systemMuted: false,
              get muted() {
                return this.userMuted || this.systemMuted;
              },
              setUnmuteAllowed: sinon.stub(),
              setUserMuted: sinon.stub(),
              setServerMuted: sinon.stub(),
              outputStream: {
                getTracks: () => {
                  return [
                    {
                      id: 'fake mic',
                    },
                  ];
                },
              },
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
              on: sinon.stub(),
              requestMedia: sinon.stub(),
              createReceiveSlot: sinon.stub().resolves({on: sinon.stub()}),
              createSendSlot: sinon.stub().returns({
                publishStream: sinon.stub(),
                unpublishStream: sinon.stub(),
                setNamedMediaGroups: sinon.stub(),
              }),
              enableMultistreamAudio: sinon.stub(),
            };

            roapMediaConnectionConstructorStub = sinon
              .stub(InternalMediaCoreModule, 'RoapMediaConnection')
              .returns(fakeRoapMediaConnection);

            multistreamRoapMediaConnectionConstructorStub = sinon
              .stub(InternalMediaCoreModule, 'MultistreamRoapMediaConnection')
              .returns(fakeMultistreamRoapMediaConnection);

            locusMediaRequestStub = sinon
              .stub(WebexPlugin.prototype, 'request')
              .resolves({body: {locus: {fullState: {}}}});

            // setup some things and mocks so that the call to join() works
            // (we need to call join() because it creates the LocusMediaRequest instance
            // that's being tested in these tests)
            meeting.webex.meetings.registered = true;
            meeting.webex.internal.device.config = {};
            sinon.stub(MeetingUtil, 'joinMeeting').resolves({
              id: 'fake locus from mocked join request',
              locusUrl: 'fake locus url',
              mediaId: 'fake media id',
            });
            await meeting.join({enableMultistream: isMultistream});
          });

          afterEach(() => {
            clock.restore();
            sinon.restore();
          });

          // helper function that waits until all promises are resolved and any queued up /media requests to Locus are sent out
          const stableState = async () => {
            await testUtils.flushPromises();
            clock.tick(1); // needed because LocusMediaRequest uses Lodash.defer()
          };

          const resetHistory = () => {
            locusMediaRequestStub.resetHistory();
            fakeRoapMediaConnection.update.resetHistory();
            try {
              meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream.resetHistory();
            } catch (e) {}
          };

          const getRoapListener = () => {
            const roapMediaConnectionToCheck = isMultistream
              ? fakeMultistreamRoapMediaConnection
              : fakeRoapMediaConnection;

            for (let idx = 0; idx < roapMediaConnectionToCheck.on.callCount; idx += 1) {
              if (
                roapMediaConnectionToCheck.on.getCall(idx).args[0] ===
                MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND
              ) {
                return roapMediaConnectionToCheck.on.getCall(idx).args[1];
              }
            }
            assert.fail(
              'listener for "roap:messageToSend" (MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND) was not registered'
            );
          };

          // simulates a Roap offer being generated by the RoapMediaConnection
          const simulateRoapOffer = async () => {
            meeting.deferSDPAnswer = {resolve: sinon.stub()};
            const roapListener = getRoapListener();

            await roapListener({roapMessage: roapOfferMessage});
            await stableState();
          };

          // simulates a Roap OK being sent
          const simulateRoapOk = async () => {
            const roapListener = getRoapListener();

            await roapListener({roapMessage: roapOKMessage});
            await stableState();
          };

          const checkSdpOfferSent = ({audioMuted, videoMuted}) => {
            const {sdp, seq, tieBreaker} = roapOfferMessage;

            assert.calledWith(locusMediaRequestStub, {
              method: 'PUT',
              uri: `${meeting.selfUrl}/media`,
              body: {
                device: {
                  url: meeting.deviceUrl,
                  deviceType: meeting.config.deviceType,
                  regionCode: 'EU',
                  countryCode: 'UK',
                },
                correlationId: meeting.correlationId,
                localMedias: [
                  {
                    localSdp: `{"audioMuted":${audioMuted},"videoMuted":${videoMuted},"roapMessage":{"messageType":"OFFER","sdps":["${sdp}"],"version":"2","seq":"${seq}","tieBreaker":"${tieBreaker}","headers":["includeAnswerInHttpResponse","noOkInTransaction"]}}`,
                    mediaId: 'fake media id',
                  },
                ],
                clientMediaPreferences: {
                  preferTranscoding: !meeting.isMultistream,
                  joinCookie: undefined,
                  ipver: 0,
                },
              },
            });
          };

          const checkOkSent = ({audioMuted, videoMuted}) => {
            const {seq} = roapOKMessage;

            assert.calledWith(locusMediaRequestStub, {
              method: 'PUT',
              uri: `${meeting.selfUrl}/media`,
              body: {
                device: {
                  url: meeting.deviceUrl,
                  deviceType: meeting.config.deviceType,
                  countryCode: 'UK',
                  regionCode: 'EU',
                },
                correlationId: meeting.correlationId,
                clientMediaPreferences: {
                  preferTranscoding: !meeting.isMultistream,
                  ipver: undefined,
                  joinCookie: undefined,
                },
                localMedias: [
                  {
                    localSdp: `{"audioMuted":${audioMuted},"videoMuted":${videoMuted},"roapMessage":{"messageType":"OK","version":"2","seq":"${seq}"}}`,
                    mediaId: 'fake media id',
                  },
                ],
              },
            });
          };

          const checkLocalMuteSentToLocus = ({audioMuted, videoMuted}) => {
            assert.calledWith(locusMediaRequestStub, {
              method: 'PUT',
              uri: `${meeting.selfUrl}/media`,
              body: {
                device: {
                  url: meeting.deviceUrl,
                  deviceType: meeting.config.deviceType,
                  regionCode: 'EU',
                  countryCode: 'UK',
                },
                correlationId: meeting.correlationId,
                localMedias: [
                  {
                    localSdp: `{"audioMuted":${audioMuted},"videoMuted":${videoMuted}}`,
                    mediaId: 'fake media id',
                  },
                ],
                clientMediaPreferences: {
                  preferTranscoding: !meeting.isMultistream,
                  ipver: undefined,
                },
                respOnlySdp: true,
                usingResource: null,
              },
            });
          };

          const checkMediaConnectionCreated = ({
            mediaConnectionConfig,
            localStreams,
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
                },
                meetingId
              );

              assert.calledWith(
                fakeMultistreamRoapMediaConnection.createSendSlot,
                MediaType.AudioMain,
                direction.audio !== 'inactive'
              );
              assert.calledWith(
                fakeMultistreamRoapMediaConnection.createSendSlot,
                MediaType.VideoMain,
                direction.video !== 'inactive'
              );
              assert.calledWith(
                fakeMultistreamRoapMediaConnection.createSendSlot,
                MediaType.AudioSlides,
                direction.screenShare !== 'inactive'
              );
              assert.calledWith(
                fakeMultistreamRoapMediaConnection.createSendSlot,
                MediaType.VideoSlides,
                direction.screenShare !== 'inactive'
              );

              for (let type in localStreams) {
                const stream = localStreams[type];
                if (stream !== undefined) {
                  switch (type) {
                    case 'audio':
                      if (stream?.readyState === 'ended') {
                        assert.notCalled(
                          meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream
                        );
                      } else {
                        assert.calledOnceWithExactly(
                          meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream,
                          stream
                        );
                      }
                      break;
                    case 'video':
                      if (stream?.readyState === 'ended') {
                        assert.notCalled(
                          meeting.sendSlotManager.getSlot(MediaType.VideoMain).publishStream
                        );
                      } else {
                        assert.calledOnceWithExactly(
                          meeting.sendSlotManager.getSlot(MediaType.VideoMain).publishStream,
                          stream
                        );
                      }
                      break;
                    case 'screenShareAudio':
                      if (stream?.readyState === 'ended') {
                        assert.notCalled(
                          meeting.sendSlotManager.getSlot(MediaType.AudioSlides).publishStream
                        );
                      } else {
                        assert.calledOnceWithExactly(
                          meeting.sendSlotManager.getSlot(MediaType.AudioSlides).publishStream,
                          stream
                        );
                      }
                      break;
                    case 'screenShareVideo':
                      if (stream?.readyState === 'ended') {
                        assert.notCalled(
                          meeting.sendSlotManager.getSlot(MediaType.VideoSlides).publishStream
                        );
                      } else {
                        assert.calledOnceWithExactly(
                          meeting.sendSlotManager.getSlot(MediaType.VideoSlides).publishStream,
                          stream
                        );
                      }
                      break;
                  }
                }
              }
            } else {
              assert.calledOnceWithExactly(
                roapMediaConnectionConstructorStub,
                mediaConnectionConfig,
                {
                  localTracks: {
                    audio: localStreams.audio?.outputStream?.getTracks()[0],
                    video: localStreams.video?.outputStream?.getTracks()[0],
                    screenShareVideo: localStreams.screenShareVideo?.outputStream?.getTracks()[0],
                    screenShareAudio: localStreams.screenShareAudio?.outputStream?.getTracks()[0],
                  },
                  direction: {
                    audio: direction.audio,
                    video: direction.video,
                    screenShareVideo: direction.screenShare,
                  },
                  remoteQualityLevel,
                },
                expectedDebugId
              );
            }
          };

          it('addMedia() works correctly when media is enabled without streams to publish', async () => {
            await meeting.addMedia();
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is enabled with streams to publish', async () => {
            const handleDeviceLoggingSpy = sinon.spy(Meeting, 'handleDeviceLogging');
            await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: fakeMicrophoneStream,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: false, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: false, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);

            assert.calledOnce(handleDeviceLoggingSpy);
          });

          it('addMedia() works correctly when media is enabled with streams to publish and stream is user muted', async () => {
            const handleDeviceLoggingSpy = sinon.spy(Meeting, 'handleDeviceLogging');
            fakeMicrophoneStream.userMuted = true;

            await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: fakeMicrophoneStream,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });
            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
            assert.calledOnce(handleDeviceLoggingSpy);
          });

          it('addMedia() works correctly when media is enabled with tracks to publish and track is ended', async () => {
            fakeMicrophoneStream.readyState = 'ended';

            await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });
            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is enabled with streams to publish and stream is system muted', async () => {
            fakeMicrophoneStream.systemMuted = true;

            await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: fakeMicrophoneStream,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });
            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          it('addMedia() works correctly when media is disabled with streams to publish', async () => {
            const handleDeviceLoggingSpy = sinon.spy(Meeting, 'handleDeviceLogging');
            await meeting.addMedia({
              localStreams: {microphone: fakeMicrophoneStream},
              audioEnabled: false,
            });
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: fakeMicrophoneStream,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'inactive',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
            assert.calledOnce(handleDeviceLoggingSpy);
          });

          it('handleDeviceLogging not called when media is disabled', async () => {
            const handleDeviceLoggingSpy = sinon.spy(Meeting, 'handleDeviceLogging');
            await meeting.addMedia({
              localStreams: {microphone: fakeMicrophoneStream},
              audioEnabled: false,
              videoEnabled: false,
            });
            await simulateRoapOffer();
            await simulateRoapOk();

            assert.notCalled(handleDeviceLoggingSpy);
          });

          it('addMedia() works correctly when media is disabled with no streams to publish', async () => {
            await meeting.addMedia({audioEnabled: false});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'inactive',
                video: 'sendrecv',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          it('addMedia() works correctly when video is disabled with no streams to publish', async () => {
            await meeting.addMedia({videoEnabled: false});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'inactive',
                screenShare: 'recvonly',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          it('addMedia() works correctly when screen share is disabled with no streams to publish', async () => {
            await meeting.addMedia({shareAudioEnabled: false, shareVideoEnabled: false});
            await simulateRoapOffer();
            await simulateRoapOk();

            // check RoapMediaConnection was created correctly
            checkMediaConnectionCreated({
              mediaConnectionConfig: expectedMediaConnectionConfig,
              localStreams: {
                audio: undefined,
                video: undefined,
                screenShareVideo: undefined,
                screenShareAudio: undefined,
              },
              direction: {
                audio: 'sendrecv',
                video: 'sendrecv',
                screenShare: 'inactive',
              },
              remoteQualityLevel: 'HIGH',
              expectedDebugId,
              meetingId: meeting.id,
            });

            // and SDP offer was sent with the right audioMuted/videoMuted values
            checkSdpOfferSent({audioMuted: true, videoMuted: true});
            // check OK was sent with the right audioMuted/videoMuted values
            checkOkSent({audioMuted: true, videoMuted: true});

            // and that these were the only /media requests that were sent
            assert.calledTwice(locusMediaRequestStub);
          });

          describe('publishStreams()/unpublishStreams() calls', () => {
            [
              {mediaEnabled: true, expected: {direction: 'sendrecv', localMuteSentValue: false}},
              {
                mediaEnabled: false,
                expected: {direction: 'inactive', localMuteSentValue: undefined},
              },
            ].forEach(({mediaEnabled, expected}) => {
              it(`first publishStreams() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();
                await simulateRoapOk();

                resetHistory();

                await meeting.publishStreams({microphone: fakeMicrophoneStream});
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
                    meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream,
                    fakeMicrophoneStream
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {
                      audio: fakeMicrophoneStream.outputStream.getTracks()[0],
                      video: null,
                      screenShareVideo: null,
                      screenShareAudio: null,
                    },
                    direction: {
                      audio: expected.direction,
                      video: 'sendrecv',
                      screenShareVideo: 'recvonly',
                    },
                    remoteQualityLevel: 'HIGH',
                  });
                }
              });

              it(`second publishStreams() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();
                await simulateRoapOk();
                await meeting.publishStreams({microphone: fakeMicrophoneStream});
                await stableState();

                resetHistory();

                const fakeMicrophoneStream2 = {
                  on: sinon.stub(),
                  off: sinon.stub(),
                  userMuted: false,
                  systemMuted: false,
                  get muted() {
                    return this.userMuted || this.systemMuted;
                  },
                  setUnmuteAllowed: sinon.stub(),
                  setUserMuted: sinon.stub(),
                  outputStream: {
                    getTracks: () => {
                      return [
                        {
                          id: 'fake mic 2',
                        },
                      ];
                    },
                  },
                };

                await meeting.publishStreams({microphone: fakeMicrophoneStream2});
                await stableState();

                // only the roap media connection should be updated
                if (isMultistream) {
                  assert.calledOnceWithExactly(
                    meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream,
                    fakeMicrophoneStream2
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {
                      audio: fakeMicrophoneStream2.outputStream.getTracks()[0],
                      video: null,
                      screenShareVideo: null,
                      screenShareAudio: null,
                    },
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

              it(`unpublishStreams() call while media is ${
                mediaEnabled ? 'enabled' : 'disabled'
              }`, async () => {
                await meeting.addMedia({audioEnabled: mediaEnabled});
                await simulateRoapOffer();
                await simulateRoapOk();
                await meeting.publishStreams({microphone: fakeMicrophoneStream});
                await stableState();

                resetHistory();

                await meeting.unpublishStreams([fakeMicrophoneStream]);
                await stableState();

                // the roap media connection should be updated
                if (isMultistream) {
                  assert.calledOnce(
                    meeting.sendSlotManager.getSlot(MediaType.AudioMain).unpublishStream
                  );
                } else {
                  assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                    localTracks: {
                      audio: null,
                      video: null,
                      screenShareVideo: null,
                      screenShareAudio: null,
                    },
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
            const addMedia = async (enableMedia, stream) => {
              await meeting.addMedia({
                audioEnabled: enableMedia,
                localStreams: {microphone: stream},
              });
              await simulateRoapOffer();
              await simulateRoapOk();

              resetHistory();
            };

            const checkAudioEnabled = (expectedStream, expectedDirection) => {
              if (isMultistream) {
                assert.equal(
                  meeting.sendSlotManager.getSlot(MediaType.AudioMain).active,
                  expectedDirection !== 'inactive'
                );
              } else {
                assert.calledOnceWithExactly(fakeRoapMediaConnection.update, {
                  localTracks: {
                    audio: expectedStream?.outputStream.getTracks()[0] ?? null,
                    video: null,
                    screenShareVideo: null,
                    screenShareAudio: null,
                  },
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

              // simulate OK being sent in response to remote answer being received
              await simulateRoapOk();

              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledTwice(locusMediaRequestStub);
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

              // simulate OK being sent in response to remote answer being received
              await simulateRoapOk();

              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledTwice(locusMediaRequestStub);
            });

            it('updateMedia() disables media when stream is published', async () => {
              await addMedia(true, fakeMicrophoneStream);

              await meeting.updateMedia({audioEnabled: false});
              await stableState();

              // the roap media connection should be updated
              checkAudioEnabled(fakeMicrophoneStream, 'inactive');

              checkLocalMuteSentToLocus({audioMuted: true, videoMuted: true});

              locusMediaRequestStub.resetHistory();

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: true, videoMuted: true});

              // simulate OK being sent in response to remote answer being received
              await simulateRoapOk();

              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: true, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledTwice(locusMediaRequestStub);
            });

            it('updateMedia() enables media when stream is published', async () => {
              await addMedia(false, fakeMicrophoneStream);

              await meeting.updateMedia({audioEnabled: true});
              await stableState();

              // the roap media connection should be updated
              checkAudioEnabled(fakeMicrophoneStream, 'sendrecv');

              checkLocalMuteSentToLocus({audioMuted: false, videoMuted: true});

              locusMediaRequestStub.resetHistory();

              // and that would trigger a new offer so we simulate it happening
              await simulateRoapOffer();

              // check SDP offer was sent with the right audioMuted/videoMuted values
              checkSdpOfferSent({audioMuted: false, videoMuted: true});

              // simulate OK being sent in response to remote answer being received
              await simulateRoapOk();

              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: false, videoMuted: true});

              // and no other local mute requests were sent to Locus
              assert.calledTwice(locusMediaRequestStub);
            });
          });

          [
            {mute: true, title: 'user muting a track before confluence is created'},
            {mute: false, title: 'user unmuting a track before confluence is created'},
          ].forEach(({mute, title}) =>
            it(title, async () => {
              // initialize the microphone mute state to opposite of what we do in the test
              fakeMicrophoneStream.userMuted = !mute;

              await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
              await stableState();

              resetHistory();

              assert.equal(
                fakeMicrophoneStream.on.getCall(0).args[0],
                LocalStreamEventNames.UserMuteStateChange
              );
              const mutedListener = fakeMicrophoneStream.on.getCall(0).args[1];
              // simulate track being muted
              fakeMicrophoneStream.userMuted = mute;
              mutedListener(mute);

              await stableState();

              // nothing should happen
              assert.notCalled(locusMediaRequestStub);
              assert.notCalled(fakeRoapMediaConnection.update);

              // now simulate roap offer and ok
              await simulateRoapOffer();
              await simulateRoapOk();

              // it should be sent with the right mute status
              checkSdpOfferSent({audioMuted: mute, videoMuted: true});
              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: mute, videoMuted: true});

              // nothing else should happen
              assert.calledTwice(locusMediaRequestStub);
              assert.notCalled(fakeRoapMediaConnection.update);
            })
          );

          [
            {mute: true, title: 'system muting a track before confluence is created'},
            {mute: false, title: 'system unmuting a track before confluence is created'},
          ].forEach(({mute, title}) =>
            it(title, async () => {
              // initialize the microphone mute state to opposite of what we do in the test
              fakeMicrophoneStream.systemMuted = !mute;

              await meeting.addMedia({localStreams: {microphone: fakeMicrophoneStream}});
              await stableState();

              resetHistory();

              assert.equal(
                fakeMicrophoneStream.on.getCall(0).args[0],
                LocalStreamEventNames.UserMuteStateChange
              );
              const mutedListener = fakeMicrophoneStream.on.getCall(0).args[1];
              // simulate track being muted
              fakeMicrophoneStream.systemMuted = mute;
              mutedListener(mute);

              await stableState();

              // nothing should happen
              assert.notCalled(locusMediaRequestStub);
              assert.notCalled(fakeRoapMediaConnection.update);

              // now simulate roap offer and ok
              await simulateRoapOffer();
              await simulateRoapOk();

              // it should be sent with the right mute status
              checkSdpOfferSent({audioMuted: mute, videoMuted: true});
              // check OK was sent with the right audioMuted/videoMuted values
              checkOkSent({audioMuted: mute, videoMuted: true});

              // nothing else should happen
              assert.calledTwice(locusMediaRequestStub);
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
          meeting.cleanupLocalStreams = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteStreams').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetRemoteStreams = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetPeerConnections = sinon.stub().returns(true);
          meeting.logger.error = sinon.stub().returns(true);
          meeting.updateLLMConnection = sinon.stub().returns(Promise.resolve());
          webex.internal.voicea.off = sinon.stub().returns(true);

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
          assert.calledOnce(meeting.cleanupLocalStreams);
          assert.calledOnce(meeting.closeRemoteStreams);
          assert.calledOnce(meeting.closePeerConnections);
          assert.calledOnce(meeting.unsetRemoteStreams);
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

        it('should send client.call.leave after meetingRequest.leaveMeeting', async () => {
          const leave = meeting.leave({clientEventLeaveReason: 'ended-by-locus'});

          await leave;

          assert.calledOnceWithExactly(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.call.leave',
            payload: {
              trigger: 'user-interaction',
              canProceed: false,
              leaveReason: 'ended-by-locus',
            },
            options: {meetingId: meeting.id},
          });

          assert(
            webex.internal.newMetrics.submitClientEvent.calledAfter(
              meeting.meetingRequest.leaveMeeting
            )
          );
        });

        it('should send client.call.leave after meetingRequest.leaveMeeting when erroring', async () => {
          meeting.meetingRequest.leaveMeeting = sinon
            .stub()
            .returns(Promise.reject(new Error('forced')));

          await assert.isRejected(meeting.leave());

          assert.calledOnceWithExactly(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.call.leave',
            payload: {
              trigger: 'user-interaction',
              canProceed: false,
              leaveReason: undefined,
              errors: [
                {
                  fatal: false,
                  errorDescription: 'forced',
                  category: 'signaling',
                  errorCode: 1000,
                  name: 'client.leave',
                  shownToUser: false,
                },
              ],
            },
            options: {meetingId: meeting.id},
          });

          assert(
            webex.internal.newMetrics.submitClientEvent.calledAfter(
              meeting.meetingRequest.leaveMeeting
            )
          );
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
          meeting.mediaProperties.shareVideoStream = {};
          meeting.mediaProperties.mediaDirection.sendShare = true;
          meeting.deviceUrl = 'deviceUrl.com';
          meeting.state = 'JOINED';
          meeting.localShareInstanceId = '1234-5678';
        });

        afterEach(() => {
          sinon.restore();
        });

        it('should send the share', async () => {
          const share = meeting.requestScreenShareFloor();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);

          assert.calledWith(meeting.meetingRequest.changeMeetingFloor, {
            disposition: FLOOR_ACTION.GRANTED,
            personUrl: url1,
            deviceUrl: 'deviceUrl.com',
            uri: url1,
            resourceUrl: undefined,
            shareInstanceId: '1234-5678',
          });

          assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.share.floor-grant.request',
            payload: {mediaType: 'share', shareInstanceId: '1234-5678'},
            options: {meetingId: meeting.id},
          });
        });

        it('should submit expected metric on failure', async () => {
          const error = new Error('forced');

          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.reject(error));
          const getChangeMeetingFloorErrorPayloadSpy = sinon
            .stub(MeetingUtil, 'getChangeMeetingFloorErrorPayload')
            .returns('foo');

          await meeting.requestScreenShareFloor().catch((err) => {
            assert.equal(err, error);
          });

          assert.calledWith(meeting.meetingRequest.changeMeetingFloor, {
            disposition: 'GRANTED',
            personUrl: url1,
            deviceUrl: 'deviceUrl.com',
            uri: url1,
            resourceUrl: undefined,
            shareInstanceId: '1234-5678',
          });

          assert.calledWith(getChangeMeetingFloorErrorPayloadSpy, 'forced');

          // ensure the expected CA share metric is submitted
          assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
            name: 'client.share.floor-granted.local',
            payload: {mediaType: 'share', errors: 'foo', shareInstanceId: '1234-5678'},
            options: {meetingId: meeting.id},
          });
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

        const createFakeLocalStream = () => ({
          outputStream: {
            getTracks: () => {
              return [{id: 'fake underlying track'}];
            },
          },
        });
        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.audio = {enable: sinon.stub()};
          meeting.video = {enable: sinon.stub()};
          meeting.mediaProperties.audioStream = createFakeLocalStream();
          meeting.mediaProperties.videoStream = createFakeLocalStream();
          meeting.mediaProperties.shareVideoStream = createFakeLocalStream();
          meeting.mediaProperties.shareAudioStream = createFakeLocalStream();
          meeting.mediaProperties.mediaDirection = {
            sendAudio: true,
            sendVideo: true,
            sendShare: true,
            receiveAudio: true,
            receiveVideo: true,
            receiveShare: true,
          };
          const fakeMultistreamRoapMediaConnection = {
            createSendSlot: () => {},
          };
          sinon.stub(fakeMultistreamRoapMediaConnection, 'createSendSlot').returns({active: true});
          meeting.sendSlotManager.createSlot(
            fakeMultistreamRoapMediaConnection,
            MediaType.AudioMain
          );
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
          sinon.restore();
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

              assert.equal(
                meeting.sendSlotManager.getSlot(MediaType.AudioMain).active,
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
              audio: meeting.mediaProperties.audioStream.outputStream.getTracks()[0],
              video: meeting.mediaProperties.videoStream.outputStream.getTracks()[0],
              screenShareVideo:
                meeting.mediaProperties.shareVideoStream.outputStream.getTracks()[0],
              screenShareAudio:
                meeting.mediaProperties.shareVideoStream.outputStream.getTracks()[0],
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
            meeting.mediaProperties.remoteVideoStream = sinon.stub().returns({
              outputStream: {
                getTracks: () => {
                  id: 'some mock id';
                },
              },
            });

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
            assert.exists(meeting.mediaProperties.remoteVideoStream);
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
            meeting.mediaProperties.remoteShareStream = sinon
              .stub()
              .returns({mockTrack: 'mockTrack'});

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
            meeting.mediaProperties.remoteShareStream = sinon
              .stub()
              .returns({mockTrack: 'mockTrack'});

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
            meeting.mediaProperties.remoteShareStream = sinon
              .stub()
              .returns({mockTrack: 'mockTrack'});

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
        const FAKE_TYPE = DESTINATION_TYPE.SIP_URI;
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
          permissionToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb2NrUGFzc3dvcmQiOiJ0aGlzSXNNb2NrUGFzc3dvcmQifQ.3-WXiR8vhGUH3VXO0DTpsTwnnkVQ3vhGQcktwIarj3I',
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
          FAKE_OPTIONS = {meetingId: meeting.id, sendCAevents: true};
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
          meeting.updateMeetingActions = sinon.stub().returns(undefined);

          await meeting.fetchMeetingInfo({
            password: FAKE_PASSWORD,
            captchaCode: FAKE_CAPTCHA_CODE,
            extraParams: FAKE_EXTRA_PARAMS,
            sendCAevents: true,
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

          assert.calledWith(meeting.parseMeetingInfo, FAKE_MEETING_INFO, FAKE_DESTINATION);
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.calledThrice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
          assert.calledWith(meeting.updateMeetingActions);
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
          meeting.updateMeetingActions = sinon.stub().returns(undefined);
          meeting.fetchMeetingInfoTimeoutId = FAKE_TIMEOUT_FETCHMEETINGINFO_ID;

          const clock = sinon.useFakeTimers();
          const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

          await meeting.fetchMeetingInfo({sendCAevents: false});

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
            {meetingId: meeting.id, sendCAevents: false}
          );

          // parseMeeting info
          assert.calledWith(meeting.parseMeetingInfo, FAKE_MEETING_INFO, FAKE_DESTINATION);

          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledThrice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
          assert.calledWith(meeting.updateMeetingActions);
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

          await assert.isRejected(meeting.fetchMeetingInfo({sendCAevents: true}), PasswordError);

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            null,
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id, sendCAevents: true}
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

          await assert.isRejected(meeting.fetchMeetingInfo({sendCAevents: true}), PermissionError);

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            null,
            null,
            undefined,
            'locus-id',
            {},
            {meetingId: meeting.id, sendCAevents: true}
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
              sendCAevents: true,
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
            {meetingId: meeting.id, sendCAevents: true}
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
              sendCAevents: true,
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
            {meetingId: meeting.id, sendCAevents: true}
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
            sendCAevents: true,
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
            {meetingId: meeting.id, sendCAevents: true}
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
              sendCAevents: true,
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
            {meetingId: meeting.id, sendCAevents: true}
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

      describe('#injectMeetingInfo', () => {
        const FAKE_PASSWORD = '123456';
        const FAKE_CAPTCHA_CODE = '654321';
        const FAKE_DESTINATION = 'something@somecompany.com';
        const FAKE_TYPE = DESTINATION_TYPE.SIP_URI;
        const FAKE_INSTALLED_ORG_ID = '123456';
        const FAKE_MEETING_INFO_LOOKUP_URL = 'meetingLookupUrl';

        const FAKE_SDK_CAPTCHA_INFO = {};
        const FAKE_MEETING_INFO = {
          conversationUrl: 'some_convo_url',
          locusUrl: 'some_locus_url',
          sipUrl: 'some_sip_url', // or sipMeetingUri
          meetingNumber: '123456', // this.config.experimental.enableUnifiedMeetings
          hostId: 'some_host_id', // this.owner;
          permissionToken:
            'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
        };

        [
          {
            input: {
              meetingInfo: FAKE_MEETING_INFO,
              meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
            },
            expected: {
              meetingInfo: {
                ...FAKE_MEETING_INFO,
                meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
              },
            },
          },
          {
            input: {
              meetingInfo: undefined,
              meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
            },
            expected: {meetingInfo: null},
          },
          ,
          {
            input: {
              meetingInfo: FAKE_MEETING_INFO,
              meetingLookupUrl: undefined,
            },
            expected: {
              meetingInfo: {
                ...FAKE_MEETING_INFO,
                meetingLookupUrl: undefined,
              },
            },
          },
          ,
          {
            input: {
              meetingInfo: undefined,
              meetingLookupUrl: undefined,
            },
            expected: {meetingInfo: null},
          },
        ].forEach(({input, expected}) => {
          it(`calls meetingInfoProvider with all the right parameters and parses the result when ${JSON.stringify(
            input
          )}`, async () => {
            meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
            meeting.destination = FAKE_DESTINATION;
            meeting.destinationType = FAKE_TYPE;
            meeting.config.installedOrgID = FAKE_INSTALLED_ORG_ID;
            meeting.parseMeetingInfo = sinon.stub().returns(undefined);
            meeting.updateMeetingActions = sinon.stub().returns(undefined);

            await meeting.injectMeetingInfo(
              input.meetingInfo,
              {sendCAevents: true},
              input.meetingLookupUrl
            );

            assert.calledWith(meeting.parseMeetingInfo, input.meetingInfo, FAKE_DESTINATION);
            assert.deepEqual(meeting.meetingInfo, expected.meetingInfo);
            assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);
            assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
            assert.equal(meeting.requiredCaptcha, null);
            assert.calledThrice(TriggerProxy.trigger);
            assert.calledWith(
              TriggerProxy.trigger,
              meeting,
              {file: 'meetings', function: 'fetchMeetingInfo'},
              'meeting:meetingInfoAvailable'
            );
            assert.calledWith(meeting.updateMeetingActions);
          });
        });

        it('fails if captchaCode is provided when captcha not needed', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().resolves(),
          };
          meeting.requiredCaptcha = null;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(
            meeting.injectMeetingInfo(
              {},
              {
                captchaCode: FAKE_CAPTCHA_CODE,
              }
            ),
            Error,
            'injectMeetingInfo() called with captchaCode when captcha was not required'
          );

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.calledTwice(TriggerProxy.trigger); //meetingInfoAvailable event not triggered
          assert.neverCalledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
        });

        it('fails if password is provided when not required', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().resolves(),
          };
          meeting.passwordStatus = PASSWORD_STATUS.NOT_REQUIRED;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(
            meeting.injectMeetingInfo(
              {},
              {
                password: FAKE_PASSWORD,
              }
            ),
            Error,
            'injectMeetingInfo() called with password when password was not required'
          );

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.calledTwice(TriggerProxy.trigger); //meetingInfoAvailable event not triggered
          assert.neverCalledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
        });

        it('should clean the fetch meeting info timeout', async () => {
          meeting.fetchMeetingInfoTimeoutId = 42; // pending delayed request

          await meeting.injectMeetingInfo(FAKE_MEETING_INFO, {
            sendCAevents: true,
          });

          assert.equal(meeting.fetchMeetingInfoTimeoutId, undefined);
        });
      });

      describe('#refreshPermissionToken', () => {
        const FAKE_MEETING_INFO = {
          conversationUrl: 'some_convo_url',
          locusUrl: 'some_locus_url',
          sipUrl: 'some_sip_url',
          meetingNumber: '123456',
          hostId: 'some_host_id',
          permissionToken:
            'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
        };
        const FAKE_MEETING_INFO_LOOKUP_URL = 'meetingLookupUrl';
        const FAKE_PERMISSION_TOKEN = {someField: 'some value'};
        const FAKE_TIMESTAMPS = {timeLeft: 13, expiryTime: 123456, currentTime: 123478};

        beforeEach(() => {
          meeting.locusId = 'locus-id';
          meeting.id = 'meeting-id';
          meeting.config.installedOrgID = 'fake-installed-org-id';
          meeting.meetingInfo.permissionToken = FAKE_PERMISSION_TOKEN;
          meeting.destination = 'meeting-destination';
          meeting.destinationType = 'meeting-destination-type';
          meeting.updateMeetingActions = sinon.stub().returns(undefined);

          meeting.meetingInfoExtraParams = {
            extraParam1: 'value1',
          };
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .resolves({body: FAKE_MEETING_INFO, url: FAKE_MEETING_INFO_LOOKUP_URL}),
          };
        });

        it('resolves without doing anything if there is no permission token', async () => {
          meeting.meetingInfo.permissionToken = undefined;

          await meeting.refreshPermissionToken();

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.notCalled(Metrics.sendBehavioralMetric);
        });

        it('calls meetingInfoProvider.fetchMeetingInfo() with the right params', async () => {
          meeting.getPermissionTokenExpiryInfo = sinon.stub().returns(FAKE_TIMESTAMPS);
          await meeting.refreshPermissionToken('fake reason');

          assert.calledOnceWithExactly(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            'meeting-destination',
            'meeting-destination-type',
            null,
            null,
            'fake-installed-org-id',
            'locus-id',
            {extraParam1: 'value1', permissionToken: FAKE_PERMISSION_TOKEN},
            {meetingId: meeting.id, sendCAevents: true}
          );
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH,
            {
              correlationId: meeting.correlationId,
              timeLeft: FAKE_TIMESTAMPS.timeLeft,
              expiryTime: FAKE_TIMESTAMPS.expiryTime,
              currentTime: FAKE_TIMESTAMPS.currentTime,
              reason: 'fake reason',
              destinationType: 'meeting-destination-type',
            }
          );
        });

        it('calls meetingInfoProvider.fetchMeetingInfo() with the right params when getPermissionTokenExpiryInfo returns undefined', async () => {
          meeting.getPermissionTokenExpiryInfo = sinon.stub().returns(undefined);
          await meeting.refreshPermissionToken('fake reason');

          assert.calledOnceWithExactly(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            'meeting-destination',
            'meeting-destination-type',
            null,
            null,
            'fake-installed-org-id',
            'locus-id',
            {extraParam1: 'value1', permissionToken: FAKE_PERMISSION_TOKEN},
            {meetingId: meeting.id, sendCAevents: true}
          );
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH,
            {
              correlationId: meeting.correlationId,
              timeLeft: undefined,
              expiryTime: undefined,
              currentTime: undefined,
              reason: 'fake reason',
              destinationType: 'meeting-destination-type',
            }
          );
        });

        it('calls meetingInfoProvider.fetchMeetingInfo() with the right params when we are starting an instant space meeting', async () => {
          meeting.getPermissionTokenExpiryInfo = sinon.stub().returns(FAKE_TIMESTAMPS);
          meeting.destination = 'some-convo-url';
          meeting.destinationType = 'CONVERSATION_URL';
          meeting.config.experimental = {enableAdhocMeetings: true};
          meeting.meetingInfo.meetingJoinUrl = 'meeting-join-url';
          meeting.webex.meetings.preferredWebexSite = 'preferredWebexSite';

          await meeting.refreshPermissionToken('some reason');

          assert.calledOnceWithExactly(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            'meeting-join-url',
            'MEETING_LINK',
            null,
            null,
            'fake-installed-org-id',
            'locus-id',
            {
              extraParam1: 'value1',
              permissionToken: FAKE_PERMISSION_TOKEN,
            },
            {meetingId: meeting.id, sendCAevents: true}
          );
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
            meetingLookupUrl: FAKE_MEETING_INFO_LOOKUP_URL,
          });
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meetings', function: 'fetchMeetingInfo'},
            'meeting:meetingInfoAvailable'
          );
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH,
            {
              correlationId: meeting.correlationId,
              timeLeft: FAKE_TIMESTAMPS.timeLeft,
              expiryTime: FAKE_TIMESTAMPS.expiryTime,
              currentTime: FAKE_TIMESTAMPS.currentTime,
              reason: 'some reason',
              destinationType: 'MEETING_LINK',
            }
          );
        });

        it('throws PermissionError if policy error is encountered', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2PolicyError(123456, FAKE_MEETING_INFO, 'a message')),
          };

          await assert.isRejected(meeting.refreshPermissionToken());

          assert.calledOnce(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
          });
          assert.equal(meeting.meetingInfoFailureCode, 123456);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.POLICY);
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH_ERROR,
            {
              correlationId: meeting.correlationId,
              reason:
                'Not allowed to execute the function, some properties on server, or local client state do not allow you to complete this action.',
              stack: sinon.match.any,
            }
          );
        });

        it('throws PasswordError if password is required', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2PasswordError(403004, FAKE_MEETING_INFO)),
          };

          await assert.isRejected(meeting.refreshPermissionToken());

          assert.calledOnce(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.deepEqual(meeting.meetingInfo, {
            ...FAKE_MEETING_INFO,
          });
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH_ERROR,
            {
              correlationId: meeting.correlationId,
              reason: 'Password is required, please use verifyPassword()',
              stack: sinon.match.any,
            }
          );
        });

        it('throws CaptchaError if captcha is required', async () => {
          const FAKE_SDK_CAPTCHA_INFO = {
            captchaId: 'FAKE_CAPTCHA_ID',
            verificationImageURL: 'FAKE_CAPTCHA_IMAGE_URL',
            verificationAudioURL: 'FAKE_CAPTCHA_AUDIO_URL',
            refreshURL: 'FAKE_CAPTCHA_REFRESH_URL',
          };
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon
              .stub()
              .throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO)),
          };

          await assert.isRejected(meeting.refreshPermissionToken());

          assert.calledOnce(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.requiredCaptcha, FAKE_SDK_CAPTCHA_INFO);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.calledWith(meeting.updateMeetingActions);

          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.PERMISSION_TOKEN_REFRESH_ERROR,
            {
              correlationId: meeting.correlationId,
              reason: 'Captcha is required.',
              stack: sinon.match.any,
            }
          );
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
            sendCAevents: false,
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
          meeting.cleanupLocalStreams = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteStreams').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetRemoteStreams = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetPeerConnections = sinon.stub().returns(true);
          meeting.logger.error = sinon.stub().returns(true);
          meeting.updateLLMConnection = sinon.stub().returns(Promise.resolve());
          meeting.transcription = {};
          meeting.stopTranscription = sinon.stub();

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
          assert.calledOnce(meeting?.cleanupLocalStreams);
          assert.calledOnce(meeting?.closeRemoteStreams);
          assert.calledOnce(meeting?.closePeerConnections);
          assert.calledOnce(meeting?.unsetRemoteStreams);
          assert.calledOnce(meeting?.unsetPeerConnections);
          assert.calledOnce(meeting?.stopTranscription);
        });
      });

      describe('#moveTo', () => {
        let sandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.statsAnalyzer = {
            stopAnalyzer: sinon.stub().returns(Promise.resolve()),
          };

          meeting.reconnectionManager = {
            cleanUp: sinon.stub(),
          };

          meeting.cleanupLocalStreams = sinon.stub();
          meeting.closeRemoteStreams = sinon.stub().returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetRemoteStreams = sinon.stub();
          meeting.unsetPeerConnections = sinon.stub();
          meeting.addMedia = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.setMediaDirection = sinon.stub();

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

        it('should cleanup on moveTo & addMedia after', async () => {
          await meeting.moveTo('resourceId');

          assert.equal(meeting.isMoveToInProgress, true);

          await meeting.locusInfo.emitScoped(
            {
              file: 'locus-info',
              function: 'updateSelf',
            },
            'SELF_OBSERVING'
          );

          // Verify that the event handler behaves as expected
          expect(meeting.statsAnalyzer.stopAnalyzer.calledOnce).to.be.true;
          expect(meeting.closeRemoteStreams.calledOnce).to.be.true;
          await testUtils.flushPromises();
          expect(meeting.closePeerConnections.calledOnce).to.be.true;
          await testUtils.flushPromises();
          expect(meeting.cleanupLocalStreams.calledOnce).to.be.true;
          expect(meeting.unsetRemoteStreams.calledOnce).to.be.true;
          expect(meeting.unsetPeerConnections.calledOnce).to.be.true;
          expect(meeting.reconnectionManager.cleanUp.calledOnce).to.be.true;
          expect(meeting.mediaProperties.setMediaDirection.calledOnce).to.be.true;
          expect(
            meeting.addMedia.calledOnceWithExactly({
              audioEnabled: false,
              videoEnabled: false,
              shareVideoEnabled: true,
            })
          ).to.be.true;
          await testUtils.flushPromises();
          assert.equal(meeting.isMoveToInProgress, false);
        });

        it('should throw an error if moveTo call fails', async () => {
          MeetingUtil.joinMeeting = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveTo('resourceId');
          } catch {
            assert.equal(meeting.isMoveToInProgress, false);
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
            assert.equal(meeting.isMoveToInProgress, false);
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

      describe('#setCorrelationId', () => {
        it('should set the correlationId and return undefined', () => {
          assert.equal(meeting.correlationId, correlationId);
          assert.deepEqual(meeting.callStateForMetrics, {correlationId});
          meeting.setCorrelationId(uuid1);
          assert.equal(meeting.correlationId, uuid1);
          assert.deepEqual(meeting.callStateForMetrics, {correlationId: uuid1});
        });
      });

      describe('#updateCallStateForMetrics', () => {
        it('should update the callState, overriding existing values', () => {
          assert.deepEqual(meeting.callStateForMetrics, {correlationId});
          meeting.updateCallStateForMetrics({
            correlationId: uuid1,
            joinTrigger: 'jt',
            loginType: 'lt',
          });
          assert.deepEqual(meeting.callStateForMetrics, {
            correlationId: uuid1,
            joinTrigger: 'jt',
            loginType: 'lt',
          });
        });

        it('should update the callState, keeping non-supplied values', () => {
          assert.deepEqual(meeting.callStateForMetrics, {correlationId});
          meeting.updateCallStateForMetrics({joinTrigger: 'jt', loginType: 'lt'});
          assert.deepEqual(meeting.callStateForMetrics, {
            correlationId,
            joinTrigger: 'jt',
            loginType: 'lt',
          });
        });
      });

      describe('Local tracks publishing', () => {
        let audioStream;
        let videoStream;
        let audioShareStream;
        let videoShareStream;
        let fakeMultistreamRoapMediaConnection;

        beforeEach(() => {
          audioStream = {
            getSettings: sinon.stub().returns({
              deviceId: 'some device id',
            }),
            on: sinon.stub(),
            off: sinon.stub(),
          };

          videoStream = {
            getSettings: sinon.stub().returns({
              deviceId: 'some device id',
            }),
            on: sinon.stub(),
            off: sinon.stub(),
          };

          audioShareStream = {
            on: sinon.stub(),
            off: sinon.stub(),
            getSettings: sinon.stub().returns({
              deviceId: 'some device id',
            }),
          };

          videoShareStream = {
            on: sinon.stub(),
            off: sinon.stub(),
            getSettings: sinon.stub().returns({
              deviceId: 'some device id',
            }),
          };

          meeting.requestScreenShareFloor = sinon.stub().resolves({});
          meeting.releaseScreenShareFloor = sinon.stub().resolves({});
          meeting.mediaProperties.mediaDirection = {
            sendAudio: 'fake value', // using non-boolean here so that we can check that these values are untouched in tests
            sendVideo: 'fake value',
            sendShare: false,
          };
          meeting.isMultistream = true;
          meeting.mediaProperties.webrtcMediaConnection = {};
          meeting.audio = {handleLocalStreamChange: sinon.stub()};
          meeting.video = {handleLocalStreamChange: sinon.stub()};
          meeting.statsAnalyzer = {updateMediaStatus: sinon.stub()};
          fakeMultistreamRoapMediaConnection = {
            createSendSlot: () => {
              return {
                publishStream: sinon.stub(),
                unpublishStream: sinon.stub(),
              };
            },
          };
          meeting.sendSlotManager.createSlot(
            fakeMultistreamRoapMediaConnection,
            MediaType.VideoSlides
          );
          meeting.sendSlotManager.createSlot(
            fakeMultistreamRoapMediaConnection,
            MediaType.AudioSlides
          );
          meeting.sendSlotManager.createSlot(
            fakeMultistreamRoapMediaConnection,
            MediaType.AudioMain
          );
          meeting.sendSlotManager.createSlot(
            fakeMultistreamRoapMediaConnection,
            MediaType.VideoMain
          );
        });
        afterEach(() => {
          sinon.restore();
        });
        describe('#publishStreams', () => {
          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(meeting.publishStreams({audio: {id: 'some audio track'}}));
          });

          const checkAudioPublished = (stream) => {
            assert.calledOnceWithExactly(meeting.audio.handleLocalStreamChange, meeting);
            assert.calledWith(
              meeting.sendSlotManager.getSlot(MediaType.AudioMain).publishStream,
              stream
            );
            assert.equal(meeting.mediaProperties.audioStream, stream);
            // check that sendAudio hasn't been touched
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, 'fake value');
          };

          const checkVideoPublished = (stream) => {
            assert.calledOnceWithExactly(meeting.video.handleLocalStreamChange, meeting);
            assert.calledWith(
              meeting.sendSlotManager.getSlot(MediaType.VideoMain).publishStream,
              stream
            );
            assert.equal(meeting.mediaProperties.videoStream, stream);
            // check that sendVideo hasn't been touched
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, 'fake value');
          };

          const checkScreenShareVideoPublished = (stream) => {
            assert.calledOnce(meeting.requestScreenShareFloor);

            // ensure the CA share metrics are submitted
            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.share.initiated',
              payload: {mediaType: 'share', shareInstanceId: meeting.localShareInstanceId},
              options: {meetingId: meeting.id},
            });
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, true);

            assert.calledWith(meeting.statsAnalyzer.updateMediaStatus, {
              expected: {sendShare: true},
            });
          };

          const checkScreenShareAudioPublished = (stream) => {
            // ensure the CA share metrics are submitted
            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.share.initiated',
              payload: {mediaType: 'share', shareInstanceId: meeting.localShareInstanceId},
              options: {meetingId: meeting.id},
            });

            assert.calledWith(
              meeting.sendSlotManager.getSlot(MediaType.AudioSlides).publishStream,
              stream
            );
            assert.equal(meeting.mediaProperties.shareAudioStream, stream);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, true);

            assert.calledWith(meeting.statsAnalyzer.updateMediaStatus, {
              expected: {sendShare: true},
            });
          };

          it('requests screen share floor and publishes the screen share video stream', async () => {
            await meeting.publishStreams({screenShare: {video: videoShareStream}});

            checkScreenShareVideoPublished(videoShareStream);
          });

          it('requests screen share floor and publishes the screen share audio stream', async () => {
            await meeting.publishStreams({screenShare: {audio: audioShareStream}});

            checkScreenShareAudioPublished(audioShareStream);
          });

          it('does not request screen share floor when publishing video share stream if already sharing audio', async () => {
            await meeting.publishStreams({screenShare: {audio: audioShareStream}});
            assert.calledOnce(meeting.requestScreenShareFloor);

            meeting.requestScreenShareFloor.reset();
            await meeting.publishStreams({screenShare: {video: videoShareStream}});
            assert.notCalled(meeting.requestScreenShareFloor);
          });

          it('does not request screen share floor when publishing audio share stream if already sharing video', async () => {
            await meeting.publishStreams({screenShare: {video: videoShareStream}});
            assert.calledOnce(meeting.requestScreenShareFloor);

            meeting.requestScreenShareFloor.reset();
            await meeting.publishStreams({screenShare: {audio: audioShareStream}});
            assert.notCalled(meeting.requestScreenShareFloor);
          });

          it('updates MuteState instance and publishes the stream for main audio', async () => {
            await meeting.publishStreams({microphone: audioStream});

            checkAudioPublished(audioStream);
          });

          it('updates MuteState instance and publishes the stream for main video', async () => {
            await meeting.publishStreams({camera: videoStream});

            checkVideoPublished(videoStream);
          });

          it('publishes audio, video and screen share together', async () => {
            await meeting.publishStreams({
              microphone: audioStream,
              camera: videoStream,
              screenShare: {
                video: videoShareStream,
                audio: audioShareStream,
              },
            });

            checkAudioPublished(audioStream);
            checkVideoPublished(videoStream);
            checkScreenShareVideoPublished(videoShareStream);
            checkScreenShareAudioPublished(audioShareStream);
          });

          [
            {
              endedStream: 'microphone',
              streams: {
                microphone: {
                  readyState: 'ended',
                },
                camera: undefined,
                screenShare: {
                  audio: undefined,
                  video: undefined,
                },
              },
            },
            {
              endedStream: 'camera',
              streams: {
                microphone: undefined,
                camera: {
                  readyState: 'ended',
                },
                screenShare: {
                  audio: undefined,
                  video: undefined,
                },
              },
            },
            {
              endedStream: 'screenShare audio',
              streams: {
                microphone: undefined,
                camera: undefined,
                screenShare: {
                  audio: {
                    readyState: 'ended',
                  },
                  video: undefined,
                },
              },
            },
            {
              endedStream: 'screenShare video',
              streams: {
                microphone: undefined,
                camera: undefined,
                screenShare: {
                  audio: undefined,
                  video: {
                    readyState: 'ended',
                  },
                },
              },
            },
          ].forEach(({endedStream, streams}) => {
            it(`throws error if readyState of ${endedStream} is ended`, async () => {
              assert.isRejected(meeting.publishStreams(streams));
            });
          });
        });

        describe('unpublishStreams', () => {
          beforeEach(async () => {
            await meeting.publishStreams({
              microphone: audioStream,
              camera: videoStream,
              screenShare: {video: videoShareStream, audio: audioShareStream},
            });
          });

          const checkAudioUnpublished = () => {
            assert.calledOnce(meeting.sendSlotManager.getSlot(MediaType.AudioMain).unpublishStream);

            assert.equal(meeting.mediaProperties.audioStream, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, 'fake value');
          };

          const checkVideoUnpublished = () => {
            assert.calledOnce(meeting.sendSlotManager.getSlot(MediaType.VideoMain).unpublishStream);

            assert.equal(meeting.mediaProperties.videoStream, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, 'fake value');
          };

          // share direction will remain true if only one of the two share streams are unpublished
          const checkScreenShareVideoUnpublished = (shareDirection = true) => {
            assert.calledOnce(
              meeting.sendSlotManager.getSlot(MediaType.VideoSlides).unpublishStream
            );

            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.equal(meeting.mediaProperties.shareVideoStream, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, shareDirection);
            if (!shareDirection) {
              assert.calledWith(meeting.statsAnalyzer.updateMediaStatus, {
                expected: {sendShare: false},
              });
            }
          };

          // share direction will remain true if only one of the two share streams are unpublished
          const checkScreenShareAudioUnpublished = (shareDirection = true) => {
            assert.calledOnce(
              meeting.sendSlotManager.getSlot(MediaType.AudioSlides).unpublishStream
            );

            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.equal(meeting.mediaProperties.shareAudioStream, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, shareDirection);
            if (!shareDirection) {
              assert.calledWith(meeting.statsAnalyzer.updateMediaStatus, {
                expected: {sendShare: false},
              });
            }
          };

          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(
              meeting.unpublishStreams([
                audioStream,
                videoStream,
                videoShareStream,
                audioShareStream,
              ])
            );
          });

          it('un-publishes the streams correctly (all 4 together)', async () => {
            await meeting.unpublishStreams([
              audioStream,
              videoStream,
              videoShareStream,
              audioShareStream,
            ]);

            checkAudioUnpublished();
            checkVideoUnpublished();
            checkScreenShareVideoUnpublished(false);
            checkScreenShareAudioUnpublished(false);
          });

          it('un-publishes the audio stream correctly', async () => {
            await meeting.unpublishStreams([audioStream]);

            checkAudioUnpublished();
          });

          it('un-publishes the video stream correctly', async () => {
            await meeting.unpublishStreams([videoStream]);

            checkVideoUnpublished();
          });

          it('un-publishes the screen share video stream correctly', async () => {
            await meeting.unpublishStreams([videoShareStream]);

            checkScreenShareVideoUnpublished();
          });

          it('un-publishes the screen share audio stream correctly', async () => {
            await meeting.unpublishStreams([audioShareStream]);

            checkScreenShareAudioUnpublished();
          });

          it('releases share floor and sets send direction to false when both screen share streams are undefined', async () => {
            await meeting.unpublishStreams([videoShareStream, audioShareStream]);

            assert.calledOnce(meeting.releaseScreenShareFloor);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, false);
          });

          it('does not release share floor when audio is released and video still exists', async () => {
            await meeting.unpublishStreams([audioShareStream]);
            assert.notCalled(meeting.releaseScreenShareFloor);
          });

          it('does not release share floor when video is released and audio still exists', async () => {
            await meeting.unpublishStreams([videoShareStream]);
            assert.notCalled(meeting.releaseScreenShareFloor);
          });
        });
      });
    });

    describe('#setSendNamedMediaGroup', () => {
      beforeEach(() => {
        meeting.sendSlotManager.setNamedMediaGroups = sinon.stub().returns(undefined);
      });
      it('should throw error if not audio type', () => {
        expect(() => meeting.setSendNamedMediaGroup(MediaType.VideoMain, 20)).to.throw(
          `cannot set send named media group which media type is ${MediaType.VideoMain}`
        );
      });
      it('fails if there is no media connection', () => {
        meeting.mediaProperties.webrtcMediaConnection = undefined;
        meeting.setSendNamedMediaGroup('AUDIO-MAIN', 20);
        assert.notCalled(meeting.sendSlotManager.setNamedMediaGroups);
      });

      it('success if there is media connection', () => {
        meeting.isMultistream = true;
        meeting.mediaProperties.webrtcMediaConnection = true;
        meeting.setSendNamedMediaGroup('AUDIO-MAIN', 20);
        assert.calledOnceWithExactly(meeting.sendSlotManager.setNamedMediaGroups, 'AUDIO-MAIN', [
          {type: 1, value: 20},
        ]);
      });
    });

    describe('#enableMusicMode', () => {
      beforeEach(() => {
        meeting.isMultistream = true;
        const fakeMultistreamRoapMediaConnection = {
          createSendSlot: () => {
            return {
              setCodecParameters: sinon.stub().resolves(),
              deleteCodecParameters: sinon.stub().resolves(),
            };
          },
        };
        meeting.sendSlotManager.createSlot(
          fakeMultistreamRoapMediaConnection,
          MediaType.AudioMain,
          false
        );
        meeting.mediaProperties.webrtcMediaConnection = {};
      });
      afterEach(() => {
        sinon.restore();
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
          meeting.sendSlotManager.getSlot(MediaType.AudioMain).setCodecParameters,
          {
            maxaveragebitrate: '64000',
            maxplaybackrate: '48000',
          }
        );
        assert.notCalled(
          meeting.sendSlotManager.getSlot(MediaType.AudioMain).deleteCodecParameters
        );
      });

      it('should set the codec parameters when shouldEnableMusicMode is false', async () => {
        await meeting.enableMusicMode(false);
        assert.calledOnceWithExactly(
          meeting.sendSlotManager.getSlot(MediaType.AudioMain).deleteCodecParameters,
          ['maxaveragebitrate', 'maxplaybackrate']
        );
        assert.notCalled(meeting.sendSlotManager.getSlot(MediaType.AudioMain).setCodecParameters);
      });
    });

    describe('Public Event Triggers', () => {
      let sandbox;

      beforeEach(() => {
        const fakeMediaStream = () => {
          return {
            id: 'fake stream',
          };
        };

        sandbox = sinon.createSandbox();
        sandbox.stub(Media, 'stopStream').returns(Promise.resolve());
        sandbox.stub(meeting.mediaProperties, 'audioStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'videoStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'shareVideoStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'shareAudioStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'remoteAudioStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'remoteVideoStream').value(fakeMediaStream());
        sandbox.stub(meeting.mediaProperties, 'remoteShareStream').value(fakeMediaStream());
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
          let eventListeners;

          beforeEach(() => {
            eventListeners = {};
            meeting.mediaProperties.webrtcMediaConnection = {
              // mock the on() method and store all the listeners
              on: sinon.stub().callsFake((event, listener) => {
                eventListeners[event] = listener;
              }),
            };
            meeting.setupMediaConnectionListeners();
            meeting.sdpResponseTimer = '1234';
            sinon.stub(meeting.mediaProperties, 'waitForMediaConnectionConnected').resolves();

            meeting.config.reconnection.enabled = true;
            meeting.currentMediaStatus = {audio: true};
            meeting.reconnectionManager = new ReconnectionManager(meeting);
            sinon.stub(meeting.reconnectionManager, 'reconnect').returns(Promise.resolve());
          });

          it('should throw error if media not established before trying reconnect', async () => {
            meeting.currentMediaStatus = null;
            await meeting.reconnect().catch((err) => {
              assert.instanceOf(err, ParameterError);
            });
          });

          it('should reconnect successfully if reconnectionManager.cleanUp is called before reconnection attempt', async () => {
            meeting.reconnectionManager.cleanUp();

            try {
              await meeting.reconnect();
            } catch (err) {
              assert.fail('reconnect should not error after clean up');
            }
          });

          it('should call the right functions', async () => {
            const options = {id: 'fake options'};
            await meeting.reconnect(options);

            sinon.stub(meeting, 'waitForRemoteSDPAnswer').resolves();

            assert.calledOnceWithExactly(
              meeting.reconnectionManager.reconnect,
              options,
              sinon.match.any
            );
            const callback = meeting.reconnectionManager.reconnect.getCalls()[0].args[1];

            // call the completion callback
            assert.isFunction(callback);
            await callback();

            // check that the right things were called by the callback
            assert.calledOnceWithExactly(meeting.waitForRemoteSDPAnswer);
            assert.calledOnceWithExactly(meeting.mediaProperties.waitForMediaConnectionConnected);
          });
        });

        describe('unsuccessful reconnect', () => {
          let logUploadSpy;

          beforeEach(() => {
            logUploadSpy = sinon.spy(meeting, 'uploadLogs');
            meeting.currentMediaStatus = {audio: true};
            meeting.reconnectionManager = new ReconnectionManager(meeting);
            meeting.reconnectionManager.reconnect = sinon
              .stub()
              .returns(Promise.reject(new Error()));
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

          it('should fail without uploading logs if there is no reconnectionManager', async () => {
            meeting.reconnectionManager = null;
            await assert.isRejected(meeting.reconnect());
            assert.notCalled(logUploadSpy);
          });

          it('should fail without uploading logs if there is no media established', async () => {
            meeting.currentMediaStatus = null;
            await assert.isRejected(meeting.reconnect());
            assert.notCalled(logUploadSpy);
          });

          it('should resolve if the error is ReconnectionNotStartedError', async () => {
            meeting.reconnectionManager.reconnect.returns(
              Promise.reject(new ReconnectionNotStartedError())
            );
            await meeting.reconnect();

            // logs shouldn't be uploaded
            assert.notCalled(logUploadSpy);
          });
        });
      });
      describe('#closeRemoteStream', () => {
        it('should stop remote tracks, and trigger a media:stopped event when the remote tracks are stopped', async () => {
          await meeting.closeRemoteStreams();

          assert.equal(TriggerProxy.trigger.callCount, 5);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteStreams'},
            'media:stopped',
            {type: 'remoteAudio'}
          );
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteStreams'},
            'media:stopped',
            {type: 'remoteVideo'}
          );
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeRemoteStreams'},
            'media:stopped',
            {type: 'remoteShare'}
          );
        });
      });
      describe('#setupMediaConnectionListeners', () => {
        let eventListeners;
        const fakeStream = {
          id: 'stream',
          getTracks: () => [{id: 'track', addEventListener: sinon.stub()}],
        };
        const simulateConnectionStateChange = (newState) => {
          meeting.mediaProperties.webrtcMediaConnection.getConnectionState = sinon
            .stub()
            .returns(newState);
          eventListeners[MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED]();
        };

        beforeEach(() => {
          eventListeners = {};
          meeting.statsAnalyzer = {startAnalyzer: sinon.stub()};
          meeting.mediaProperties.webrtcMediaConnection = {
            // mock the on() method and store all the listeners
            on: sinon.stub().callsFake((event, listener) => {
              eventListeners[event] = listener;
            }),
            getConnectionState: sinon.stub().returns(ConnectionState.New),
          };
          MediaUtil.createMediaStream.returns(fakeStream);
        });

        it('should register for all the correct RoapMediaConnection events', () => {
          meeting.setupMediaConnectionListeners();
          assert.isFunction(eventListeners[MediaConnectionEventNames.ROAP_STARTED]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.ROAP_DONE]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.ROAP_FAILURE]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.REMOTE_TRACK_ADDED]);
          assert.isFunction(
            eventListeners[MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED]
          );
          assert.isFunction(eventListeners[MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.ICE_CANDIDATE]);
          assert.isFunction(eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]);
        });

        it('should trigger a media:ready event when REMOTE_TRACK_ADDED is fired', () => {
          meeting.setupMediaConnectionListeners();
          eventListeners[MediaConnectionEventNames.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.AUDIO,
          });
          assert.equal(TriggerProxy.trigger.getCall(2).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(2).args[3], {
            type: 'remoteAudio',
            stream: fakeStream,
          });

          eventListeners[MediaConnectionEventNames.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.VIDEO,
          });
          assert.equal(TriggerProxy.trigger.getCall(3).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(3).args[3], {
            type: 'remoteVideo',
            stream: fakeStream,
          });

          eventListeners[MediaConnectionEventNames.REMOTE_TRACK_ADDED]({
            track: 'track',
            type: RemoteTrackType.SCREENSHARE_VIDEO,
          });
          assert.equal(TriggerProxy.trigger.getCall(4).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(4).args[3], {
            type: 'remoteShare',
            stream: fakeStream,
          });
        });

        describe('should react on a ICE_CANDIDATE event', () => {
          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
          });

          it('should collect ice candidates', () => {
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE]({candidate: 'candidate'});

            assert.equal(meeting.iceCandidatesCount, 1);
          });

          it('should not collect null ice candidates', () => {
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE]({candidate: null});

            assert.equal(meeting.iceCandidatesCount, 0);
          });
        });

        describe('should react on a ICE_CANDIDATE_ERROR event', () => {
          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
          });

          it('should not collect skipped ice candidates error', () => {
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]({
              error: {
                errorCode: 600,
                errorText: 'Address not associated with the desired network interface.',
              },
            });

            assert.equal(meeting.iceCandidateErrors.size, 0);
          });

          it('should collect valid ice candidates error', () => {
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]({
              error: {errorCode: 701, errorText: ''},
            });

            assert.equal(meeting.iceCandidateErrors.size, 1);
            assert.equal(meeting.iceCandidateErrors.has('701_'), true);
          });

          it('should increment counter if same valid ice candidates error collected', () => {
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]({
              error: {errorCode: 701, errorText: ''},
            });

            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]({
              error: {errorCode: 701, errorText: 'STUN host lookup received error.'},
            });
            eventListeners[MediaConnectionEventNames.ICE_CANDIDATE_ERROR]({
              error: {errorCode: 701, errorText: 'STUN host lookup received error.'},
            });

            assert.equal(meeting.iceCandidateErrors.size, 2);
            assert.equal(meeting.iceCandidateErrors.has('701_'), true);
            assert.equal(meeting.iceCandidateErrors.get('701_'), 1);
            assert.equal(
              meeting.iceCandidateErrors.has('701_stun_host_lookup_received_error'),
              true
            );
            assert.equal(meeting.iceCandidateErrors.get('701_stun_host_lookup_received_error'), 2);
          });
        });

        describe('CONNECTION_STATE_CHANGED event when state = "Connecting"', () => {
          it('sends client.ice.start correctly when hasMediaConnectionConnectedAtLeastOnce = true', () => {
            meeting.hasMediaConnectionConnectedAtLeastOnce = true;
            meeting.setupMediaConnectionListeners();

            simulateConnectionStateChange(ConnectionState.Connecting);

            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          });

          it('sends client.ice.start correctly when hasMediaConnectionConnectedAtLeastOnce = false', () => {
            meeting.hasMediaConnectionConnectedAtLeastOnce = false;
            meeting.setupMediaConnectionListeners();

            simulateConnectionStateChange(ConnectionState.Connecting);

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.ice.start',
              options: {
                meetingId: meeting.id,
              },
            });
          });
        });

        describe('submitClientEvent on connectionSuccess', () => {
          let setNetworkStatusSpy;

          const setupSpies = () => {
            setNetworkStatusSpy = sinon.spy(meeting, 'setNetworkStatus');

            meeting.reconnectionManager = new ReconnectionManager(meeting);
            meeting.reconnectionManager.iceReconnected = sinon.stub().returns(undefined);
            meeting.statsAnalyzer = {startAnalyzer: sinon.stub()};
            meeting.mediaProperties.webrtcMediaConnection = {
              // mock the on() method and store all the listeners
              on: sinon.stub().callsFake((event, listener) => {
                eventListeners[event] = listener;
              }),
              getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            };
          };

          const checkExpectedSpies = (expected) => {
            if (expected.icePhase) {
              assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
              assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
                name: 'client.ice.end',
                options: {
                  meetingId: meeting.id,
                },
                payload: {
                  canProceed: true,
                  icePhase: expected.icePhase,
                },
              });
            } else {
              assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            }
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.CONNECTION_SUCCESS, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusId,
              latency: undefined,
            });
            assert.deepEqual(
              setNetworkStatusSpy.getCalls().map((call) => call.args[0]),
              expected.setNetworkStatusCallParams
            );
            assert.calledOnce(meeting.reconnectionManager.iceReconnected);
            assert.calledOnce(meeting.statsAnalyzer.startAnalyzer);
            assert.calledWith(
              meeting.statsAnalyzer.startAnalyzer,
              meeting.mediaProperties.webrtcMediaConnection
            );
          };

          const resetSpies = () => {
            setNetworkStatusSpy.resetHistory();
            webex.internal.newMetrics.submitClientEvent.resetHistory();
            Metrics.sendBehavioralMetric.resetHistory();
            meeting.reconnectionManager.iceReconnected.resetHistory();
            meeting.statsAnalyzer.startAnalyzer.resetHistory();
          };

          it('sends client.ice.end with the correct icePhase when we get ConnectionState.Connected on CONNECTION_STATE_CHANGED event', () => {
            setupSpies();

            meeting.setupMediaConnectionListeners();

            assert.equal(meeting.hasMediaConnectionConnectedAtLeastOnce, false);

            // simulate first connection success
            simulateConnectionStateChange(ConnectionState.Connected);
            checkExpectedSpies({
              icePhase: 'JOIN_MEETING_FINAL',
              setNetworkStatusCallParams: [NETWORK_STATUS.CONNECTED],
            });
            assert.equal(meeting.hasMediaConnectionConnectedAtLeastOnce, true);

            // now simulate short connection loss, client.ice.end is not sent a second time as hasMediaConnectionConnectedAtLeastOnce = true
            resetSpies();

            simulateConnectionStateChange(ConnectionState.Disconnected);

            simulateConnectionStateChange(ConnectionState.Connected);

            checkExpectedSpies({
              setNetworkStatusCallParams: [NETWORK_STATUS.DISCONNECTED, NETWORK_STATUS.CONNECTED],
            });

            resetSpies();

            simulateConnectionStateChange(ConnectionState.Disconnected);

            simulateConnectionStateChange(ConnectionState.Connected);
          });
        });

        describe('CONNECTION_STATE_CHANGED event when state = "Disconnected"', () => {
          beforeEach(() => {
            Metrics.sendBehavioralMetric = sinon.stub();
            meeting.reconnectionManager = new ReconnectionManager(meeting);
            meeting.reconnectionManager.iceReconnected = sinon.stub().returns(undefined);
            meeting.setNetworkStatus = sinon.stub().returns(undefined);
            meeting.statsAnalyzer = {startAnalyzer: sinon.stub()};
            meeting.mediaProperties.webrtcMediaConnection = {
              // mock the on() method and store all the listeners
              on: sinon.stub().callsFake((event, listener) => {
                eventListeners[event] = listener;
              }),
            };
            meeting.reconnect = sinon.stub().resolves();
          });

          const mockDisconnectedEvent = () => {
            meeting.setupMediaConnectionListeners();

            simulateConnectionStateChange(ConnectionState.Disconnected);
          };

          const checkBehavioralMetricSent = (hasMediaConnectionConnectedAtLeastOnce = false) => {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.CONNECTION_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              networkStatus: meeting.networkStatus,
              hasMediaConnectionConnectedAtLeastOnce,
            });
          };

          it('handles "Disconnected" state correctly when waitForIceReconnect resolves', async () => {
            meeting.reconnectionManager.waitForIceReconnect = sinon.stub().resolves();

            mockDisconnectedEvent();
            await testUtils.flushPromises();

            assert.calledOnce(meeting.setNetworkStatus);
            assert.calledWith(meeting.setNetworkStatus, NETWORK_STATUS.DISCONNECTED);
            assert.calledOnce(meeting.reconnectionManager.waitForIceReconnect);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            assert.notCalled(Metrics.sendBehavioralMetric);
          });

          it('handles "Disconnected" state correctly when waitForIceReconnect rejects and hasMediaConnectionConnectedAtLeastOnce = true', async () => {
            const FAKE_ERROR = {fatal: true};
            const getErrorPayloadForClientErrorCodeStub =
              (webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
                sinon.stub().returns(FAKE_ERROR));
            meeting.waitForMediaConnectionConnected = sinon.stub().resolves();
            meeting.reconnectionManager.waitForIceReconnect = sinon.stub().rejects();
            meeting.hasMediaConnectionConnectedAtLeastOnce = true;

            mockDisconnectedEvent();

            await testUtils.flushPromises();

            assert.calledOnce(meeting.setNetworkStatus);
            assert.calledWith(meeting.setNetworkStatus, NETWORK_STATUS.DISCONNECTED);
            assert.calledOnce(meeting.reconnectionManager.waitForIceReconnect);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            checkBehavioralMetricSent(true);
          });

          it('handles "Disconnected" state correctly when waitForIceReconnect rejects and hasMediaConnectionConnectedAtLeastOnce = false', async () => {
            meeting.reconnectionManager.waitForIceReconnect = sinon.stub().rejects();

            mockDisconnectedEvent();

            await testUtils.flushPromises();

            assert.calledOnce(meeting.setNetworkStatus);
            assert.calledWith(meeting.setNetworkStatus, NETWORK_STATUS.DISCONNECTED);
            assert.calledOnce(meeting.reconnectionManager.waitForIceReconnect);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            checkBehavioralMetricSent();
          });
        });

        describe('CONNECTION_STATE_CHANGED event when state = "Failed"', () => {
          const mockFailedEvent = () => {
            meeting.setupMediaConnectionListeners();

            simulateConnectionStateChange(ConnectionState.Failed);
          };

          const checkBehavioralMetricSent = (hasMediaConnectionConnectedAtLeastOnce = false) => {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.CONNECTION_FAILURE, {
              correlation_id: meeting.correlationId,
              locus_id: meeting.locusUrl.split('/').pop(),
              networkStatus: meeting.networkStatus,
              hasMediaConnectionConnectedAtLeastOnce,
            });
          };

          it('handles "Failed" state correctly when hasMediaConnectionConnectedAtLeastOnce = false', async () => {
            meeting.waitForMediaConnectionConnected = sinon.stub().resolves();

            mockFailedEvent();

            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            checkBehavioralMetricSent();
          });

          it('handles "Failed" state correctly when hasMediaConnectionConnectedAtLeastOnce = true', async () => {
            meeting.hasMediaConnectionConnectedAtLeastOnce = true;

            mockFailedEvent();

            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
            checkBehavioralMetricSent(true);
          });
        });

        describe('should send correct metrics for ROAP_FAILURE event', () => {
          const fakeErrorMessage = 'test error';
          const fakeRootCauseName = 'root cause name';
          const fakeErrorName = 'test error name';

          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
            webex.internal.newMetrics.submitClientEvent.resetHistory();
            Metrics.sendBehavioralMetric.resetHistory();
          });

          const checkMetricSent = (event, error) => {
            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: event,
              payload: {
                canProceed: false,
              },
              options: {rawError: error, meetingId: meeting.id},
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

            eventListeners[MediaConnectionEventNames.ROAP_FAILURE](fakeError);

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

            eventListeners[MediaConnectionEventNames.ROAP_FAILURE](fakeError);

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

            eventListeners[MediaConnectionEventNames.ROAP_FAILURE](fakeError);

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

            eventListeners[MediaConnectionEventNames.ROAP_FAILURE](fakeError);

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

            eventListeners[MediaConnectionEventNames.ROAP_FAILURE](fakeError);

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

        describe('handles SDP events correctly', () => {
          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
          });

          it('handles REMOTE_SDP_ANSWER_PROCESSED correctly', () => {
            const clock = sinon.useFakeTimers();
            sinon.spy(clock, 'clearTimeout');
            meeting.deferSDPAnswer = {
              resolve: sinon.stub(),
            };
            meeting.sdpResponseTimer = '1234';

            eventListeners[MediaConnectionEventNames.REMOTE_SDP_ANSWER_PROCESSED]();

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.remote-sdp-received',
              options: {meetingId: meeting.id},
            });

            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.ROAP_OFFER_TO_ANSWER_LATENCY,
              {
                correlation_id: meeting.correlationId,
                meetingId: meeting.id,
                latency: undefined,
              }
            );

            assert.calledOnce(meeting.deferSDPAnswer.resolve);
            assert.calledOnce(clock.clearTimeout);
            assert.calledWith(clock.clearTimeout, '1234');
            assert.equal(meeting.sdpResponseTimer, undefined);
          });

          it('handles LOCAL_SDP_OFFER_GENERATED correctly', () => {
            assert.equal(meeting.deferSDPAnswer, undefined);

            eventListeners[MediaConnectionEventNames.LOCAL_SDP_OFFER_GENERATED]();

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.local-sdp-generated',
              options: {meetingId: meeting.id},
            });

            assert.notEqual(meeting.deferSDPAnswer, undefined);
          });

          it('handles LOCAL_SDP_ANSWER_GENERATED correctly', () => {
            eventListeners[MediaConnectionEventNames.LOCAL_SDP_ANSWER_GENERATED]();

            assert.calledOnce(webex.internal.newMetrics.submitClientEvent);
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.remote-sdp-received',
              options: {meetingId: meeting.id},
            });
          });
        });

        describe('handles MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND correctly', () => {
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
            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {messageType: 'OK', seq: 1},
            });

            assert.calledOnce(sendRoapOKStub);
            assert.calledWith(sendRoapOKStub, {
              seq: 1,
              mediaId: meeting.mediaId,
              correlationId: meeting.correlationId,
            });
          });

          it('handles OFFER message correctly (no answer in the http response)', async () => {
            sinon.stub(meeting, 'roapMessageReceived');

            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'OFFER',
                seq: 1,
                sdp: 'fake sdp',
                tieBreaker: 12345,
              },
            });

            await testUtils.flushPromises();

            assert.calledOnce(sendRoapMediaRequestStub);
            assert.calledWith(sendRoapMediaRequestStub, {
              seq: 1,
              sdp: 'fake sdp',
              tieBreaker: 12345,
              meeting,
            });
            assert.notCalled(meeting.roapMessageReceived);
          });

          it('handles OFFER message correctly (with an answer in the http response)', async () => {
            const fakeAnswer = {messageType: 'answer', sdp: 'sdp'};
            sendRoapMediaRequestStub.resolves({roapAnswer: fakeAnswer});
            sinon.stub(meeting, 'roapMessageReceived');

            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'OFFER',
                seq: 1,
                sdp: 'fake sdp',
                tieBreaker: 12345,
              },
            });

            await testUtils.flushPromises();

            assert.calledOnce(sendRoapMediaRequestStub);
            assert.calledWith(sendRoapMediaRequestStub, {
              seq: 1,
              sdp: 'fake sdp',
              tieBreaker: 12345,
              meeting,
            });
            assert.calledWith(meeting.roapMessageReceived, fakeAnswer);
          });

          it('handles OFFER message correctly when request fails', async () => {
            const fakeError = new Error('fake error');
            const clock = sinon.useFakeTimers();
            sinon.spy(clock, 'clearTimeout');
            meeting.deferSDPAnswer = {reject: sinon.stub()};
            meeting.sdpResponseTimer = '1234';
            sendRoapMediaRequestStub.rejects(fakeError);
            sinon.stub(meeting, 'roapMessageReceived');
            const getErrorPayloadForClientErrorCodeStub =
              (webex.internal.newMetrics.callDiagnosticMetrics.getErrorPayloadForClientErrorCode =
                sinon
                  .stub()
                  .callsFake(({clientErrorCode}) => ({errorCode: clientErrorCode, fatal: true})));

            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'OFFER',
                seq: 1,
                sdp: 'fake sdp',
                tieBreaker: 12345,
              },
            });

            await testUtils.flushPromises();

            assert.calledOnce(sendRoapMediaRequestStub);
            assert.calledWith(sendRoapMediaRequestStub, {
              seq: 1,
              sdp: 'fake sdp',
              tieBreaker: 12345,
              meeting,
            });
            assert.notCalled(meeting.roapMessageReceived);
            assert.calledOnce(meeting.deferSDPAnswer.reject);
            assert.calledOnce(clock.clearTimeout);
            assert.calledWith(clock.clearTimeout, '1234');
            assert.equal(meeting.sdpResponseTimer, undefined);

            assert.calledOnceWithExactly(getErrorPayloadForClientErrorCodeStub, {
              clientErrorCode: 2007,
            });
            assert.calledWithMatch(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.media-engine.remote-sdp-received',
              payload: {
                canProceed: false,
                errors: [{errorCode: 2007, fatal: true}],
              },
              options: {
                meetingId: meeting.id,
                rawError: fakeError,
              },
            });
          });

          it('handles ANSWER message correctly', () => {
            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
              roapMessage: {
                messageType: 'ANSWER',
                seq: 10,
                sdp: 'fake sdp answer',
                tieBreaker: 12345,
              },
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

            await eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
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
              eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
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
            eventListeners[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND]({
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
            assert.isFunction(
              eventListeners[MediaConnectionEventNames.VIDEO_SOURCES_COUNT_CHANGED]
            );
            assert.isFunction(
              eventListeners[MediaConnectionEventNames.AUDIO_SOURCES_COUNT_CHANGED]
            );
          });

          it('forwards the VIDEO_SOURCES_COUNT_CHANGED event as "media:remoteVideoSourceCountChanged"', () => {
            const numTotalSources = 10;
            const numLiveSources = 6;
            const mediaContent = 'SLIDES';

            sinon.stub(meeting.mediaRequestManagers.video, 'setNumCurrentSources');

            eventListeners[MediaConnectionEventNames.VIDEO_SOURCES_COUNT_CHANGED](
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

            eventListeners[MediaConnectionEventNames.AUDIO_SOURCES_COUNT_CHANGED](
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

            eventListeners[MediaConnectionEventNames.VIDEO_SOURCES_COUNT_CHANGED](
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

            eventListeners[MediaConnectionEventNames.VIDEO_SOURCES_COUNT_CHANGED](
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
          meeting.updateLLMConnection = sinon.stub();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_UNADMITTED_GUEST', test1);
          assert.calledOnceWithExactly(meeting.startKeepAlive);
          assert.calledThrice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            'meeting:self:lobbyWaiting',
            {payload: test1}
          );
          assert.calledOnce(meeting.updateLLMConnection);
          done();
        });
        it('listens to the self admitted guest event', (done) => {
          meeting.stopKeepAlive = sinon.stub();
          meeting.updateLLMConnection = sinon.stub();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_ADMITTED_GUEST', test1);
          assert.calledOnceWithExactly(meeting.stopKeepAlive);
          assert.calledThrice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            'meeting:self:guestAdmitted',
            {payload: test1}
          );
          assert.calledOnce(meeting.updateLLMConnection);
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

        it('listens to the locus manual caption update event', () => {
          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'CONTROLS_MEETING_MANUAL_CAPTION_UPDATED',
            {enable: true}
          );

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_MANUAL_CAPTION_UPDATED
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
          meeting.webinar.locusUrlUpdate = sinon.stub();

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
          assert.calledWith(meeting.webinar.locusUrlUpdate, newLocusUrl);
          assert.equal(meeting.locusUrl, newLocusUrl);
          assert(meeting.locusId, '12345');

          assert.calledThrice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {
              file: 'meeting/index',
              function: 'setUpLocusSelfListener',
            },
            EVENT_TRIGGERS.MEETING_LOCUS_URL_UPDATE,
            {locusUrl: 'newLocusUrl/12345'}
          );

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
              webcast: {
                url: 'url',
              },
              webinarAttendeesSearching: {
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
          meeting.webinar = {
            webcastUrlUpdate: sinon.stub().returns(undefined),
            webinarAttendeesSearchingUrlUpdate: sinon.stub().returns(undefined),
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
          assert.calledWith(
            meeting.webinar.webcastUrlUpdate,
            newLocusServices.services.webcast.url
          );
          assert.calledWith(
            meeting.webinar.webinarAttendeesSearchingUrlUpdate,
            newLocusServices.services.webinarAttendeesSearching.url
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
        let cleanUpSpy;
        it('listens to destroy meeting event from locus info  ', (done) => {
          TriggerProxy.trigger.reset();
          sinon.stub(meeting.reconnectionManager, 'cleanUp');
          cleanUpSpy = sinon.stub(MeetingUtil, 'cleanUp');

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
          cleanUpSpy.restore();
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
        sandbox.stub(meeting.mediaProperties, 'unsetRemoteStreams').returns(Promise.resolve());
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
          (meeting.deviceUrl = 'deviceUrl.com'), (meeting.localShareInstanceId = '1234-5678');
        });
        it('should call changeMeetingFloor()', async () => {
          meeting.screenShareFloorState = 'GRANTED';
          const share = meeting.releaseScreenShareFloor();

          assert.calledWith(meeting.meetingRequest.changeMeetingFloor, {
            disposition: FLOOR_ACTION.RELEASED,
            personUrl: url2,
            deviceUrl: 'deviceUrl.com',
            uri: url1,
            resourceUrl: undefined,
            shareInstanceId: '1234-5678',
          });

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

      describe('#setPermissionTokenPayload', () => {
        let now;
        let clock;

        beforeEach(() => {
          now = Date.now();

          // mock `new Date()` with constant `now`
          clock = sinon.useFakeTimers(now);
        });

        afterEach(() => {
          clock.restore();
        });
        it('sets correctly', () => {
          assert.notOk(meeting.permissionTokenPayload);

          const permissionTokenPayloadData = {permission: {userPolicies: {a: true}}, exp: '123456'};

          meeting.setPermissionTokenPayload(
            'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0'
          );

          assert.deepEqual(meeting.permissionTokenPayload, permissionTokenPayloadData);
          assert.deepEqual(meeting.permissionTokenReceivedLocalTime, now);
        });
      });

      describe('#setSelfUserPolicies', () => {
        it('sets correctly when policy data is present in token', () => {
          assert.notOk(meeting.selfUserPolicies);

          const testUrl = 'https://example.com';

          const policyData = {
            permission: {
              userPolicies: {a: true},
              enforceVBGImagesURL: testUrl,
            },
          };
          meeting.permissionTokenPayload = policyData;

          meeting.setSelfUserPolicies();

          assert.deepEqual(meeting.selfUserPolicies, policyData.permission.userPolicies);
          assert.equal(meeting.enforceVBGImagesURL, testUrl);
        });

        it('handles missing permission data', () => {
          assert.notOk(meeting.selfUserPolicies);

          const policyData = {};
          meeting.permissionTokenPayload = policyData;

          meeting.setSelfUserPolicies();

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });

        it('handles missing policy data', () => {
          assert.notOk(meeting.selfUserPolicies);

          const policyData = {permission: {}};
          meeting.permissionTokenPayload = policyData;

          meeting.setSelfUserPolicies();

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });

        it('handles missing token', () => {
          assert.notOk(meeting.selfUserPolicies);

          meeting.setSelfUserPolicies();

          assert.deepEqual(meeting.selfUserPolicies, undefined);
        });
      });

      describe('#unsetRemoteStreams', () => {
        it('should unset the remote streams and return null', () => {
          meeting.mediaProperties.unsetRemoteStreams = sinon.stub().returns(true);
          meeting.unsetRemoteStreams();
          assert.calledOnce(meeting.mediaProperties.unsetRemoteStreams);
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
          const setNetworkStatusSpy = sinon.spy(meeting, 'setNetworkStatus');
          meeting.mediaProperties.webrtcMediaConnection = {close: sinon.stub()};
          const pcs = meeting.closePeerConnections();

          assert.exists(pcs.then);
          await pcs;
          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.close);
          assert.calledOnceWithExactly(setNetworkStatusSpy, undefined);
        });
      });
      describe('#unsetPeerConnections', () => {
        it('should unset the peer connections', () => {
          meeting.mediaProperties.unsetPeerConnection = sinon.stub().returns(true);
          meeting.webex.internal.mercury.off = sinon.stub().returns(true);
          meeting.unsetPeerConnections();
          assert.calledOnce(meeting.mediaProperties.unsetPeerConnection);
          assert.notCalled(meeting.webex.internal.mercury.off);
        });

        it('should unset the peer connections and turn off mercury listeners if config.reconnection.detection is true', () => {
          meeting.config.reconnection.detection = true;
          meeting.mediaProperties.unsetPeerConnection = sinon.stub().returns(true);
          meeting.webex.internal.mercury.off = sinon.stub().returns(true);
          meeting.unsetPeerConnections();
          assert.calledOnce(meeting.mediaProperties.unsetPeerConnection);
          assert.calledTwice(meeting.webex.internal.mercury.off);
          assert.calledWith(meeting.webex.internal.mercury.off.firstCall, ONLINE);
          assert.calledWith(meeting.webex.internal.mercury.off.secondCall, OFFLINE);
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

          if (expectedInfoToParse.permissionTokenPayload) {
            assert.deepEqual(
              meeting.permissionTokenPayload,
              expectedInfoToParse.permissionTokenPayload
            );
          }
        };

        it('should parse meeting info from api return when locus meeting object is not available, set values, and return null', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;

          const expectedPermissionTokenPayload = {
            exp: '123456',
            permission: {
              userPolicies: {
                a: true,
              },
            },
          };

          // generated permissionToken with secret `secret` and
          // value `JSON.stringify(expectedPermissionTokenPayload)`
          const permissionToken =
            'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0';

          const FAKE_MEETING_INFO = {
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            permissionToken,
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
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
            permissionToken,
            permissionTokenPayload: expectedPermissionTokenPayload,
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
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_LOCUS_MEETING);
          const expectedInfoToParse = {
            conversationUrl: 'locusConvURL',
            locusUrl: 'locusUrl',
            sipUri: 'locusSipUri',
            meetingNumber: 'locusMeetingId',
            meetingJoinUrl: url2,
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            owner: 'locusOwner',
            selfUserPolicies: {a: true},
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse meeting info from api return, set values, and return null', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_MEETING_INFO = {
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            owner: test2,
            selfUserPolicies: {a: true},
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });
        it('should parse meeting info, set values, and return null when destination is a string', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_STRING_DESTINATION = 'sipUrl';
          const FAKE_MEETING_INFO = {
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_STRING_DESTINATION);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
            selfUserPolicies: {a: true},
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });

        it('should parse meeting info, set values, and return null when permissionToken is not present', () => {
          meeting.config.experimental = {enableMediaNegotiatedEvent: true};
          meeting.config.experimental.enableUnifiedMeetings = true;
          const FAKE_STRING_DESTINATION = 'sipUrl';
          const FAKE_MEETING_INFO = {
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_STRING_DESTINATION);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
          };

          checkParseMeetingInfo(expectedInfoToParse);
        });

        it('should parse interpretation info correctly', () => {
          const parseInterpretationInfo = sinon.spy(MeetingUtil, 'parseInterpretationInfo');
          const mockToggleOnData = {
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
            permissionToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxMjM0NTYiLCJwZXJtaXNzaW9uIjp7InVzZXJQb2xpY2llcyI6eyJhIjp0cnVlfX19.wkTk0Hp8sUlq2wi2nP4-Ym4Xb7aEUHzyXA1kzk6f0V0',
          };
          meeting.parseMeetingInfo(mockToggleOnData);
          assert.calledOnceWithExactly(parseInterpretationInfo, meeting, mockToggleOnData);
        });

        it('should handle error', () => {
          const parseInterpretationInfo = sinon.spy(MeetingUtil, 'parseInterpretationInfo');
          const FAKE_MEETING_INFO = {
            conversationUrl: uuid1,
            locusUrl: url1,
            meetingJoinUrl: url2,
            meetingNumber: '12345',
            permissionToken: 'abc',
            sipMeetingUri: test1,
            sipUrl: test1,
            owner: test2,
          };
          meeting.parseMeetingInfo(FAKE_MEETING_INFO, undefined, 'Error');

          checkParseMeetingInfo({
            locusUrl: meeting.locusUrl,
          });
          assert.calledOnceWithExactly(parseInterpretationInfo, meeting, FAKE_MEETING_INFO);
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
        let handleDataChannelUrlChangeSpy;
        let updateMeetingActionsSpy;

        beforeEach(() => {
          locusInfoOnSpy = sinon.spy(meeting.locusInfo, 'on');
          handleDataChannelUrlChangeSpy = sinon.spy(meeting, 'handleDataChannelUrlChange');
          updateMeetingActionsSpy = sinon.spy(meeting, 'updateMeetingActions');
        });

        afterEach(() => {
          locusInfoOnSpy.restore();
          updateMeetingActionsSpy.restore();
        });

        it('registers the correct MEETING_INFO_UPDATED event', () => {
          const userDisplayPolicy = {a: true};
          const userDisplayHints = ['LOCK_CONTROL_UNLOCK'];
          const datachannelUrl = 'some url';

          const setUserPolicySpy = sinon.spy(meeting.recordingController, 'setUserPolicy');
          const setRecordingDisplayHintsSpy = sinon.spy(
            meeting.recordingController,
            'setDisplayHints'
          );
          const setControlsDisplayHintsSpy = sinon.spy(
            meeting.controlsOptionsManager,
            'setDisplayHints'
          );

          meeting.selfUserPolicies = userDisplayPolicy;
          meeting.userDisplayHints = userDisplayHints;
          meeting.datachannelUrl = datachannelUrl;

          meeting.setUpLocusInfoMeetingInfoListener();

          assert.calledThrice(locusInfoOnSpy);

          assert.equal(locusInfoOnSpy.firstCall.args[0], 'MEETING_LOCKED');
          assert.equal(locusInfoOnSpy.secondCall.args[0], 'MEETING_UNLOCKED');
          assert.equal(locusInfoOnSpy.thirdCall.args[0], 'MEETING_INFO_UPDATED');
          const callback = locusInfoOnSpy.thirdCall.args[1];

          callback({isInitializing: true});

          assert.calledWith(updateMeetingActionsSpy);
          assert.calledWith(setRecordingDisplayHintsSpy, userDisplayHints);
          assert.calledWith(setUserPolicySpy, userDisplayPolicy);
          assert.calledWith(setControlsDisplayHintsSpy, userDisplayHints);
          assert.calledWith(handleDataChannelUrlChangeSpy, datachannelUrl);

          assert.neverCalledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meetings',
              function: 'setUpLocusInfoMeetingInfoListener',
            },
            'meeting:meetingInfoUpdated'
          );

          callback({isIntialized: false});

          assert.calledWith(updateMeetingActionsSpy);
          assert.calledWith(setRecordingDisplayHintsSpy, userDisplayHints);
          assert.calledWith(setUserPolicySpy, userDisplayPolicy);
          assert.calledWith(setControlsDisplayHintsSpy, userDisplayHints);
          assert.calledWith(handleDataChannelUrlChangeSpy, datachannelUrl);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meetings',
              function: 'setUpLocusInfoMeetingInfoListener',
            },
            'meeting:meetingInfoUpdated'
          );
        });
      });

      describe('#updateMeetingActions', () => {
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
        let canSendReactionsSpy;
        let canUserRenameSelfAndObservedSpy;
        let canUserRenameOthersSpy;
        let canShareWhiteBoardSpy;
        // Due to import tree issues, hasHints must be stubed within the scope of the `it`.

        beforeEach(() => {
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
          canSendReactionsSpy = sinon.spy(MeetingUtil, 'canSendReactions');
          canUserRenameSelfAndObservedSpy = sinon.spy(MeetingUtil, 'canUserRenameSelfAndObserved');
          canUserRenameOthersSpy = sinon.spy(MeetingUtil, 'canUserRenameOthers');
          canShareWhiteBoardSpy = sinon.spy(MeetingUtil, 'canShareWhiteBoard');
        });

        afterEach(() => {
          inMeetingActionsSetSpy.restore();
          waitingForOthersToJoinSpy.restore();
        });

        forEach(
          [
            {
              actionName: 'canShareApplication',
              expectedEnabled: true,
              arePolicyRestrictionsSupported: false,
            },
            {
              actionName: 'canShareApplication',
              expectedEnabled: false,
              arePolicyRestrictionsSupported: true,
            },
            {
              actionName: 'canShareDesktop',
              arePolicyRestrictionsSupported: false,
              expectedEnabled: true,
            },
            {
              actionName: 'canShareDesktop',
              arePolicyRestrictionsSupported: true,
              expectedEnabled: false,
            },
            {
              actionName: 'canShareContent',
              arePolicyRestrictionsSupported: false,
              expectedEnabled: true,
            },
            {
              actionName: 'canShareContent',
              arePolicyRestrictionsSupported: true,
              expectedEnabled: false,
            },
            {
              actionName: 'canUseVoip',
              expectedEnabled: true,
              arePolicyRestrictionsSupported: false,
            },
            {
              actionName: 'canUseVoip',
              expectedEnabled: false,
              arePolicyRestrictionsSupported: true,
            },
          ],
          ({actionName, arePolicyRestrictionsSupported, expectedEnabled}) => {
            it(`${actionName} is ${expectedEnabled} when the call type is ${arePolicyRestrictionsSupported}`, () => {
              meeting.userDisplayHints = [];
              meeting.meetingInfo = {some: 'info'};
              sinon
                .stub(meeting, 'arePolicyRestrictionsSupported')
                .returns(arePolicyRestrictionsSupported);

              meeting.updateMeetingActions();

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
              actionName: 'canChat',
              requiredDisplayHints: [],
              requiredPolicies: [SELF_POLICY.SUPPORT_CHAT],
            },
            {
              actionName: 'canShareDesktop',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_DESKTOP],
              requiredPolicies: [],
              enableUnifiedMeetings: false,
              arePolicyRestrictionsSupported: false,
            },
            {
              actionName: 'canShareApplication',
              requiredDisplayHints: [DISPLAY_HINTS.SHARE_APPLICATION],
              requiredPolicies: [],
              enableUnifiedMeetings: false,
              arePolicyRestrictionsSupported: false,
            },
            {
              actionName: 'canAnnotate',
              requiredDisplayHints: [],
              requiredPolicies: [SELF_POLICY.SUPPORT_ANNOTATION],
            },
          ],
          ({
            actionName,
            requiredDisplayHints,
            requiredPolicies,
            enableUnifiedMeetings,
            meetingInfo,
            arePolicyRestrictionsSupported,
          }) => {
            it(`${actionName} is enabled when the conditions are met`, () => {
              meeting.userDisplayHints = requiredDisplayHints;
              meeting.selfUserPolicies = undefined;
              sinon
                .stub(meeting, 'arePolicyRestrictionsSupported')
                .returns(arePolicyRestrictionsSupported);

              meeting.config.experimental.enableUnifiedMeetings = isUndefined(enableUnifiedMeetings)
                ? true
                : enableUnifiedMeetings;

              meeting.meetingInfo = isUndefined(meetingInfo) ? {some: 'info'} : meetingInfo;

              if (requiredPolicies) {
                meeting.selfUserPolicies = {};
              }
              forEach(requiredPolicies, (policy) => {
                meeting.selfUserPolicies[policy] = true;
              });

              meeting.updateMeetingActions();

              assert.isTrue(meeting.inMeetingActions.get()[actionName]);
            });

            if (requiredDisplayHints.length !== 0) {
              it(`${actionName} is disabled when the required display hints are missing`, () => {
                meeting.userDisplayHints = [];
                meeting.selfUserPolicies = undefined;

                meeting.meetingInfo = isUndefined(meetingInfo) ? {some: 'info'} : meetingInfo;

                if (requiredPolicies) {
                  meeting.selfUserPolicies = {};
                }
                forEach(requiredPolicies, (policy) => {
                  meeting.selfUserPolicies[policy] = true;
                });

                meeting.updateMeetingActions();

                assert.isFalse(meeting.inMeetingActions.get()[actionName]);
              });
            }

            it(`${actionName} is disabled when the required policies are missing`, () => {
              meeting.userDisplayHints = requiredDisplayHints;
              meeting.selfUserPolicies = undefined;

              if (requiredPolicies) {
                meeting.selfUserPolicies = {};
              }
              meeting.meetingInfo = isUndefined(meetingInfo) ? {some: 'info'} : meetingInfo;

              meeting.updateMeetingActions();

              assert.isFalse(meeting.inMeetingActions.get()[actionName]);
            });
          }
        );

        forEach(
          [
            {
              meetingInfo: {
                video: {
                  supportHDV: true,
                  supportHQV: true,
                },
              },
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_HDV]: true,
                [SELF_POLICY.SUPPORT_HQV]: true,
              },
              expectedActions: {
                supportHQV: true,
                supportHDV: true,
              },
            },
            {
              meetingInfo: {
                video: {
                  supportHDV: false,
                  supportHQV: false,
                },
              },
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_HDV]: true,
                [SELF_POLICY.SUPPORT_HQV]: true,
              },
              expectedActions: {
                supportHQV: false,
                supportHDV: false,
              },
            },
            {
              meetingInfo: {
                video: {
                  supportHDV: true,
                  supportHQV: true,
                },
              },
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_HDV]: false,
                [SELF_POLICY.SUPPORT_HQV]: false,
              },
              expectedActions: {
                supportHQV: false,
                supportHDV: false,
              },
            },
            {
              meetingInfo: undefined,
              selfUserPolicies: {},
              expectedActions: {
                supportHQV: true,
                supportHDV: true,
              },
            },
            {
              meetingInfo: {some: 'data'},
              selfUserPolicies: undefined,
              expectedActions: {
                supportHQV: true,
                supportHDV: true,
              },
            },
          ],
          ({meetingInfo, selfUserPolicies, expectedActions}) => {
            it(`expectedActions are ${JSON.stringify(
              expectedActions
            )} when policies are ${JSON.stringify(
              selfUserPolicies
            )} and meetingInfo is ${JSON.stringify(meetingInfo)}`, () => {
              meeting.meetingInfo = meetingInfo;
              meeting.selfUserPolicies = selfUserPolicies;

              meeting.updateMeetingActions();

              assert.deepEqual(
                {
                  supportHDV: meeting.inMeetingActions.supportHDV,
                  supportHQV: meeting.inMeetingActions.supportHQV,
                },
                expectedActions
              );
            });
          }
        );

        forEach(
          [
            // policies supported and enforce is true
            {
              meetingInfo: {video: {}},
              selfUserPolicies: {
                [SELF_POLICY.ENFORCE_VIRTUAL_BACKGROUND]: true,
              },
              expectedActions: {
                enforceVirtualBackground: true,
              },
            },
            // policies supported and enforce is false
            {
              meetingInfo: {video: {}},
              selfUserPolicies: {
                [SELF_POLICY.ENFORCE_VIRTUAL_BACKGROUND]: false,
              },
              expectedActions: {
                enforceVirtualBackground: false,
              },
            },
            // policies not supported but enforce is true
            {
              meetingInfo: undefined,
              selfUserPolicies: {
                [SELF_POLICY.ENFORCE_VIRTUAL_BACKGROUND]: true,
              },
              expectedActions: {
                enforceVirtualBackground: false,
              },
            },
          ],
          ({meetingInfo, selfUserPolicies, expectedActions}) => {
            it(`expectedActions are ${JSON.stringify(
              expectedActions
            )} when policies are ${JSON.stringify(
              selfUserPolicies
            )} and meetingInfo is ${JSON.stringify(meetingInfo)}`, () => {
              meeting.meetingInfo = meetingInfo;
              meeting.selfUserPolicies = selfUserPolicies;

              meeting.updateMeetingActions();

              assert.deepEqual(
                {
                  enforceVirtualBackground: meeting.inMeetingActions.enforceVirtualBackground,
                },
                expectedActions
              );
            });
          }
        );

        it('canUseVoip is disabled when the required policies are missing', () => {
          meeting.userDisplayHints = [DISPLAY_HINTS.VOIP_IS_ENABLED];
          meeting.selfUserPolicies = {};
          meeting.meetingInfo.supportVoIP = true;

          meeting.updateMeetingActions();

          assert.isFalse(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is enabled based on api info when the conditions are met', () => {
          meeting.userDisplayHints = undefined;
          meeting.selfUserPolicies = {[SELF_POLICY.SUPPORT_VOIP]: true};
          meeting.meetingInfo.supportVoIP = true;

          meeting.updateMeetingActions();

          assert.isTrue(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is enabled based on api info when the conditions are met - no display hints', () => {
          meeting.userDisplayHints = [];
          meeting.selfUserPolicies = {[SELF_POLICY.SUPPORT_VOIP]: true};
          meeting.meetingInfo.supportVoIP = true;

          meeting.updateMeetingActions();

          assert.isTrue(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is enabled when there is no meeting info', () => {
          meeting.updateMeetingActions();

          assert.isTrue(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is enabled when it is a locus call', () => {
          meeting.meetingInfo = {some: 'info'};
          meeting.type = 'CALL';

          meeting.updateMeetingActions();

          assert.isTrue(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is disabled based on api info when supportVoip is false', () => {
          meeting.userDisplayHints = undefined;
          meeting.selfUserPolicies = {[SELF_POLICY.SUPPORT_VOIP]: true};
          meeting.meetingInfo.supportVoIP = false;

          meeting.updateMeetingActions();

          assert.isFalse(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is disabled based on api info when the required policies are missing', () => {
          meeting.userDisplayHints = undefined;
          meeting.selfUserPolicies = {};
          meeting.meetingInfo.supportVoIP = true;

          meeting.updateMeetingActions();

          assert.isFalse(meeting.inMeetingActions.get()['canUseVoip']);
        });

        it('canUseVoip is enabled when there are no policies', () => {
          meeting.userDisplayHints = [DISPLAY_HINTS.VOIP_IS_ENABLED];
          meeting.selfUserPolicies = undefined;
          meeting.meetingInfo.supportVoIP = false;

          meeting.updateMeetingActions();

          assert.isTrue(meeting.inMeetingActions.get()['canUseVoip']);
        });

        forEach(
          [
            {
              meetingInfo: {},
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_VIDEO]: true,
              },
              expectedActions: {
                canDoVideo: true,
              },
            },
            {
              meetingInfo: {},
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_VIDEO]: false,
              },
              expectedActions: {
                canDoVideo: true,
              },
            },
            {
              meetingInfo: {some: 'data'},
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_VIDEO]: true,
              },
              expectedActions: {
                canDoVideo: false,
              },
            },
            {
              meetingInfo: {some: 'data'},
              selfUserPolicies: undefined,
              expectedActions: {
                canDoVideo: true,
              },
            },
            {
              meetingInfo: {
                video: {},
              },
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_VIDEO]: true,
              },
              expectedActions: {
                canDoVideo: true,
              },
            },
            {
              meetingInfo: undefined,
              selfUserPolicies: {},
              expectedActions: {
                canDoVideo: true,
              },
            },
            {
              meetingInfo: {
                video: {},
              },
              selfUserPolicies: {
                [SELF_POLICY.SUPPORT_VIDEO]: false,
              },
              expectedActions: {
                canDoVideo: false,
              },
            },
          ],
          ({meetingInfo, selfUserPolicies, expectedActions}) => {
            it(`has expectedActions ${JSON.stringify(
              expectedActions
            )} when policies are ${JSON.stringify(
              selfUserPolicies
            )} and meetingInfo is ${JSON.stringify(meetingInfo)}`, () => {
              meeting.meetingInfo = meetingInfo;
              meeting.selfUserPolicies = selfUserPolicies;
              meeting.config.experimental.enableUnifiedMeetings = true;

              meeting.updateMeetingActions();

              assert.deepEqual(
                {
                  canDoVideo: meeting.inMeetingActions.canDoVideo,
                },
                expectedActions
              );
            });
          }
        );

        it('correctly updates the meeting actions', () => {
          // Due to import tree issues, hasHints must be stubed within the scope of the `it`.
          const restorableHasHints = ControlsOptionsUtil.hasHints;
          ControlsOptionsUtil.hasHints = sinon.stub().returns(true);
          const hasPoliciesSpy = sinon.stub(ControlsOptionsUtil, 'hasPolicies').returns(true);

          const selfUserPolicies = {a: true};
          meeting.selfUserPolicies = {a: true};
          const userDisplayHints = ['LOCK_CONTROL_UNLOCK'];
          meeting.userDisplayHints = ['LOCK_CONTROL_UNLOCK'];
          meeting.meetingInfo.supportVoIP = true;

          meeting.updateMeetingActions();

          assert.calledWith(canUserLockSpy, userDisplayHints);
          assert.calledWith(canUserUnlockSpy, userDisplayHints);
          assert.calledWith(canUserStartSpy, userDisplayHints);
          assert.calledWith(canUserStopSpy, userDisplayHints);
          assert.calledWith(canUserPauseSpy, userDisplayHints);
          assert.calledWith(canUserResumeSpy, userDisplayHints);
          assert.calledWith(canSetMuteOnEntrySpy, userDisplayHints);
          assert.calledWith(canUnsetMuteOnEntrySpy, userDisplayHints);
          assert.calledWith(canSetDisallowUnmuteSpy, userDisplayHints);
          assert.calledWith(canUnsetDisallowUnmuteSpy, userDisplayHints);
          assert.calledWith(canUserRaiseHandSpy, userDisplayHints);
          assert.calledWith(bothLeaveAndEndMeetingAvailableSpy, userDisplayHints);
          assert.calledWith(canUserLowerAllHandsSpy, userDisplayHints);
          assert.calledWith(canUserLowerSomeoneElsesHandSpy, userDisplayHints);
          assert.calledWith(waitingForOthersToJoinSpy, userDisplayHints);
          assert.calledWith(canSendReactionsSpy, null, userDisplayHints);
          assert.calledWith(canUserRenameSelfAndObservedSpy, userDisplayHints);
          assert.calledWith(canUserRenameOthersSpy, userDisplayHints);
          assert.calledWith(canShareWhiteBoardSpy, userDisplayHints);

          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.MUTE_ALL],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.UNMUTE_ALL],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_HARD_MUTE],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_HARD_MUTE],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_REACTIONS],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_REACTIONS],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_SHOW_DISPLAY_NAME],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CONTROL],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_FILE],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_FILE_SHARE],
            policies: selfUserPolicies,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_APPLICATION],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_APP_SHARE],
            policies: selfUserPolicies,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CAMERA],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_CAMERA_SHARE],
            policies: selfUserPolicies,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_DESKTOP],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_DESKTOP_SHARE],
            policies: selfUserPolicies,
          });
          assert.calledWith(ControlsOptionsUtil.hasHints, {
            requiredHints: [DISPLAY_HINTS.SHARE_CONTENT],
            displayHints: userDisplayHints,
          });
          assert.calledWith(ControlsOptionsUtil.hasPolicies, {
            requiredPolicies: [SELF_POLICY.SUPPORT_VOIP],
            policies: selfUserPolicies,
          });

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'updateMeetingActions',
            },
            'meeting:actionsUpdate',
            meeting.inMeetingActions.get()
          );

          TriggerProxy.trigger.resetHistory();

          meeting.updateMeetingActions();

          assert.notCalled(TriggerProxy.trigger);

          ControlsOptionsUtil.hasHints = restorableHasHints;
          hasPoliciesSpy.restore();
        });
      });

      describe('#handleDataChannelUrlChange', () => {
        let updateLLMConnectionSpy;

        beforeEach(() => {
          updateLLMConnectionSpy = sinon.spy(meeting, 'updateLLMConnection');
        });

        const check = (url, expectedCalled) => {
          meeting.handleDataChannelUrlChange(url);

          if (expectedCalled) {
            assert.calledWith(updateLLMConnectionSpy);
          } else {
            assert.notCalled(updateLLMConnectionSpy);
          }
        };

        it('calls deferred updateLLMConnection if datachannelURL is set and the enableAutomaticLLM is true', () => {
          meeting.config.enableAutomaticLLM = true;
          check('some url', true);
        });

        it('does not call updateLLMConnection if datachannelURL is undefined', () => {
          meeting.config.enableAutomaticLLM = true;
          check(undefined, false);
        });

        it('does not call updateLLMConnection if enableAutomaticLLM is false', () => {
          check('some url', false);
        });
      });

      describe('#updateLLMConnection', () => {
        beforeEach(() => {
          webex.internal.llm.isConnected = sinon.stub().returns(false);
          webex.internal.llm.getLocusUrl = sinon.stub();
          webex.internal.llm.getDatachannelUrl = sinon.stub();
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
          webex.internal.llm.getDatachannelUrl.returns('a datachannel url');

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
          webex.internal.llm.getDatachannelUrl.returns('a datachannel url');

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

        it('disconnects if first if the data channel url has changed', async () => {
          meeting.joinedWith = {state: 'JOINED'};
          webex.internal.llm.isConnected.returns(true);
          webex.internal.llm.getLocusUrl.returns('a url');
          webex.internal.llm.getDatachannelUrl.returns('a datachannel url');

          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a different datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.calledWith(webex.internal.llm.disconnectLLM);
          assert.calledWith(
            webex.internal.llm.registerAndConnect,
            'a url',
            'a different datachannel url'
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
            meeting.deviceUrl = 'deviceUrl.com';
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

            assert.calledWith(meeting.meetingRequest.changeMeetingFloor, {
              disposition: FLOOR_ACTION.GRANTED,
              personUrl: url1,
              deviceUrl: 'deviceUrl.com',
              uri: url1,
              resourceUrl: {channelUrl: url2},
            });

            // ensure the CA share metric is submitted
            assert.calledWith(webex.internal.newMetrics.submitClientEvent, {
              name: 'client.share.initiated',
              payload: {mediaType: 'whiteboard'},
              options: {meetingId: meeting.id},
            });
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
            meeting.deviceUrl = 'deviceUrl.com';
          });
          it('should stop the whiteboard share', async () => {
            const whiteboardShare = meeting.stopWhiteboardShare();

            assert.exists(whiteboardShare.then);
            await whiteboardShare;

            assert.calledWith(meeting.meetingRequest.changeMeetingFloor, {
              disposition: FLOOR_ACTION.RELEASED,
              personUrl: url1,
              deviceUrl: 'deviceUrl.com',
              uri: url1,
            });
            assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
          });
        });
      });
      describe('share scenarios', () => {
        describe('triggerAnnotationInfoEvent', () => {
          it('check triggerAnnotationInfoEvent event', () => {
            TriggerProxy.trigger.reset();
            const annotationInfo = {version: '1', policy: 'Approval'};
            const expectAnnotationInfo = {
              annotationInfo,
              meetingId: meeting.id,
              resourceType: 'FILE',
            };
            meeting.webex.meetings = {};
            meeting.triggerAnnotationInfoEvent(
              {annotation: annotationInfo, resourceType: 'FILE'},
              {}
            );
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
              {annotation: annotationInfo, resourceType: 'FILE'},
              {annotation: annotationInfo, resourceType: 'FILE'}
            );
            assert.notCalled(TriggerProxy.trigger);

            TriggerProxy.trigger.reset();
            const annotationInfoUpdate = {version: '1', policy: 'AnnotationNotAllowed'};
            const expectAnnotationInfoUpdated = {
              annotationInfo: annotationInfoUpdate,
              meetingId: meeting.id,
              resourceType: 'FILE',
            };
            meeting.triggerAnnotationInfoEvent(
              {annotation: annotationInfoUpdate, resourceType: 'FILE'},
              {annotation: annotationInfo, resourceType: 'FILE'}
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
            meeting.triggerAnnotationInfoEvent(null, {
              annotation: annotationInfoUpdate,
              resourceType: 'FILE',
            });
            assert.notCalled(TriggerProxy.trigger);
          });
        });

        describe('setUpLocusMediaSharesListener', () => {
          beforeEach(() => {
            meeting.selfId = '9528d952-e4de-46cf-8157-fd4823b98377';
            meeting.deviceUrl = 'my-web-url';
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

          const SHARE_TYPE = {
            FILE: 'FILE',
            DESKTOP: 'DESKTOP',
          };

          const DEVICE_URL = {
            LOCAL_WEB: 'my-web-url',
            LOCAL_MAC: 'my-mac-url',
            REMOTE_A: 'remote-user-A-url',
            REMOTE_B: 'remote-user-B-url',
          };

          const generateContent = (
            beneficiaryId = null,
            disposition = null,
            deviceUrlSharing = null,
            annotation = undefined,
            resourceType = undefined
          ) => ({
            beneficiaryId,
            disposition,
            deviceUrlSharing,
            annotation,
            resourceType,
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
            shareInstanceId,
            deviceUrlSharing,
            resourceType
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
              meeting: {
                eventName: EVENT_TRIGGERS.MEETING_LOCUS_URL_UPDATE,
                eventPayload: 'newLocusUrl',
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
                  deviceUrlSharing,
                  annotation,
                  resourceType
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

                  // Web client is sharing locally
                  if (beneficiaryId === USER_IDS.ME && deviceUrlSharing === DEVICE_URL.LOCAL_WEB) {
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
                        resourceType: undefined,
                      },
                    });
                  }
                }

                if (beneficiaryId === USER_IDS.ME && deviceUrlSharing === DEVICE_URL.LOCAL_WEB) {
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

                if (beneficiaryId === USER_IDS.ME && deviceUrlSharing === DEVICE_URL.LOCAL_WEB) {
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
            let callCounter = 2;

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

            // Start with 2 to ignore members:update trigger, and meeting:locus:locusUrl:update

            let i = 2;
            let offset = 3;

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
                USER_IDS.ME,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data4 = generateData(
                data3.payload,
                false,
                true,
                USER_IDS.ME,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );

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
                USER_IDS.ME,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
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
                USER_IDS.REMOTE_A,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data4 = generateData(
                data3.payload,
                false,
                true,
                USER_IDS.ME,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );

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
                USER_IDS.REMOTE_A,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
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
                USER_IDS.REMOTE_A,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_B
              );
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3, data4]);
            });
          });

          describe('Desktop --> Whiteboard A', () => {
            it('Scenario #1: you share desktop and then share whiteboard', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
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
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
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
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
              );
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

            it('Scenario #4: remote person A shares desktop and then shares whiteboard', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
              );
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

            it('Scenario #5: remote person A shares desktop and remote person B shares whiteboard', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
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
          describe('Desktop A --> Desktop B', () => {
            it('Scenario #1: you share desktop using web client and then share using native client', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data2 = generateData(
                data1.payload,
                false,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data3 = generateData(
                data2.payload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_MAC
              );
              const data4 = generateData(
                data3.payload,
                false,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_MAC
              );

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #2: you share desktop using web client and remote person A shares desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data2 = generateData(
                data1.payload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
              );
              const data3 = generateData(
                data2.payload,
                false,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
              );

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares desktop and then you share desktop using web client', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A
              );
              const data2 = generateData(
                data1.payload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );
              const data3 = generateData(
                data2.payload,
                false,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB
              );

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares desktop A and then shares desktop B', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, true, USER_IDS.REMOTE_A);
              const data3 = generateData(data2.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares desktop A and remote person B shares desktop B', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.REMOTE_A,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_A,
                undefined
              );
              const data2 = generateData(
                data1.payload,
                true,
                true,
                USER_IDS.REMOTE_B,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.REMOTE_B,
                undefined
              );
              const data3 = generateData(data2.payload, false, true, USER_IDS.REMOTE_B, undefined);

              payloadTestHelper([data1, data2, data3]);
            });
          });

          describe('File Share  --> Desktop Share', () => {
            it('Scenario #1: remote person A shares file then share desktop', () => {
              const data1 = generateData(
                blankPayload,
                true,
                true,
                USER_IDS.ME,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                DEVICE_URL.LOCAL_WEB,
                SHARE_TYPE.FILE
              );
              const data2 = generateData(
                data1.payload,
                true,
                false,
                USER_IDS.ME,
                SHARE_TYPE.DESKTOP
              );
              const data3 = generateData(data2.payload, true, true, USER_IDS.ME);

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

  describe('#buildLeaveFetchRequestOptions', () => {
    it('should have #buildLeaveFetchRequestOptions', () => {
      assert.exists(meeting.buildLeaveFetchRequestOptions);
    });

    it('calls expected functions', () => {
      const buildLeaveFetchRequestOptionsSpy = sinon.spy(
        MeetingUtil,
        'buildLeaveFetchRequestOptions'
      );
      const prepareFetchOptionsSpy = sinon.stub();
      webex.prepareFetchOptions = prepareFetchOptionsSpy;

      meeting.buildLeaveFetchRequestOptions({resourceId: 'foo'});

      assert.calledOnce(buildLeaveFetchRequestOptionsSpy);
      assert.instanceOf(buildLeaveFetchRequestOptionsSpy.getCall(0).args[0], Meeting);
      assert.deepEqual(buildLeaveFetchRequestOptionsSpy.getCall(0).args[1], {resourceId: 'foo'});

      assert.calledOnce(prepareFetchOptionsSpy);
      assert.deepEqual(prepareFetchOptionsSpy.getCall(0).args[0], {
        body: {
          correlationId: meeting.correlationId,
          device: {
            deviceType: undefined,
            url: uuid3,
          },
          usingResource: 'foo',
        },
        method: 'PUT',
        uri: `${url1}/participant/${uuid1}/leave`,
      });
    });
  });

  describe('#getPermissionTokenExpiryInfo', () => {
    let now;
    let clock;

    beforeEach(() => {
      now = Date.now();

      // mock `new Date()` with constant `now`
      clock = sinon.useFakeTimers(now);
    });

    afterEach(() => {
      clock.restore();
    });

    it('should return undefined if exp is undefined', () => {
      assert.equal(meeting.getPermissionTokenExpiryInfo(), undefined);
    });

    it('should return the expected positive exp', () => {
      // set permission token as now + 1 sec
      const expiryTime = now + 1000;
      meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: now};
      meeting.permissionTokenReceivedLocalTime = now;
      assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
        timeLeft: 1,
        expiryTime: Number(expiryTime),
        currentTime: now,
      });
    });

    it('should return the expected negative exp', () => {
      // set permission token as now - 1 sec
      const expiryTime = now - 1000;
      meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: now};
      meeting.permissionTokenReceivedLocalTime = now;
      assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
        timeLeft: -1,
        expiryTime: Number(expiryTime),
        currentTime: now,
      });
    });

    describe('#getPermissionTokenExpiryInfo with wrong current time which is in future', () => {
      let now;
      let clock;
      beforeEach(() => {
        // current time is 3 hours off
        now = Date.now() + 10800000;

        // mock `new Date()` with constant `now`
        clock = sinon.useFakeTimers(now);
      });

      afterEach(() => {
        clock.restore();
      });

      it('should return the expected positive exp when client time is wrong', () => {
        const serverTime = Date.now();

        // set permission token as now + 1 sec
        const expiryTime = serverTime + 1000;
        meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: serverTime};
        meeting.permissionTokenReceivedLocalTime = now;
        assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
          timeLeft: 1,
          expiryTime: Number(expiryTime),
          currentTime: now,
        });
      });

      it('should return the expected negative exp when client time is wrong', () => {
        const serverTime = Date.now();
        // set permission token as now - 1 sec
        const expiryTime = serverTime - 1000;
        meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: serverTime};
        meeting.permissionTokenReceivedLocalTime = now;
        assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
          timeLeft: -1,
          expiryTime: Number(expiryTime),
          currentTime: now,
        });
      });
    });

    describe('#getPermissionTokenExpiryInfo with wrong current Time which is in the past', () => {
      let now;
      let clock;
      beforeEach(() => {
        // current time is 3 hours off
        now = Date.now() - 10800000;

        // mock `new Date()` with constant `now`
        clock = sinon.useFakeTimers(now);
      });

      afterEach(() => {
        clock.restore();
      });

      it('should return the expected positive exp when client time is wrong', () => {
        const serverTime = Date.now();

        // set permission token as now + 1 sec
        const expiryTime = serverTime + 1000;
        meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: serverTime};
        meeting.permissionTokenReceivedLocalTime = now;
        assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
          timeLeft: 1,
          expiryTime: Number(expiryTime),
          currentTime: now,
        });
      });

      it('should return the expected negative exp when client time is wrong', () => {
        const serverTime = Date.now();
        // set permission token as now - 1 sec
        const expiryTime = serverTime - 1000;
        meeting.permissionTokenPayload = {exp: expiryTime.toString(), iat: serverTime};
        meeting.permissionTokenReceivedLocalTime = now;
        assert.deepEqual(meeting.getPermissionTokenExpiryInfo(), {
          timeLeft: -1,
          expiryTime: Number(expiryTime),
          currentTime: now,
        });
      });
    });
  });

  describe('#checkAndRefreshPermissionToken', () => {
    it('should not fire refreshPermissionToken if permissionToken is not defined', async () => {
      meeting.getPermissionTokenExpiryInfo = sinon.stub().returns(undefined);
      meeting.refreshPermissionToken = sinon.stub().returns(Promise.resolve('test return value'));

      const returnValue = await meeting.checkAndRefreshPermissionToken(10, 'ttl-join');

      assert.calledOnce(meeting.getPermissionTokenExpiryInfo);
      assert.notCalled(meeting.refreshPermissionToken);
      assert.equal(returnValue, undefined);
    });

    it('should fire refreshPermissionToken if time left is below 10sec', async () => {
      meeting.getPermissionTokenExpiryInfo = sinon
        .stub()
        .returns({timeLeft: 9, expiryTime: 122132, currentTime: Date.now()});
      meeting.refreshPermissionToken = sinon.stub().returns(Promise.resolve('test return value'));

      const returnValue = await meeting.checkAndRefreshPermissionToken(10, 'ttl-join');

      assert.calledOnce(meeting.getPermissionTokenExpiryInfo);
      assert.calledOnceWithExactly(meeting.refreshPermissionToken, 'ttl-join');
      assert.equal(returnValue, 'test return value');
    });

    it('should fire refreshPermissionToken if time left is equal 10sec', async () => {
      meeting.getPermissionTokenExpiryInfo = sinon
        .stub()
        .returns({timeLeft: 10, expiryTime: 122132, currentTime: Date.now()});
      meeting.refreshPermissionToken = sinon.stub().returns(Promise.resolve('test return value'));

      const returnValue = await meeting.checkAndRefreshPermissionToken(10, 'ttl-join');

      assert.calledOnce(meeting.getPermissionTokenExpiryInfo);
      assert.calledOnceWithExactly(meeting.refreshPermissionToken, 'ttl-join');
      assert.equal(returnValue, 'test return value');
    });

    it('should not fire refreshPermissionToken if time left is higher than 10sec', async () => {
      meeting.getPermissionTokenExpiryInfo = sinon
        .stub()
        .returns({timeLeft: 11, expiryTime: 122132, currentTime: Date.now()});
      meeting.refreshPermissionToken = sinon.stub().returns(Promise.resolve('test return value'));

      const returnValue = await meeting.checkAndRefreshPermissionToken(10, 'ttl-join');

      assert.calledOnce(meeting.getPermissionTokenExpiryInfo);
      assert.notCalled(meeting.refreshPermissionToken);
      assert.equal(returnValue, undefined);
    });
  });

  describe('#roapMessageReceived', () => {
    it('calls roapMessageReceived on the webrtc media connection', () => {
      const fakeMessage = {messageType: 'fake', sdp: 'fake sdp'};

      const getMediaServer = sinon.stub(MeetingsUtil, 'getMediaServer').returns('homer');

      meeting.mediaProperties.webrtcMediaConnection = {
        roapMessageReceived: sinon.stub(),
      };

      meeting.roapMessageReceived(fakeMessage);

      assert.calledOnceWithExactly(
        meeting.mediaProperties.webrtcMediaConnection.roapMessageReceived,
        fakeMessage
      );
      assert.calledOnceWithExactly(getMediaServer, 'fake sdp');
      assert.equal(meeting.mediaProperties.webrtcMediaConnection.mediaServer, 'homer');
    });
  });
});
