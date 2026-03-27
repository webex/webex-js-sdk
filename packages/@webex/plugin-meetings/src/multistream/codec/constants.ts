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
};

export const CODEC_DEFAULTS = {
  h264: {
    maxFs: 8192,
    maxFps: 3000,
    maxMbps: 245760,
  },
  av1: {
    ...AV1_CODEC_PARAMETERS['1080p'],
    tier: 0,
  },
};

export const MACROBLOCK_SIZE = 16 * 16;
