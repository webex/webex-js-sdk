import AmpState from 'ampersand-state';

import {
  acceptAnswer,
  addStream,
  createOffer,
  end,
  ensureH264,
  getUserMedia,
  startSendingAudio,
  startSendingVideo,
  stopSendingAudio,
  stopSendingVideo
} from './webrtc';

// at some point, this could potentially move into webrtc.js, but it gets the
// job done for now.
const sending = {
  audio: {
    start: startSendingAudio,
    stop: stopSendingAudio
  },
  video: {
    start: startSendingVideo,
    stop: stopSendingVideo
  }
};

/**
 * Determines if the peer connection is receiving the specified kind of media
 * @param {string} kind audio|video
 * @param {RTCPeerConnection} pc
 * @returns {bool} true if receiving, false if not
 */
function getRemoteMediaStatus(kind, pc) {
  const streams = pc.getRemoteStreams();

  if (streams.length === 0) {
    return false;
  }

  const res = streams.reduce((areStreamsFlowing, stream) => {
    const tracks = stream.getTracks().filter((track) => track.kind === kind);

    if (tracks.length === 0) {
      return false;
    }

    return tracks.reduce((isTrackReceiving, track) => {
      if (isTrackReceiving) {
        return isTrackReceiving;
      }

      if (track.readyState === `ended`) {
        return false;
      }

      if (track.ended) {
        return false;
      }

      return true;
    }, undefined);
  }, undefined);

  if (res) {
    return res;
  }

  return false;
}

/**
 * Determines if the peer connection is sending the specified kind of media
 * @param {string} kind audio|video
 * @param {RTCPeerConnection} pc
 * @returns {bool} true if sending, false if not
 */
function getLocalMediaStatus(kind, pc) {
  const res = pc.getLocalStreams().reduce((isFlowing, stream) => {
    const isStreamFlowing = stream.getTracks().reduce((isFlowingForTracks, track) => {
      const isTrackFlowing = track.kind === kind && track.enabled;
      return isFlowingForTracks || isTrackFlowing;
    }, false);
    return isFlowing || isStreamFlowing;
  }, false);
  return res;
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
    return acceptAnswer(this.peer, answer)
      .then(() => {
        this.set({
          sendingAudio: getLocalMediaStatus(`audio`, this.peer),
          sendingVideo: getLocalMediaStatus(`video`, this.peer)
        });
      })
      .then(() => this.trigger(`answeraccepted`));
  },

  createOffer() {
    if (!this.peer) {
      this.peer = new RTCPeerConnection({iceServers: []});

      this.peer.ontrack = (event) => {
        this.remoteMediaStream = event.streams[0];

        this.remoteMediaStream.getTracks().forEach((track) => {
          track.onended = () => {
            try {
              if (track.kind === `audio`) {
                this.receivingAudio = getRemoteMediaStatus(`audio`, this.peer);
              }
              else {
                this.receivingVideo = getRemoteMediaStatus(`video`, this.peer);
              }
            }
            catch (e) {
              this.emit(`error`, e);
            }
          };
        });

        this.receivingAudio = getRemoteMediaStatus(`audio`, this.peer);
        this.receivingVideo = getRemoteMediaStatus(`video`, this.peer);
      };
    }

    let p;
    if (this.audio || this.video) {
      p = Promise.resolve(this.localMediaStream || getUserMedia({
        audio: this.audio,
        video: this.video,
        fake: true
      }))
        .then((stream) => {
          this.localMediaStream = stream;
          if (!this.peer.getLocalStreams().includes(stream)) {
            addStream(this.peer, stream);
          }
        });
    }

    return Promise.resolve(p)
      .then(() => createOffer(this.peer, {
        offerToReceiveAudio: this.offerToReceiveAudio,
        offerToReceiveVideo: this.offerToReceiveVideo
      }))
      .then(ensureH264(this.video))
      .then((sdp) => {
        this.bindNegotiationEvents();
        return sdp;
      });
  },

  end() {
    if (this.peer) {
      end(this.peer);
    }
  },

  initialize(...args) {
    Reflect.apply(AmpState.prototype.initialize, this, args);

    [
      `audio`,
      `video`
    ].forEach((mediaType) => {
      this.on(`change:${mediaType}`, () => {
        if (!this.peer) {
          return;
        }

        let p;
        if (this[mediaType]) {
          const hasTrack = this.localMediaStream
            .getTracks()
            // I really don't see a more readable way to implement this
            // eslint-disable-next-line max-nested-callbacks
            .filter((track) => track.kind === mediaType)
            .length;

          if (hasTrack) {
            p = sending[mediaType].start(this.peer);
          }
          else {
            p = new Promise((resolve) => {
              // I really don't see a more readable way to implement this
              // eslint-disable-next-line max-nested-callbacks
              this.once(`negotiationneeded`, () => {
                this.once(`answeraccepted`, resolve);
              });
            });
            sending[mediaType].start(this.peer);
          }
        }
        else {
          p = sending[mediaType].stop(this.peer);
        }

        Promise.resolve(p)
          .then(() => {
            this[mediaType === `audio` ? `sendingAudio` : `sendingVideo`] = getLocalMediaStatus(mediaType, this.peer);
          })
          .catch((reason) => {
            this.emit(`error`, reason);
          });
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
