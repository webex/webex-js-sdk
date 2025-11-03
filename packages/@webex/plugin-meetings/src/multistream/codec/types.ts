import {CodecInfo as WcmeCodecInfo} from '@webex/internal-media-core';
import type {MediaRequest} from '../types';

export type SupportedResolution = '1080p' | '720p' | '540p' | '360p' | '180p' | '90p';

export interface H264CodecInfo {
  codec: 'h264';
  maxFs?: number;
  maxFps?: number;
  maxMbps?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface AV1CodecInfo {
  codec: 'av1';
  levelIdx?: number;
  tier?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPicSize?: number;
  maxDecodeRate?: number;
}

export type CodecInfo = H264CodecInfo | AV1CodecInfo;

export interface MediaCodecHelper {
  getCodecInfo(options: {maxFs?: number; maxPicSize?: number}): CodecInfo | undefined;
  getWCMECodecInfos(mediaRequest: MediaRequest): WcmeCodecInfo[];
  degradeMediaRequest(mediaRequest: MediaRequest, resolution: SupportedResolution): number;
  getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number;
}
