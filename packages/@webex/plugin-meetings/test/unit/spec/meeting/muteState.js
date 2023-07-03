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

  const createFakeLocalTrack = (id, muted) => {
    return {
      id,
      setMuted: sinon.stub(),
      setServerMuted: sinon.stub(),
      setUnmuteAllowed: sinon.stub(),
      muted,
    };
  };

  beforeEach(async () => {
    meeting = {
      mediaProperties: {
        audioTrack: createFakeLocalTrack('fake audio track', false),
        videoTrack: createFakeLocalTrack('fake video track', false),
      },
      remoteMuted: false,
      unmuteAllowed: true,
      remoteVideoMuted: false,
      unmuteVideoAllowed: true,

      locusInfo: {
        onDeltaLocus: sinon.stub(),
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

      assert.isTrue(audio.isMuted()); // because we start with no track
      assert.isFalse(audio.isRemotelyMuted());
    });

    it('initialises correctly for video', async () => {
      // setup fields related to video remote state
      meeting.remoteVideoMuted = false;
      meeting.unmuteVideoAllowed = false;

      // create a new video MuteState instance
      video = createMuteState(VIDEO, meeting, true);

      await testUtils.flushPromises();

      assert.isTrue(video.isMuted()); // because we start with no track
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

    it('does local unmute if localAudioUnmuteRequired is received', async () => {
      // first we need to mute have the local track muted
      meeting.mediaProperties.audioTrack.muted = true;
      audio.handleLocalTrackChange(meeting);

      assert.isTrue(audio.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      audio.handleServerLocalUnmuteRequired(meeting);
      await testUtils.flushPromises();

      // check that local track was unmuted
      assert.calledWith(meeting.mediaProperties.audioTrack.setServerMuted, false, 'localUnmuteRequired');

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);

      assert.isFalse(audio.isMuted());
    });

    it('does local video unmute if localVideoUnmuteRequired is received', async () => {
      // first we need to mute
      meeting.mediaProperties.videoTrack.muted = true;
      video.handleLocalTrackChange(meeting);

      assert.isTrue(video.isMuted());

      MeetingUtil.remoteUpdateAudioVideo.resetHistory();

      // now simulate server requiring us to locally unmute
      video.handleServerLocalUnmuteRequired(meeting);
      await testUtils.flushPromises();

      // check that local track was unmuted
      assert.calledWith(meeting.mediaProperties.videoTrack.setServerMuted, false, 'localUnmuteRequired');

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);

      assert.isFalse(video.isMuted());
    });

    describe('#isLocallyMuted()', () => {
      it('does not consider remote mute status for audio', async () => {
        // simulate being already remote muted
        meeting.remoteMuted = true;

        // create a new MuteState instance
        audio = createMuteState(AUDIO, meeting, true);
        audio.handleLocalTrackChange(meeting);

        await testUtils.flushPromises();

        assert.isFalse(audio.isLocallyMuted());
      });

      it('does not consider remote mute status for video', async () => {
        // simulate being already remote muted
        meeting.remoteVideoMuted = true;

        // create a new MuteState instance
        video = createMuteState(VIDEO, meeting, true);
        video.handleLocalTrackChange(meeting);

        await testUtils.flushPromises();

        assert.isFalse(video.isLocallyMuted());
      });
    });

    describe('handling local track mute events', () => {

      beforeEach(async () => {
        audio.handleLocalTrackChange(meeting);
        video.handleLocalTrackChange(meeting);

        await testUtils.flushPromises();
      });

      const simulateAudioMuteChange = async (muteValue) => {
        meeting.mediaProperties.audioTrack.muted = muteValue;
        audio.handleLocalTrackMuteStateChange(meeting, muteValue);

        await testUtils.flushPromises();
      }

      const simulateVideoMuteChange = async (muteValue) => {
        meeting.mediaProperties.videoTrack.muted = muteValue;
        video.handleLocalTrackMuteStateChange(meeting, muteValue);

        await testUtils.flushPromises();
      }

      it('returns correct value in isMuted() methods after local track is muted/unmuted', async () => {
        // mute
        await simulateAudioMuteChange(true);
        assert.isTrue(audio.isMuted());

        // unmute
        await simulateAudioMuteChange(false);
        assert.isFalse(audio.isMuted());
      });

      it('does remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await simulateAudioMuteChange(false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, true);

        assert.isFalse(audio.isMuted());
      });

      it('does video remote unmute when unmuting and remote mute is on', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, true, true);

        // unmute
        await simulateVideoMuteChange(false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false, false);

        assert.isFalse(video.isMuted());
      });

      it('does not video remote unmute when unmuting and remote mute is off', async () => {
        // simulate remote mute
        video.handleServerRemoteMuteUpdate(meeting, false, true);

        // unmute
        await simulateVideoMuteChange(false);

        // check that remote unmute was not sent to server
        assert.notCalled(meeting.members.muteMember);

        assert.isFalse(video.isMuted());
      });

      it('calls setServerMuted with "clientRequestFailed" when server request for local mute fails', async () => {
        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().rejects(new Error('fake error'));

        await simulateAudioMuteChange(true);

        assert.calledOnceWithExactly(meeting.mediaProperties.audioTrack.setServerMuted , false, 'clientRequestFailed');
      });

      it('calls setServerMuted with "clientRequestFailed" if server request for remote mute fails', async () => {
        // we only send remote mute requests when we're unmuting, so first we need to do a remote mute
        audio.handleServerRemoteMuteUpdate(meeting, true, true);

        await testUtils.flushPromises();

        // setup the stub to simulate server error response
        meeting.members.muteMember = sinon.stub().rejects();
        meeting.mediaProperties.audioTrack.setServerMuted.resetHistory();

        await simulateAudioMuteChange(false);

        assert.calledOnceWithExactly(meeting.mediaProperties.audioTrack.setServerMuted , true, 'clientRequestFailed');

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

        // the track is initially unmuted
        // simulate many mute changes with the last one matching the first one
        await simulateAudioMuteChange(true);
        await simulateAudioMuteChange(false);
        await simulateAudioMuteChange(true);
        await simulateAudioMuteChange(false);
        await simulateAudioMuteChange(true);

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

      it('queues up server requests when multiple mute changes happen to local track', async () => {
        let serverResponseResolve;

        MeetingUtil.remoteUpdateAudioVideo = sinon.stub().returns(
          new Promise((resolve) => {
            serverResponseResolve = resolve;
          })
        );

        // 2 client requests, one after another without waiting for first one to resolve
        await simulateAudioMuteChange(true);
        await simulateAudioMuteChange(false);

        assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);

        // now allow the first request to complete
        serverResponseResolve();
        await testUtils.flushPromises();

        // that should trigger the second server request to be sent
        assert.calledTwice(MeetingUtil.remoteUpdateAudioVideo);
        assert.deepEqual([meeting, false, undefined], MeetingUtil.remoteUpdateAudioVideo.getCall(1).args);

        serverResponseResolve();
      });

      it('does not send remote mute for video', async () => {
        // mute
        await simulateVideoMuteChange(true);

        assert.isTrue(video.isMuted());

        // check local mute is done, but not remote one
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        assert.notCalled(meeting.members.muteMember);

        MeetingUtil.remoteUpdateAudioVideo.resetHistory();
        meeting.members.muteMember.resetHistory();

        // unmute
        await simulateVideoMuteChange(false);

        assert.isFalse(video.isMuted());

        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
        assert.notCalled(meeting.members.muteMember);
      });

      it('sends undefined value for the other media type when sending local mute', async () => {
        // make sure the meeting object has mute state machines for both audio and video
        meeting.audio = audio;
        meeting.video = video;

        // mute audio -> the call to remoteUpdateAudioVideo should have video undefined
        await simulateAudioMuteChange(true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, true, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now mute video -> the call to remoteUpdateAudioVideo should have mute for video and undefined for audio
        await simulateVideoMuteChange(true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, true);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now unmute the audio -> the call to remoteUpdateAudioVideo should have video undefined
        await simulateAudioMuteChange(false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, false, undefined);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // unmute video -> the call to remoteUpdateAudioVideo should have both audio undefined
        await simulateVideoMuteChange(false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, meeting, undefined, false);
      });
    });

    describe('#init, #handleLocalTrackChange', () => {
      let meeting;
      let muteState;
      let setServerMutedSpy;
      let setMutedSpy, setUnmuteAllowedSpy;

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

        muteState = createMuteState(mediaType, meeting, true);
        muteState.handleLocalTrackChange(meeting);

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

              muteState = new MuteState(mediaType, meeting, true);
            }

            it('nothing goes bad when track is undefined', async () => {
              await setupWithoutInit(mediaType, false, false, false);
              setupSpies(mediaType);

              muteState.init(meeting);

              assert.isTrue(muteState.state.client.localMute);
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

            it('calls setServerMuted on the track', async () => {
              await setup(mediaType);
              setupSpies(mediaType);

              muteState.applyClientStateLocally(meeting, 'somereason');
              assert.calledOnceWithExactly(setServerMutedSpy, muteState.state.client.localMute, 'somereason');
              assert.notCalled(setMutedSpy);
            });

            it('nothing explodes when tracks are undefined', async () => {
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
