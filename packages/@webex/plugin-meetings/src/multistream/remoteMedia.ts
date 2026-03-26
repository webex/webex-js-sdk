/* eslint-disable valid-jsdoc */
import {MediaType, StreamState} from '@webex/internal-media-core';
import EventsScope from '../common/events/events-scope';
import Metrics from '../metrics';
import LoggerProxy from '../common/logs/logger-proxy';

import MediaRequestManager from './mediaRequestManager';
import {CSI, ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';
import type {MediaRequestId, RemoteVideoResolution, SizeHint} from './types';
import BEHAVIORAL_METRICS from '../metrics/constants';
import MediaCodecHelper from './codec/mediaCodecHelper';

export const RemoteMediaEvents = {
  SourceUpdate: ReceiveSlotEvents.SourceUpdate,
  Stopped: 'stopped',
};

/**
 * Converts pane size into h264 maxFs
 * @param {RemoteVideoResolution} paneSize
 * @returns {number}
 * @deprecated Prefer `RemoteMedia` resolution options and `setSizeHint()`; see `multistream/codec/mediaCodecHelper` for codec details.
 */
export function getMaxFs(paneSize: RemoteVideoResolution): number {
  LoggerProxy.logger.warn(
    'RemoteMedia->getMaxFs --> [DEPRECATION WARNING]: getMaxFs has been deprecated; use size hints / resolution on RemoteMedia instead'
  );
  Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.DEPRECATED_GET_MAX_FS_USED, {paneSize});

  return MediaCodecHelper.H264.getMaxFs(paneSize);
}

type Options = {
  resolution?: RemoteVideoResolution; // applies only to groups of type MediaType.VideoMain and MediaType.VideoSlides
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
   * The size hint of the media request, used for logging and media requests.
   * Set by setSizeHint() based on video element dimensions.
   * @todo remove this once deprecation of getEffectiveMaxFs() is complete
   */
  private sizeHint: SizeHint = {};

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
    this.sizeHint = {resolution: this.options.resolution};
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
  public setSizeHint(width: number, height: number) {
    if (width === 0 || height === 0) {
      return;
    }

    this.sizeHint.width = width;
    this.sizeHint.height = height;
    this.receiveSlot?.setSizeHint(this.sizeHint);

    // TODO: remove this once deprecation of getEffectiveMaxFs() is complete
    const maxFs = MediaCodecHelper.H264.getSizeHintMaxFs(this.sizeHint);
    if (maxFs !== undefined) {
      this.receiveSlot?.emit(
        {
          file: 'meeting/receiveSlot',
          function: 'setMaxFs',
        },
        ReceiveSlotEvents.MaxFsUpdate,
        {
          maxFs,
        }
      );
    }
  }

  /**
   * Get the current size hint that would be used in media requests
   * @returns {SizeHint | undefined} The size hint, or undefined if no size hint has been set
   */
  public getSizeHint(): SizeHint | undefined {
    return this.sizeHint;
  }

  /**
   * Get the current effective maxFs value that would be used in media requests
   * @returns {number | undefined} The maxFs value, or undefined if no constraints
   * @deprecated Use {@link RemoteMedia.getSizeHint} and layout resolution instead.
   */
  public getEffectiveMaxFs(): number | undefined {
    LoggerProxy.logger.warn(
      'RemoteMedia->getEffectiveMaxFs --> [DEPRECATION WARNING]: use getSizeHint() and resolution options instead'
    );
    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.DEPRECATED_GET_EFFECTIVE_MAX_FS_USED, {
      surface: 'RemoteMedia',
    });

    return MediaCodecHelper.H264.getSizeHintMaxFs({
      width: this.sizeHint?.width,
      height: this.sizeHint?.height,
      resolution: this.options.resolution,
    });
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

    this.mediaRequestId = this.mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'receiver-selected',
          csi,
        },
        receiveSlots: [this.receiveSlot],
        sizeHint: this.sizeHint,
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
