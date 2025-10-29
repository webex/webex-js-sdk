/* eslint-disable class-methods-use-this */
import {
  AV1Codec,
  getRecommendedMaxBitrateForFrameSize,
  CodecInfo as WcmeCodecInfo,
} from '@webex/internal-media-core';
import {AV1_CODEC_PARAMETERS, CODEC_DEFAULTS} from './constants';
import {MediaCodecHelper} from './mediaCodecHelper';
import {AV1CodecInfo} from './types';
import {MediaRequest, RemoteVideoResolution} from '../types';

const picSizeConverter = {
  toFrameSize: (picSize: number): number => {
    return Math.floor(picSize / 288);
  },
  toPicSize: (frameSize: number): number => {
    return frameSize * 288;
  },
};

/**
 * Class for AV1 media codec info
 */
export default class MediaCodecHelperAV1 extends MediaCodecHelper {
  /**
   * Gets the AV1 codec info
   *
   * @param {Object} options - The options for the AV1 codec info
   * @returns {AV1CodecInfo} The AV1 codec info
   */
  getCodecInfo(options: {maxPicSize?: number}): AV1CodecInfo {
    if (!options.maxPicSize) {
      return undefined;
    }

    return this.getParameters(options.maxPicSize);
  }

  /**
   * Degrades the media request
   *
   * @param {MediaRequest} mr - The media request to degrade
   * @param {Resolution} resolution - The resolution to degrade to
   * @returns {number} The total macroblocks requested
   */
  degradeMediaRequest(mr: MediaRequest, resolution: RemoteVideoResolution): number {
    if (mr.codecInfo?.codec !== 'av1') {
      return 0;
    }

    // TODO: in mr there is preferredMaxFs, what about preferredMaxPicSize?
    mr.codecInfo.maxPicSize = Math.min(
      mr.codecInfo.maxPicSize || CODEC_DEFAULTS.av1.maxPicSize,
      AV1_CODEC_PARAMETERS[resolution].maxPicSize
    );

    // we only consider sources with "live" state
    const slotsWithLiveSource = mr.receiveSlots.filter((rs) => rs.sourceState === 'live');

    // TODO: how to get macroblocks from maxPicSize?
    return picSizeConverter.toFrameSize(mr.codecInfo.maxPicSize) * slotsWithLiveSource.length;
  }

  /**
   * Gets the max payload bits per second
   *
   * @param {MediaRequest} mediaRequest - The media request to get the max payload bits per second from
   * @returns {number} The max payload bits per second
   */
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number {
    if (mediaRequest.codecInfo?.codec !== 'av1') {
      return 0;
    }
    const frameSize = picSizeConverter.toFrameSize(mediaRequest.codecInfo.maxPicSize);

    // TODO: should we also have getRecommendedMaxBitrateForPicSize?
    return getRecommendedMaxBitrateForFrameSize(frameSize);
  }

  /**
   * Gets the WCME codec infos
   *
   * @param {MediaRequest} mr - The media request to get the WCME codec infos from
   * @returns {WcmeCodecInfo[]} The WCME codec infos
   */
  getWCMECodecInfos(mr: MediaRequest): WcmeCodecInfo[] {
    if (mr.codecInfo?.codec !== 'av1') {
      return [];
    }

    return [
      WcmeCodecInfo.fromAv1(
        45,
        new AV1Codec(
          mr.codecInfo.levelIdx || CODEC_DEFAULTS.av1.levelIdx,
          mr.codecInfo.tier || CODEC_DEFAULTS.av1.tier,
          mr.codecInfo.maxWidth || CODEC_DEFAULTS.av1.maxWidth,
          mr.codecInfo.maxHeight || CODEC_DEFAULTS.av1.maxHeight,
          mr.codecInfo.maxPicSize || CODEC_DEFAULTS.av1.maxPicSize,
          mr.codecInfo.maxDecodeRate || CODEC_DEFAULTS.av1.maxDecodeRate
        )
      ),
    ];
  }

  /**
   * Gets the highest compatible AV1 codec parameters for the given maximum picture size
   *
   * @param {number} maxPicSize - The maximum picture size
   * @returns {AV1CodecInfo} The AV1 codec parameters
   */
  private getParameters(maxPicSize: number): AV1CodecInfo {
    const parameters = Object.values(AV1_CODEC_PARAMETERS)
      // filter out parameters with a max picture size greater than the given max picture size
      .filter((entry) => maxPicSize <= entry.maxPicSize)
      // sort by max picture size descending
      .sort((a, b) => b.maxPicSize - a.maxPicSize);

    // return the highest compatible AV1 codec parameters
    return {
      codec: 'av1',
      ...parameters[0],
    };
  }
}
