import {cloneDeep} from 'lodash';

import EventsScope from '../common/events/events-scope';
import {DEFAULT_GET_STATS_FILTER, CONNECTION_STATE, STATS, MQA_INTEVAL, NETWORK_TYPE, MEDIA_DEVICES, _UNKNOWN_} from '../constants';
import mqaData from '../mediaQualityMetrics/config';
import LoggerProxy from '../common/logs/logger-proxy';

import defaultStats from './global';
import {
  getAudioSenderMqa,
  getAudioReceiverMqa,
  getVideoSenderMqa,
  getVideoReceiverMqa
} from './mqaUtil';

export const EVENTS = {
  MEDIA_QUALITY: 'MEDIA_QUALITY',
  LOCAL_MEDIA_STARTED: 'LOCAL_MEDIA_STARTED',
  LOCAL_MEDIA_STOPPED: 'LOCAL_MEDIA_STOPPED',
  REMOTE_MEDIA_STARTED: 'REMOTE_MEDIA_STARTED',
  REMOTE_MEDIA_STOPPED: 'REMOTE_MEDIA_STOPPED',
};

/**
 * Stats Analyzer class that will emit events based on detected quality
 *
 * @export
 * @class StatsAnalyzer
 * @extends {EventsScope}
 */
export class StatsAnalyzer extends EventsScope {
  /**
   * Creates a new instance of StatsAnalyzer
   * @constructor
   * @public
   * @param {Object} config SDK Configuration Object
   * @param {Object} networkQualityMonitor class for assessing network characteristics (jitter, packetLoss, latency)
   * @param {Object} statsResults Default properties for stats
   */
  constructor(config, networkQualityMonitor = {}, statsResults = defaultStats) {
    super();
    this.statsStarted = false;
    this.statsResults = statsResults;
    this.lastStatsResults = null;
    this.config = config;
    this.networkQualityMonitor = networkQualityMonitor;
    this.correlationId = config.correlationId;
    this.mqaSentCount = -1;
    this.lastMqaDataSent = {
      resolutions: {video: {send: {}, recv: {}}, audio: {send: {}, recv: {}}, share: {send: {}, recv: {}}},
      video: {send: {}, recv: {}},
      audio: {send: {}, recv: {}},
      share: {send: {}, recv: {}}
    };
    this.localMQEStats = {
      audio: {
        RX: {
          packetsLost: [],
          jitter: [],
          latency: [],
          bitRate: []
        },
        TX: {
          packetsLost: [],
          jitter: [],
          latency: [],
          bitRate: []
        }
      },
      video: {
        RX: {
          packetsLost: [],
          jitter: [],
          latency: [],
          bitRate: [],
          frameRate: [],
          resolutionWidth: [],
          resolutionHeight: [],
          requestedKeyFrame: [],
          receivedKeyFrame: []
        },
        TX: {
          packetsLost: [],
          jitter: [],
          latency: [],
          bitRate: [],
          frameRate: [],
          resolutionWidth: [],
          resolutionHeight: [],
          requestedKeyFrame: [],
          receivedKeyFrame: []
        }
      }
    };
    this.lastEmittedStartStopEvent = {
      audio: {
        local: undefined,
        remote: undefined,
      },
      video: {
        local: undefined,
        remote: undefined,
      },
      share: {
        local: undefined,
        remote: undefined,
      },
    };
  }

  populateResults(lastMqa) {
    // Audio

    this.localMQEStats.audio.RX.packetsLost.push(lastMqa.audioReceive[0].common.mediaHopByHopLost);
    this.localMQEStats.audio.RX.jitter.push(lastMqa.audioReceive[0].streams[0].common.rtpJitter);
    this.localMQEStats.audio.RX.latency.push(lastMqa.audioReceive[0].common.roundTripTime);
    this.localMQEStats.audio.RX.bitRate.push(lastMqa.audioReceive[0].streams[0].common.receivedBitrate);

    this.localMQEStats.audio.TX.packetsLost.push(lastMqa.audioTransmit[0].common.remoteLossRate);
    this.localMQEStats.audio.TX.jitter.push(lastMqa.audioTransmit[0].common.remoteJitter);
    this.localMQEStats.audio.TX.latency.push(lastMqa.audioTransmit[0].common.roundTripTime);
    this.localMQEStats.audio.TX.bitRate.push(lastMqa.audioTransmit[0].streams[0].common.transmittedBitrate);

    // Video

    this.localMQEStats.video.RX.packetsLost.push(lastMqa.videoReceive[0].common.mediaHopByHopLost);
    this.localMQEStats.video.RX.jitter.push(lastMqa.videoReceive[0].streams[0].common.rtpJitter);
    this.localMQEStats.video.RX.latency.push(lastMqa.videoReceive[0].streams[0].common.roundTripTime);
    this.localMQEStats.video.RX.bitRate.push(lastMqa.videoReceive[0].streams[0].common.receivedBitrate);
    this.localMQEStats.video.RX.frameRate.push(lastMqa.videoReceive[0].streams[0].common.receivedFrameRate);
    this.localMQEStats.video.RX.resolutionWidth.push(lastMqa.videoReceive[0].streams[0].receivedWidth);
    this.localMQEStats.video.RX.resolutionHeight.push(lastMqa.videoReceive[0].streams[0].receivedHeight);
    this.localMQEStats.video.RX.requestedKeyFrame.push();
    this.localMQEStats.video.RX.receivedKeyFrame.push();

    this.localMQEStats.video.TX.packetsLost.push(lastMqa.videoTransmit[0].common.remoteLossRate);
    this.localMQEStats.video.TX.jitter.push(lastMqa.videoTransmit[0].common.remoteJitter);
    this.localMQEStats.video.TX.latency.push(lastMqa.videoTransmit[0].common.roundTripTime);
    this.localMQEStats.video.TX.bitRate.push(lastMqa.videoTransmit[0].streams[0].common.transmittedBitrate);
    this.localMQEStats.video.TX.frameRate.push(lastMqa.videoTransmit[0].streams[0].common.transmittedFrameRate);
    this.localMQEStats.video.TX.resolutionWidth.push(lastMqa.videoTransmit[0].streams[0].transmittedWidth);
    this.localMQEStats.video.TX.resolutionHeight.push(lastMqa.videoTransmit[0].streams[0].transmittedHeight);
    this.localMQEStats.video.TX.requestedKeyFrame.push(lastMqa.videoTransmit[0].streams[0].requestedKeyFrames);
    this.localMQEStats.video.TX.receivedKeyFrame.push();
  }


  resetStatsResults() {
    this.statsResults.audio.send.meanRemoteJitter = [];
    this.statsResults.video.send.meanRemoteJitter = [];
    this.statsResults.share.send.meanRemoteJitter = [];

    this.statsResults.audio.recv.meanRtpJitter = [];

    // TODO: currently no values are present
    this.statsResults.video.recv.meanRtpJitter = [];
    this.statsResults.share.recv.meanRtpJitter = [];

    // Reset the roundTripTime
    this.statsResults.audio.send.meanRoundTripTime = [];
    this.statsResults.video.send.meanRoundTripTime = [];
    this.statsResults.share.send.meanRoundTripTime = [];
  }

  /**
   * sets mediaStatus status for analyzing metrics
   *
   * @public
   * @param {Object} status for the audio and video
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  updateMediaStatus(status) {
    this.meetingMediaStatus = status;
  }

  /**
   * captures MQA data from peerconnection
   *
   * @public
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  sendMqaData() {
    const audioReceiver = mqaData.intervals[0].audioReceive[0];
    const audioSender = mqaData.intervals[0].audioTransmit[0];
    const videoReceiver = mqaData.intervals[0].videoReceive[0];
    const videoSender = mqaData.intervals[0].videoTransmit[0];
    const shareSender = mqaData.intervals[0].videoTransmit[1];
    const shareReceiver = mqaData.intervals[0].videoReceive[1];

    getAudioSenderMqa({
      audioSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent
    });
    getAudioReceiverMqa({
      audioReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent
    });

    getVideoReceiverMqa({
      videoReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent
    });
    getVideoSenderMqa({
      videoSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent
    });

    // Capture mqa for share scenario

    getVideoSenderMqa({
      videoSender: shareSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      isShareStream: true
    });

    getVideoReceiverMqa({
      videoReceiver: shareReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      isShareStream: true
    });

    mqaData.intervals[0].intervalMetadata.peerReflexiveIP = this.statsResults.connectionType.local.ipAddress[0];

    // Adding peripheral information
    mqaData.intervals[0].intervalMetadata.peripherals = [];
    mqaData.intervals[0].intervalMetadata.peripherals.push({information: _UNKNOWN_, name: MEDIA_DEVICES.SPEAKER});
    mqaData.intervals[0].intervalMetadata.peripherals.push({information: this.peerConnection?.audioTransceiver?.sender?.track?.label || _UNKNOWN_, name: MEDIA_DEVICES.MICROPHONE});
    mqaData.intervals[0].intervalMetadata.peripherals.push({information: this.peerConnection?.videoTransceiver?.sender?.track?.label || _UNKNOWN_, name: MEDIA_DEVICES.CAMERA});


    mqaData.networkType = this.statsResults.connectionType.local.networkType;

    this.mqaSentCount += 1;

    mqaData.intervals[0].intervalNumber = this.mqaSentCount;

    // DO Deep copy, for some reason it takes the reference all the time rather then old value set
    this.lastMqaDataSent = cloneDeep(this.statsResults);

    this.populateResults(mqaData.intervals[0]);

    this.resetStatsResults();

    this.emit(
      {
        file: 'statsAnalyzer',
        function: 'sendMqaData'
      },
      EVENTS.MEDIA_QUALITY,
      {
        data: mqaData.intervals[0],
        networkType: mqaData.networkType
      }
    );
  }

  /**
   * updated the peerconnection when changed
   *
   * @private
   * @memberof updatePeerconnection
   * @param {PeerConnection} peerConnection
   * @returns {void}
   */
  updatePeerconnection(peerConnection) {
    this.peerConnection = peerConnection;
  }

  /**
   * Starts the stats analyzer on interval
   *
   * @public
   * @memberof StatsAnalyzer
   * @param {PeerConnection} peerConnection
   * @returns {Promise}
   */
  startAnalyzer(peerConnection) {
    if (!this.statsStarted) {
      this.statsStarted = true;
      this.peerConnection = peerConnection;

      return this.getStatsAndParse()
        .then(() => {
          this.statsInterval = setInterval(() => {
            this.getStatsAndParse();
          }, this.config.analyzerInterval);
          // Trigger initial fetch
          this.sendMqaData();
          this.mqaInterval = setInterval(() => {
            this.sendMqaData();
          }, MQA_INTEVAL);
        });
    }

    return Promise.resolve();
  }

  /**
   * Cleans up the analyzer when done
   *
   * @public
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  stopAnalyzer() {
    const sendOneLastMqa = this.mqaInterval && this.statsInterval;

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }

    if (this.mqaInterval) {
      clearInterval(this.mqaInterval);
      this.mqaInterval = undefined;
    }

    if (sendOneLastMqa) {
      return this.getStatsAndParse().then(() => {
        this.sendMqaData();
        this.peerConnection = null;
      });
    }
    this.peerConnection = null;

    return Promise.resolve();
  }

  /**
   * Parse a single result of get stats
   *
   * @private
   * @param {*} getStatsResult
   * @param {String} type
   * @param {boolean} isSender
   * @returns {void}
   * @memberof StatsAnalyzer
   */
  parseGetStatsResult(getStatsResult, type, isSender) {
    if (!getStatsResult) {
      return;
    }

    switch (getStatsResult.type) {
      case 'outbound-rtp':
        this.processOutboundRTPResult(getStatsResult, type);
        break;
      case 'inbound-rtp':
        this.processInboundRTPResult(getStatsResult, type);
        break;
      case 'track':
        this.processTrackResult(getStatsResult, type);
        break;
      case 'remote-inbound-rtp':
      case 'remote-outbound-rtp':
        this.compareSentAndReceived(getStatsResult, type, isSender);
        break;
      case 'remotecandidate':
      case 'remote-candidate':
        this.parseCandidate(getStatsResult, type, isSender, true);
        break;
      case 'local-candidate':
        this.parseCandidate(getStatsResult, type, isSender, false);
        break;
      case 'media-source':
        this.parseAudioSource(getStatsResult, type);
        break;
      default:
        break;
    }
  }

  /**
   * Filters the get stats results for types
   * @private
   * @param {Array} getStatsResults
   * @param {String} type
   * @param {boolean} isSender
   * @returns {void}
   */
  filterAndParseGetStatsResults(getStatsResults, type, isSender) {
    const {types} = DEFAULT_GET_STATS_FILTER;

    getStatsResults.forEach((result) => {
      if (types.includes(result.type)) {
        this.parseGetStatsResult(result, type, isSender);
      }
    });
  }

  /**
   * parse the audio
   * @param {String} result
   * @param {boolean} type
   * @returns {void}
   */
  parseAudioSource(result, type) {
    if (!result) {
      return;
    }

    if (type === STATS.AUDIO_CORRELATE) {
      this.statsResults[type].send.audioLevel = result.audioLevel;
      this.statsResults[type].send.totalAudioEnergy = result.totalAudioEnergy;
    }
  }

  /**
   * emits started/stopped events for local/remote media by checking
   * if given values are increasing or not. The previousValue, currentValue
   * params can be any numerical value like number of receive packets or
   * decoded frames, etc.
   *
   * @private
   * @param {string} mediaType
   * @param {number} previousValue - value to compare
   * @param {number} currentValue - value to compare (must be same type of value as previousValue)
   * @param {boolean} isLocal - true if stats are for local media being sent out, false for remote media being received
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  emitStartStopEvents = (mediaType, previousValue, currentValue, isLocal) => {
    if (mediaType !== 'audio' && mediaType !== 'video' && mediaType !== 'share') {
      throw new Error(`Unsupported mediaType: ${mediaType}`);
    }

    // eslint-disable-next-line no-param-reassign
    if (previousValue === undefined) previousValue = 0;
    // eslint-disable-next-line no-param-reassign
    if (currentValue === undefined) currentValue = 0;

    const lastEmittedEvent = isLocal ? this.lastEmittedStartStopEvent[mediaType].local : this.lastEmittedStartStopEvent[mediaType].remote;

    let newEvent;

    if ((currentValue - previousValue) > 0) {
      newEvent = isLocal ? EVENTS.LOCAL_MEDIA_STARTED : EVENTS.REMOTE_MEDIA_STARTED;
    }
    else if ((currentValue === previousValue) && currentValue > 0) {
      newEvent = isLocal ? EVENTS.LOCAL_MEDIA_STOPPED : EVENTS.REMOTE_MEDIA_STOPPED;
    }

    if (newEvent && lastEmittedEvent !== newEvent) {
      if (isLocal) {
        this.lastEmittedStartStopEvent[mediaType].local = newEvent;
      }
      else {
        this.lastEmittedStartStopEvent[mediaType].remote = newEvent;
      }
      this.emit(
        {
          file: 'statsAnalyzer/index',
          function: 'compareLastStatsResult'
        },
        newEvent,
        {
          type: mediaType
        }
      );
    }
  };

  /**
   * compares current and previous stats to check if packets are not sent
   *
   * @private
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  compareLastStatsResult() {
    if (this.lastStatsResults !== null && this.meetingMediaStatus) {
      // compare audio stats sent
      let mediaType = STATS.AUDIO_CORRELATE;
      let currentStats = null;
      let previousStats = null;

      if (this.meetingMediaStatus.expected.sendAudio) {
        currentStats = this.statsResults[mediaType].send;
        previousStats = this.lastStatsResults[mediaType].send;

        if (currentStats.totalPacketsSent === previousStats.totalPacketsSent || currentStats.totalPacketsSent === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets sent`);
        }
        else {
          if (currentStats.totalAudioEnergy === previousStats.totalAudioEnergy || currentStats.totalAudioEnergy === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} Energy present`);
          }

          if (currentStats.audioLevel === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> ${mediaType} level is 0 for the user`);
          }
        }

        this.emitStartStopEvents(mediaType, previousStats.totalPacketsSent, currentStats.totalPacketsSent, true);
      }

      if (this.meetingMediaStatus.expected.receiveAudio) {
      // compare audio stats received
        currentStats = this.statsResults[mediaType].recv;
        previousStats = this.lastStatsResults[mediaType].recv;

        if (currentStats.totalPacketsReceived === previousStats.totalPacketsReceived || currentStats.totalPacketsReceived === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets received`);
        }
        else if (currentStats.totalSamplesReceived === previousStats.totalSamplesReceived ||
          currentStats.totalSamplesReceived === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} samples received`);
        }

        this.emitStartStopEvents(mediaType, previousStats.totalPacketsReceived, currentStats.totalPacketsReceived, false);
      }

      mediaType = STATS.VIDEO_CORRELATE;
      if (this.meetingMediaStatus.expected.sendVideo) {
      // compare video stats sent
        currentStats = this.statsResults[mediaType].send;
        previousStats = this.lastStatsResults[mediaType].send;

        if (currentStats.totalPacketsSent === previousStats.totalPacketsSent || currentStats.totalPacketsSent === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets sent`);
        }
        else {
          if (currentStats.framesEncoded === previousStats.framesEncoded || currentStats.framesEncoded === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} Frames Encoded`);
          }

          if (this.statsResults.resolutions[mediaType].send.framesSent === this.lastStatsResults.resolutions[mediaType].send.framesSent || this.statsResults.resolutions[mediaType].send.framesSent === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} Frames sent`);
          }
        }

        this.emitStartStopEvents(
          mediaType,
          previousStats.framesSent,
          currentStats.framesSent,
          true
        );
      }


      if (this.meetingMediaStatus.expected.receiveVideo) {
      // compare video stats reveived

        currentStats = this.statsResults[mediaType].recv;
        previousStats = this.lastStatsResults[mediaType].recv;

        if (currentStats.totalPacketsReceived === previousStats.totalPacketsReceived || currentStats.totalPacketsReceived === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets received`);
        }
        else {
          if (this.statsResults.resolutions[mediaType].recv.framesReceived === this.lastStatsResults.resolutions[mediaType].recv.framesReceived || this.statsResults.resolutions[mediaType].recv.framesReceived === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames received`);
          }

          if (this.statsResults[mediaType].recv.framesDecoded === this.lastStatsResults[mediaType].recv.framesDecoded || this.statsResults.resolutions[mediaType].send.framesDecoded === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames decoded`);
          }

          if (this.statsResults.resolutions[mediaType].recv.framesDropped - this.lastStatsResults.resolutions[mediaType].recv.framesDropped > 10) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> ${mediaType} frames are getting dropped`);
          }
        }

        this.emitStartStopEvents(
          mediaType,
          previousStats.framesDecoded,
          currentStats.framesDecoded,
          false
        );
      }

      mediaType = STATS.SHARE_CORRELATE;
      if (this.meetingMediaStatus.expected.sendShare) {
      // compare share stats sent

        currentStats = this.statsResults[mediaType].send;
        previousStats = this.lastStatsResults[mediaType].send;

        if (currentStats.totalPacketsSent === previousStats.totalPacketsSent || currentStats.totalPacketsSent === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets sent`);
        }
        else {
          if (currentStats.framesEncoded === previousStats.framesEncoded || currentStats.framesEncoded === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames getting encoded`);
          }

          if (this.statsResults.resolutions[mediaType].send.framesSent === this.lastStatsResults.resolutions[mediaType].send.framesSent || this.statsResults.resolutions[mediaType].send.framesSent === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames sent`);
          }
        }

        // TODO:need to check receive share value
        // compare share stats reveived
        currentStats = this.statsResults[mediaType].recv;
        previousStats = this.lastStatsResults[mediaType].recv;

        if (currentStats.totalPacketsReceived === previousStats.totalPacketsReceived || currentStats.totalPacketsSent === 0) {
          LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} RTP packets received`);
        }
        else {
          if (this.statsResults.resolutions[mediaType].recv.framesReceived === this.lastStatsResults.resolutions[mediaType].recv.framesReceived || this.statsResults.resolutions[mediaType].recv.framesReceived === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames received`);
          }

          if (this.statsResults[mediaType].recv.framesDecoded === this.lastStatsResults[mediaType].recv.framesDecoded || this.statsResults.resolutions[mediaType].send.framesDecoded === 0) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> No ${mediaType} frames decoded`);
          }

          if (this.statsResults.resolutions[mediaType].recv.framesDropped - this.lastStatsResults.resolutions[mediaType].recv.framesDropped > 10) {
            LoggerProxy.logger.info(`StatsAnalyzer:index#compareLastStatsResult --> ${mediaType} frames are getting dropped`);
          }
        }

        // we are not calling emitStartStopEvents() for sending or receiving share because sharing is often started and stopped
        // in meetings and this.meetingMediaStatus.expected values can be out of sync with the actual packet flow
        // so we would send "sharing stopped" events incorrectly
      }
    }
  }

  /**
   * Does a `getStats` on all the transceivers and parses the results
   *
   * @private
   * @memberof StatsAnalyzer
   * @returns {Promise}
   */
  getStatsAndParse() {
    if (!this.peerConnection) {
      return Promise.resolve();
    }

    if (this.peerConnection && this.peerConnection.connectionState === CONNECTION_STATE.FAILED) {
      LoggerProxy.logger.trace('StatsAnalyzer:index#getStatsAndParse --> PeerConnection is in failed state');

      return Promise.resolve();
    }

    LoggerProxy.logger.trace('StatsAnalyzer:index#getStatsAndParse --> Collecting Stats');

    return Promise.all([
      this.peerConnection.videoTransceiver.sender.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.VIDEO_CORRELATE, true);
      }),

      this.peerConnection.videoTransceiver.receiver.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.VIDEO_CORRELATE, false);
      }),

      this.peerConnection.audioTransceiver.sender.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.AUDIO_CORRELATE, true);
      }),

      this.peerConnection.audioTransceiver.receiver.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.AUDIO_CORRELATE, false);
      }),

      // TODO: add checks for screen share
      this.peerConnection.shareTransceiver.sender.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.SHARE_CORRELATE, true);
      }),

      this.peerConnection.shareTransceiver.receiver.getStats().then((res) => {
        this.filterAndParseGetStatsResults(res, STATS.SHARE_CORRELATE, false);
      }),

    ]).then(() => {
      this.statsResults[STATS.AUDIO_CORRELATE].direction = this.peerConnection.audioTransceiver.currentDirection;
      this.statsResults[STATS.VIDEO_CORRELATE].direction = this.peerConnection.videoTransceiver.currentDirection;
      this.statsResults[STATS.SHARE_CORRELATE].direction = this.peerConnection.shareTransceiver.currentDirection;

      // Process Stats results every 5 seconds
      this.compareLastStatsResult();

      // Save the last results to compare with the current
      this.lastStatsResults = JSON.parse(JSON.stringify(this.statsResults));

      LoggerProxy.logger.trace('StatsAnalyzer:index#getStatsAndParse --> Finished Collecting Stats');
    });
  }

  /**
   * Processes OutboundRTP stats result and stores
   * @private
   * @param {*} result
   * @param {*} type
   * @returns {void}
   */
  processOutboundRTPResult(result, type) {
    const mediaType = type || STATS.AUDIO_CORRELATE;
    const sendrecvType = STATS.SEND_DIRECTION;

    if (result.bytesSent) {
      let kilobytes = 0;

      if (!this.statsResults.internal[mediaType][sendrecvType].prevBytesSent) {
        this.statsResults.internal[mediaType][sendrecvType].prevBytesSent = result.bytesSent;
      }
      if (!this.statsResults.internal[mediaType][sendrecvType].framesEncoded) {
        this.statsResults.internal[mediaType][sendrecvType].framesEncoded = result.framesEncoded;
      }
      if (!this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded) {
        this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded = result.keyFramesEncoded;
      }

      const bytes = result.bytesSent - this.statsResults.internal[mediaType][sendrecvType].prevBytesSent;

      this.statsResults.internal[mediaType][sendrecvType].prevBytesSent = result.bytesSent;

      kilobytes = bytes / 1024;

      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);
      this.statsResults[mediaType].bytesSent = kilobytes;

      this.statsResults[mediaType][sendrecvType].framesEncoded = result.framesEncoded - this.statsResults.internal[mediaType][sendrecvType].framesEncoded;
      this.statsResults[mediaType][sendrecvType].keyFramesEncoded = result.keyFramesEncoded - this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded;
      this.statsResults.internal[mediaType].outboundRtpId = result.id;

      if (!this.statsResults.internal[mediaType][sendrecvType].packetsSent) {
        this.statsResults.internal[mediaType][sendrecvType].packetsSent = result.packetsSent;
      }

      this.statsResults[mediaType][sendrecvType].packetsSent = result.packetsSent - this.statsResults.internal[mediaType][sendrecvType].packetsSent;
      this.statsResults.internal[mediaType][sendrecvType].packetsSent = result.packetsSent;

      // Data saved to send MQA metrics

      this.statsResults[mediaType][sendrecvType].totalKeyFramesEncoded = result.keyFramesEncoded;
      this.statsResults[mediaType][sendrecvType].totalNackCount = result.nackCount;
      this.statsResults[mediaType][sendrecvType].totalPliCount = result.pliCount;
      this.statsResults[mediaType][sendrecvType].totalPacketsSent = result.packetsSent;
      this.statsResults[mediaType][sendrecvType].totalFirCount = result.firCount;
      this.statsResults[mediaType][sendrecvType].framesSent = result.framesSent;
      this.statsResults[mediaType][sendrecvType].framesEncoded = result.framesEncoded;
      this.statsResults[mediaType][sendrecvType].encoderImplementation = result.encoderImplementation;
      this.statsResults[mediaType][sendrecvType].qualityLimitationReason = result.qualityLimitationReason;
      this.statsResults[mediaType][sendrecvType].qualityLimitationResolutionChanges = result.qualityLimitationResolutionChanges;
      this.statsResults[mediaType][sendrecvType].retransmittedPacketsSent = result.retransmittedPacketsSent;
      this.statsResults[mediaType][sendrecvType].totalBytesSent = result.bytesSent;
      this.statsResults[mediaType][sendrecvType].headerBytesSent = result.headerBytesSent;
      this.statsResults[mediaType][sendrecvType].retransmittedBytesSent = result.retransmittedBytesSent;
    }
  }


  /**
   * Processes InboundRTP stats result and stores
   * @private
   * @param {*} result
   * @param {*} type
   * @returns {void}
   */
  processInboundRTPResult(result, type) {
    const mediaType = type || STATS.AUDIO_CORRELATE;
    const sendrecvType = STATS.RECEIVE_DIRECTION;

    if (result.bytesReceived) {
      let kilobytes = 0;

      if (!this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived) {
        this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived = result.bytesReceived;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].pliCount) {
        this.statsResults.internal[mediaType][sendrecvType].pliCount = result.pliCount;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].packetsLost) {
        this.statsResults.internal[mediaType][sendrecvType].packetsLost = result.packetsLost;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived) {
        this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].lastPacketReceivedTimestamp) {
        this.statsResults.internal[mediaType][sendrecvType].lastPacketReceivedTimestamp = result.lastPacketReceivedTimestamp;
      }

      const bytes = result.bytesReceived - (this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived);

      this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived = result.bytesReceived;

      kilobytes = bytes / 1024;
      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);
      this.statsResults[mediaType].bytesReceived = kilobytes.toFixed(1);

      this.statsResults[mediaType][sendrecvType].pliCount = result.pliCount - this.statsResults.internal[mediaType][sendrecvType].pliCount;
      this.statsResults[mediaType][sendrecvType].currentPacketsLost = result.packetsLost - this.statsResults.internal[mediaType][sendrecvType].packetsLost;
      if (this.statsResults[mediaType][sendrecvType].currentPacketsLost < 0) {
        this.statsResults[mediaType][sendrecvType].currentPacketsLost = 0;
      }

      this.statsResults[mediaType][sendrecvType].packetsReceived = result.packetsReceived - this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived;
      this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;

      if (this.statsResults[mediaType][sendrecvType].packetsReceived === 0) {
        LoggerProxy.logger.info(`StatsAnalyzer:index#processInboundRTPResult --> No packets received for ${mediaType} `, this.statsResults[mediaType][sendrecvType].packetsReceived);
      }

      //  Check the over all packet Lost ratio
      this.statsResults[mediaType][sendrecvType].currentPacketLossRatio = this.statsResults[mediaType][sendrecvType].currentPacketsLost > 0 ? this.statsResults[mediaType][sendrecvType].currentPacketsLost / (this.statsResults[mediaType][sendrecvType].packetsReceived + this.statsResults[mediaType][sendrecvType].currentPacketsLost) : 0;
      if (this.statsResults[mediaType][sendrecvType].currentPacketLossRatio > 3) {
        LoggerProxy.logger.info('StatsAnalyzer:index#processInboundRTPResult --> Packets getting lost from the receiver ', this.statsResults[mediaType][sendrecvType].currentPacketLossRatio);
      }

      // TODO: check the packet loss value is negative values here

      if (result.packetsLost) {
        this.statsResults[mediaType][sendrecvType].totalPacketsLost = result.packetsLost > 0 ? result.packetsLost : -result.packetsLost;
      }
      else {
        this.statsResults[mediaType][sendrecvType].totalPacketsLost = 0;
      }

      this.statsResults[mediaType][sendrecvType].lastPacketReceivedTimestamp = result.lastPacketReceivedTimestamp;

      // From Thin
      this.statsResults[mediaType][sendrecvType].totalNackCount = result.nackCount;
      this.statsResults[mediaType][sendrecvType].totalPliCount = result.pliCount;
      this.statsResults[mediaType][sendrecvType].framesDecoded = result.framesDecoded;
      this.statsResults[mediaType][sendrecvType].keyFramesDecoded = result.keyFramesDecoded;

      this.statsResults[mediaType][sendrecvType].decoderImplementation = result.decoderImplementation;
      this.statsResults[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;


      this.statsResults[mediaType][sendrecvType].fecPacketsDiscarded = result.fecPacketsDiscarded;
      this.statsResults[mediaType][sendrecvType].fecPacketsReceived = result.fecPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalBytesReceived = result.bytesReceived;
      this.statsResults[mediaType][sendrecvType].headerBytesReceived = result.headerBytesReceived;

      this.statsResults[mediaType][sendrecvType].meanRtpJitter.push(result.jitter);

      // Audio stats

      this.statsResults[mediaType][sendrecvType].audioLevel = result.audioLevel;
      this.statsResults[mediaType][sendrecvType].totalAudioEnergy = result.totalAudioEnergy;
      this.statsResults[mediaType][sendrecvType].totalSamplesReceived = result.totalSamplesReceived || 0;
      this.statsResults[mediaType][sendrecvType].totalSamplesDecoded = result.totalSamplesDecoded || 0;
      this.statsResults[mediaType][sendrecvType].concealedSamples = result.concealedSamples || 0;
    }
  }

  /**
   * Processes remote and local candidate result and stores
   * @private
   * @param {*} result
   * @param {*} type
   * @param {boolean} isSender
   * @param {boolean} isRemote
   *
   * @returns {void}
   */
  parseCandidate = (result, type, isSender, isRemote) => {
    if (!result || !result.id) {
      return;
    }
    const RemoteCandidateType = {};
    const RemoteTransport = {};
    const RemoteIpAddress = {};
    const RemoteNetworkType = {};

    if (!result.id) return;

    const sendRecvType = isSender ? STATS.SEND_DIRECTION : STATS.RECEIVE_DIRECTION;
    const ipType = isRemote ? STATS.REMOTE : STATS.LOCAL;

    if (!RemoteCandidateType[result.id]) {
      RemoteCandidateType[result.id] = [];
    }

    if (!RemoteTransport[result.id]) {
      RemoteTransport[result.id] = [];
    }

    if (!RemoteIpAddress[result.id]) {
      RemoteIpAddress[result.id] = [];
    }
    if (!RemoteNetworkType[result.id]) {
      RemoteNetworkType[result.id] = [];
    }

    if (result.candidateType && RemoteCandidateType[result.id].indexOf(result.candidateType) === -1) {
      RemoteCandidateType[result.id].push(result.candidateType);
    }

    if (result.protocol && RemoteTransport[result.id].indexOf(result.protocol) === -1) {
      RemoteTransport[result.id].push(result.protocol.toUpperCase());
    }

    if (result.ip && RemoteIpAddress[result.id].indexOf(`${result.ip}:${result.portNumber}`) === -1) {
      RemoteIpAddress[result.id].push(`${result.ip}`); // TODO: Add ports
    }

    if (result.networkType && RemoteNetworkType[result.id].indexOf(result.networkType) === -1) {
      RemoteNetworkType[result.id].push(result.networkType);
    }

    this.statsResults.internal.candidates[result.id] = {
      candidateType: RemoteCandidateType[result.id],
      ipAddress: RemoteIpAddress[result.id],
      portNumber: result.port,
      networkType: RemoteNetworkType[result.id],
      priority: result.priority,
      transport: RemoteTransport[result.id],
      timestamp: result.time,
      id: result.id,
      type: result.type
    };

    this.statsResults.connectionType[ipType].candidateType = RemoteCandidateType[result.id];
    this.statsResults.connectionType[ipType].ipAddress = RemoteIpAddress[result.id];

    this.statsResults.connectionType[ipType].networkType = RemoteNetworkType[result.id][0] === NETWORK_TYPE.VPN ? NETWORK_TYPE.UNKNOWN : RemoteNetworkType[result.id][0];
    this.statsResults.connectionType[ipType].transport = RemoteTransport[result.id];

    this.statsResults[type][sendRecvType].totalRoundTripTime = result.totalRoundTripTime;
  };

  /**
   * Process Track results
   *
   * @private
   * @param {*} result
   * @param {*} mediaType
   * @returns {void}
   * @memberof StatsAnalyzer
   */
  processTrackResult(result, mediaType) {
    if (!result || result.type !== 'track') {
      return;
    }
    if (result.type !== 'track') return;

    const sendrecvType = result.remoteSource === true ? STATS.RECEIVE_DIRECTION : STATS.SEND_DIRECTION;

    if (result.frameWidth && result.frameHeight) {
      this.statsResults.resolutions[mediaType][sendrecvType].width = result.frameWidth;
      this.statsResults.resolutions[mediaType][sendrecvType].height = result.frameHeight;
      this.statsResults.resolutions[mediaType][sendrecvType].framesSent = result.framesSent;
      this.statsResults.resolutions[mediaType][sendrecvType].hugeFramesSent = result.hugeFramesSent;
    }

    if (sendrecvType === STATS.RECEIVE_DIRECTION) {
      this.statsResults.resolutions[mediaType][sendrecvType].framesReceived = result.framesReceived;
      this.statsResults.resolutions[mediaType][sendrecvType].framesDecoded = result.framesDecoded;
      this.statsResults.resolutions[mediaType][sendrecvType].framesDropped = result.framesDropped;
    }


    if (result.trackIdentifier && mediaType !== STATS.AUDIO_CORRELATE) {
      this.statsResults.resolutions[mediaType][sendrecvType].trackIdentifier = result.trackIdentifier;

      const jitterBufferDelay = result && result.jitterBufferDelay;
      const jitterBufferEmittedCount = result && result.jitterBufferEmittedCount;

      this.statsResults.resolutions[mediaType][sendrecvType].avgJitterDelay = jitterBufferEmittedCount && (+jitterBufferDelay / +jitterBufferEmittedCount);

      // Used to calculate the jitter
      this.statsResults.resolutions[mediaType][sendrecvType].jitterBufferDelay = result.jitterBufferDelay;
      this.statsResults.resolutions[mediaType][sendrecvType].jitterBufferEmittedCount = result.jitterBufferEmittedCount;
    }
  }

  /**
   *
   * @private
   * @param {*} result
   * @param {*} type
   * @returns {void}
   * @memberof StatsAnalyzer
   */
  compareSentAndReceived(result, type) {
    if (!type) {
      return;
    }

    const mediaType = type;

    if (!this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver) { this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost; }

    const currentPacketLoss = result.packetsLost - this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver;

    this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost;
    this.statsResults[mediaType].send.packetsLostOnReceiver = currentPacketLoss;
    this.statsResults[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost;

    this.statsResults[mediaType].send.meanRemoteJitter.push(result.jitter);
    this.statsResults[mediaType].send.meanRoundTripTime.push(result.roundTripTime);

    this.statsResults[mediaType].send.timestamp = result.timestamp;
    this.statsResults[mediaType].send.ssrc = result.ssrc;
    this.statsResults[mediaType].send.reportsReceived = result.reportsReceived;

    // Total packloss ratio on this video section of the call
    this.statsResults[mediaType].send.overAllPacketLossRatio = this.statsResults[mediaType].send.totalPacketsLostOnReceiver > 0 ? this.statsResults[mediaType].send.totalPacketsLostOnReceiver / this.statsResults[mediaType].send.totalPacketsSent : 0;
    this.statsResults[mediaType].send.currentPacketLossRatio = this.statsResults[mediaType].send.packetsLostOnReceiver > 0 ? this.statsResults[mediaType].send.packetsLostOnReceiver * 100 / (this.statsResults[mediaType].send.packetsSent + this.statsResults[mediaType].send.packetsLostOnReceiver) : 0;

    if (this.statsResults[mediaType].send.maxPacketLossRatio < this.statsResults[mediaType].send.currentPacketLossRatio) {
      this.statsResults[mediaType].send.maxPacketLossRatio = this.statsResults[mediaType].send.currentPacketLossRatio;
    }

    if (result.type === 'remote-inbound-rtp') {
      this.networkQualityMonitor.determineUplinkNetworkQuality({
        mediaType,
        remoteRtpResults: result,
        statsAnalyzerCurrentStats: this.statsResults
      });
    }
  }
}
