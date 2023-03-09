/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {cloneDeep, isEqual} from 'lodash';
import sinon from 'sinon';
import StateMachine from 'javascript-state-machine';
import uuid from 'uuid';
import {assert} from '@webex/test-helper-chai';
import {Credentials} from '@webex/webex-core';
import Support from '@webex/internal-plugin-support';
import MockWebex from '@webex/test-helper-mock-webex';
import {
  FLOOR_ACTION,
  SHARE_STATUS,
  MEETING_INFO_FAILURE_REASON,
  PASSWORD_STATUS,
  EVENTS,
  EVENT_TRIGGERS,
  _SIP_URI_,
  _MEETING_ID_,
  LOCUSINFO,
  PC_BAIL_TIMEOUT,
} from '@webex/plugin-meetings/src/constants';
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import {ConnectionState, Event, Errors, ErrorType, LocalTrackEvents, RemoteTrackType} from '@webex/internal-media-core';
import * as StatsAnalyzerModule from '@webex/plugin-meetings/src/statsAnalyzer';
import * as MuteStateModule from '@webex/plugin-meetings/src/meeting/muteState';
import EventsScope from '@webex/plugin-meetings/src/common/events/events-scope';
import Meetings, {CONSTANTS} from '@webex/plugin-meetings';
import Meeting from '@webex/plugin-meetings/src/meeting';
import Members from '@webex/plugin-meetings/src/members';
import Roap from '@webex/plugin-meetings/src/roap';
import MeetingRequest from '@webex/plugin-meetings/src/meeting/request';
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
import BrowserDetection from '@webex/plugin-meetings/src/common/browser-detection';
import Metrics from '@webex/plugin-meetings/src/metrics';
import {trigger, eventType} from '@webex/plugin-meetings/src/metrics/config';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import {IceGatheringFailed} from '@webex/plugin-meetings/src/common/errors/webex-errors';
import {MediaRequestManager} from '@webex/plugin-meetings/src/multistream/mediaRequestManager';

import LLM from '@webex/internal-plugin-llm';
import Mercury from '@webex/internal-plugin-mercury';
import Breakouts from '@webex/plugin-meetings/src/breakouts';
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
import IntentToJoinError from '../../../../src/common/errors/intent-to-join';
import DefaultSDKConfig from '../../../../src/config';
import testUtils from '../../../utils/testUtils';
import {
  MeetingInfoV2CaptchaError,
  MeetingInfoV2PasswordError,
} from '../../../../src/meeting-info/meeting-info-v2';

const {getBrowserName} = BrowserDetection();

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
        },
        metrics: {
          type: ['behavioral'],
        },
      },
    });

    webex.internal.support.submitLogs = sinon.stub().returns(Promise.resolve());
    webex.credentials.getOrgId = sinon.stub().returns('fake-org-id');
    webex.internal.metrics.submitClientMetrics = sinon.stub().returns(Promise.resolve());
    webex.meetings.uploadLogs = sinon.stub().returns(Promise.resolve());
    webex.internal.llm.on = sinon.stub();

    TriggerProxy.trigger = sinon.stub().returns(true);
    Metrics.postEvent = sinon.stub();
    Metrics.initialSetup(null, webex);
    MediaUtil.createMediaStream = sinon.stub().callsFake((tracks) => {
      return {
        getTracks: () => tracks
      };
    });;

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
          assert.equal(meeting.userId, uuid1);
          assert.equal(meeting.resource, uuid2);
          assert.equal(meeting.deviceUrl, uuid3);
          assert.deepEqual(meeting.meetingInfo, {});
          assert.instanceOf(meeting.members, Members);
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
          assert.instanceOf(meeting.locusInfo, LocusInfo);
          assert.equal(meeting.fetchMeetingInfoTimeoutId, undefined);
          assert.instanceOf(meeting.mediaProperties, MediaProperties);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.UNKNOWN);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.meetingInfoFailureReason, undefined);
          assert.equal(meeting.destination, testDestination);
          assert.equal(meeting.destinationType, _MEETING_ID_);
          assert.instanceOf(meeting.breakouts, Breakouts);
        });
        it('creates MediaRequestManager instances', () => {
          assert.instanceOf(meeting.mediaRequestManagers.audio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.video, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareAudio, MediaRequestManager);
          assert.instanceOf(meeting.mediaRequestManagers.screenShareVideo, MediaRequestManager);
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
          const locusUrls = {authorizingLocusUrl: 'authorizingLocusUrl', mainLocusUrl: 'mainLocusUrl'};
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
      describe('#isAudioMuted', () => {
        it('should have #isAudioMuted', () => {
          assert.exists(meeting.invite);
        });
        it('should get the audio muted status and return as a boolean', () => {
          const muted = meeting.isAudioMuted();

          assert.isNotOk(muted);
        });
      });
      describe('#isAudioSelf', () => {
        it('should have #isAudioSelf', () => {
          assert.exists(meeting.invite);
        });
        it('should get the audio self status and return as a boolean', () => {
          const self = meeting.isAudioSelf();

          assert.isNotOk(self);
        });
      });
      describe('#isVideoMuted', () => {
        it('should have #isVideoMuted', () => {
          assert.exists(meeting.isVideoMuted);
        });
        it('should get the video muted status and return as a boolean', () => {
          const muted = meeting.isVideoMuted();

          assert.isNotOk(muted);
        });
      });
      describe('#isVideoSelf', () => {
        it('should have #isVideoSelf', () => {
          assert.exists(meeting.invite);
        });
        it('should get the video self status and return as a boolean', () => {
          const self = meeting.isVideoSelf();

          assert.isNotOk(self);
        });
      });
      describe('#muteAudio', () => {
        it('should have #muteAudio', () => {
          assert.exists(meeting.muteAudio);
        });
        describe('before audio is defined', () => {
          it('should reject and return a promise', async () => {
            await meeting.muteAudio().catch((err) => {
              assert.instanceOf(err, UserNotJoinedError);
            });
          });

          it('should reject and return a promise', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.muteAudio().catch((err) => {
              assert.instanceOf(err, NoMediaEstablishedYetError);
            });
          });

          it('should reject and return a promise', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            meeting.mediaId = 'mediaId';
            await meeting.muteAudio().catch((err) => {
              assert.instanceOf(err, ParameterError);
            });
          });
        });
        describe('after audio is defined', () => {
          let handleClientRequest;

          beforeEach(() => {
            handleClientRequest = sinon.stub().returns(Promise.resolve());
            meeting.audio = {handleClientRequest};
          });

          it('should return a promise resolution', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            meeting.mediaId = 'mediaId';

            const audio = meeting.muteAudio();

            assert.exists(audio.then);
            await audio;
            assert.calledOnce(handleClientRequest);
            assert.calledWith(handleClientRequest, meeting, true);
          });
        });
      });
      describe('#unmuteAudio', () => {
        it('should have #unmuteAudio', () => {
          assert.exists(meeting.unmuteAudio);
        });
        describe('before audio is defined', () => {
          it('should reject when user not joined', async () => {
            await meeting.unmuteAudio().catch((err) => {
              assert.instanceOf(err, UserNotJoinedError);
            });
          });

          it('should reject when no media is established yet ', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.unmuteAudio().catch((err) => {
              assert.instanceOf(err, NoMediaEstablishedYetError);
            });
          });

          it('should reject when audio is not there or established', async () => {
            meeting.mediaId = 'mediaId';
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.unmuteAudio().catch((err) => {
              assert.instanceOf(err, ParameterError);
            });
          });
        });
        describe('after audio is defined', () => {
          let handleClientRequest;

          beforeEach(() => {
            handleClientRequest = sinon.stub().returns(Promise.resolve());
            meeting.mediaId = 'mediaId';
            meeting.audio = {handleClientRequest};
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
          });

          it('should return a promise resolution', async () => {
            meeting.audio = {handleClientRequest};

            const audio = meeting.unmuteAudio();

            assert.exists(audio.then);
            await audio;
            assert.calledOnce(handleClientRequest);
            assert.calledWith(handleClientRequest, meeting, false);
          });
        });
      });
      describe('BNR', () => {
        const fakeMediaTrack = () => ({
          id: Date.now().toString(),
          stop: () => {},
          readyState: 'live',
          enabled: true,
          getSettings: () => ({
            sampleRate: 48000,
          }),
        });

        beforeEach(() => {
          meeting.getMediaStreams = sinon.stub().returns(Promise.resolve());
          sinon.replace(meeting, 'addMedia', () => {
            sinon.stub(meeting.mediaProperties, 'audioTrack').value(fakeMediaTrack());
            sinon.stub(meeting.mediaProperties, 'mediaDirection').value({
              receiveAudio: true,
            });
          });
        });
      });
      describe('#muteVideo', () => {
        it('should have #muteVideo', () => {
          assert.exists(meeting.muteVideo);
        });
        describe('before video is defined', () => {
          it('should reject when user not joined', async () => {
            await meeting.muteVideo().catch((err) => {
              assert.instanceOf(err, UserNotJoinedError);
            });
          });

          it('should reject when no media is established', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.muteVideo().catch((err) => {
              assert.instanceOf(err, NoMediaEstablishedYetError);
            });
          });

          it('should reject when no video added or established', async () => {
            meeting.mediaId = 'mediaId';
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.muteVideo().catch((err) => {
              assert.instanceOf(err, ParameterError);
            });
          });
        });
        describe('after video is defined', () => {
          it('should return a promise resolution', async () => {
            const handleClientRequest = sinon.stub().returns(Promise.resolve());

            meeting.mediaId = 'mediaId';
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            meeting.video = {handleClientRequest};
            const video = meeting.muteVideo();

            assert.exists(video.then);
            await video;
            assert.calledOnce(handleClientRequest);
            assert.calledWith(handleClientRequest, meeting, true);
          });
        });
      });
      describe('#unmuteVideo', () => {
        it('should have #unmuteVideo', () => {
          assert.exists(meeting.unmuteVideo);
        });
        describe('before video is defined', () => {
          it('should reject no user joined', async () => {
            await meeting.unmuteVideo().catch((err) => {
              assert.instanceOf(err, Error);
            });
          });

          it('should reject no media established', async () => {
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.unmuteVideo().catch((err) => {
              assert.instanceOf(err, Error);
            });
          });

          it('should reject when no video added or established', async () => {
            meeting.mediaId = 'mediaId';
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            await meeting.unmuteVideo().catch((err) => {
              assert.instanceOf(err, Error);
            });
          });
        });
        describe('after video is defined', () => {
          it('should return a promise resolution', async () => {
            const handleClientRequest = sinon.stub().returns(Promise.resolve());

            meeting.mediaId = 'mediaId';
            meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
            meeting.video = {handleClientRequest};
            const video = meeting.unmuteVideo();

            assert.exists(video.then);
            await video;
            assert.calledOnce(handleClientRequest);
            assert.calledWith(handleClientRequest, meeting, false);
          });
        });
      });
      describe('#joinWithMedia', () => {
        it('should have #joinWithMedia', () => {
          assert.exists(meeting.joinWithMedia);
        });
        describe('resolution', () => {
          it('should success and return a promise', async () => {
            meeting.join = sinon.stub().returns(Promise.resolve(test1));
            meeting.getMediaStreams = sinon.stub().returns(Promise.resolve([test2, test3]));
            meeting.addMedia = sinon.stub().returns(Promise.resolve(test4));
            await meeting.joinWithMedia({});
            assert.calledOnce(meeting.join);
            assert.calledOnce(meeting.getMediaStreams);
          });
        });
        describe('rejection', () => {
          it('should error out and return a promise', async () => {
            meeting.join = sinon.stub().returns(Promise.reject());
            meeting.getMediaStreams = sinon.stub().returns(true);
            assert.isRejected(meeting.joinWithMedia({}));
          });
        });
      });
      describe('#getMediaStreams', () => {
        beforeEach(() => {
          sinon
            .stub(Media, 'getSupportedDevice')
            .callsFake((options) =>
              Promise.resolve({sendAudio: options.sendAudio, sendVideo: options.sendVideo})
            );
          sinon.stub(Media, 'getUserMedia').returns(Promise.resolve(['stream1', 'stream2']));
        });
        afterEach(() => {
          sinon.restore();
        });
        it('should have #getMediaStreams', () => {
          assert.exists(meeting.getMediaStreams);
        });
        it('should proxy Media getUserMedia, and return a promise', async () => {
          await meeting.getMediaStreams({sendAudio: true, sendVideo: true});

          assert.calledOnce(Media.getUserMedia);
        });

        it('uses the preferred video device if set', async () => {
          const videoDevice = 'video1';
          const mediaDirection = {sendAudio: true, sendVideo: true, sendShare: false};
          const audioVideoSettings = {};

          sinon.stub(meeting.mediaProperties, 'videoDeviceId').value(videoDevice);
          sinon.stub(meeting.mediaProperties, 'localQualityLevel').value('480p');
          await meeting.getMediaStreams(mediaDirection, audioVideoSettings);

          assert.calledWith(
            Media.getUserMedia,
            {
              ...mediaDirection,
              isSharing: false,
            },
            {
              video: {
                width: {max: 640, ideal: 640},
                height: {max: 480, ideal: 480},
                deviceId: videoDevice,
              },
            }
          );
        });
        it('will set a new preferred video input device if passed in', async () => {
          // if audioVideo settings parameter specifies a new video device it
          // will store that device as the preferred video device.
          // Which is the case with meeting.updateVideo()
          const oldVideoDevice = 'video1';
          const newVideoDevice = 'video2';
          const mediaDirection = {sendAudio: true, sendVideo: true, sendShare: false};
          const audioVideoSettings = {video: {deviceId: newVideoDevice}};

          sinon.stub(meeting.mediaProperties, 'videoDeviceId').value(oldVideoDevice);
          sinon.stub(meeting.mediaProperties, 'setVideoDeviceId');

          await meeting.getMediaStreams(mediaDirection, audioVideoSettings);

          assert.calledWith(meeting.mediaProperties.setVideoDeviceId, newVideoDevice);
        });

        it('uses the passed custom video resolution', async () => {
          const mediaDirection = {sendAudio: true, sendVideo: true, sendShare: false};
          const customAudioVideoSettings = {
            video: {
              width: {
                max: 400,
                ideal: 400,
              },
              height: {
                max: 200,
                ideal: 200,
              },
              frameRate: {
                ideal: 15,
                max: 30,
              },
              facingMode: {
                ideal: 'user',
              },
            },
          };

          sinon.stub(meeting.mediaProperties, 'localQualityLevel').value('200p');
          await meeting.getMediaStreams(mediaDirection, customAudioVideoSettings);

          assert.calledWith(
            Media.getUserMedia,
            {
              ...mediaDirection,
              isSharing: false,
            },
            customAudioVideoSettings
          );
        });
        it('should not access camera if sendVideo is false ', async () => {
          await meeting.getMediaStreams({sendAudio: true, sendVideo: false});

          assert.calledOnce(Media.getUserMedia);

          assert.equal(Media.getUserMedia.args[0][0].sendVideo, false);
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
            }
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
        })
      })
      describe('#join', () => {
        let sandbox = null;
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
          meeting.setCorrelationId = sinon.stub().returns(true);
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

            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.CALL_INITIATED,
              data: {trigger: trigger.USER_INTERACTION, isRoapCallEnabled: true},
            });

            assert.exists(join.then);
            const result = await join;

            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
            assert.equal(result, joinMeetingResult);
          });

          it('should call updateLLMConnection upon joining if config value is set', async () => {
            meeting.config.enableAutomaticLLM = true;
            meeting.webex.internal.llm.on = sinon.stub();
            meeting.processRelayEvent = sinon.stub();
            await meeting.join();

            assert.calledOnce(meeting.updateLLMConnection);
            assert.calledOnceWithExactly(meeting.webex.internal.llm.on, 'event:relay.event', meeting.processRelayEvent);
          });

          it('should not call updateLLMConnection upon joining if config value is not set', async () => {
            meeting.webex.internal.llm.on = sinon.stub();
            await meeting.join();

            assert.notCalled(meeting.updateLLMConnection);
            assert.notCalled(meeting.webex.internal.llm.on);
          });

          it('should invoke `receiveTranscription()` if receiveTranscription is set to true', async () => {
            meeting.isTranscriptionSupported = sinon.stub().returns(true);
            meeting.receiveTranscription = sinon.stub().returns(Promise.resolve());

            await meeting.join({receiveTranscription: true});
            assert.calledOnce(meeting.receiveTranscription);
          });

          it('should not create new correlation ID on join immediately after create', async () => {
            await meeting.join();
            sinon.assert.notCalled(meeting.setCorrelationId);
          });

          it('should create new correlation ID when already joined', async () => {
            meeting.hasJoinedOnce = true;
            await meeting.join();
            sinon.assert.called(meeting.setCorrelationId);
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
              assert.calledWithMatch(Metrics.postEvent, {event: eventType.LOCUS_JOIN_RESPONSE});
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
          Media.createMediaConnection = sinon.stub().returns(fakeMediaConnection);
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
              turnDiscoverySkippedReason: 'config',
              turnServerUsed: false,
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

          assert.instanceOf(result, Error);
          assert.isNull(meeting.mediaProperties.webrtcMediaConnection);

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
            })
          );
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
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(meeting.mediaProperties.setMediaDirection);
          assert.calledOnce(Media.createMediaConnection);
          assert.calledWith(
            Media.createMediaConnection,
            false,
            meeting.getMediaConnectionDebugId(),
            sinon.match({turnServerInfo: undefined})
          );
          assert.calledOnce(meeting.setMercuryListener);
          assert.calledOnce(fakeMediaConnection.initiateOffer);
          /* statsAnalyzer is initiated inside of addMedia so there isn't
           * a good way to mock it without mocking the constructor
           */
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
          fakeMediaConnection.getConnectionState = sinon
            .stub()
            .returns(ConnectionState.Connecting);
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
            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.SENDING_MEDIA_START,
              data: {mediaType: 'audio'},
            });
          });

          it('LOCAL_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.LOCAL_MEDIA_STOPPED,
              {type: 'video'}
            );

            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.SENDING_MEDIA_STOP,
              data: {mediaType: 'video'},
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
            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.RECEIVING_MEDIA_START,
              data: {mediaType: 'video'},
            });
          });

          it('REMOTE_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.REMOTE_MEDIA_STOPPED,
              {type: 'audio'}
            );

            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.RECEIVING_MEDIA_STOP,
              data: {mediaType: 'audio'},
            });
          });

          it('MEDIA_QUALITY triggers the right metrics', async () => {
            const fakeData = {intervalMetadata: {bla: 'bla'}};

            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.MEDIA_QUALITY,
              {data: fakeData, networkType: 'wifi'}
            );

            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.MEDIA_QUALITY,
              data: {intervalData: fakeData, networkType: 'wifi'},
            });
          });
        });
      });
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
          // the 3 need to be promises because we do closeLocalStream.then(closeLocalShare.then) etc in the src code
          meeting.closeLocalStream = sinon.stub().returns(Promise.resolve());
          meeting.closeLocalShare = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteTracks').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetLocalVideoTrack = sinon.stub().returns(true);
          meeting.unsetLocalShareTrack = sinon.stub().returns(true);
          meeting.unsetRemoteTracks = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetRemoteStream = sinon.stub().returns(true);
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
          assert.calledOnce(meeting.closeLocalStream);
          assert.calledOnce(meeting.closeLocalShare);
          assert.calledOnce(meeting.closeRemoteTracks);
          assert.calledOnce(meeting.closePeerConnections);
          assert.calledOnce(meeting.unsetLocalVideoTrack);
          assert.calledOnce(meeting.unsetLocalShareTrack);
          assert.calledOnce(meeting.unsetRemoteTracks);
          assert.calledOnce(meeting.unsetPeerConnections);
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
      });
      describe('#requestScreenShareFloor', () => {
        it('should have #requestScreenShareFloor', () => {
          assert.exists(meeting.requestScreenShareFloor);
        });
        beforeEach(() => {
          meeting.locusInfo.mediaShares = [{name: 'content', url: url1}];
          meeting.locusInfo.self = {url: url1};
          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
        });
        it('should send the share', async () => {
          const share = meeting.requestScreenShareFloor();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
        });
      });

      describe('#shareScreen', () => {
        let _mediaDirection;

        beforeEach(() => {
          _mediaDirection = meeting.mediaProperties.mediaDirection || {};
          sinon
            .stub(meeting.mediaProperties, 'mediaDirection')
            .value({sendAudio: true, sendVideo: true, sendShare: false});
        });

        afterEach(() => {
          meeting.mediaProperties.mediaDirection = _mediaDirection;
        });

        it('should have #shareScreen', () => {
          assert.exists(meeting.shareScreen);
        });

        describe('basic functionality', () => {
          beforeEach(() => {
            sinon.stub(Media, 'getDisplayMedia').returns(Promise.resolve());
            sinon.stub(meeting, 'updateShare').returns(Promise.resolve());
          });

          afterEach(() => {
            Media.getDisplayMedia.restore();
            meeting.updateShare.restore();
          });

          it('should call get display media', async () => {
            await meeting.shareScreen();

            assert.calledOnce(Media.getDisplayMedia);
          });

          it('should call updateShare', async () => {
            await meeting.shareScreen();

            assert.calledOnce(meeting.updateShare);
          });

          it('properly assigns default values', async () => {
            await meeting.shareScreen({sharePreferences: {highFrameRate: true}});

            assert.calledWith(Media.getDisplayMedia, {
              sendShare: true,
              sendAudio: false,
              sharePreferences: {highFrameRate: true},
            });
          });
        });

        describe('stops share immediately', () => {
          let sandbox;

          beforeEach(() => {
            sandbox = sinon.createSandbox();
          });

          afterEach(() => {
            sandbox.restore();
            sandbox = null;
          });

          it('Can bypass canUpdateMedia() check', () => {
            const sendShare = true;
            const receiveShare = false;
            const stream = 'stream';

            sandbox.stub(MeetingUtil, 'getTrack').returns({videoTrack: true});
            MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve(true));
            sandbox.stub(meeting, 'canUpdateMedia').returns(true);
            sandbox.stub(meeting, 'setLocalShareTrack');

            meeting.updateShare({
              sendShare,
              receiveShare,
              stream,
              skipSignalingCheck: true,
            });

            assert.notCalled(meeting.canUpdateMedia);
          });

          it('skips canUpdateMedia() check on contentTracks.onended', () => {
            const {mediaProperties} = meeting;
            const fakeTrack = {
              getSettings: sinon.stub().returns({}),
            };

            const listeners = {};

            const fakeLocalDisplayTrack = {
              on: sinon.stub().callsFake((event, listener) => {
                listeners[event] = listener;
              })
            };
            sinon.stub(InternalMediaCoreModule, 'LocalDisplayTrack').returns(fakeLocalDisplayTrack);


            sandbox.stub(mediaProperties, 'setLocalShareTrack');
            sandbox.stub(mediaProperties, 'setMediaSettings');
            sandbox.stub(meeting, 'stopShare').resolves(true);
            meeting.setLocalShareTrack(fakeTrack);

            assert.calledOnce(fakeLocalDisplayTrack.on);
            assert.calledWith(fakeLocalDisplayTrack.on, LocalTrackEvents.Ended, sinon.match.any);
            assert.isNotNull(listeners[LocalTrackEvents.Ended]);

            listeners[LocalTrackEvents.Ended]();

            assert.calledWith(meeting.stopShare, {skipSignalingCheck: true});
          });

          it('stopShare accepts and passes along optional parameters', () => {
            const args = {
              abc: 123,
              receiveShare: false,
              sendShare: false,
            };

            sandbox.stub(meeting, 'updateShare').returns(Promise.resolve());
            sandbox.stub(meeting.mediaProperties, 'mediaDirection').value(false);

            meeting.stopShare(args);

            assert.calledWith(meeting.updateShare, args);
          });
        });

        describe('out-of-sync sharing', () => {
          let sandbox;

          beforeEach(() => {
            sandbox = sinon.createSandbox();
          });

          afterEach(() => {
            sandbox.restore();
            sandbox = null;
          });

          it('handleShareTrackEnded triggers an event', () => {
            const {EVENT_TYPES} = CONSTANTS;

            sandbox.stub(meeting, 'stopShare').resolves(true);

            meeting.handleShareTrackEnded();

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'handleShareTrackEnded',
              },
              EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
              {
                type: EVENT_TYPES.LOCAL_SHARE,
              }
            );
          });
        });
      });

      describe('#shareScreen resolutions', () => {
        let _getDisplayMedia = null;
        const config = DefaultSDKConfig.meetings;
        const {resolution} = config;
        const shareOptions = {
          sendShare: true,
          sendAudio: false,
        };
        const fireFoxOptions = {
          audio: false,
          video: {
            audio: shareOptions.sendAudio,
            video: shareOptions.sendShare,
          },
        };

        const MediaStream = {
          getVideoTracks: () => [
            {
              applyConstraints: () => {},
            },
          ],
        };

        const MediaConstraint = {
          cursor: 'always',
          aspectRatio: config.aspectRatio,
          frameRate: config.screenFrameRate,
          width: null,
          height: null,
        };

        const browserConditionalValue = (value) => {
          const key = getBrowserName().toLowerCase();
          const defaultKey = 'default';

          return value[key] || value[defaultKey];
        };

        before(() => {
          meeting.updateShare = sinon.stub().returns(Promise.resolve());

          if (!global.navigator) {
            global.navigator = {
              mediaDevices: {
                getDisplayMedia: null,
              },
            };
          }
          _getDisplayMedia = global.navigator.mediaDevices.getDisplayMedia;
          Object.defineProperty(global.navigator.mediaDevices, 'getDisplayMedia', {
            value: sinon.stub().returns(Promise.resolve(MediaStream)),
            writable: true,
          });
        });

        after(() => {
          // clean up for browser
          Object.defineProperty(global.navigator.mediaDevices, 'getDisplayMedia', {
            value: _getDisplayMedia,
            writable: true,
          });
        });

        // eslint-disable-next-line max-len
        it('will use shareConstraints if defined in provided options', () => {
          const SHARE_WIDTH = 640;
          const SHARE_HEIGHT = 480;
          const shareConstraints = {
            highFrameRate: 2,
            maxWidth: SHARE_WIDTH,
            maxHeight: SHARE_HEIGHT,
            idealWidth: SHARE_WIDTH,
            idealHeight: SHARE_HEIGHT,
          };

          // If sharePreferences.shareConstraints is defined it ignores
          // default SDK config settings
          getDisplayMedia(
            {
              ...shareOptions,
              sharePreferences: {shareConstraints},
            },
            config
          );

          // eslint-disable-next-line no-undef
          assert.calledWith(
            navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {...shareConstraints},
              },
              // Firefox is being handled differently
              firefox: fireFoxOptions,
            })
          );
        });

        // eslint-disable-next-line max-len
        it('will use default resolution if shareConstraints is undefined and highFrameRate is defined', () => {
          // If highFrameRate is defined it ignores default SDK config settings
          getDisplayMedia(
            {
              ...shareOptions,
              sharePreferences: {
                highFrameRate: true,
              },
            },
            config
          );

          // eslint-disable-next-line no-undef
          assert.calledWith(
            navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  frameRate: config.videoShareFrameRate,
                  width: resolution.idealWidth,
                  height: resolution.idealHeight,
                  maxWidth: resolution.maxWidth,
                  maxHeight: resolution.maxHeight,
                  idealWidth: resolution.idealWidth,
                  idealHeight: resolution.idealHeight,
                },
              },
              firefox: fireFoxOptions,
            })
          );
        });

        // eslint-disable-next-line max-len
        it('will use default screenResolution if shareConstraints, highFrameRate, and SDK defaults is undefined', () => {
          getDisplayMedia(shareOptions);
          const {screenResolution} = config;

          // eslint-disable-next-line no-undef
          assert.calledWith(
            navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  width: screenResolution.idealWidth,
                  height: screenResolution.idealHeight,
                },
              },
              firefox: fireFoxOptions,
            })
          );
        });

        // Test screenResolution
        // eslint-disable-next-line max-len
        it('will use SDK config screenResolution if set, with shareConstraints and highFrameRate being undefined', () => {
          const SHARE_WIDTH = 800;
          const SHARE_HEIGHT = 600;
          const customConfig = {
            screenResolution: {
              maxWidth: SHARE_WIDTH,
              maxHeight: SHARE_HEIGHT,
              idealWidth: SHARE_WIDTH,
              idealHeight: SHARE_HEIGHT,
            },
          };

          getDisplayMedia(shareOptions, customConfig);

          // eslint-disable-next-line no-undef
          assert.calledWith(
            navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  width: SHARE_WIDTH,
                  height: SHARE_HEIGHT,
                  maxWidth: SHARE_WIDTH,
                  maxHeight: SHARE_HEIGHT,
                  idealWidth: SHARE_WIDTH,
                  idealHeight: SHARE_HEIGHT,
                },
              },
              firefox: fireFoxOptions,
            })
          );
        });

        // Test screenFrameRate
        it('will use SDK config screenFrameRate if set, with shareConstraints and highFrameRate being undefined', () => {
          const SHARE_WIDTH = 800;
          const SHARE_HEIGHT = 600;
          const customConfig = {
            screenFrameRate: 999,
            screenResolution: {
              maxWidth: SHARE_WIDTH,
              maxHeight: SHARE_HEIGHT,
              idealWidth: SHARE_WIDTH,
              idealHeight: SHARE_HEIGHT,
            },
          };

          getDisplayMedia(shareOptions, customConfig);

          // eslint-disable-next-line no-undef
          assert.calledWith(
            navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  frameRate: customConfig.screenFrameRate,
                  width: SHARE_WIDTH,
                  height: SHARE_HEIGHT,
                  maxWidth: SHARE_WIDTH,
                  maxHeight: SHARE_HEIGHT,
                  idealWidth: SHARE_WIDTH,
                  idealHeight: SHARE_HEIGHT,
                },
              },
              firefox: fireFoxOptions,
            })
          );
        });
      });

      describe('#stopShare', () => {
        it('should have #stopShare', () => {
          assert.exists(meeting.stopShare);
        });
        beforeEach(() => {
          meeting.mediaProperties.mediaDirection = {receiveShare: true};
          meeting.updateShare = sinon.stub().returns(Promise.resolve());
        });
        it('should call updateShare', async () => {
          const share = meeting.stopShare();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.updateShare);
        });
      });

      describe('#updateAudio', () => {
        const FAKE_AUDIO_TRACK = {
          id: 'fake audio track',
          getSettings: sinon.stub().returns({}),
        };

        describe('when canUpdateMedia is true', () => {
          beforeEach(() => {
            meeting.canUpdateMedia = sinon.stub().returns(true);
          });
          describe('when options are valid', () => {
            beforeEach(() => {
              MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve());
              meeting.mediaProperties.mediaDirection = {
                sendAudio: false,
                sendVideo: true,
                sendShare: false,
                receiveAudio: false,
                receiveVideo: true,
                receiveShare: true,
              };
              meeting.mediaProperties.webrtcMediaConnection = {
                updateSendReceiveOptions: sinon.stub(),
              };
              sinon.stub(MeetingUtil, 'getTrack').returns({audioTrack: FAKE_AUDIO_TRACK});
            });
            it('calls this.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions', () =>
              meeting
                .updateAudio({
                  sendAudio: true,
                  receiveAudio: true,
                  stream: {id: 'fake stream'},
                })
                .then(() => {
                  assert.calledOnce(
                    meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions
                  );
                  assert.calledWith(
                    meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions,
                    {
                      send: {audio: FAKE_AUDIO_TRACK},
                      receive: {
                        audio: true,
                        video: true,
                        screenShareVideo: true,
                        remoteQualityLevel: 'HIGH',
                      },
                    }
                  );
                }));
          });
          afterEach(() => {
            sinon.restore();
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
        const mockLocalStream = {id: 'mock local stream'};
        const mockLocalShare = {id: 'mock local share stream'};
        const FAKE_TRACKS = {
          audio: {
            id: 'fake audio track',
            getSettings: sinon.stub().returns({}),
          },
          video: {
            id: 'fake video track',
            getSettings: sinon.stub().returns({}),
          },
          screenshareVideo: {
            id: 'fake share track',
            getSettings: sinon.stub().returns({}),
            on: sinon.stub()
          },
        };

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.mediaProperties.mediaDirection = {sendShare: true};
          // setup the stub to return the right tracks
          sandbox.stub(MeetingUtil, 'getTrack').callsFake((stream) => {
            if (stream === mockLocalStream) {
              return {audioTrack: FAKE_TRACKS.audio, videoTrack: FAKE_TRACKS.video};
            }
            if (stream === mockLocalShare) {
              return {audioTrack: null, videoTrack: FAKE_TRACKS.screenshareVideo};
            }

            return {audioTrack: null, videoTrack: null};
          });
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should use a queue if currently busy', async () => {
          const mediaSettings = {
            sendAudio: true,
            receiveAudio: true,
            sendVideo: true,
            receiveVideo: true,
            sendShare: true,
            receiveShare: true,
            isSharing: true,
          };

          sandbox.stub(meeting, 'canUpdateMedia').returns(false);
          meeting.mediaProperties.webrtcMediaConnection = {
            updateSendReceiveOptions: sinon.stub().resolves({}),
          };

          let myPromiseResolved = false;

          meeting
            .updateMedia({
              localStream: mockLocalStream,
              localShare: mockLocalShare,
              mediaSettings,
            })
            .then(() => {
              myPromiseResolved = true;
            });

          // verify that nothing was done
          assert.notCalled(meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions);

          // now trigger processing of the queue
          meeting.canUpdateMedia.restore();
          sandbox.stub(meeting, 'canUpdateMedia').returns(true);

          meeting.processNextQueuedMediaUpdate();
          await testUtils.flushPromises();

          // and check that updateSendReceiveOptions is called with the original args
          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions);
          assert.calledWith(
            meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions,
            {
              send: {
                audio: FAKE_TRACKS.audio,
                video: FAKE_TRACKS.video,
                screenShareVideo: FAKE_TRACKS.screenshareVideo,
              },
              receive: {
                audio: true,
                video: true,
                screenShareVideo: true,
                remoteQualityLevel: 'HIGH',
              },
            }
          );
          assert.isTrue(myPromiseResolved);
        });

        it('should request floor only after roap transaction is completed', async () => {
          const eventListeners = {};

          meeting.webex.meetings.reachability = {
            isAnyClusterReachable: sandbox.stub().resolves(true)
          };

          const fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),

            // mock the on() method and store all the listeners
            on: sinon.stub().callsFake((event, listener) => {
              eventListeners[event] = listener;
            }),

            updateSendReceiveOptions: sinon.stub().callsFake(() => {
              // trigger ROAP_STARTED before updateSendReceiveOptions() resolves
              if (eventListeners[Event.ROAP_STARTED]) {
                eventListeners[Event.ROAP_STARTED]();
              } else {
                throw new Error('ROAP_STARTED listener not registered')
              }
              return Promise.resolve();
            }),
          };

          meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
          meeting.mediaProperties.getCurrentConnectionType = sinon.stub().resolves('udp');
          Media.createMediaConnection = sinon.stub().returns(fakeMediaConnection);

          const requestScreenShareFloorStub = sandbox.stub(meeting, 'requestScreenShareFloor').resolves({});

          let myPromiseResolved = false;

          meeting.meetingState = 'ACTIVE';
          await meeting.addMedia({
            mediaSettings: {},
          });

          meeting
            .updateMedia({
              localShare: mockLocalShare,
              mediaSettings: {
                sendShare: true,
              },
            })
            .then(() => {
              myPromiseResolved = true;
            });

          await testUtils.flushPromises();

          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions);
          assert.isFalse(myPromiseResolved);

          // verify that requestScreenShareFloorStub was not called yet
          assert.notCalled(requestScreenShareFloorStub);

          eventListeners[Event.ROAP_DONE]();
          await testUtils.flushPromises();

          // now it should have been called
          assert.calledOnce(requestScreenShareFloorStub);
        });
      });

      describe('#updateShare', () => {
        const mockLocalShare = {id: 'mock local share stream'};
        let eventListeners;
        let fakeMediaConnection;
        let requestScreenShareFloorStub;

        const FAKE_TRACKS = {
          screenshareVideo: {
            id: 'fake share track',
            getSettings: sinon.stub().returns({}),
            on: sinon.stub(),
          },
        };

        beforeEach(async () => {
          eventListeners = {};

          sinon.stub(MeetingUtil, 'getTrack').callsFake((stream) => {
            if (stream === mockLocalShare) {
              return {audioTrack: null, videoTrack: FAKE_TRACKS.screenshareVideo};
            }

            return {audioTrack: null, videoTrack: null};
          });

          meeting.webex.meetings.reachability = {
            isAnyClusterReachable: sinon.stub().resolves(true)
          };

          fakeMediaConnection = {
            close: sinon.stub(),
            getConnectionState: sinon.stub().returns(ConnectionState.Connected),
            initiateOffer: sinon.stub().resolves({}),

            // mock the on() method and store all the listeners
            on: sinon.stub().callsFake((event, listener) => {
              eventListeners[event] = listener;
            }),

            updateSendReceiveOptions: sinon.stub().callsFake(() => {
              // trigger ROAP_STARTED before updateSendReceiveOptions() resolves
              if (eventListeners[Event.ROAP_STARTED]) {
                eventListeners[Event.ROAP_STARTED]();
              } else {
                throw new Error('ROAP_STARTED listener not registered')
              }
              return Promise.resolve();
            }),
          };

          meeting.mediaProperties.waitForMediaConnectionConnected = sinon.stub().resolves();
          meeting.mediaProperties.getCurrentConnectionType = sinon.stub().resolves('udp');
          Media.createMediaConnection = sinon.stub().returns(fakeMediaConnection);

          requestScreenShareFloorStub = sinon.stub(meeting, 'requestScreenShareFloor').resolves({});

          meeting.meetingState = 'ACTIVE';
          await meeting.addMedia({
            mediaSettings: {},
          });
        });

        afterEach(() => {
          sinon.restore();
        });

        it('when starting share, it should request floor only after roap transaction is completed', async () => {
          let myPromiseResolved = false;

          meeting
            .updateShare({
              sendShare: true,
              receiveShare: true,
              stream: mockLocalShare,
            })
            .then(() => {
              myPromiseResolved = true;
            });

          await testUtils.flushPromises();

          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions);
          assert.isFalse(myPromiseResolved);

          // verify that requestScreenShareFloorStub was not called yet
          assert.notCalled(requestScreenShareFloorStub);

          eventListeners[Event.ROAP_DONE]();
          await testUtils.flushPromises();

          // now it should have been called
          assert.calledOnce(requestScreenShareFloorStub);
        });

        it('when changing screen share stream and no roap transaction happening, it requests floor immediately', async () => {
          let myPromiseResolved = false;

          // simulate a case when no roap transaction is triggered by updateSendReceiveOptions
          meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions = sinon.stub().resolves({});

          meeting
            .updateShare({
              sendShare: true,
              receiveShare: true,
              stream: mockLocalShare,
            })
            .then(() => {
              myPromiseResolved = true;
            });

          await testUtils.flushPromises();

          assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.updateSendReceiveOptions);
          assert.calledOnce(requestScreenShareFloorStub);
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
            meeting.getMediaStreams = sinon.stub().returns(Promise.resolve([]));
            meeting.updateVideo = sinon.stub().returns(Promise.resolve());
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

      describe('#setLocalVideoQuality', () => {
        let mediaDirection;

        const fakeTrack = {getSettings: () => ({height: 720})};
        const USER_AGENT_CHROME_MAC =
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36';

        beforeEach(() => {
          mediaDirection = {sendAudio: true, sendVideo: true, sendShare: false};
          meeting.getMediaStreams = sinon.stub().returns(Promise.resolve([]));
          meeting.mediaProperties.mediaDirection = mediaDirection;
          meeting.canUpdateMedia = sinon.stub().returns(true);
          MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve());
          meeting.updateVideo = sinon.stub().resolves();
          sinon.stub(MeetingUtil, 'getTrack').returns({videoTrack: fakeTrack});
        });

        it('should have #setLocalVideoQuality', () => {
          assert.exists(meeting.setLocalVideoQuality);
        });

        it('should call getMediaStreams with the proper level', () =>
          meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            delete mediaDirection.receiveVideo;
            assert.calledWith(
              meeting.getMediaStreams,
              mediaDirection,
              CONSTANTS.VIDEO_RESOLUTIONS[CONSTANTS.QUALITY_LEVELS.LOW]
            );
          }));

        it('when browser is chrome then it should stop previous video track', () => {
          meeting.mediaProperties.videoTrack = fakeTrack;
          assert.equal(BrowserDetection(USER_AGENT_CHROME_MAC).getBrowserName(), 'Chrome');
          meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.calledWith(Media.stopTracks, fakeTrack);
          });
        });

        it('should set mediaProperty with the proper level', () =>
          meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.equal(meeting.mediaProperties.localQualityLevel, CONSTANTS.QUALITY_LEVELS.LOW);
          }));

        it('when device does not support 1080p then it should set localQualityLevel with highest possible resolution', () => {
          meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS['1080p']).then(() => {
            assert.equal(
              meeting.mediaProperties.localQualityLevel,
              CONSTANTS.QUALITY_LEVELS['720p']
            );
          });
        });

        it('should error if set to a invalid level', () => {
          assert.isRejected(meeting.setLocalVideoQuality('invalid'));
        });

        it('should error if sendVideo is set to false', () => {
          meeting.mediaProperties.mediaDirection = {sendVideo: false};
          assert.isRejected(meeting.setLocalVideoQuality('LOW'));
        });
      });

      describe('#setRemoteQualityLevel', () => {
        let mediaDirection;

        beforeEach(() => {
          mediaDirection = {receiveAudio: true, receiveVideo: true, receiveShare: false};
          meeting.updateMedia = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.mediaDirection = mediaDirection;
        });

        it('should have #setRemoteQualityLevel', () => {
          assert.exists(meeting.setRemoteQualityLevel);
        });

        it('should set mediaProperty with the proper level', () =>
          meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.equal(meeting.mediaProperties.remoteQualityLevel, CONSTANTS.QUALITY_LEVELS.LOW);
          }));

        it('should call updateMedia', () =>
          meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.calledOnce(meeting.updateMedia);
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
          meeting.locusInfo.onFullLocus = sinon.stub().returns(Promise.resolve());
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
          assert.calledWith(meeting.locusInfo.onFullLocus, 'testData');
          assert.notCalled(meeting.meetingRequest.dialOut);

          meeting.meetingRequest.dialIn.resetHistory();
          meeting.locusInfo.onFullLocus.resetHistory();

          // try again. the dial in urls should match
          await meeting.usePhoneAudio();

          assert.calledWith(meeting.meetingRequest.dialIn, {
            correlationId: meeting.correlationId,
            dialInUrl: DIAL_IN_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
          });
          assert.calledWith(meeting.locusInfo.onFullLocus, 'testData');
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
          assert.calledWith(meeting.locusInfo.onFullLocus, 'testData');
          assert.notCalled(meeting.meetingRequest.dialIn);

          meeting.meetingRequest.dialOut.resetHistory();
          meeting.locusInfo.onFullLocus.resetHistory();

          // try again. the dial out urls should match
          await meeting.usePhoneAudio(phoneNumber);

          assert.calledWith(meeting.meetingRequest.dialOut, {
            correlationId: meeting.correlationId,
            dialOutUrl: DIAL_OUT_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl,
            phoneNumber,
          });
          assert.calledWith(meeting.locusInfo.onFullLocus, 'testData');
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
        const FAKE_MEETING_INFO = {
          conversationUrl: 'some_convo_url',
          locusUrl: 'some_locus_url',
          sipUrl: 'some_sip_url', // or sipMeetingUri
          meetingNumber: '123456', // this.config.experimental.enableUnifiedMeetings
          hostId: 'some_host_id', // this.owner;
        };
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

        it('calls meetingInfoProvider with all the right parameters and parses the result', async () => {
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO}),
          };
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.parseMeetingInfo = sinon.stub().returns(undefined);

          await meeting.fetchMeetingInfo({
            password: FAKE_PASSWORD,
            captchaCode: FAKE_CAPTCHA_CODE,
          });

          assert.calledWith(
            meeting.attrs.meetingInfoProvider.fetchMeetingInfo,
            FAKE_DESTINATION,
            FAKE_TYPE,
            FAKE_PASSWORD,
            {code: FAKE_CAPTCHA_CODE, id: FAKE_CAPTCHA_ID}
          );

          assert.calledWith(meeting.parseMeetingInfo, {body: FAKE_MEETING_INFO}, FAKE_DESTINATION);
          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
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
            fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO}),
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
            null
          );

          // parseMeeting info
          assert.calledWith(meeting.parseMeetingInfo, {body: FAKE_MEETING_INFO}, FAKE_DESTINATION);

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
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
            fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO}),
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
            fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO}),
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
            null
          );

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
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
            null
          );

          assert.deepEqual(meeting.meetingInfo, {});
          assert.equal(
            meeting.meetingInfoFailureReason,
            MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD
          );
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
            {code: 'bbb', id: FAKE_CAPTCHA_ID}
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
            null
          );

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
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
            {code: 'bbb', id: FAKE_CAPTCHA_ID}
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
          meeting.closeLocalStream = sinon.stub().returns(Promise.resolve());
          meeting.closeLocalShare = sinon.stub().returns(Promise.resolve());
          meeting.closeRemoteStream = sinon.stub().returns(Promise.resolve());
          sandbox.stub(meeting, 'closeRemoteTracks').returns(Promise.resolve());
          meeting.closePeerConnections = sinon.stub().returns(Promise.resolve());
          meeting.unsetLocalVideoTrack = sinon.stub().returns(true);
          meeting.unsetLocalShareTrack = sinon.stub().returns(true);
          meeting.unsetRemoteTracks = sinon.stub();
          meeting.statsAnalyzer = {stopAnalyzer: sinon.stub().resolves()};
          meeting.unsetRemoteStream = sinon.stub().returns(true);
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
          assert.calledOnce(meeting?.closeLocalStream);
          assert.calledOnce(meeting?.closeLocalShare);
          assert.calledOnce(meeting?.closeRemoteTracks);
          assert.calledOnce(meeting?.closePeerConnections);
          assert.calledOnce(meeting?.unsetLocalVideoTrack);
          assert.calledOnce(meeting?.unsetLocalShareTrack);
          assert.calledOnce(meeting?.unsetRemoteTracks);
          assert.calledOnce(meeting?.unsetPeerConnections);
        });
      });

      describe('#moveTo', () => {
        let sandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          sandbox.stub(meeting, 'closeLocalStream');
          sandbox.stub(meeting, 'closeLocalShare');

          sandbox.stub(meeting.mediaProperties, 'setMediaDirection');
          sandbox.stub(meeting.mediaProperties, 'unsetMediaTracks');

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

        it('should postEvent on moveTo ', async () => {
          await meeting.moveTo('resourceId');
          assert.calledWithMatch(Metrics.postEvent, {
            event: eventType.MEDIA_CAPABILITIES,
            data: {
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
          });
          assert.calledWithMatch(Metrics.postEvent, {event: eventType.MOVE_MEDIA});
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

          assert.called(meeting.closeLocalStream);
          assert.called(meeting.closeLocalShare);

          // give queued Promise callbacks a chance to run
          await Promise.resolve();

          assert.called(meeting.mediaProperties.setMediaDirection);
          assert.called(meeting.mediaProperties.unsetMediaTracks);

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

        it('should postEvent on moveFrom ', async () => {
          await meeting.moveFrom('resourceId');

          assert.calledWithMatch(Metrics.postEvent, {event: eventType.MOVE_MEDIA});
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
          };
          videoTrack = {
            id: 'video track',
            getSettings: sinon.stub().returns({}),
          };
          videoShareTrack = {
            id: 'share track',
            on: sinon.stub(),
            removeEventListener: sinon.stub(),
            getSettings: sinon.stub().returns({}),
          };
          meeting.requestScreenShareFloor = sinon.stub().resolves({});
          meeting.releaseScreenShareFloor = sinon.stub().resolves({});
          meeting.mediaProperties.mediaDirection = {sendAudio: false, sendVideo: false, sendShare: false};
          meeting.mediaProperties.webrtcMediaConnection = {
            publishTrack: sinon.stub().resolves({}),
            unpublishTrack: sinon.stub().resolves({}),
          };

          const createFakeLocalTrack = (originalTrack) => ({
            on: sinon.stub(),
            off: sinon.stub(),
            stop: sinon.stub(),
            originalTrack
          });

          // setup mock constructors for webrtc-core local track classes in such a way
          // that they return the original track correctly (this is needed for unpublish() API tests)
          LocalDisplayTrackConstructorStub = sinon.stub(InternalMediaCoreModule, 'LocalDisplayTrack').callsFake((stream) => {
            fakeLocalDisplayTrack = createFakeLocalTrack(stream.getTracks()[0])
            return fakeLocalDisplayTrack;
          });
          LocalMicrophoneTrackConstructorStub = sinon.stub(InternalMediaCoreModule, 'LocalMicrophoneTrack').callsFake((stream) => {
            fakeLocalMicrophoneTrack = createFakeLocalTrack(stream.getTracks()[0])
            return fakeLocalMicrophoneTrack;
          });
          LocalCameraTrackConstructorStub = sinon.stub(InternalMediaCoreModule, 'LocalCameraTrack').callsFake((stream) => {
            fakeLocalCameraTrack = createFakeLocalTrack(stream.getTracks()[0])
            return fakeLocalCameraTrack;
          });

          createMuteStateStub = sinon.stub(MuteStateModule, 'createMuteState').returns({id: 'fake mute state instance'});
        })
        describe('#publishTracks', () => {
          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(meeting.publishTracks({audio: {id: 'some audio track'}}));
          });

          const checkAudioPublished = () => {
            assert.calledWith(MediaUtil.createMediaStream, [audioTrack]);
            assert.calledOnce(LocalMicrophoneTrackConstructorStub);

            assert.calledWith(createMuteStateStub, 'audio', meeting, meeting.mediaProperties.mediaDirection);
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, fakeLocalMicrophoneTrack);
            assert.equal(meeting.mediaProperties.audioTrack, fakeLocalMicrophoneTrack);
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, true);
          }

          const checkVideoPublished = () => {
            assert.calledWith(MediaUtil.createMediaStream, [videoTrack]);
            assert.calledOnce(LocalCameraTrackConstructorStub);

            assert.calledWith(createMuteStateStub, 'video', meeting, meeting.mediaProperties.mediaDirection);
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, fakeLocalCameraTrack);
            assert.equal(meeting.mediaProperties.videoTrack, fakeLocalCameraTrack);
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, true);
          }

          const checkScreenShareVideoPublished = () => {
            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.calledWith(MediaUtil.createMediaStream, [videoShareTrack]);
            assert.calledOnce(LocalDisplayTrackConstructorStub);

            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.publishTrack, fakeLocalDisplayTrack);
            assert.equal(meeting.mediaProperties.shareTrack, fakeLocalDisplayTrack);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, true);
          }

          it('requests screen share floor and publishes the screen share video track', async () => {
            await meeting.publishTracks({screenShare: {video: videoShareTrack}});

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkScreenShareVideoPublished();
          });

          it('creates MuteState instance and publishes the track for main audio', async () => {
            await meeting.publishTracks({microphone: audioTrack});

            assert.calledOnce(createMuteStateStub);
            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkAudioPublished();
          });

          it('creates MuteState instance and publishes the track for main video', async () => {
            await meeting.publishTracks({camera: videoTrack});

            assert.calledOnce(createMuteStateStub);
            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkVideoPublished();
          });

          it('publishes audio, video and screen share together', async () => {
            await meeting.publishTracks({
              microphone: audioTrack,
              camera: videoTrack,
              screenShare: {
                video: videoShareTrack,
              }
            });

            assert.calledTwice(createMuteStateStub);
            assert.calledThrice(meeting.mediaProperties.webrtcMediaConnection.publishTrack);
            checkAudioPublished();
            checkVideoPublished();
            checkScreenShareVideoPublished();
          })
        });

        describe('unpublishTracks', () => {
          beforeEach(async () => {
            await meeting.publishTracks({
              microphone: audioTrack,
              camera: videoTrack,
              screenShare: {video: videoShareTrack}
            });
          });

          const checkAudioUnpublished = () => {
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack, fakeLocalMicrophoneTrack);

            assert.equal(meeting.mediaProperties.audioTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendAudio, false);
          };

          const checkVideoUnpublished = () => {
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack, fakeLocalCameraTrack);

            assert.equal(meeting.mediaProperties.videoTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendVideo, false);
          }

          const checkScreenShareVideoUnpublished = () => {
            assert.calledWith(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack, fakeLocalDisplayTrack);

            assert.calledOnce(meeting.requestScreenShareFloor);

            assert.equal(meeting.mediaProperties.shareTrack, null);
            assert.equal(meeting.mediaProperties.mediaDirection.sendShare, false);
          }

          it('fails if there is no media connection', async () => {
            meeting.mediaProperties.webrtcMediaConnection = undefined;
            await assert.isRejected(meeting.unpublishTracks([audioTrack, videoTrack, videoShareTrack]));
          });

          it('un-publishes the tracks correctly (all 3 together)', async () => {
            await meeting.unpublishTracks([audioTrack, videoTrack, videoShareTrack]);

            assert.calledThrice(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkAudioUnpublished();
            checkVideoUnpublished();
            checkScreenShareVideoUnpublished();
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
          })

          it('un-publishes the screen share video track correctly', async () => {
            await meeting.unpublishTracks([videoShareTrack]);

            assert.calledOnce(meeting.mediaProperties.webrtcMediaConnection.unpublishTrack);
            checkScreenShareVideoUnpublished();
          })
        })
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
        sandbox.stub(meeting.mediaProperties, 'shareTrack').value(fakeMediaTrack());
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
      describe('#closeLocalShare', () => {
        it('should stop the stream, and trigger a media:stopped event when the local share stream stops', async () => {
          await meeting.closeLocalShare();
          assert.calledTwice(TriggerProxy.trigger);

          assert.equal(TriggerProxy.trigger.getCall(1).args[2], 'media:stopped');
          assert.deepEqual(TriggerProxy.trigger.getCall(1).args[3], {type: 'localShare'});
        });
      });
      describe('#closeLocalStream', () => {
        it('should stop the stream, and trigger a media:stopped event when the local stream stops', async () => {
          await meeting.closeLocalStream();
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'closeLocalStream'},
            'media:stopped',
            {type: 'local'}
          );
        });
      });
      describe('#setLocalTracks', () => {
        it('stores the current video device as the preferred video device', () => {
          const videoDevice = 'video1';
          const fakeTrack = {getSettings: () => ({deviceId: videoDevice})};
          const fakeStream = 'stream1';

          sandbox.stub(MeetingUtil, 'getTrack').returns({audioTrack: null, videoTrack: fakeTrack});
          sandbox.stub(meeting.mediaProperties, 'setMediaSettings');
          sandbox.stub(meeting.mediaProperties, 'setVideoDeviceId');

          meeting.setLocalTracks(fakeStream);

          assert.calledWith(meeting.mediaProperties.setVideoDeviceId, videoDevice);
        });
      });
      describe('#setLocalShareTrack', () => {
        it('should trigger a media:ready event with local share stream', () => {
          const track = {
            getSettings: sinon.stub().returns({
              aspectRatio: '1.7',
              frameRate: 30,
              height: 1980,
              width: 1080,
              displaySurface: true,
              cursor: true,
            }),
          };

          const listeners = {};
          const fakeLocalDisplayTrack = {
            on: sinon.stub().callsFake((event, listener) => {
                listeners[event] = listener;
              })
          };
          sinon.stub(InternalMediaCoreModule, 'LocalDisplayTrack').returns(fakeLocalDisplayTrack);


          meeting.mediaProperties.setLocalShareTrack = sinon.stub().returns(true);
          meeting.stopShare = sinon.stub().resolves(true);
          meeting.mediaProperties.mediaDirection = {};
          meeting.setLocalShareTrack(track);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setLocalShareTrack'},
            'media:ready'
          );
          assert.calledOnce(meeting.mediaProperties.setLocalShareTrack);
          assert.equal(meeting.mediaProperties.localStream, undefined);
          assert.isNotNull(listeners[LocalTrackEvents.Ended]);
          listeners[LocalTrackEvents.Ended]();
          assert.calledOnce(meeting.stopShare);
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

        describe('should send correct metrics for ROAP_FAILURE event', () => {
          const fakeErrorMessage = 'test error';
          const fakeRootCauseName = 'root cause name';
          const fakeErrorName = 'test error name';

          beforeEach(() => {
            meeting.setupMediaConnectionListeners();
          });

          const checkMetricSent = (event) => {
            assert.calledOnce(Metrics.postEvent);
            assert.calledWithMatch(Metrics.postEvent, {
              event,
              meetingId: meeting.id,
              data: {canProceed: false},
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

            checkMetricSent(eventType.LOCAL_SDP_GENERATED);
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

            checkMetricSent(eventType.REMOTE_SDP_RECEIVED);
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

            checkMetricSent(eventType.REMOTE_SDP_RECEIVED);
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

            checkMetricSent(eventType.LOCAL_SDP_GENERATED);
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

            checkMetricSent(eventType.LOCAL_SDP_GENERATED);
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

            assert.calledOnce(Metrics.postEvent);
            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.REMOTE_SDP_RECEIVED,
              meetingId: meeting.id,
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

            assert.calledOnce(Metrics.postEvent);
            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.LOCAL_SDP_GENERATED,
              meetingId: meeting.id,
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

            assert.calledOnce(Metrics.postEvent);
            assert.calledWithMatch(Metrics.postEvent, {
              event: eventType.REMOTE_SDP_RECEIVED,
              meetingId: meeting.id,
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

          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'SELF_MEETING_BREAKOUTS_CHANGED', payload);

          assert.calledOnceWithExactly(meeting.breakouts.updateBreakoutSessions, payload);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setUpLocusInfoSelfListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
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
      });

      describe('#setupLocusControlsListener', () => {
        it('listens to the locus breakouts update event', () => {
          const locus = {
            breakout: 'breakout'
          };

          meeting.breakouts.updateBreakout = sinon.stub();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'CONTROLS_MEETING_BREAKOUT_UPDATED', locus);

          assert.calledOnceWithExactly(meeting.breakouts.updateBreakout, locus.breakout);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {file: 'meeting/index', function: 'setupLocusControlsListener'},
            EVENT_TRIGGERS.MEETING_BREAKOUTS_UPDATE
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

          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'LOCUS_INFO_UPDATE_URL', newLocusUrl);
          assert.calledWith(
            meeting.members.locusUrlUpdate,
            newLocusUrl
          );
          assert.calledOnceWithExactly(meeting.breakouts.locusUrlUpdate, newLocusUrl);
          assert.calledWith(meeting.members.locusUrlUpdate, newLocusUrl);
          assert.calledWith(meeting.recordingController.setLocusUrl, newLocusUrl);
          assert.calledWith(meeting.controlsOptionsManager.setLocusUrl, newLocusUrl);
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
                }
              },
          };

          meeting.recordingController = {setServiceUrl: sinon.stub().returns(undefined), setSessionId: sinon.stub().returns(undefined)};

          meeting.locusInfo.emit(
            {function: 'test', file: 'test'},
            'LINKS_SERVICES',
            newLocusServices
          );

          assert.calledWith(meeting.recordingController.setServiceUrl, newLocusServices.services.record.url);
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
      describe('#unsetRemoteTracks', () => {
        it('should unset the remote tracks and return null', () => {
          meeting.mediaProperties.unsetRemoteTracks = sinon.stub().returns(true);
          meeting.unsetRemoteTracks();
          assert.calledOnce(meeting.mediaProperties.unsetRemoteTracks);
        });
      });
      describe('#unsetLocalVideoTrack', () => {
        it('should unset the local stream and return null', () => {
          meeting.mediaProperties.unsetLocalVideoTrack = sinon.stub().returns(true);
          meeting.unsetLocalVideoTrack();
          assert.calledOnce(meeting.mediaProperties.unsetLocalVideoTrack);
        });
      });
      describe('#unsetLocalShareTrack', () => {
        it('should unset the local share stream and return null', () => {
          meeting.mediaProperties.unsetLocalShareTrack = sinon.stub().returns(true);
          meeting.unsetLocalShareTrack();
          assert.calledOnce(meeting.mediaProperties.unsetLocalShareTrack);
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
      });
      describe('#parseLocus', () => {
        describe('when CALL and participants', () => {
          beforeEach(() => {
            meeting.setLocus = sinon.stub().returns(true);
            MeetingUtil.getLocusPartner = sinon.stub().returns({person: {sipUrl: uuid3}});
          });
          it('should parse the locus object and set meeting properties and return null', () => {
            meeting.type = 'CALL';
            meeting.parseLocus({url: url1, participants: [{id: uuid1}], self: {id: uuid2}});
            assert.calledOnce(meeting.setLocus);
            assert.calledWith(meeting.setLocus, {
              url: url1,
              participants: [{id: uuid1}],
              self: {id: uuid2},
            });
            assert.calledOnce(MeetingUtil.getLocusPartner);
            assert.calledWith(MeetingUtil.getLocusPartner, [{id: uuid1}], {id: uuid2});
            assert.deepEqual(meeting.partner, {person: {sipUrl: uuid3}});
            assert.equal(meeting.sipUri, uuid3);
          });
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
        let canEnableReactionsSpy;
        let canSendReactionsSpy;

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
          canEnableReactionsSpy = sinon.spy(MeetingUtil, 'canEnableReactions');
          canSendReactionsSpy = sinon.spy(MeetingUtil, 'canSendReactions');
        });

        afterEach(() => {
          locusInfoOnSpy.restore();
          inMeetingActionsSetSpy.restore();
          waitingForOthersToJoinSpy.restore();
        });

        it('registers the correct MEETING_INFO_UPDATED event', () => {
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
          assert.calledWith(canEnableReactionsSpy, null, payload.info.userDisplayHints);
          assert.calledWith(canSendReactionsSpy, null, payload.info.userDisplayHints);

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
        });

        it('does not connect if the call is not joined yet', async () => {
          meeting.joinedWith = {state: 'any other state'};
          webex.internal.llm.getLocusUrl.returns('a url');

          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.notCalled(webex.internal.llm.registerAndConnect);
          assert.notCalled(webex.internal.llm.disconnectLLM);
          assert.equal(result, undefined);
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
        });

        it('connects if not already connected', async () => {
          meeting.joinedWith = {state: 'JOINED'};
          meeting.locusInfo = {url: 'a url', info: {datachannelUrl: 'a datachannel url'}};

          const result = await meeting.updateLLMConnection();

          assert.notCalled(webex.internal.llm.disconnectLLM);
          assert.calledWith(webex.internal.llm.registerAndConnect, 'a url', 'a datachannel url');
          assert.equal(result, 'something');
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
        });
      });

      describe('#setLocus', () => {
        beforeEach(() => {
          meeting.locusInfo.initialSetup = sinon.stub().returns(true);
        });
        it('should read the locus object, set on the meeting and return null', () => {
          meeting.parseLocus({
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
        describe('setUpLocusMediaSharesListener', () => {
          beforeEach(() => {
            meeting.selfId = '9528d952-e4de-46cf-8157-fd4823b98377';
            sinon.stub(meeting, 'updateShare').returns(Promise.resolve());
          });

          afterEach(() => {
            meeting.updateShare.restore();
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

          const generateContent = (beneficiaryId = null, disposition = null) => ({
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
            otherBeneficiaryId
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
                newPayload.current.content = generateContent(beneficiaryId, FLOOR_ACTION.GRANTED);

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
                      eventPayload: {memberId: beneficiaryId},
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
    });
  });
});
