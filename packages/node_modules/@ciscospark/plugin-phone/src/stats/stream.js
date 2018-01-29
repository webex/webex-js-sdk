/* eslint-disable require-jsdoc */

import {Readable} from 'stream';
import {EventEmitter} from 'events';

import {safeSetTimeout} from '@ciscospark/common-timers';

const emittersByPc = new WeakMap();
const pcsByEmitter = new WeakMap();
const emittersByStream = new WeakMap();
const timersByEmitter = new WeakMap();

/**
 * Helper function that ensures no matter how many stats streams we create, we
 * don't poll the PeerConnection more than once per interval.
 * @param {EventEmitter} emitter
 * @private
 * @returns {undefined}
 */
function schedule(emitter) {
  const timer = safeSetTimeout(() => {
    const pc = pcsByEmitter.get(emitter);
    pc.getStats()
      .then((stats) => {
        emitter.emit('data', stats);
        // "closed" is supposed to be part of the {@link RTCPeerConnectionState}
        // enum according to spec, but at time of writing, was still implemented
        // in the {@link RTCSignalingState} enum.
        if (!(pc.signalingState === 'closed' || pc.connectionState === 'closed')) {
          schedule(emitter);
        }
      })
      .catch((err) => {
        emitter.emit('error', err);
      });
  }, 1000);

  timersByEmitter.set(emitter, timer);
}

/**
 * Polls an {@link RTCPeerConnection} once per second and emits its
 * {@link RTCStatsReport}
 */
export default class StatsStream extends Readable {
  /**
   * @private
   * @param {RTCPeerConnection} pc
   */
  constructor(pc) {
    super({objectMode: true});

    if (!emittersByPc.has(pc)) {
      emittersByPc.set(pc, new EventEmitter());
    }
    const emitter = emittersByPc.get(pc);

    if (!emittersByStream.has(this)) {
      emittersByStream.set(this, emitter);
    }
    if (!pcsByEmitter.has(emitter)) {
      pcsByEmitter.set(emitter, pc);
    }

    emitter.once('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * See NodeJS Docs
   * @private
   * @returns {undefined}
   */
  _read() {
    const emitter = emittersByStream.get(this);

    emitter.once('data', (data) => {
      if (!this.isPaused()) {
        this.push(data);
      }
    });

    if (!timersByEmitter.has(emitter)) {
      schedule(emitter);
    }
  }
}

