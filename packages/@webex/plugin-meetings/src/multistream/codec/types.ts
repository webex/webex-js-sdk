import {
  CodecInfo as WcmeCodecInfo,
  SupportedResolution,
  H264EncodingParams,
} from '@webex/internal-media-core';
import type {MediaRequest} from '../types';

export type H264CodecInfo = H264EncodingParams & {
  codec: 'h264';
};

export type CodecInfo = H264CodecInfo;

export interface MediaCodecHelper {
  getCodecInfo(options: {
    getMaxFs?: () => number;
    getMaxPicSize?: () => number;
  }): CodecInfo | undefined;
  getWCMECodecInfos(mediaRequest: MediaRequest): WcmeCodecInfo[];
  degradeMediaRequest(mediaRequest: MediaRequest, resolution: SupportedResolution): number;
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number;
}
