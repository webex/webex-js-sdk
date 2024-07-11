/* eslint-disable valid-jsdoc */
/* eslint-disable import/prefer-default-export */
import {MediaType, ReceiveSlot as WcmeReceiveSlot} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';

import {FindMemberIdCallback, ReceiveSlot} from './receiveSlot';

export type CreateSlotCallback = (mediaType: MediaType) => Promise<WcmeReceiveSlot>;

export type {CSI, FindMemberIdCallback} from './receiveSlot';

/**
 * Manages all receive slots used by a meeting. WMCE receive slots cannot be ever deleted,
 * so this manager has a pool in order to re-use the slots that were released earlier.
 */
export class ReceiveSlotManager {
  private allocatedSlots: {[key in MediaType]: ReceiveSlot[]};

  private freeSlots: {[key in MediaType]: ReceiveSlot[]};

  private createSlotCallback: CreateSlotCallback;

  private findMemberIdByCsiCallback: FindMemberIdCallback;

  /**
   * Constructor
   * @param {Meeting} meeting
   */
  constructor(
    createSlotCallback: CreateSlotCallback,
    findMemberIdByCsiCallback: FindMemberIdCallback
  ) {
    this.allocatedSlots = {
      [MediaType.AudioMain]: [],
      [MediaType.VideoMain]: [],
      [MediaType.AudioSlides]: [],
      [MediaType.VideoSlides]: [],
    };
    this.freeSlots = {
      [MediaType.AudioMain]: [],
      [MediaType.VideoMain]: [],
      [MediaType.AudioSlides]: [],
      [MediaType.VideoSlides]: [],
    };
    this.createSlotCallback = createSlotCallback;
    this.findMemberIdByCsiCallback = findMemberIdByCsiCallback;
  }

  /**
   * Creates a new receive slot or returns one from the existing pool of free slots
   *
   * @param {MediaType} mediaType
   * @returns {Promise<ReceiveSlot>}
   */
  async allocateSlot(mediaType: MediaType): Promise<ReceiveSlot> {
    // try to use one of the free ones
    const availableSlot = this.freeSlots[mediaType].pop();

    if (availableSlot) {
      this.allocatedSlots[mediaType].push(availableSlot);

      LoggerProxy.logger.log(`${mediaType}: receive slot re-used: ${availableSlot.id}`);

      return availableSlot;
    }

    // we have to create a new one
    const wcmeReceiveSlot = await this.createSlotCallback(mediaType);

    const receiveSlot = new ReceiveSlot(mediaType, wcmeReceiveSlot, this.findMemberIdByCsiCallback);

    this.allocatedSlots[mediaType].push(receiveSlot);
    LoggerProxy.logger.log(`${mediaType}: new receive slot allocated: ${receiveSlot.id}`);

    return receiveSlot;
  }

  /**
   * Releases the slot back to the pool so it can be re-used by others in the future
   * @param {ReceiveSlot} slot
   */
  releaseSlot(slot: ReceiveSlot) {
    const idx = this.allocatedSlots[slot.mediaType].findIndex(
      (allocatedSlot) => allocatedSlot === slot
    );

    if (idx >= 0) {
      this.allocatedSlots[slot.mediaType].splice(idx, 1);
      this.freeSlots[slot.mediaType].push(slot);
      LoggerProxy.logger.log(`${slot.mediaType}: receive slot released: ${slot.id}`);
    } else {
      LoggerProxy.logger.warn(
        `ReceiveSlotManager#releaseSlot --> trying to release a ${slot.mediaType}} slot that is not managed by this ReceiveSlotManager`
      );
    }
  }

  /**
   * Resets the slot manager - this method should be called when the media connection is torn down
   */
  reset() {
    this.allocatedSlots = {
      [MediaType.AudioMain]: [],
      [MediaType.VideoMain]: [],
      [MediaType.AudioSlides]: [],
      [MediaType.VideoSlides]: [],
    };
    this.freeSlots = {
      [MediaType.AudioMain]: [],
      [MediaType.VideoMain]: [],
      [MediaType.AudioSlides]: [],
      [MediaType.VideoSlides]: [],
    };
  }

  /**
   * Returns statistics about the managed slots
   *
   * @returns {Object}
   */
  getStats() {
    const numAllocatedSlots: {[key in MediaType]?: number} = {};
    const numFreeSlots: {[key in MediaType]?: number} = {};

    (Object.keys(this.allocatedSlots) as MediaType[]).forEach((key) => {
      if (this.allocatedSlots[key].length > 0) {
        numAllocatedSlots[key] = this.allocatedSlots[key].length;
      }
    });

    (Object.keys(this.freeSlots) as MediaType[]).forEach((key) => {
      if (this.freeSlots[key].length > 0) {
        numFreeSlots[key] = this.freeSlots[key].length;
      }
    });

    return {
      numAllocatedSlots,
      numFreeSlots,
    };
  }

  /**
   * Tries to find the member id on all allocated receive slots
   * This function should be called when new members are added to the meeting.
   */
  updateMemberIds() {
    (Object.keys(this.allocatedSlots) as MediaType[]).forEach((key) => {
      this.allocatedSlots[key].forEach((slot: ReceiveSlot) => {
        slot.findMemberId();
      });
    });
  }

  /**
   * Find a receive slot by a ssrc.
   *
   * @param ssrc - The ssrc of the receive slot to find.
   * @returns - The receive slot with this ssrc, undefined if not found.
   */
  findReceiveSlotBySsrc(ssrc: number): ReceiveSlot | undefined {
    return Object.values(this.allocatedSlots)
      .flat()
      .find((r) => ssrc && r.wcmeReceiveSlot?.id?.ssrc === ssrc);
  }
}
