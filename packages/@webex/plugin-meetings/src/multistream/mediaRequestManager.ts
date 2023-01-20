/* eslint-disable require-jsdoc */
import {MediaConnection as MC} from '@webex/internal-media-core';
import {cloneDeep} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotId} from './receiveSlot';
import {getMaxFs} from './remoteMedia';

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

type DegradationPreferences = {
  maxMacroblocksLimit: number;
};

// @ts-ignore
type SendMediaRequestsCallback = (mediaRequests: MC.MediaRequest[]) => void;

export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private counter: number;

  private clientRequests: {[key: MediaRequestId]: MediaRequest};

  private slotsActiveInLastMediaRequest: {[key: ReceiveSlotId]: ReceiveSlot};

  private degradationPreferences: DegradationPreferences;

  constructor(
    degradationPreferences: DegradationPreferences,
    sendMediaRequestsCallback: SendMediaRequestsCallback
  ) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.counter = 0;
    this.clientRequests = {};
    this.slotsActiveInLastMediaRequest = {};
    this.degradationPreferences = degradationPreferences;
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

  public setDegradationPreferences(degradationPreferences: DegradationPreferences) {
    this.degradationPreferences = degradationPreferences;
    this.sendRequests(); // re-send requests after preferences are set
  }

  private getDegradedClientRequests() {
    const clientRequests = cloneDeep(this.clientRequests);
    const maxFsLimits = [
      getMaxFs('best'),
      getMaxFs('large'),
      getMaxFs('medium'),
      getMaxFs('small'),
      getMaxFs('very small'),
      getMaxFs('thumbnail'),
    ];

    // reduce max-fs until total macroblocks is below limit
    for (let i = 0; i < maxFsLimits.length; i += 1) {
      let totalMacroblocksRequested = 0;
      Object.values(clientRequests).forEach((mr) => {
        if (mr.codecInfo) {
          mr.codecInfo.maxFs = Math.min(
            mr.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs,
            maxFsLimits[i]
          );
          totalMacroblocksRequested += mr.codecInfo.maxFs * mr.receiveSlots.length;
        }
      });
      if (
        totalMacroblocksRequested <= this.degradationPreferences.maxMacroblocksLimit ||
        i === maxFsLimits.length - 1
      ) {
        if (i !== 0) {
          LoggerProxy.logger.warn(
            `multistream:mediaRequestManager --> too many requests with high max-fs, frame size will be limited to ${maxFsLimits[i]}`
          );
        }
        if (i === maxFsLimits.length - 1) {
          LoggerProxy.logger.warn(
            `multistream:mediaRequestManager --> you are requesting too many streams, consider reducing the number of requests`
          );
        }
        break;
      }
    }

    return clientRequests;
  }

  private sendRequests() {
    // @ts-ignore
    const wcmeMediaRequests: MC.MediaRequest[] = [];

    const clientRequests = this.getDegradedClientRequests();
    const maxPayloadBitsPerSecond = 10 * 1000 * 1000;

    // map all the client media requests to wcme media requests
    Object.values(clientRequests).forEach((mr) => {
      wcmeMediaRequests.push(
        new MC.MediaRequest(
          mr.policyInfo.policy === 'active-speaker'
            ? MC.Policy.ActiveSpeaker
            : MC.Policy.ReceiverSelected,
          mr.policyInfo.policy === 'active-speaker'
            ? new MC.ActiveSpeakerInfo(
                mr.policyInfo.priority,
                mr.policyInfo.crossPriorityDuplication,
                mr.policyInfo.crossPolicyDuplication,
                mr.policyInfo.preferLiveVideo
              )
            : new MC.ReceiverSelectedInfo(mr.policyInfo.csi),
          mr.receiveSlots.map((receiveSlot) => receiveSlot.wcmeReceiveSlot),
          maxPayloadBitsPerSecond,
          mr.codecInfo && [
            new MC.CodecInfo(
              0x80,
              new MC.H264Codec(
                mr.codecInfo.maxFs,
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
