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
} from '@webex/plugin-meetings/src/constants';

import * as StatsAnalyzerModule from '@webex/plugin-meetings/src/statsAnalyzer';
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
import PeerConnectionManager from '@webex/plugin-meetings/src/peer-connection-manager';
import ReconnectionManager from '@webex/plugin-meetings/src/reconnection-manager';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';
import TriggerProxy from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import BrowserDetection from '@webex/plugin-meetings/src/common/browser-detection';
import Metrics from '@webex/plugin-meetings/src/metrics';
import {eventType} from '@webex/plugin-meetings/src/metrics/config';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';

import locus from '../fixture/locus';
import {
  UserNotJoinedError,
  MeetingNotActiveError,
  UserInLobbyError,
  NoMediaEstablishedYetError
} from '../../../../src/common/errors/webex-errors';
import WebExMeetingsErrors from '../../../../src/common/errors/webex-meetings-error';
import ParameterError from '../../../../src/common/errors/parameter';
import PasswordError from '../../../../src/common/errors/password-error';
import CaptchaError from '../../../../src/common/errors/captcha-error';
import IntentToJoinError from '../../../../src/common/errors/intent-to-join';
import DefaultSDKConfig from '../../../../src/config';
import testUtils from '../../../utils/testUtils';
import {MeetingInfoV2CaptchaError, MeetingInfoV2PasswordError} from '../../../../src/meeting-info/meeting-info-v2';

const {
  getBrowserName
} = BrowserDetection();

// Non-stubbed function
const {getDisplayMedia} = Media;

describe('plugin-meetings', () => {
  const logger = {
    info: () => {},
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {}
  };

  beforeEach(() => {
    sinon.stub(Metrics, 'sendBehavioralMetric');
  });
  afterEach(() => {
    sinon.restore();
  });

  before(() => {
    const MediaStream = {
      getVideoTracks: () => [{
        applyConstraints: () => { }
      }]
    };

    Object.defineProperty(global.window.navigator, 'mediaDevices', {
      writable: true,
      value: {
        getDisplayMedia: sinon.stub().returns(Promise.resolve(MediaStream)),
        enumerateDevices: sinon.stub().returns(Promise.resolve([
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
          }
        ])),
        getSupportedConstraints: sinon.stub().returns({
          sampleRate: true
        })
      },
    });

    Object.defineProperty(global.window, 'MediaStream', {
      writable: true,
      value: MediaStream
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
        support: Support
      },
      config: {
        credentials: {
          client_id: 'mock-client-id'
        },
        meetings: {
          reconnection: {
            enabled: false
          },
          mediaSettings: {},
          metrics: {},
          stats: {},
          experimental: {enableUnifiedMeetings: true}
        },
        metrics: {
          type: ['behavioral']
        }
      }
    });

    webex.internal.support.submitLogs = sinon.stub().returns(Promise.resolve());
    webex.credentials.getOrgId = sinon.stub().returns('fake-org-id');
    webex.internal.metrics.submitClientMetrics = sinon.stub().returns(Promise.resolve());
    webex.meetings.uploadLogs = sinon.stub().returns(Promise.resolve());


    TriggerProxy.trigger = sinon.stub().returns(true);
    Metrics.postEvent = sinon.stub();
    Metrics.initialSetup(null, webex);
    MediaUtil.createPeerConnection = sinon.stub().returns({});
    MediaUtil.createMediaStream = sinon.stub().returns(true);

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
        parent: webex
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
          assert.equal(meeting.roapSeq, -1);
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
            sampleRate: 48000
          })
        });

        beforeEach(() => {
          meeting.getMediaStreams = sinon.stub().returns(Promise.resolve());
          sinon.replace(meeting, 'addMedia', () => {
            sinon.stub(meeting.mediaProperties, 'audioTrack').value(fakeMediaTrack());
            sinon.stub(meeting.mediaProperties, 'mediaDirection').value({
              receiveAudio: true
            });
          });
        });
        describe('#enableBNR', () => {
          it('should have #enableBnr', () => {
            assert.exists(meeting.enableBNR);
          });

          describe('before audio attached to meeting', () => {
            it('should throw no audio error', async () => {
              await meeting.enableBNR().catch((err) => {
                assert.equal(err.toString(), 'Error: Meeting doesn\'t have an audioTrack attached');
              });
            });
          });

          describe('after audio attached to meeting', () => {
            let handleClientRequest;

            beforeEach(async () => {
              await meeting.getMediaStreams();
              await meeting.addMedia();
            });

            it('should throw error if meeting audio is muted', async () => {
              const handleClientRequest = (meeting, mute) => {
                meeting.mediaProperties.audioTrack.enabled = !mute;

                return Promise.resolve();
              };
              const isMuted = () => !meeting.mediaProperties.audioTrack.enabled;

              meeting.locusInfo.parsedLocus = {self: {state: 'JOINED'}};
              meeting.mediaId = 'mediaId';
              meeting.audio = {handleClientRequest, isMuted};
              await meeting.muteAudio();
              await meeting.enableBNR().catch((err) => {
                assert.equal(err.message, 'Cannot enable BNR while meeting is muted');
              });
            });

            it('should return true on enable bnr success', async () => {
              handleClientRequest = sinon.stub().returns(Promise.resolve(true));
              meeting.effects = {handleClientRequest};
              const response = await meeting.enableBNR();

              assert.equal(response, true);
            });
          });
        });

        describe('#disableBNR', () => {
          describe('before audio attached to meeting', () => {
            it('should have #disableBnr', () => {
              assert.exists(meeting.disableBNR);
            });

            it('should throw no audio error', async () => {
              await meeting.disableBNR().catch((err) => {
                assert.equal(err.toString(), 'Error: Meeting doesn\'t have an audioTrack attached');
              });
            });
          });
          describe('after audio attached to meeting', () => {
            beforeEach(async () => {
              await meeting.getMediaStreams();
              await meeting.addMedia();
            });

            let handleClientRequest;
            let isBnrEnabled;

            it('should return true on disable bnr success', async () => {
              handleClientRequest = sinon.stub().returns(Promise.resolve(true));
              isBnrEnabled = sinon.stub().returns(Promise.resolve(true));
              meeting.effects = {handleClientRequest, isBnrEnabled};
              const response = await meeting.disableBNR();

              assert.equal(response, true);
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
          sinon.stub(Media, 'getSupportedDevice').callsFake((options) => Promise.resolve({sendAudio: options.sendAudio, sendVideo: options.sendVideo}));
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

          await meeting.getMediaStreams(mediaDirection, audioVideoSettings);

          assert.calledWith(Media.getUserMedia, {
            ...mediaDirection,
            isSharing: false
          },
          {
            video: {
              deviceId: videoDevice
            }
          });
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

        it('should throw error', async () => {
          meeting.request = sinon.stub().returns(Promise.reject());

          try {
            await meeting.receiveTranscription();
          }
          catch (err) {
            assert(err, {});
          }
        });
      });
      describe('#stopReceivingTranscription', () => {
        it('should get invoked', () => {
          meeting.transcription = {
            closeSocket: sinon.stub()
          };

          meeting.stopReceivingTranscription();
          assert.calledOnce(meeting.transcription.closeSocket);
        });
      });
      describe('#join', () => {
        let sandbox = null;

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
        });
        describe('successful', () => {
          beforeEach(() => {
            sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve());
          });

          it('should join the meeting and return promise', async () => {
            const join = meeting.join();

            assert.exists(join.then);
            await join;
            assert.calledOnce(MeetingUtil.joinMeeting);
            assert.calledOnce(meeting.setLocus);
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
              }
              catch (e) {
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
          applyClientStateLocally: sinon.stub().returns(Promise.resolve(true))
        };

        beforeEach(() => {
          meeting.mediaProperties.setMediaDirection = sinon.stub().returns(true);
          meeting.audio = muteStateStub;
          meeting.video = muteStateStub;
          Media.attachMedia = sinon.stub().returns(Promise.resolve([test1, test2]));
          meeting.setMercuryListener = sinon.stub().returns(true);
          meeting.setRemoteStream = sinon.stub().returns(true);
          meeting.setMercuryListener = sinon.stub();
          meeting.roap.sendRoapMediaRequest = sinon.stub().returns(new Promise((resolve) => {
            meeting.mediaProperties.peerConnection.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
            resolve();
          }));
          meeting.roap.doTurnDiscovery = sinon.stub().resolves();
          PeerConnectionManager.setContentSlides = sinon.stub().returns(true);
        });

        it('should have #addMedia', () => {
          assert.exists(meeting.addMedia);
        });

        it('should reject promise if meeting is not active', async () => {
          await meeting.addMedia().catch((err) => {
            assert.instanceOf(err, MeetingNotActiveError);
          });
        });

        it('should reject promise if user already in left state', async () => {
          meeting.meetingState = 'ACTIVE';
          await meeting.addMedia().catch((err) => {
            assert.instanceOf(err, UserNotJoinedError);
          });
        });

        it('should reject promise if user is in lobby ', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.locusInfo.parsedLocus = {self: {state: 'IDLE'}};
          meeting.isUserUnadmitted = true;

          try {
            await meeting.addMedia();
            assert.fail('addMedia should have thrown an exception.');
          }
          catch (err) {
            assert.instanceOf(err, UserInLobbyError);
          }
        });

        it('should reset the statsAnalyzer to null if addMedia throws an error', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.statsAnalyzer = true;
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
            assert.isNull(meeting.statsAnalyzer);
          });
        });

        it('should reset the peerConnection to null if addMedia throws an error', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.peerConnection = true;
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
            assert.isNull(meeting.mediaProperties.peerConnection);
          });
        });

        it('should work the second time addMedia is called in case the first time fails', async () => {
          meeting.meetingState = 'ACTIVE';

          try {
            await meeting.addMedia();
            assert.fail('addMedia should have thrown an exception.');
          }
          catch (err) {
            assert.exists(err);
          }

          try {
            await meeting.addMedia({
              mediaSettings: {}
            });
          }
          catch (err) {
            assert.fail('should not throw an error');
          }
        });

        it('if an error occurs after media request has already been sent, and the user waits until the server kicks them out, a UserNotJoinedError should be thrown when attempting to addMedia again', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.roap.sendRoapMediaRequest = sinon.stub().returns(new Promise((resolve) => {
            meeting.mediaProperties.peerConnection.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
            resolve();
          }).then(() => {
            throw new Error('sample error thrown');
          }));
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
          meeting.roap.sendRoapMediaRequest = sinon.stub().returns(new Promise((resolve) => {
            meeting.mediaProperties.peerConnection.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
            resolve();
          }).then(() => {
            throw new Error('sample error thrown');
          }));
          await meeting.addMedia().catch((err) => {
            assert.exists(err);
          });

          meeting.mediaProperties.peerConnection = {};
          meeting.roap.sendRoapMediaRequest = sinon.stub().returns(new Promise((resolve) => {
            meeting.mediaProperties.peerConnection.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
            resolve();
          }));
          await meeting.addMedia().catch((err) => {
            assert.fail('No error should appear: ', err);
          });
        });

        it('should attach the media and return promise', async () => {
          meeting.meetingState = 'ACTIVE';
          MediaUtil.createPeerConnection.resetHistory();
          const media = meeting.addMedia({
            mediaSettings: {}
          });

          assert.exists(media);
          await media;
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(meeting.mediaProperties.setMediaDirection);
          assert.calledOnce(Media.attachMedia);
          assert.calledOnce(meeting.setMercuryListener);
          assert.calledOnce(meeting.setRemoteStream);
          assert.calledOnce(meeting.roap.sendRoapMediaRequest);
          assert.calledOnce(MediaUtil.createPeerConnection);
          assert.calledWith(MediaUtil.createPeerConnection, undefined);
          /* statsAnalyzer is initiated inside of addMedia so there isn't
          * a good way to mock it without mocking the constructor
          */
        });

        it('should pass the turn server info to the peer connection', async () => {
          const FAKE_TURN_URL = 'turns:webex.com:3478';
          const FAKE_TURN_USER = 'some-turn-username';
          const FAKE_TURN_PASSWORD = 'some-password';

          meeting.meetingState = 'ACTIVE';
          MediaUtil.createPeerConnection.resetHistory();

          meeting.roap.doTurnDiscovery = sinon.stub().resolves({
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USER,
            password: FAKE_TURN_PASSWORD
          });
          const media = meeting.addMedia({
            mediaSettings: {}
          });

          assert.exists(media);
          await media;
          assert.calledOnce(meeting.roap.doTurnDiscovery);
          assert.calledWith(meeting.roap.doTurnDiscovery, meeting, false);
          assert.calledOnce(MediaUtil.createPeerConnection);
          assert.calledWith(MediaUtil.createPeerConnection, {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USER,
            password: FAKE_TURN_PASSWORD
          });
        });

        it('should attach the media and return promise', async () => {
          meeting.meetingState = 'ACTIVE';
          meeting.mediaProperties.peerConnection.connectionState = 'DISCONNECTED';
          const media = meeting.addMedia({
            mediaSettings: {}
          });

          assert.exists(media);
          await media.catch((err) => {
            assert.instanceOf(err, WebExMeetingsErrors);
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
              mediaSettings: {}
            });
          });

          afterEach(() => {
            meeting.config.stats.enableStatsAnalyzer = prevConfigValue;
          });

          it('LOCAL_MEDIA_STARTED triggers "meeting:media:local:start" event and sends metrics', async () => {
            statsAnalyzerStub.emit({file: 'test', function: 'test'}, StatsAnalyzerModule.EVENTS.LOCAL_MEDIA_STARTED, {type: 'audio'});

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'addMedia'
              },
              EVENT_TRIGGERS.MEETING_MEDIA_LOCAL_STARTED,
              {
                type: 'audio'
              }
            );
            assert.calledWithMatch(Metrics.postEvent, {event: eventType.SENDING_MEDIA_START, data: {mediaType: 'audio'}});
          });

          it('LOCAL_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit({file: 'test', function: 'test'}, StatsAnalyzerModule.EVENTS.LOCAL_MEDIA_STOPPED, {type: 'video'});

            assert.calledWithMatch(Metrics.postEvent, {event: eventType.SENDING_MEDIA_STOP, data: {mediaType: 'video'}});
          });

          it('REMOTE_MEDIA_STARTED triggers "meeting:media:remote:start" event and sends metrics', async () => {
            statsAnalyzerStub.emit({file: 'test', function: 'test'}, StatsAnalyzerModule.EVENTS.REMOTE_MEDIA_STARTED, {type: 'video'});

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'addMedia'
              },
              EVENT_TRIGGERS.MEETING_MEDIA_REMOTE_STARTED,
              {
                type: 'video'
              }
            );
            assert.calledWithMatch(Metrics.postEvent, {event: eventType.RECEIVING_MEDIA_START, data: {mediaType: 'video'}});
          });

          it('REMOTE_MEDIA_STOPPED triggers the right metrics', async () => {
            statsAnalyzerStub.emit({file: 'test', function: 'test'}, StatsAnalyzerModule.EVENTS.REMOTE_MEDIA_STOPPED, {type: 'audio'});

            assert.calledWithMatch(Metrics.postEvent, {event: eventType.RECEIVING_MEDIA_STOP, data: {mediaType: 'audio'}});
          });

          it('MEDIA_QUALITY triggers the right metrics', async () => {
            const fakeData = {intervalMetadata: {bla: 'bla'}};

            statsAnalyzerStub.emit(
              {file: 'test', function: 'test'},
              StatsAnalyzerModule.EVENTS.MEDIA_QUALITY,
              {data: fakeData, networkType: 'wifi'}
            );

            assert.calledWithMatch(Metrics.postEvent, {event: eventType.MEDIA_QUALITY, data: {intervalData: fakeData, networkType: 'wifi'}});
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
          meeting.meetingRequest.leaveMeeting = sinon.stub().returns(Promise.resolve({body: 'test'}));
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
          meeting.roap.stop = sinon.stub().returns(Promise.resolve());
          meeting.logger.error = sinon.stub().returns(true);

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
          assert.calledOnce(meeting.roap.stop);
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
            deviceUrl: meeting.deviceUrl
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
            deviceUrl: meeting.deviceUrl
          });
        });
      });
      describe('#share', () => {
        it('should have #share', () => {
          assert.exists(meeting.share);
        });
        beforeEach(() => {
          meeting.locusInfo.mediaShares = [{name: 'content', url: url1}];
          meeting.locusInfo.self = {url: url1};
          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
        });
        it('should send the share', async () => {
          const share = meeting.share();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
        });
      });

      describe('#shareScreen', () => {
        let _mediaDirection;

        beforeEach(() => {
          _mediaDirection = meeting.mediaProperties.mediaDirection || {};
          sinon.stub(meeting.mediaProperties, 'mediaDirection').value({sendAudio: true, sendVideo: true, sendShare: false});
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

            assert.calledWith(Media.getDisplayMedia, {sendShare: true, sendAudio: false, sharePreferences: {highFrameRate: true}});
          });
        });

        describe('getter: isLocalShareLive', () => {
          const LIVE = 'live';
          const ENDED = 'ended';
          const SENDRECV = 'sendrecv';
          const RECVONLY = 'reconly';
          let sandbox;
          let _direction;
          let _trackReadyState = ENDED;

          beforeEach(() => {
            sandbox = sinon.createSandbox();
            sandbox.stub(meeting.mediaProperties, 'shareTrack').value(true);
            sandbox.stub(meeting.mediaProperties, 'peerConnection').value({
              shareTransceiver: {
                get direction() {
                  return _direction;
                },
                sender: {
                  track: {
                    get readyState() {
                      return _trackReadyState;
                    }
                  }
                }
              }
            });
          });

          afterEach(() => {
            sandbox.restore();
            sandbox = null;
          });

          it('sets isLocalShareLive to true when sharing screen', () => {
            _direction = SENDRECV;
            _trackReadyState = LIVE;

            assert.isTrue(meeting.isLocalShareLive);
          });

          it('sets isLocalShareLive to false when not sharing screen', () => {
            _direction = RECVONLY;
            _trackReadyState = ENDED;

            assert.isFalse(meeting.isLocalShareLive);
          });

          it('sets isLocalShareLive to false when track is live but share direction is recv only', () => {
            _direction = RECVONLY;
            _trackReadyState = LIVE;

            assert.isFalse(meeting.isLocalShareLive);
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

            sandbox.stub(meeting.mediaProperties, 'peerConnection').value({shareTransceiver: true});
            sandbox.stub(MeetingUtil, 'getTrack').returns({videoTrack: true});
            MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve(true));
            sandbox.stub(meeting, 'canUpdateMedia').returns(true);
            sandbox.stub(meeting, 'setLocalShareTrack');

            meeting.updateShare({
              sendShare,
              receiveShare,
              stream,
              skipSignalingCheck: true
            });

            assert.notCalled(meeting.canUpdateMedia);
          });


          it('skips canUpdateMedia() check on contentTracks.onended', () => {
            const {mediaProperties} = meeting;
            const fakeTrack = {
              getSettings: sinon.stub().returns({}),
              onended: sinon.stub()
            };

            sandbox.stub(mediaProperties, 'setLocalShareTrack');
            sandbox.stub(mediaProperties, 'shareTrack').value(fakeTrack);
            sandbox.stub(mediaProperties, 'setMediaSettings');
            sandbox.stub(meeting, 'stopShare').resolves(true);
            meeting.setLocalShareTrack(fakeTrack);

            fakeTrack.onended();

            assert.calledWith(meeting.stopShare, {skipSignalingCheck: true});
          });


          it('stopShare accepts and passes along optional parameters', () => {
            const args = {
              abc: 123,
              receiveShare: false,
              sendShare: false
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

          it('calls handleShareTrackEnded if sharing is out of sync', async () => {
            const sendShare = true;
            const receiveShare = false;
            const stream = 'stream';
            const SENDRECV = 'sendrecv';
            const delay = 1e3;

            MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve(true));
            MeetingUtil.updateTransceiver = sinon.stub().returns(Promise.resolve(true));
            sandbox.stub(meeting, 'canUpdateMedia').returns(true);
            sandbox.stub(MeetingUtil, 'getTrack').returns({videoTrack: null});
            sandbox.stub(meeting, 'setLocalShareTrack');
            sandbox.stub(meeting, 'unsetLocalShareTrack');
            sandbox.stub(meeting, 'checkForStopShare').returns(false);

            sandbox.stub(meeting, 'isLocalShareLive').value(false);
            sandbox.stub(meeting, 'handleShareTrackEnded');
            sandbox.stub(meeting.mediaProperties, 'peerConnection').value({
              shareTransceiver: {
                direction: SENDRECV
              }
            });
            sandbox.useFakeTimers();

            await meeting.updateShare({
              sendShare,
              receiveShare,
              stream,
              skipSignalingCheck: true
            });
            // simulate the setTimeout in code
            sandbox.clock.tick(delay);

            assert.calledOnce(meeting.handleShareTrackEnded);
          });

          it('handleShareTrackEnded triggers an event', () => {
            const stream = 'stream';
            const {EVENT_TYPES} = CONSTANTS;

            sandbox.stub(meeting, 'stopShare').resolves(true);

            meeting.handleShareTrackEnded(stream);

            assert.calledWith(
              TriggerProxy.trigger,
              sinon.match.instanceOf(Meeting),
              {
                file: 'meeting/index',
                function: 'handleShareTrackEnded'
              },
              EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
              {
                stream,
                type: EVENT_TYPES.LOCAL_SHARE
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
          sendAudio: false
        };
        const fireFoxOptions = {
          audio: false,
          video: {
            audio: shareOptions.sendAudio,
            video: shareOptions.sendShare
          }
        };

        const MediaStream = {
          getVideoTracks: () => [{
            applyConstraints: () => {}
          }]
        };

        const MediaConstraint = {
          cursor: 'always',
          aspectRatio: config.aspectRatio,
          frameRate: config.screenFrameRate,
          width: null,
          height: null
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
                getDisplayMedia: null
              }
            };
          }
          _getDisplayMedia = global.navigator.mediaDevices.getDisplayMedia;
          Object.defineProperty(
            global.navigator.mediaDevices,
            'getDisplayMedia',
            {
              value: sinon.stub().returns(Promise.resolve(MediaStream)),
              writable: true
            }
          );
        });

        after(() => {
          // clean up for browser
          Object.defineProperty(
            global.navigator.mediaDevices,
            'getDisplayMedia',
            {
              value: _getDisplayMedia,
              writable: true
            }
          );
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
            idealHeight: SHARE_HEIGHT
          };

          // If sharePreferences.shareConstraints is defined it ignores
          // default SDK config settings
          getDisplayMedia({
            ...shareOptions,
            sharePreferences: {shareConstraints}
          }, config);

          // eslint-disable-next-line no-undef
          assert.calledWith(navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {...shareConstraints}
              },
              // Firefox is being handled differently
              firefox: fireFoxOptions
            }));
        });

        // eslint-disable-next-line max-len
        it('will use default resolution if shareConstraints is undefined and highFrameRate is defined', () => {
          // If highFrameRate is defined it ignores default SDK config settings
          getDisplayMedia({
            ...shareOptions,
            sharePreferences: {
              highFrameRate: true
            }
          }, config);

          // eslint-disable-next-line no-undef
          assert.calledWith(navigator.mediaDevices.getDisplayMedia,
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
                  idealHeight: resolution.idealHeight
                }
              },
              firefox: fireFoxOptions
            }));
        });

        // eslint-disable-next-line max-len
        it('will use default screenResolution if shareConstraints, highFrameRate, and SDK defaults is undefined', () => {
          getDisplayMedia(shareOptions);
          const {screenResolution} = config;

          // eslint-disable-next-line no-undef
          assert.calledWith(navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  width: screenResolution.idealWidth,
                  height: screenResolution.idealHeight
                }
              },
              firefox: fireFoxOptions
            }));
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
              idealHeight: SHARE_HEIGHT
            }
          };

          getDisplayMedia(shareOptions, customConfig);

          // eslint-disable-next-line no-undef
          assert.calledWith(navigator.mediaDevices.getDisplayMedia,
            browserConditionalValue({
              default: {
                video: {
                  ...MediaConstraint,
                  width: SHARE_WIDTH,
                  height: SHARE_HEIGHT,
                  maxWidth: SHARE_WIDTH,
                  maxHeight: SHARE_HEIGHT,
                  idealWidth: SHARE_WIDTH,
                  idealHeight: SHARE_HEIGHT
                }
              },
              firefox: fireFoxOptions
            }));
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
              idealHeight: SHARE_HEIGHT
            }
          };

          getDisplayMedia(shareOptions, customConfig);

          // eslint-disable-next-line no-undef
          assert.calledWith(navigator.mediaDevices.getDisplayMedia,
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
                  idealHeight: SHARE_HEIGHT
                }
              },
              firefox: fireFoxOptions
            }));
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
        describe('when canUpdateMedia is true', () => {
          beforeEach(() => {
            meeting.canUpdateMedia = sinon.stub().returns(true);
          });
          describe('when options are valid', () => {
            beforeEach(() => {
              MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve());
            });
            describe('when mediaDirection is undefined', () => {
              beforeEach(() => {
                meeting.mediaProperties.mediaDirection = null;
                MeetingUtil.updateTransceiver = sinon.stub();
              });

              it('sets previousMediaDirection to an empty object', () => meeting.updateAudio({
                sendAudio: true,
                receiveAudio: true
              }).then(() => {
                assert.calledOnce(MeetingUtil.updateTransceiver);
              }));
            });
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
            url: url2
          };

          await meeting.sendDTMF(tones);

          assert.calledWith(meeting.meetingRequest.sendDTMF, {
            locusUrl: meeting.locusInfo.self.url,
            deviceUrl: meeting.deviceUrl,
            tones
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
              url: url2
            };

            assert.isRejected(meeting.sendDTMF('123'));
          });
        });
      });

      describe('#updateMedia', () => {
        let sandbox;
        const mockLocalStream = {id: 'mock local stream'};
        const mockLocalShare = {id: 'mock local share stream'};

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          meeting.mediaProperties.mediaDirection = {sendShare: true};
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
            isSharing: true
          };

          sandbox.stub(meeting, 'canUpdateMedia').returns(false);
          sandbox.stub(Media, 'updateMedia').resolves();

          let myPromiseResolved = false;

          meeting.updateMedia({
            localStream: mockLocalStream,
            localShare: mockLocalShare,
            mediaSettings
          })
            .then(() => {
              myPromiseResolved = true;
            });

          // verify that nothing was done
          assert.notCalled(Media.updateMedia);

          // now trigger processing of the queue
          meeting.canUpdateMedia.restore();
          sandbox.stub(meeting, 'canUpdateMedia').returns(true);
          meeting.updateMedia = sinon.stub().returns(Promise.resolve());

          meeting.processNextQueuedMediaUpdate();
          await testUtils.flushPromises();

          // and check that meeting.updateMedia is called with the original args
          assert.calledWith(meeting.updateMedia, {localStream: mockLocalStream, localShare: mockLocalShare, mediaSettings});
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
              receiveVideo: true
            };
            meeting.getMediaStreams = sinon.stub().returns(Promise.resolve([]));
            meeting.updateVideo = sinon.stub().returns(Promise.resolve());
            meeting.mediaProperties.mediaDirection = mediaDirection;
            meeting.mediaProperties.remoteVideoTrack = sinon.stub().returns({mockTrack: 'mockTrack'});

            meeting.meetingRequest.changeVideoLayoutDebounced = sinon.stub().returns(Promise.resolve());

            meeting.locusInfo.self = {
              url: url2
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
              content: undefined
            });
          });

          it('doesn\'t have layoutType which exists in the list of allowed layoutTypes should throw an error', async () => {
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
              content: undefined
            });
          });

          it('throws if trying to send renderInfo for content when not receiving content', async () => {
            assert.isRejected(meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1280, height: 720}}));
          });

          it('calls changeVideoLayoutDebounced with renderInfo for main and content', async () => {
            // first set only the main renderInfo
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 100, height: 200}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 100, height: 200},
              content: undefined
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
              content: {width: 500, height: 600}
            });

            // and now call with both
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 300, height: 400}, content: {width: 700, height: 800}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 300, height: 400},
              content: {width: 700, height: 800}
            });

            // and now set just the layoutType, the previous main and content values should be used
            const layoutType = 'Equal';

            await meeting.changeVideoLayout(layoutType);

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType,
              main: {width: 300, height: 400},
              content: {width: 700, height: 800}
            });
          });

          it('does not call changeVideoLayoutDebounced if renderInfo main changes only very slightly', async () => {
            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 1024, height: 768}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 1024, height: 768},
              content: undefined
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

            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 500, height: 510}, content: {width: 1024, height: 768}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 500, height: 510},
              content: {width: 1024, height: 768}
            });
            meeting.meetingRequest.changeVideoLayoutDebounced.resetHistory();

            // now send main with width/height different by just 2px - it should be ignored
            await meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1026, height: 768}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1022, height: 768}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1024, height: 770}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);

            await meeting.changeVideoLayout(layoutTypeSingle, {content: {width: 1024, height: 766}});
            assert.notCalled(meeting.meetingRequest.changeVideoLayoutDebounced);
          });

          it('rounds the width and height values to nearest integers', async () => {
            meeting.mediaProperties.mediaDirection.receiveShare = true;
            meeting.mediaProperties.remoteShare = sinon.stub().returns({mockTrack: 'mockTrack'});

            await meeting.changeVideoLayout(layoutTypeSingle, {main: {width: 500.5, height: 510.09}, content: {width: 1024.2, height: 768.85}});

            assert.calledWith(meeting.meetingRequest.changeVideoLayoutDebounced, {
              locusUrl: meeting.locusInfo.self.url,
              deviceUrl: meeting.deviceUrl,
              layoutType: layoutTypeSingle,
              main: {width: 501, height: 510},
              content: {width: 1024, height: 769}
            });
          });
        });

        it('should throw error when there is no remote stream', () => {
          const layoutType = 'Equal';

          const mediaDirection = {
            sendAudio: true,
            sendVideo: true,
            sendShare: false,
            receiveVideo: true
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
            receiveVideo: false
          };

          meeting.mediaProperties.mediaDirection = mediaDirection;
          meeting.mediaProperties.remoteVideoTrack = sinon.stub().returns({mockTrack: 'mockTrack'});
          assert.isRejected(meeting.changeVideoLayout(layoutType));
        });
      });

      describe('#setLocalVideoQuality', () => {
        let mediaDirection;

        beforeEach(() => {
          mediaDirection = {sendAudio: true, sendVideo: true, sendShare: false};
          meeting.getMediaStreams = sinon.stub().returns(Promise.resolve([]));
          meeting.updateVideo = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.mediaDirection = mediaDirection;
        });

        it('should have #setLocalVideoQuality', () => {
          assert.exists(meeting.setLocalVideoQuality);
        });

        it('should call getMediaStreams with the proper level', () => meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
          assert.calledWith(meeting.getMediaStreams,
            mediaDirection,
            CONSTANTS.VIDEO_RESOLUTIONS[CONSTANTS.QUALITY_LEVELS.LOW]);
        }));

        it('should set mediaProperty with the proper level', () => meeting.setLocalVideoQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
          assert.equal(meeting.mediaProperties.localQualityLevel, CONSTANTS.QUALITY_LEVELS.LOW);
        }));

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

        it('should set mediaProperty with the proper level', () => meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
          assert.equal(meeting.mediaProperties.remoteQualityLevel, CONSTANTS.QUALITY_LEVELS.LOW);
        }));

        it('should call updateMedia', () => meeting.setRemoteQualityLevel(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
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

      describe('#setMeetingQuality', () => {
        let mediaDirection;

        beforeEach(() => {
          mediaDirection = {
            receiveAudio: true, receiveVideo: true, receiveShare: false, sendVideo: true
          };
          meeting.setRemoteQualityLevel = sinon.stub().returns(Promise.resolve());
          meeting.setLocalVideoQuality = sinon.stub().returns(Promise.resolve());
          meeting.mediaProperties.mediaDirection = mediaDirection;
        });

        it('should have #setMeetingQuality', () => {
          assert.exists(meeting.setMeetingQuality);
        });

        it('should call setRemoteQualityLevel', () => meeting.setMeetingQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
          assert.calledOnce(meeting.setRemoteQualityLevel);
        }));

        it('should not call setRemoteQualityLevel when receiveVideo and receiveAudio are false', () => {
          mediaDirection.receiveAudio = false;
          mediaDirection.receiveVideo = false;
          meeting.mediaProperties.mediaDirection = mediaDirection;

          return meeting.setMeetingQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.notCalled(meeting.setRemoteQualityLevel);
          });
        });

        it('should call setLocalVideoQuality', () => meeting.setMeetingQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
          assert.calledOnce(meeting.setLocalVideoQuality);
        }));

        it('should not call setLocalVideoQuality when sendVideo is false', () => {
          mediaDirection.sendVideo = false;
          meeting.mediaProperties.mediaDirection = mediaDirection;

          return meeting.setMeetingQuality(CONSTANTS.QUALITY_LEVELS.LOW).then(() => {
            assert.notCalled(meeting.setLocalVideoQuality);
          });
        });

        it('should error if set to a invalid level', () => {
          assert.isRejected(meeting.setMeetingQuality('invalid'));
        });
      });

      describe('#usePhoneAudio', () => {
        beforeEach(() => {
          meeting.meetingRequest.dialIn = sinon.stub().returns(Promise.resolve({body: {locus: 'testData'}}));
          meeting.meetingRequest.dialOut = sinon.stub().returns(Promise.resolve({body: {locus: 'testData'}}));
          meeting.locusInfo.onFullLocus = sinon.stub().returns(Promise.resolve());
        });

        it('with no parameters triggers dial-in, delegating request to meetingRequest correctly', async () => {
          await meeting.usePhoneAudio();
          const DIAL_IN_URL = meeting.dialInUrl;

          assert.calledWith(meeting.meetingRequest.dialIn, {
            correlationId: meeting.correlationId,
            dialInUrl: DIAL_IN_URL,
            locusUrl: meeting.locusUrl,
            clientUrl: meeting.deviceUrl
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
            clientUrl: meeting.deviceUrl
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
            phoneNumber
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
            phoneNumber
          });
          assert.calledWith(meeting.locusInfo.onFullLocus, 'testData');
          assert.notCalled(meeting.meetingRequest.dialIn);
        });

        it('rejects if the request failed (dial in)', () => {
          const error = 'something bad happened';

          meeting.meetingRequest.dialIn = sinon.stub().returns(Promise.reject(error));

          return meeting.usePhoneAudio().then(() => Promise.reject(new Error('Promise resolved when it should have rejected'))).catch((e) => {
            assert.equal(e, error);

            return Promise.resolve();
          });
        });

        it('rejects if the request failed (dial out)', async () => {
          const error = 'something bad happened';

          meeting.meetingRequest.dialOut = sinon.stub().returns(Promise.reject(error));

          return meeting.usePhoneAudio('+441234567890').then(() => Promise.reject(new Error('Promise resolved when it should have rejected'))).catch((e) => {
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
          hostId: 'some_host_id' // this.owner;
        };
        const FAKE_SDK_CAPTCHA_INFO = {
          captchaId: FAKE_CAPTCHA_ID,
          verificationImageURL: FAKE_CAPTCHA_IMAGE_URL,
          verificationAudioURL: FAKE_CAPTCHA_AUDIO_URL,
          refreshURL: FAKE_CAPTCHA_REFRESH_URL
        };
        const FAKE_WBXAPPAPI_CAPTCHA_INFO = {
          captchaID: `${FAKE_CAPTCHA_ID}-2`,
          verificationImageURL: `${FAKE_CAPTCHA_IMAGE_URL}-2`,
          verificationAudioURL: `${FAKE_CAPTCHA_AUDIO_URL}-2`,
          refreshURL: `${FAKE_CAPTCHA_REFRESH_URL}-2`
        };


        it('calls meetingInfoProvider with all the right parameters and parses the result', async () => {
          meeting.attrs.meetingInfoProvider = {fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO})};
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.parseMeetingInfo = sinon.stub().returns(undefined);

          await meeting.fetchMeetingInfo({
            password: FAKE_PASSWORD, captchaCode: FAKE_CAPTCHA_CODE
          });

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, FAKE_PASSWORD, {code: FAKE_CAPTCHA_CODE, id: FAKE_CAPTCHA_ID});

          assert.calledWith(meeting.parseMeetingInfo, {body: FAKE_MEETING_INFO}, FAKE_DESTINATION);
          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(TriggerProxy.trigger, meeting, {file: 'meetings', function: 'fetchMeetingInfo'}, 'meeting:meetingInfoAvailable');
        });

        it('calls meetingInfoProvider with all the right parameters and parses the result when random delay is applied', async () => {
          meeting.attrs.meetingInfoProvider = {fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO})};
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
          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, null, null);

          // parseMeeting info
          assert.calledWith(meeting.parseMeetingInfo, {body: FAKE_MEETING_INFO}, FAKE_DESTINATION);

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.NONE);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.NOT_REQUIRED);

          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(TriggerProxy.trigger, meeting, {file: 'meetings', function: 'fetchMeetingInfo'}, 'meeting:meetingInfoAvailable');
        });

        it('fails if captchaCode is provided when captcha not needed', async () => {
          meeting.attrs.meetingInfoProvider = {fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO})};
          meeting.requiredCaptcha = null;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(meeting.fetchMeetingInfo({
            captchaCode: FAKE_CAPTCHA_CODE
          }), Error, 'fetchMeetingInfo() called with captchaCode when captcha was not required');

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
        });

        it('fails if password is provided when not required', async () => {
          meeting.attrs.meetingInfoProvider = {fetchMeetingInfo: sinon.stub().resolves({body: FAKE_MEETING_INFO})};
          meeting.passwordStatus = PASSWORD_STATUS.NOT_REQUIRED;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(meeting.fetchMeetingInfo({
            password: FAKE_PASSWORD
          }), Error, 'fetchMeetingInfo() called with password when password was not required');

          assert.notCalled(meeting.attrs.meetingInfoProvider.fetchMeetingInfo);
        });

        it('handles meetingInfoProvider requiring password', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().throws(new MeetingInfoV2PasswordError(403004, FAKE_MEETING_INFO))
          };

          await assert.isRejected(meeting.fetchMeetingInfo({}), PasswordError);

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, null, null);

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD);
          assert.equal(meeting.requiredCaptcha, null);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
        });

        it('handles meetingInfoProvider requiring captcha because of wrong password', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO))
          };
          meeting.requiredCaptcha = null;

          await assert.isRejected(meeting.fetchMeetingInfo({
            password: 'aaa'
          }), CaptchaError);

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, 'aaa', null);


          assert.deepEqual(meeting.meetingInfo, {});
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: FAKE_CAPTCHA_ID,
            verificationImageURL: FAKE_CAPTCHA_IMAGE_URL,
            verificationAudioURL: FAKE_CAPTCHA_AUDIO_URL,
            refreshURL: FAKE_CAPTCHA_REFRESH_URL
          });
        });

        it('handles meetingInfoProvider requiring captcha because of wrong captcha', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO))
          };
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;

          await assert.isRejected(meeting.fetchMeetingInfo({
            password: 'aaa', captchaCode: 'bbb'
          }), CaptchaError);

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, 'aaa', {code: 'bbb', id: FAKE_CAPTCHA_ID});

          assert.deepEqual(meeting.meetingInfo, {});
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.WRONG_CAPTCHA);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, FAKE_SDK_CAPTCHA_INFO);
        });

        it('handles successful response when good password is passed', async () => {
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().resolves(
              {
                statusCode: 200,
                body: FAKE_MEETING_INFO
              }
            )
          };
          meeting.passwordStatus = PASSWORD_STATUS.REQUIRED;

          await meeting.fetchMeetingInfo({
            password: 'aaa'
          });

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, 'aaa', null);

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
            verificationAudioURL: FAKE_WBXAPPAPI_CAPTCHA_INFO.verificationAudioURL
          };

          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().throws(new MeetingInfoV2PasswordError(403004, FAKE_MEETING_INFO))
          };
          meeting.meetingRequest.refreshCaptcha = sinon.stub().returns(Promise.resolve(
            {
              body: refreshedCaptcha
            }
          ));
          meeting.passwordStatus = PASSWORD_STATUS.REQUIRED;
          meeting.requiredCaptcha = FAKE_SDK_CAPTCHA_INFO;
          meeting.destination = FAKE_DESTINATION;
          meeting.destinationType = FAKE_TYPE;

          await assert.isRejected(meeting.fetchMeetingInfo({
            password: 'aaa', captchaCode: 'bbb'
          }));

          assert.calledWith(meeting.attrs.meetingInfoProvider.fetchMeetingInfo, FAKE_DESTINATION, FAKE_TYPE, 'aaa', {code: 'bbb', id: FAKE_CAPTCHA_ID});

          assert.deepEqual(meeting.meetingInfo, FAKE_MEETING_INFO);
          assert.equal(meeting.meetingInfoFailureReason, MEETING_INFO_FAILURE_REASON.WRONG_PASSWORD);
          assert.equal(meeting.passwordStatus, PASSWORD_STATUS.REQUIRED);
          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: refreshedCaptcha.captchaID,
            verificationImageURL: refreshedCaptcha.verificationImageURL,
            verificationAudioURL: refreshedCaptcha.verificationAudioURL,
            refreshURL: FAKE_SDK_CAPTCHA_INFO.refreshURL // refresh url doesn't change
          });
        });
      });

      describe('#refreshCaptcha', () => {
        it('fails if no captcha required', async () => {
          assert.isRejected(meeting.refreshCaptcha(), Error);
        });
        it('sends correct request to captcha service refresh url', async () => {
          const REFRESH_URL = 'https://something.webex.com/captchaservice/v1/captchas/refresh?blablabla=something&captchaID=xxx';
          const EXPECTED_REFRESH_URL = 'https://something.webex.com/captchaservice/v1/captchas/refresh?blablabla=something&captchaID=xxx&siteFullName=something.webex.com';

          const FAKE_SDK_CAPTCHA_INFO = {
            captchaId: 'some id',
            verificationImageURL: 'some image url',
            verificationAudioURL: 'some audio url',
            refreshURL: REFRESH_URL
          };

          const FAKE_REFRESHED_CAPTCHA = {
            captchaID: 'some id',
            verificationImageURL: 'some image url',
            verificationAudioURL: 'some audio url'
          };

          // setup the meeting so that a captcha is required
          meeting.attrs.meetingInfoProvider = {
            fetchMeetingInfo: sinon.stub().throws(new MeetingInfoV2CaptchaError(423005, FAKE_SDK_CAPTCHA_INFO))
          };

          await assert.isRejected(meeting.fetchMeetingInfo({
            password: ''
          }), CaptchaError);

          assert.deepEqual(meeting.requiredCaptcha, FAKE_SDK_CAPTCHA_INFO);
          meeting.meetingRequest.refreshCaptcha = sinon.stub().returns(Promise.resolve({body: FAKE_REFRESHED_CAPTCHA}));

          // test the captcha refresh
          await meeting.refreshCaptcha();

          assert.calledWith(meeting.meetingRequest.refreshCaptcha,
            {
              captchaRefreshUrl: EXPECTED_REFRESH_URL,
              captchaId: FAKE_SDK_CAPTCHA_INFO.captchaId
            });

          assert.deepEqual(meeting.requiredCaptcha, {
            captchaId: FAKE_REFRESHED_CAPTCHA.captchaID,
            verificationImageURL: FAKE_REFRESHED_CAPTCHA.verificationImageURL,
            verificationAudioURL: FAKE_REFRESHED_CAPTCHA.verificationAudioURL,
            refreshURL: FAKE_SDK_CAPTCHA_INFO.refreshURL // refresh url doesn't change
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
            BEHAVIORAL_METRICS.VERIFY_PASSWORD_SUCCESS,
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
          meeting.meetingRequest.endMeetingForAll = sinon.stub().returns(Promise.resolve({body: 'test'}));
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
          meeting.roap.stop = sinon.stub().returns(Promise.resolve());
          meeting.logger.error = sinon.stub().returns(true);

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
          assert.calledOnce(meeting?.roap?.stop);
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
          sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve(MeetingUtil.parseLocusJoin({body: {locus, mediaConnections: []}})));
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should throw an error if resourceId not passed', async () => {
          try {
            await meeting.moveTo();
          }
          catch (err) {
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
                  whiteboard: false
                },
                tx: {
                  audio: false,
                  share: false,
                  share_audio: false,
                  video: false,
                  whiteboard: false
                }
              }
            }
          });
          assert.calledWithMatch(Metrics.postEvent, {event: eventType.MOVE_MEDIA});
        });

        it('should call `MeetingUtil.joinMeetingOptions` with resourceId', async () => {
          sinon.spy(MeetingUtil, 'joinMeetingOptions');
          await meeting.moveTo('resourceId');

          assert.calledWith(MeetingUtil.joinMeetingOptions, meeting, {resourceId: 'resourceId', moveToResource: true});
        });

        it('should reconnectMedia after DX joins after moveTo', async () => {
          await meeting.moveTo('resourceId');


          await meeting.locusInfo.emitScoped(
            {
              file: 'locus-info',
              function: 'updateSelf'
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

          assert.calledWith(meeting.reconnectionManager.reconnectMedia,
            {
              mediaDirection: {
                sendVideo: false,
                receiveVideo: false,
                sendAudio: false,
                receiveAudio: false,
                sendShare: false,
                receiveShare: true
              }
            });
        });

        it('should throw an error if moveTo call fails', async () => {
          MeetingUtil.joinMeeting = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveTo('resourceId');
          }
          catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.MOVE_TO_FAILURE,
              {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: sinon.match.any,
                stack: sinon.match.any
              }
            );
          }
          Metrics.sendBehavioralMetric.reset();
          meeting.reconnectionManager.reconnectMedia = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveTo('resourceId');

            await meeting.locusInfo.emitScoped(
              {
                file: 'locus-info',
                function: 'updateSelf'
              },
              'SELF_OBSERVING'
            );
          }
          catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.MOVE_TO_FAILURE,
              {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: sinon.match.any,
                stack: sinon.match.any
              }
            );
          }
        });
      });

      describe('#moveFrom', () => {
        let sandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          sandbox.stub(MeetingUtil, 'joinMeeting').returns(Promise.resolve(MeetingUtil.parseLocusJoin({body: {locus, mediaConnections: []}})));
          sandbox.stub(MeetingUtil, 'leaveMeeting').returns(Promise.resolve());
        });

        afterEach(() => {
          sandbox.restore();
          sandbox = null;
        });

        it('should throw an error if resourceId not passed', async () => {
          try {
            await meeting.moveFrom();
          }
          catch (err) {
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
            moveMeeting: true
          });

          assert.calledOnce(Metrics.sendBehavioralMetric);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.MOVE_FROM_SUCCESS,
          );
        });

        it('should throw an error if moveFrom call fails', async () => {
          MeetingUtil.joinMeeting = sinon.stub().returns(Promise.reject());
          try {
            await meeting.moveFrom('resourceId');
          }
          catch {
            assert.calledOnce(Metrics.sendBehavioralMetric);
            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.MOVE_FROM_FAILURE,
              {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: sinon.match.any,
                stack: sinon.match.any
              }
            );
          }
        });
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
            meeting.reconnectionManager.reconnect = sinon.stub().returns(Promise.reject(new Error()));
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
                stack: sinon.match.any
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
              sinon.match.instanceOf(Meeting),
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
              cursor: true
            })
          };
          const getVideoTracks = sinon.stub().returns([track]);

          meeting.mediaProperties.setLocalShareTrack = sinon.stub().returns(true);
          meeting.mediaProperties.shareTrack = {getVideoTracks, getSettings: track.getSettings};
          meeting.stopShare = sinon.stub().resolves(true);
          meeting.mediaProperties.mediaDirection = {};
          meeting.setLocalShareTrack(test1);
          assert.calledTwice(TriggerProxy.trigger);
          assert.calledWith(
            TriggerProxy.trigger,
            sinon.match.instanceOf(Meeting),
            {file: 'meeting/index', function: 'setLocalShareTrack'},
            'media:ready'
          );
          assert.calledOnce(meeting.mediaProperties.setLocalShareTrack);
          assert.equal(meeting.mediaProperties.localStream, undefined);
          meeting.mediaProperties.shareTrack.onended();
          assert.calledOnce(meeting.stopShare);
        });
      });
      describe('#setRemoteStream', () => {
        beforeEach(() => {
          meeting.statsAnalyzer = {startAnalyzer: sinon.stub()};
        });
        it('should trigger a media:ready event when remote stream track ontrack is fired', () => {
          const pc = {};

          meeting.setRemoteStream(pc);
          pc.ontrack({track: 'track', transceiver: {mid: '0'}});
          assert.equal(TriggerProxy.trigger.getCall(1).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(1).args[3], {type: 'remoteAudio', stream: true});

          pc.ontrack({track: 'track', transceiver: {mid: '1'}});
          assert.equal(TriggerProxy.trigger.getCall(2).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(2).args[3], {type: 'remoteVideo', stream: true});

          pc.ontrack({transceiver: {mid: '2'}, track: 'track'});
          assert.equal(TriggerProxy.trigger.getCall(3).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(3).args[3], {type: 'remoteShare', stream: true});


          // special case for safari
          pc.ontrack({target: {audioTransceiver: {receiver: {track: {id: 'trackId'}}}}, transceiver: {}, track: {id: 'trackId'}});
          assert.equal(TriggerProxy.trigger.getCall(1).args[2], 'media:ready');
          assert.deepEqual(TriggerProxy.trigger.getCall(1).args[3], {type: 'remoteAudio', stream: true});
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
      });

      describe('#setUpLocusUrlListener', () => {
        it('listens to the locus url update event', (done) => {
          const newLocusUrl = 'newLocusUrl/12345';

          meeting.members = {locusUrlUpdate: sinon.stub().returns(Promise.resolve(test1))};

          meeting.locusInfo.emit({function: 'test', file: 'test'}, 'LOCUS_INFO_UPDATE_URL', newLocusUrl);
          assert.calledWith(
            meeting.members.locusUrlUpdate,
            newLocusUrl
          );
          assert.equal(meeting.locusUrl, newLocusUrl);
          assert(meeting.locusId, '12345');
          done();
        });
      });
      describe('#setUpLocusInfoMediaInactiveListener', () => {
        it('listens to disconnect due to un activity ', (done) => {
          TriggerProxy.trigger.reset();
          meeting.locusInfo.emit({function: 'test', file: 'test'}, EVENTS.DISCONNECT_DUE_TO_INACTIVITY, {reason: 'inactive'});
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
          meeting.locusInfo.emit({function: 'test', file: 'test'}, EVENTS.DISCONNECT_DUE_TO_INACTIVITY, {reason: 'inactive'});
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

          meeting.locusInfo.emit({function: 'test', file: 'test'}, EVENTS.DESTROY_MEETING, {shouldLeave: false, reason: 'ended'});
          assert.calledOnce(TriggerProxy.trigger);
          assert.calledOnce(MeetingUtil.cleanUp);
          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoMeetingListener'
            },
            EVENTS.DESTROY_MEETING,
            {
              reason: 'ended',
              meetingId: meeting.id
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

      describe('#stopFloorRequest', () => {
        it('should have #stopFloorRequest', () => {
          assert.exists(meeting.stopFloorRequest);
        });
        beforeEach(() => {
          meeting.locusInfo.mediaShares = [{name: 'content', url: url1}];
          meeting.locusInfo.self = {url: url2};
          meeting.meetingRequest.changeMeetingFloor = sinon.stub().returns(Promise.resolve());
        });
        it('should call change meeting floor', async () => {
          const share = meeting.share();

          assert.exists(share.then);
          await share;
          assert.calledOnce(meeting.meetingRequest.changeMeetingFloor);
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
        it('should close the peer connections, and return a promise', async () => {
          PeerConnectionManager.close = sinon.stub().returns(Promise.resolve());
          const pcs = meeting.closePeerConnections();

          assert.exists(pcs.then);
          await pcs;
          assert.calledOnce(PeerConnectionManager.close);
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
              owner: test2
            }
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken: 'abc'
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
              owner: 'locusOwner'
            }
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
              owner: test2
            }
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_LOCUS_MEETING);
          const expectedInfoToParse = {
            conversationUrl: 'locusConvURL',
            locusUrl: 'locusUrl',
            sipUri: 'locusSipUri',
            meetingNumber: 'locusMeetingId',
            meetingJoinUrl: url2,
            owner: 'locusOwner',
            permissionToken: 'abc'
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
              owner: test2
            }
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken: 'abc'
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
              owner: test2
            }
          };

          meeting.parseMeetingInfo(FAKE_MEETING_INFO, FAKE_STRING_DESTINATION);
          const expectedInfoToParse = {
            conversationUrl: uuid1,
            locusUrl: url1,
            sipUri: test1,
            meetingNumber: '12345',
            meetingJoinUrl: url2,
            owner: test2,
            permissionToken: 'abc'
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
            assert.calledWith(meeting.setLocus, {url: url1, participants: [{id: uuid1}], self: {id: uuid2}});
            assert.calledOnce(MeetingUtil.getLocusPartner);
            assert.calledWith(MeetingUtil.getLocusPartner, [{id: uuid1}], {id: uuid2});
            assert.deepEqual(meeting.partner, {person: {sipUrl: uuid3}});
            assert.equal(meeting.sipUri, uuid3);
          });
        });
      });
      describe('#setRoapSeq', () => {
        it('should set the roap seq and return null', () => {
          assert.equal(-1, meeting.roapSeq);
          meeting.setRoapSeq(1);
          assert.equal(meeting.roapSeq, 1);
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
              function: 'setUpLocusInfoAssignHostListener'
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
        let canUserRecordSpy;
        let canUserStopSpy;
        let canUserPauseSpy;
        let canUserResumeSpy;
        let canUserRaiseHandSpy;
        let canUserLowerAllHandsSpy;
        let canUserLowerSomeoneElsesHandSpy;
        let waitingForOthersToJoinSpy;


        beforeEach(() => {
          locusInfoOnSpy = sinon.spy(meeting.locusInfo, 'on');
          canUserLockSpy = sinon.spy(MeetingUtil, 'canUserLock');
          canUserUnlockSpy = sinon.spy(MeetingUtil, 'canUserUnlock');
          canUserRecordSpy = sinon.spy(MeetingUtil, 'canUserRecord');
          canUserStopSpy = sinon.spy(MeetingUtil, 'canUserStop');
          canUserPauseSpy = sinon.spy(MeetingUtil, 'canUserPause');
          canUserResumeSpy = sinon.spy(MeetingUtil, 'canUserResume');
          inMeetingActionsSetSpy = sinon.spy(meeting.inMeetingActions, 'set');
          canUserRaiseHandSpy = sinon.spy(MeetingUtil, 'canUserRaiseHand');
          canUserLowerAllHandsSpy = sinon.spy(MeetingUtil, 'canUserLowerAllHands');
          canUserLowerSomeoneElsesHandSpy = sinon.spy(MeetingUtil, 'canUserLowerSomeoneElsesHand');
          waitingForOthersToJoinSpy = sinon.spy(MeetingUtil, 'waitingForOthersToJoin');
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
              userDisplayHints: ['LOCK_CONTROL_UNLOCK']
            }
          };

          callback(payload);

          assert.calledWith(canUserLockSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserUnlockSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserRecordSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserStopSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserPauseSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserResumeSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserRaiseHandSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserLowerAllHandsSpy, payload.info.userDisplayHints);
          assert.calledWith(canUserLowerSomeoneElsesHandSpy, payload.info.userDisplayHints);
          assert.calledWith(waitingForOthersToJoinSpy, payload.info.userDisplayHints);

          assert.calledWith(
            TriggerProxy.trigger,
            meeting,
            {
              file: 'meeting/index',
              function: 'setUpLocusInfoMeetingInfoListener'
            },
            'meeting:actionsUpdate',
            meeting.inMeetingActions.get()
          );

          TriggerProxy.trigger.resetHistory();

          callback(payload);

          assert.notCalled(TriggerProxy.trigger);
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
            host: {id: uuid4}
          });
          assert.calledOnce(meeting.locusInfo.initialSetup);
          assert.calledWith(meeting.locusInfo.initialSetup, {
            mediaConnections: [test1],
            locusUrl: url1,
            locusId: uuid1,
            selfId: uuid2,
            mediaId: uuid3,
            host: {id: uuid4}
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
              channelUrl: url2
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
            REMOTE_B: 'd4d102a1-17ce-4e17-9b08-bded3de467e4'
          };

          const RESOURCE_URLS = {
            WHITEBOARD_A: 'https://board-a.wbx2.com/board/api/v1/channels/49cfb550-5517-11eb-a2af-1b9e4bc3da13',
            WHITEBOARD_B: 'https://board-a.wbx2.com/board/api/v1/channels/977a7330-54f4-11eb-b1ef-91f5eefc7bf3'
          };

          const generateContent = (beneficiaryId = null, disposition = null) => ({beneficiaryId, disposition});
          const generateWhiteboard = (beneficiaryId = null, disposition = null, resourceUrl = null) => ({beneficiaryId, disposition, resourceUrl});

          const generateData = (payload, isGranting, isContent, beneficiaryId, resourceUrl, isAccepting, otherBeneficiaryId) => {
            const newPayload = cloneDeep(payload);

            newPayload.previous = cloneDeep(payload.current);

            const eventTrigger = {
              share: [],
              member: {
                eventName: EVENT_TRIGGERS.MEMBERS_CONTENT_UPDATE,
                eventPayload: {
                  activeSharingId: null,
                  endedSharingId: null
                }
              }
            };

            let shareStatus = null;
            const activeSharingId = {
              whiteboard: null,
              content: null
            };

            if (isGranting) {
              if (isContent) {
                activeSharingId.content = beneficiaryId;
                newPayload.current.content = generateContent(beneficiaryId, FLOOR_ACTION.GRANTED);

                if (isEqual(newPayload.current, newPayload.previous)) {
                  eventTrigger.member = null;
                }
                else {
                  if (newPayload.current.whiteboard.beneficiaryId) {
                    if (newPayload.current.whiteboard.disposition === FLOOR_ACTION.GRANTED) {
                      newPayload.current.whiteboard.disposition = FLOOR_ACTION.RELEASED;
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                        functionName: 'stopWhiteboardShare'
                      });
                      eventTrigger.member.eventPayload.endedSharingId = newPayload.current.whiteboard.beneficiaryId;
                    }
                  }

                  if (newPayload.previous.content.beneficiaryId) {
                    if (newPayload.previous.content.beneficiaryId !== newPayload.current.content.beneficiaryId) {
                      if (newPayload.previous.content.beneficiaryId === USER_IDS.ME) {
                        eventTrigger.share.push({
                          eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                          functionName: 'stopFloorRequest'
                        });
                      }
                      else if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                        eventTrigger.share.push({
                          eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                          functionName: 'remoteShare'
                        });
                      }
                      eventTrigger.member.eventPayload.endedSharingId = newPayload.previous.content.beneficiaryId;
                    }
                  }

                  if (isAccepting) {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                      functionName: 'stopWhiteboardShare'
                    });
                  }

                  if (beneficiaryId === USER_IDS.ME) {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_LOCAL,
                      functionName: 'share'
                    });
                  }
                  else {
                    eventTrigger.share.push({
                      eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE,
                      functionName: 'remoteShare',
                      eventPayload: {memberId: beneficiaryId}
                    });
                  }
                }

                if (beneficiaryId === USER_IDS.ME) {
                  shareStatus = SHARE_STATUS.LOCAL_SHARE_ACTIVE;
                }
                else {
                  shareStatus = SHARE_STATUS.REMOTE_SHARE_ACTIVE;
                }
              }
              else {
                newPayload.current.whiteboard = generateWhiteboard(beneficiaryId, FLOOR_ACTION.GRANTED, resourceUrl);

                if (newPayload.current.content.beneficiaryId) {
                  if (newPayload.current.content.disposition === FLOOR_ACTION.GRANTED) {
                    newPayload.current.content.disposition = FLOOR_ACTION.RELEASED;
                    if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                        functionName: 'stopFloorRequest'
                      });
                    }
                    else {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                        functionName: 'remoteShare'
                      });
                    }

                    eventTrigger.member.eventPayload.endedSharingId = newPayload.current.content.beneficiaryId;
                  }
                }

                if (newPayload.previous.content.beneficiaryId) {
                  if (newPayload.previous.content.beneficiaryId !== newPayload.current.content.beneficiaryId) {
                    if (newPayload.previous.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                        functionName: 'stopFloorRequest'
                      });
                    }
                    else if (newPayload.current.content.beneficiaryId === USER_IDS.ME) {
                      eventTrigger.share.push({
                        eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                        functionName: 'remoteShare'
                      });
                    }
                    eventTrigger.member.eventPayload.endedSharingId = newPayload.previous.content.beneficiaryId;
                  }
                }

                if (newPayload.previous.whiteboard.beneficiaryId) {
                  if (newPayload.previous.whiteboard.beneficiaryId !== newPayload.current.whiteboard.beneficiaryId) {
                    eventTrigger.member.eventPayload.endedSharingId = newPayload.previous.whiteboard.beneficiaryId;
                  }
                }

                activeSharingId.whiteboard = beneficiaryId;

                eventTrigger.share.push({
                  eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
                  functionName: 'startWhiteboardShare',
                  eventPayload: {resourceUrl, memberId: beneficiaryId}
                });

                shareStatus = SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE;
              }

              if (eventTrigger.member) {
                eventTrigger.member.eventPayload.activeSharingId = beneficiaryId;
              }
            }
            else {
              eventTrigger.member.eventPayload.endedSharingId = beneficiaryId;

              if (isContent) {
                newPayload.current.content.disposition = FLOOR_ACTION.RELEASED;

                if (beneficiaryId === USER_IDS.ME) {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
                    functionName: 'stopFloorRequest'
                  });
                }
                else {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_REMOTE,
                    functionName: 'remoteShare'
                  });
                }

                shareStatus = SHARE_STATUS.NO_SHARE;
              }
              else {
                newPayload.current.whiteboard.disposition = FLOOR_ACTION.RELEASED;

                if (isAccepting) {
                  newPayload.current.content.disposition = FLOOR_ACTION.ACCEPTED;
                  newPayload.current.content.beneficiaryId = otherBeneficiaryId;

                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STARTED_SHARING_WHITEBOARD,
                    functionName: 'startWhiteboardShare',
                    eventPayload: {resourceUrl, memberId: beneficiaryId}
                  });

                  shareStatus = SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE;
                }
                else {
                  eventTrigger.share.push({
                    eventName: EVENT_TRIGGERS.MEETING_STOPPED_SHARING_WHITEBOARD,
                    functionName: 'stopWhiteboardShare'
                  });

                  shareStatus = SHARE_STATUS.NO_SHARE;
                }
              }
            }

            return {
              payload: newPayload, eventTrigger, shareStatus, activeSharingId
            };
          };

          const blankPayload = {
            previous: {
              content: generateContent(),
              whiteboard: generateWhiteboard()
            },
            current: {
              content: generateContent(),
              whiteboard: generateWhiteboard()
            }
          };


          const payloadTestHelper = (data) => {
            assert.equal(meeting.shareStatus, SHARE_STATUS.NO_SHARE);

            // Called once --> members:update (ignore)
            let callCounter = 1;

            data.forEach((d, index) => {
              meeting.locusInfo.emit({function: 'test', file: 'test'}, EVENTS.LOCUS_INFO_UPDATE_MEDIA_SHARES, d.payload);

              assert.equal(meeting.shareStatus, data[index].shareStatus);

              callCounter += data[index].eventTrigger.share.length + (data[index].eventTrigger.member ? 1 : 0);

              assert.callCount(TriggerProxy.trigger, callCounter);

              assert.equal(meeting.members.mediaShareWhiteboardId, data[index].activeSharingId.whiteboard);
              assert.equal(meeting.members.mediaShareContentId, data[index].activeSharingId.content);
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
                const fileName = functionName === 'remoteShare' ? 'meetings/index' : 'meeting/index';

                assert.deepEqual(shareCallArgs[1], {
                  file: fileName,
                  function: functionName
                });


                assert.equal(shareCallArgs[2], eventName);

                if (functionName === 'startWhiteboardShare') {
                  assert.deepEqual(shareCallArgs[3], eventPayload);
                }

                if (functionName === 'remoteShare' && eventName === EVENT_TRIGGERS.MEETING_STARTED_SHARING_REMOTE) {
                  assert.deepEqual(shareCallArgs[3], eventPayload);
                }
              }

              // Check Trigger --> members:content:update
              if (member) {
                const memberCallArgs = TriggerProxy.trigger.getCall(i + share.length).args;

                assert.deepEqual(memberCallArgs[1], {
                  file: 'members',
                  function: 'locusMediaSharesUpdate'
                });
                assert.equal(memberCallArgs[2], member.eventName);

                // Check payload --> {activeSharingId, endedSharingId}
                assert.deepEqual(memberCallArgs[3], member.eventPayload);

                i += 1;
              }

              i += share.length;

              if (share.length + 1 > offset) {
                offset = (offset + share.length + 1) / 2;
              }
              else if (share.length + 1 < offset) {
                offset = (share.length + 1) + 0.5;
              }
            }
          };

          it('should have #setUpLocusMediaSharesListener', () => {
            assert.exists(meeting.setUpLocusMediaSharesListener);
          });

          describe('Whiteboard A --> Whiteboard B', () => {
            it('Scenario #1: you share both whiteboards', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_B);
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #2: you share whiteboard A and remote person A shares whiteboard B', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_B);
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares whiteboard A and you share whiteboard B', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_B);
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares both whiteboards', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_B);
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares whiteboard A and remote person B shares whiteboard B', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_B, RESOURCE_URLS.WHITEBOARD_B);
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3]);
            });
          });

          describe('Whiteboard A --> Desktop', () => {
            it('Scenario #1: you share whiteboard and then share desktop', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, false, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A, true, USER_IDS.ME);
              const data3 = generateData(data2.payload, true, true, USER_IDS.ME, undefined, true, USER_IDS.ME);
              const data4 = generateData(data3.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #2: you share whiteboard A and remote person A shares desktop', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, false, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A, true, USER_IDS.REMOTE_A);
              const data3 = generateData(data2.payload, true, true, USER_IDS.REMOTE_A, undefined, true, USER_IDS.ME);
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #3: remote person A shares whiteboard and you share desktop', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, false, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A, true, USER_IDS.ME);
              const data3 = generateData(data2.payload, true, true, USER_IDS.ME, undefined, true, USER_IDS.REMOTE_A);
              const data4 = generateData(data3.payload, false, true, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #4: remote person A shares whiteboard and then shares desktop', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, false, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A, true, USER_IDS.REMOTE_A);
              const data3 = generateData(data2.payload, true, true, USER_IDS.REMOTE_A, undefined, true, USER_IDS.REMOTE_A);
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3, data4]);
            });

            it('Scenario #5: remote person A shares whiteboard and remote person B shares desktop', () => {
              const data1 = generateData(blankPayload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data2 = generateData(data1.payload, false, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A, true, USER_IDS.REMOTE_B);
              const data3 = generateData(data2.payload, true, true, USER_IDS.REMOTE_B, undefined, true, USER_IDS.REMOTE_A);
              const data4 = generateData(data3.payload, false, true, USER_IDS.REMOTE_B);

              payloadTestHelper([data1, data2, data3, data4]);
            });
          });

          describe('Desktop --> Whiteboard A', () => {
            it('Scenario #1: you share desktop and then share whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(data1.payload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #2: you share desktop and remote person A shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.ME);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #3: remote person A shares desktop and you share whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
              const data3 = generateData(data2.payload, false, false, USER_IDS.REMOTE_A);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #4: remote person A shares desktop and then shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.ME, RESOURCE_URLS.WHITEBOARD_A);
              const data3 = generateData(data2.payload, false, false, USER_IDS.ME);

              payloadTestHelper([data1, data2, data3]);
            });

            it('Scenario #5: remote person A shares desktop and remote person B shares whiteboard', () => {
              const data1 = generateData(blankPayload, true, true, USER_IDS.REMOTE_A);
              const data2 = generateData(data1.payload, true, false, USER_IDS.REMOTE_A, RESOURCE_URLS.WHITEBOARD_A);
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
            keepAliveSecs: defaultKeepAliveSecs
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await testUtils.flushPromises();
          assert.notCalled(meeting.meetingRequest.keepAlive);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {keepAliveUrl: defaultKeepAliveUrl});
          await progressTime(defaultExpectedInterval);
          assert.calledTwice(meeting.meetingRequest.keepAlive);
          assert.alwaysCalledWithExactly(meeting.meetingRequest.keepAlive, {keepAliveUrl: defaultKeepAliveUrl});
        });
        it('startKeepAlive handles existing keepAliveTimerId', async () => {
          meeting.meetingRequest.keepAlive = sinon.stub().returns(Promise.resolve());
          logger.warn = sinon.spy();

          meeting.keepAliveTimerId = 7;
          meeting.joinedWith = {
            keepAliveUrl: defaultKeepAliveUrl,
            keepAliveSecs: defaultKeepAliveSecs
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
            keepAliveSecs: defaultKeepAliveSecs
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
            keepAliveUrl: defaultKeepAliveUrl
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
            keepAliveSecs: 1
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
            keepAliveSecs: defaultKeepAliveSecs
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await testUtils.flushPromises();
          assert.notCalled(meeting.meetingRequest.keepAlive);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {keepAliveUrl: defaultKeepAliveUrl});
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
            keepAliveSecs: defaultKeepAliveSecs
          };
          meeting.startKeepAlive();
          assert.isNumber(meeting.keepAliveTimerId.id);
          await progressTime(defaultExpectedInterval);
          assert.calledOnceWithExactly(meeting.meetingRequest.keepAlive, {keepAliveUrl: defaultKeepAliveUrl});

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
    });
  });
});
