/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
/* globals navigator */

import {
  LocalCameraTrack,
  LocalDisplayTrack,
  LocalMicrophoneTrack,
  RoapMediaConnection,
  MultistreamRoapMediaConnection,
} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {AUDIO_INPUT, VIDEO_INPUT, MEDIA_TRACK_CONSTRAINT} from '../constants';
import Config from '../config';
import StaticConfig from '../common/config';
import MediaError from '../common/errors/media';
import BrowserDetection from '../common/browser-detection';

const {isBrowser} = BrowserDetection();

/**
 * MediaDirection
 * @typedef {Object} MediaDirection
 * @property {boolean} sendAudio
 * @property {boolean} receiveAudio
 * @property {boolean} sendVideo
 * @property {boolean} receiveVideo
 * @property {boolean} sendShare
 * @property {boolean} receiveShare
 */

/**
 * SendOptions
 * @typedef {Object} SendOptions
 * @property sendAudio
 * @property sendVideo
 * @property sendShare
 * @property isSharing
 * @property {Object} sharePreferences
 */
/**
 *
 * @public
 * @export
 * Mimic browser APIs as "the ultimate browser".
 * Handles the quirks of each browser.
 * Extends and enhances adapter.js, i.e., the "media" file from the web client.
 */
const Media: any = {};

/**
 * format the media array for send
 * @param {String} mediaId
 * @param {Boolean} audioMuted
 * @param {Boolean} videoMuted
 * @returns {Array} medias
 */
Media.generateLocalMedias = (mediaId: string, audioMuted: boolean, videoMuted: boolean) => {
  if (mediaId) {
    return [
      {
        localSdp: JSON.stringify({
          audioMuted,
          videoMuted,
        }),
        mediaId,
      },
    ];
  }

  return [];
};

/**
 * make a browser call to get the media
 * @param {SendOptions} options
 * @param {Object} config SDK Configuration for meetings plugin
 * @returns {Promise}
 */
Media.getLocalMedia = (options: any, config: object) => {
  const {sendAudio, sendVideo, sendShare, sharePreferences, isSharing} = options;

  if (sendAudio || sendVideo) {
    return Media.getMedia(sendAudio, sendVideo, config);
  }

  if (sendShare && !isSharing) {
    return Media.getDisplayMedia(
      {
        sendAudio: false,
        sendShare: true,
        sharePreferences,
      },
      config
    );
  }

  return Promise.resolve(undefined);
};

/**
 * creates a webrtc media connection with provided tracks and mediaDirection configuration
 *
 * @param {boolean} isMultistream
 * @param {string} debugId string useful for debugging (will appear in media connection logs)
 * @param {Object} options
 * @param {Object} [options.mediaProperties] only applicable to non-multistream connections, contains mediaDirection and local tracks:
 *                                 audioTrack, videoTrack and shareTrack
 * @param {string} [options.remoteQualityLevel] LOW|MEDIUM|HIGH applicable only to non-multistream connections
 * @param {boolean} [options.enableRtx] applicable only to non-multistream connections
 * @param {boolean} [options.enableExtmap] applicable only to non-multistream connections
 * @param {Object} [options.turnServerInfo]
 * @returns {RoapMediaConnection | MultistreamRoapMediaConnection}
 */
Media.createMediaConnection = (
  isMultistream: boolean,
  debugId: string,
  options: {
    mediaProperties?: {
      mediaDirection?: {
        receiveAudio: boolean;
        receiveVideo: boolean;
        receiveShare: boolean;
      };
      audioTrack?: LocalMicrophoneTrack;
      videoTrack?: LocalCameraTrack;
      shareTrack?: LocalDisplayTrack;
    };
    remoteQualityLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    enableRtx?: boolean;
    enableExtmap?: boolean;
    turnServerInfo?: {
      url: string;
      username: string;
      password: string;
    };
  }
) => {
  const {mediaProperties, remoteQualityLevel, enableRtx, enableExtmap, turnServerInfo} = options;

  const iceServers = [];

  if (turnServerInfo) {
    iceServers.push({
      urls: turnServerInfo.url,
      username: turnServerInfo.username || '',
      credential: turnServerInfo.password || '',
    });
  }

  if (isMultistream) {
    return new MultistreamRoapMediaConnection(
      {
        iceServers,
      },
      debugId
    );
  }

  if (!mediaProperties) {
    throw new Error('mediaProperties have to be provided for non-multistream media connections');
  }

  const {mediaDirection, audioTrack, videoTrack, shareTrack} = mediaProperties;

  return new RoapMediaConnection(
    {
      iceServers,
      skipInactiveTransceivers: false,
      requireH264: true,
      sdpMunging: {
        convertPort9to0: false,
        addContentSlides: true,
        bandwidthLimits: {
          audio: StaticConfig.meetings.bandwidth.audio,
          video: StaticConfig.meetings.bandwidth.video,
        },
        startBitrate: StaticConfig.meetings.bandwidth.startBitrate,
        periodicKeyframes: 20, // it's always been hardcoded in SDK so for now keeping it that way
        disableExtmap: !enableExtmap,
        disableRtx: !enableRtx, // see https://bugs.chromium.org/p/chromium/issues/detail?id=1020642 why we might want to remove RTX from SDP
      },
    },
    {
      send: {
        audio: audioTrack?.underlyingTrack,
        video: videoTrack?.underlyingTrack,
        screenShareVideo: shareTrack?.underlyingTrack,
      },
      receive: {
        audio: mediaDirection.receiveAudio,
        video: mediaDirection.receiveVideo,
        screenShareVideo: mediaDirection.receiveShare,
        remoteQualityLevel,
      },
    },
    debugId
  );
};

/**
 * generates share streams
 * @param {Object} options parameter
 * @param {Boolean} options.sendAudio send audio from the display share
 * @param {Boolean} options.sendShare send video from the display share
 * @param {Object} options.sharePreferences
 * @param {MediaTrackConstraints} options.sharePreferences.shareConstraints constraints to apply to video
 *   @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints}
 * @param {Boolean} options.sharePreferences.highFrameRate if shareConstraints isn't provided, set default values based off of this boolean
 * @param {Object} config SDK Configuration for meetings plugin
 * @returns {Promise.<MediaStream>}
 */
Media.getDisplayMedia = (
  options: {
    sendAudio: boolean;
    sendShare: boolean;
    sharePreferences: {
      shareConstraints: MediaTrackConstraints;
      highFrameRate: any;
    };
  },
  config: any = {}
) => {
  // SDK screen share resolution settings from Webex.init
  const customResolution = config.screenResolution || {};
  // user defined screen share frame rate
  const customShareFrameRate = config.screenFrameRate || null;
  // user defined share preferences
  const hasSharePreferences = options.sharePreferences;
  const hasCustomConstraints = hasSharePreferences && hasSharePreferences.shareConstraints;
  const hasHighFrameRate = hasSharePreferences && hasSharePreferences.highFrameRate;
  const {screenResolution, resolution, videoShareFrameRate, screenFrameRate, aspectRatio} =
    Config.meetings;

  let shareConstraints: any = {
    cursor: MEDIA_TRACK_CONSTRAINT.CURSOR.AWLAYS,
    aspectRatio,
  };

  if (hasCustomConstraints) {
    shareConstraints = hasSharePreferences.shareConstraints;
  } else if (hasHighFrameRate) {
    shareConstraints = {
      ...shareConstraints,
      frameRate: videoShareFrameRate,
      height: resolution.idealHeight,
      width: resolution.idealWidth,
      ...config.resolution,
    };
  } else {
    shareConstraints = {
      ...shareConstraints,
      frameRate: customShareFrameRate || screenFrameRate,
      height: customResolution.idealHeight || screenResolution.idealHeight,
      width: customResolution.idealWidth || screenResolution.idealWidth,
      ...config.screenResolution,
    };
  }

  // chrome and webkit based browsers (edge, safari) automatically adjust everything
  // and we have noticed higher quality with those browser types
  // firefox specifically has some issues with resolution and frame rate decision making
  // so we are making it optional and configurable (with defaults) for firefox
  // to have higher quality, and for developers to control the values
  // eventually we may have to add the same functionality to chrome, OR conversely, get to with firefox

  if (isBrowser('firefox')) {
    const mediaConfig: any = {
      audio: options.sendAudio,
      video: options.sendShare,
    };

    return navigator.mediaDevices
      .getDisplayMedia({audio: options.sendAudio, video: mediaConfig})
      .then((stream) => {
        if (options.sendShare && stream.getVideoTracks().length > 0) {
          // Firefox has a bug with the spec where changing in the height and width only happens
          // after we get the inital tracks
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1321221
          stream.getVideoTracks()[0].applyConstraints(shareConstraints);
        }

        return stream;
      });
  }

  const getDisplayMediaParams: any = {video: options.sendShare ? shareConstraints : false};

  // safari doesn't support sending screen share audio
  // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
  if (options.sendAudio && isBrowser('safari')) {
    getDisplayMediaParams.audio = options.sendAudio;
  }

  return navigator.mediaDevices.getDisplayMedia(getDisplayMediaParams);
};

/**
 * generates audio and video using constraints (often called after getSupportedDevices)
 * @param {Object|Boolean} audio gum constraints
 * @param {Object|Boolean} video gum constraints
 * @param {Object} config SDK Configuration for meetings plugin
 * @returns {Object} {streams}
 */
Media.getMedia = (audio: any | boolean, video: any | boolean, config: any) => {
  const defaultWidth = {ideal: config.resolution.idealWidth, max: config.resolution.maxWidth};
  const defaultHeight = {ideal: config.resolution.idealHeight, max: config.resolution.maxHeight};
  const mediaConfig = {
    audio,
    // TODO: Remove temporary workaround once Firefox fixes low constraint issues
    // eslint-disable-next-line no-nested-ternary
    video: video
      ? isBrowser('firefox') && video.width && video.width.max === 320
        ? {
            deviceId: video.deviceId ? video.deviceId : undefined,
            width: 320,
            height: 180,
            frameRate: video.frameRate ? video.frameRate : undefined,
            facingMode: video.facingMode ? video.facingMode : undefined,
          }
        : {
            deviceId: video.deviceId ? video.deviceId : undefined,
            width: video.width ? video.width : defaultWidth,
            height: video.height ? video.height : defaultHeight,
            frameRate: video.frameRate ? video.frameRate : undefined,
            facingMode: video.facingMode ? video.facingMode : undefined,
          }
      : false,
    fake: process.env.NODE_ENV === 'test', // Special case to get fake media for Firefox browser for testing
  };

  return navigator.mediaDevices.getUserMedia(mediaConfig).catch((err) => {
    const logPath = 'Media:index#getMedia --> navigator.mediaDevices.getUserMedia';

    LoggerProxy.logger.error(`${logPath} failed - ${err} (${err.constraint})`);
    throw err;
  });
};

/**
 * Checks if the machine has at least one audio or video device (Dont use this for screen share)
 * @param {object} [options]
 * {
 *    sendAudio: true/false,
 *    sendVideo: true/false
 * }
 * @returns {Object} {
 *    sendAudio: true/false,
 *    sendVideo: true/false
 *}
 */
Media.getSupportedDevice = ({sendAudio, sendVideo}: {sendAudio: boolean; sendVideo: boolean}) =>
  Promise.resolve().then(() => {
    if (!navigator.mediaDevices || navigator.mediaDevices.enumerateDevices === undefined) {
      return {
        sendAudio: false,
        sendVideo: false,
      };
    }

    return navigator.mediaDevices.enumerateDevices().then((devices) => {
      const supported = {
        audio: devices.filter((device) => device.kind === AUDIO_INPUT).length > 0,
        video: devices.filter((device) => device.kind === VIDEO_INPUT).length > 0,
      };

      return {
        sendAudio: supported.audio && sendAudio,
        sendVideo: supported.video && sendVideo,
      };
    });
  });

/**
 * proxy to browser navigator.mediaDevices.enumerateDevices()
 * @returns {Promise}
 */
Media.getDevices = () => {
  if (navigator && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    return navigator.mediaDevices.enumerateDevices();
  }

  return Promise.reject(new MediaError('enumerateDevices not supported.'));
};

/**
 *
 * Toggle a specific stream
 * noop as of now, does nothing
 * @returns {null}
 */
Media.toggleStream = () => {};

/**
 * Stop input stream
 * @param {MediaTrack} track A media stream
 * @returns {null}
 */
Media.stopTracks = (track: any) => {
  if (!track) {
    return Promise.resolve();
  }

  return Promise.resolve().then(() => {
    if (track && track.stop) {
      try {
        track.stop();
      } catch (e) {
        LoggerProxy.logger.error(
          `Media:index#stopTracks --> Unable to stop the track with state ${track.readyState}, error: ${e}`
        );
      }
    }
  });
};

/**
 * generates streams for audio video and share
 * @param {object} mediaSetting parameter
 * @param {Object} mediaSetting.sendAudio sendAudio: {Boolean} sendAudio constraints
 * @param {Object} mediaSetting.sendVideo sendVideo: {Boolean} sendVideo constraints
 * @param {Object} mediaSetting.sendShare sendShare: {Boolean} sendShare constraints
 * @param {Object} mediaSetting.isSharing isSharing: {Boolean} isSharing constraints
 * @param {Object} audioVideo parameter
 * @param {Object} audioVideo.audio {deviceId: {String}}
 * @param {Object} audioVideo.video {deviceId: {String}}
 * @param {Object} sharePreferences parameter
 * @param {Object} sharePreferences.shareConstraints parameter
 * @param {Boolean} sharePreferences.highFrameRate parameter
 * @param {Object} config SDK Config
 * @returns {Array} [localStream, shareStream]
 */
Media.getUserMedia = (
  mediaSetting: {
    sendAudio: object;
    sendVideo: object;
    sendShare: object;
    isSharing: object;
  },
  audioVideo: {
    audio: object;
    video: object;
  },
  sharePreferences: {
    shareConstraints: object;
    highFrameRate: boolean;
  },
  config: object
) =>
  Media.getLocalMedia(
    {
      sendAudio: mediaSetting.sendAudio ? audioVideo.audio || mediaSetting.sendAudio : false,
      sendVideo: mediaSetting.sendVideo ? audioVideo.video || mediaSetting.sendVideo : false,
    },
    config
  ).then((localStream) =>
    Media.getLocalMedia(
      {
        sendShare: mediaSetting.sendShare,
        isSharing: mediaSetting.isSharing,
        sharePreferences,
      },
      config
    ).then((shareStream) => [localStream, shareStream])
  );

export default Media;
