import {H264EncodingParams} from '@webex/internal-media-core';

export type H264CodecInfo = H264EncodingParams & {
  codec: 'h264';
};

export type CodecInfo = H264CodecInfo;
