import MediaCodecHelperAV1 from './mediaCodecHelper.av1';
import MediaCodecHelperH264 from './mediaCodecHelper.h264';

export type MediaCodecHelperOptions = {
  codec: 'h264' | 'av1';
};

const MediaCodecHelper = {
  AV1: new MediaCodecHelperAV1(),
  H264: new MediaCodecHelperH264(),
  get: (codec?: 'av1' | 'h264'): MediaCodecHelperAV1 | MediaCodecHelperH264 => {
    switch (codec) {
      case 'av1':
        return MediaCodecHelper.AV1;
      case 'h264':
      default:
        return MediaCodecHelper.H264;
    }
  },
};

export default MediaCodecHelper;
