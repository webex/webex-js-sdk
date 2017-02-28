import AmpState from 'ampersand-state';
import {
  acceptAnswer,
  addStream,
  createOffer,
  ensureH264,
  getUserMedia,
  startSendingAudio,
  startSendingVideo,
  stopSendingAudio,
  stopSendingVideo
} from './webrtc';

/**
 * Determines if the peer connection is sending the specified kind of media
 * @param {string} kind audio|video
 * @param {RTCPeerConnection} pc
 * @returns {bool} true if sending, false if not
 */
function getLocalMediaStatus(kind, pc) {
  return pc.getLocalStreams().reduce((sending, stream) => sending || stream.getTracks().reduce((trackSending, track) => trackSending || track.kind === kind && track.enabled, false), false);
}

const WebRTCMedia = AmpState.extend({
  props: {
    audio: {
      default: false,
      type: `boolean`
    },
    localMediaStream: {
      type: `object`
    },
    offerToReceiveAudio: {
      default: false,
      type: `boolean`
    },
    offerToReceiveVideo: {
      default: false,
      type: `boolean`
    },
    peer: {
      type: `object`
    },
    receivingAudio: {
      default: false,
      type: `boolean`
    },
    receivingVideo: {
      default: false,
      type: `boolean`
    },
    remoteMediaStream: {
      type: `object`
    },
    sendingAudio: {
      default: false,
      type: `boolean`
    },
    sendingVideo: {
      default: false,
      type: `boolean`
    },
    video: {
      default: false,
      type: `boolean`
    }
  },

  acceptAnswer(answer) {
    return acceptAnswer(this.peer, answer);
  },

  createOffer() {
    if (!this.peer) {
      this.peer = new RTCPeerConnection({iceServers: []});

      this.peer.ontrack = (event) => {
        // TODO does this fire when we add the local stream?
        this.remoteMediaStream = event.streams[0];
      };
    }

    const wantsVideo = this.video;
    return Promise.resolve(this.localMediaStream || getUserMedia({
      audio: this.audio,
      video: wantsVideo,
      fake: true
    }))
      .then((stream) => {
        this.localMediaStream = stream;

        return stream;
      })
      .then((stream) => addStream(this.peer, stream))
      .then(() => createOffer(this.peer, {
        offerToReceiveAudio: this.offerToReceiveAudio,
        offerToReceiveVideo: this.offerToReceiveVideo
      }))
      .then(ensureH264(wantsVideo))
      .then((sdp) => {
        this.set({
          sendingAudio: getLocalMediaStatus(`audio`, this.peer),
          sendingVideo: getLocalMediaStatus(`video`, this.peer)
        });
        this.bindNegotiationEvents();
        return sdp;
      });
  },

  initialize(...args) {
    Reflect.apply(AmpState.prototype.initialize, this, args);
    this.on(`change:audio`, () => {
      if (!this.peer) {
        return;
      }
      Promise.resolve(this.audio ? startSendingAudio(this.peer) : stopSendingAudio(this.peer))
        .then(() => {
          this.sendingAudio = getLocalMediaStatus(`audio`, this.peer);
        })
        .catch((reason) => {
          this.emit(`error`, reason);
        });
    });

    this.on(`change:video`, () => {
      if (!this.peer) {
        return;
      }
      Promise.resolve(this.video ? startSendingVideo(this.peer) : stopSendingVideo(this.peer))
        .then(() => {
          this.sendingVideo = getLocalMediaStatus(`video`, this.peer);
        })
        .catch((reason) => {
          this.emit(`error`, reason);
        });
    });

    this.on(`change:localMediaStream`, () => {
      // TODO introspect the stream and update audio/video accordingly
    });
  },

  /**
   * Binds events that should be bound one time only once the session has been
   * fully negotiated
   * @returns {undefined}
   */
  bindNegotiationEvents() {
    if (this.bound) {
      return;
    }
    this.bound = true;

    this.peer.onnegotiationneeded = () => {
      this.emit(`negotiationneeded`);
    };

    this.on(`change:offerToReceiveAudio`, () => {
      this.trigger(`negotiationneeded`);
    });

    this.on(`change:offerToReceiveVideo`, () => {
      this.trigger(`negotiationneeded`);
    });
  }

});

export default WebRTCMedia;
