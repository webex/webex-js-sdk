/* eslint-disable class-methods-use-this */
import {
  getRecommendedMaxBitrateForFrameSize,
  H264Codec,
  SupportedResolution,
  CodecInfo as WcmeCodecInfo,
} from '@webex/internal-media-core';
import {CODEC_DEFAULTS, H264_CODEC_PARAMETERS, PANE_SIZE_TO_RESOLUTION} from './constants';
import {MediaCodecHelper, H264CodecInfo} from './types';
import {MediaRequest, RemoteVideoResolution} from '../types';
import LoggerProxy from '../../common/logs/logger-proxy';

type H264CodecOptions = {
  getMaxFs?: () => number;
};

/**
 * Class for H264 media codec info
 */
export default class MediaCodecHelperH264
  implements MediaCodecHelper<H264CodecOptions, H264CodecInfo>
{
  /**
   * Gets the H264 codec info
   *
   * @param {Object} options - The options for the H264 codec info
   * @param {number} options.maxFs - The maximum frame size
   * @returns {H264CodecInfo} The H264 codec info
   */
  getCodecInfo(options: H264CodecOptions): H264CodecInfo | undefined {
    if (!options.getMaxFs) {
      return undefined;
    }

    return {
      codec: 'h264',
      maxFs: options.getMaxFs(),
    };
  }

  /**
   * Degrades the media request
   *
   * @param {MediaRequest} mr - The media request to degrade
   * @param {Resolution} resolution - The resolution to degrade to
   * @returns {number} The total macroblocks requested
   */
  degradeMediaRequest(mr: MediaRequest, resolution: SupportedResolution): number {
    if (mr.codecInfo?.codec !== 'h264') {
      return 0;
    }

    mr.codecInfo.maxFs = Math.min(
      mr.preferredMaxFs || CODEC_DEFAULTS.h264.maxFs,
      mr.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs,
      H264_CODEC_PARAMETERS[resolution].maxFs
    );

    // we only consider sources with "live" state
    const slotsWithLiveSource = mr.receiveSlots.filter((rs) => rs.sourceState === 'live');

    return mr.codecInfo.maxFs * slotsWithLiveSource.length;
  }

  /**
   * Gets the max payload bits per second
   *
   * @param {MediaRequest} mediaRequest - The media request to get the max payload bits per second from
   * @returns {number} The max payload bits per second
   */
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number {
    if (mediaRequest.codecInfo?.codec !== 'h264') {
      return 0;
    }

    return getRecommendedMaxBitrateForFrameSize(mediaRequest.codecInfo.maxFs);
  }

  /**
   * Gets the WCME codec infos
   *
   * @param {MediaRequest} mr - The media request to get the WCME codec infos from
   * @returns {WcmeCodecInfo[]} The WCME codec infos
   */
  getWCMECodecInfos(mr: MediaRequest): WcmeCodecInfo[] {
    if (mr.codecInfo?.codec !== 'h264') {
      return [];
    }

    return [
      WcmeCodecInfo.fromH264(
        0x80,
        new H264Codec(
          mr.codecInfo.maxFs,
          mr.codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps,
          mr.codecInfo.maxMbps || CODEC_DEFAULTS.h264.maxMbps,
          mr.codecInfo.maxWidth,
          mr.codecInfo.maxHeight
        )
      ),
    ];
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
   * @param {number} width - The width of the video element
   * @param {number} height - The height of the video element
   * @returns {number | undefined} The max fs for the given width and height, or undefined if the width or height is 0
   */
  getSizeHintMaxFs(width: number, height: number): number | undefined {
    if (width === 0 || height === 0) {
      return undefined;
    }

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
}
