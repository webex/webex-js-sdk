// @ts-ignore - events module types
import {EventEmitter} from 'events';
import uuid from 'uuid';
// @ts-ignore - webex-core types
import {config} from '@webex/webex-core';

// @ts-ignore - internal-plugin-llm types
import type LLMChannel from '@webex/internal-plugin-llm';
import {
  EVENT_TRIGGERS,
  AIBRIDGE_RELAY_TYPES,
  TRANSCRIPTION_TYPE,
  ANNOUNCE_STATUS,
  TURN_ON_CAPTION_STATUS,
  TOGGLE_MANUAL_CAPTION_STATUS,
  DEFAULT_SPOKEN_LANGUAGE,
} from './constants';
import {
  AnnouncementPayload,
  CaptionLanguageResponse,
  TranscriptionResponse,
  IVoiceaChannel,
} from './voicea.types';
import {millisToMinutesAndSeconds} from './utils';

/**
 * @description VoiceaChannel — handles voicea/transcription functionality for a single LLM connection.
 * Created via `webex.internal.voicea.createChannel(llmChannel)`. The caller owns the
 * channel and is responsible for its lifecycle.
 * @export
 * @class VoiceaChannel
 */
export class VoiceaChannel extends (EventEmitter as any) implements IVoiceaChannel {
  private webex: any;
  private llmChannel: LLMChannel;

  private seqNum: number;
  private areCaptionsEnabled: boolean;
  private hasSubscribedToEvents = false;
  private captionServiceId?: string;
  private announceStatus: string;
  private captionStatus: string;

  private keepTranscriptionSubscribed: boolean;

  private toggleManualCaptionStatus: string;
  private currentSpokenLanguage?: string;
  private spokenLanguages: string[] = [];
  private currentCaptionLanguage?: string;

  /**
   * Creates a VoiceaChannel bound to the given LLMChannel
   * @param {LLMChannel} llmChannel - The LLM channel to use
   * @param {Object} webex - The webex instance for making requests
   */
  constructor(llmChannel: LLMChannel, webex: any) {
    super();
    this.llmChannel = llmChannel;
    this.webex = webex;

    this.seqNum = 1;
    this.areCaptionsEnabled = false;
    this.captionServiceId = undefined;
    this.announceStatus = ANNOUNCE_STATUS.IDLE;
    this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
    this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
    this.currentSpokenLanguage = DEFAULT_SPOKEN_LANGUAGE;
    this.currentCaptionLanguage = undefined;
    this.keepTranscriptionSubscribed = false;

    // Subscribe to relay events from the LLM channel
    this.llmChannel.on('event:relay.event', this.eventProcessor);
    this.hasSubscribedToEvents = true;
  }

  /**
   * Process events from LLM channel
   * @param {Object} e - Event data
   * @returns {void}
   */
  private eventProcessor = (e: any): void => {
    this.seqNum = e.sequenceNumber + 1;
    switch (e.data.relayType) {
      case AIBRIDGE_RELAY_TYPES.VOICEA.ANNOUNCEMENT:
        this.onCaptionServiceIdUpdate(e.headers.from);
        this.announceStatus = ANNOUNCE_STATUS.JOINED;
        this.processAnnouncementMessage(e.data.voiceaPayload);
        break;
      case AIBRIDGE_RELAY_TYPES.VOICEA.TRANSLATION_RESPONSE:
        this.processCaptionLanguageResponse(e.data.voiceaPayload);
        break;
      case AIBRIDGE_RELAY_TYPES.VOICEA.TRANSCRIPTION:
        this.processTranscription(e.data.voiceaPayload);
        break;
      case AIBRIDGE_RELAY_TYPES.MANUAL.TRANSCRIPTION:
      case AIBRIDGE_RELAY_TYPES.MANUAL.CAPTIONER:
        this.processManualTranscription({
          ...e.data.transcriptPayload,
          sender: e.headers?.from,
          data_source: e.data.relayType,
        });
        break;
      default:
        break;
    }
  };

  /**
   * Deregister events and clean up
   * @returns {void}
   */
  public deregisterEvents(): void {
    this.areCaptionsEnabled = false;
    this.keepTranscriptionSubscribed = false;
    this.captionServiceId = undefined;

    if (this.hasSubscribedToEvents) {
      this.llmChannel.off('event:relay.event', this.eventProcessor);
      this.hasSubscribedToEvents = false;
    }

    this.announceStatus = ANNOUNCE_STATUS.IDLE;
    this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
    this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
    this.currentSpokenLanguage = undefined;
    this.currentCaptionLanguage = undefined;
  }

  /**
   * Switch to a different LLM channel while preserving caption state.
   * Used when transitioning between main meeting and practice session.
   * - Preserves isCaptionBoxOn and spokenLanguage state
   * - Unsubscribes from old channel, subscribes to new channel
   * - Re-announces and re-enables captions if they were on
   * @param {LLMChannel} newLLMChannel - The new LLM channel to switch to
   * @returns {Promise<void>}
   */
  public async switchLLMChannel(newLLMChannel: LLMChannel): Promise<void> {
    // Save current state
    const captionsWereOn = this.isCaptionBoxOn;
    const spokenLanguage = this.currentSpokenLanguage;

    // Unsubscribe from old channel
    if (this.hasSubscribedToEvents && this.llmChannel) {
      this.llmChannel.off('event:relay.event', this.eventProcessor);
      this.hasSubscribedToEvents = false;
    }

    // Switch to new channel
    this.llmChannel = newLLMChannel;

    // Subscribe to new channel
    this.llmChannel.on('event:relay.event', this.eventProcessor);
    this.hasSubscribedToEvents = true;

    // Reset announcement state for new connection
    this.announceStatus = ANNOUNCE_STATUS.IDLE;
    this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
    this.captionServiceId = undefined;
    this.areCaptionsEnabled = false;

    // Re-announce and re-enable captions if they were on
    if (captionsWereOn) {
      await this.turnOnCaptions(spokenLanguage);
    }
  }

  /**
   * Process manual Transcript and send alert
   * @param {TranscriptionResponse} transcriptPayload
   * @returns {void}
   */
  private processManualTranscription = (transcriptPayload: TranscriptionResponse): void => {
    if (
      transcriptPayload.type === TRANSCRIPTION_TYPE.MANUAL_CAPTION_FINAL_RESULT ||
      transcriptPayload.type === TRANSCRIPTION_TYPE.MANUAL_CAPTION_INTERIM_RESULT
    ) {
      this.emit(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, {
        isFinal: transcriptPayload.type === TRANSCRIPTION_TYPE.MANUAL_CAPTION_FINAL_RESULT,
        transcriptId: transcriptPayload.id,
        transcripts: transcriptPayload.transcripts,
        sender: transcriptPayload.sender,
        source: transcriptPayload.data_source,
      });
    }
  };

  /**
   * Process Transcript and send alert
   * @param {TranscriptionResponse} voiceaPayload
   * @returns {void}
   */
  private processTranscription = (voiceaPayload: TranscriptionResponse): void => {
    switch (voiceaPayload.type) {
      case TRANSCRIPTION_TYPE.TRANSCRIPT_INTERIM_RESULTS:
        this.emit(EVENT_TRIGGERS.NEW_CAPTION, {
          isFinal: false,
          transcriptId: voiceaPayload.transcript_id,
          transcripts: voiceaPayload.transcripts,
        });
        break;

      case TRANSCRIPTION_TYPE.TRANSCRIPT_FINAL_RESULT:
        this.emit(EVENT_TRIGGERS.NEW_CAPTION, {
          isFinal: true,
          transcriptId: voiceaPayload.transcript_id,
          transcripts: voiceaPayload.transcripts?.map((transcript) => {
            transcript.timestamp = millisToMinutesAndSeconds(transcript.end_millis);

            return transcript;
          }),
        });
        break;

      case TRANSCRIPTION_TYPE.HIGHLIGHT_CREATED:
        this.emit(EVENT_TRIGGERS.HIGHLIGHT_CREATED, {
          csis: voiceaPayload.highlight?.csis,
          highlightId: voiceaPayload.highlight?.highlight_id,
          text: voiceaPayload.highlight?.transcript,
          highlightLabel: voiceaPayload.highlight?.highlight_label,
          highlightSource: voiceaPayload.highlight?.highlight_source,
          timestamp: millisToMinutesAndSeconds(voiceaPayload.highlight?.end_millis ?? 0),
        });
        break;

      case TRANSCRIPTION_TYPE.EVA_THANKS:
        this.emit(EVENT_TRIGGERS.EVA_COMMAND, {
          isListening: false,
          text: voiceaPayload.command_response,
        });
        break;

      case TRANSCRIPTION_TYPE.EVA_WAKE:
      case TRANSCRIPTION_TYPE.EVA_CANCEL:
        this.emit(EVENT_TRIGGERS.EVA_COMMAND, {
          isListening: voiceaPayload.type === TRANSCRIPTION_TYPE.EVA_WAKE,
        });
        break;

      case TRANSCRIPTION_TYPE.LANGUAGE_DETECTED: {
        const isInSpokenLanguages = this.spokenLanguages.includes(voiceaPayload.language);
        if (isInSpokenLanguages) {
          this.emit(EVENT_TRIGGERS.LANGUAGE_DETECTED, {
            languageCode: voiceaPayload.language,
          });
        }
        break;
      }
      default:
        break;
    }
  };

  /**
   * Processes Caption Language Response
   * @param {CaptionLanguageResponse} voiceaPayload
   * @returns {void}
   */
  private processCaptionLanguageResponse = (voiceaPayload: CaptionLanguageResponse): void => {
    if (voiceaPayload.statusCode === 200) {
      this.emit(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, {statusCode: 200});
    } else {
      this.emit(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, {
        statusCode: voiceaPayload.errorCode,
        errorMessage: voiceaPayload.message,
      });
    }
  };

  /**
   * processes voicea announcement response and triggers event
   * @param {Object} voiceaPayload
   * @returns {void}
   */
  private processAnnouncementMessage = (voiceaPayload: AnnouncementPayload): void => {
    const voiceaLanguageOptions = {
      captionLanguages: voiceaPayload?.translation?.allowed_languages ?? [],
      maxLanguages: voiceaPayload?.translation?.max_languages ?? 0,
      spokenLanguages: voiceaPayload?.ASR?.spoken_languages ?? [],
      currentSpokenLanguage: this.currentSpokenLanguage,
    };

    this.spokenLanguages = voiceaPayload?.ASR?.spoken_languages ?? [];
    this.emit(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, voiceaLanguageOptions);
  };

  /**
   * Indicates whether the LLM channel is connected.
   * @returns {boolean}
   */
  public isLLMConnected = (): boolean => this.llmChannel.isConnected();

  public getKeepTranscriptionSubscribed = (): boolean => this.keepTranscriptionSubscribed;

  /**
   * Sends Announcement to add voicea to the meeting
   * @returns {void}
   */
  public sendAnnouncement = (): void => {
    this.announceStatus = ANNOUNCE_STATUS.JOINING;
    const socket = this.llmChannel.getSocket();
    const binding = this.llmChannel.getBinding();

    const payload = {
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: [
        {
          route: binding,
        },
      ],
      // If captionServiceId exists, send it as the 'to' header; otherwise keep headers empty.
      headers: this.captionServiceId ? {to: this.captionServiceId} : {},
      data: {
        clientPayload: {
          version: 'v2',
        },
        eventType: 'relay.event',
        relayType: AIBRIDGE_RELAY_TYPES.VOICEA.CLIENT_ANNOUNCEMENT,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    };
    socket.send(payload);
    this.seqNum += 1;
  };

  /**
   * Set Spoken Language for the meeting
   * @param {string} languageCode
   * @param {"DEFAULT" | "AUTO" | "MANUAL"} languageAssignment
   * @returns {Promise}
   */
  public setSpokenLanguage = (
    languageCode: string,
    languageAssignment?: 'DEFAULT' | 'AUTO' | 'MANUAL'
  ): Promise<void> =>
    this.webex
      .request({
        method: 'PUT',
        url: `${this.llmChannel.getLocusUrl()}/controls/`,
        body: {
          transcribe: {
            spokenLanguage: languageCode,
            ...(languageAssignment && {languageAssignment}),
          },
        },
      })
      .then(() => {
        this.emit(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, {languageCode});
      });

  /**
   * Request Language translation
   * @param {string} languageCode
   * @returns {void}
   */
  public requestLanguage = (languageCode: string): void => {
    if (!this.isLLMConnected()) {
      return;
    }

    const socket = this.llmChannel.getSocket();
    const binding = this.llmChannel.getBinding();

    socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: [
        {
          route: binding,
        },
      ],
      headers: {
        to: this.captionServiceId,
      },
      data: {
        clientPayload: {
          translationLanguage: languageCode,
          id: uuid.v4(),
        },
        eventType: 'relay.event',
        relayType: AIBRIDGE_RELAY_TYPES.VOICEA.TRANSLATION_REQUEST,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });
    this.currentCaptionLanguage = languageCode;
    this.seqNum += 1;
  };

  /**
   * Send manual closed captions to voicea service
   * @param {string} text
   * @param {number} timeStamp
   * @param {number[]} csis
   * @param {boolean} isFinal
   * @returns {void}
   */
  public sendManualClosedCaption = (
    text: string,
    timeStamp: number,
    csis: number[],
    isFinal: boolean
  ): void => {
    if (!this.isLLMConnected()) {
      return;
    }

    const socket = this.llmChannel.getSocket();
    const binding = this.llmChannel.getBinding();

    socket?.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: [
        {
          route: binding,
        },
      ],
      headers: {},
      data: {
        eventType: 'relay.event',
        relayType: AIBRIDGE_RELAY_TYPES.MANUAL.CAPTIONER,
        transcriptPayload: {
          type: isFinal
            ? TRANSCRIPTION_TYPE.MANUAL_CAPTION_FINAL_RESULT
            : TRANSCRIPTION_TYPE.MANUAL_CAPTION_INTERIM_RESULT,
          id: uuid.v4(),
          transcripts: [
            {
              text,
              start_millis: timeStamp,
              end_millis: timeStamp,
              csis,
            },
          ],
          transcript_id: uuid.v4(),
        },
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });
    this.seqNum += 1;
  };

  /**
   * request turn on Captions
   * @param {string} [languageCode] - Optional Parameter for spoken language code
   * @returns {Promise}
   */
  private requestTurnOnCaptions = (languageCode?: string): undefined | Promise<void> => {
    this.captionStatus = TURN_ON_CAPTION_STATUS.SENDING;

    const locusUrl = this.llmChannel.getLocusUrl();

    const body = {
      transcribe: {caption: true},
      languageCode,
    };

    return this.webex
      .request({
        method: 'PUT',
        url: `${locusUrl}/controls/`,
        body,
      })
      .then(() => {
        this.emit(EVENT_TRIGGERS.CAPTIONS_TURNED_ON);

        this.areCaptionsEnabled = true;
        this.captionStatus = TURN_ON_CAPTION_STATUS.ENABLED;
        this.announce();
        this.updateSubchannelSubscriptionsAndSyncCaptionState({subscribe: ['transcription']}, true);
      })
      .catch((error) => {
        this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
        throw new Error('turn on captions fail');
      });
  };

  /**
   * is announce processing
   * @returns {boolean}
   */
  public isAnnounceProcessing = (): boolean =>
    [ANNOUNCE_STATUS.JOINING, ANNOUNCE_STATUS.JOINED].includes(this.announceStatus);

  /**
   * is announce processed
   * @returns {boolean}
   */
  public isAnnounceProcessed = (): boolean => this.announceStatus === ANNOUNCE_STATUS.JOINED;

  /**
   * announce to voicea data channel
   * @returns {void}
   */
  public announce = (): void => {
    if (this.isAnnounceProcessed()) {
      return;
    }
    if (!this.isLLMConnected()) {
      throw new Error('voicea can not announce before llm connected');
    }
    this.sendAnnouncement();
  };

  /**
   * is turn on caption processing
   * @returns {boolean}
   */
  public isCaptionProcessing = (): boolean =>
    [TURN_ON_CAPTION_STATUS.SENDING, TURN_ON_CAPTION_STATUS.ENABLED].includes(this.captionStatus);

  /**
   * Turn on Captions
   * @param {string} [spokenLanguage] - Optional Spoken language code
   * @returns {Promise}
   */
  public turnOnCaptions = async (spokenLanguage?: string): Promise<void | undefined> => {
    if (this.captionStatus === TURN_ON_CAPTION_STATUS.SENDING) return undefined;

    if (!this.isLLMConnected()) {
      throw new Error('can not turn on captions before llm connected');
    }

    return this.requestTurnOnCaptions(spokenLanguage);
  };

  /**
   * Toggle transcribing for highlights
   * @param {boolean} activate true means to turn on transcribing and false means to turn off
   * @param {string} spokenLanguage language code for spoken language
   * @returns {Promise}
   */
  public toggleTranscribing = (
    activate: boolean,
    spokenLanguage?: string
  ): undefined | Promise<void> => {
    return this.webex
      .request({
        method: 'PUT',
        url: `${this.llmChannel.getLocusUrl()}/controls/`,
        body: {
          transcribe: {
            transcribing: activate,
          },
          spokenLanguage,
        },
      })
      .then((): undefined | Promise<void> => {
        if (activate && !this.areCaptionsEnabled) {
          return this.turnOnCaptions(spokenLanguage);
        }

        return undefined;
      });
  };

  /**
   * Toggle turn on manual caption
   * @param {boolean} enable true means to turn on manual caption, false means to turn off
   * @returns {Promise}
   */
  public toggleManualCaption = (enable: boolean): undefined | Promise<void> => {
    if (this.toggleManualCaptionStatus === TOGGLE_MANUAL_CAPTION_STATUS.SENDING) return undefined;

    this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.SENDING;

    return this.webex
      .request({
        method: 'PUT',
        url: `${this.llmChannel.getLocusUrl()}/controls/`,
        body: {
          manualCaption: {
            enable,
          },
        },
      })
      .then((): undefined | Promise<void> => {
        this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;

        return undefined;
      })
      .catch(() => {
        this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
        throw new Error('toggle manual captions fail');
      });
  };

  /**
   * In meeting Spoken Language changed event
   * @param {string} languageCode
   * @param {string} meetingId
   * @returns {void}
   */
  public onSpokenLanguageUpdate = (languageCode: string, meetingId: string): void => {
    this.emit(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, {languageCode, meetingId});
    this.currentSpokenLanguage = languageCode;
  };

  /**
   * In meeting Spoken Language changed event
   * @param {string} serviceId
   * @returns {void}
   */
  public onCaptionServiceIdUpdate = (serviceId: string): void => {
    if (!serviceId) {
      return;
    }
    if (this.captionServiceId !== serviceId) {
      this.captionServiceId = serviceId;
      if (this.currentCaptionLanguage) {
        this.requestLanguage(this.currentCaptionLanguage);
      }
    }
  };

  /**
   * get caption status
   * @returns {string}
   */
  public getCaptionStatus = (): string => this.captionStatus;

  /**
   * get announce status
   * @returns {string}
   */
  public getAnnounceStatus = (): string => this.announceStatus;

  /**
   * update LLM sub‑channel subscriptions.
   *
   * @param {string[]} options.subscribe   Sub‑channels to subscribe to.
   * @param {string[]} options.unsubscribe Sub‑channels to unsubscribe from.
   * @returns {Promise}
   */
  public updateSubchannelSubscriptions = async ({
    subscribe = [],
    unsubscribe = [],
  }: {
    subscribe?: string[];
    unsubscribe?: string[];
  } = {}): Promise<void> => {
    if (!this.isLLMConnected()) return;

    const isDataChannelTokenEnabled = await this.llmChannel.isDataChannelTokenEnabled();
    if (!isDataChannelTokenEnabled) return;

    const socket = this.llmChannel.getSocket();
    const datachannelUrl = this.llmChannel.getDatachannelUrl();

    socket.send({
      id: `${this.seqNum}`,
      type: 'subchannelSubscriptionRequest',
      data: {
        datachannelUri: datachannelUrl,
        subscribe,
        unsubscribe,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });

    this.seqNum += 1;
  };

  /**
   * Updates transcription subchannel subscriptions and records whether the
   * transcription subscription should be kept (and restored on reconnect).
   *
   * @param {Object} [options] - Subscription options.
   * @param {string[]} [options.subscribe] - Subchannels to subscribe to.
   * @param {string[]} [options.unsubscribe] - Subchannels to unsubscribe from.
   * @param {boolean} [keepSubscribed=false] - Whether the transcription
   * subscription should be kept and restored on reconnect.
   *
   * @returns {Promise<void>}
   */
  public updateSubchannelSubscriptionsAndSyncCaptionState = (
    options: {
      subscribe?: string[];
      unsubscribe?: string[];
    } = {},
    keepSubscribed = false
  ): Promise<void> => {
    this.keepTranscriptionSubscribed = keepSubscribed;

    return this.updateSubchannelSubscriptions(options);
  };
}

export default VoiceaChannel;
