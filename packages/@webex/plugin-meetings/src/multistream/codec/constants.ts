import {H264EncodingParams, SupportedResolution} from '@webex/internal-media-core';
import {RemoteVideoResolution} from '../types';

export const DEGRADATION_FRAME_SIZE = {
  '90p': 60,
  '180p': 240,
  '360p': 920,
  '540p': 2040,
  '720p': 3600,
  '1080p': 8192,
} satisfies Record<SupportedResolution, number>;

export const H264_CODEC_PARAMETERS = {
  '90p': {
    maxFs: 60,
  },
  '180p': {
    maxFs: 240,
  },
  '360p': {
    maxFs: 920,
  },
  '540p': {
    maxFs: 2040,
  },
  '720p': {
    maxFs: 3600,
  },
  '1080p': {
    maxFs: 8192,
  },
} satisfies Record<SupportedResolution, H264EncodingParams>;

export const CODEC_DEFAULTS = {
  h264: {
    ...H264_CODEC_PARAMETERS['1080p'],
    maxFps: 3000,
    maxMbps: 245760,
  },
};

export const PANE_SIZE_TO_RESOLUTION = {
  thumbnail: '90p',
  'very small': '180p',
  small: '360p',
  medium: '720p',
  large: '1080p',
  best: '1080p',
} satisfies Record<RemoteVideoResolution, SupportedResolution>;

/** Higher rank = larger nominal pane / resolution */
export const PANE_SIZE_RANK = {
  thumbnail: 1,
  'very small': 2,
  small: 3,
  medium: 4,
  large: 5,
  best: 6,
} satisfies Record<RemoteVideoResolution, number>;
