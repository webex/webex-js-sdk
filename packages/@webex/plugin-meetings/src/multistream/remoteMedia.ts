/* eslint-disable valid-jsdoc */
import {MediaType, StreamState} from '@webex/internal-media-core';
import EventsScope from '../common/events/events-scope';

import {MediaRequestManager} from './mediaRequestManager';
import {CSI, ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';
import {CodecInfo, SupportedResolution} from './codec/types';
import {MediaRequestId, RemoteVideoResolution} from './types';
import MediaCodecHelper from './codec/mediaCodecHelper';
import {H264_CODEC_PARAMETERS} from './codec/constants';

export type {
  /** @deprecated use RemoteVideoResolution from @webex/plugin-meetings/src/types instead */
  RemoteVideoResolution,
} from './types';

/** @deprecated use H264_CODEC_PARAMETERS from @webex/plugin-meetings/src/codec/constants instead */
export const MAX_FS_VALUES = {
  '90p': H264_CODEC_PARAMETERS['90p'].maxFs,
  '180p': H264_CODEC_PARAMETERS['180p'].maxFs,
  '360p': H264_CODEC_PARAMETERS['360p'].maxFs,
  '540p': H264_CODEC_PARAMETERS['540p'].maxFs,
  '720p': H264_CODEC_PARAMETERS['720p'].maxFs,
  '1080p': H264_CODEC_PARAMETERS['1080p'].maxFs,
} satisfies Record<SupportedResolution, number>;

/** @deprecated use MediaCodecHelper.H264.getMaxFs() from @webex/plugin-meetings/src/codec/mediaCodecHelper.h264 instead */
export const getMaxFs = (paneSize: RemoteVideoResolution): number => {
  return MediaCodecHelper.H264.getMaxFs(paneSize);
};

export const RemoteMediaEvents = {
  SourceUpdate: ReceiveSlotEvents.SourceUpdate,
  Stopped: 'stopped',
};

type Options = {
  resolution?: RemoteVideoResolution; // applies only to groups of type MediaType.VideoMain and MediaType.VideoSlides
  preferredCodec?: CodecInfo['codec'];
};

export type RemoteMediaId = string;

let remoteMediaCounter = 0;

/**
 * Class representing a remote audio/video stream.
 *
 * Internally it is associated with a specific receive slot
 * and a media request for it.
 */
export class RemoteMedia extends EventsScope {
  private receiveSlot?: ReceiveSlot;

  private readonly mediaRequestManager: MediaRequestManager;

  private readonly options: Options;

  private mediaRequestId?: MediaRequestId;

  public readonly id: RemoteMediaId;

  /**
   * The max frame size of the media request, used for logging and media requests.
   * Set by setSizeHint() based on video element dimensions.
   * When > 0, this value takes precedence over options.resolution in sendMediaRequest().
   */
  private maxFrameSize = 0;

  /**
   * The max pic size of the media request, used for logging and media requests.
   * Set by setSizeHint() based on video element dimensions.
   * When > 0, this value takes precedence over options.resolution in sendMediaRequest().
   */
  private maxPicSize = 0;

  /**
   * Constructs RemoteMedia instance
   *
   * @param receiveSlot
   * @param mediaRequestManager
   * @param options
   */
  constructor(
    receiveSlot: ReceiveSlot,
    mediaRequestManager: MediaRequestManager,
    options?: Options
  ) {
    super();
    remoteMediaCounter += 1;
    this.receiveSlot = receiveSlot;
    this.mediaRequestManager = mediaRequestManager;
    this.options = options || {};
    this.setupEventListeners();
    this.id = `RM${remoteMediaCounter}-${this.receiveSlot.id}`;
  }

  /**
   * Supply the width and height of the video element
   * to restrict the requested resolution to this size
   * @param width width of the video element
   * @param height height of the video element
   * @note width/height of 0 will be ignored
   */
  public setSizeHint(width, height) {
    if (width === 0 || height === 0) {
      return;
    }

    // we switch to the next resolution level when the height is 10% more than the current resolution height
    // except for 1080p - we switch to it immediately when the height is more than 720p
    const threshold = 1.1;
    const getThresholdHeight = (h: number) => Math.round(h * threshold);

    let resolution: RemoteVideoResolution;

    if (height < getThresholdHeight(90)) {
      resolution = 'thumbnail';
    } else if (height < getThresholdHeight(180)) {
      resolution = 'very small';
    } else if (height < getThresholdHeight(360)) {
      resolution = 'small';
    } else if (height < getThresholdHeight(540)) {
      resolution = 'medium';
    } else if (height <= 720) {
      resolution = 'large';
    } else {
      resolution = 'best';
    }

    this.maxFrameSize = MediaCodecHelper.H264.getMaxFs(resolution);
    this.maxPicSize = MediaCodecHelper.AV1.getMaxPicSize(resolution);
    this.receiveSlot?.setMaxFs(this.maxFrameSize);
    this.receiveSlot?.setMaxPicSize(this.maxPicSize);
  }

  /**
   * Get the current effective maxFs value that would be used in media requests
   * @returns {number | undefined} The maxFs value, or undefined if no constraints
   */
  public getEffectiveMaxFs(): number | undefined {
    if (this.maxFrameSize > 0) {
      return this.maxFrameSize;
    }

    if (this.options.resolution) {
      return MediaCodecHelper.H264.getMaxFs(this.options.resolution);
    }

    return undefined;
  }

  /**
   * Get the current effective maxPicSize value that would be used in media requests
   * @returns {number | undefined} The max pic size, or undefined if no constraints
   */
  public getEffectiveMaxPicSize(): number | undefined {
    if (this.maxPicSize > 0) {
      return this.maxPicSize;
    }

    if (this.options.resolution) {
      return MediaCodecHelper.AV1.getMaxPicSize(this.options.resolution);
    }

    return undefined;
  }

  /**
   * Invalidates the remote media by clearing the reference to a receive slot and
   * cancelling the media request.
   * After this call the remote media is unusable.
   *
   * @param {boolean} commit - whether to commit the cancellation of the media request
   * @internal
   */
  public stop(commit = true) {
    this.cancelMediaRequest(commit);
    this.receiveSlot?.removeAllListeners();
    this.receiveSlot = undefined;
    this.emit(
      {
        file: 'multistream/remoteMedia',
        function: 'stop',
      },
      RemoteMediaEvents.Stopped,
      {}
    );
  }

  /**
   * Sends a new media request. This method can only be used for receiver-selected policy,
   * because only in that policy we have a 1-1 relationship between RemoteMedia and MediaRequest
   * and the request id is then stored in this RemoteMedia instance.
   * For active-speaker policy, the same request is shared among many RemoteMedia instances,
   * so it's managed through RemoteMediaGroup
   *
   * @internal
   */
  public sendMediaRequest(csi: CSI, commit: boolean) {
    if (this.mediaRequestId) {
      this.cancelMediaRequest(false);
    }

    if (!this.receiveSlot) {
      throw new Error('sendMediaRequest() called on an invalidated RemoteMedia instance');
    }

    const mediaCodecHelper = MediaCodecHelper.get(this.options.preferredCodec);
    this.mediaRequestId = this.mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [this.receiveSlot],
        codecInfo: mediaCodecHelper.getCodecInfo({
          maxFs: this.getEffectiveMaxFs(),
          maxPicSize: this.getEffectiveMaxPicSize(),
        }),
      },
      commit
    );
  }

  /**
   * @internal
   */
  public cancelMediaRequest(commit: boolean) {
    if (this.mediaRequestId) {
      this.mediaRequestManager.cancelRequest(this.mediaRequestId, commit);
      this.mediaRequestId = undefined;
    }
  }

  /**
   * registers event listeners on the receive slot and forwards all the events
   */
  private setupEventListeners() {
    if (this.receiveSlot) {
      const scope = {
        file: 'multistream/remoteMedia',
        function: 'setupEventListeners',
      };

      this.receiveSlot.on(ReceiveSlotEvents.SourceUpdate, (data) => {
        this.emit(scope, RemoteMediaEvents.SourceUpdate, data);
      });
    }
  }

  /**
   * Getter for mediaType
   */
  public get mediaType(): MediaType {
    return this.receiveSlot?.mediaType;
  }

  /**
   * Getter for memberId
   */
  public get memberId() {
    return this.receiveSlot?.memberId;
  }

  /**
   * Getter for csi
   */
  public get csi() {
    return this.receiveSlot?.csi;
  }

  /**
   * Getter for source state
   */
  public get sourceState(): StreamState {
    return this.receiveSlot?.sourceState;
  }

  /**
   * Getter for remote media stream
   */
  public get stream() {
    return this.receiveSlot?.stream;
  }

  /**
   * @internal
   * @returns {ReceiveSlot}
   */
  public getUnderlyingReceiveSlot() {
    return this.receiveSlot;
  }
}
