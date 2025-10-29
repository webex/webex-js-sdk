import {RemoteVideoResolution} from '../types';
import {AV1CodecInfo, H264CodecInfo} from './types';

export const H264_CODEC_PARAMETERS = {
  thumbnail: {
    maxFs: 60,
  },
  'very small': {
    maxFs: 240,
  },
  small: {
    maxFs: 920,
  },
  medium: {
    maxFs: 2040,
  },
  large: {
    maxFs: 3600,
  },
  best: {
    maxFs: 8192,
  },
} satisfies Record<RemoteVideoResolution, Omit<H264CodecInfo, 'codec'>>;

export const AV1_CODEC_PARAMETERS = {
  thumbnail: {
    maxPicSize: 147_456,
    levelIdx: 0,
    tier: 0,
    maxWidth: 1152,
    maxHeight: 2048,
    maxDecodeRate: 5_529_600,
  },
  'very small': {
    maxPicSize: 147_456,
    levelIdx: 0,
    tier: 0,
    maxWidth: 1152,
    maxHeight: 2048,
    maxDecodeRate: 5_529_600,
  },
  small: {
    maxPicSize: 278_784,
    levelIdx: 1,
    tier: 0,
    maxWidth: 2816,
    maxHeight: 1584,
    maxDecodeRate: 10_454_400,
  },
  medium: {
    maxPicSize: 665_856,
    levelIdx: 4,
    tier: 0,
    maxWidth: 4352,
    maxHeight: 2448,
    maxDecodeRate: 24_969_600,
  },
  large: {
    maxPicSize: 1_065_024,
    levelIdx: 5,
    tier: 0,
    maxWidth: 5504,
    maxHeight: 3096,
    maxDecodeRate: 39_938_400,
  },
  best: {
    maxPicSize: 2_359_296,
    levelIdx: 9,
    tier: 0,
    maxWidth: 6144,
    maxHeight: 3456,
    maxDecodeRate: 155_713_536,
  },
} satisfies Record<RemoteVideoResolution, Omit<AV1CodecInfo, 'codec'>>;

export const CODEC_DEFAULTS = {
  h264: {
    ...H264_CODEC_PARAMETERS.best,
    maxFps: 3000,
    maxMbps: 245760,
  },
  av1: AV1_CODEC_PARAMETERS.best,
};
