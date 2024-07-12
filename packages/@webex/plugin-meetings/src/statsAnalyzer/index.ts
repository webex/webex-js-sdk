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
  emptyAudioReceiveStream,
  emptyAudioTransmitStream,
  emptyVideoReceiveStream,
  emptyVideoTransmitStream,
} from '../mediaQualityMetrics/config';
import LoggerProxy from '../common/logs/logger-proxy';

import defaultStats from './global';
import {
  getAudioSenderMqa,
  getAudioReceiverMqa,
  getVideoSenderMqa,
  getVideoReceiverMqa,
  getAudioSenderStreamMqa,
  getAudioReceiverStreamMqa,
  getVideoSenderStreamMqa,
  getVideoReceiverStreamMqa,
  isStreamRequested,
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
type MediaStatus = {
  actual?: any;
  expected?: any;
};
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
  shareVideoEncoderImplementation?: string;
  receiveSlotCallback: ReceiveSlotCallback;
  isMultistream: boolean;

  /**
   * Creates a new instance of StatsAnalyzer
   * @constructor
   * @public
   * @param {Object} config - SDK Configuration Object
   * @param {Function} receiveSlotCallback - Callback used to access receive slots.
   * @param {Object} networkQualityMonitor - Class for assessing network characteristics (jitter, packetLoss, latency)
   * @param {Object} statsResults - Default properties for stats
   * @param {boolean | undefined} isMultistream - Param indicating if the media connection is multistream or not
   */
  constructor({
    config,
    receiveSlotCallback = () => undefined,
    networkQualityMonitor = {},
    statsResults = defaultStats,
    isMultistream = false,
  }: {
    config: any;
    receiveSlotCallback: ReceiveSlotCallback;
    networkQualityMonitor: any;
    statsResults?: any;
    isMultistream?: boolean;
  }) {
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
    this.isMultistream = isMultistream;
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
  public updateMediaStatus(status: MediaStatus) {
    this.meetingMediaStatus = {
      actual: {
        ...this.meetingMediaStatus?.actual,
        ...status?.actual,
      },
      expected: {
        ...this.meetingMediaStatus?.expected,
        ...status?.expected,
      },
    };
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

    // Fill in empty stats items for lastMqaDataSent
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
    });

    // Create stats the first level, totals for senders and receivers
    const audioSender = cloneDeep(emptyAudioTransmit);
    const audioShareSender = cloneDeep(emptyAudioTransmit);
    const audioReceiver = cloneDeep(emptyAudioReceive);
    const audioShareReceiver = cloneDeep(emptyAudioReceive);
    const videoSender = cloneDeep(emptyVideoTransmit);
    const videoShareSender = cloneDeep(emptyVideoTransmit);
    const videoReceiver = cloneDeep(emptyVideoReceive);
    const videoShareReceiver = cloneDeep(emptyVideoReceive);

    getAudioSenderMqa({
      audioSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'audio-send',
      isMultistream: this.isMultistream,
    });
    newMqa.audioTransmit.push(audioSender);

    getAudioSenderMqa({
      audioSender: audioShareSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'audio-share-send',
      isMultistream: this.isMultistream,
    });
    newMqa.audioTransmit.push(audioShareSender);

    getAudioReceiverMqa({
      audioReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'audio-recv',
      isMultistream: this.isMultistream,
    });
    newMqa.audioReceive.push(audioReceiver);

    getAudioReceiverMqa({
      audioReceiver: audioShareReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'audio-share-recv',
      isMultistream: this.isMultistream,
    });
    newMqa.audioReceive.push(audioShareReceiver);

    getVideoSenderMqa({
      videoSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'video-send',
      isMultistream: this.isMultistream,
    });
    newMqa.videoTransmit.push(videoSender);

    getVideoSenderMqa({
      videoSender: videoShareSender,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'video-share-send',
      isMultistream: this.isMultistream,
    });
    newMqa.videoTransmit.push(videoShareSender);

    getVideoReceiverMqa({
      videoReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'video-recv',
      isMultistream: this.isMultistream,
    });
    newMqa.videoReceive.push(videoReceiver);

    getVideoReceiverMqa({
      videoReceiver: videoShareReceiver,
      statsResults: this.statsResults,
      lastMqaDataSent: this.lastMqaDataSent,
      baseMediaType: 'video-share-recv',
      isMultistream: this.isMultistream,
    });
    newMqa.videoReceive.push(videoShareReceiver);

    // Add stats for individual streams
    Object.keys(this.statsResults).forEach((mediaType) => {
      if (mediaType.startsWith('audio-send')) {
        const audioSenderStream = cloneDeep(emptyAudioTransmitStream);

        getAudioSenderStreamMqa({
          audioSenderStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.SEND_DIRECTION)) {
          newMqa.audioTransmit[0].streams.push(audioSenderStream);
        }

        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.startsWith('audio-share-send')) {
        const audioSenderStream = cloneDeep(emptyAudioTransmitStream);

        getAudioSenderStreamMqa({
          audioSenderStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.SEND_DIRECTION)) {
          newMqa.audioTransmit[1].streams.push(audioSenderStream);
        }

        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.startsWith('audio-recv')) {
        const audioReceiverStream = cloneDeep(emptyAudioReceiveStream);

        getAudioReceiverStreamMqa({
          audioReceiverStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.RECEIVE_DIRECTION)) {
          newMqa.audioReceive[0].streams.push(audioReceiverStream);
        }

        this.lastMqaDataSent[mediaType].recv = cloneDeep(this.statsResults[mediaType].recv);
      } else if (mediaType.startsWith('audio-share-recv')) {
        const audioReceiverStream = cloneDeep(emptyAudioReceiveStream);

        getAudioReceiverStreamMqa({
          audioReceiverStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.RECEIVE_DIRECTION)) {
          newMqa.audioReceive[1].streams.push(audioReceiverStream);
        }
        this.lastMqaDataSent[mediaType].recv = cloneDeep(this.statsResults[mediaType].recv);
      } else if (mediaType.startsWith('video-send-layer')) {
        // We only want the stream-specific stats we get with video-send-layer-0, video-send-layer-1, etc.
        const videoSenderStream = cloneDeep(emptyVideoTransmitStream);

        getVideoSenderStreamMqa({
          videoSenderStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.SEND_DIRECTION)) {
          newMqa.videoTransmit[0].streams.push(videoSenderStream);
        }
        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.startsWith('video-share-send')) {
        const videoSenderStream = cloneDeep(emptyVideoTransmitStream);

        getVideoSenderStreamMqa({
          videoSenderStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.SEND_DIRECTION)) {
          newMqa.videoTransmit[1].streams.push(videoSenderStream);
        }

        this.lastMqaDataSent[mediaType].send = cloneDeep(this.statsResults[mediaType].send);
      } else if (mediaType.startsWith('video-recv')) {
        const videoReceiverStream = cloneDeep(emptyVideoReceiveStream);

        getVideoReceiverStreamMqa({
          videoReceiverStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.RECEIVE_DIRECTION)) {
          newMqa.videoReceive[0].streams.push(videoReceiverStream);
        }

        this.lastMqaDataSent[mediaType].recv = cloneDeep(this.statsResults[mediaType].recv);
      } else if (mediaType.startsWith('video-share-recv')) {
        const videoReceiverStream = cloneDeep(emptyVideoReceiveStream);

        getVideoReceiverStreamMqa({
          videoReceiverStream,
          statsResults: this.statsResults,
          lastMqaDataSent: this.lastMqaDataSent,
          mediaType,
        });
        if (isStreamRequested(this.statsResults, mediaType, STATS.RECEIVE_DIRECTION)) {
          newMqa.videoReceive[1].streams.push(videoReceiverStream);
        }
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

    const existingVideoSender = Object.keys(this.statsResults).find((item) =>
      item.includes('video-send')
    );

    if (existingVideoSender) {
      newMqa.intervalMetadata.peripherals.push({
        information: this.statsResults[existingVideoSender].trackLabel || _UNKNOWN_,
        name: MEDIA_DEVICES.CAMERA,
      });
    }

    newMqa.networkType = this.statsResults.connectionType.local.networkType;

    newMqa.intervalMetadata.screenWidth = window.screen.width;
    newMqa.intervalMetadata.screenHeight = window.screen.height;
    newMqa.intervalMetadata.screenResolution = Math.round(
      (window.screen.width * window.screen.height) / 256
    );
    newMqa.intervalMetadata.appWindowWidth = window.innerWidth;
    newMqa.intervalMetadata.appWindowHeight = window.innerHeight;
    newMqa.intervalMetadata.appWindowSize = Math.round(
      (window.innerWidth * window.innerHeight) / 256
    );

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

    let videoSenderIndex = 0;
    statsItem.report.forEach((result) => {
      if (types.includes(result.type)) {
        // if the video sender has multiple streams in the report, it is a new stream object.
        if (type === 'video-send' && result.type === 'outbound-rtp') {
          const newType = `video-send-layer-${videoSenderIndex}`;
          this.parseGetStatsResult(result, newType, isSender);
          videoSenderIndex += 1;

          this.statsResults[newType].direction = statsItem.currentDirection;
          this.statsResults[newType].trackLabel = statsItem.localTrackLabel;
          this.statsResults[newType].csi = statsItem.csi;
        } else if (type === 'video-share-send' && result.type === 'outbound-rtp') {
          this.shareVideoEncoderImplementation = result.encoderImplementation;
          this.parseGetStatsResult(result, type, isSender);
        } else {
          this.parseGetStatsResult(result, type, isSender);
        }
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
          .reduce(
            (prev, cur) =>
              prev +
              (this.statsResults[cur]?.[keyPrefix.includes('send') ? 'send' : 'recv'][value] || 0),
            0
          );

      const getPreviousStatsTotals = (keyPrefix: string, value: string): number =>
        Object.keys(this.statsResults)
          .filter((key) => key.startsWith(keyPrefix))
          .reduce(
            (prev, cur) =>
              prev +
              (this.lastStatsResults[cur]?.[keyPrefix.includes('send') ? 'send' : 'recv'][value] ||
                0),
            0
          );

      // Audio Transmit
      if (this.lastStatsResults['audio-send']) {
        // compare audio stats sent
        // NOTE: relies on there being only one sender.
        const currentStats = this.statsResults['audio-send'].send;
        const previousStats = this.lastStatsResults['audio-send'].send;

        if (
          (this.meetingMediaStatus.expected.sendAudio &&
            currentStats.totalPacketsSent === previousStats.totalPacketsSent) ||
          currentStats.totalPacketsSent === 0
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No audio RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            (this.meetingMediaStatus.expected.sendAudio &&
              currentStats.totalAudioEnergy === previousStats.totalAudioEnergy) ||
            currentStats.totalAudioEnergy === 0
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No audio Energy present`,
              currentStats.totalAudioEnergy
            );
          }

          if (this.meetingMediaStatus.expected.sendAudio && currentStats.audioLevel === 0) {
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

      // Audio Receive
      const currentAudioPacketsReceived = getCurrentStatsTotals(
        'audio-recv',
        'totalPacketsReceived'
      );
      const previousAudioPacketsReceived = getPreviousStatsTotals(
        'audio-recv',
        'totalPacketsReceived'
      );

      this.emitStartStopEvents(
        'audio',
        previousAudioPacketsReceived,
        currentAudioPacketsReceived,
        false
      );

      const currentTotalPacketsSent = getCurrentStatsTotals('video-send', 'totalPacketsSent');
      const previousTotalPacketsSent = getPreviousStatsTotals('video-send', 'totalPacketsSent');

      const currentFramesEncoded = getCurrentStatsTotals('video-send', 'framesEncoded');
      const previousFramesEncoded = getPreviousStatsTotals('video-send', 'framesEncoded');

      const currentFramesSent = getCurrentStatsTotals('video-send', 'framesSent');
      const previousFramesSent = getPreviousStatsTotals('video-send', 'framesSent');

      const doesVideoSendExist = Object.keys(this.lastStatsResults).some((item) =>
        item.includes('video-send')
      );

      // Video Transmit
      if (doesVideoSendExist) {
        // compare video stats sent

        if (
          this.meetingMediaStatus.expected.sendVideo &&
          (currentTotalPacketsSent === previousTotalPacketsSent || currentTotalPacketsSent === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No video RTP packets sent`,
            currentTotalPacketsSent
          );
        } else {
          if (
            this.meetingMediaStatus.expected.sendVideo &&
            (currentFramesEncoded === previousFramesEncoded || currentFramesEncoded === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames Encoded`,
              currentFramesEncoded
            );
          }

          if (
            this.meetingMediaStatus.expected.sendVideo &&
            (currentFramesSent === previousFramesSent || currentFramesSent === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No video Frames sent`,
              currentFramesSent
            );
          }
        }

        this.emitStartStopEvents('video', previousFramesSent, currentFramesSent, true);
      }

      // Video Receive
      const currentVideoFramesDecoded = getCurrentStatsTotals('video-recv', 'framesDecoded');
      const previousVideoFramesDecoded = getPreviousStatsTotals('video-recv', 'framesDecoded');

      this.emitStartStopEvents(
        'video',
        previousVideoFramesDecoded,
        currentVideoFramesDecoded,
        false
      );

      // Share Transmit
      if (this.lastStatsResults['video-share-send']) {
        // compare share stats sent

        const currentStats = this.statsResults['video-share-send'].send;
        const previousStats = this.lastStatsResults['video-share-send'].send;

        if (
          this.meetingMediaStatus.expected.sendShare &&
          (currentStats.totalPacketsSent === previousStats.totalPacketsSent ||
            currentStats.totalPacketsSent === 0)
        ) {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#compareLastStatsResult --> No share RTP packets sent`,
            currentStats.totalPacketsSent
          );
        } else {
          if (
            this.meetingMediaStatus.expected.sendShare &&
            (currentStats.framesEncoded === previousStats.framesEncoded ||
              currentStats.framesEncoded === 0)
          ) {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#compareLastStatsResult --> No share frames getting encoded`,
              currentStats.framesEncoded
            );
          }

          if (
            this.meetingMediaStatus.expected.sendShare &&
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

      // Share receive
      const currentShareFramesDecoded = getCurrentStatsTotals('video-share-recv', 'framesDecoded');
      const previousShareFramesDecoded = getPreviousStatsTotals(
        'video-share-recv',
        'framesDecoded'
      );

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
      this.statsResults[mediaType][sendrecvType].totalRtxPacketsSent =
        result.retransmittedPacketsSent;
      this.statsResults[mediaType][sendrecvType].totalRtxBytesSent = result.retransmittedBytesSent;
      this.statsResults[mediaType][sendrecvType].totalBytesSent = result.bytesSent;
      this.statsResults[mediaType][sendrecvType].headerBytesSent = result.headerBytesSent;
      this.statsResults[mediaType][sendrecvType].retransmittedBytesSent =
        result.retransmittedBytesSent;
      this.statsResults[mediaType][sendrecvType].isRequested = result.isRequested;
      this.statsResults[mediaType][sendrecvType].lastRequestedUpdateTimestamp =
        result.lastRequestedUpdateTimestamp;
      this.statsResults[mediaType][sendrecvType].requestedBitrate = result.requestedBitrate;
      this.statsResults[mediaType][sendrecvType].requestedFrameSize = result.requestedFrameSize;
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
      const sourceState = receiveSlot?.sourceState;
      const idAndCsi = receiveSlot
        ? `id: "${receiveSlot.id || ''}"${receiveSlot.csi ? ` and csi: ${receiveSlot.csi}` : ''}`
        : '';

      const bytes =
        result.bytesReceived - this.statsResults[mediaType][sendrecvType].totalBytesReceived;

      kilobytes = bytes / 1024;
      this.statsResults[mediaType][sendrecvType].availableBandwidth = kilobytes.toFixed(1);

      let currentPacketsLost =
        result.packetsLost - this.statsResults[mediaType][sendrecvType].totalPacketsLost;
      if (currentPacketsLost < 0) {
        currentPacketsLost = 0;
      }
      const packetsReceivedDiff =
        result.packetsReceived - this.statsResults[mediaType][sendrecvType].totalPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;

      if (packetsReceivedDiff === 0) {
        if (receiveSlot && sourceState === 'live') {
          LoggerProxy.logger.info(
            `StatsAnalyzer:index#processInboundRTPResult --> No packets received for mediaType: ${mediaType}, receive slot ${idAndCsi}. Total packets received on slot: `,
            result.packetsReceived
          );
        }
      }

      if (mediaType.startsWith('video') || mediaType.startsWith('share')) {
        const videoFramesReceivedDiff =
          result.framesReceived - this.statsResults[mediaType][sendrecvType].framesReceived;

        if (videoFramesReceivedDiff === 0) {
          if (receiveSlot && sourceState === 'live') {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#processInboundRTPResult --> No frames received for mediaType: ${mediaType},  receive slot ${idAndCsi}. Total frames received on slot: `,
              result.framesReceived
            );
          }
        }

        const videoFramesDecodedDiff =
          result.framesDecoded - this.statsResults[mediaType][sendrecvType].framesDecoded;

        if (videoFramesDecodedDiff === 0) {
          if (receiveSlot && sourceState === 'live') {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#processInboundRTPResult --> No frames decoded for mediaType: ${mediaType},  receive slot ${idAndCsi}. Total frames decoded on slot: `,
              result.framesDecoded
            );
          }
        }

        const videoFramesDroppedDiff =
          result.framesDropped - this.statsResults[mediaType][sendrecvType].framesDropped;

        if (videoFramesDroppedDiff > 10) {
          if (receiveSlot && sourceState === 'live') {
            LoggerProxy.logger.info(
              `StatsAnalyzer:index#processInboundRTPResult --> Frames dropped for mediaType: ${mediaType},  receive slot ${idAndCsi}. Total frames dropped on slot: `,
              result.framesDropped
            );
          }
        }
      }

      if (mediaType.startsWith('video-recv')) {
        this.statsResults[mediaType][sendrecvType].isActiveSpeaker = result.isActiveSpeaker;
        this.statsResults[mediaType][sendrecvType].lastActiveSpeakerTimestamp =
          result.lastActiveSpeakerUpdateTimestamp;
      }

      //  Check the over all packet Lost ratio
      this.statsResults[mediaType][sendrecvType].currentPacketLossRatio =
        currentPacketsLost > 0
          ? currentPacketsLost / (packetsReceivedDiff + currentPacketsLost)
          : 0;
      if (this.statsResults[mediaType][sendrecvType].currentPacketLossRatio > 3) {
        LoggerProxy.logger.info(
          `StatsAnalyzer:index#processInboundRTPResult --> Packets getting lost from the receiver with slot ${idAndCsi}`,
          this.statsResults[mediaType][sendrecvType].currentPacketLossRatio
        );
      }

      if (result.frameWidth && result.frameHeight) {
        this.statsResults[mediaType][sendrecvType].width = result.frameWidth;
        this.statsResults[mediaType][sendrecvType].height = result.frameHeight;
        this.statsResults[mediaType][sendrecvType].framesReceived = result.framesReceived;
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
      this.statsResults[mediaType][sendrecvType].requestedBitrate = result.requestedBitrate;
      this.statsResults[mediaType][sendrecvType].requestedFrameSize = result.requestedFrameSize;

      // From Thin
      this.statsResults[mediaType][sendrecvType].totalNackCount = result.nackCount;
      this.statsResults[mediaType][sendrecvType].totalPliCount = result.pliCount;
      this.statsResults[mediaType][sendrecvType].framesDecoded = result.framesDecoded;
      this.statsResults[mediaType][sendrecvType].keyFramesDecoded = result.keyFramesDecoded;
      this.statsResults[mediaType][sendrecvType].framesDropped = result.framesDropped;

      this.statsResults[mediaType][sendrecvType].decoderImplementation =
        result.decoderImplementation;
      this.statsResults[mediaType][sendrecvType].totalPacketsReceived = result.packetsReceived;

      this.statsResults[mediaType][sendrecvType].fecPacketsDiscarded = result.fecPacketsDiscarded;
      this.statsResults[mediaType][sendrecvType].fecPacketsReceived = result.fecPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalBytesReceived = result.bytesReceived;
      this.statsResults[mediaType][sendrecvType].headerBytesReceived = result.headerBytesReceived;
      this.statsResults[mediaType][sendrecvType].totalRtxPacketsReceived =
        result.retransmittedPacketsReceived;
      this.statsResults[mediaType][sendrecvType].totalRtxBytesReceived =
        result.retransmittedBytesReceived;

      this.statsResults[mediaType][sendrecvType].meanRtpJitter.push(result.jitter);

      // Audio stats

      this.statsResults[mediaType][sendrecvType].audioLevel = result.audioLevel;
      this.statsResults[mediaType][sendrecvType].totalAudioEnergy = result.totalAudioEnergy;
      this.statsResults[mediaType][sendrecvType].totalSamplesReceived =
        result.totalSamplesReceived || 0;
      this.statsResults[mediaType][sendrecvType].totalSamplesDecoded =
        result.totalSamplesDecoded || 0;
      this.statsResults[mediaType][sendrecvType].concealedSamples = result.concealedSamples || 0;
      this.statsResults[mediaType][sendrecvType].isRequested = result.isRequested;
      this.statsResults[mediaType][sendrecvType].lastRequestedUpdateTimestamp =
        result.lastRequestedUpdateTimestamp;
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
