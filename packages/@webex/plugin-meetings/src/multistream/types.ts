import {NamedMediaGroup} from '@webex/internal-media-core';
import type {CodecInfo} from './codec/types';
import type {ReceiveSlot} from './receiveSlot';

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

export type RemoteVideoResolution =
  /** the smallest possible resolution, 90p or less */
  | 'thumbnail'
  /** 180p or less */
  | 'very small'
  /** 360p or less */
  | 'small'
  /** 720p or less */
  | 'medium'
  /** 1080p or less */
  | 'large'
  /** highest possible resolution */
  | 'best';

export type SizeHint = {width?: number; height?: number; resolution?: RemoteVideoResolution};

export interface MediaRequest {
  policyInfo: PolicyInfo;
  receiveSlots: Array<ReceiveSlot>;
  /**
   * For {@link MediaRequestManager} with `kind: 'video'`, H264 `codecInfo` is always filled from
   * `sizeHint` (and defaults) inside the manager. Callers should pass `sizeHint` / layout resolution
   * only and must not rely on setting this field.
   */
  codecInfo?: CodecInfo;
  preferredMaxFs?: number;
  sizeHint?: SizeHint;
  handleMaxFs?: ({maxFs}: {maxFs: number}) => void;
  handleSizeHint?: (sizeHint: SizeHint) => void;
}

export type MediaRequestId = string;
