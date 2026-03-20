import MediaCodecHelperH264 from './mediaCodecHelper.h264';

const MediaCodecHelper = {
  H264: new MediaCodecHelperH264(),
  get: (codec?: 'h264'): MediaCodecHelperH264 => {
    switch (codec) {
      case 'h264':
      default:
        return MediaCodecHelper.H264;
    }
  },
};

export default MediaCodecHelper;
