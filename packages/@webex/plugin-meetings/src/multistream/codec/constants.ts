import {H264EncodingParams, SupportedResolution} from '@webex/internal-media-core';

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
