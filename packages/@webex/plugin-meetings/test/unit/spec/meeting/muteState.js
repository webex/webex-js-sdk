import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import {createMuteState, MuteState} from '@webex/plugin-meetings/src/meeting/muteState';
import PermissionError from '@webex/plugin-meetings/src/common/errors/permission';
import {AUDIO, VIDEO} from '@webex/plugin-meetings/src/constants';

import testUtils from '../../../utils/testUtils';

describe('plugin-meetings', () => {
  let meeting;
  let audio;
  let video;
  let originalRemoteUpdateAudioVideo;

  const fakeLocus = {info: 'this is a fake locus'};

  const createFakeLocalStream = (id, userMuted, systemMuted) => {
    return {
      id,
      setServerMuted: sinon.stub(),
      setUnmuteAllowed: sinon.stub(),
      setUserMuted: sinon.stub(),
      userMuted,
      systemMuted,
      get muted() {
        return this.userMuted || this.systemMuted;
      },
    };
  };

  beforeEach(async () => {
    meeting = {
      mediaProperties: {
        audioStream: createFakeLocalStream('fake audio stream', false, false),
        videoStream: createFakeLocalStream('fake video stream', false, false),
      },
      remoteMuted: false,
      unmuteAllowed: true,
      remoteVideoMuted: false,
      unmuteVideoAllowed: true,

      locusInfo: {
        handleLocusDelta: sinon.stub(),
      },
      members: {
        selfId: 'fake self id',
        muteMember: sinon.stub().resolves(),
      },
    };

    originalRemoteUpdateAudioVideo = MeetingUtil.remoteUpdateAudioVideo;

    MeetingUtil.remoteUpdateAudioVideo = sinon.stub().resolves(fakeLocus);

    audio = createMuteState(AUDIO, meeting, true);
    video = createMuteState(VIDEO, meeting, true);

    await testUtils.flushPromises();
  });

  afterEach(() => {
    MeetingUtil.remoteUpdateAudioVideo = originalRemoteUpdateAudioVideo;
  });

  describe('mute state library', () => {
    it('takes into account current remote mute status when instantiated', async () => {
      // simulate being already remote muted
      meeting.remoteMuted = true;

      // create a new MuteState instance
      audio = createMuteState(AUDIO, meeting, true);

      await testUtils.flushPromises();

      assert.isTrue(audio.isMuted());
      assert.isTrue(audio.isRemotelyMuted());

      // now check the opposite case
      meeting.remoteMuted = false;

      // create a new MuteState instance
      audio = createMuteState(AUDIO, meeting, true);

      await testUtils.flushPromises();

      assert.isTrue(audio.isMuted()); // because we start with no stream
      assert.isFalse(audio.isRemotelyMuted());
    });

    it('initialises correctly for video', async () => {
      // setup fields related to video remote state
      meeting.remoteVideoMuted = false;
      meeting.unmuteVideoAllowed = false;

      // create a new video MuteState instance
      video = createMuteState(VIDEO, meeting, true);

      await testUtils.flushPromises();

      assert.isTrue(video.isMuted()); // because we start with no stream
      assert.isFalse(video.isRemotelyMuted());
      assert.isFalse(video.state.server.remoteMute);
      assert.isFalse(video.state.server.unmuteAllowed);
    });

    it('takes remote mute into account when reporting current state', async () => {
      assert.isFalse(audio.isRemotelyMuted());

      // simulate remote mute
      audio.handleServerRemoteMuteUpdate(meeting, true, true);

      assert.isTrue(audio.isRemotelyMuted());
    });

    it('does not locally unmute on a server unmute', async () => {
      const setServerMutedSpy = meeting.mediaProperties.audioStream.setServerMuted;

      // simulate remote mute
      audio.handleServerRemoteMuteUpdate(meeting, true, true);

      assert.isTrue(audio.isRemotelyMuted());
      assert.isTrue(audio.isLocallyMuted());

      // mutes local
      assert.calledOnceWithExactly(setServerMutedSpy, true, 'remotelyMuted');

      setServerMutedSpy.resetHistory();

      // simulate remote unmute
      audio.handleServerRemoteMuteUpdate(meeting, false, true);

      assert.isFalse(audio.isRemotelyMuted());
      assert.isTrue(audio.isLocallyMuted());

      // does not unmute local
      assert.notCalled(setServerMutedSpy);
    });

    it('does local audio unmute if localAudioUnmuteRequired is received', async () => {
      // first we need to have the local stream user muted
      meeting.mediaProperties.audioStream.userMuted = true;
      audio.handleLocalStreamChange(meeting);

      assert.isTrue(audio.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      // assuming setServerMuted succeeds at updating userMuted
      meeting.mediaProperties.audioStream.setServerMuted = sinon.stub().callsFake((muted) => {
        meeting.mediaProperties.audioStream.userMuted = muted;
      });
      audio.handleServerLocalUnmuteRequired(meeting);

      await testUtils.flushPromises();

      // check that local stream was unmuted
      assert.calledWith(
        meeting.mediaProperties.audioStream.setServerMuted,
        false,
        'localUnmuteRequired'
      );

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);

      assert.isFalse(audio.isMuted());
    });

    it('handles localAudioUnmuteRequired but does not send unmute to server if system is muted', async () => {
      // first we need to have the local stream user muted and system muted
      meeting.mediaProperties.audioStream.userMuted = true;
      meeting.mediaProperties.audioStream.systemMuted = true;
      audio.handleLocalStreamChange(meeting);

      assert.isTrue(audio.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      // assuming setServerMuted succeeds at updating userMuted
      meeting.mediaProperties.audioStream.setServerMuted = sinon.stub().callsFake((muted) => {
        meeting.mediaProperties.audioStream.userMuted = muted;
      });
      audio.handleServerLocalUnmuteRequired(meeting);

      await testUtils.flushPromises();

      // check that local stream was unmuted
      assert.calledWith(
        meeting.mediaProperties.audioStream.setServerMuted,
        false,
        'localUnmuteRequired'
      );

      // system was muted so local unmute was not sent to server
      assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);

      assert.isTrue(audio.isMuted());
    });

    it('does local video unmute if localVideoUnmuteRequired is received', async () => {
      // first we need to have the local stream user muted
      meeting.mediaProperties.videoStream.userMuted = true;
      video.handleLocalStreamChange(meeting);

      assert.isTrue(video.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      // assuming setServerMuted succeeds at updating userMuted
      meeting.mediaProperties.videoStream.setServerMuted = sinon.stub().callsFake((muted) => {
        meeting.mediaProperties.videoStream.userMuted = muted;
      });
      video.handleServerLocalUnmuteRequired(meeting);

      await testUtils.flushPromises();

      // check that local stream was unmuted
      assert.calledWith(
        meeting.mediaProperties.videoStream.setServerMuted,
        false,
        'localUnmuteRequired'
      );

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);

      assert.isFalse(video.isMuted());
    });

    it('handles localVideoUnmuteRequired but does not send unmute to server if system is muted', async () => {
      // first we need to have the local stream user muted and system muted
      meeting.mediaProperties.videoStream.userMuted = true;
      meeting.mediaProperties.videoStream.systemMuted = true;
      audio.handleLocalStreamChange(meeting);

      assert.isTrue(video.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      // assuming setServerMuted succeeds at updating userMuted
      meeting.mediaProperties.videoStream.setServerMuted = sinon.stub().callsFake((muted) => {
        meeting.mediaProperties.videoStream.userMuted = muted;
      });
      video.handleServerLocalUnmuteRequired(meeting);

      await testUtils.flushPromises();

      // check that local stream was unmuted
      assert.calledWith(
        meeting.mediaProperties.videoStream.setServerMuted,
        false,
        'localUnmuteRequired'
      );

      // system was muted so local unmute was not sent to server
      assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);

      assert.isTrue(video.isMuted());
    });

    describe('#isLocallyMuted()', () => {
      it('does not consider remote mute status for audio', async () => {
        // simulate being already remote muted and locally unmuted
        meeting.remoteMuted = true;
        meeting.mediaProperties.audioStream.userMuted = false;

        // create a new MuteState instance
        audio = createMuteState(AUDIO, meeting, true);
        audio.handleLocalStreamChange(meeting);

        await testUtils.flushPromises();

        assert.isFalse(audio.isLocallyMuted());
      });

      it('does not consider remote mute status for video', async () => {
        // simulate being already remote muted
        meeting.remoteVideoMuted = true;
        meeting.mediaProperties.videoStream.userMuted = false;

        // create a new MuteState instance
        video = createMuteState(VIDEO, meeting, true);
        video.handleLocalStreamChange(meeting);

        await testUtils.flushPromises();

        assert.isFalse(video.isLocallyMuted());
      });
    });

    describe('handling local stream mute events', () => {
      beforeEach(async () => {
        audio.handleLocalStreamChange(meeting);
        video.handleLocalStreamChange(meeting);

        await testUtils.flushPromises();
      });

      const simulateAudioUserMuteChange = async (muteValue) => {
        meeting.mediaProperties.audioStream.userMuted = muteValue;
        audio.handleLocalStreamMuteStateChange(meeting);

        await testUtils.flushPromises();
      };

      const simulateAudioSystemMuteChange = async (muteValue) => {
        meeting.mediaProperties.audioStream.systemMuted = muteValue;
        audio.handleLocalStreamMuteStateChange(meeting);

        await testUtils.flushPromises();
      };

      const simulateVideoUserMuteChange = async (muteValue) => {
        meeting.mediaProperties.videoStream.userMuted = muteValue;
        video.handleLocalStreamMuteStateChange(meeting);

        await testUtils.flushPromises();
      };

      it('returns correct value in isMuted() methods after local stream is user muted/unmuted', async () => {
        // mute
        await simulateAudioUserMuteChange(true);
        assert.isTrue(audio.isMuted());

        // unmute
        await simulateAudioUserMuteChange(false);
        assert.isFalse(audio.isMuted());
      });

      it('returns correct value in isMuted() methods after local stream is system muted/unmuted', async () => {
        // mute
        await simulateAudioSystemMuteChange(true);
        assert.isTrue(audio.isMuted());

        // unmute
        await simulateAudioSystemMuteChange(false);
        assert.isFalse(audio.isMuted());
      });

      it('does remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await simulateAudioUserMuteChange(false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, true);

        assert.isFalse(audio.isMuted());
      });

      it('does video remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await simulateVideoUserMuteChange(false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, false);

        assert.isFalse(video.isMuted());
      });

      it('does not video remote unmute when unmuting and remote mute is off', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, false, true);

        // unmute
        await simulateVideoUserMuteChange(false);

        // check that remote unmute was not sent to server
        assert.notCalled(meeting.members.muteMember);

        assert.isFalse(video.isMuted());
      });

      it('calls setServerMuted with "clientRequestFailed" when server request for local mute fails', async () => {
        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().rejects(new Error('fake error'));

        await simulateAudioUserMuteChange(true);

        assert.calledOnceWithExactly(
          meeting.mediaProperties.audioStream.setServerMuted,
          false,
          'clientRequestFailed'
        );
      });

      it('calls setServerMuted with "clientRequestFailed" if server request for remote mute fails', async () => {
        // we only send remote mute requests when we're unmuting, so first we need to do a remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        await testUtils.flushPromises();

        // setup the stub to simulate server error response
        meeting.members.muteMember = sinon.stub().rejects();
        meeting.mediaProperties.audioStream.setServerMuted.resetHistory();

        await simulateAudioUserMuteChange(false);

        assert.calledOnceWithExactly(
          meeting.mediaProperties.audioStream.setServerMuted,
          true,
          'clientRequestFailed'
        );

        // even though remote mute update in the server failed, isMuted() should still return true,
        // because of local mute
        assert.isTrue(audio.isMuted());
      });

      it('does not send a server request if client state matches the server', async () => {
        let serverResponseResolve;

        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve) => {
            serverResponseResolve = resolve;
          })
        );

        // the stream is initially unmuted
        // simulate many mute changes with the last one matching the first one
        await simulateAudioUserMuteChange(true);
        await simulateAudioUserMuteChange(false);
        await simulateAudioUserMuteChange(true);
        await simulateAudioUserMuteChange(false);
        await simulateAudioUserMuteChange(true);

        // so far there should have been only 1 request to server (because our stub hasn't resolved yet
        // and MuteState sends only 1 server request at a time)
        assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now allow the server response to arrive for that initial request
        serverResponseResolve();
        await testUtils.flushPromises();

        // there should have not been any more server requests, because client state already matches the server state
        assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);
      });

      it('queues up server requests when multiple mute changes happen to local stream', async () => {
        let serverResponseResolve;

        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve) => {
            serverResponseResolve = resolve;
          })
        );

        // 2 client requests, one after another without waiting for first one to resolve
        await simulateAudioUserMuteChange(true);
        await simulateAudioUserMuteChange(false);

        assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);

        // now allow the first request to complete
        serverResponseResolve();
        await testUtils.flushPromises();

        // that should trigger the second server request to be sent
        assert.calledTwice(MeetingUtil.remoteUpdateAudioVideo);
        assert.deepEqual(
          [meeting, false, undefined],
          MeetingUtil.remoteUpdateAudioVideo.getCall(1).args
        );

        serverResponseResolve();
      });

      it('does not send remote mute for video', async () => {
        // mute
        await simulateVideoUserMuteChange(true);

        assert.isTrue(video.isMuted());

        // check local mute is done, but not remote one
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        assert.notCalled(meeting.members.muteMember);

        MeetingUtil.remoteUpdateAudioVideo.resetHistory();
        meeting.members.muteMember.resetHistory();

        // unmute
        await simulateVideoUserMuteChange(false);

        assert.isFalse(video.isMuted());

        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
        assert.notCalled(meeting.members.muteMember);
      });

      it('sends undefined value for the other media type when sending local mute', async () => {
        // make sure the meeting object has mute state machines for both audio and video
        meeting.audio = audio;
        meeting.video = video;

        // mute audio -> the call to remoteUpdateAudioVideo should have video undefined
        await simulateAudioUserMuteChange(true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now mute video -> the call to remoteUpdateAudioVideo should have unmute for video and undefined for audio
        await simulateVideoUserMuteChange(true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now unmute the audio -> the call to remoteUpdateAudioVideo should have video undefined
        await simulateAudioUserMuteChange(false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // unmute video -> the call to remoteUpdateAudioVideo should have audio undefined
        await simulateVideoUserMuteChange(false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
      });
    });

    describe('#init, #handleLocalStreamChange', () => {
      let meeting;
      let muteState;
      let setServerMutedSpy;
      let setUserMutedSpy, setUnmuteAllowedSpy;

      const setupMeeting = (
        mediaType,
        remoteMuted = false,
        userMuted = false,
        systemMuted = false,
        defineStreams = true
      ) => {
        const remoteMuteField = mediaType === AUDIO ? 'remoteMuted' : 'remoteVideoMuted';

        meeting = {
          mediaProperties: {
            audioStream: defineStreams
              ? createFakeLocalStream('fake audio stream', userMuted, systemMuted)
              : undefined,
            videoStream: defineStreams
              ? createFakeLocalStream('fake video stream', userMuted, systemMuted)
              : undefined,
          },
          [remoteMuteField]: remoteMuted,
          unmuteAllowed: true,
          unmuteVideoAllowed: true,

          locusInfo: {
            onFullLocus: sinon.stub(),
          },
          members: {
            selfId: 'fake self id',
            muteMember: sinon.stub().resolves(),
          },
        };
      };

      const setup = async (
        mediaType,
        remoteMuted = false,
        userMuted = false,
        systemMuted = false,
        defineStreams = true
      ) => {
        setupMeeting(mediaType, remoteMuted, userMuted, systemMuted, defineStreams);

        muteState = createMuteState(mediaType, meeting, true);
        muteState.handleLocalStreamChange(meeting);

        await testUtils.flushPromises();

        MeetingUtil.remoteUpdateAudioVideo.resetHistory();
      };

      const setupSpies = (mediaType) => {
        setUnmuteAllowedSpy =
          mediaType === AUDIO
            ? meeting.mediaProperties.audioStream?.setUnmuteAllowed
            : meeting.mediaProperties.videoStream?.setUnmuteAllowed;
        setServerMutedSpy =
          mediaType === AUDIO
            ? meeting.mediaProperties.audioStream?.setServerMuted
            : meeting.mediaProperties.videoStream?.setServerMuted;
        setUserMutedSpy =
          mediaType === AUDIO
            ? meeting.mediaProperties.audioStream?.setUserMuted
            : meeting.mediaProperties.videoStream?.setUserMuted;

        clearSpies();
      };

      const clearSpies = () => {
        setUnmuteAllowedSpy?.resetHistory();
        setServerMutedSpy?.resetHistory();
        setUserMutedSpy?.resetHistory();
      };

      const simulateUserMute = (mediaType, mute) => {
        if (mediaType === AUDIO) {
          meeting.mediaProperties.audioStream.userMuted = mute;
        } else {
          meeting.mediaProperties.videoStream.userMuted = mute;
        }
      };

      const simulateSystemMute = (mediaType, mute) => {
        if (mediaType === AUDIO) {
          meeting.mediaProperties.audioStream.systemMuted = mute;
        } else {
          meeting.mediaProperties.videoStream.systemMuted = mute;
        }
      };

      const tests = [
        {mediaType: AUDIO, title: 'audio'},
        {mediaType: VIDEO, title: 'video'},
      ];

      tests.forEach(({mediaType, title}) =>
        describe(title, () => {
          let originalRemoteUpdateAudioVideo;

          beforeEach(() => {
            originalRemoteUpdateAudioVideo = MeetingUtil.remoteUpdateAudioVideo;
            MeetingUtil.remoteUpdateAudioVideo = sinon.stub().resolves({info: 'fake locus'});
          });

          afterEach(() => {
            MeetingUtil.remoteUpdateAudioVideo = originalRemoteUpdateAudioVideo;
            sinon.restore();
          });

          describe('#handleLocalStreamChange', () => {
            it('calls init()', async () => {
              await setup(mediaType);
              const spy = sinon.spy(muteState, 'init');
              muteState.handleLocalStreamChange(meeting);
              assert.calledOnceWithExactly(spy, meeting);
            });
          });

          describe('#init', () => {
            // does the setup by calling new MuteState() so that MuteState.init() doesn't get called
            const setupWithoutInit = async (
              mediaType,
              remoteMuted = false,
              userMuted = false,
              systemMuted = false,
              defineStreams = true
            ) => {
              setupMeeting(mediaType, remoteMuted, userMuted, systemMuted, defineStreams);

              muteState = new MuteState(mediaType, meeting, true);
            };

            it('nothing goes bad when stream is undefined', async () => {
              await setupWithoutInit(mediaType, false, false, false, false);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.isTrue(muteState.state.client.localMute);
            });

            it('tests when stream user muted is true and remoteMuted is false', async () => {
              await setupWithoutInit(mediaType, false, true, false, true);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
              assert.notCalled(setServerMutedSpy);
              assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);
              assert.isTrue(muteState.state.client.localMute);
            });

            it('tests when stream system muted is true and remoteMuted is false', async () => {
              await setupWithoutInit(mediaType, false, false, true, true);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
              assert.notCalled(setServerMutedSpy);
              assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);
              assert.isTrue(muteState.state.client.localMute);
            });

            it('tests when both stream user muted and system muted are false and remoteMuted is false', async () => {
              await setupWithoutInit(mediaType, false, false, false, true);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
              assert.notCalled(setServerMutedSpy);
              assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
              assert.isFalse(muteState.state.client.localMute);
            });

            it('tests when remoteMuted is true', async () => {
              // testing that muteLocalStream is called
              await setupWithoutInit(mediaType, true, false, false, true);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
              assert.calledOnceWithExactly(setServerMutedSpy, true, 'remotelyMuted');
            });
          });

          describe('#handleLocalStreamMuteStateChange', () => {
            it('checks when ignoreMuteStateChange is true nothing changes', async () => {
              await setup(mediaType, false, false, false, true);
              muteState.ignoreMuteStateChange = true;

              simulateUserMute(mediaType, true);
              muteState.handleLocalStreamMuteStateChange(meeting);
              assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);

              assert.isFalse(muteState.state.client.localMute);
            });

            it('tests localMute - user mute from true to false', async () => {
              await setup(mediaType, false, true, false, true);

              simulateUserMute(mediaType, false);
              muteState.handleLocalStreamMuteStateChange(meeting);
              assert.equal(muteState.state.client.localMute, false);
              assert.called(MeetingUtil.remoteUpdateAudioVideo);
            });

            it('tests localMute - user mute from false to true', async () => {
              await setup(mediaType, false, false, false, true);

              simulateUserMute(mediaType, true);
              muteState.handleLocalStreamMuteStateChange(meeting);
              assert.equal(muteState.state.client.localMute, true);
              assert.called(MeetingUtil.remoteUpdateAudioVideo);
            });

            it('tests localMute - system mute from true to false', async () => {
              await setup(mediaType, false, false, true, true);

              simulateSystemMute(mediaType, false);
              muteState.handleLocalStreamMuteStateChange(meeting);
              assert.equal(muteState.state.client.localMute, false);
              assert.called(MeetingUtil.remoteUpdateAudioVideo);
            });

            it('tests localMute - system mute from false to true', async () => {
              await setup(mediaType, false, false, false, true);

              simulateSystemMute(mediaType, true);
              muteState.handleLocalStreamMuteStateChange(meeting);
              assert.equal(muteState.state.client.localMute, true);
              assert.called(MeetingUtil.remoteUpdateAudioVideo);
            });
          });

          describe('#applyClientStateLocally', () => {
            afterEach(() => {
              sinon.restore();
            });

            it('calls setServerMuted on the stream', async () => {
              await setup(mediaType);
              setupSpies(mediaType);

              muteState.applyClientStateLocally(meeting, 'somereason');
              assert.calledOnceWithExactly(
                setServerMutedSpy,
                muteState.state.client.localMute,
                'somereason'
              );
              assert.notCalled(setUserMutedSpy);
            });

            it('nothing explodes when streams are undefined', async () => {
              await setup(mediaType, false, false, false);
              setupSpies(mediaType);

              muteState.applyClientStateLocally(meeting, 'somereason');
            });
          });
        })
      );
    });
  });
});
