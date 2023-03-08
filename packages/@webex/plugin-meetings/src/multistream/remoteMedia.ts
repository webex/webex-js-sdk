/* eslint-disable valid-jsdoc */
import {MediaType, SourceState} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import EventsScope from '../common/events/events-scope';

import {MediaRequestId, MediaRequestManager} from './mediaRequestManager';
import {CSI, ReceiveSlot, ReceiveSlotEvents} from './receiveSlot';

export const RemoteMediaEvents = {
  SourceUpdate: ReceiveSlotEvents.SourceUpdate,
  Stopped: 'stopped',
};

export type RemoteVideoResolution =
  | 'thumbnail' // the smallest possible resolution, 90p or less
  | 'very small' // 180p or less
  | 'small' // 360p or less
  | 'medium' // 720p or less
  | 'large' // 1080p or less
  | 'best'; // highest possible resolution

/**
 * Converts pane size into h264 maxFs
 * @param {PaneSize} paneSize
 * @returns {number}
 */
export function getMaxFs(paneSize: RemoteVideoResolution): number {
  let maxFs;

  switch (paneSize) {
    case 'thumbnail':
      maxFs = 60;
      break;
    case 'very small':
      maxFs = 240;
      break;
    case 'small':
      maxFs = 920;
      break;
    case 'medium':
      maxFs = 3600;
      break;
    case 'large':
      maxFs = 8192;
      break;
    case 'best':
      maxFs = 8192; // for now 'best' is 1080p, so same as 'large'
      break;
    default:
      LoggerProxy.logger.warn(
        `RemoteMedia#getMaxFs --> unsupported paneSize: ${paneSize}, using "medium" instead`
      );
      maxFs = 3600;
  }

  return maxFs;
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
   */
  public setSizeHint(width, height) {
    // only base on height for now
    let fs: number;

    if (height < 135) {
      fs = 60;
    } else if (height < 270) {
      fs = 240;
    } else if (height < 540) {
      fs = 920;
    } else {
      fs = 3600;
    }

    this.receiveSlot?.setMaxFs(fs);
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
        codecInfo: this.options.resolution && {
          codec: 'h264',
          maxFs: getMaxFs(this.options.resolution),
        },
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
  public get sourceState(): SourceState {
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
