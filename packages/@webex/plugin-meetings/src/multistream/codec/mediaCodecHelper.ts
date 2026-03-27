import {SupportedResolution} from '@webex/internal-media-core';
import {SizeHint} from '../types';
import {DEGRADATION_FRAME_SIZE, H264_CODEC_PARAMETERS} from './constants';
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

  /**
   * Gets the max fs for the given width and height
   *
   * @param {SizeHint} sizeHint - The size hint to get the max fs for
   * @returns {number | undefined} The max fs for the given width and height, or undefined if the width or height is 0
   */
  getSizeHintMaxFs(sizeHint?: SizeHint): number | undefined {
    const {width, height, resolution} = sizeHint ?? {};
    if (width > 0 && height > 0) {
      // we switch to the next resolution level when the height is 10% more than the current resolution height
      // except for 1080p - we switch to it immediately when the height is more than 720p
      const threshold = 1.1;
      const getThresholdHeight = (h: number) => Math.round(h * threshold);

      if (height < getThresholdHeight(90)) {
        return DEGRADATION_FRAME_SIZE['90p'];
      }
      if (height < getThresholdHeight(180)) {
        return DEGRADATION_FRAME_SIZE['180p'];
      }
      if (height < getThresholdHeight(360)) {
        return DEGRADATION_FRAME_SIZE['360p'];
      }
      if (height < getThresholdHeight(540)) {
        return DEGRADATION_FRAME_SIZE['540p'];
      }
      if (height <= 720) {
        return DEGRADATION_FRAME_SIZE['720p'];
      }

      return DEGRADATION_FRAME_SIZE['1080p'];
    }

    // Fall back to resolution option
    if (resolution) {
      return DEGRADATION_FRAME_SIZE[resolution];
    }

    return undefined;
  },

  /**
   * Gets the max fs for the given width and height
   *
   * @param {number} frameSize - The frame size to get the resolution for
   * @returns {number | undefined} The max fs for the given width and height, or undefined if the width or height is 0
   */
  getResolutionForFrameSize(frameSize: number): SupportedResolution {
    const {width, height, resolution} = sizeHint ?? {};
    if (width > 0 && height > 0) {
      // we switch to the next resolution level when the height is 10% more than the current resolution height
      // except for 1080p - we switch to it immediately when the height is more than 720p
      const threshold = 1.1;
      const getThresholdHeight = (h: number) => Math.round(h * threshold);

      if (height < getThresholdHeight(90)) {
        return H264_CODEC_PARAMETERS['90p'].maxFs;
      }
      if (height < getThresholdHeight(180)) {
        return H264_CODEC_PARAMETERS['180p'].maxFs;
      }
      if (height < getThresholdHeight(360)) {
        return H264_CODEC_PARAMETERS['360p'].maxFs;
      }
      if (height < getThresholdHeight(540)) {
        return H264_CODEC_PARAMETERS['540p'].maxFs;
      }
      if (height <= 720) {
        return H264_CODEC_PARAMETERS['720p'].maxFs;
      }

      return H264_CODEC_PARAMETERS['1080p'].maxFs;
    }

    // Fall back to resolution option
    if (resolution) {
      return this.getMaxFs(resolution);
    }

    return undefined;
  },
};

export default MediaCodecHelper;
