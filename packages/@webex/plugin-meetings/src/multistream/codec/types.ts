import {
  H264EncodingParams,
  SupportedResolution,
  CodecInfo as WcmeCodecInfo,
} from '@webex/internal-media-core';
import {MediaRequest, SizeHint} from '../types';

export type H264CodecInfo = H264EncodingParams & {
  codec: 'h264';
};

export type CodecInfo = H264CodecInfo;

export type GetCodecInfoOptions = {sizeHint?: SizeHint};

export interface MediaCodecHelper<TCodecInfo extends CodecInfo> {
  getCodecInfo(options: GetCodecInfoOptions): TCodecInfo | undefined;
  getWCMECodecInfos(mediaRequest: MediaRequest): WcmeCodecInfo[];
  degradeMediaRequest(mediaRequest: MediaRequest, resolution: SupportedResolution): number;
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number;
}
