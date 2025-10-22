import type {MediaRequest} from './mediaRequestManager';

export const getFrameSizeFromPicSize = (picSize: number) => {
  return Math.round(picSize / 256);
};

export const getPicSizeFromFrameSize = (framesSize: number) => {
  return framesSize * 256;
};

export const getCodecInfo = (
  preferredCodec: 'h264' | 'av1' | undefined,
  getEffectiveMaxFs: () => number | undefined,
  getEffectiveMaxPicSize: () => number | undefined
): MediaRequest['codecInfo'] | undefined => {
  if (preferredCodec === 'av1') {
    const maxPicSize = getEffectiveMaxPicSize();
    if (!maxPicSize) {
      return undefined;
    }

    return {
      codec: 'av1',
      maxPicSize,
    };
  }

  // default to h264 if preferred codec is not set
  const maxFs = getEffectiveMaxFs();
  if (!maxFs) {
    return undefined;
  }

  return {
    codec: 'h264',
    maxFs,
  };
};
