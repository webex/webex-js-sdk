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
  AV1Codec,
  SupportedResolution,
  AV1EncodingParams,
  MediaType,
  MediaCodecMimeType,
} from '@webex/internal-media-core';
import {cloneDeepWith, debounce} from 'lodash';

import LoggerProxy from '../common/logs/logger-proxy';

import {ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';
import {MAX_FS_VALUES} from './remoteMedia';
import {AV1_CODEC_PARAMETERS, H264_CODEC_PARAMETERS} from './codec/constants';

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

const DEBOUNCED_SOURCE_UPDATE_TIME = 1000;

const RESOLUTION_BUCKETS: Array<[SupportedResolution, number]> = [
  ['90p', MAX_FS_VALUES['90p']],
  ['180p', MAX_FS_VALUES['180p']],
  ['360p', MAX_FS_VALUES['360p']],
  ['540p', MAX_FS_VALUES['540p']],
  ['720p', MAX_FS_VALUES['720p']],
];

type DegradationPreferences = {
  maxMacroblocksLimit: number;
};

type SendMediaRequestsCallback = (streamRequests: StreamRequest[]) => void;
type GetIngressPayloadTypeCallback = (
  mediaType: MediaType,
  codecMimeType: MediaCodecMimeType
) => number | undefined;
type Kind = 'audio' | 'video';

type AudioMediaRequestManagerOptions = {
  degradationPreferences: DegradationPreferences;
  kind: 'audio';
  trimRequestsToNumOfSources: boolean; // if enabled, AS speaker requests will be trimmed based on the calls to setNumCurrentSources()
};

type VideoMediaRequestManagerOptions = {
  degradationPreferences: DegradationPreferences;
  kind: 'video';
  trimRequestsToNumOfSources: boolean;
  enableAv1?: boolean;
};

type Options = AudioMediaRequestManagerOptions | VideoMediaRequestManagerOptions;

type ClientRequestsMap = {[key: MediaRequestId]: MediaRequest};

export class MediaRequestManager {
  private sendMediaRequestsCallback: SendMediaRequestsCallback;

  private getIngressPayloadTypeCallback: GetIngressPayloadTypeCallback;

  private kind: Kind;

  private counter: number;

  private clientRequests: ClientRequestsMap;

  private degradationPreferences: DegradationPreferences;

  private sourceUpdateListener: () => void;

  private debouncedSourceUpdateListener: () => void;

  private trimRequestsToNumOfSources: boolean;
  private enableAv1: boolean;
  private numTotalSources: number;
  private numLiveSources: number;

  constructor(
    sendMediaRequestsCallback: SendMediaRequestsCallback,
    getIngressPayloadTypeCallback: GetIngressPayloadTypeCallback,
    options: Options
  ) {
    this.sendMediaRequestsCallback = sendMediaRequestsCallback;
    this.getIngressPayloadTypeCallback = getIngressPayloadTypeCallback;
    this.counter = 0;
    this.numLiveSources = 0;
    this.numTotalSources = 0;
    this.clientRequests = {};
    this.degradationPreferences = options.degradationPreferences;
    this.kind = options.kind;
    this.trimRequestsToNumOfSources = options.trimRequestsToNumOfSources;
    this.enableAv1 = options.kind === 'video' && !!options.enableAv1;
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
      MAX_FS_VALUES['1080p'],
      MAX_FS_VALUES['720p'],
      MAX_FS_VALUES['540p'],
      MAX_FS_VALUES['360p'],
      MAX_FS_VALUES['180p'],
      MAX_FS_VALUES['90p'],
    ];

    // reduce max-fs until total macroblocks is below limit
    for (let i = 0; i < maxFsLimits.length; i += 1) {
      let totalMacroblocksRequested = 0;
      Object.values(clientRequests).forEach((mr) => {
        if (mr.codecInfo) {
          mr.codecInfo.maxFs = Math.min(
            mr.preferredMaxFs || H264_CODEC_PARAMETERS.maxFs,
            mr.codecInfo.maxFs || H264_CODEC_PARAMETERS.maxFs,
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
      mediaRequest.codecInfo.maxFs || H264_CODEC_PARAMETERS.maxFs
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
    const maxFps = mediaRequest.codecInfo.maxFps || H264_CODEC_PARAMETERS.maxFps;

    // divided by 100 since maxFps is 3000 (for 30 frames per seconds)
    return (mediaRequest.codecInfo.maxFs * maxFps) / 100;
  }

  /**
   * Returns the AV1 encoding parameters for a media request
   * @param mediaRequest - The media request to get the AV1 encoding parameters for
   * @returns {AV1EncodingParams} The AV1 encoding parameters
   */
  // eslint-disable-next-line class-methods-use-this
  private getAv1EncodingParams(mediaRequest: MediaRequest): AV1EncodingParams {
    const frameSize = mediaRequest.codecInfo.maxFs || H264_CODEC_PARAMETERS.maxFs;
    const resolution = RESOLUTION_BUCKETS.find(([, maxFs]) => frameSize <= maxFs)?.[0] ?? '1080p';

    return AV1_CODEC_PARAMETERS[resolution];
  }

  private buildH264CodecInfo(mr: MediaRequest): WcmeCodecInfo | undefined {
    if (!mr.codecInfo) {
      return undefined;
    }

    const h264PayloadType = this.getIngressPayloadTypeCallback(
      mr.receiveSlots[0].mediaType,
      MediaCodecMimeType.H264
    );

    if (h264PayloadType === undefined) {
      return undefined;
    }

    return WcmeCodecInfo.fromH264(
      h264PayloadType,
      new H264Codec(
        mr.codecInfo.maxFs,
        mr.codecInfo.maxFps || H264_CODEC_PARAMETERS.maxFps,
        this.getH264MaxMbps(mr),
        mr.codecInfo.maxWidth,
        mr.codecInfo.maxHeight
      )
    );
  }

  private buildAv1CodecInfo(mr: MediaRequest): WcmeCodecInfo | undefined {
    if (!this.enableAv1 || !mr.codecInfo) {
      return undefined;
    }

    const av1PayloadType = this.getIngressPayloadTypeCallback(
      mr.receiveSlots[0].mediaType,
      MediaCodecMimeType.AV1
    );

    if (av1PayloadType === undefined) {
      return undefined;
    }

    const av1EncodingParams = this.getAv1EncodingParams(mr);

    return WcmeCodecInfo.fromAv1(
      av1PayloadType,
      new AV1Codec(
        av1EncodingParams.levelIdx,
        av1EncodingParams.tier,
        mr.codecInfo.maxWidth || av1EncodingParams.maxWidth,
        mr.codecInfo.maxHeight || av1EncodingParams.maxHeight,
        av1EncodingParams.maxPicSize,
        av1EncodingParams.maxDecodeRate
      )
    );
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
        const codecInfos: WcmeCodecInfo[] = mr.codecInfo
          ? [this.buildH264CodecInfo(mr), this.buildAv1CodecInfo(mr)].filter(
              (info): info is WcmeCodecInfo => info !== undefined
            )
          : [];

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
            codecInfos
          )
        );
      }
    });

    this.sendMediaRequestsCallback(streamRequests);
    LoggerProxy.logger.info(`multistream:sendRequests --> media requests sent.`);
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
