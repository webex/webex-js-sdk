import {MediaCodecHelper, MediaCodecHelperOptions} from './mediaCodecHelper';
import MediaCodecHelperAV1 from './mediaCodecHelper.av1';
import MediaCodecHelperH264 from './mediaCodecHelper.h264';

/**
 * Factory for media codec helpers
 */
export default class MediaCodecHelperFactory {
  /**
   * Creates a new media codec info instance
   *
   * @param {MediaCodecHelperOptions} options - The codec options
   * @returns {MediaCodecHelper} The new media codec helper instance
   */
  static create(options: MediaCodecHelperOptions): MediaCodecHelper {
    switch (options.codec) {
      case 'av1':
        return new MediaCodecHelperAV1(options);
      case 'h264':
      default:
        return new MediaCodecHelperH264(options);
    }
  }
}
