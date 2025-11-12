import {RemoteVideoResolution} from '../types';
import {AV1CodecInfo, H264CodecInfo, SupportedResolution} from './types';

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
} satisfies Record<SupportedResolution, Omit<H264CodecInfo, 'codec'>>;

export const AV1_CODEC_PARAMETERS = {
  '90p': {
    maxPicSize: 147_456,
    levelIdx: 0,
    maxWidth: 1152,
    maxHeight: 2048,
    maxDecodeRate: 5_529_600,
  },
  '180p': {
    maxPicSize: 147_456,
    levelIdx: 0,
    maxWidth: 1152,
    maxHeight: 2048,
    maxDecodeRate: 5_529_600,
  },
  '360p': {
    maxPicSize: 278_784,
    levelIdx: 1,
    maxWidth: 2816,
    maxHeight: 1584,
    maxDecodeRate: 10_454_400,
  },
  '540p': {
    maxPicSize: 665_856,
    levelIdx: 4,
    maxWidth: 4352,
    maxHeight: 2448,
    maxDecodeRate: 24_969_600,
  },
  '720p': {
    maxPicSize: 1_065_024,
    levelIdx: 5,
    maxWidth: 5504,
    maxHeight: 3096,
    maxDecodeRate: 39_938_400,
  },
  '1080p': {
    maxPicSize: 2_359_296,
    levelIdx: 9,
    maxWidth: 6144,
    maxHeight: 3456,
    maxDecodeRate: 155_713_536,
  },
} satisfies Record<SupportedResolution, Omit<AV1CodecInfo, 'codec'>>;

export const CODEC_DEFAULTS = {
  h264: {
    ...H264_CODEC_PARAMETERS['1080p'],
    maxFps: 3000,
    maxMbps: 245760,
  },
  av1: {
    ...AV1_CODEC_PARAMETERS['1080p'],
    tier: 0,
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
