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

export type RemoteVideoResolution =
  | 'thumbnail' // the smallest possible resolution, 90p or less
  | 'very small' // 180p or less
  | 'small' // 360p or less
  | 'medium' // 720p or less
  | 'large' // 1080p or less
  | 'best'; // highest possible resolution
