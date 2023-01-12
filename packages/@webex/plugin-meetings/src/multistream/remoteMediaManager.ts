import {cloneDeep, remove} from 'lodash';
import {EventMap} from 'typed-emitter';
import {MediaConnection as MC} from '@webex/internal-media-core';

import LoggerProxy from '../common/logs/logger-proxy';
import EventsScope from '../common/events/events-scope';

import {RemoteMedia, RemoteVideoResolution} from './remoteMedia';
import {ReceiveSlot, CSI} from './receiveSlot';
import {ReceiveSlotManager} from './receiveSlotManager';
import {RemoteMediaGroup} from './remoteMediaGroup';
import {MediaRequestManager} from './mediaRequestManager';

export type PaneSize = RemoteVideoResolution;
export type LayoutId = string;
export type PaneId = string;
export type PaneGroupId = string;

export interface ActiveSpeakerVideoPaneGroup {
  id: PaneGroupId;
  numPanes: number; // maximum number of panes in the group (actual number may be lower, if there are not enough participants in the meeting)
  size: PaneSize; // preferred size for all panes in the group
  priority: number; // 0-255 (255 = highest priority), each group must have a different priority from all other groups
}

export interface MemberVideoPane {
  id: PaneId;
  size: PaneSize;
  csi?: CSI;
}

export interface VideoLayout {
  screenShareVideo?: {
    size: PaneSize;
  };
  activeSpeakerVideoPaneGroups?: ActiveSpeakerVideoPaneGroup[]; // list of active speaker video pane groups
  memberVideoPanes?: MemberVideoPane[]; // list of video panes for specific members, CSI values can be changed later via setVideoPaneCsi()
}

export interface Configuration {
  audio: {
    numOfActiveSpeakerStreams: number; // number of audio streams we want to receive
  };
  video: {
    preferLiveVideo: boolean; // applies to all pane groups with active speaker policy
    initialLayoutId: LayoutId;

    layouts: {[key: LayoutId]: VideoLayout}; // a map of all available layouts, a layout can be set via setLayout() method
  };
  screenShare: {
    audio: boolean; // whether we ever want to receive screen share audio at all
    video: boolean; // whether we ever want to receive screen share video at all
  };
}

/* Predefined layouts: */

// An "all equal" grid, with size up to 3 x 3 = 9:
const AllEqualLayout: VideoLayout = {
  activeSpeakerVideoPaneGroups: [
    {
      id: 'main',
      numPanes: 9,
      size: 'best',
      priority: 255,
    },
  ],
};

// A layout with just a single remote active speaker video pane:
const SingleLayout: VideoLayout = {
  activeSpeakerVideoPaneGroups: [
    {
      id: 'main',
      numPanes: 1,
      size: 'best',
      priority: 255,
    },
  ],
};

// A layout with 1 big pane for the highest priority active speaker and 5 small panes for other active speakers:
const OnePlusFiveLayout: VideoLayout = {
  activeSpeakerVideoPaneGroups: [
    {
      id: 'mainBigOne',
      numPanes: 1,
      size: 'large',
      priority: 255,
    },
    {
      id: 'secondarySetOfSmallPanes',
      numPanes: 5,
      size: 'very small',
      priority: 254,
    },
  ],
};

// A layout with 2 big panes for 2 main active speakers and a strip of 6 small panes for other active speakers:
const TwoMainPlusSixSmallLayout: VideoLayout = {
  activeSpeakerVideoPaneGroups: [
    {
      id: 'mainGroupWith2BigPanes',
      numPanes: 2,
      size: 'large',
      priority: 255,
    },
    {
      id: 'secondaryGroupOfSmallPanes',
      numPanes: 6,
      size: 'small',
      priority: 254,
    },
  ],
};

// A strip of 8 small video panes (thumbnails) displayed at the top of a remote screenshare:
const RemoteScreenShareWithSmallThumbnailsLayout: VideoLayout = {
  // screenShareVideo: {size: 'best'}, // todo: SPARK-393485
  activeSpeakerVideoPaneGroups: [
    {
      id: 'thumbnails',
      numPanes: 8,
      size: 'thumbnail',
      priority: 255,
    },
  ],
};

// A staged layout with 4 pre-selected meeting participants in the main 2x2 grid and 6 small panes for other active speakers at the top:
const Stage2x2With6ThumbnailsLayout: VideoLayout = {
  activeSpeakerVideoPaneGroups: [
    {
      id: 'thumbnails',
      numPanes: 6,
      size: 'thumbnail',
      priority: 255,
    },
  ],
  memberVideoPanes: [
    {id: 'stage-1', size: 'medium', csi: undefined},
    {id: 'stage-2', size: 'medium', csi: undefined},
    {id: 'stage-3', size: 'medium', csi: undefined},
    {id: 'stage-4', size: 'medium', csi: undefined},
  ],
};

/**
 * Default configuration:
 * - uses 3 audio streams
 * - prefers active speakers with live video (e.g. are not audio only or video muted) over active speakers without live video
 * - has a few layouts defined, including 1 that contains remote screen share (ScreenShareView)
 */
export const DefaultConfiguration: Configuration = {
  audio: {
    numOfActiveSpeakerStreams: 3,
  },
  video: {
    preferLiveVideo: true,
    initialLayoutId: 'AllEqual',

    layouts: {
      AllEqual: AllEqualLayout,
      OnePlusFive: OnePlusFiveLayout,
      Single: SingleLayout,
      Stage: Stage2x2With6ThumbnailsLayout,
      ScreenShareView: RemoteScreenShareWithSmallThumbnailsLayout,
    },
  },
  screenShare: {
    audio: false, // todo: SPARK-393485
    video: false, // todo: SPARK-393485
  },
};

export enum Event {
  // events for audio streams
  AudioCreated = 'AudioCreated',
  ScreenShareAudioCreated = 'ScreenShareCreated',

  // events for video streams
  VideoLayoutChanged = 'VideoLayoutChanged',
}

export interface VideoLayoutChangedEventData {
  layoutId: LayoutId;
  activeSpeakerVideoPanes: {
    [key: PaneGroupId]: RemoteMediaGroup;
  };
  memberVideoPanes: {[key: PaneId]: RemoteMedia};
  screenShareVideo?: RemoteMedia;
}
export interface Events extends EventMap {
  // audio
  [Event.AudioCreated]: (audio: RemoteMediaGroup) => void;
  [Event.ScreenShareAudioCreated]: (screenShareAudio: RemoteMedia) => void;

  // video
  [Event.VideoLayoutChanged]: (data: VideoLayoutChangedEventData) => void;
}

/**
 * A helper class that manages all remote audio/video streams in order to achieve a predefined set of layouts.
 * It also creates a fixed number of audio streams and these don't change during the meeting.
 *
 * Things that RemoteMediaManager does:
 * - owns the receive slots (creates them when needed, and re-uses them when switching layouts)
 * - constructs appropriate RemoteMedia and RemoteMediaGroup objects and sends appropriate mediaRequests
 */
export class RemoteMediaManager extends EventsScope {
  private config: Configuration;

  private started: boolean;

  private receiveSlotManager: ReceiveSlotManager;

  private mediaRequestManagers: {
    audio: MediaRequestManager;
    video: MediaRequestManager;
    screenShareAudio: MediaRequestManager;
    screenShareVideo: MediaRequestManager;
  };

  private currentLayout?: VideoLayout;

  private slots: {
    audio: ReceiveSlot[];
    screenShare: {
      audio?: ReceiveSlot;
      video?: ReceiveSlot;
    };
    video: {
      unused: ReceiveSlot[];
      activeSpeaker: ReceiveSlot[];
      receiverSelected: ReceiveSlot[];
    };
  };

  private media: {
    audio?: RemoteMediaGroup;
    video: {
      activeSpeakerGroups: {
        [key: PaneGroupId]: RemoteMediaGroup;
      };
      memberPanes: {[key: PaneId]: RemoteMedia};
    };
    screenShare: {
      audio?: RemoteMediaGroup;
      video?: RemoteMediaGroup;
    };
  };

  private receiveSlotAllocations: {
    activeSpeaker: {[key: PaneGroupId]: {slots: ReceiveSlot[]}};
    receiverSelected: {[key: PaneId]: ReceiveSlot};
  };

  private currentLayoutId?: LayoutId;

  /**
   * Constructor
   *
   * @param {ReceiveSlotManager} receiveSlotManager
   * @param {{audio: MediaRequestManager, video: mediaRequestManagers}} mediaRequestManagers
   * @param {Configuration} config Configuration describing what video layouts to use during the meeting
   */
  constructor(
    receiveSlotManager: ReceiveSlotManager,
    mediaRequestManagers: {
      audio: MediaRequestManager;
      video: MediaRequestManager;
      screenShareAudio: MediaRequestManager;
      screenShareVideo: MediaRequestManager;
    },
    config: Configuration = DefaultConfiguration
  ) {
    super();
    this.started = false;
    this.config = config;
    this.receiveSlotManager = receiveSlotManager;
    this.mediaRequestManagers = mediaRequestManagers;
    this.media = {
      audio: undefined,
      video: {
        activeSpeakerGroups: {},
        memberPanes: {},
      },
      screenShare: {
        audio: undefined,
        video: undefined,
      },
    };

    this.checkConfigValidity();

    this.slots = {
      audio: [],
      screenShare: {
        audio: undefined,
        video: undefined,
      },
      video: {
        unused: [],
        activeSpeaker: [],
        receiverSelected: [],
      },
    };

    this.receiveSlotAllocations = {activeSpeaker: {}, receiverSelected: {}};

    LoggerProxy.logger.log(
      `RemoteMediaManager#constructor --> RemoteMediaManager created with config: ${JSON.stringify(
        this.config
      )}`
    );
  }

  /**
   * Checks if configuration is valid, throws an error if it's not
   */
  private checkConfigValidity() {
    if (!(this.config.video.initialLayoutId in this.config.video.layouts)) {
      throw new Error(
        `invalid config: initialLayoutId "${this.config.video.initialLayoutId}" doesn't match any of the layouts`
      );
    }

    // check if each layout is valid
    Object.values(this.config.video.layouts).forEach((layout) => {
      const groupIds = {};
      const paneIds = {};
      const groupPriorites = {};

      layout.activeSpeakerVideoPaneGroups?.forEach((group) => {
        if (groupIds[group.id]) {
          throw new Error(
            `invalid config: duplicate active speaker video pane group id: ${group.id}`
          );
        }
        groupIds[group.id] = true;

        if (groupPriorites[group.priority]) {
          throw new Error(
            `invalid config: multiple active speaker video pane groups have same priority: ${group.priority}`
          );
        }
        groupPriorites[group.priority] = true;
      });

      layout.memberVideoPanes?.forEach((pane) => {
        if (paneIds[pane.id]) {
          throw new Error(`invalid config: duplicate member video pane id: ${pane.id}`);
        }
        paneIds[pane.id] = true;
      });

      if (layout.screenShareVideo && !this.config.screenShare.video) {
        throw new Error(
          'one of the layouts has screen share, so config.screenShare.video has to be enabled'
        );
      }
    });
  }

  /**
   * Starts the RemoteMediaManager.
   *
   * @returns {Promise}
   */
  public async start() {
    if (this.started) {
      throw new Error('start() failure: already started');
    }
    this.started = true;

    await this.createAudioMedia();

    await this.createScreenShareReceiveSlots();
    this.createScreenShareAudioMedia();

    await this.preallocateVideoReceiveSlots();

    await this.setLayout(this.config.video.initialLayoutId);
  }

  /**
   * Releases all the used resources (like allocated receive slots). This function needs
   * to be called when we leave the meeting, etc.
   */
  public stop() {
    // invalidate all remoteMedia objects
    this.invalidateCurrentRemoteMedia({
      audio: true,
      video: true,
      screenShareAudio: true,
      screenShareVideo: true,
      commit: true,
    });

    // release all audio receive slots
    this.slots.audio.forEach((slot) => this.receiveSlotManager.releaseSlot(slot));
    this.slots.audio.length = 0;

    // release screen share slots
    if (this.slots.screenShare.audio) {
      this.receiveSlotManager.releaseSlot(this.slots.screenShare.audio);
      this.slots.screenShare.audio = undefined;
    }
    if (this.slots.screenShare.video) {
      this.receiveSlotManager.releaseSlot(this.slots.screenShare.video);
      this.slots.screenShare.video = undefined;
    }

    // release video slots
    this.receiveSlotAllocations = {activeSpeaker: {}, receiverSelected: {}};

    this.slots.video.unused.push(...this.slots.video.activeSpeaker);
    this.slots.video.activeSpeaker.length = 0;

    this.slots.video.unused.push(...this.slots.video.receiverSelected);
    this.slots.video.receiverSelected.length = 0;

    this.releaseUnusedVideoSlots();

    this.currentLayout = undefined;
    this.currentLayoutId = undefined;
    this.started = false;
  }

  /**
   * Returns the total number of main video panes required for a given layout
   *
   * @param {VideoLayout} layout
   * @returns {number}
   */
  private getRequiredNumVideoSlotsForLayout(layout?: VideoLayout) {
    if (!layout) {
      return 0;
    }

    const activeSpeakerCount =
      layout.activeSpeakerVideoPaneGroups?.reduce(
        (sum, paneGroup) => sum + paneGroup.numPanes,
        0
      ) || 0;

    const receiverSelectedCount = layout.memberVideoPanes?.length || 0;

    return activeSpeakerCount + receiverSelectedCount;
  }

  /**
   * Allocates the maximum number of panes that any of the configured layouts will require.
   * We do this at the beginning, because it's more efficient (much faster) then allocating receive slots
   * later, after the SDP exchange was done.
   */
  private async preallocateVideoReceiveSlots() {
    const maxNumVideoPanesRequired = Object.values(this.config.video.layouts).reduce(
      (maxValue, layout) => Math.max(maxValue, this.getRequiredNumVideoSlotsForLayout(layout)),
      0
    );

    while (this.slots.video.unused.length < maxNumVideoPanesRequired) {
      // eslint-disable-next-line no-await-in-loop
      this.slots.video.unused.push(
        await this.receiveSlotManager.allocateSlot(MC.MediaType.VideoMain)
      );
    }
  }

  /**
   * Changes the layout (triggers Event.VideoLayoutChanged)
   *
   * @param {LayoutId} layoutId new layout id
   * @returns {Promise}
   */
  public async setLayout(layoutId: LayoutId) {
    if (!(layoutId in this.config.video.layouts)) {
      throw new Error(
        `invalid layoutId: "${layoutId}" doesn't match any of the configured layouts`
      );
    }
    if (!this.started) {
      throw new Error('setLayout() called before start()');
    }
    this.currentLayoutId = layoutId;
    this.currentLayout = cloneDeep(this.config.video.layouts[this.currentLayoutId]);

    await this.updateVideoReceiveSlots();
    this.updateVideoRemoteMediaObjects();
    this.updateScreenShareVideoRemoteMediaObject();
    this.emitVideoLayoutChangedEvent();
  }

  /**
   * Returns the currently selected layout id
   *
   * @returns {LayoutId}
   */
  public getLayoutId(): LayoutId | undefined {
    return this.currentLayoutId;
  }

  /**
   * Creates the audio slots
   */
  private async createAudioMedia() {
    // create the audio receive slots
    for (let i = 0; i < this.config.audio.numOfActiveSpeakerStreams; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const slot = await this.receiveSlotManager.allocateSlot(MC.MediaType.AudioMain);

      this.slots.audio.push(slot);
    }

    // create a remote media group
    this.media.audio = new RemoteMediaGroup(
      this.mediaRequestManagers.audio,
      this.slots.audio,
      255,
      true
    );

    this.emit(
      {file: 'multistream/remoteMediaManager', function: 'createAudioMedia'},
      Event.AudioCreated,
      this.media.audio
    );
  }

  private async createScreenShareReceiveSlots() {
    if (this.config.screenShare.audio) {
      this.slots.screenShare.audio = await this.receiveSlotManager.allocateSlot(
        MC.MediaType.AudioSlides
      );
    }

    if (this.config.screenShare.video) {
      this.slots.screenShare.video = await this.receiveSlotManager.allocateSlot(
        MC.MediaType.VideoSlides
      );
    }
  }

  private createScreenShareAudioMedia() {
    if (this.slots.screenShare.audio) {
      // we create a group of 1, because for screen share we need to use the "active speaker" policy
      this.media.screenShare.audio = new RemoteMediaGroup(
        this.mediaRequestManagers.screenShareAudio,
        [this.slots.screenShare.audio],
        255,
        true
      );

      this.emit(
        {file: 'multistream/remoteMediaManager', function: 'createScreenShareAudioMedia'},
        Event.ScreenShareAudioCreated,
        this.media.screenShare.audio.getRemoteMedia()[0]
      );
    }
  }
  /**
   * Goes over all receiver-selected slots and keeps only the ones that are required by a given layout,
   * the rest are all moved to the "unused" list
   */
  private trimReceiverSelectedSlots() {
    const requiredCsis = {};

    // fill requiredCsis with all the CSIs that the given layout requires
    this.currentLayout?.memberVideoPanes?.forEach((memberVideoPane) => {
      if (memberVideoPane.csi !== undefined) {
        requiredCsis[memberVideoPane.csi] = true;
      }
    });

    const isCsiNeededByCurrentLayout = (csi?: CSI): boolean => {
      if (csi === undefined) {
        return false;
      }

      return !!requiredCsis[csi];
    };

    // keep receiverSelected slots that match our new requiredCsis, move the rest of receiverSelected slots to unused
    const notNeededReceiverSelectedSlots = remove(
      this.slots.video.receiverSelected,
      (slot) => isCsiNeededByCurrentLayout(slot.csi) === false
    );

    this.slots.video.unused.push(...notNeededReceiverSelectedSlots);
  }

  /**
   * Releases all the "unused" video slots.
   */
  private releaseUnusedVideoSlots() {
    this.slots.video.unused.forEach((slot) => this.receiveSlotManager.releaseSlot(slot));
    this.slots.video.unused.length = 0;
  }

  /**
   * Allocates receive slots to all video panes in the current selected layout
   */
  private allocateSlotsToVideoPaneGroups() {
    this.receiveSlotAllocations = {activeSpeaker: {}, receiverSelected: {}};

    this.currentLayout?.activeSpeakerVideoPaneGroups?.forEach((group) => {
      this.receiveSlotAllocations.activeSpeaker[group.id] = {slots: []};

      for (let paneIndex = 0; paneIndex < group.numPanes; paneIndex += 1) {
        // allocate a slot from the "unused" list
        const freeSlot = this.slots.video.unused.pop();

        if (freeSlot) {
          this.slots.video.activeSpeaker.push(freeSlot);
          this.receiveSlotAllocations.activeSpeaker[group.id].slots.push(freeSlot);
        }
      }
    });

    this.currentLayout?.memberVideoPanes?.forEach((memberPane) => {
      // check if there is existing slot for this csi
      const existingSlot = this.slots.video.receiverSelected.find(
        (slot) => slot.csi === memberPane.csi
      );

      const isExistingSlotAlreadyAllocated = Object.values(
        this.receiveSlotAllocations.receiverSelected
      ).includes(existingSlot);

      if (memberPane.csi !== undefined && existingSlot && !isExistingSlotAlreadyAllocated) {
        // found it, so use it
        this.receiveSlotAllocations.receiverSelected[memberPane.id] = existingSlot;
      } else {
        // allocate a slot from the "unused" list
        const freeSlot = this.slots.video.unused.pop();

        if (freeSlot) {
          this.slots.video.receiverSelected.push(freeSlot);
          this.receiveSlotAllocations.receiverSelected[memberPane.id] = freeSlot;
        }
      }
    });
  }

  /**
   * Makes sure we have the right number of receive slots created for the current layout
   * and allocates them to the right video panes / pane groups
   *
   * @returns {Promise}
   */
  private async updateVideoReceiveSlots() {
    const requiredNumSlots = this.getRequiredNumVideoSlotsForLayout(this.currentLayout);
    const totalNumSlots =
      this.slots.video.unused.length +
      this.slots.video.activeSpeaker.length +
      this.slots.video.receiverSelected.length;

    // ensure we have enough total slots for current layout
    if (totalNumSlots < requiredNumSlots) {
      let numSlotsToCreate = requiredNumSlots - totalNumSlots;

      while (numSlotsToCreate > 0) {
        // eslint-disable-next-line no-await-in-loop
        this.slots.video.unused.push(
          await this.receiveSlotManager.allocateSlot(MC.MediaType.VideoMain)
        );
        numSlotsToCreate -= 1;
      }
    }

    // move all no longer needed receiver-selected slots to "unused"
    this.trimReceiverSelectedSlots();

    // move all active speaker slots to "unused"
    this.slots.video.unused.push(...this.slots.video.activeSpeaker);
    this.slots.video.activeSpeaker.length = 0;

    // allocate the slots to the right panes / pane groups
    this.allocateSlotsToVideoPaneGroups();

    LoggerProxy.logger.log(
      `RemoteMediaManager#updateVideoReceiveSlots --> receive slots updated: unused=${this.slots.video.unused.length}, activeSpeaker=${this.slots.video.activeSpeaker.length}, receiverSelected=${this.slots.video.receiverSelected.length}`
    );

    // If this is the initial layout, there may be some "unused" slots left because of the preallocation
    // done in this.preallocateVideoReceiveSlots(), so release them now
    this.releaseUnusedVideoSlots();
  }

  /**
   * Creates new RemoteMedia and RemoteMediaGroup objects for the current layout
   * and sends the media requests for all of them.
   */
  private updateVideoRemoteMediaObjects() {
    // invalidate all the previous remote media objects and cancel their media requests
    this.invalidateCurrentRemoteMedia({
      audio: false,
      video: true,
      screenShareAudio: false,
      screenShareVideo: false,
      commit: false,
    });

    // create new remoteMediaGroup objects
    this.media.video.activeSpeakerGroups = {};
    this.media.video.memberPanes = {};

    for (const [groupId, group] of Object.entries(this.receiveSlotAllocations.activeSpeaker)) {
      const paneGroupInCurrentLayout = this.currentLayout?.activeSpeakerVideoPaneGroups?.find(
        (groupInLayout) => groupInLayout.id === groupId
      );

      if (paneGroupInCurrentLayout) {
        const mediaGroup = new RemoteMediaGroup(
          this.mediaRequestManagers.video,
          group.slots,
          paneGroupInCurrentLayout.priority,
          false,
          {
            preferLiveVideo: this.config.video.preferLiveVideo,
            resolution: paneGroupInCurrentLayout.size,
          }
        );

        this.media.video.activeSpeakerGroups[groupId] = mediaGroup;
      } else {
        // this should never happen, because this.receiveSlotAllocations are created based on current layout configuration
        LoggerProxy.logger.warn(
          `a group id ${groupId} from this.receiveSlotAllocations.activeSpeaker cannot be found in the current layout configuration`
        );
      }
    }

    // create new remoteMedia objects
    for (const [paneId, slot] of Object.entries(this.receiveSlotAllocations.receiverSelected)) {
      const paneInCurrentLayout = this.currentLayout?.memberVideoPanes?.find(
        (paneInLayout) => paneInLayout.id === paneId
      );

      if (paneInCurrentLayout) {
        const remoteMedia = new RemoteMedia(slot, this.mediaRequestManagers.video, {
          resolution: paneInCurrentLayout.size,
        });

        if (paneInCurrentLayout.csi) {
          remoteMedia.sendMediaRequest(paneInCurrentLayout.csi, false);
        }

        this.media.video.memberPanes[paneId] = remoteMedia;
      } else {
        // this should never happen, because this.receiveSlotAllocations are created based on current layout configuration
        LoggerProxy.logger.warn(
          `a pane id ${paneId} from this.receiveSlotAllocations.receiverSelected cannot be found in the current layout configuration`
        );
      }
    }

    this.mediaRequestManagers.video.commit();
  }

  private updateScreenShareVideoRemoteMediaObject() {
    this.invalidateCurrentRemoteMedia({
      audio: false,
      video: false,
      screenShareAudio: false,
      screenShareVideo: true,
      commit: false,
    });

    this.media.screenShare.video = undefined;

    if (this.currentLayout?.screenShareVideo) {
      // we create a group of 1, because for screen share we need to use the "active speaker" policy
      this.media.screenShare.video = new RemoteMediaGroup(
        this.mediaRequestManagers.screenShareVideo,
        [this.slots.screenShare.video],
        255,
        false,
        {resolution: this.currentLayout.screenShareVideo.size}
      );
    }

    this.mediaRequestManagers.screenShareVideo.commit();
  }

  /**
   * Invalidates all remote media objects belonging to currently selected layout
   */
  private invalidateCurrentRemoteMedia(options: {
    audio: boolean;
    video: boolean;
    screenShareAudio: boolean;
    screenShareVideo: boolean;
    commit: boolean;
  }) {
    const {audio, video, screenShareAudio, screenShareVideo, commit} = options;

    if (audio && this.media.audio) {
      this.media.audio.stop(commit);
    }
    if (video) {
      Object.values(this.media.video.activeSpeakerGroups).forEach((remoteMediaGroup) => {
        remoteMediaGroup.stop(false);
      });
      Object.values(this.media.video.memberPanes).forEach((remoteMedia) => {
        remoteMedia.stop(false);
      });
      if (commit) {
        this.mediaRequestManagers.video.commit();
      }
    }

    if (screenShareAudio && this.media.screenShare.audio) {
      this.media.screenShare.audio.stop(commit);
    }
    if (screenShareVideo && this.media.screenShare.video) {
      this.media.screenShare.video.stop(commit);
    }
  }

  /** emits Event.VideoLayoutChanged */
  private emitVideoLayoutChangedEvent() {
    // todo: at this point the receive slots might still be showing a participant from previous layout, we should
    // wait for our media requests to be fulfilled, but there is no API for that right now (we could wait for source updates
    // but in some cases they might never come, or would need to always make sure to use a new set of receiver slots)
    // for now it's fine to have it like this, we will re-evaluate if it needs improving after more testing

    this.emit(
      {
        file: 'multistream/remoteMediaManager',
        function: 'emitVideoLayoutChangedEvent',
      },
      Event.VideoLayoutChanged,
      {
        layoutId: this.currentLayoutId,
        activeSpeakerVideoPanes: this.media.video.activeSpeakerGroups,
        memberVideoPanes: this.media.video.memberPanes,
        screenShareVideo: this.media.screenShare.video?.getRemoteMedia()[0],
      }
    );
  }

  /**
   * Sets a new CSI on a given remote media object
   *
   * @param {RemoteMedia} remoteMedia remote Media object to modify
   * @param {CSI} csi new CSI value, can be null if we want to stop receiving media
   */
  public setRemoteVideoCsi(remoteMedia: RemoteMedia, csi: CSI | null) {
    if (!Object.values(this.media.video.memberPanes).includes(remoteMedia)) {
      throw new Error('remoteMedia not found');
    }

    if (csi) {
      remoteMedia.sendMediaRequest(csi, true);
    } else {
      remoteMedia.cancelMediaRequest(true);
    }
  }

  /**
   * Adds a new member video pane to the currently selected layout.
   *
   * Changes to the layout are lost after a layout change.
   *
   * @param {MemberVideoPane} newPane
   * @returns {Promise<RemoteMedia>}
   */
  public async addMemberVideoPane(newPane: MemberVideoPane): Promise<RemoteMedia> {
    if (!this.currentLayout) {
      throw new Error('There is no current layout selected, call start() first');
    }

    if (!this.currentLayout?.memberVideoPanes) {
      this.currentLayout.memberVideoPanes = [];
    }

    if (newPane.id in this.currentLayout.memberVideoPanes) {
      throw new Error(
        `duplicate pane id ${newPane.id} - this pane already exists in current layout's memberVideoPanes`
      );
    }

    this.currentLayout.memberVideoPanes.push(newPane);

    const receiveSlot = await this.receiveSlotManager.allocateSlot(MC.MediaType.VideoMain);

    this.slots.video.receiverSelected.push(receiveSlot);

    const remoteMedia = new RemoteMedia(receiveSlot, this.mediaRequestManagers.video, {
      resolution: newPane.size,
    });

    if (newPane.csi) {
      remoteMedia.sendMediaRequest(newPane.csi, true);
    }

    this.media.video.memberPanes[newPane.id] = remoteMedia;

    return remoteMedia;
  }

  /**
   * Removes a member video pane from the currently selected layout.
   *
   * Changes to the layout are lost after a layout change.
   *
   * @param {PaneId} paneId pane id of the pane to remove
   * @returns {Promise<void>}
   */
  public removeMemberVideoPane(paneId: PaneId): Promise<void> {
    if (!this.currentLayout) {
      return Promise.reject(new Error('There is no current layout selected, call start() first'));
    }

    if (!this.currentLayout.memberVideoPanes?.find((pane) => pane.id === paneId)) {
      // pane id doesn't exist, so nothing to do
      LoggerProxy.logger.log(
        `RemoteMediaManager#removeMemberVideoPane --> removeMemberVideoPane() called for a non-existent paneId: ${paneId} (pane not found in currentLayout.memberVideoPanes)`
      );

      return Promise.resolve();
    }

    if (!this.media.video.memberPanes[paneId]) {
      // pane id doesn't exist, so nothing to do
      LoggerProxy.logger.log(
        `RemoteMediaManager#removeMemberVideoPane --> removeMemberVideoPane() called for a non-existent paneId: ${paneId} (pane not found in this.media.video.memberPanes)`
      );

      return Promise.resolve();
    }

    const remoteMedia = this.media.video.memberPanes[paneId];

    const receiveSlot = remoteMedia.getUnderlyingReceiveSlot();

    if (receiveSlot) {
      this.receiveSlotManager.releaseSlot(receiveSlot);

      const index = this.slots.video.receiverSelected.indexOf(receiveSlot);

      if (index >= 0) {
        this.slots.video.receiverSelected.splice(index, 1);
      }
    }
    remoteMedia.stop();

    delete this.media.video.memberPanes[paneId];
    delete this.currentLayout.memberVideoPanes?.[paneId];

    return Promise.resolve();
  }

  /**
   * Pins an active speaker remote media object to the given CSI value. From that moment
   * onwards the remote media will only play audio/video from that specific CSI until
   * unpinActiveSpeakerVideoPane() is called or current layout is changed.
   *
   * @param {RemoteMedia} remoteMedia remote media object reference
   * @param {CSI} csi CSI value to pin to, if undefined, then current CSI value is used
   */
  public pinActiveSpeakerVideoPane(remoteMedia: RemoteMedia, csi?: CSI): void {
    const remoteMediaGroup = Object.values(this.media.video.activeSpeakerGroups).find((group) =>
      group.includes(remoteMedia, 'unpinned')
    );

    if (!remoteMediaGroup) {
      throw new Error(
        'remoteMedia not found among the unpinned remote media from any active speaker group'
      );
    }

    remoteMediaGroup.pin(remoteMedia, csi);
  }

  /**
   * Unpins a remote media object from the fixed CSI value it was pinned to.
   *
   * @param {RemoteMedia} remoteMedia remote media object reference
   */
  public unpinActiveSpeakerVideoPane(remoteMedia: RemoteMedia) {
    const remoteMediaGroup = Object.values(this.media.video.activeSpeakerGroups).find((group) =>
      group.includes(remoteMedia, 'pinned')
    );

    if (!remoteMediaGroup) {
      throw new Error(
        'remoteMedia not found among the pinned remote media from any active speaker group'
      );
    }

    remoteMediaGroup.unpin(remoteMedia);
  }

  /**
   * Returns true if a given remote media object belongs to an active speaker group and has been pinned.
   * Throws an error if the remote media object doesn't belong to any active speaker remote media group.
   *
   * @param {RemoteMedia} remoteMedia remote media object
   * @returns {boolean}
   */
  public isPinned(remoteMedia: RemoteMedia) {
    const remoteMediaGroup = Object.values(this.media.video.activeSpeakerGroups).find((group) =>
      group.includes(remoteMedia)
    );

    if (!remoteMediaGroup) {
      throw new Error(
        'remoteMedia not found among any remote media (pinned or unpinned) from any active speaker group'
      );
    }

    return remoteMediaGroup.isPinned(remoteMedia);
  }
}
