import {CodecInfo as WcmeCodecInfo} from '@webex/internal-media-core';
import {CodecInfo} from './types';
import {MediaRequest, RemoteVideoResolution} from '../types';

export type MediaCodecHelperOptions = {
  codec: 'h264' | 'av1';
};

/**
 * Abstract class for media codec info
 */
export abstract class MediaCodecHelper {
  protected readonly options: MediaCodecHelperOptions;

  /**
   * Constructor for MediaCodecHelper
   *
   * @param {MediaCodecHelperOptions} options - The options for the media codec info
   */
  constructor(options: MediaCodecHelperOptions) {
    this.options = options;
  }

  abstract getCodecInfo(options: {maxFs?: number; maxPicSize?: number}): CodecInfo | undefined;
  abstract getWCMECodecInfos(mediaRequest: MediaRequest): WcmeCodecInfo[];
  abstract degradeMediaRequest(
    mediaRequest: MediaRequest,
    resolution: RemoteVideoResolution
  ): number;

  abstract getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number;
}
