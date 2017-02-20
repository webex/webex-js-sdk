import AmpState from 'ampersand-state';

import {
  acceptAnswer,
  addStream,
  createOffer,
  getUserMedia,
  mediaDirection,
  startReceivingAudio,
  startReceivingVideo,
  startSendingAudio,
  startSendingVideo,
  stopReceivingAudio,
  stopReceivingVideo,
  stopSendingAudio,
  stopSendingVideo
} from './webrtc';

const Media = AmpState.extend({
  props: {
    localMediaStream: {
      type: `object`
    },
    pc: {
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
    renegotiate: {
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
    }
  },

  derived: {
    constraints: {
      deps: [
        `sendingAudio`,
        `sendingVideo`,
        `receivingAudio`,
        `receivingVideo`
      ],
      fn() {
        return {
          audio: this.sendingAudio,
          video: this.sendingVideo
        };
      }
    },

    localAudioDirection: {
      cache: false,
      deps: [`pc`],
      fn() {
        return mediaDirection(`audio`, this.pc).toLowerCase();
      }
    },

    localVideoDirection: {
      cache: false,
      deps: [`pc`],
      fn() {
        return mediaDirection(`video`, this.pc).toLowerCase();
      }
    },

    offerOptions: {
      deps: [
        `receivingAudio`,
        `receivingVideo`
      ],
      fn() {
        return {
          offerToReceiveAudio: this.receivingAudio,
          offerToReceiveVideo: this.receivingVideo
        };
      }
    },

    wantsVideo: {
      deps: [
        `sendingVideo`,
        `receivingVideo`
      ],
      fn() {
        return this.sendingVideo || this.receivingVideo;
      }
    }
  },

  initialize(...args) {
    this.pc = new RTCPeerConnection({iceServers: []});
    Reflect.apply(AmpState.prototype.initialize, this, args);
  },

  createOffer() {
    let promise;
    if (!this.localMediaStream && this.constraints.audio || this.constraints.video) {
      promise = getUserMedia(this.constraints)
        .then((stream) => {
          this.localMediaStream = stream;
        });
    }

    return Promise.resolve(promise)
      .then(() => {
        try {
          if (this.localMediaStream) {
            addStream(this.pc, this.localMediaStream);
          }
        }
        catch (err) {
            // ignore: addStream throws if we try to add the same stream
        }
      })
      .then(() => createOffer(this.pc, this.offerOptions))
      .then((offer) => {
        if (!this.pc.onnegotiationneeded) {
          this.pc.onnegotiationneeded = () => {
            this.renegotiate = true;
          };
        }
        this.renegotiate = false;
        if (this.wantsVideo) {
          if (!offer.includes(`m=video`)) {
            throw new Error(`No video section found in offer`);
          }
          if (!/[hH]264/.test(offer)) {
            throw new Error(`Offer does not include h264 codec`);
          }
        }
        return offer;
      });
  },

  acceptAnswer(answer) {
    return acceptAnswer(this.pc, answer);
  },

  toggleReceivingAudio() {
    if (this.receivingAudio) {
      stopReceivingAudio(this.pc);
    }
    else {
      startReceivingAudio(this.pc);
    }
    this.toggle(`receivingAudio`);
    this.renegotiate = true;
  },

  toggleReceivingVideo() {
    if (this.receivingAudio) {
      stopReceivingVideo(this.pc);
    }
    else {
      startReceivingVideo(this.pc);
    }
    this.toggle(`receivingVideo`);
    this.renegotiate = true;
  },

  toggleSendingAudio() {
    if (this.sendingAudio) {
      stopSendingAudio(this.pc);
    }
    else {
      startSendingAudio(this.pc);
    }
    this.toggle(`sendingAudio`);
    this.renegotiate = true;
  },

  toggleSendingVideo() {
    if (this.sendingVideo) {
      stopSendingVideo(this.pc);
    }
    else {
      startSendingVideo(this.pc);
    }
    this.toggle(`sendingVideo`);
    this.renegotiate = true;
  }
});

export default Media;
