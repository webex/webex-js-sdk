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

  const createFakeLocalTrack = (id) => {
    return {
      id,
      setMuted: sinon.stub(),
      setServerMuted: sinon.stub(),
      setUnmuteAllowed: sinon.stub(),
     };
  };

  beforeEach(async () => {
    meeting = {
      mediaProperties: {
        audioTrack: createFakeLocalTrack('fake audio track'),
        videoTrack: createFakeLocalTrack('fake video track'),
      },
      remoteMuted: false,
      unmuteAllowed: true,
      remoteVideoMuted: false,
      unmuteVideoAllowed: true,

      locusInfo: {
        onFullLocus: sinon.stub(),
      },
      members: {
        selfId: 'fake self id',
        muteMember: sinon.stub().resolves(),
      },
    };

    originalRemoteUpdateAudioVideo = MeetingUtil.remoteUpdateAudioVideo;

    MeetingUtil.remoteUpdateAudioVideo = sinon.stub().resolves(fakeLocus);

    audio = createMuteState(AUDIO, meeting, {sendAudio: true}, true);
    video = createMuteState(VIDEO, meeting, {sendVideo: true}, true);

    await testUtils.flushPromises();
  });

  afterEach(() => {
    MeetingUtil.remoteUpdateAudioVideo = originalRemoteUpdateAudioVideo;
  });

  describe('mute state library', () => {
    it('does not create an audio instance if we are not sending audio', async () => {
      assert.isNull(createMuteState(AUDIO, meeting, {sendAudio: false}, true));
      assert.isNull(createMuteState(AUDIO, meeting, {}, true));
    });

    it('does not create a video instance if we are not sending video', async () => {
      assert.isNull(createMuteState(VIDEO, meeting, {sendVideo: false}));
      assert.isNull(createMuteState(VIDEO, meeting, {}));
    });

    it('takes into account current remote mute status when instantiated', async () => {
      // simulate being already remote muted
      meeting.remoteMuted = true;

      // create a new MuteState instance
      audio = createMuteState(AUDIO, meeting, {sendAudio: true}, true);

      await testUtils.flushPromises();

      assert.isTrue(audio.isMuted());
      assert.isFalse(audio.isSelf());

      // now check the opposite case
      meeting.remoteMuted = false;

      // create a new MuteState instance
      audio = createMuteState(AUDIO, meeting, {sendAudio: true}, true);

      await testUtils.flushPromises();

      assert.isFalse(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    it('initialises correctly for video', async () => {
      // setup fields related to video remote state
      meeting.remoteVideoMuted = false;
      meeting.unmuteVideoAllowed = false;

      // create a new video MuteState instance
      video = createMuteState(VIDEO, meeting, {sendVideo: true}, true);

      await testUtils.flushPromises();

      assert.isFalse(video.isMuted());
      assert.isFalse(video.state.server.remoteMute);
      assert.isFalse(video.state.server.unmuteAllowed);
    });

    it('takes remote mute into account when reporting current state', async () => {
      assert.isFalse(audio.isMuted());

      // simulate remote mute
      audio.handleServerRemoteMuteUpdate(meeting, true, true);

      assert.isTrue(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    it('does local unmute if localAudioUnmuteRequired is received', async () => {
      // first we need to mute
      await audio.handleClientRequest(meeting, true);

      assert.isTrue(audio.isMuted());
      assert.isTrue(audio.isSelf());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      audio.handleServerLocalUnmuteRequired(meeting);
      await testUtils.flushPromises();

      // check that local track was unmuted
      assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, false);

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);

      assert.isFalse(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    it('rejects client request in progress if localAudioUnmuteRequired is received', async () => {
      let clientPromiseResolved = false;
      let clientPromiseRejected = false;

      // first we need to mute and make that request last forever
      let serverResponseResolve;

      MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
        new Promise((resolve) => {
          serverResponseResolve = resolve;
        })
      );

      audio
        .handleClientRequest(meeting, true)
        .then(() => {
          clientPromiseResolved = true;
        })
        .catch(() => {
          clientPromiseRejected = true;
        });

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      audio.handleServerLocalUnmuteRequired(meeting);
      await testUtils.flushPromises();

      // the original client request should have been rejected by now
      assert.isTrue(clientPromiseRejected);
      assert.isFalse(clientPromiseResolved);

      // now make the server respond to the original mute request
      serverResponseResolve();
      await testUtils.flushPromises();

      // local unmute should be sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);

      // and local track should be unmuted
      assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, false);

      assert.isFalse(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    it('does local video unmute if localVideoUnmuteRequired is received', async () => {
      // first we need to mute
      await video.handleClientRequest(meeting, true);

      assert.isTrue(video.isMuted());
      assert.isTrue(video.isSelf());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      video.handleServerLocalUnmuteRequired(meeting);
      await testUtils.flushPromises();

      // check that local track was unmuted
      assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, false);

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);

      assert.isFalse(video.isMuted());
      assert.isFalse(video.isSelf());
    });

    describe('#isLocallyMuted()', () => {
      it('does not consider remote mute status for audio', async () => {
        // simulate being already remote muted
        meeting.remoteMuted = true;
        // create a new MuteState instance
        audio = createMuteState(AUDIO, meeting, {sendAudio: true}, true);

        await testUtils.flushPromises();

        assert.isFalse(audio.isLocallyMuted());
      });

      it('does not consider remote mute status for video', async () => {
        // simulate being already remote muted
        meeting.remoteVideoMuted = true;
        // create a new MuteState instance
        video = createMuteState(VIDEO, meeting, {sendVideo: true}, true);

        await testUtils.flushPromises();

        assert.isFalse(video.isLocallyMuted());
      });
    });

    describe('#handleClientRequest', () => {
      it('disables/enables the local audio track when audio is muted/unmuted', async () => {
        // mute
        audio.handleClientRequest(meeting, true);
        assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, true);

        // even when calling mute when it's already muted should still call setMuted
        audio.handleClientRequest(meeting, true);
        assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, true);

        // unmute
        audio.handleClientRequest(meeting, false);
        assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, false);

        // even when calling unmute when it's already unmuted should still call setMuted
        audio.handleClientRequest(meeting, false);
        assert.calledWith(meeting.mediaProperties.audioTrack.setMuted, false);
      });

      it('disables/enables the local video track when video is muted/unmuted', async () => {
        // mute
        video.handleClientRequest(meeting, true);
        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, true);

        // even when calling mute when it's already muted should still call setMuted
        video.handleClientRequest(meeting, false);
        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, true);

        // unmute
        video.handleClientRequest(meeting, false);
        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, false);

        // even when calling unmute when it's already unmuted should still call setMuted
        video.handleClientRequest(meeting, false);
        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, false);
      });

      it('returns correct value in isMuted()/isSelf() methods after client mute/unmute requests', async () => {
        // mute
        audio.handleClientRequest(meeting, true);

        assert.isTrue(audio.isMuted());
        assert.isTrue(audio.isSelf());

        // unmute
        audio.handleClientRequest(meeting, false);

        assert.isFalse(audio.isMuted());
        assert.isFalse(audio.isSelf());
      });

      it('does remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await audio.handleClientRequest(meeting, false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, true);

        assert.isFalse(audio.isMuted());
        assert.isFalse(audio.isSelf());
      });

      it('does video remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await video.handleClientRequest(meeting, false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, false);

        assert.isFalse(video.isMuted());
        assert.isFalse(video.isSelf());
      });

      it('does not video remote unmute when unmuting and remote mute is off', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, false, true);

        // unmute
        await video.handleClientRequest(meeting, false);

        // check that remote unmute was sent to server
        assert.notCalled(meeting.members.muteMember);

        assert.isFalse(video.isMuted());
        assert.isFalse(video.isSelf());
      });

      it('resolves client request promise once the server is updated', async () => {
        let clientPromiseResolved = false;

        let serverResponseResolve;

        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve) => {
            serverResponseResolve = resolve;
          })
        );

        audio.handleClientRequest(meeting, true).then(() => {
          clientPromiseResolved = true;
        });

        // do a small delay to make sure that the client promise doesn't resolve in that time
        await testUtils.waitUntil(200);
        assert.isFalse(clientPromiseResolved);

        // now allow the server response to arrive, this should trigger the client promise to get resolved
        serverResponseResolve();
        await testUtils.flushPromises();

        assert.isTrue(clientPromiseResolved);
      });

      it('rejects client request promise if server request for local mute fails', async () => {
        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve, reject) => {
            reject();
          })
        );

        assert.isRejected(audio.handleClientRequest(meeting, true));
      });

      it('rejects client request promise if server request for remote mute fails', async () => {
        // we only send remote mute requests when we're unmuting, so first we need to do a remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        // setup the stub to simulate server error response
        meeting.members.muteMember = sinon.stub().rejects();

        // try to unmute - it should fail
        await assert.isRejected(audio.handleClientRequest(meeting, false));

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

        // simulate many client requests, with the last one matching the initial one
        audio.handleClientRequest(meeting, true);
        audio.handleClientRequest(meeting, false);
        audio.handleClientRequest(meeting, true);
        audio.handleClientRequest(meeting, false);
        audio.handleClientRequest(meeting, true);

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

      it('queues up server requests when multiple client requests are received', async () => {
        let serverResponseResolve;

        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve) => {
            serverResponseResolve = resolve;
          })
        );

        let firstClientPromiseResolved = false;
        let secondClientPromiseResolved = false;

        // 2 client requests, one after another without waiting for first one to resolve
        audio.handleClientRequest(meeting, true).then(() => {
          firstClientPromiseResolved = true;
        });
        audio.handleClientRequest(meeting, false).then(() => {
          secondClientPromiseResolved = true;
        });

        await testUtils.flushPromises();

        assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);

        // now allow the first request to complete
        serverResponseResolve();
        await testUtils.flushPromises();
        assert.isTrue(firstClientPromiseResolved);

        // that should trigger the second server request to be sent
        assert.calledTwice(MeetingUtil.remoteUpdateAudioVideo);
        assert.deepEqual([meeting, false, undefined], MeetingUtil.remoteUpdateAudioVideo.getCall(1).args);

        serverResponseResolve();
        await testUtils.flushPromises();

        assert.isTrue(secondClientPromiseResolved);
      });

      it('rejects client request to unmute if hard mute is used', (done) => {
        audio.handleServerRemoteMuteUpdate(meeting, true, false);

        audio
          .handleClientRequest(meeting, false)
          .then(() => {
            done(new Error('expected handleClientRequest to fail, but it did not!'));
          })
          .catch((e) => {
            assert.isTrue(e instanceof PermissionError);
            done();
          });
      });

      it('does not send remote mute for video', async () => {
        // mute
        await video.handleClientRequest(meeting, true);

        assert.isTrue(video.isMuted());
        assert.isTrue(video.isSelf());

        // check local mute is done, but not remote one
        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        assert.notCalled(meeting.members.muteMember);

        meeting.mediaProperties.videoTrack.setMuted.resetHistory();
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();
        meeting.members.muteMember.resetHistory();

        // unmute
        await video.handleClientRequest(meeting, false);

        assert.isFalse(video.isMuted());
        assert.isFalse(video.isSelf());

        assert.calledWith(meeting.mediaProperties.videoTrack.setMuted, false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
        assert.notCalled(meeting.members.muteMember);
      });

      it('sends undefined value for the other media type when sending local mute', async () => {
        // make sure the meeting object has mute state machines for both audio and video
        meeting.audio = audio;
        meeting.video = video;

        // mute audio -> the call to remoteUpdateAudioVideo should have video undefined
        await audio.handleClientRequest(meeting, true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now mute video -> the call to remoteUpdateAudioVideo should have mute for video and undefined for audio
        await video.handleClientRequest(meeting, true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now unmute the audio -> the call to remoteUpdateAudioVideo should have video undefined
        await audio.handleClientRequest(meeting, false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // unmute video -> the call to remoteUpdateAudioVideo should have both audio undefined
        await video.handleClientRequest(meeting, false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
      });
    });
  });
});

describe('#init, #handleLocalTrackChange', () => {
  let meeting;
  let muteState;
  let setServerMutedSpy;
  let setMutedSpy, setUnmuteAllowedSpy;
  const fakeLocus = {info: 'this is a fake locus'};

  const createFakeLocalTrack = (id, muted) => {
    return {
      id,
      setMuted: sinon.stub(),
      setServerMuted: sinon.stub(),
      setUnmuteAllowed: sinon.stub(),
      muted,
    };
  };

  const setupMeeting = (mediaType, remoteMuted = false, muted = false, defineTracks = true) => {
    const remoteMuteField = mediaType === AUDIO ? 'remoteMuted' : 'remoteVideoMuted';

    meeting = {
      mediaProperties: {
        audioTrack: defineTracks ? createFakeLocalTrack('fake audio track', muted) : undefined,
        videoTrack: defineTracks ? createFakeLocalTrack('fake video track', muted) : undefined,
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

  const setup = async (mediaType, remoteMuted = false, muted = false, defineTracks = true) => {

    setupMeeting(mediaType, remoteMuted, muted, defineTracks);

    const direction = mediaType === AUDIO ? {sendAudio: true} : {sendVideo: true};

    muteState = createMuteState(mediaType, meeting, direction, false);

    await testUtils.flushPromises();

    MeetingUtil.remoteUpdateAudioVideo.resetHistory();
  }

   const setupSpies = (mediaType) => {
    setUnmuteAllowedSpy = mediaType === AUDIO ? meeting.mediaProperties.audioTrack?.setUnmuteAllowed : meeting.mediaProperties.videoTrack?.setUnmuteAllowed;
    setServerMutedSpy = mediaType === AUDIO ? meeting.mediaProperties.audioTrack?.setServerMuted : meeting.mediaProperties.videoTrack?.setServerMuted;
    setMutedSpy = mediaType === AUDIO ? meeting.mediaProperties.audioTrack?.setMuted : meeting.mediaProperties.videoTrack?.setMuted;

    clearSpies();
  };

  const clearSpies = () => {
    setUnmuteAllowedSpy?.resetHistory();
    setServerMutedSpy?.resetHistory();
    setMutedSpy?.resetHistory();
  };
  const tests = [
    {mediaType: AUDIO, title: 'audio'},
    {mediaType: VIDEO, title: 'video'}
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

      describe('#handleLocalTrackChange',() => {

         it('calls init()', async () => {
          await setup(mediaType);
          const spy = sinon.spy(muteState, 'init');
          muteState.handleLocalTrackChange(meeting);
          assert.calledOnceWithExactly(spy, meeting);
        });
      });

      describe('#init', () => {

        // does the setup by calling new MuteState() so that MuteState.init() doesn't get called
        const setupWithoutInit = async (mediaType, remoteMuted = false, muted = false, defineTracks = true) => {

          setupMeeting(mediaType, remoteMuted, muted, defineTracks);

          muteState = new MuteState(mediaType, meeting, false);
        }

        it('nothing goes bad when track is undefined', async () => {
          await setupWithoutInit(mediaType, false, false, false);
          setupSpies(mediaType);

          muteState.init(meeting);

          assert.isFalse(muteState.state.client.localMute);
        });

        it('tests when track muted is true and remoteMuted is false', async () => {
          await setupWithoutInit(mediaType, false, true);
          setupSpies(mediaType);

          muteState.init(meeting);

          assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
          assert.notCalled(setServerMutedSpy);
          assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);
          assert.isTrue(muteState.state.client.localMute);
        });


        it('tests when track muted is false and remoteMuted is false', async () => {
          await setupWithoutInit(mediaType, false, false);
          setupSpies(mediaType);
          muteState.state.server.localMute = true;

          muteState.init(meeting);

          assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
          assert.notCalled(setServerMutedSpy);
          assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
          assert.isFalse(muteState.state.client.localMute);
        });

        it('tests when remoteMuted is true', async () => {
          // testing that muteLocalTrack is called
          await setupWithoutInit(mediaType, true);
          setupSpies(mediaType);

          muteState.init(meeting);

          assert.calledWith(setUnmuteAllowedSpy, muteState.state.server.unmuteAllowed);
          assert.calledOnceWithExactly(setServerMutedSpy, true, 'remotelyMuted');
        });
      });

      describe('#handleLocalTrackMuteStateChange', () => {

        it('checks when ignoreMuteStateChange is true nothing changes', async () => {
          await setup(mediaType, false, false);
          muteState.ignoreMuteStateChange = true;

          muteState.handleLocalTrackMuteStateChange(meeting, true);
          assert.notCalled(MeetingUtil.remoteUpdateAudioVideo);

          assert.isFalse(muteState.state.client.localMute);
        });

        it('tests localMute - true to false', async () => {
          await setup(mediaType, false, true);

          muteState.handleLocalTrackMuteStateChange(meeting, false);
          assert.equal(muteState.state.client.localMute, false);
          assert.called(MeetingUtil.remoteUpdateAudioVideo);
        });

        it('tests localMute - false to true', async () => {
          await setup(mediaType, false, false);

          muteState.handleLocalTrackMuteStateChange(meeting, true);
          assert.equal(muteState.state.client.localMute, true);
          assert.called(MeetingUtil.remoteUpdateAudioVideo);
        });
      });

      describe('#applyClientStateLocally', () => {

        afterEach(() => {
          sinon.restore();
        });

        it('checks when sdkOwnsLocalTrack is false', async () => {
          await setup(mediaType);
          setupSpies(mediaType);
          muteState.sdkOwnsLocalTrack= false;

          muteState.applyClientStateLocally(meeting, 'somereason');
          assert.calledOnceWithExactly(setServerMutedSpy, muteState.state.client.localMute, 'somereason');
          assert.notCalled(setMutedSpy);
        });

        it('checks when sdkOwnsLocalTrack is true', async () => {
          await setup(mediaType);
          setupSpies(mediaType);
          muteState.sdkOwnsLocalTrack= true;

          muteState.applyClientStateLocally(meeting, 'somereason');
          assert.notCalled(setServerMutedSpy);
          assert.calledOnceWithExactly(setMutedSpy, muteState.state.client.localMute);
        });

        it('checks nothing explodes when tracks are undefined', async () => {
          await setup(mediaType, false, false, false);
          setupSpies(mediaType);
          muteState.sdkOwnsLocalTrack= true;

          muteState.applyClientStateLocally(meeting, 'somereason');
        });
      });

    })
  );
});