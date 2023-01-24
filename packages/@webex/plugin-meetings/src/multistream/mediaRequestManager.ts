/* eslint-disable require-jsdoc */
import {
  MediaRequest as WcmeMediaRequest,
  Policy,
  ActiveSpeakerInfo,
  ReceiverSelectedInfo,
  CodecInfo as WcmeCodecInfo,
  H264Codec,
} from '@webex/internal-media-core';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotId} from './receiveSlot';

export interface ActiveSpeakerPolicyInfo {
  policy: 'active-speaker';
  priority: number;
  crossPriorityDuplication: boolean;
  crossPolicyDuplication: boolean;
  preferLiveVideo: boolean;
}

export interface ReceiverSelectedPolicyInfo {
  policy: 'receiver-selected';
  csi: number;
}

export type PolicyInfo = ActiveSpeakerPolicyInfo | ReceiverSelectedPolicyInfo;

export interface H264CodecInfo {
  codec: 'h264';
  maxFs?: number;
  maxFps?: number;
  maxMbps?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export type CodecInfo = H264CodecInfo; // we'll add AV1 here in the future when it's available

export interface MediaRequest {
  policyInfo: PolicyInfo;
  receiveSlots: Array<ReceiveSlot>;
  codecInfo?: CodecInfo;
}

export type MediaRequestId = string;

const CODEC_DEFAULTS = {
  h264: {
    maxFs: 8192,
    maxFps: 3000,
    maxMbps: 245760,
  },
};

type SendMediaRequestsCallback = (mediaRequests: WcmeMediaRequest[]) => void;

export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private counter;

  private clientRequests: {[key: MediaRequestId]: MediaRequest};

  private slotsActiveInLastMediaRequest: {[key: ReceiveSlotId]: ReceiveSlot};

  constructor(sendMediaRequestsCallback: SendMediaRequestsCallback) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.counter = 0;
    this.clientRequests = {};
    this.slotsActiveInLastMediaRequest = {};
  }

  private resetInactiveReceiveSlots() {
    const activeSlots: {[key: ReceiveSlotId]: ReceiveSlot} = {};

    // create a map of all currently used slot ids
    Object.values(this.clientRequests).forEach((request) =>
      request.receiveSlots.forEach((slot) => {
        activeSlots[slot.id] = slot;
      })
    );

    // when we stop using some receive slots and they are not included in the new media request,
    // we will never get a 'no source' notification for them, so we reset their state,
    // so that the client doesn't try to display their video anymore
    for (const [slotId, slot] of Object.entries(this.slotsActiveInLastMediaRequest)) {
      if (!(slotId in activeSlots)) {
        LoggerProxy.logger.info(
          `multistream:mediaRequestManager --> resetting sourceState to "no source" for slot ${slot.id}`
        );
        slot.resetSourceState();
      }
    }

    this.slotsActiveInLastMediaRequest = activeSlots;
  }

  private sendRequests() {
    const wcmeMediaRequests: WcmeMediaRequest[] = [];

    // todo: check how many streams we're asking for and what resolution and introduce some limits (spark-377701)
    const maxPayloadBitsPerSecond = 10 * 1000 * 1000;

    // map all the client media requests to wcme media requests
    Object.values(this.clientRequests).forEach((mr) => {
      wcmeMediaRequests.push(
        new WcmeMediaRequest(
          mr.policyInfo.policy === 'active-speaker'
            ? Policy.ActiveSpeaker
            : Policy.ReceiverSelected,
          mr.policyInfo.policy === 'active-speaker'
            ? new ActiveSpeakerInfo(
                mr.policyInfo.priority,
                mr.policyInfo.crossPriorityDuplication,
                mr.policyInfo.crossPolicyDuplication,
                mr.policyInfo.preferLiveVideo
              )
            : new ReceiverSelectedInfo(mr.policyInfo.csi),
          mr.receiveSlots.map((receiveSlot) => receiveSlot.wcmeReceiveSlot),
          maxPayloadBitsPerSecond,
          mr.codecInfo && [
            new WcmeCodecInfo(
              0x80,
              new H264Codec(
                mr.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs,
                mr.codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps,
                mr.codecInfo.maxMbps || CODEC_DEFAULTS.h264.maxMbps,
                mr.codecInfo.maxWidth,
                mr.codecInfo.maxHeight
              )
            ),
          ]
        )
      );
    });

    this.sendMediaRequestsCallback(wcmeMediaRequests);

    this.resetInactiveReceiveSlots();
  }

  public addRequest(mediaRequest: MediaRequest, commit = true): MediaRequestId {
    // eslint-disable-next-line no-plusplus
    const newId = `${this.counter++}`;

    this.clientRequests[newId] = mediaRequest;

    if (commit) {
      this.commit();
    }

    return newId;
  }

  public cancelRequest(requestId: MediaRequestId, commit = true) {
    delete this.clientRequests[requestId];

    if (commit) {
      this.commit();
    }
  }

  public commit() {
    return this.sendRequests();
  }

  public reset() {
    this.clientRequests = {};
    this.slotsActiveInLastMediaRequest = {};
  }
}
