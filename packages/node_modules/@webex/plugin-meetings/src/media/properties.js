import {
  MEETINGS,
  QUALITY_LEVELS
} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

import MediaUtil from './util';

/**
 * @class MediaProperties
 */
export default class MediaProperties {
  namespace = MEETINGS;

  /**
   * @param {Object} [options] -- to auto construct
   * @returns {MediaProperties}
   */
  constructor(options = {}) {
    this.peerConnection = MediaUtil.createPeerConnection();
    this.mediaDirection = options.mediaDirection;
    this.videoTrack = options.videoTrack;
    this.audioTrack = options.audioTrack;
    this.shareTrack = options.shareTrack;
    this.remoteShare = options.remoteShare;
    this.remoteAudioTrack = options.remoteAudioTrack;
    this.remoteVideoTrack = options.remoteVideoTrack;
    this.localQualityLevel = options.localQualityLevel || QUALITY_LEVELS.HIGH;
    this.remoteQualityLevel = options.remoteQualityLevel || QUALITY_LEVELS.HIGH;
    this.mediaSettings = {};
    this.videoDeviceId = null;

    // deprecated after v1.89.3, remove when feasible.
    // backwards compatible code.
    Object.defineProperty(this, 'remoteStream', {
      set: (stream) => {
        const audio = stream.getAudioTracks();
        const video = stream.getVideoTracks();

        this.remoteAudioTrack = audio.length && audio[0];
        this.remoteVideoTrack = video.length && video[0];
      },
      get: () => {
        LoggerProxy.logger.warn('Media:properties#remoteStream --> [DEPRECATION WARNING]: remoteStream (getter) has been deprecated after v1.89.3 (use remoteAudioTrack, remoteVideoTrack instead)');

        // return if set or create a stream for backwards compatibility
        return MediaUtil.createMediaStream([this.remoteAudioTrack, this.remoteVideoTrack]);
      }
    });
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

  /**
   * @deprecated after v1.89.3
   * @param {remoteStream} remoteStream Sets remote media stream
   * @returns {null}
   * Use setRemoteAudioTrack, setRemoteVideoTrack
   * and setRemoteShareTrack.
   */
  setRemoteStream(remoteStream) {
    LoggerProxy.logger.warn('Media:properties#setRemoteStream --> [DEPRECATION WARNING]: setRemoteStream has been deprecated after v1.89.3 (use setRemoteAudioTrack, setRemoteVideoTrack instead)');
    // calls setter
    this.remoteStream = remoteStream;
  }

  setRemoteShare(remoteShare) {
    this.remoteShare = remoteShare;
  }

  /**
   * Sets the remote audio track
   * @param {MediaTrack} remoteAudioTrack MediaTrack to save
   * @returns {void}
   */
  setRemoteAudioTrack(remoteAudioTrack) {
    this.remoteAudioTrack = remoteAudioTrack;
  }

  /**
   * Sets the remote video track
   * @param {MediaTrack} remoteVideoTrack MediaTrack to save
   * @returns {void}
   */
  setRemoteVideoTrack(remoteVideoTrack) {
    this.remoteVideoTrack = remoteVideoTrack;
  }

  /**
   * Stores the preferred video input device
   * @param {string} deviceId Preferred video input device
   * @returns {void}
   */
  setVideoDeviceId(deviceId) {
    this.videoDeviceId = deviceId;
  }

  unsetPeerConnection() {
    this.peerConnection = null;
  }

  reInitiatePeerconnection() {
    this.peerConnection = MediaUtil.createPeerConnection();
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
    LoggerProxy.logger.warn('Media:properties#unsetRemoteStream --> [DEPRECATION WARNING]: unsetRemoteStream has been deprecated after v1.89.3 (use unsetRemoteTracks instead)');
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
    LoggerProxy.logger.warn('Media:properties#unsetRemoteStreams --> [DEPRECATION WARNING]: unsetRemoteStreams has been deprecated after v1.89.3 (use unsetRemoteTracks instead)');
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
    LoggerProxy.logger.warn('Media:properties#unsetMediaStreams --> [DEPRECATION WARNING]: unsetMediaStreams has been deprecated after v1.89.3 (use unsetMediaTracks instead)');
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
}
