export const AV1_CODEC_PARAMETERS = {
  '90p': {
    levelIdx: 0,
    tier: 0,
    maxWidth: 160,
    maxHeight: 90,
    maxPicSize: 160 * 90,
    maxDecodeRate: 5_529_600,
  },
  '180p': {
    levelIdx: 0,
    tier: 0,
    maxWidth: 320,
    maxHeight: 180,
    maxPicSize: 320 * 180,
    maxDecodeRate: 5_529_600,
  },
  '360p': {
    levelIdx: 1,
    tier: 0,
    maxWidth: 640,
    maxHeight: 360,
    maxPicSize: 640 * 360,
    maxDecodeRate: 10_454_400,
  },
  '540p': {
    levelIdx: 4,
    tier: 0,
    maxWidth: 960,
    maxHeight: 540,
    maxPicSize: 960 * 540,
    maxDecodeRate: 24_969_600,
  },
  '720p': {
    levelIdx: 5,
    tier: 0,
    maxWidth: 1280,
    maxHeight: 720,
    maxPicSize: 1280 * 720,
    maxDecodeRate: 39_938_400,
  },
  '1080p': {
    levelIdx: 8,
    tier: 0,
    maxWidth: 1920,
    maxHeight: 1080,
    maxPicSize: 1920 * 1080,
    maxDecodeRate: 77_856_768,
  },
};

export const H264_CODEC_PARAMETERS = {
  maxFs: 8192,
  maxFps: 3000,
  maxMbps: 245760,
};
