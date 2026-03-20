import {
  H264EncodingParams,
  SupportedResolution,
  CodecInfo as WcmeCodecInfo,
} from '@webex/internal-media-core';
import {MediaRequest} from '../types';

export type H264CodecInfo = H264EncodingParams & {
  codec: 'h264';
};

export type CodecInfo = H264CodecInfo;

export interface MediaCodecHelper<TCodecOptions, TCodecInfo extends CodecInfo> {
  getCodecInfo(options: TCodecOptions): TCodecInfo | undefined;
  getWCMECodecInfos(mediaRequest: MediaRequest): WcmeCodecInfo[];
  degradeMediaRequest(mediaRequest: MediaRequest, resolution: SupportedResolution): number;
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number;
}
