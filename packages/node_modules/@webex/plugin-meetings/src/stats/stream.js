import {EventEmitter} from 'events';

import {Readable} from 'readable-stream';
import {safeSetTimeout} from '@webex/common-timers';

import {
  ERROR,
  STATS
} from '../constants';

const pcsByRTCRtpDirection = new WeakMap();
const emittersByRTCRtpDirection = new WeakMap();
const RTCRtpDirectionByEmitter = new WeakMap();
const emittersByStream = new WeakMap();
const timersByEmitter = new WeakMap();

/**
 * Helper function that ensures no matter how many stats streams we create, we
 * don't poll the PeerConnection more than once per interval.
 * @param {EventEmitter} emitter
 * @param {Number} interval
 * @private
 * @returns {undefined}
 */
const schedule = (emitter, interval) => {
  const timer = safeSetTimeout(() => {
    const direction = RTCRtpDirectionByEmitter.get(emitter);
    const pc = pcsByRTCRtpDirection.get(direction);

    if (direction) {
      direction.getStats()
        .then((stats) => {
          emitter.emit(STATS.DATA, stats);
          // TODO: Remove on 1.0 spec adoption
          // "closed" is supposed to be part of the {@link RTCPeerConnectionState}
          // enum according to spec, but at time of writing, was still implemented
          // in the {@link RTCSignalingState} enum.
          if (!(pc.signalingState === STATS.CLOSED || pc.connectionState === STATS.CLOSED)) {
            schedule(emitter, interval);
          }
        })
        .catch((err) => {
          emitter.emit(ERROR, err);
        });
    }
  }, interval);

  timersByEmitter.set(emitter, timer);
};

/**
 * Polls an {@link RTCPeerConnection} once per second and emits its {@link RTCStatsReport}
 * {@link RTCStatsReport}
 */
export default class StatsStream extends Readable {
  /**
   * @private
   * @param {Object} config
   * @param {RTCRtpSender|RTCRtpReceiver} config.rTCRtpDirection
   * @param {RTCPeerConnection} config.peerConnection
   * @param {Number} config.interval
   */
  constructor(config = {}) {
    super({objectMode: true});

    this.interval = config.interval;

    if (!emittersByRTCRtpDirection.has(config.rTCRtpDirection)) {
      emittersByRTCRtpDirection.set(config.rTCRtpDirection, new EventEmitter());
    }
    const emitter = emittersByRTCRtpDirection.get(config.rTCRtpDirection);

    if (!emittersByStream.has(this)) {
      emittersByStream.set(this, emitter);
    }
    if (!RTCRtpDirectionByEmitter.has(emitter)) {
      RTCRtpDirectionByEmitter.set(emitter, config.rTCRtpDirection);
    }

    if (!pcsByRTCRtpDirection.has(config.rTCRtpDirection)) {
      pcsByRTCRtpDirection.set(config.rTCRtpDirection, config.peerConnection);
    }

    emitter.once(ERROR, (err) => {
      this.emit(ERROR, err);
    });
  }

  /**
   * See NodeJS Docs
   * @private
   * @returns {undefined}
   */
  _read() {
    const emitter = emittersByStream.get(this);

    emitter.once(STATS.DATA, (data) => {
      if (!this.isPaused()) {
        this.push(data);
      }
    });

    if (!timersByEmitter.has(emitter)) {
      schedule(emitter, this.interval);
    }
  }
}

