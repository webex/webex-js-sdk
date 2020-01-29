import StatsAnalyzer from '../analyzer/analyzer';
import {
  DEFAULT_EVENT_VIDEO_SEND_KEYS,
  DEFAULT_EVENT_AUDIO_SEND_KEYS,
  DEFAULT_EVENT_AUDIO_RECEIVE_KEYS,
  DEFAULT_EVENT_VIDEO_RECEIVE_KEYS,
  EVENT_TYPES,
  EVENT_STATS_MAP,
  MEETINGS,
  AUDIO,
  VIDEO,
  ANALYSIS_CHECKS
} from '../constants';

/**
 * @param {Object} operate the filtered, parsed, converted, transformed, simplified data point to check against
 * @param {String} type - local or remote
 * @param {String} keys - the stat keys for types of stats defined by DEFAULT_TRANSFORM_REGEX
 * @param {String} stat - the accessor to get the actual stat
 * @param {String} kind - audio or video
 * @returns {Object} always whatever the first sentFirstVideoBytes were, in the past or if it happened now, or undefined if never
 * @private
 * @memberof StatsEvents
 */
const operateEvent = (operate, type, keys, stat, kind) => {
  const foundMatch = {};

  foundMatch.found = keys.some((key) => {
    if (operate[key] && operate[key][stat] && operate[key][stat] > 0) {
      foundMatch.match = {
        type,
        key,
        data: operate[key],
        stat,
        kind
      };

      return true;
    }

    return false;
  });

  return foundMatch;
};

/**
 * @export
 * @class StatsEvents
 */
export default class StatsEvents {
  namespace = MEETINGS;

  /**
   * constructs an instance
   * @constructor
   * @param {StatsHistory} series
   * @param {Function} callback
   * @memberof StatsEvents
   */
  constructor(series = null, callback = () => {}) {
    /**
     * @instance
     * @type {StatsHistory}
     * @private
     * @memberof StatsEvents
     */
    this.series = series;
    /**
     * @instance
     * @type {Function}
     * @private
     * @memberof StatsEvents
     */
    this.callback = callback;
    /**
     * @instance
     * @type {WebRTCData}
     * @private
     * @memberof StatsEvents
     */
    this.first = null;
    /**
     * @instance
     * @type {Boolean}
     * @private
     * @memberof StatsEvents
     */
    this.sendRemainStopped = false;
    /**
     * @instance
     * @type {Boolean}
     * @private
     * @memberof StatsEvents
     */
    this.recvRemainStopped = false;
  }

  /**
   * looks for data starting to flow through
   * @param {WebRTCData} data
   * @returns {Object}
   */
  start(data) {
    if (data && data.data && data.data.getData()) {
      const operate = data.data.getData();

      if (operate && !this.first) {
        const operator = [
          operateEvent(operate, EVENT_TYPES.LOCAL, DEFAULT_EVENT_AUDIO_SEND_KEYS, EVENT_STATS_MAP.BYTES_SENT, AUDIO),
          operateEvent(operate, EVENT_TYPES.LOCAL, DEFAULT_EVENT_VIDEO_SEND_KEYS, EVENT_STATS_MAP.BYTES_SENT, VIDEO),
          operateEvent(operate, EVENT_TYPES.REMOTE, DEFAULT_EVENT_VIDEO_RECEIVE_KEYS, EVENT_STATS_MAP.BYTES_RECEIVED, VIDEO),
          operateEvent(operate, EVENT_TYPES.REMOTE, DEFAULT_EVENT_AUDIO_RECEIVE_KEYS, EVENT_STATS_MAP.BYTES_RECEIVED, AUDIO)
        ];
        const somethingMatched = operator.find((element) => element && element.found && element.match);

        if (somethingMatched) {
          this.first = somethingMatched.match;
          this.callback(this.first);

          return somethingMatched;
        }
      }
    }

    return null;
  }

  /**
   * Looks for data to stop coming through
   * @returns {Object}
   */
  stop() {
    if (!this.series || this.series.get().length < 5) {
      return null;
    }
    const fiveSecondsData = this.series.getSlice(5);
    const prop = fiveSecondsData[0] && fiveSecondsData[0].rtpOutAudio || fiveSecondsData[0].rtpInAudio || fiveSecondsData[0].rtpInVideo || fiveSecondsData[0].rtpOutVideo;
    const sendAnalysis = StatsAnalyzer.analyze(fiveSecondsData, {analysisKeys: [{key: EVENT_STATS_MAP.BYTES_SENT, check: ANALYSIS_CHECKS.INCREASING, prop}]});
    const receiveAnalysis = StatsAnalyzer.analyze(fiveSecondsData, {analysisKeys: [{key: EVENT_STATS_MAP.BYTES_RECEIVED, check: ANALYSIS_CHECKS.INCREASING, prop}]});

    if (!sendAnalysis.valid && sendAnalysis.data.bytesSent.reports.length > 0) {
      if (!this.sendRemainStopped) {
        const ret = {stop: true, stat: EVENT_STATS_MAP.BYTES_SENT};

        this.callback(ret);
        this.sendRemainStopped = true;
        this.first = null;

        return ret;
      }
    }
    else if (sendAnalysis.valid && sendAnalysis.data.bytesSent.reports.length > 0) {
      this.sendRemainStopped = false;
    }
    if (!receiveAnalysis.valid && receiveAnalysis.data.bytesReceived.reports.length > 0) {
      if (!this.recvRemainStopped) {
        const ret = {stop: true, stat: EVENT_STATS_MAP.BYTES_RECEIVED};

        this.callback(ret);
        this.recvRemainStopped = true;
        this.first = null;

        return ret;
      }
    }
    else if (receiveAnalysis.valid && receiveAnalysis.data.bytesReceived.reports.length > 0) {
      this.recvRemainStopped = false;
    }

    return null;
  }

  /**
   * handles all the types of events that need to be sent when they happen from getStats API
   * @param {WebRTCData} data
   * @returns {Object}
   */
  event(data) {
    return {
      start: this.start(data),
      stop: this.stop()
    };
  }
}
