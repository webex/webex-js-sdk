/* eslint-disable require-jsdoc */
import {
  StreamRequest,
  Policy,
  ActiveSpeakerInfo,
  ReceiverSelectedInfo,
  CodecInfo as WcmeCodecInfo,
  H264Codec,
  getRecommendedMaxBitrateForFrameSize,
  RecommendedOpusBitrates,
  NamedMediaGroup,
} from '@webex/internal-media-core';
import {cloneDeepWith, debounce, isEmpty} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';
import {getMaxFs} from './remoteMedia';

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
  handleMaxFs?: ({maxFs}: {maxFs: number}) => void;
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

type SendMediaRequestsCallback = (streamRequests: StreamRequest[]) => void;
type Kind = 'audio' | 'video';

type Options = {
  degradationPreferences: DegradationPreferences;
  kind: Kind;
  trimRequestsToNumOfSources: boolean; // if enabled, AS speaker requests will be trimmed based on the calls to setNumCurrentSources()
};

type ClientRequestsMap = {[key: MediaRequestId]: MediaRequest};

export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private kind: Kind;

  private counter: number;

  private clientRequests: ClientRequestsMap;

  private degradationPreferences: DegradationPreferences;

  private sourceUpdateListener: () => void;

  private debouncedSourceUpdateListener: () => void;

  private previousStreamRequests: Array<StreamRequest> = [];

  private trimRequestsToNumOfSources: boolean;
  private numTotalSources: number;
  private numLiveSources: number;

  constructor(sendMediaRequestsCallback: SendMediaRequestsCallback, options: Options) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.counter = 0;
    this.numLiveSources = 0;
    this.numTotalSources = 0;
    this.clientRequests = {};
    this.degradationPreferences = options.degradationPreferences;
    this.kind = options.kind;
    this.trimRequestsToNumOfSources = options.trimRequestsToNumOfSources;
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

  private getDegradedClientRequests(clientRequests: ClientRequestsMap) {
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
            mr.preferredMaxFs || CODEC_DEFAULTS.h264.maxFs,
            mr.codecInfo.maxFs || CODEC_DEFAULTS.h264.maxFs,
            maxFsLimits[i]
          );
          // we only consider sources with "live" state
          const slotsWithLiveSource = mr.receiveSlots.filter((rs) => rs.sourceState === 'live');
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
  }

  /**
   * Returns true if two stream requests are the same, false otherwise.
   *
   * @param {StreamRequest} streamRequestA - Stream request A for comparison.
   * @param {StreamRequest} streamRequestB - Stream request B for comparison.
   * @returns {boolean} - Whether they are equal.
   */
  // eslint-disable-next-line class-methods-use-this
  public isEqual(streamRequestA: StreamRequest, streamRequestB: StreamRequest) {
    return (
      JSON.stringify(streamRequestA._toJmpStreamRequest()) ===
      JSON.stringify(streamRequestB._toJmpStreamRequest())
    );
  }

  /**
   * Compares new stream requests to previous ones and determines
   * if they are the same.
   *
   * @param {StreamRequest[]} newRequests - Array with new requests.
   * @returns {boolean} - True if they are equal, false otherwise.
   */
  private checkIsNewRequestsEqualToPrev(newRequests: StreamRequest[]) {
    return (
      !isEmpty(this.previousStreamRequests) &&
      this.previousStreamRequests.length === newRequests.length &&
      this.previousStreamRequests.every((req, idx) => this.isEqual(req, newRequests[idx]))
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
   * Returns the max Macro Blocks per second (maxMbps) per H264 Stream
   *
   * The maxMbps will be calculated based on maxFs and maxFps
   * (default h264 maxFps as fallback if maxFps is not defined)
   *
   * @param {MediaRequest} mediaRequest  - mediaRequest to take data from
   * @returns {number} maxMbps
   */
  // eslint-disable-next-line class-methods-use-this
  private getH264MaxMbps(mediaRequest: MediaRequest): number {
    // fallback for maxFps (not needed for maxFs, since there is a fallback already in getDegradedClientRequests)
    const maxFps = mediaRequest.codecInfo.maxFps || CODEC_DEFAULTS.h264.maxFps;

    // divided by 100 since maxFps is 3000 (for 30 frames per seconds)
    return (mediaRequest.codecInfo.maxFs * maxFps) / 100;
  }

  /**
   * Clears the previous stream requests.
   *
   * @returns {void}
   */
  public clearPreviousRequests(): void {
    this.previousStreamRequests = [];
  }

  /** Modifies the passed in clientRequests and makes sure that in total they don't ask
   *  for more streams than there are available.
   *
   * @param {Object} clientRequests
   * @returns {void}
   */
  private trimRequests(clientRequests: ClientRequestsMap) {
    const preferLiveVideo = this.getPreferLiveVideo();

    if (!this.trimRequestsToNumOfSources) {
      return;
    }

    // preferLiveVideo being undefined means that there are no active-speaker requests so we don't need to do any trimming
    if (preferLiveVideo === undefined) {
      return;
    }

    let numStreamsAvailable = preferLiveVideo ? this.numLiveSources : this.numTotalSources;

    Object.values(clientRequests)
      .sort((a, b) => {
        // we have to count how many streams we're asking for
        // and should not ask for more than numStreamsAvailable in total,
        // so we might need to trim active-speaker requests and first ones to trim should be
        // the ones with lowest priority

        // receiver-selected requests have priority over active-speakers
        if (a.policyInfo.policy === 'receiver-selected') {
          return -1;
        }
        if (b.policyInfo.policy === 'receiver-selected') {
          return 1;
        }

        // and active-speakers are sorted by descending priority
        return b.policyInfo.priority - a.policyInfo.priority;
      })
      .forEach((request) => {
        // we only trim active-speaker requests
        if (request.policyInfo.policy === 'active-speaker') {
          const trimmedCount = Math.min(numStreamsAvailable, request.receiveSlots.length);

          request.receiveSlots.length = trimmedCount;

          numStreamsAvailable -= trimmedCount;
        } else {
          numStreamsAvailable -= request.receiveSlots.length;
        }

        if (numStreamsAvailable < 0) {
          numStreamsAvailable = 0;
        }
      });
  }

  private getPreferLiveVideo(): boolean | undefined {
    let preferLiveVideo;

    Object.values(this.clientRequests).forEach((mr) => {
      if (mr.policyInfo.policy === 'active-speaker') {
        // take the value from first encountered active speaker request
        if (preferLiveVideo === undefined) {
          preferLiveVideo = mr.policyInfo.preferLiveVideo;
        }

        if (mr.policyInfo.preferLiveVideo !== preferLiveVideo) {
          throw new Error(
            'a mix of active-speaker groups with different values for preferLiveVideo is not supported'
          );
        }
      }
    });

    return preferLiveVideo;
  }

  private cloneClientRequests(): ClientRequestsMap {
    // we clone the client requests but without cloning the ReceiveSlots that they reference
    return cloneDeepWith(this.clientRequests, (value, key) => {
      if (key === 'receiveSlots') {
        return [...value];
      }

      return undefined;
    });
  }

  private sendRequests() {
    const streamRequests: StreamRequest[] = [];

    // clone the requests so that any modifications we do to them don't affect the original ones
    const clientRequests = this.cloneClientRequests();

    this.trimRequests(clientRequests);
    this.getDegradedClientRequests(clientRequests);

    // map all the client media requests to wcme stream requests
    Object.values(clientRequests).forEach((mr) => {
      if (mr.receiveSlots.length > 0) {
        streamRequests.push(
          new StreamRequest(
            mr.policyInfo.policy === 'active-speaker'
              ? Policy.ActiveSpeaker
              : Policy.ReceiverSelected,
            mr.policyInfo.policy === 'active-speaker'
              ? new ActiveSpeakerInfo(
                  mr.policyInfo.priority,
                  mr.policyInfo.crossPriorityDuplication,
                  mr.policyInfo.crossPolicyDuplication,
                  mr.policyInfo.preferLiveVideo,
                  mr.policyInfo.namedMediaGroups
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
                  this.getH264MaxMbps(mr),
                  mr.codecInfo.maxWidth,
                  mr.codecInfo.maxHeight
                )
              ),
            ]
          )
        );
      }
    });

    //! IMPORTANT: this is only a temporary fix. This will soon be done in the jmp layer (@webex/json-multistream)
    // https://jira-eng-gpk2.cisco.com/jira/browse/WEBEX-326713
    if (!this.checkIsNewRequestsEqualToPrev(streamRequests)) {
      this.sendMediaRequestsCallback(streamRequests);
      this.previousStreamRequests = streamRequests;
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

    const eventHandler = ({maxFs}) => {
      mediaRequest.preferredMaxFs = maxFs;
      this.debouncedSourceUpdateListener();
    };
    mediaRequest.handleMaxFs = eventHandler;

    mediaRequest.receiveSlots.forEach((rs) => {
      rs.on(ReceiveSlotEvents.SourceUpdate, this.sourceUpdateListener);
      rs.on(ReceiveSlotEvents.MaxFsUpdate, mediaRequest.handleMaxFs);
    });

    if (commit) {
      this.commit();
    }

    return newId;
  }

  public cancelRequest(requestId: MediaRequestId, commit = true) {
    const mediaRequest = this.clientRequests[requestId];

    mediaRequest?.receiveSlots.forEach((rs) => {
      rs.off(ReceiveSlotEvents.SourceUpdate, this.sourceUpdateListener);
      rs.off(ReceiveSlotEvents.MaxFsUpdate, mediaRequest.handleMaxFs);
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
    this.numTotalSources = 0;
    this.numLiveSources = 0;
  }

  public setNumCurrentSources(numTotalSources: number, numLiveSources: number) {
    this.numTotalSources = numTotalSources;
    this.numLiveSources = numLiveSources;

    this.sendRequests();
  }
}
