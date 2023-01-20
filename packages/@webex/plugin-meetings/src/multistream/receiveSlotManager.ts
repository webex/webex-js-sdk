/* eslint-disable valid-jsdoc */
/* eslint-disable import/prefer-default-export */
import {MediaConnection as MC} from '@webex/internal-media-core';

import LoggerProxy from '../common/logs/logger-proxy';
import Meeting from '../meeting';

import {CSI, ReceiveSlot} from './receiveSlot';

/**
 * Manages all receive slots used by a meeting. WMCE receive slots cannot be ever deleted,
 * so this manager has a pool in order to re-use the slots that were released earlier.
 */
export class ReceiveSlotManager {
  private allocatedSlots: {[key in MC.MediaType]: ReceiveSlot[]};

  private freeSlots: {[key in MC.MediaType]: ReceiveSlot[]};

  private meeting: Meeting;

  /**
   * Constructor
   * @param {Meeting} meeting
   */
  constructor(meeting) {
    this.allocatedSlots = {
      [MC.MediaType.AudioMain]: [],
      [MC.MediaType.VideoMain]: [],
      [MC.MediaType.AudioSlides]: [],
      [MC.MediaType.VideoSlides]: [],
    };
    this.freeSlots = {
      [MC.MediaType.AudioMain]: [],
      [MC.MediaType.VideoMain]: [],
      [MC.MediaType.AudioSlides]: [],
      [MC.MediaType.VideoSlides]: [],
    };
    this.meeting = meeting;
  }

  /**
   * Creates a new receive slot or returns one from the existing pool of free slots
   *
   * @param {MC.MediaType} mediaType
   * @returns {Promise<ReceiveSlot>}
   */
  async allocateSlot(mediaType: MC.MediaType): Promise<ReceiveSlot> {
    if (!this.meeting?.mediaProperties?.webrtcMediaConnection) {
      return Promise.reject(new Error('Webrtc media connection is missing'));
    }

    // try to use one of the free ones
    const availableSlot = this.freeSlots[mediaType].pop();

    if (availableSlot) {
      this.allocatedSlots[mediaType].push(availableSlot);

      LoggerProxy.logger.log(`receive slot re-used: ${availableSlot.id}`);

      return availableSlot;
    }

    // we have to create a new one
    const wcmeReceiveSlot =
      await this.meeting.mediaProperties.webrtcMediaConnection.createReceiveSlot(mediaType);

    const receiveSlot = new ReceiveSlot(
      mediaType,
      wcmeReceiveSlot,
      (csi: CSI) => this.meeting.members.findMemberByCsi(csi)?.id
    );

    this.allocatedSlots[mediaType].push(receiveSlot);
    LoggerProxy.logger.log(`new receive slot allocated: ${receiveSlot.id}`);

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
      LoggerProxy.logger.log(`receive slot released: ${slot.id}`);
    } else {
      LoggerProxy.logger.warn(
        'ReceiveSlotManager#releaseSlot --> trying to release a slot that is not managed by this ReceiveSlotManager'
      );
    }
  }

  /**
   * Resets the slot manager - this method should be called when the media connection is torn down
   */
  reset() {
    this.allocatedSlots = {
      [MC.MediaType.AudioMain]: [],
      [MC.MediaType.VideoMain]: [],
      [MC.MediaType.AudioSlides]: [],
      [MC.MediaType.VideoSlides]: [],
    };
    this.freeSlots = {
      [MC.MediaType.AudioMain]: [],
      [MC.MediaType.VideoMain]: [],
      [MC.MediaType.AudioSlides]: [],
      [MC.MediaType.VideoSlides]: [],
    };
  }

  /**
   * Returns statistics about the managed slots
   *
   * @returns {Object}
   */
  getStats() {
    const numAllocatedSlots = {};
    const numFreeSlots = {};

    Object.keys(this.allocatedSlots).forEach((key) => {
      if (this.allocatedSlots[key].length > 0) {
        numAllocatedSlots[key] = this.allocatedSlots[key].length;
      }
    });

    Object.keys(this.freeSlots).forEach((key) => {
      if (this.freeSlots[key].length > 0) {
        numFreeSlots[key] = this.freeSlots[key].length;
      }
    });

    return {
      numAllocatedSlots,
      numFreeSlots,
    };
  }
}
