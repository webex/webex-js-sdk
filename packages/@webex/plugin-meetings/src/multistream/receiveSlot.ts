/* eslint-disable valid-jsdoc */
import {
  MediaType,
  ReceiveSlot as WcmeReceiveSlot,
  ReceiveSlotEvents as WcmeReceiveSlotEvents,
  SourceState,
} from '@webex/internal-media-core';

import LoggerProxy from '../common/logs/logger-proxy';
import EventsScope from '../common/events/events-scope';

export const ReceiveSlotEvents = {
  SourceUpdate: 'sourceUpdate',
  MaxFsUpdate: 'maxFsUpdate',
};

export type {SourceState} from '@webex/internal-media-core';
export type CSI = number;
export type MemberId = string;
export type ReceiveSlotId = string;

let receiveSlotCounter = 0;

export type FindMemberIdCallback = (csi: CSI) => MemberId | undefined;

/**
 * Class representing a receive slot. A single receive slot is able to receive a single track
 * for example some participant's main video or audio
 */
export class ReceiveSlot extends EventsScope {
  private readonly mcReceiveSlot: WcmeReceiveSlot;

  private readonly findMemberIdCallback: FindMemberIdCallback;

  public readonly id: ReceiveSlotId;

  public readonly mediaType: MediaType;

  #memberId?: MemberId;

  #csi?: CSI;

  #sourceState: SourceState;

  /**
   * constructor - don't use it directly, you should always use meeting.receiveSlotManager.allocateSlot()
   * to create any receive slots
   *
   * @param {MediaType} mediaType
   * @param {ReceiveSlot} mcReceiveSlot
   * @param {FindMemberIdCallback} findMemberIdCallback callback for finding memberId for given CSI
   */
  constructor(
    mediaType: MediaType,
    mcReceiveSlot: WcmeReceiveSlot,
    findMemberIdCallback: FindMemberIdCallback
  ) {
    super();

    receiveSlotCounter += 1;

    this.findMemberIdCallback = findMemberIdCallback;
    this.mediaType = mediaType;
    this.mcReceiveSlot = mcReceiveSlot;
    this.#sourceState = 'no source';
    this.id = `r${receiveSlotCounter}`;

    this.setupEventListeners();
  }

  /**
   * Getter for memberId
   */
  public get memberId() {
    return this.#memberId;
  }

  /**
   * Getter for csi
   */
  public get csi() {
    return this.#csi;
  }

  /**
   * Set the max frame size for this slot
   * @param newFs frame size
   */
  public setMaxFs(newFs) {
    // emit event for media request manager to listen to

    this.emit(
      {
        file: 'meeting/receiveSlot',
        function: 'findMemberId',
      },
      ReceiveSlotEvents.MaxFsUpdate,
      {
        maxFs: newFs,
      }
    );
  }

  /**
   * Getter for sourceState
   */
  public get sourceState() {
    return this.#sourceState;
  }

  /**
   * registers event handlers with the underlying ReceiveSlot
   */
  private setupEventListeners() {
    const scope = {
      file: 'meeting/receiveSlot',
      function: 'setupEventListeners',
    };

    this.mcReceiveSlot.on(
      WcmeReceiveSlotEvents.SourceUpdate,
      (state: SourceState, csi?: number) => {
        LoggerProxy.logger.log(
          `ReceiveSlot#setupEventListeners --> got source update on receive slot ${this.id}, mediaType=${this.mediaType}, csi=${csi}, state=${state}`
        );
        this.#memberId = csi ? this.findMemberIdCallback(csi) : undefined;
        this.#csi = csi;
        this.#sourceState = state;

        this.emit(scope, ReceiveSlotEvents.SourceUpdate, {
          state: this.#sourceState,
          csi: this.#csi,
          memberId: this.#memberId,
        });
      }
    );
  }

  /** Tries to find the member id for this receive slot if it hasn't got one */
  public findMemberId() {
    if (this.#memberId === undefined && this.#csi) {
      this.#memberId = this.findMemberIdCallback(this.#csi);

      if (this.#memberId) {
        // if we found the memberId, simulate source update so that the client app knows that something's changed
        this.emit(
          {
            file: 'meeting/receiveSlot',
            function: 'findMemberId',
          },
          ReceiveSlotEvents.SourceUpdate,
          {
            state: this.#sourceState,
            csi: this.#csi,
            memberId: this.#memberId,
          }
        );
      }
    }
  }

  /**
   * The MediaStream object associated with this slot.
   *
   * @returns {MediaStream} The MediaStreamTrack.
   */
  get stream(): MediaStream {
    return this.mcReceiveSlot.stream;
  }

  /**
   * The underlying WCME receive slot
   */
  get wcmeReceiveSlot(): WcmeReceiveSlot {
    return this.mcReceiveSlot;
  }
}
