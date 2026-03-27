/* eslint-disable class-methods-use-this */
import {
  getRecommendedMaxBitrateForFrameSize,
  H264Codec,
  SupportedResolution,
  CodecInfo as WcmeCodecInfo,
} from '@webex/internal-media-core';
import {CODEC_DEFAULTS, H264_CODEC_PARAMETERS, PANE_SIZE_TO_RESOLUTION} from './constants';
import {MediaCodecHelper, H264CodecInfo, GetCodecInfoOptions, CodecInfo} from './types';
import {RemoteVideoResolution, SizeHint} from '../types';
import LoggerProxy from '../../common/logs/logger-proxy';

/**
 * Class for H264 media codec info
 */
export default class MediaCodecHelperH264 implements MediaCodecHelper<H264CodecInfo> {
  /**
   * Gets the H264 codec info
   *
   * @param {GetCodecInfoOptions} options - The options for the H264 codec info
   * @returns {H264CodecInfo | undefined} The H264 codec info
   */
  getCodecInfo({sizeHint}: GetCodecInfoOptions = {}): H264CodecInfo | undefined {
    const maxFs = this.getSizeHintMaxFs(sizeHint);

    if (!maxFs) {
      return undefined;
    }

    return {
      codec: 'h264',
      maxFs,
    };
  }

  /**
   * Gets the max payload bits per second
   *
   * @param {CodecInfo[]} codecInfos - The codec infos to get the max payload bits per second from
   * @returns {number} The max payload bits per second
   */
  getMaxPayloadBitsPerSecond(codecInfos: CodecInfo[]): number {
    return codecInfos
      .filter((codecInfo) => codecInfo.codec === 'h264')
      .reduce((acc, codecInfo) => {
        let bitrate = 0;
        // Legacy maxFs
        if (codecInfo.maxFs) {
          bitrate = getRecommendedMaxBitrateForFrameSize(codecInfo.maxFs);
        } else {
          bitrate = getRecommendedMaxBitrateForFrameSize(this.getMaxFs(codecInfo.resolution)) || 0;
        }

        return Math.max(acc, bitrate);
      }, 0);
  }

  /**
   * Gets the WCME codec info
   *
   * @param {H264CodecInfo} codecInfo - The codec info to get the WCME codec infos from
   * @returns {WcmeCodecInfo} The WCME codec info
   */
  getWCMECodecInfo(codecInfo: H264CodecInfo): WcmeCodecInfo {
    return WcmeCodecInfo.fromH264(
      0x80, // TODO: Fix this constant
      new H264Codec(
        codecInfo.maxFs,
        codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps,
        this.getMaxPayloadBitsPerSecond(codecInfo),
        codecInfo.maxWidth,
        codecInfo.maxHeight
      )
    );
  }

  /**
   * Converts pane size into h264 maxFs
   *
   * @param {RemoteVideoResolution} paneSize - The pane size to get the max fs for
   * @returns {number} The max fs
   */
  getMaxFs(paneSize: RemoteVideoResolution): number {
    let resolution: SupportedResolution;

    if (paneSize in PANE_SIZE_TO_RESOLUTION) {
      resolution = PANE_SIZE_TO_RESOLUTION[paneSize];
    } else {
      LoggerProxy.logger.warn(
        `MediaCodecHelperH264#getMaxFs --> unsupported paneSize: ${paneSize}, using "medium" instead`
      );
      resolution = PANE_SIZE_TO_RESOLUTION.medium;
    }

    return H264_CODEC_PARAMETERS[resolution].maxFs;
  }

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
  }
}
