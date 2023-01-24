import {ICE_STATE, MEETINGS, PC_BAIL_TIMEOUT, QUALITY_LEVELS} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

import MediaUtil from './util';

/**
 * @class MediaProperties
 */
export default class MediaProperties {
  audioTrack: any;
  localQualityLevel: any;
  mediaDirection: any;
  mediaSettings: any;
  peerConnection: any;
  remoteAudioTrack: any;
  remoteQualityLevel: any;
  remoteShare: any;
  remoteVideoTrack: any;
  shareTrack: any;
  videoDeviceId: any;
  videoTrack: any;
  namespace = MEETINGS;

  /**
   * @param {Object} [options] -- to auto construct
   * @returns {MediaProperties}
   */
  constructor(options: any = {}) {
    this.peerConnection = MediaUtil.createPeerConnection();
    this.mediaDirection = options.mediaDirection;
    this.videoTrack = options.videoTrack;
    this.audioTrack = options.audioTrack;
    this.shareTrack = options.shareTrack;
    this.remoteShare = options.remoteShare;
    this.remoteAudioTrack = options.remoteAudioTrack;
    this.remoteVideoTrack = options.remoteVideoTrack;
    this.localQualityLevel = options.localQualityLevel || QUALITY_LEVELS['720p'];
    this.remoteQualityLevel = options.remoteQualityLevel || QUALITY_LEVELS.HIGH;
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

  setMediaDirection(mediaDirection) {
    this.mediaDirection = mediaDirection;
  }

  setMediaSettings(type, values) {
    this.mediaSettings[type] = values;
  }

  setMediaPeerConnection(peerConnection) {
    this.peerConnection = peerConnection;
  }

  setLocalVideoTrack(videoTrack) {
    this.videoTrack = videoTrack;
  }

  setLocalAudioTrack(audioTrack) {
    this.audioTrack = audioTrack;
  }

  setLocalQualityLevel(localQualityLevel) {
    this.localQualityLevel = localQualityLevel;
  }

  setLocalShareTrack(shareTrack) {
    this.shareTrack = shareTrack;
  }

  setRemoteQualityLevel(remoteQualityLevel) {
    this.remoteQualityLevel = remoteQualityLevel;
  }

  setRemoteShare(remoteShare) {
    this.remoteShare = remoteShare;
  }

  /**
   * Sets the remote audio track
   * @param {MediaTrack} remoteAudioTrack MediaTrack to save
   * @returns {void}
   */
  setRemoteAudioTrack(remoteAudioTrack: any) {
    this.remoteAudioTrack = remoteAudioTrack;
  }

  /**
   * Sets the remote video track
   * @param {MediaTrack} remoteVideoTrack MediaTrack to save
   * @returns {void}
   */
  setRemoteVideoTrack(remoteVideoTrack: any) {
    this.remoteVideoTrack = remoteVideoTrack;
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
    this.peerConnection = null;
  }

  reInitiatePeerconnection(turnServerInfo) {
    this.peerConnection = MediaUtil.createPeerConnection(turnServerInfo);
  }

  unsetLocalVideoTrack() {
    this.videoTrack = null;
  }

  unsetLocalShareTrack() {
    this.shareTrack = null;
  }

  unsetLocalAudioTrack() {
    this.audioTrack = null;
  }

  /**
   * Removes remote stream from class instance
   * @deprecated after v1.89.3
   * @returns {void}
   */
  unsetRemoteStream() {
    LoggerProxy.logger.warn(
      'Media:properties#unsetRemoteStream --> [DEPRECATION WARNING]: unsetRemoteStream has been deprecated after v1.89.3 (use unsetRemoteTracks instead)'
    );
    // unsets audio and video only
    this.unsetRemoteMedia();
  }

  /**
   * Removes both remote audio and video from class instance
   * @returns {void}
   */
  unsetRemoteMedia() {
    this.remoteAudioTrack = null;
    this.remoteVideoTrack = null;
  }

  unsetRemoteShare() {
    this.remoteShare = null;
  }

  unsetLocalVideoTracks() {
    this.unsetLocalVideoTrack();
    this.unsetLocalShareTrack();
  }

  /**
   * Removes remote stream and remote share from class instance
   * @deprecated after v1.89.3
   * @returns {void}
   */
  unsetRemoteStreams() {
    LoggerProxy.logger.warn(
      'Media:properties#unsetRemoteStreams --> [DEPRECATION WARNING]: unsetRemoteStreams has been deprecated after v1.89.3 (use unsetRemoteTracks instead)'
    );
    this.unsetRemoteStream();
    this.unsetRemoteShare();
  }

  /**
   * Unsets all remote tracks
   * @returns {void}
   */
  unsetRemoteTracks() {
    this.unsetRemoteMedia();
    this.unsetRemoteShare();
  }

  unsetShareStreams() {
    this.unsetLocalShareTrack();
    this.unsetRemoteShare();
  }

  /**
   * Removes both local and remote video stream from class instance
   * @deprecated after v1.89.3
   * @returns {void}
   */
  unsetMediaStreams() {
    LoggerProxy.logger.warn(
      'Media:properties#unsetMediaStreams --> [DEPRECATION WARNING]: unsetMediaStreams has been deprecated after v1.89.3 (use unsetMediaTracks instead)'
    );
    this.unsetLocalVideoTrack();
    this.unsetRemoteStream();
  }

  /**
   * Removes both local and remote video stream from class instance
   * @returns {void}
   */
  unsetMediaTracks() {
    this.unsetLocalVideoTrack();
    this.unsetRemoteMedia();
  }

  /**
   * Waits until ice connection is established
   *
   * @returns {Promise<void>}
   */
  waitForIceConnectedState() {
    const isIceConnected = () =>
      this.peerConnection.iceConnectionState === ICE_STATE.CONNECTED ||
      this.peerConnection.iceConnectionState === ICE_STATE.COMPLETED;

    if (isIceConnected()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let timer;

      const iceListener = () => {
        LoggerProxy.logger.log(
          `Media:properties#waitForIceConnectedState --> ice state: ${this.peerConnection.iceConnectionState}, conn state: ${this.peerConnection.connectionState}`
        );

        if (isIceConnected()) {
          clearTimeout(timer);
          this.peerConnection.removeEventListener('iceconnectionstatechange', iceListener);
          resolve();
        }
      };

      timer = setTimeout(() => {
        this.peerConnection.removeEventListener('iceconnectionstatechange', iceListener);
        reject();
      }, PC_BAIL_TIMEOUT);

      this.peerConnection.addEventListener('iceconnectionstatechange', iceListener);
    });
  }

  /**
   * Returns the type of a connection that has been established
   *
   * @returns {Promise<'UDP' | 'TCP' | 'TURN-TLS' | 'TURN-TCP' | 'TURN-UDP' | 'unknown'>}
   */
  async getCurrentConnectionType() {
    // we can only get the connection type after ICE connection has been established
    await this.waitForIceConnectedState();

    const allStatsReports = [];

    try {
      // eslint-disable-next-line no-await-in-loop
      const statsResult = await this.peerConnection.getStats();

      statsResult.forEach((report) => allStatsReports.push(report));
    } catch (error) {
      LoggerProxy.logger.warn(
        `Media:properties#getCurrentConnectionType --> getStats() failed: ${error}`
      );
    }

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
          `Media:properties#getCurrentConnectionType --> failed to find local candidate "${pair.localCandidateId}" in getStats() results`
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

      return false;
    });

    return foundConnectionType;
  }
}
