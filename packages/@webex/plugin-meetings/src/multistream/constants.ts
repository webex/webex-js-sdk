export const MAX_FS_VALUES = {
  '90p': 60,
  '180p': 240,
  '360p': 920,
  '540p': 2040,
  '720p': 3600,
  '1080p': 8192,
};

export const CODEC_DEFAULTS = {
  h264: {
    maxFs: 8192,
    maxFps: 3000,
    maxMbps: 245760,
  },
  av1: {
    maxPicSize: 8192,
  },
};
