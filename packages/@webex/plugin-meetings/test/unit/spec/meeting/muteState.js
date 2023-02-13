import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import createMuteState from '@webex/plugin-meetings/src/meeting/muteState';
import Media from '@webex/plugin-meetings/src/media/index';
import PermissionError from '@webex/plugin-meetings/src/common/errors/permission';
import {AUDIO, VIDEO} from '@webex/plugin-meetings/src/constants';

import testUtils from '../../../utils/testUtils';

describe('plugin-meetings', () => {
  let meeting;
  let audio;
  let video;

  const fakeLocus = {info: 'this is a fake locus'};

  beforeEach(() => {
    meeting = {
      mediaProperties: {
        audioTrack: 'fake audio track',
        videoTrack: 'fake video track',
      },
      remoteMuted: false,
      unmuteAllowed: true,
      locusInfo: {
        onFullLocus: sinon.stub(),
      },
      members: {
        selfId: 'fake self id',
        muteMember: sinon.stub().resolves(),
      },
    };
    audio = createMuteState(AUDIO, meeting, {sendAudio: true});
    video = createMuteState(VIDEO, meeting, {sendVideo: true});

    MeetingUtil.remoteUpdateAudioVideo = sinon.stub().resolves(fakeLocus);
    Media.setLocalTrack = sinon.stub();
  });

  describe('mute state library', () => {
    it('does not create an audio instance if we are not sending audio', async () => {
      assert.isNull(createMuteState(AUDIO, meeting, {sendAudio: false}));
      assert.isNull(createMuteState(AUDIO, meeting, {}));
    });

    it('does not create a video instance if we are not sending video', async () => {
      assert.isNull(createMuteState(VIDEO, meeting, {sendVideo: false}));
      assert.isNull(createMuteState(VIDEO, meeting, {}));
    });

    it('takes into account current remote mute status when instantiated', async () => {
      // simulate being already remote muted
      meeting.remoteMuted = true;
      // create a new MuteState intance
      audio = createMuteState(AUDIO, meeting, {sendAudio: true});

      assert.isTrue(audio.isMuted());
      assert.isFalse(audio.isSelf());

      // now check the opposite case
      meeting.remoteMuted = false;

      // create a new MuteState intance
      audio = createMuteState(AUDIO, meeting, {sendAudio: true});

      assert.isFalse(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    it('initialises correctly for video', async () => {
      // setup fields related to audio remote state
      meeting.remoteMuted = true;
      meeting.unmuteAllowed = false;
      // create a new video MuteState intance
      video = createMuteState(VIDEO, meeting, {sendVideo: true});

      assert.isFalse(video.isMuted());
      assert.isFalse(video.state.server.remoteMute);
      assert.isTrue(video.state.server.unmuteAllowed);
    });

    it('takes remote mute into account when reporting current state', async () => {
      assert.isFalse(audio.isMuted());

      // simulate remote mute
      audio.handleServerRemoteMuteUpdate(true, true);

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

      // check that local track was enabled
      assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.audioTrack);

      // and local unmute was sent to server
      assert.calledOnce(MeetingUtil.remoteUpdateAudioVideo);
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, false, undefined, meeting);

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
      assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, false, undefined, meeting);

      // and local track should be enabled
      assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.audioTrack);

      assert.isFalse(audio.isMuted());
      assert.isFalse(audio.isSelf());
    });

    describe('#isLocallyMuted()', () => {
      it('does not consider remote mute status for audio', async () => {
        // simulate being already remote muted
        meeting.remoteMuted = true;
        // create a new MuteState intance
        audio = createMuteState(AUDIO, meeting, {sendAudio: true});

        assert.isFalse(audio.isLocallyMuted());
      });
    });

    describe('#handleClientRequest', () => {
      it('disables/enables the local audio track when audio is muted/unmuted', async () => {
        // mute
        audio.handleClientRequest(meeting, true);
        assert.calledWith(Media.setLocalTrack, false, meeting.mediaProperties.audioTrack);

        // even when calling mute when it's already muted should still call setLocalTrack
        audio.handleClientRequest(meeting, true);
        assert.calledWith(Media.setLocalTrack, false, meeting.mediaProperties.audioTrack);

        // unmute
        audio.handleClientRequest(meeting, false);
        assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.audioTrack);

        // even when calling unmute when it's already unmuted should still call setLocalTrack
        audio.handleClientRequest(meeting, false);
        assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.audioTrack);
      });

      it('disables/enables the local video track when video is muted/unmuted', async () => {
        // mute
        video.handleClientRequest(meeting, true);
        assert.calledWith(Media.setLocalTrack, false, meeting.mediaProperties.videoTrack);

        // even when calling mute when it's already muted should still call setLocalTrack
        video.handleClientRequest(meeting, false);
        assert.calledWith(Media.setLocalTrack, false, meeting.mediaProperties.videoTrack);

        // unmute
        video.handleClientRequest(meeting, false);
        assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.videoTrack);

        // even when calling unmute when it's already unmuted should still call setLocalTrack
        video.handleClientRequest(meeting, false);
        assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.videoTrack);
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
        audio.handleServerRemoteMuteUpdate(true, true);

        // unmute
        await audio.handleClientRequest(meeting, false);

        // check that remote unmute was sent to server
        assert.calledOnce(meeting.members.muteMember);
        assert.calledWith(meeting.members.muteMember, meeting.members.selfId, false);

        assert.isFalse(audio.isMuted());
        assert.isFalse(audio.isSelf());
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
        audio.handleServerRemoteMuteUpdate(true, true);

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
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, true, undefined, meeting);

        // now allow the first request to complete
        serverResponseResolve();
        await testUtils.flushPromises();
        assert.isTrue(firstClientPromiseResolved);

        // that should trigger the second server request to be sent
        assert.calledTwice(MeetingUtil.remoteUpdateAudioVideo);
        assert.strictEqual(false, MeetingUtil.remoteUpdateAudioVideo.getCall(1).args[0]);
        assert.strictEqual(undefined, MeetingUtil.remoteUpdateAudioVideo.getCall(1).args[1]);
        assert.strictEqual(meeting, MeetingUtil.remoteUpdateAudioVideo.getCall(1).args[2]);

        serverResponseResolve();
        await testUtils.flushPromises();

        assert.isTrue(secondClientPromiseResolved);
      });

      it('rejects client request to unmute if hard mute is used', (done) => {
        audio.handleServerRemoteMuteUpdate(true, false);

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
        assert.calledWith(Media.setLocalTrack, false, meeting.mediaProperties.videoTrack);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, undefined, true, meeting);
        assert.notCalled(meeting.members.muteMember);

        Media.setLocalTrack.resetHistory();
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();
        meeting.members.muteMember.resetHistory();

        // unmute
        await video.handleClientRequest(meeting, false);

        assert.isFalse(video.isMuted());
        assert.isFalse(video.isSelf());

        assert.calledWith(Media.setLocalTrack, true, meeting.mediaProperties.videoTrack);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, undefined, false, meeting);
        assert.notCalled(meeting.members.muteMember);
      });

      it('sends correct audio value when sending local mute for video', async () => {
        // make sure the meeting object has mute state machines for both audio and video
        meeting.audio = audio;
        meeting.video = video;

        // mute audio -> request sent to server should have video unmuted
        await audio.handleClientRequest(meeting, true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, true, false, meeting);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now mute video -> request sent to server should have mute for both audio and video
        await video.handleClientRequest(meeting, true);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, true, true, meeting);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // now unmute the audio -> request sent to server should still have video muted
        await audio.handleClientRequest(meeting, false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, false, true, meeting);
        MeetingUtil.remoteUpdateAudioVideo.resetHistory();

        // unmute video -> request sent to server should have both audio and video unmuted
        await video.handleClientRequest(meeting, false);
        assert.calledWith(MeetingUtil.remoteUpdateAudioVideo, false, false, meeting);
      });
    });
  });
});
