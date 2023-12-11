/* eslint-disable prefer-destructuring */

import {cloneDeep} from 'lodash';
import {ConnectionState} from '@webex/internal-media-core';

import EventsScope from '../common/events/events-scope';
import {
  DEFAULT_GET_STATS_FILTER,
  STATS,
  MQA_INTEVAL,
  NETWORK_TYPE,
  MEDIA_DEVICES,
  _UNKNOWN_,
} from '../constants';
import {
  emptyAudioReceive,
  emptyAudioTransmit,
  emptyMqaInterval,
  emptyVideoReceive,
  emptyVideoTransmit,
} from '../mediaQualityMetrics/config';
import LoggerProxy from '../common/logs/logger-proxy';

import defaultStats from './global';
import {
  getAudioSenderMqa,
  getAudioReceiverMqa,
  getVideoSenderMqa,
  getVideoReceiverMqa,
} from './mqaUtil';
import {ReceiveSlot} from '../multistream/receiveSlot';

export const EVENTS = {
  MEDIA_QUALITY: 'MEDIA_QUALITY',
  LOCAL_MEDIA_STARTED: 'LOCAL_MEDIA_STARTED',
  LOCAL_MEDIA_STOPPED: 'LOCAL_MEDIA_STOPPED',
  REMOTE_MEDIA_STARTED: 'REMOTE_MEDIA_STARTED',
  REMOTE_MEDIA_STOPPED: 'REMOTE_MEDIA_STOPPED',
};

const emptySender = {
  trackLabel: '',
  maxPacketLossRatio: 0,
  availableBandwidth: 0,
  bytesSent: 0,
  meanRemoteJitter: [],
  meanRoundTripTime: [],
};

const emptyReceiver = {
  availableBandwidth: 0,
  bytesReceived: 0,
  meanRtpJitter: [],
  meanRoundTripTime: [],
};

type ReceiveSlotCallback = (csi: number) => ReceiveSlot | undefined;

/**
 * Stats Analyzer class that will emit events based on detected quality
 *
 * @export
 * @class StatsAnalyzer
 * @extends {EventsScope}
 */
export class StatsAnalyzer extends EventsScope {
  config: any;
  correlationId: any;
  lastEmittedStartStopEvent: any;
  lastMqaDataSent: any;
  lastStatsResults: any;
  meetingMediaStatus: any;
  mqaInterval: NodeJS.Timeout;
  mqaSentCount: any;
  networkQualityMonitor: any;
  mediaConnection: any;
  statsInterval: NodeJS.Timeout;
  statsResults: any;
  statsStarted: any;
  receiveSlotCallback: ReceiveSlotCallback;

  /**
   * Creates a new instance of StatsAnalyzer
   * @constructor
   * @public
   * @param {Object} config SDK Configuration Object
   * @param {Function} receiveSlotCallback Callback used to access receive slots.
   * @param {Object} networkQualityMonitor class for assessing network characteristics (jitter, packetLoss, latency)
   * @param {Object} statsResults Default properties for stats
   */
  constructor(
    config: any,
    receiveSlotCallback: ReceiveSlotCallback = () => undefined,
    networkQualityMonitor: object = {},
    statsResults: object = defaultStats
  ) {
    super();
    this.statsStarted = false;
    this.statsResults = statsResults;
    this.lastStatsResults = null;
    this.config = config;
    this.networkQualityMonitor = networkQualityMonitor;
    this.correlationId = config.correlationId;
    this.mqaSentCount = -1;
    this.lastMqaDataSent = {};
    this.lastEmittedStartStopEvent = {};
    this.receiveSlotCallback = receiveSlotCallback;
  }

  /**
   * Resets cumulative stats arrays.
   *
   * @public
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  resetStatsResults() {
    Object.keys(this.statsResults).forEach((mediaType) => {
      if (mediaType.includes('recv')) {
        this.statsResults[mediaType].recv.meanRtpJitter = [];
      }

      if (mediaType.includes('send')) {
        this.statsResults[mediaType].send.meanRemoteJitter = [];
        this.statsResults[mediaType].send.meanRoundTripTime = [];
      }
    });
  }

  /**
   * sets mediaStatus status for analyzing metrics
   *
   * @public
   * @param {Object} status for the audio and video
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  public updateMediaStatus(status: object) {
    this.meetingMediaStatus = status;
  }

  /**
   * captures MQA data from media connection
   *
   * @public
   * @memberof StatsAnalyzer
   * @returns {void}
   */
  sendMqaData() {
    const newMqa = cloneDeep(emptyMqaInterval);

    Object.keys(this.statsResults).forEach((mediaType) => {
      if (mediaType.includes('audio-send') || mediaType.includes('audio-share-send')) {
        const audioSender = cloneDeep(emptyAudioTransmit);

        getAudioSenderMqa({
          audioSender,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.audioTransmit.push(audioSender);
      } else if (mediaType.includes('audio-recv') || mediaType.includes('audio-share-recv')) {
        const audioReceiver = cloneDeep(emptyAudioReceive);

        getAudioReceiverMqa({
          audioReceiver,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.audioReceive.push(audioReceiver);
      } else if (mediaType.includes('video-send') || mediaType.includes('video-share-send')) {
        const videoSender = cloneDeep(emptyVideoTransmit);

        getVideoSenderMqa({
          videoSender,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.videoTransmit.push(videoSender);
      } else if (mediaType.includes('video-recv') || mediaType.includes('video-share-recv')) {
        const videoReceiver = cloneDeep(emptyVideoReceive);

        getVideoReceiverMqa({
          videoReceiver,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.videoReceive.push(videoReceiver);
      }
    });

    newMqa.intervalMetadata.peerReflexiveIP = this.statsResults.connectionType.local.ipAddress;

    // Adding peripheral information
    newMqa.intervalMetadata.peripherals = [];

    newMqa.intervalMetadata.peripherals.push({information: _UNKNOWN_, name: MEDIA_DEVICES.SPEAKER});
    if (this.statsResults['audio-send']) {
      newMqa.intervalMetadata.peripherals.push({
        information: this.statsResults['audio-send']?.trackLabel,
        name: MEDIA_DEVICES.MICROPHONE,
      });
    }
    if (this.statsResults['video-send']) {
      newMqa.intervalMetadata.peripherals.push({
        information: this.statsResults['video-send']?.trackLabel,
        name: MEDIA_DEVICES.CAMERA,
      });
    }

    newMqa.networkType = this.statsResults.connectionType.local.networkType;

    this.mqaSentCount += 1;

    newMqa.intervalNumber = this.mqaSentCount;

    this.resetStatsResults();

    this.emit(
      {
        file: 'statsAnalyzer',
        function: 'sendMqaData',
      },
      EVENTS.MEDIA_QUALITY,
      {
        data: newMqa,
        // @ts-ignore
        networkType: newMqa.networkType,
      }
    );
  }

  /**
   * updated the media connection when changed
   *
   * @private
   * @memberof StatsAnalyzer
   * @param {RoapMediaConnection} mediaConnection
   * @returns {void}
   */
  updateMediaConnection(mediaConnection: any) {
    this.mediaConnection = mediaConnection;
  }

  /**
   * Starts the stats analyzer on interval
   *
   * @public
   * @memberof StatsAnalyzer
   * @param {RoapMediaConnection} mediaConnection
   * @returns {Promise}
   */
  public startAnalyzer(mediaConnection: any) {
    if (!this.statsStarted) {
      this.statsStarted = true;
      this.mediaConnection = mediaConnection;

      return this.getStatsAndParse().then(() => {
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
  public stopAnalyzer() {
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
        this.mediaConnection = null;
      });
    }

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
  private parseGetStatsResult(getStatsResult: any, type: string, isSender: boolean) {
    if (!getStatsResult) {
      return;
    }

    // Generate empty stats results
    if (!this.statsResults[type]) {
      this.statsResults[type] = {};
    }

    if (isSender && !this.statsResults[type].send) {
      this.statsResults[type].send = cloneDeep(emptySender);
    } else if (!isSender && !this.statsResults[type].recv) {
      this.statsResults[type].recv = cloneDeep(emptyReceiver);
    }

    if (!this.statsResults.resolutions[type]) {
      this.statsResults.resolutions[type] = {};
    }

    if (isSender && !this.statsResults.resolutions[type].send) {
      this.statsResults.resolutions[type].send = cloneDeep(emptySender);
    } else if (!isSender && !this.statsResults.resolutions[type].recv) {
      this.statsResults.resolutions[type].recv = cloneDeep(emptyReceiver);
    }

    if (!this.statsResults.internal[type]) {
      this.statsResults.internal[type] = {};
    }

    if (isSender && !this.statsResults.internal[type].send) {
      this.statsResults.internal[type].send = cloneDeep(emptySender);
    } else if (!isSender && !this.statsResults.internal[type].recv) {
      this.statsResults.internal[type].recv = cloneDeep(emptyReceiver);
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
        // @ts-ignore
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
        // @ts-ignore
        this.parseAudioSource(getStatsResult, type);
        break;
      default:
        break;
    }
  }

  /**
   * Filters the get stats results for types
   * @private
   * @param {Array} statsItem
   * @param {String} type
   * @param {boolean} isSender
   * @returns {void}
   */
  filterAndParseGetStatsResults(statsItem: any, type: string, isSender: boolean) {
    const {types} = DEFAULT_GET_STATS_FILTER;

    statsItem.report.forEach((result) => {
      if (types.includes(result.type)) {
        this.parseGetStatsResult(result, type, isSender);
      }
    });

    if (this.statsResults[type]) {
      this.statsResults[type].direction = statsItem.currentDirection;
      this.statsResults[type].trackLabel = statsItem.localTrackLabel;
      this.statsResults[type].csi = statsItem.csi;
    }
  }

  /**
   * parse the audio
   * @param {String} result
   * @param {boolean} type
   * @returns {void}
   */
  parseAudioSource(result: any, type: any) {
    if (!result) {
      return;
    }

    if (type.includes('audio-send')) {
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
  emitStartStopEvents = (
    mediaType: string,
    previousValue: number,
    currentValue: number,
    isLocal: boolean
  ) => {
    if (mediaType !== 'audio' && mediaType !== 'video' && mediaType !== 'share') {
      throw new Error(`Unsupported mediaType: ${mediaType}`);
    }

    // eslint-disable-next-line no-param-reassign
    if (previousValue === undefined) previousValue = 0;
    // eslint-disable-next-line no-param-reassign
    if (currentValue === undefined) currentValue = 0;

    if (!this.lastEmittedStartStopEvent[mediaType]) {
      this.lastEmittedStartStopEvent[mediaType] = {};
    }

    const lastEmittedEvent = isLocal
      ? this.lastEmittedStartStopEvent[mediaType].local
      : this.lastEmittedStartStopEvent[mediaType].remote;

    let newEvent;

    if (currentValue - previousValue > 0) {
      newEvent = isLocal ? EVENTS.LOCAL_MEDIA_STARTED : EVENTS.REMOTE_MEDIA_STARTED;
    } else if (currentValue === previousValue && currentValue > 0) {
      newEvent = isLocal ? EVENTS.LOCAL_MEDIA_STOPPED : EVENTS.REMOTE_MEDIA_STOPPED;
    }

    if (newEvent && lastEmittedEvent !== newEvent) {
      if (isLocal) {
        this.lastEmittedStartStopEvent[mediaType].local = newEvent;
      } else {
        this.lastEmittedStartStopEvent[mediaType].remote = newEvent;
      }
      this.emit(
        {
          file: 'statsAnalyzer/index',
          function: 'compareLastStatsResult',
        },
        newEvent,
        {
          type: mediaType,
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
  private compareLastStatsResult() {
    if (this.lastStatsResults !== null && this.meetingMediaStatus) {
      const getCurrentStatsTotals = (keyPrefix: string, value: string): number =>
        Object.keys(this.statsResults)
          .filter((key) => key.startsWith(keyPrefix))
          .reduce((prev, cur) => prev + (this.statsResults[cur]?.recv[value] || 0), 0);

      const getPreviousStatsTotals = (keyPrefix: string, value: string): number =>
        Object.keys(this.statsResults)
          .filter((key) => key.startsWith(keyPrefix))
          .reduce((prev, cur) => prev + (this.lastStatsResults[cur]?.recv[value] || 0), 0);

      const getCurrentResolutionsStatsTotals = (keyPrefix: string, value: string): number =>
        Object.keys(this.statsResults)
          .filter((key) => key.startsWith(keyPrefix))
          .reduce((prev, cur) => prev + (this.statsResults.resolutions[cur]?.recv[value] || 0), 0);

      const getPreviousResolutionsStatsTotals = (keyPrefix: string, value: string): number =>
        Object.keys(this.statsResults)
          .filter((key) => key.startsWith(keyPrefix))
          .reduce(
            (prev, cur) => prev + (this.lastStatsResults.resolutions[cur]?.recv[value] || 0),
            0
          );

      if (this.meetingMediaStatus.expected.sendAudio && this.lastStatsResults['audio-send']) {
        // compare audio stats sent
        // NOTE: relies on there being only one sender.
        const currentStats = this.statsResults['audio-send'].send;
        const previousStats = this.lastStatsResults['audio-send'].send;

        if (
          currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
          currentStats.totalPacketsSent === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            currentStats.totalAudioEnergy === previousStats.totalAudioEnergy ||
            currentStats.totalAudioEnergy === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No audio Energy present`,
              currentStats.totalAudioEnergy
            );
          }

          if (currentStats.audioLevel === 0) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> audio level is 0 for the user`
            );
          }
        }

        this.emitStartStopEvents(
          'audio',
          previousStats.totalPacketsSent,
          currentStats.totalPacketsSent,
          true
        );
      }

      if (this.meetingMediaStatus.expected.receiveAudio) {
        // compare audio stats received
        const currentPacketsReceived = getCurrentStatsTotals('audio-recv', 'totalPacketsReceived');
        const previousPacketsReceived = getPreviousStatsTotals(
          'audio-recv',
          'totalPacketsReceived'
        );
        const currentSamplesReceived = getCurrentStatsTotals('audio-recv', 'totalSamplesReceived');
        const previousSamplesReceived = getPreviousStatsTotals(
          'audio-recv',
          'totalSamplesReceived'
        );

        if (currentPacketsReceived === previousPacketsReceived || currentPacketsReceived === 0) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets received`,
            currentPacketsReceived
          );
        } else if (
          currentSamplesReceived === previousSamplesReceived ||
          currentSamplesReceived === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No audio samples received`,
            currentSamplesReceived
          );
        }

        this.emitStartStopEvents('audio', previousPacketsReceived, currentPacketsReceived, false);
      }

      if (this.meetingMediaStatus.expected.sendVideo && this.lastStatsResults['video-send']) {
        // compare video stats sent
        const currentStats = this.statsResults['video-send'].send;
        const previousStats = this.lastStatsResults['video-send'].send;

        if (
          currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
          currentStats.totalPacketsSent === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            currentStats.framesEncoded === previousStats.framesEncoded ||
            currentStats.framesEncoded === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames Encoded`,
              currentStats.framesEncoded
            );
          }

          if (
            this.statsResults.resolutions['video-send'].send.framesSent ===
              this.lastStatsResults.resolutions['video-send'].send.framesSent ||
            this.statsResults.resolutions['video-send'].send.framesSent === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames sent`,
              this.statsResults.resolutions['video-send'].send.framesSent
            );
          }
        }

        this.emitStartStopEvents('video', previousStats.framesSent, currentStats.framesSent, true);
      }

      if (this.meetingMediaStatus.expected.receiveVideo) {
        // compare video stats received
        const currentPacketsReceived = getCurrentStatsTotals('video-recv', 'totalPacketsReceived');
        const previousPacketsReceived = getPreviousStatsTotals(
          'video-recv',
          'totalPacketsReceived'
        );
        const currentFramesReceived = getCurrentResolutionsStatsTotals(
          'video-recv',
          'framesReceived'
        );
        const previousFramesReceived = getPreviousResolutionsStatsTotals(
          'video-recv',
          'framesReceived'
        );
        const currentFramesDecoded = getCurrentStatsTotals('video-recv', 'framesDecoded');
        const previousFramesDecoded = getPreviousStatsTotals('video-recv', 'framesDecoded');
        const currentFramesDropped = getCurrentResolutionsStatsTotals(
          'video-recv',
          'framesDropped'
        );
        const previousFramesDropped = getPreviousResolutionsStatsTotals(
          'video-recv',
          'framesDropped'
        );

        if (currentPacketsReceived === previousPacketsReceived || currentPacketsReceived === 0) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets received`,
            currentPacketsReceived
          );
        } else {
          if (currentFramesReceived === previousFramesReceived || currentFramesReceived === 0) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video frames received`,
              currentFramesReceived
            );
          }

          if (currentFramesDecoded === previousFramesDecoded || currentFramesDecoded === 0) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video frames decoded`,
              currentFramesDecoded
            );
          }

          if (currentFramesDropped - previousFramesDropped > 10) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> video frames are getting dropped`,
              currentFramesDropped - previousFramesDropped
            );
          }
        }

        this.emitStartStopEvents('video', previousFramesDecoded, currentFramesDecoded, false);
      }

      if (this.meetingMediaStatus.expected.sendShare && this.lastStatsResults['video-share-send']) {
        // compare share stats sent

        const currentStats = this.statsResults['video-share-send'].send;
        const previousStats = this.lastStatsResults['video-share-send'].send;

        if (
          currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
          currentStats.totalPacketsSent === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            currentStats.framesEncoded === previousStats.framesEncoded ||
            currentStats.framesEncoded === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames getting encoded`,
              currentStats.framesEncoded
            );
          }

          if (
            this.statsResults.resolutions['video-share-send'].send.framesSent ===
              this.lastStatsResults.resolutions['video-share-send'].send.framesSent ||
            this.statsResults.resolutions['video-share-send'].send.framesSent === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames sent`,
              this.statsResults.resolutions['video-share-send'].send.framesSent
            );
          }
        }
      }

      if (this.meetingMediaStatus.expected.sendShare) {
        // TODO:need to check receive share value
        // compare share stats received
        const currentPacketsReceived = getCurrentStatsTotals(
          'video-share-recv',
          'totalPacketsReceived'
        );
        const previousPacketsReceived = getPreviousStatsTotals(
          'video-share-recv',
          'totalPacketsReceived'
        );
        const currentFramesReceived = getCurrentResolutionsStatsTotals(
          'video-share-recv',
          'framesReceived'
        );
        const previousFramesReceived = getPreviousResolutionsStatsTotals(
          'video-share-recv',
          'framesReceived'
        );
        const currentFramesDecoded = getCurrentStatsTotals('video-share-recv', 'framesDecoded');
        const previousFramesDecoded = getPreviousStatsTotals('video-share-recv', 'framesDecoded');
        const currentFramesDropped = getCurrentResolutionsStatsTotals(
          'video-share-recv',
          'framesDropped'
        );
        const previousFramesDropped = getPreviousResolutionsStatsTotals(
          'video-share-recv',
          'framesDropped'
        );

        if (currentPacketsReceived === previousPacketsReceived || currentPacketsReceived === 0) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets received`,
            currentPacketsReceived
          );
        } else {
          if (currentFramesReceived === previousFramesReceived || currentFramesReceived === 0) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames received`,
              currentFramesReceived
            );
          }

          if (currentFramesDecoded === previousFramesDecoded || currentFramesDecoded === 0) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames decoded`,
              currentFramesDecoded
            );
          }

          if (currentFramesDropped - previousFramesDropped > 10) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> share frames are getting dropped`,
              currentFramesDropped - previousFramesDropped
            );
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
  private getStatsAndParse() {
    if (!this.mediaConnection) {
      return Promise.resolve();
    }

    if (
      this.mediaConnection &&
      this.mediaConnection.getConnectionState() === ConnectionState.Failed
    ) {
      LoggerProxy.logger.trace(
        'StatsAnalyzer:index#getStatsAndParse --> media connection is in failed state'
      );

      return Promise.resolve();
    }

    LoggerProxy.logger.trace('StatsAnalyzer:index#getStatsAndParse --> Collecting Stats');

    return this.mediaConnection.getTransceiverStats().then((transceiverStats) => {
      transceiverStats.video.receivers.forEach((receiver, i) =>
        this.filterAndParseGetStatsResults(receiver, `video-recv-${i}`, false)
      );
      transceiverStats.audio.receivers.forEach((receiver, i) =>
        this.filterAndParseGetStatsResults(receiver, `audio-recv-${i}`, false)
      );
      transceiverStats.screenShareVideo.receivers.forEach((receiver, i) =>
        this.filterAndParseGetStatsResults(receiver, `video-share-recv-${i}`, false)
      );
      transceiverStats.screenShareAudio.receivers.forEach((receiver, i) =>
        this.filterAndParseGetStatsResults(receiver, `audio-share-recv-${i}`, false)
      );

      transceiverStats.video.senders.forEach((sender, i) => {
        if (i > 0) {
          throw new Error('Stats Analyzer does not support multiple senders.');
        }
        this.filterAndParseGetStatsResults(sender, 'video-send', true);
      });
      transceiverStats.audio.senders.forEach((sender, i) => {
        if (i > 0) {
          throw new Error('Stats Analyzer does not support multiple senders.');
        }
        this.filterAndParseGetStatsResults(sender, 'audio-send', true);
      });
      transceiverStats.screenShareVideo.senders.forEach((sender, i) => {
        if (i > 0) {
          throw new Error('Stats Analyzer does not support multiple senders.');
        }
        this.filterAndParseGetStatsResults(sender, 'video-share-send', true);
      });
      transceiverStats.screenShareAudio.senders.forEach((sender, i) => {
        if (i > 0) {
          throw new Error('Stats Analyzer does not support multiple senders.');
        }
        this.filterAndParseGetStatsResults(sender, 'audio-share-send', true);
      });

      this.compareLastStatsResult();

      // Save the last results to compare with the current
      // DO Deep copy, for some reason it takes the reference all the time rather then old value set
      this.lastStatsResults = JSON.parse(JSON.stringify(this.statsResults));

      LoggerProxy.logger.trace(
        'StatsAnalyzer:index#getStatsAndParse --> Finished Collecting Stats'
      );
    });
  }

  /**
   * Processes OutboundRTP stats result and stores
   * @private
   * @param {*} result
   * @param {*} mediaType
   * @returns {void}
   */
  private processOutboundRTPResult(result: any, mediaType: any) {
    const sendrecvType = STATS.SEND_DIRECTION;

    if (result.bytesSent) {
      let kilobytes = 0;

      if (result.frameWidth && result.frameHeight) {
        this.statsResults.resolutions[mediaType][sendrecvType].width = result.frameWidth;
        this.statsResults.resolutions[mediaType][sendrecvType].height = result.frameHeight;
        this.statsResults.resolutions[mediaType][sendrecvType].framesSent = result.framesSent;
        this.statsResults.resolutions[mediaType][sendrecvType].hugeFramesSent =
          result.hugeFramesSent;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].prevBytesSent) {
        this.statsResults.internal[mediaType][sendrecvType].prevBytesSent = result.bytesSent;
      }
      if (!this.statsResults.internal[mediaType][sendrecvType].framesEncoded) {
        this.statsResults.internal[mediaType][sendrecvType].framesEncoded = result.framesEncoded;
      }
      if (!this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded) {
        this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded =
          result.keyFramesEncoded;
      }

      const bytes =
        result.bytesSent - this.statsResults.internal[mediaType][sendrecvType].prevBytesSent;

      this.statsResults.internal[mediaType][sendrecvType].prevBytesSent = result.bytesSent;

      kilobytes = bytes / 1024;

      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);
      this.statsResults[mediaType].bytesSent = kilobytes;

      this.statsResults[mediaType][sendrecvType].framesEncoded =
        result.framesEncoded - this.statsResults.internal[mediaType][sendrecvType].framesEncoded;
      this.statsResults[mediaType][sendrecvType].keyFramesEncoded =
        result.keyFramesEncoded -
        this.statsResults.internal[mediaType][sendrecvType].keyFramesEncoded;
      this.statsResults.internal[mediaType].outboundRtpId = result.id;

      if (!this.statsResults.internal[mediaType][sendrecvType].packetsSent) {
        this.statsResults.internal[mediaType][sendrecvType].packetsSent = result.packetsSent;
      }

      this.statsResults[mediaType][sendrecvType].packetsSent =
        result.packetsSent - this.statsResults.internal[mediaType][sendrecvType].packetsSent;
      this.statsResults.internal[mediaType][sendrecvType].packetsSent = result.packetsSent;

      // Data saved to send MQA metrics

      this.statsResults[mediaType][sendrecvType].totalKeyFramesEncoded = result.keyFramesEncoded;
      this.statsResults[mediaType][sendrecvType].totalNackCount = result.nackCount;
      this.statsResults[mediaType][sendrecvType].totalPliCount = result.pliCount;
      this.statsResults[mediaType][sendrecvType].totalPacketsSent = result.packetsSent;
      this.statsResults[mediaType][sendrecvType].totalFirCount = result.firCount;
      this.statsResults[mediaType][sendrecvType].framesSent = result.framesSent;
      this.statsResults[mediaType][sendrecvType].framesEncoded = result.framesEncoded;
      this.statsResults[mediaType][sendrecvType].encoderImplementation =
        result.encoderImplementation;
      this.statsResults[mediaType][sendrecvType].qualityLimitationReason =
        result.qualityLimitationReason;
      this.statsResults[mediaType][sendrecvType].qualityLimitationResolutionChanges =
        result.qualityLimitationResolutionChanges;
      this.statsResults[mediaType][sendrecvType].retransmittedPacketsSent =
        result.retransmittedPacketsSent;
      this.statsResults[mediaType][sendrecvType].totalBytesSent = result.bytesSent;
      this.statsResults[mediaType][sendrecvType].headerBytesSent = result.headerBytesSent;
      this.statsResults[mediaType][sendrecvType].retransmittedBytesSent =
        result.retransmittedBytesSent;
    }
  }

  /**
   * Processes InboundRTP stats result and stores
   * @private
   * @param {*} result
   * @param {*} mediaType
   * @returns {void}
   */
  private processInboundRTPResult(result: any, mediaType: any) {
    const sendrecvType = STATS.RECEIVE_DIRECTION;

    if (result.bytesReceived) {
      let kilobytes = 0;
      const receiveSlot = this.receiveSlotCallback(result.ssrc);
      const idAndCsi = receiveSlot
        ? `id: "${receiveSlot.id || ''}"${receiveSlot.csi ? ` and csi: ${receiveSlot.csi}` : ''}`
        : '';

      if (result.frameWidth && result.frameHeight) {
        this.statsResults.resolutions[mediaType][sendrecvType].width = result.frameWidth;
        this.statsResults.resolutions[mediaType][sendrecvType].height = result.frameHeight;
        this.statsResults.resolutions[mediaType][sendrecvType].framesReceived =
          result.framesReceived;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived) {
        this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived =
          result.bytesReceived;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].pliCount) {
        this.statsResults.internal[mediaType][sendrecvType].pliCount = result.pliCount;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].packetsLost) {
        this.statsResults.internal[mediaType][sendrecvType].packetsLost = result.packetsLost;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived) {
        this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived =
          result.packetsReceived;
      }

      if (!this.statsResults.internal[mediaType][sendrecvType].lastPacketReceivedTimestamp) {
        this.statsResults.internal[mediaType][sendrecvType].lastPacketReceivedTimestamp =
          result.lastPacketReceivedTimestamp;
      }

      const bytes =
        result.bytesReceived -
        this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived;

      this.statsResults.internal[mediaType][sendrecvType].prevBytesReceived = result.bytesReceived;

      kilobytes = bytes / 1024;
      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);
      this.statsResults[mediaType].bytesReceived = kilobytes.toFixed(1);

      this.statsResults[mediaType][sendrecvType].pliCount =
        result.pliCount - this.statsResults.internal[mediaType][sendrecvType].pliCount;
      this.statsResults[mediaType][sendrecvType].currentPacketsLost =
        result.packetsLost - this.statsResults.internal[mediaType][sendrecvType].packetsLost;
      if (this.statsResults[mediaType][sendrecvType].currentPacketsLost < 0) {
        this.statsResults[mediaType][sendrecvType].currentPacketsLost = 0;
      }

      this.statsResults[mediaType][sendrecvType].packetsReceived =
        result.packetsReceived -
        this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived;
      this.statsResults.internal[mediaType][sendrecvType].totalPacketsReceived =
        result.packetsReceived;

      if (this.statsResults[mediaType][sendrecvType].packetsReceived === 0) {
        if (receiveSlot) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#processInboundRTPResult --> No packets received for receive slot ${idAndCsi}`,
            this.statsResults[mediaType][sendrecvType].packetsReceived
          );
        }
      }

      //  Check the over all packet Lost ratio
      this.statsResults[mediaType][sendrecvType].currentPacketLossRatio =
        this.statsResults[mediaType][sendrecvType].currentPacketsLost > 0
          ? this.statsResults[mediaType][sendrecvType].currentPacketsLost /
            (this.statsResults[mediaType][sendrecvType].packetsReceived +
              this.statsResults[mediaType][sendrecvType].currentPacketsLost)
          : 0;
      if (this.statsResults[mediaType][sendrecvType].currentPacketLossRatio > 3) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#processInboundRTPResult --> Packets getting lost from the receiver with slot ${idAndCsi}`,
          this.statsResults[mediaType][sendrecvType].currentPacketLossRatio
        );
      }

      // TODO: check the packet loss value is negative values here

      if (result.packetsLost) {
        this.statsResults[mediaType][sendrecvType].totalPacketsLost =
          result.packetsLost > 0 ? result.packetsLost : -result.packetsLost;
      } else {
        this.statsResults[mediaType][sendrecvType].totalPacketsLost = 0;
      }

      this.statsResults[mediaType][sendrecvType].lastPacketReceivedTimestamp =
        result.lastPacketReceivedTimestamp;

      // From Thin
      this.statsResults[mediaType][sendrecvType].totalNackCount = result.nackCount;
      this.statsResults[mediaType][sendrecvType].totalPliCount = result.pliCount;
      this.statsResults[mediaType][sendrecvType].framesDecoded = result.framesDecoded;
      this.statsResults[mediaType][sendrecvType].keyFramesDecoded = result.keyFramesDecoded;

      this.statsResults[mediaType][sendrecvType].decoderImplementation =
        result.decoderImplementation;
      this.statsResults[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;

      this.statsResults[mediaType][sendrecvType].fecPacketsDiscarded = result.fecPacketsDiscarded;
      this.statsResults[mediaType][sendrecvType].fecPacketsReceived = result.fecPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalBytesReceived = result.bytesReceived;
      this.statsResults[mediaType][sendrecvType].headerBytesReceived = result.headerBytesReceived;

      this.statsResults[mediaType][sendrecvType].meanRtpJitter.push(result.jitter);

      // Audio stats

      this.statsResults[mediaType][sendrecvType].audioLevel = result.audioLevel;
      this.statsResults[mediaType][sendrecvType].totalAudioEnergy = result.totalAudioEnergy;
      this.statsResults[mediaType][sendrecvType].totalSamplesReceived =
        result.totalSamplesReceived || 0;
      this.statsResults[mediaType][sendrecvType].totalSamplesDecoded =
        result.totalSamplesDecoded || 0;
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
  parseCandidate = (result: any, type: any, isSender: boolean, isRemote: boolean) => {
    if (!result || !result.id) {
      return;
    }

    let transport;
    if (result.relayProtocol) {
      transport = result.relayProtocol.toUpperCase();
    } else if (result.protocol) {
      transport = result.protocol.toUpperCase();
    }

    const sendRecvType = isSender ? STATS.SEND_DIRECTION : STATS.RECEIVE_DIRECTION;
    const ipType = isRemote ? STATS.REMOTE : STATS.LOCAL;

    this.statsResults.internal.candidates[result.id] = {
      candidateType: result.candidateType,
      ipAddress: result.ip, // TODO: add ports
      portNumber: result.port,
      networkType: result.networkType,
      priority: result.priority,
      transport,
      timestamp: result.time,
      id: result.id,
      type: result.type,
    };

    this.statsResults.connectionType[ipType].candidateType = result.candidateType;
    this.statsResults.connectionType[ipType].ipAddress = result.ipAddress;

    this.statsResults.connectionType[ipType].networkType =
      result.networkType === NETWORK_TYPE.VPN ? NETWORK_TYPE.UNKNOWN : result.networkType;
    this.statsResults.connectionType[ipType].transport = transport;

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
  private processTrackResult(result: any, mediaType: any) {
    if (!result || result.type !== 'track') {
      return;
    }

    const sendrecvType =
      result.remoteSource === true ? STATS.RECEIVE_DIRECTION : STATS.SEND_DIRECTION;

    if (sendrecvType === STATS.RECEIVE_DIRECTION) {
      this.statsResults.resolutions[mediaType][sendrecvType].framesReceived = result.framesReceived;
      this.statsResults.resolutions[mediaType][sendrecvType].framesDecoded = result.framesDecoded;
      this.statsResults.resolutions[mediaType][sendrecvType].framesDropped = result.framesDropped;
    }

    if (result.trackIdentifier && !mediaType.includes('audio')) {
      this.statsResults.resolutions[mediaType][sendrecvType].trackIdentifier =
        result.trackIdentifier;

      const jitterBufferDelay = result && result.jitterBufferDelay;
      const jitterBufferEmittedCount = result && result.jitterBufferEmittedCount;

      this.statsResults.resolutions[mediaType][sendrecvType].avgJitterDelay =
        jitterBufferEmittedCount && +jitterBufferDelay / +jitterBufferEmittedCount;

      // Used to calculate the jitter
      this.statsResults.resolutions[mediaType][sendrecvType].jitterBufferDelay =
        result.jitterBufferDelay;
      this.statsResults.resolutions[mediaType][sendrecvType].jitterBufferEmittedCount =
        result.jitterBufferEmittedCount;
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
    // Don't compare on transceivers without a sender.
    if (!type || !this.statsResults.internal[type].send) {
      return;
    }

    const mediaType = type;

    if (!this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver) {
      this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost;
    }

    const currentPacketLoss =
      result.packetsLost - this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver;

    this.statsResults.internal[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost;
    this.statsResults[mediaType].send.packetsLostOnReceiver = currentPacketLoss;
    this.statsResults[mediaType].send.totalPacketsLostOnReceiver = result.packetsLost;

    this.statsResults[mediaType].send.meanRemoteJitter.push(result.jitter);
    this.statsResults[mediaType].send.meanRoundTripTime.push(result.roundTripTime);

    this.statsResults[mediaType].send.timestamp = result.timestamp;
    this.statsResults[mediaType].send.ssrc = result.ssrc;
    this.statsResults[mediaType].send.reportsReceived = result.reportsReceived;

    // Total packloss ratio on this video section of the call
    this.statsResults[mediaType].send.overAllPacketLossRatio =
      this.statsResults[mediaType].send.totalPacketsLostOnReceiver > 0
        ? this.statsResults[mediaType].send.totalPacketsLostOnReceiver /
          this.statsResults[mediaType].send.totalPacketsSent
        : 0;
    this.statsResults[mediaType].send.currentPacketLossRatio =
      this.statsResults[mediaType].send.packetsLostOnReceiver > 0
        ? (this.statsResults[mediaType].send.packetsLostOnReceiver * 100) /
          (this.statsResults[mediaType].send.packetsSent +
            this.statsResults[mediaType].send.packetsLostOnReceiver)
        : 0;

    if (
      this.statsResults[mediaType].send.maxPacketLossRatio <
      this.statsResults[mediaType].send.currentPacketLossRatio
    ) {
      this.statsResults[mediaType].send.maxPacketLossRatio =
        this.statsResults[mediaType].send.currentPacketLossRatio;
    }

    if (result.type === 'remote-inbound-rtp') {
      this.networkQualityMonitor.determineUplinkNetworkQuality({
        mediaType,
        remoteRtpResults: result,
        statsAnalyzerCurrentStats: this.statsResults,
      });
    }
  }
}
