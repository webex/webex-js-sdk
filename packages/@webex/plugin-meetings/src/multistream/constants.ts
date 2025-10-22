import {getPicSizeFromFrameSize} from './utils';

export const MAX_FS_VALUES = {
  '90p': 60,
  '180p': 240,
  '360p': 920,
  '540p': 2040,
  '720p': 3600,
  '1080p': 8192,
};

export const MAX_PIC_SIZE_VALUES = {
  '90p': 147_456,
  '180p': 147_456,
  '360p': 278_784,
  '540p': 665_856,
  '720p': 1_065_024,
  '1080p': 2_359_296,
};

export const CODEC_DEFAULTS = {
  h264: {
    maxFs: MAX_FS_VALUES['1080p'],
    maxFps: 3000,
    maxMbps: 245760,
  },
  av1: {
    maxPicSize: MAX_PIC_SIZE_VALUES['1080p'],
  },
};
