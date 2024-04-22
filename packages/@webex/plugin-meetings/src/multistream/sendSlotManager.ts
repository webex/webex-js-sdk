import {
  SendSlot,
  MediaType,
  LocalStream,
  MultistreamRoapMediaConnection,
  NamedMediaGroup,
} from '@webex/internal-media-core';

export default class SendSlotManager {
  private readonly slots: Map<MediaType, SendSlot> = new Map();
  private readonly LoggerProxy: any;

  constructor(LoggerProxy: any) {
    this.LoggerProxy = LoggerProxy;
  }

  /**
   * This method is used to create a sendSlot for the given mediaType and returns the created sendSlot
   * @param {MultistreamRoapMediaConnection} mediaConnection MultistreamRoapMediaConnection for which a sendSlot needs to be created
   * @param {MediaType} mediaType MediaType for which a sendSlot needs to be created (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @param {boolean} active This is optional boolean to set the active state of the sendSlot. Default is true
   * @returns {SendSlot} slot The created sendSlot
   */
  public createSlot(
    mediaConnection: MultistreamRoapMediaConnection,
    mediaType: MediaType,
    active = true
  ): SendSlot {
    if (this.slots.has(mediaType)) {
      throw new Error(`Slot for ${mediaType} already exists`);
    }

    const slot: SendSlot = mediaConnection.createSendSlot(mediaType, active);

    this.slots.set(mediaType, slot);

    this.LoggerProxy.logger.info(
      `SendSlotsManager->createSlot#Created slot for ${mediaType} with active ${active}`
    );

    return slot;
  }

  /**
   * This method is used to retrieve the sendSlot for the given mediaType
   * @param {MediaType} mediaType of which the slot needs to be retrieved
   * @returns {SendSlot}
   */
  public getSlot(mediaType: MediaType): SendSlot {
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    return slot;
  }

  /**
   * Allow users to specify 'namedMediaGroups' to indicate which named media group its audio should be sent to.
   * @param {MediaType} mediaType MediaType of the sendSlot to which the audio stream needs to be send to the media group
   * @param {[]}namedMediaGroups - Allow users to specify 'namedMediaGroups'.If the value of 'namedMediaGroups' is zero,
   * named media group will be canceled and the audio stream will be sent to the floor.
   * @returns {void}
   */
  public setNamedMediaGroups(mediaType: MediaType, namedMediaGroups: NamedMediaGroup[]) {
    if (mediaType !== MediaType.AudioMain) {
      throw new Error(
        `sendSlotManager cannot set named media group which media type is ${mediaType}`
      );
    }

    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    slot.setNamedMediaGroups(namedMediaGroups);

    this.LoggerProxy.logger.info(
      `SendSlotsManager->setNamedMediaGroups#set named media group ${namedMediaGroups}`
    );
  }

  /**
   * This method publishes the given stream to the sendSlot for the given mediaType
   * @param {MediaType} mediaType MediaType of the sendSlot to which a stream needs to be published (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @param {LocalStream} stream LocalStream to be published
   * @returns {Promise<void>}
   */
  public async publishStream(mediaType: MediaType, stream: LocalStream): Promise<void> {
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    await slot.publishStream(stream);

    this.LoggerProxy.logger.info(
      `SendSlotsManager->publishStream#Published stream for ${mediaType} and stream with label ${stream.label} and muted ${stream.muted}`
    );
  }

  /**
   * This method unpublishes the stream from the sendSlot of the given mediaType
   * @param {MediaType} mediaType MediaType of the sendSlot from which a stream needs to be unpublished (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @returns {Promise<void>}
   */
  public async unpublishStream(mediaType: MediaType): Promise<void> {
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    await slot.unpublishStream();

    this.LoggerProxy.logger.info(
      `SendSlotsManager->unpublishStream#Unpublished stream for ${mediaType}`
    );
  }

  /**
   * This method is used to set the active state of the sendSlot for the given mediaType
   * @param {MediaType} mediaType The MediaType of the sendSlot for which the active state needs to be set (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @param {boolean} active The boolean to set the active state of the sendSlot. Default is true
   * @returns {void}
   */
  public setActive(mediaType: MediaType, active = true): void {
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    slot.active = active;

    this.LoggerProxy.logger.info(
      `SendSlotsManager->setActive#Set active for ${mediaType} to ${active}`
    );
  }

  /**
   * This method is used to set the codec parameters for the sendSlot of the given mediaType
   * @param {MediaType} mediaType MediaType of the sendSlot for which the codec parameters needs to be set (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @param {Object} codecParameters
   * @returns {Promise<void>}
   */
  public async setCodecParameters(
    mediaType: MediaType,
    codecParameters: {
      [key: string]: string | undefined; // As per ts-sdp undefined is considered as a valid value to be used for codec parameters
    }
  ): Promise<void> {
    // These codec parameter changes underneath are SDP value changes that are taken care by WCME automatically. So no need for any change in streams from the web sdk side
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    await slot.setCodecParameters(codecParameters);

    this.LoggerProxy.logger.info(
      `SendSlotsManager->setCodecParameters#Set codec parameters for ${mediaType} to ${codecParameters}`
    );
  }

  /**
   * This method is used to delete the codec parameters for the sendSlot of the given mediaType
   * @param {MediaType} mediaType MediaType of the sendSlot for which the codec parameters needs to be deleted (AUDIO_MAIN/VIDEO_MAIN/AUDIO_SLIDES/VIDEO_SLIDES)
   * @param {Array<String>} parameters Array of keys of the codec parameters to be deleted
   * @returns {Promise<void>}
   */
  public async deleteCodecParameters(mediaType: MediaType, parameters: string[]): Promise<void> {
    const slot = this.slots.get(mediaType);

    if (!slot) {
      throw new Error(`Slot for ${mediaType} does not exist`);
    }

    await slot.deleteCodecParameters(parameters);

    this.LoggerProxy.logger.info(
      `SendSlotsManager->deleteCodecParameters#Deleted the following codec parameters -> ${parameters} for ${mediaType}`
    );
  }

  /**
   * This method is used to reset the SendSlotsManager by deleting all the sendSlots
   * @returns {undefined}
   */
  public reset(): void {
    this.slots.clear();
  }
}
