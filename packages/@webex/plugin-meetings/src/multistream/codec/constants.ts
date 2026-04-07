export const AV1_CODEC_PARAMETERS = {
  '90p': {
    levelIdx: 0,
    profile: 0,
    maxWidth: 160,
    maxHeight: 90,
    maxPicSize: 15_360,
    maxDecodeRate: 4_423_680,
  },
  '180p': {
    levelIdx: 0,
    profile: 0,
    maxWidth: 320,
    maxHeight: 180,
    maxPicSize: 57_600,
    maxDecodeRate: 4_423_680,
  },
  '360p': {
    levelIdx: 1,
    profile: 0,
    maxWidth: 640,
    maxHeight: 360,
    maxPicSize: 230_400,
    maxDecodeRate: 8_363_520,
  },
  '540p': {
    levelIdx: 4,
    profile: 0,
    maxWidth: 960,
    maxHeight: 540,
    maxPicSize: 518_400,
    maxDecodeRate: 19_975_680,
  },
  '720p': {
    levelIdx: 5,
    profile: 0,
    maxWidth: 1280,
    maxHeight: 720,
    maxPicSize: 921_600,
    maxDecodeRate: 31_950_720,
  },
  '1080p': {
    levelIdx: 8,
    profile: 0,
    maxWidth: 1920,
    maxHeight: 1080,
    maxPicSize: 2_073_600,
    maxDecodeRate: 70_778_880,
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
