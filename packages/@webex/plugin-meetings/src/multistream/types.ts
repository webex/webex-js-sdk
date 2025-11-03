import {NamedMediaGroup} from '@webex/internal-media-core';
import type {CodecInfo} from './codec/types';
import {ReceiveSlot} from './receiveSlot';

export interface ActiveSpeakerPolicyInfo {
  policy: 'active-speaker';
  priority: number;
  crossPriorityDuplication: boolean;
  crossPolicyDuplication: boolean;
  preferLiveVideo: boolean;
  namedMediaGroups?: NamedMediaGroup[];
}

export interface ReceiverSelectedPolicyInfo {
  policy: 'receiver-selected';
  csi: number;
}

export type PolicyInfo = ActiveSpeakerPolicyInfo | ReceiverSelectedPolicyInfo;

export interface MediaRequest {
  policyInfo: PolicyInfo;
  receiveSlots: Array<ReceiveSlot>;
  codecInfo?: CodecInfo;
  preferredMaxFs?: number;
  preferredMaxPicSize?: number;
  handleMaxFs?: ({maxFs}: {maxFs: number}) => void;
  handleMaxPicSize?: ({maxPicSize}: {maxPicSize: number}) => void;
}

export type MediaRequestId = string;

export enum RemoteVideoResolution {
  /** the smallest possible resolution, 90p or less */
  Thumbnail = 'thumbnail',
  /** 180p or less */
  VerySmall = 'very small',
  /** 360p or less */
  Small = 'small',
  /** 720p or less */
  Medium = 'medium',
  /** 1080p or less */
  Large = 'large',
  /** highest possible resolution */
  Best = 'best',
}
