import EventsScope from '../common/events/events-scope';
import {EVENT_TRIGGERS, STATS} from '../constants';


/**
  * Meeting - network quality event
  * Emitted on each interval of retrieving stats Analyzer data
  * @event network:quality
  * @type {Object}
  * @property {string} mediaType {video|audio}
  * @property {number} networkQualityScore - value determined in determineUplinkNetworkQuality
  * @memberof NetworkQualityMonitor
  */
/**
 * NetworkQualityMonitor class that will emit events based on detected quality
 *
 * @class NetworkQualityMonitor
 * @extends {EventsScope}
 */
export default class NetworkQualityMonitor extends EventsScope {
  /**
   * Creates a new instance of NetworkQualityMonitor
   * @constructor
   * @public
   * @param {Object} config
   * @property {Object} indicatorTypes - network properties used to evaluate network quality used as constants
   * @property {Object} frequencyTypes - frequency properties used as constants {uplink|send} {downlink|receive}
   * @property {number} networkQualityScore  - 0|1 1 is acceptable 0 is bad/unknown
   * @property {Object} networkQualityStatus - hash object based on indicatorTypes and frequencyTypes
   * @property {string} mediaType - audio|video
   */
  constructor(config) {
    super();
    this.config = config;
    this.indicatorTypes = Object.freeze({
      PACKETLOSS: 'packetLoss',
      LATENCY: 'latency',
      JITTER: 'jitter'
    });
    this.frequencyTypes = Object.freeze({
      UPLINK: 'uplink',
      DOWNLINK: 'downlink'
    });
    this.networkQualityScore = 1;
    this.networkQualityStatus = {
      [this.frequencyTypes.UPLINK]: {
        [STATS.VIDEO_CORRELATE]: {},
        [STATS.AUDIO_CORRELATE]: {},
        [STATS.SHARE_CORRELATE]: {}
      }
    };
    this.mediaType = null;
  }

  /**
   * emits NETWORK_QUALITY event on meeting with payload of media type and uplinkNetworkQuality score
   *
   * @memberof NetworkQualityMonitor
   * @returns {void}
   */
  emitNetworkQuality() {
    this.emit(
      {
        file: 'networkQualityMonitor',
        function: 'emitNetworkQuality'
      },
      EVENT_TRIGGERS.NETWORK_QUALITY,
      {
        mediaType: this.mediaType,
        networkQualityScore: this.networkQualityScore
      }
    );
  }

  /**
   * invokes emitNetworkQuality method resets values back to default
   * @returns {void}
   * @memberof NetworkQualityMonitor
   */
  updateNetworkQualityStatus() {
    this.emitNetworkQuality();

    // reset values
    this.networkQualityScore = 1;
    this.mediaType = null;
  }


  /**
   * filter data to determine uplink network quality, invoked on same interval as stats analyzer remote-inbout-rtp
   * @param {Object} configObj
   * @param {string} configObj.mediaType {audio|video}
   * @param {RTCStats} configObj.remoteRtpResults RTC stats remote obj
   * @param {Object} configObj.statsAnalyzerCurrentStats statsResults
   * @returns {void}
   * @public
   * @memberof NetworkQualityMonitor
   */
  determineUplinkNetworkQuality({mediaType, remoteRtpResults, statsAnalyzerCurrentStats}) {
    const roundTripTimeInMilliseconds = remoteRtpResults.roundTripTime * 1000;
    const jitterInMilliseconds = remoteRtpResults.jitter * 1000;
    const {currentPacketLossRatio} = statsAnalyzerCurrentStats[mediaType].send;

    this.mediaType = mediaType;

    const {JITTER, PACKETLOSS, LATENCY} = this.indicatorTypes;
    const {UPLINK} = this.frequencyTypes;

    /**
     * determines if packetLoss ratio is over threshold set in config
     * sets networkQualityScore to 0 if over threshold
     * @returns {boolean}
     */
    const determinePacketLoss = () => {
      if (currentPacketLossRatio >
        this.config.videoPacketLossRatioThreshold) {
        this.networkQualityScore = 0;

        return false;
      }

      return true;
    };

    /**
     * determines if round trip time value is over threshold set in config
     * sets networkQualityScore to 0 if over threshold
     * @returns {boolean}
     */
    const determineLatency = () => {
      if (roundTripTimeInMilliseconds > this.config.rttThreshold) {
        this.networkQualityScore = 0;

        return false;
      }

      return true;
    };

    /**
     * determines if jitter value is over threshold in config
     * sets networkQualityScore to 0 if over threshold
     * @returns {boolean}
     */
    const deterMineJitter = () => {
      if (jitterInMilliseconds > this.config.jitterThreshold) {
        this.networkQualityScore = 0;

        return false;
      }

      return true;
    };

    /**
     * returns null if val is specifically undefined
     * @param {(number|undefined)} value
     * @returns {(number|null)}
     */
    const determineIfUndefined = (value) => (typeof value === 'undefined' ? null : value);

    /**
     * Values for some browsers specifically Safari will be undefined we explicitly set to null
     * https://bugs.webkit.org/show_bug.cgi?id=206645
     * https://bugs.webkit.org/show_bug.cgi?id=212668
     */
    // PACKET LOSS
    this.networkQualityStatus[UPLINK][mediaType][PACKETLOSS] = {
      acceptable: determinePacketLoss(),
      value: determineIfUndefined(currentPacketLossRatio)
    };


    // LATENCY measured in Round trip time
    this.networkQualityStatus[UPLINK][mediaType][LATENCY] = {
      acceptable: determineLatency(),
      value: determineIfUndefined(remoteRtpResults.roundTripTime)
    };

    // JITTER
    this.networkQualityStatus[UPLINK][mediaType][JITTER] = {
      acceptable: deterMineJitter(),
      value: determineIfUndefined(remoteRtpResults.jitter)
    };

    this.updateNetworkQualityStatus();
  }

  /**
   * Get the current status of network quaility object - networkQualityStatus
   * @returns {Object}
   * @public
   */
  get networkQualityStats() {
    const {UPLINK} = this.frequencyTypes;

    return this.networkQualityStatus[UPLINK];
  }
}
