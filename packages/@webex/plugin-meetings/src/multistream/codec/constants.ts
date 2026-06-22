import {AV1EncodingParams, SupportedResolution} from '@webex/internal-media-core';

export const AV1_CODEC_PARAMETERS: Record<SupportedResolution, AV1EncodingParams> = {
  '90p': {
    levelIdx: 0,
    tier: 0,
    maxWidth: 160,
    maxHeight: 90,
    maxPicSize: 147_456,
    maxDecodeRate: 5_529_600,
  },
  '180p': {
    levelIdx: 0,
    tier: 0,
    maxWidth: 320,
    maxHeight: 180,
    maxPicSize: 147_456,
    maxDecodeRate: 5_529_600,
  },
  '360p': {
    levelIdx: 1,
    tier: 0,
    maxWidth: 640,
    maxHeight: 360,
    maxPicSize: 278_784,
    maxDecodeRate: 10_454_400,
  },
  '540p': {
    levelIdx: 4,
    tier: 0,
    maxWidth: 960,
    maxHeight: 540,
    maxPicSize: 665_856,
    maxDecodeRate: 24_969_600,
  },
  '720p': {
    levelIdx: 5,
    tier: 0,
    maxWidth: 1280,
    maxHeight: 720,
    maxPicSize: 1_065_024,
    maxDecodeRate: 39_938_400,
  },
  '1080p': {
    levelIdx: 8,
    tier: 0,
    maxWidth: 1920,
    maxHeight: 1080,
    maxPicSize: 2_359_296,
    maxDecodeRate: 77_856_768,
  },
};

export const H264_CODEC_PARAMETERS = {
  maxFs: 8192,
  maxFps: 3000,
  maxMbps: 245760,
};
