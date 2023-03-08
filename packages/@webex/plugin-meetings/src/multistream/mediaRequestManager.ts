/* eslint-disable require-jsdoc */
import {
  MediaRequest as WcmeMediaRequest,
  Policy,
  ActiveSpeakerInfo,
  ReceiverSelectedInfo,
  CodecInfo as WcmeCodecInfo,
  H264Codec,
} from '@webex/internal-media-core';
import {cloneDeep, debounce} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotEvents, ReceiveSlotId} from './receiveSlot';
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
  preferredMaxFs?: number;
}

export type MediaRequestId = string;

const CODEC_DEFAULTS = {
  h264: {
    maxFs: 8192,
    maxFps: 3000,
    maxMbps: 245760,
  },
};

const DEBOUNCED_SOURCE_UPDATE_TIME = 1000;

type DegradationPreferences = {
  maxMacroblocksLimit: number;
};

type SendMediaRequestsCallback = (mediaRequests: WcmeMediaRequest[]) => void;

export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private counter: number;

  private clientRequests: {[key: MediaRequestId]: MediaRequest};

  private degradationPreferences: DegradationPreferences;

  private sourceUpdateListener: () => void;

  private debouncedSourceUpdateListener: () => void;

  constructor(
    degradationPreferences: DegradationPreferences,
    sendMediaRequestsCallback: SendMediaRequestsCallback
  ) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.counter = 0;
    this.clientRequests = {};
    this.degradationPreferences = degradationPreferences;
    this.sourceUpdateListener = this.commit.bind(this);
    this.debouncedSourceUpdateListener = debounce(
      this.sourceUpdateListener,
      DEBOUNCED_SOURCE_UPDATE_TIME
    );
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
      Object.entries(clientRequests).forEach(([id, mr]) => {
        if (mr.codecInfo) {
          mr.codecInfo.maxFs = Math.min(
            mr.preferredMaxFs || CODEC_DEFAULTS.h264.maxFs,
            mr.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs,
            maxFsLimits[i]
          );
          // we only consider sources with "live" state
          const slotsWithLiveSource = this.clientRequests[id].receiveSlots.filter(
            (rs) => rs.sourceState === 'live'
          );
          totalMacroblocksRequested += mr.codecInfo.maxFs * slotsWithLiveSource.length;
        }
      });
      if (totalMacroblocksRequested <= this.degradationPreferences.maxMacroblocksLimit) {
        if (i !== 0) {
          LoggerProxy.logger.warn(
            `multistream:mediaRequestManager --> too many streams with high max-fs, frame size will be limited to ${maxFsLimits[i]}`
          );
        }
        break;
      } else if (i === maxFsLimits.length - 1) {
        LoggerProxy.logger.warn(
          `multistream:mediaRequestManager --> even with frame size limited to ${maxFsLimits[i]} you are still requesting too many streams, consider reducing the number of requests`
        );
      }
    }

    return clientRequests;
  }

  private sendRequests() {
    const wcmeMediaRequests: WcmeMediaRequest[] = [];

    const clientRequests = this.getDegradedClientRequests();
    const maxPayloadBitsPerSecond = 10 * 1000 * 1000;

    // map all the client media requests to wcme media requests
    Object.values(clientRequests).forEach((mr) => {
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
  }

  public addRequest(mediaRequest: MediaRequest, commit = true): MediaRequestId {
    // eslint-disable-next-line no-plusplus
    const newId = `${this.counter++}`;

    this.clientRequests[newId] = mediaRequest;

    mediaRequest.receiveSlots.forEach((rs) => {
      rs.on(ReceiveSlotEvents.SourceUpdate, this.sourceUpdateListener);
      rs.on(ReceiveSlotEvents.MaxFsUpdate, ({maxFs}) => {
        mediaRequest.preferredMaxFs = maxFs;
        this.debouncedSourceUpdateListener();
      });
    });

    if (commit) {
      this.commit();
    }

    return newId;
  }

  public cancelRequest(requestId: MediaRequestId, commit = true) {
    this.clientRequests[requestId]?.receiveSlots.forEach((rs) => {
      rs.off(ReceiveSlotEvents.SourceUpdate, this.sourceUpdateListener);
    });

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
  }
}
