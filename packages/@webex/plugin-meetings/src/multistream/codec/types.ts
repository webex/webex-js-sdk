export type Resolution = '90p' | '180p' | '360p' | '540p' | '720p' | '1080p';

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
