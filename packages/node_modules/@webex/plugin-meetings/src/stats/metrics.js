import {
  MEETINGS,
  STATS
} from '../constants';

/**
  * Metrics Payload Event
  * Emitted when a Metric Payload is available
  * @event metrics:payload
  * @instance
  * @type {Object}
  * @memberof MediaMetrics
  */

/**
 * @class MediaMetrics
 * @private
 */
export default class MediaMetrics {
  namespace = MEETINGS;

  /**
   * @param {Object} options
   * @param {Object} options.config
   * @memberof MediaMetrics
   * @constructor
   */
  constructor(options = {}) {
    this.config = options.config;
    this.stats = null;
  }

  /**
   * @param {MeetingStats} stats
   * @returns {undefined}
   * @memberof MediaMetrics
   */
  setStats(stats) {
    this.stats = stats;
  }

  /**
   * sets up all the default senders and receivers getStats to collect data
   * @returns {Object}
   * @public
   * @memberof MediaMetrics
   */
  initialize() {
    const mqa = this.config.metrics.autoSendMQA;

    return {
      useConfig: true,
      senders: [
        {
          id: STATS.AUDIO_SENDER_ID,
          correlate: STATS.AUDIO_CORRELATE,
          mqa,
          onData: () => {}
        },
        {
          id: STATS.VIDEO_SENDER_ID,
          correlate: STATS.VIDEO_CORRELATE,
          mqa,
          onData: () => {}
        },
        {
          id: STATS.SHARE_SENDER_ID,
          correlate: STATS.SHARE_CORRELATE,
          mqa,
          onData: () => {}
        }
      ],
      receivers: [
        {
          id: STATS.AUDIO_RECEIVER_ID,
          correlate: STATS.AUDIO_CORRELATE,
          mqa,
          onData: () => {}
        },
        {
          id: STATS.VIDEO_RECEIVER_ID,
          correlate: STATS.VIDEO_CORRELATE,
          mqa,
          onData: () => {}
        },
        {
          id: STATS.SHARE_RECEIVER_ID,
          correlate: STATS.SHARE_CORRELATE,
          mqa,
          onData: () => {}
        }
      ]
    };
  }
}
