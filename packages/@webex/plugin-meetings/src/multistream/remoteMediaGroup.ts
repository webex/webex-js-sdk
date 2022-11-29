/* eslint-disable valid-jsdoc */
/* eslint-disable require-jsdoc */
/* eslint-disable import/prefer-default-export */
import LoggerProxy from '../common/logs/logger-proxy';

import {getMaxFs, RemoteMedia, RemoteVideoResolution} from './remoteMedia';
import {MediaRequestId, MediaRequestManager} from './mediaRequestManager';
import {CSI, ReceiveSlot} from './receiveSlot';

type Options = {
  resolution?: RemoteVideoResolution; // applies only to groups of type MC.MediaType.VideoMain and MC.MediaType.VideoSlides
  preferLiveVideo?: boolean; // applies only to groups of type MC.MediaType.VideoMain and MC.MediaType.VideoSlides
};

export class RemoteMediaGroup {
  private mediaRequestManager: MediaRequestManager;

  private priority: number;

  private options: Options;

  private unpinnedRemoteMedia: RemoteMedia[];

  private mediaRequestId?: MediaRequestId; // id of the "active-speaker" media request id

  private pinnedRemoteMedia: RemoteMedia[];

  constructor(
    mediaRequestManager: MediaRequestManager,
    receiveSlots: ReceiveSlot[],
    priority: number,
    commitMediaRequest: boolean,
    options: Options = {}
  ) {
    this.mediaRequestManager = mediaRequestManager;
    this.priority = priority;
    this.options = options;

    this.unpinnedRemoteMedia = receiveSlots.map(
      (slot) =>
        new RemoteMedia(slot, this.mediaRequestManager, {
          resolution: this.options.resolution,
        })
    );
    this.pinnedRemoteMedia = [];

    this.sendActiveSpeakerMediaRequest(commitMediaRequest);
  }

  /**
   * Gets the array of remote media elements from the group
   *
   * @param {string} filter - 'all' (default) returns both pinned and unpinned
   * @returns {Array<RemoteMedia>}
   */
  public getRemoteMedia(filter: 'all' | 'pinned' | 'unpinned' = 'all') {
    if (filter === 'unpinned') {
      // return a shallow copy so that the client cannot modify this.unpinnedRemoteMedia array
      return [...this.unpinnedRemoteMedia];
    }
    if (filter === 'pinned') {
      // return a shallow copy so that the client cannot modify this.pinnedRemoteMedia array
      return [...this.pinnedRemoteMedia];
    }
    return [...this.unpinnedRemoteMedia, ...this.pinnedRemoteMedia];
  }

  /**
   * Pins a specific remote media instance to a specfic CSI, so the media will
   * no longer come from active speaker, but from that CSI.
   * If no CSI is given, the current CSI value is used.
   *
   */
  public pin(remoteMedia: RemoteMedia, csi?: CSI): void {
    // if csi is not specified, use the current one
    const targetCsi = csi || remoteMedia.csi;

    if (!targetCsi) {
      throw new Error(
        `failed to pin a remote media object ${remoteMedia.id}, because it has no CSI set and no CSI value was given`
      );
    }

    if (this.pinnedRemoteMedia.indexOf(remoteMedia) >= 0) {
      if (targetCsi === remoteMedia.csi) {
        // remote media already pinned to target CSI, nothing to do
        LoggerProxy.logger.log(
          `RemoteMediaGroup#pin --> remote media ${remoteMedia.id} already pinned`
        );

        return;
      }
    } else {
      const idx = this.unpinnedRemoteMedia.indexOf(remoteMedia);

      if (idx < 0) {
        throw new Error(
          `failed to pin a remote media object ${remoteMedia.id}, because it is not found in this remote media group`
        );
      }

      this.unpinnedRemoteMedia.splice(idx, 1);
      this.pinnedRemoteMedia.push(remoteMedia);

      this.cancelActiveSpeakerMediaRequest(false);
      this.sendActiveSpeakerMediaRequest(false);
    }

    remoteMedia.sendMediaRequest(targetCsi, false);
    this.mediaRequestManager.commit();
  }

  /**
   * Unpins a remote media instance, so that it will again provide media from active speakers
   *
   */
  public unpin(remoteMedia: RemoteMedia) {
    if (this.unpinnedRemoteMedia.indexOf(remoteMedia) >= 0) {
      LoggerProxy.logger.log(
        `RemoteMediaGroup#pin --> remote media ${remoteMedia.id} already unpinned`
      );

      return;
    }
    const idx = this.pinnedRemoteMedia.indexOf(remoteMedia);

    if (idx < 0) {
      throw new Error(
        `failed to unpin a remote media object ${remoteMedia.id}, because it is not found in this remote media group`
      );
    }

    this.pinnedRemoteMedia.splice(idx, 1);
    this.unpinnedRemoteMedia.push(remoteMedia);

    remoteMedia.cancelMediaRequest(false);
    this.cancelActiveSpeakerMediaRequest(false);
    this.sendActiveSpeakerMediaRequest(false);
    this.mediaRequestManager.commit();
  }

  public isPinned(remoteMedia: RemoteMedia) {
    if (this.unpinnedRemoteMedia.indexOf(remoteMedia) >= 0) {
      return false;
    }
    if (this.pinnedRemoteMedia.indexOf(remoteMedia) >= 0) {
      return true;
    }

    throw new Error(`remote media object ${remoteMedia.id} not found in the group`);
  }

  private sendActiveSpeakerMediaRequest(commit: boolean) {
    this.cancelActiveSpeakerMediaRequest(false);

    this.mediaRequestId = this.mediaRequestManager.addRequest(
      {
        policyInfo: {
          policy: 'active-speaker',
          priority: this.priority,
          crossPriorityDuplication: false,
          crossPolicyDuplication: false,
          preferLiveVideo: !!this.options?.preferLiveVideo,
        },
        receiveSlots: this.unpinnedRemoteMedia.map((remoteMedia) =>
          remoteMedia.getUnderlyingReceiveSlot()
        ) as ReceiveSlot[],
        codecInfo: this.options.resolution && {
          codec: 'h264',
          maxFs: getMaxFs(this.options.resolution),
        },
      },
      commit
    );
  }

  private cancelActiveSpeakerMediaRequest(commit: boolean) {
    if (this.mediaRequestId) {
      this.mediaRequestManager.cancelRequest(this.mediaRequestId, commit);
      this.mediaRequestId = undefined;
    }
  }

  /**
   * Invalidates the remote media group by clearing the references to the receive slots
   * used by all remote media from that group and cancelling all media requests.
   * After this call the remote media group is unusable.
   *
   * @param{boolean} commit whether to commit the cancellation of media requests
   * @internal
   */
  public stop(commit: boolean = true) {
    this.unpinnedRemoteMedia.forEach((remoteMedia) => remoteMedia.stop(false));
    this.pinnedRemoteMedia.forEach((remoteMedia) => remoteMedia.stop(false));
    this.cancelActiveSpeakerMediaRequest(false);

    if (commit) {
      this.mediaRequestManager.commit();
    }
  }

  /**
   * Checks if a given RemoteMedia instance belongs to this group.
   *
   * @param remoteMedia RemoteMedia instance to check
   * @param filter controls which remote media from the group to check
   * @returns true if remote media is found
   */
  public includes(
    remoteMedia: RemoteMedia,
    filter: 'all' | 'pinned' | 'unpinned' = 'all'
  ): boolean {
    if (filter === 'pinned') {
      return this.pinnedRemoteMedia.includes(remoteMedia);
    }
    if (filter === 'unpinned') {
      return this.unpinnedRemoteMedia.includes(remoteMedia);
    }

    return (
      this.unpinnedRemoteMedia.includes(remoteMedia) || this.pinnedRemoteMedia.includes(remoteMedia)
    );
  }
}
