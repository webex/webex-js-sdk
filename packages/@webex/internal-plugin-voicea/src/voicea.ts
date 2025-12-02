import uuid from 'uuid';
import {WebexPlugin, config} from '@webex/webex-core';

import {
  EVENT_TRIGGERS,
  AIBRIDGE_RELAY_TYPES,
  TRANSCRIPTION_TYPE,
  VOICEA,
  ANNOUNCE_STATUS,
  TURN_ON_CAPTION_STATUS,
  TOGGLE_MANUAL_CAPTION_STATUS,
  DEFAULT_SPOKEN_LANGUAGE,
  LANGUAGE_ASSIGNMENT,
} from './constants';
// eslint-disable-next-line no-unused-vars
import {
  AnnouncementPayload,
  CaptionLanguageResponse,
  TranscriptionResponse,
  IVoiceaChannel,
} from './voicea.types';
import {millisToMinutesAndSeconds} from './utils';

/**
 * @description VoiceaChannel to hold single instance of LLM
 * @export
 * @class VoiceaChannel
 */
export class VoiceaChannel extends WebexPlugin implements IVoiceaChannel {
  namespace = VOICEA;

  private seqNum: number;

  private areCaptionsEnabled: boolean;

  private hasSubscribedToEvents = false;

  private vmcDeviceId?: string;

  private announceStatus: string;

  private captionStatus: string;

  private toggleManualCaptionStatus: string;

  private currentSpokenLanguage?: string;

  private spokenLanguages: string[] = [];

  /**
   * @param {Object} e
   * @returns {undefined}
   */

  private eventProcessor = (e) => {
    this.seqNum = e.sequenceNumber + 1;
    switch (e.data.relayType) {
      case AIBRIDGE_RELAY_TYPES.VOICEA.ANNOUNCEMENT:
        this.vmcDeviceId = e.headers.from;
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
   * Listen to websocket messages
   * @returns {undefined}
   */
  private listenToEvents() {
    if (!this.hasSubscribedToEvents) {
      // @ts-ignore
      this.webex.internal.llm.on('event:relay.event', this.eventProcessor);
      this.hasSubscribedToEvents = true;
    }
  }

  /**
   * Listen to websocket messages
   * @returns {void}
   */
  public deregisterEvents() {
    this.areCaptionsEnabled = false;
    this.vmcDeviceId = undefined;
    // @ts-ignore
    this.webex.internal.llm.off('event:relay.event', this.eventProcessor);
    this.hasSubscribedToEvents = false;
    this.announceStatus = ANNOUNCE_STATUS.IDLE;
    this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
    this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
    this.currentSpokenLanguage = undefined;
  }

  /**
   * Initializes Voicea plugin
   * @param {any} args
   */
  constructor(...args) {
    super(...args);
    this.seqNum = 1;
    this.areCaptionsEnabled = false;
    this.vmcDeviceId = undefined;
    this.announceStatus = ANNOUNCE_STATUS.IDLE;
    this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
    this.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
    this.currentSpokenLanguage = DEFAULT_SPOKEN_LANGUAGE;
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
      // @ts-ignore
      this.trigger(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, {
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
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.NEW_CAPTION, {
          isFinal: false,
          transcriptId: voiceaPayload.transcript_id,
          transcripts: voiceaPayload.transcripts,
        });
        break;

      case TRANSCRIPTION_TYPE.TRANSCRIPT_FINAL_RESULT:
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.NEW_CAPTION, {
          isFinal: true,
          transcriptId: voiceaPayload.transcript_id,
          transcripts: voiceaPayload.transcripts.map((transcript) => {
            transcript.timestamp = millisToMinutesAndSeconds(transcript.end_millis);

            return transcript;
          }),
        });
        break;

      case TRANSCRIPTION_TYPE.HIGHLIGHT_CREATED:
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.HIGHLIGHT_CREATED, {
          csis: voiceaPayload.highlight.csis,
          highlightId: voiceaPayload.highlight.highlight_id,
          text: voiceaPayload.highlight.transcript,
          highlightLabel: voiceaPayload.highlight.highlight_label,
          highlightSource: voiceaPayload.highlight.highlight_source,
          timestamp: millisToMinutesAndSeconds(voiceaPayload.highlight.end_millis),
        });
        break;

      case TRANSCRIPTION_TYPE.EVA_THANKS:
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.EVA_COMMAND, {
          isListening: false,
          text: voiceaPayload.command_response,
        });
        break;

      case TRANSCRIPTION_TYPE.EVA_WAKE:
      case TRANSCRIPTION_TYPE.EVA_CANCEL:
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.EVA_COMMAND, {
          isListening: voiceaPayload.type === TRANSCRIPTION_TYPE.EVA_WAKE,
        });
        break;

      case TRANSCRIPTION_TYPE.LANGUAGE_DETECTED:
        // @ts-ignore
        if (this.spokenLanguages.includes(voiceaPayload.language)) {
          this.setSpokenLanguage(voiceaPayload.language, LANGUAGE_ASSIGNMENT.AUTO);
        }
        break;

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
      // @ts-ignore
      this.trigger(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, {statusCode: 200});
    } else {
      // @ts-ignore
      this.trigger(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, {
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
    // @ts-ignore
    this.trigger(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, voiceaLanguageOptions);
  };

  /**
   * Sends Announcement to add voicea to the meeting
   * @returns {void}
   */
  private sendAnnouncement = (): void => {
    this.announceStatus = ANNOUNCE_STATUS.JOINING;
    this.listenToEvents();
    // @ts-ignore
    this.webex.internal.llm.socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
        // @ts-ignore
        route: this.webex.internal.llm.getBinding(),
      },
      headers: {},
      data: {
        clientPayload: {
          version: 'v2',
        },
        eventType: 'relay.event',
        relayType: AIBRIDGE_RELAY_TYPES.VOICEA.CLIENT_ANNOUNCEMENT,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });
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
    languageAssignment = LANGUAGE_ASSIGNMENT.DEFAULT
  ): Promise<void> =>
    // @ts-ignore
    this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {
          spokenLanguage: languageCode,
          languageAssignment,
        },
      },
    }).then(() => {
      // @ts-ignore
      this.trigger(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, {languageCode});
    });

  /**
   * Request Language translation
   * @param {string} languageCode
   * @returns {void}
   */
  public requestLanguage = (languageCode: string): void => {
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) return;
    // @ts-ignore
    this.webex.internal.llm.socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
        // @ts-ignore
        route: this.webex.internal.llm.getBinding(),
      },
      headers: {
        to: this.vmcDeviceId,
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
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) return;

    // @ts-ignore
    this.webex.internal.llm.socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
        // @ts-ignore
        route: this.webex.internal.llm.getBinding(),
      },
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
   * @param {string} [languageCode] - Optional Parameter for spoken language code. Defaults to English
   * @returns {Promise}
   */
  private requestTurnOnCaptions = (languageCode?): undefined | Promise<void> => {
    this.captionStatus = TURN_ON_CAPTION_STATUS.SENDING;

    // only set the spoken language if it is provided
    const body = {
      transcribe: {caption: true},
      languageCode,
    };

    // @ts-ignore
    // eslint-disable-next-line newline-before-return
    return this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body,
    })
      .then(() => {
        // @ts-ignore
        this.trigger(EVENT_TRIGGERS.CAPTIONS_TURNED_ON);

        this.areCaptionsEnabled = true;
        this.captionStatus = TURN_ON_CAPTION_STATUS.ENABLED;
        this.announce();
      })
      .catch(() => {
        this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
        throw new Error('turn on captions fail');
      });
  };

  /**
   * is announce processing
   * @returns {boolean}
   */
  private isAnnounceProcessing = () =>
    [ANNOUNCE_STATUS.JOINING, ANNOUNCE_STATUS.JOINED].includes(this.announceStatus);

  /**
   * announce to voicea data chanel
   * @returns {void}
   */
  public announce = () => {
    if (this.isAnnounceProcessing()) return;
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) {
      throw new Error('voicea can not announce before llm connected');
    }
    this.sendAnnouncement();
  };

  /**
   * is turn on caption processing
   * @returns {boolean}
   */
  private isCaptionProcessing = () =>
    [TURN_ON_CAPTION_STATUS.SENDING, TURN_ON_CAPTION_STATUS.ENABLED].includes(this.captionStatus);

  /**
   * Turn on Captions
   * @param {string} [spokenLanguage] - Optional Spoken language code
   * @returns {Promise}
   */
  public turnOnCaptions = async (spokenLanguage?): undefined | Promise<void> => {
    if (this.captionStatus === TURN_ON_CAPTION_STATUS.SENDING) return undefined;
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) {
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
    // @ts-ignore
    return this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {
          transcribing: activate,
        },
        spokenLanguage,
      },
    }).then((): undefined | Promise<void> => {
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

    // @ts-ignore
    return this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
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
  public onSpokenLanguageUpdate = (languageCode: string, meetingId): void => {
    // @ts-ignore
    this.trigger(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, {languageCode, meetingId});
    this.currentSpokenLanguage = languageCode;
  };

  /**
   * get caption status
   * @returns {string}
   */
  public getCaptionStatus = () => this.captionStatus;

  /**
   * get announce status
   * @returns {string}
   */
  public getAnnounceStatus = () => this.announceStatus;
}

export default VoiceaChannel;
