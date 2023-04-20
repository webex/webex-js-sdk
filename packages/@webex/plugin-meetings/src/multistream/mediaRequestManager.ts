/* eslint-disable require-jsdoc */
import {
  MediaRequest as WcmeMediaRequest,
  Policy,
  ActiveSpeakerInfo,
  ReceiverSelectedInfo,
  CodecInfo as WcmeCodecInfo,
  H264Codec,
  getRecommendedMaxBitrateForFrameSize,
  RecommendedOpusBitrates,
} from '@webex/internal-media-core';
import {cloneDeep, debounce, isEmpty} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';
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
type Kind = 'audio' | 'video';

type Options = {
  degradationPreferences: DegradationPreferences;
  kind: Kind;
};
export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private kind: Kind;

  private counter: number;

  private clientRequests: {[key: MediaRequestId]: MediaRequest};

  private degradationPreferences: DegradationPreferences;

  private sourceUpdateListener: () => void;

  private debouncedSourceUpdateListener: () => void;

  private previousWCMEMediaRequests: Array<WcmeMediaRequest> = [];

  constructor(sendMediaRequestsCallback: SendMediaRequestsCallback, options: Options) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.counter = 0;
    this.clientRequests = {};
    this.degradationPreferences = options.degradationPreferences;
    this.kind = options.kind;
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

  /**
   * Returns true if two media requests are the same, false otherwise.
   *
   * @param {WcmeMediaRequest} mediaRequestA - Media request A for comparison.
   * @param {WcmeMediaRequest} mediaRequestB - Media request B for comparison.
   * @returns {boolean} - Whether they are equal.
   */
  // eslint-disable-next-line class-methods-use-this
  public isEqual(mediaRequestA: WcmeMediaRequest, mediaRequestB: WcmeMediaRequest) {
    return (
      JSON.stringify(mediaRequestA._toJmpScrRequest()) ===
      JSON.stringify(mediaRequestB._toJmpScrRequest())
    );
  }

  /**
   * Compares new media requests to previous ones and determines
   * if they are the same.
   *
   * @param {WcmeMediaRequest[]} newRequests - Array with new requests.
   * @returns {boolean} - True if they are equal, false otherwise.
   */
  private checkIsNewRequestsEqualToPrev(newRequests: WcmeMediaRequest[]) {
    return (
      !isEmpty(this.previousWCMEMediaRequests) &&
      this.previousWCMEMediaRequests.length === newRequests.length &&
      this.previousWCMEMediaRequests.every((req, idx) => this.isEqual(req, newRequests[idx]))
    );
  }

  /**
   * Returns the maxPayloadBitsPerSecond per Stream
   *
   * If MediaRequestManager kind is "audio", a constant bitrate will be returned.
   * If MediaRequestManager kind is "video", the bitrate will be calculated based
   * on maxFs (default h264 maxFs as fallback if maxFs is not defined)
   *
   * @param {MediaRequest} mediaRequest  - mediaRequest to take data from
   * @returns {number} maxPayloadBitsPerSecond
   */
  private getMaxPayloadBitsPerSecond(mediaRequest: MediaRequest): number {
    if (this.kind === 'audio') {
      // return mono_music bitrate default if the kind of mediarequest manager is audio:
      return RecommendedOpusBitrates.FB_MONO_MUSIC;
    }

    return getRecommendedMaxBitrateForFrameSize(
      mediaRequest.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs
    );
  }

  /**
   * Returns the max Macro Blocks per second (maxMbps) per Stream
   *
   * If MediaRequestManager kind is "audio", a constant maxMbps will be returned.
   * If MediaRequestManager kind is "video", the maxMbps will be calculated based
   * on maxFs and maxFps (default h264 maxFps as fallback if maxFps is not defined)
   *
   * @param {MediaRequest} mediaRequest  - mediaRequest to take data from
   * @returns {number} maxMbps
   */
  // eslint-disable-next-line class-methods-use-this
  private getMaxMbps(mediaRequest: MediaRequest): number {
    if (this.kind === 'audio') {
      // return the codecInfo maxMbps for audio, since audio doesn't have macro blocks
      // and the default codecInfo should be returned
      return mediaRequest.codecInfo.maxMbps;
    }

    // fallback for maxFps (not needed for maxFs, since there is a fallback already in getDegradedClientRequests)
    const maxFps = mediaRequest.codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps;

    // divided by 100 since maxFps is 3000 (for 30 frames per seconds)
    return (mediaRequest.codecInfo.maxFs * maxFps) / 100;
  }

  /**
   * Clears the previous media requests.
   *
   * @returns {void}
   */
  public clearPreviousRequests(): void {
    this.previousWCMEMediaRequests = [];
  }

  private sendRequests() {
    const wcmeMediaRequests: WcmeMediaRequest[] = [];

    const clientRequests = this.getDegradedClientRequests();

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
          this.getMaxPayloadBitsPerSecond(mr),
          mr.codecInfo && [
            new WcmeCodecInfo(
              0x80,
              new H264Codec(
                mr.codecInfo.maxFs,
                mr.codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps,
                this.getMaxMbps(mr),
                mr.codecInfo.maxWidth,
                mr.codecInfo.maxHeight
              )
            ),
          ]
        )
      );
    });

    //! IMPORTANT: this is only a temporary fix. This will soon be done in the jmp layer (@webex/json-multistream)
    // https://jira-eng-gpk2.cisco.com/jira/browse/WEBEX-326713
    if (!this.checkIsNewRequestsEqualToPrev(wcmeMediaRequests)) {
      this.sendMediaRequestsCallback(wcmeMediaRequests);
      this.previousWCMEMediaRequests = wcmeMediaRequests;
      LoggerProxy.logger.info(`multistream:sendRequests --> media requests sent. `);
    } else {
      LoggerProxy.logger.info(
        `multistream:sendRequests --> detected duplicate WCME requests, skipping them... `
      );
    }
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
