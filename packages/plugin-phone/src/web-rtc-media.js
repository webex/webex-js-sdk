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
      .then(ensureH264(true))
      .then((sdp) => {
        this.bindNegotiationEvents();
        return sdp;
      });
  },

  initialize(...args) {
    Reflect.apply(AmpState.prototype.initialize, this, args);
    this.peer = new RTCPeerConnection({iceServers: []});

    this.on(`change:audio`, () => {
      this.audio ? startSendingAudio(this.peer) : stopSendingAudio(this.peer);
    });

    this.on(`change:video`, () => {
      this.video ? startSendingVideo(this.peer) : stopSendingVideo(this.peer);
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
