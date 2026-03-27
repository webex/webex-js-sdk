import {H264EncodingParams, CodecInfo as WcmeCodecInfo} from '@webex/internal-media-core';
import {SizeHint} from '../types';

export type H264CodecInfo = H264EncodingParams & {
  codec: 'h264';
};

export type CodecInfo = H264CodecInfo;

export type GetCodecInfoOptions = {sizeHint?: SizeHint};

export interface MediaCodecHelper<TCodecInfo extends CodecInfo> {
  getCodecInfo(options: GetCodecInfoOptions): TCodecInfo | undefined;
  getWCMECodecInfo(codecInfo: TCodecInfo): WcmeCodecInfo;
  getMaxPayloadBitsPerSecond(codecInfos: CodecInfo[]): number;
}
