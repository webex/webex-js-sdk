/* eslint-disable class-methods-use-this */
import {
  LocalCameraStream,
  LocalMicrophoneStream,
  LocalDisplayStream,
  LocalSystemAudioStream,
  RemoteStream,
} from '@webex/media-helpers';

import {MEETINGS, QUALITY_LEVELS} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';
import MediaConnectionAwaiter from './MediaConnectionAwaiter';

export type MediaDirection = {
  sendAudio: boolean;
  sendVideo: boolean;
  sendShare: boolean;
  receiveAudio: boolean;
  receiveVideo: boolean;
  receiveShare: boolean;
};

/**
 * @class MediaProperties
 */
export default class MediaProperties {
  audioStream?: LocalMicrophoneStream | null;
  mediaDirection: MediaDirection;
  mediaSettings: any;
  webrtcMediaConnection: any;
  remoteAudioStream: RemoteStream | undefined | null;
  remoteQualityLevel: any;
  remoteShareStream: RemoteStream | undefined | null;
  remoteVideoStream: RemoteStream | undefined | null;
  shareVideoStream?: LocalDisplayStream | null;
  shareAudioStream?: LocalSystemAudioStream | null;
  videoDeviceId: any;
  videoStream?: LocalCameraStream | null;
  namespace = MEETINGS;

  /**
   * @param {Object} [options] -- to auto construct
   * @returns {MediaProperties}
   */
  constructor() {
    this.webrtcMediaConnection = null;
    this.mediaDirection = {
      receiveAudio: false,
      receiveVideo: false,
      receiveShare: false,
      sendAudio: false,
      sendVideo: false,
      sendShare: false,
    };
    this.videoStream = null;
    this.audioStream = null;
    this.shareVideoStream = null;
    this.shareAudioStream = null;
    this.remoteShareStream = undefined;
    this.remoteAudioStream = undefined;
    this.remoteVideoStream = undefined;
    this.remoteQualityLevel = QUALITY_LEVELS.HIGH;
    this.mediaSettings = {};
    this.videoDeviceId = null;
  }

  /**
   * Retrieves the preferred video input device
   * @returns {Object|null}
   */
  getVideoDeviceId() {
    return this.videoDeviceId || null;
  }

  setMediaDirection(mediaDirection: MediaDirection) {
    this.mediaDirection = mediaDirection;
  }

  setMediaSettings(type: string, values: unknown) {
    this.mediaSettings[type] = values;
  }

  setMediaPeerConnection(mediaPeerConnection: unknown) {
    this.webrtcMediaConnection = mediaPeerConnection;
  }

  setLocalVideoStream(videoStream?: LocalCameraStream) {
    this.videoStream = videoStream;
  }

  setLocalAudioStream(audioStream?: LocalMicrophoneStream) {
    this.audioStream = audioStream;
  }

  setLocalShareVideoStream(shareVideoStream?: LocalDisplayStream) {
    this.shareVideoStream = shareVideoStream;
  }

  setLocalShareAudioStream(shareAudioStream?: LocalSystemAudioStream) {
    this.shareAudioStream = shareAudioStream;
  }

  setRemoteQualityLevel(remoteQualityLevel: unknown) {
    this.remoteQualityLevel = remoteQualityLevel;
  }

  setRemoteShareStream(remoteShareStream: RemoteStream) {
    this.remoteShareStream = remoteShareStream;
  }

  /**
   * Sets the remote audio stream
   * @param {RemoteStream} remoteAudioStream RemoteStream to save
   * @returns {void}
   */
  setRemoteAudioStream(remoteAudioStream: RemoteStream) {
    this.remoteAudioStream = remoteAudioStream;
  }

  /**
   * Sets the remote video stream
   * @param {RemoteStream} remoteVideoStream RemoteStream to save
   * @returns {void}
   */
  setRemoteVideoStream(remoteVideoStream: RemoteStream) {
    this.remoteVideoStream = remoteVideoStream;
  }

  /**
   * Stores the preferred video input device
   * @param {string} deviceId Preferred video input device
   * @returns {void}
   */
  setVideoDeviceId(deviceId: string) {
    this.videoDeviceId = deviceId;
  }

  unsetPeerConnection() {
    this.webrtcMediaConnection = null;
  }

  /**
   * Removes both remote audio and video from class instance
   * @returns {void}
   */
  unsetRemoteMedia() {
    this.remoteAudioStream = null;
    this.remoteVideoStream = null;
  }

  unsetRemoteShareStream() {
    this.remoteShareStream = null;
  }

  /**
   * Unsets all remote streams
   * @returns {void}
   */
  unsetRemoteStreams() {
    this.unsetRemoteMedia();
    this.unsetRemoteShareStream();
  }

  /**
   * Returns if we have at least one local share stream or not.
   * @returns {Boolean}
   */
  hasLocalShareStream() {
    return !!(this.shareAudioStream || this.shareVideoStream);
  }

  /**
   * Waits for the webrtc media connection to be connected.
   *
   * @returns {Promise<void>}
   */
  waitForMediaConnectionConnected(): Promise<void> {
    const mediaConnectionAwaiter = new MediaConnectionAwaiter({
      webrtcMediaConnection: this.webrtcMediaConnection,
    });

    return mediaConnectionAwaiter.waitForMediaConnectionConnected();
  }

  /**
   * Returns ICE transport information:
   * - selectedCandidatePairChanges - number of times the selected candidate pair was changed, it should be at least 1 for successful connections
   *  it will be -1 if browser doesn't supply this information
   * - numTransports - number of transports (should be 1 if we're using bundle)
   *
   * @param {Array<any>} allStatsReports array of RTC stats reports
   * @returns {Object}
   */
  private getTransportInfo(allStatsReports: any[]): {
    selectedCandidatePairChanges: number;
    numTransports: number;
  } {
    const transports = allStatsReports.filter((report) => report.type === 'transport');

    if (transports.length > 1) {
      LoggerProxy.logger.warn(
        `Media:properties#getSelectedCandidatePairChanges --> found more than 1 transport: ${transports.length}`
      );
    }

    return {
      selectedCandidatePairChanges:
        transports.length > 0 && transports[0].selectedCandidatePairChanges !== undefined
          ? transports[0].selectedCandidatePairChanges
          : -1,
      numTransports: transports.length,
    };
  }

  /**
   * Returns the type of a connection that has been established
   * It should be 'UDP' | 'TCP' | 'TURN-TLS' | 'TURN-TCP' | 'TURN-UDP' | 'unknown'
   *
   * If connection was not established, it returns 'unknown'
   *
   * @param {Array<any>} allStatsReports array of RTC stats reports
   * @returns {string}
   */
  private getConnectionType(allStatsReports: any[]) {
    const successfulCandidatePairs = allStatsReports.filter(
      (report) => report.type === 'candidate-pair' && report.state?.toLowerCase() === 'succeeded'
    );

    let foundConnectionType = 'unknown';

    // all of the successful pairs should have the same connection type, so just return the type for the first one
    successfulCandidatePairs.some((pair) => {
      const localCandidate = allStatsReports.find(
        (report) => report.type === 'local-candidate' && report.id === pair.localCandidateId
      );

      if (localCandidate === undefined) {
        LoggerProxy.logger.warn(
          `Media:properties#getConnectionType --> failed to find local candidate "${pair.localCandidateId}" in getStats() results`
        );

        return false;
      }

      let connectionType;

      if (localCandidate.relayProtocol) {
        connectionType = `TURN-${localCandidate.relayProtocol.toUpperCase()}`;
      } else {
        connectionType = localCandidate.protocol?.toUpperCase(); // it will be UDP or TCP
      }

      if (connectionType) {
        foundConnectionType = connectionType;

        return true;
      }
      LoggerProxy.logger.warn(
        `Media:properties#getConnectionType --> missing localCandidate.protocol, candidateType=${localCandidate.candidateType}`
      );

      return false;
    });

    if (foundConnectionType === 'unknown') {
      const candidatePairStates = allStatsReports
        .filter((report) => report.type === 'candidate-pair')
        .map((report) => report.state);

      LoggerProxy.logger.warn(
        `Media:properties#getConnectionType --> all candidate pair states: ${JSON.stringify(
          candidatePairStates
        )}`
      );
    }

    return foundConnectionType;
  }

  /**
   * Returns information about current webrtc media connection
   *
   * @returns {Promise<Object>}
   */
  async getCurrentConnectionInfo(): Promise<{
    connectionType: string;
    selectedCandidatePairChanges: number;
    numTransports: number;
  }> {
    const allStatsReports: Record<string, any>[] = [];

    try {
      const statsResult = await this.webrtcMediaConnection.getStats();
      statsResult.forEach((report: Record<string, any>) => allStatsReports.push(report));
    } catch (error) {
      LoggerProxy.logger.warn(
        `Media:properties#getCurrentConnectionInfo --> getStats() failed: ${error}`
      );
    }

    const connectionType = this.getConnectionType(allStatsReports);
    const {selectedCandidatePairChanges, numTransports} = this.getTransportInfo(allStatsReports);

    return {
      connectionType,
      selectedCandidatePairChanges,
      numTransports,
    };
  }
}
