import AmpState from 'ampersand-state';

import {
  addStream,
  createOffer,
  getUserMedia,
  mediaDirection
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

  createOffer() {
    if (!this.pc) {
      this.pc = this.pc = new RTCPeerConnection({iceServers: []});
    }

    let promise;
    if (!this.localMediaStream && this.constraints.audio || this.constraints.video) {
      promise = getUserMedia(this.constraints)
        .then((stream) => {
          this.localMediaStream = stream;
        });
    }

    return Promise.resolve(promise)
      .then(() => this.localMediaStream && addStream(this.pc, this.localMediaStream))
      .then(() => createOffer(this.pc, this.offerOptions))
      .then((offer) => {
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

  acceptAnswer() {

  },

  toggleReceivingAudio() {
    this.toggle(`receivingAudio`);
  },

  toggleReceivingVideo() {
    this.toggle(`receivingVideo`);
  },

  toggleSendingAudio() {
    this.toggle(`sendingAudio`);
  },

  toggleSendingVideo() {
    this.toggle(`sendingVideo`);
  }
});

export default Media;
