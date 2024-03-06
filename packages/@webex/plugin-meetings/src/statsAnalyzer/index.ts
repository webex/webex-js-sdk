/* eslint-disable prefer-destructuring */

import {cloneDeep, isEmpty} from 'lodash';
import {ConnectionState} from '@webex/internal-media-core';

import EventsScope from '../common/events/events-scope';
import {
  DEFAULT_GET_STATS_FILTER,
  STATS,
  MQA_INTERVAL,
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
  successfulCandidatePair: any;
  localIpAddress: string; // Returns the local IP address for diagnostics. this is the local IP of the interface used for the current media connection a host can have many local Ip Addresses
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
    this.successfulCandidatePair = {};
    this.localIpAddress = '';
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
      if (!this.lastMqaDataSent[mediaType]) {
        this.lastMqaDataSent[mediaType] = {};
      }

      if (!this.lastMqaDataSent[mediaType].send && mediaType.includes('-send')) {
        this.lastMqaDataSent[mediaType].send = {};
      }

      if (!this.lastMqaDataSent[mediaType].recv && mediaType.includes('-recv')) {
        this.lastMqaDataSent[mediaType].recv = {};
      }

      if (mediaType.includes('audio-send') || mediaType.includes('audio-share-send')) {
        const audioSender = cloneDeep(emptyAudioTransmit);

        getAudioSenderMqa({
          audioSender,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.audioTransmit.push(audioSender);

        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.includes('audio-recv') || mediaType.includes('audio-share-recv')) {
        const audioReceiver = cloneDeep(emptyAudioReceive);

        getAudioReceiverMqa({
          audioReceiver,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.audioReceive.push(audioReceiver);

        this.lastMqaDataSent[mediaType].recv = cloneDeep(this.statsResults[mediaType].recv);
      } else if (mediaType.includes('video-send') || mediaType.includes('video-share-send')) {
        const videoSender = cloneDeep(emptyVideoTransmit);

        getVideoSenderMqa({
          videoSender,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.videoTransmit.push(videoSender);

        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.includes('video-recv') || mediaType.includes('video-share-recv')) {
        const videoReceiver = cloneDeep(emptyVideoReceive);

        getVideoReceiverMqa({
          videoReceiver,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        newMqa.videoReceive.push(videoReceiver);

        this.lastMqaDataSent[mediaType].recv = cloneDeep(this.statsResults[mediaType].recv);
      }
    });

    newMqa.intervalMetadata.peerReflexiveIP = this.statsResults.connectionType.local.ipAddress;

    // Adding peripheral information
    newMqa.intervalMetadata.peripherals.push({information: _UNKNOWN_, name: MEDIA_DEVICES.SPEAKER});
    if (this.statsResults['audio-send']) {
      newMqa.intervalMetadata.peripherals.push({
        information: this.statsResults['audio-send'].trackLabel || _UNKNOWN_,
        name: MEDIA_DEVICES.MICROPHONE,
      });
    }
    if (this.statsResults['video-send']) {
      newMqa.intervalMetadata.peripherals.push({
        information: this.statsResults['video-send'].trackLabel || _UNKNOWN_,
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
   * Returns the local IP address for diagnostics.
   * this is the local IP of the interface used for the current media connection
   * a host can have many local Ip Addresses
   * @returns {string | undefined} The local IP address.
   */
  getLocalIpAddress(): string {
    return this.localIpAddress;
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
        }, MQA_INTERVAL);
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

    switch (getStatsResult.type) {
      case 'outbound-rtp':
        this.processOutboundRTPResult(getStatsResult, type);
        break;
      case 'inbound-rtp':
        this.processInboundRTPResult(getStatsResult, type);
        break;
      case 'remote-inbound-rtp':
      case 'remote-outbound-rtp':
        this.compareSentAndReceived(getStatsResult, type);
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

    // get the successful candidate pair before parsing stats.
    statsItem.report.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        this.successfulCandidatePair = report;
      }
    });

    statsItem.report.forEach((result) => {
      if (types.includes(result.type)) {
        this.parseGetStatsResult(result, type, isSender);
      }
    });

    if (this.statsResults[type]) {
      this.statsResults[type].direction = statsItem.currentDirection;
      this.statsResults[type].trackLabel = statsItem.localTrackLabel;
      this.statsResults[type].csi = statsItem.csi;
      this.extractAndSetLocalIpAddressInfoForDiagnostics(
        this.successfulCandidatePair?.localCandidateId,
        this.statsResults?.candidates
      );
      // reset the successful candidate pair.
      this.successfulCandidatePair = {};
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

      if (this.lastStatsResults['audio-send']) {
        // compare audio stats sent
        // NOTE: relies on there being only one sender.
        const currentStats = this.statsResults['audio-send'].send;
        const previousStats = this.lastStatsResults['audio-send'].send;

        if (
          (this.lastEmittedStartStopEvent?.audio?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            currentStats.totalPacketsSent === previousStats.totalPacketsSent) ||
          currentStats.totalPacketsSent === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            (this.lastEmittedStartStopEvent?.audio?.local === EVENTS.LOCAL_MEDIA_STARTED &&
              currentStats.totalAudioEnergy === previousStats.totalAudioEnergy) ||
            currentStats.totalAudioEnergy === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No audio Energy present`,
              currentStats.totalAudioEnergy
            );
          }

          if (
            this.lastEmittedStartStopEvent?.audio?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            currentStats.audioLevel === 0
          ) {
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

      // compare audio stats received
      const currentAudioPacketsReceived = getCurrentStatsTotals(
        'audio-recv',
        'totalPacketsReceived'
      );
      const previousAudioPacketsReceived = getPreviousStatsTotals(
        'audio-recv',
        'totalPacketsReceived'
      );

      const currentAudioSamplesReceived = getCurrentStatsTotals(
        'audio-recv',
        'totalSamplesReceived'
      );
      const previousAudioSamplesReceived = getPreviousStatsTotals(
        'audio-recv',
        'totalSamplesReceived'
      );

      if (
        this.lastEmittedStartStopEvent?.audio?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
        (currentAudioPacketsReceived === previousAudioPacketsReceived ||
          currentAudioPacketsReceived === 0)
      ) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets received`,
          currentAudioPacketsReceived
        );
      } else if (
        this.lastEmittedStartStopEvent?.audio?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
        (currentAudioSamplesReceived === previousAudioSamplesReceived ||
          currentAudioSamplesReceived === 0)
      ) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#compareLastStatsResult --> No audio samples received`,
          currentAudioSamplesReceived
        );
      }

      this.emitStartStopEvents(
        'audio',
        previousAudioPacketsReceived,
        currentAudioPacketsReceived,
        false
      );

      if (this.lastStatsResults['video-send']) {
        // compare video stats sent
        const currentStats = this.statsResults['video-send'].send;
        const previousStats = this.lastStatsResults['video-send'].send;

        if (
          this.lastEmittedStartStopEvent?.video?.local === EVENTS.LOCAL_MEDIA_STARTED &&
          (currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
            currentStats.totalPacketsSent === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            this.lastEmittedStartStopEvent?.video?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            (currentStats.framesEncoded === previousStats.framesEncoded ||
              currentStats.framesEncoded === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames Encoded`,
              currentStats.framesEncoded
            );
          }

          if (
            this.lastEmittedStartStopEvent?.video?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            (this.statsResults['video-send'].send.framesSent ===
              this.lastStatsResults['video-send'].send.framesSent ||
              this.statsResults['video-send'].send.framesSent === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames sent`,
              this.statsResults['video-send'].send.framesSent
            );
          }
        }

        this.emitStartStopEvents('video', previousStats.framesSent, currentStats.framesSent, true);
      }

      const currentVideoFramesDecoded = getCurrentStatsTotals('video-recv', 'framesDecoded');
      const previousVideoFramesDecoded = getPreviousStatsTotals('video-recv', 'framesDecoded');

      // compare video stats received
      const currentVideoPacketsReceived = getCurrentStatsTotals(
        'video-recv',
        'totalPacketsReceived'
      );
      const previousVideoPacketsReceived = getPreviousStatsTotals(
        'video-recv',
        'totalPacketsReceived'
      );
      const currentVideoFramesReceived = getCurrentStatsTotals('video-recv', 'framesReceived');
      const previousVideoFramesReceived = getPreviousStatsTotals('video-recv', 'framesReceived');
      const currentVideoFramesDropped = getCurrentStatsTotals('video-recv', 'framesDropped');
      const previousVideoFramesDropped = getPreviousStatsTotals('video-recv', 'framesDropped');

      if (
        this.lastEmittedStartStopEvent?.video?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
        (currentVideoPacketsReceived === previousVideoPacketsReceived ||
          currentVideoPacketsReceived === 0)
      ) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets received`,
          currentVideoPacketsReceived
        );
      } else {
        if (
          this.lastEmittedStartStopEvent?.video?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          (currentVideoFramesReceived === previousVideoFramesReceived ||
            currentVideoFramesReceived === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video frames received`,
            currentVideoFramesReceived
          );
        }

        if (
          this.lastEmittedStartStopEvent?.video?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          (currentVideoFramesDecoded === previousVideoFramesDecoded ||
            currentVideoFramesDecoded === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video frames decoded`,
            currentVideoFramesDecoded
          );
        }

        if (
          this.lastEmittedStartStopEvent?.video?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          currentVideoFramesDropped - previousVideoFramesDropped > 10
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> video frames are getting dropped`,
            currentVideoFramesDropped - previousVideoFramesDropped
          );
        }
      }

      this.emitStartStopEvents(
        'video',
        previousVideoFramesDecoded,
        currentVideoFramesDecoded,
        false
      );

      if (this.lastStatsResults['video-share-send']) {
        // compare share stats sent

        const currentStats = this.statsResults['video-share-send'].send;
        const previousStats = this.lastStatsResults['video-share-send'].send;

        if (
          this.lastEmittedStartStopEvent?.share?.local === EVENTS.LOCAL_MEDIA_STARTED &&
          (currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
            currentStats.totalPacketsSent === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            this.lastEmittedStartStopEvent?.share?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            (currentStats.framesEncoded === previousStats.framesEncoded ||
              currentStats.framesEncoded === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames getting encoded`,
              currentStats.framesEncoded
            );
          }

          if (
            this.lastEmittedStartStopEvent?.share?.local === EVENTS.LOCAL_MEDIA_STARTED &&
            (this.statsResults['video-share-send'].send.framesSent ===
              this.lastStatsResults['video-share-send'].send.framesSent ||
              this.statsResults['video-share-send'].send.framesSent === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames sent`,
              this.statsResults['video-share-send'].send.framesSent
            );
          }
        }

        this.emitStartStopEvents('share', previousStats.framesSent, currentStats.framesSent, true);
      }

      const currentShareFramesDecoded = getCurrentStatsTotals('video-share-recv', 'framesDecoded');
      const previousShareFramesDecoded = getPreviousStatsTotals(
        'video-share-recv',
        'framesDecoded'
      );
      // TODO:need to check receive share value
      // compare share stats received
      const currentSharePacketsReceived = getCurrentStatsTotals(
        'video-share-recv',
        'totalPacketsReceived'
      );
      const previousSharePacketsReceived = getPreviousStatsTotals(
        'video-share-recv',
        'totalPacketsReceived'
      );
      const currentShareFramesReceived = getCurrentStatsTotals(
        'video-share-recv',
        'framesReceived'
      );
      const previousShareFramesReceived = getPreviousStatsTotals(
        'video-share-recv',
        'framesReceived'
      );
      const currentShareFramesDropped = getCurrentStatsTotals('video-share-recv', 'framesDropped');
      const previousShareFramesDropped = getPreviousStatsTotals(
        'video-share-recv',
        'framesDropped'
      );

      if (
        this.lastEmittedStartStopEvent?.share?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
        (currentSharePacketsReceived === previousSharePacketsReceived ||
          currentSharePacketsReceived === 0)
      ) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets received`,
          currentSharePacketsReceived
        );
      } else {
        if (
          this.lastEmittedStartStopEvent?.share?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          (currentShareFramesReceived === previousShareFramesReceived ||
            currentShareFramesReceived === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share frames received`,
            currentShareFramesReceived
          );
        }

        if (
          this.lastEmittedStartStopEvent?.share?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          (currentShareFramesDecoded === previousShareFramesDecoded ||
            currentShareFramesDecoded === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share frames decoded`,
            currentShareFramesDecoded
          );
        }

        if (
          this.lastEmittedStartStopEvent?.share?.remote === EVENTS.REMOTE_MEDIA_STARTED &&
          currentShareFramesDropped - previousShareFramesDropped > 10
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> share frames are getting dropped`,
            currentShareFramesDropped - previousShareFramesDropped
          );
        }
      }

      this.emitStartStopEvents(
        'share',
        previousShareFramesDecoded,
        currentShareFramesDecoded,
        false
      );
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
      const kilobytes = 0;

      if (result.frameWidth && result.frameHeight) {
        this.statsResults[mediaType][sendrecvType].width = result.frameWidth;
        this.statsResults[mediaType][sendrecvType].height = result.frameHeight;
        this.statsResults[mediaType][sendrecvType].framesSent = result.framesSent;
        this.statsResults[mediaType][sendrecvType].hugeFramesSent = result.hugeFramesSent;
      }

      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);

      this.statsResults[mediaType][sendrecvType].framesEncoded = result.framesEncoded;
      this.statsResults[mediaType][sendrecvType].keyFramesEncoded = result.keyFramesEncoded;
      this.statsResults[mediaType][sendrecvType].packetsSent = result.packetsSent;

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
        this.statsResults[mediaType][sendrecvType].width = result.frameWidth;
        this.statsResults[mediaType][sendrecvType].height = result.frameHeight;
        this.statsResults[mediaType][sendrecvType].framesReceived = result.framesReceived;
      }

      const bytes =
        result.bytesReceived - this.statsResults[mediaType][sendrecvType].totalBytesReceived;

      kilobytes = bytes / 1024;
      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);

      let currentPacketsLost =
        result.packetsLost - this.statsResults[mediaType][sendrecvType].totalPacketsLost;
      if (currentPacketsLost < 0) {
        currentPacketsLost = 0;
      }

      const currentPacketsReceived =
        result.packetsReceived - this.statsResults[mediaType][sendrecvType].totalPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;

      if (currentPacketsReceived === 0) {
        if (receiveSlot) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#processInboundRTPResult --> No packets received for receive slot ${idAndCsi}`,
            currentPacketsReceived
          );
        }
      }

      //  Check the over all packet Lost ratio
      this.statsResults[mediaType][sendrecvType].currentPacketLossRatio =
        currentPacketsLost > 0
          ? currentPacketsLost / (currentPacketsReceived + currentPacketsLost)
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
   * extracts the local Ip address from the statsResult object by looking at stats results candidates
   * and matches that ID with the successful candidate pair. It looks at the type of local candidate it is
   * and then extracts the IP address from the relatedAddress or address property based on conditions known in webrtc
   * note, there are known incompatibilities and it is possible for this to set undefined, or for the IP address to be the public IP address
   * for example, firefox does not set the relayProtocol, and if the user is behind a NAT it might be the public IP
   * @private
   * @param {string} successfulCandidatePairId - The ID of the successful candidate pair.
   * @param {Object} candidates - the stats result candidates
   * @returns {void}
   */
  extractAndSetLocalIpAddressInfoForDiagnostics = (
    successfulCandidatePairId: string,
    candidates: {[key: string]: Record<string, unknown>}
  ) => {
    let newIpAddress = '';
    if (successfulCandidatePairId && !isEmpty(candidates)) {
      const localCandidate = candidates[successfulCandidatePairId];
      if (localCandidate) {
        if (localCandidate.candidateType === 'host') {
          // if it's a host candidate, use the address property - it will be the local IP
          newIpAddress = `${localCandidate.address}`;
        } else if (localCandidate.candidateType === 'prflx') {
          // if it's a peer reflexive candidate and we're not using a relay (there is no relayProtocol set)
          // then look at the relatedAddress - it will be the local
          //
          // Firefox doesn't populate the relayProtocol property
          if (!localCandidate.relayProtocol) {
            newIpAddress = `${localCandidate.relatedAddress}`;
          } else {
            // if it's a peer reflexive candidate and we are using a relay -
            // in that case the relatedAddress will be the IP of the TURN server (Linus),
            // so we can only look at the address, but it might be local IP or public IP,
            // depending on if the user is behind a NAT or not
            newIpAddress = `${localCandidate.address}`;
          }
        }
      }
    }
    this.localIpAddress = newIpAddress;
  };

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

    // We only care about the successful local candidate
    if (this.successfulCandidatePair?.localCandidateId !== result.id) {
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

    if (!this.statsResults.candidates) {
      this.statsResults.candidates = {};
    }

    this.statsResults.candidates[result.id] = {
      candidateType: result.candidateType,
      ipAddress: result.ip, // TODO: add ports
      relatedAddress: result.relatedAddress,
      relatedPort: result.relatedPort,
      relayProtocol: result.relayProtocol,
      protocol: result.protocol,
      address: result.address,
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
   *
   * @private
   * @param {*} result
   * @param {*} type
   * @returns {void}
   * @memberof StatsAnalyzer
   */
  compareSentAndReceived(result, type) {
    // Don't compare on transceivers without a sender.
    if (!type || !this.statsResults[type].send) {
      return;
    }

    const mediaType = type;

    const currentPacketLoss =
      result.packetsLost - this.statsResults[mediaType].send.totalPacketsLostOnReceiver;

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
