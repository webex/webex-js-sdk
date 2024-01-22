import uuid from 'uuid';
import {TriggerProxy as Trigger} from '@webex/plugin-meetings';
import {WebexPlugin, config} from '@webex/webex-core';

import {
  EVENT_TRIGGERS,
  VOICEA_RELAY_TYPES,
  TRANSCRIPTION_TYPE,
  VOICEA,
  ANNOUNCE_STATUS,
  TURN_ON_CAPTION_STATUS,
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

  /**
   * @param {Object} e
   * @returns {undefined}
   */

  private eventProcessor = (e) => {
    this.seqNum = e.sequenceNumber + 1;
    switch (e.data.relayType) {
      case VOICEA_RELAY_TYPES.ANNOUNCEMENT:
        this.vmcDeviceId = e.headers.from;
        this.announceStatus = ANNOUNCE_STATUS.JOINED;
        this.processAnnouncementMessage(e.data.voiceaPayload);
        break;
      case VOICEA_RELAY_TYPES.TRANSLATION_RESPONSE:
        this.processCaptionLanguageResponse(e.data.voiceaPayload);
        break;
      case VOICEA_RELAY_TYPES.TRANSCRIPTION:
        this.processTranscription(e.data.voiceaPayload);
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
  }

  /**
   * Process Transcript and send alert
   * @param {TranscriptionResponse} voiceaPayload
   * @returns {void}
   */
  private processTranscription = (voiceaPayload: TranscriptionResponse): void => {
    switch (voiceaPayload.type) {
      case TRANSCRIPTION_TYPE.TRANSCRIPT_INTERIM_RESULTS:
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'processTranscription',
          },
          EVENT_TRIGGERS.NEW_CAPTION,
          {
            isFinal: false,
            transcriptId: voiceaPayload.transcript_id,
            transcripts: voiceaPayload.transcripts,
          }
        );
        break;

      case TRANSCRIPTION_TYPE.TRANSCRIPT_FINAL_RESULT:
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'processTranscription',
          },
          EVENT_TRIGGERS.NEW_CAPTION,
          {
            isFinal: true,
            transcriptId: voiceaPayload.transcript_id,
            transcript: {
              csis: voiceaPayload.csis,
              text: voiceaPayload.transcript.text,
              transcriptLanguageCode: voiceaPayload.transcript.transcript_language_code,
            },
            timestamp: millisToMinutesAndSeconds(voiceaPayload.transcript.end_millis),
          }
        );
        break;

      case TRANSCRIPTION_TYPE.HIGHLIGHT_CREATED:
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'processTranscription',
          },
          EVENT_TRIGGERS.HIGHLIGHT_CREATED,
          {
            csis: voiceaPayload.highlight.csis,
            highlightId: voiceaPayload.highlight.highlight_id,
            text: voiceaPayload.highlight.transcript,
            highlightLabel: voiceaPayload.highlight.highlight_label,
            highlightSource: voiceaPayload.highlight.highlight_source,
            timestamp: millisToMinutesAndSeconds(voiceaPayload.highlight.end_millis),
          }
        );
        break;

      case TRANSCRIPTION_TYPE.EVA_THANKS:
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'processTranscription',
          },
          EVENT_TRIGGERS.EVA_COMMAND,
          {
            isListening: false,
            text: voiceaPayload.command_response,
          }
        );
        break;

      case TRANSCRIPTION_TYPE.EVA_WAKE:
      case TRANSCRIPTION_TYPE.EVA_CANCEL:
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'processTranscription',
          },
          EVENT_TRIGGERS.EVA_COMMAND,
          {
            isListening: voiceaPayload.type === TRANSCRIPTION_TYPE.EVA_WAKE,
          }
        );
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
      Trigger.trigger(
        this,
        {
          file: 'voicea',
          function: 'processCaptionLanguageResponse',
        },
        EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE,
        {statusCode: 200}
      );
    } else {
      Trigger.trigger(
        this,
        {
          file: 'voicea',
          function: 'processCaptionLanguageResponse',
        },
        EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE,
        {statusCode: voiceaPayload.errorCode, errorMessage: voiceaPayload.message}
      );
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
    };

    Trigger.trigger(
      this,
      {
        file: 'voicea',
        function: 'processAnnouncementMessage',
      },
      EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT,
      voiceaLanguageOptions
    );
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
        relayType: VOICEA_RELAY_TYPES.CLIENT_ANNOUNCEMENT,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });
    this.seqNum += 1;
  };

  /**
   * Set Spoken Language for the meeting
   * @param {string} languageCode
   * @returns {Promise}
   */
  public setSpokenLanguage = (languageCode: string): Promise<void> =>
    // @ts-ignore
    this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        languageCode,
      },
    }).then(() => {
      Trigger.trigger(
        this,
        {
          file: 'voicea',
          function: 'setSpokenLanguage',
        },
        EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE,
        {languageCode}
      );
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
        relayType: VOICEA_RELAY_TYPES.TRANSLATION_REQUEST,
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
    });
    this.seqNum += 1;
  };

  /**
   * request turn on Captions
   * @returns {Promise}
   */
  private requestTurnOnCaptions = (): undefined | Promise<void> => {
    this.captionStatus = TURN_ON_CAPTION_STATUS.SENDING;
    // @ts-ignore
    // eslint-disable-next-line newline-before-return
    return this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {caption: true},
      },
    })
      .then(() => {
        Trigger.trigger(
          this,
          {
            file: 'voicea',
            function: 'turnOnCaptions',
          },
          EVENT_TRIGGERS.CAPTIONS_TURNED_ON
        );
        this.areCaptionsEnabled = true;
        this.captionStatus = TURN_ON_CAPTION_STATUS.ENABLED;
        this.announce();
      })
      .catch((e) => {
        this.captionStatus = TURN_ON_CAPTION_STATUS.IDLE;
        console.error(e);
        throw new Error('turn on captions fail ');
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
   * @returns {Promise}
   */
  public turnOnCaptions = async (): undefined | Promise<void> => {
    if (this.isCaptionProcessing()) return undefined;
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) {
      throw new Error('can not turn on captions before llm connected');
    }

    return this.requestTurnOnCaptions();
  };

  /**
   * Toggle transcribing for highlights
   * @param {bool} activate if true transcribing is turned on
   * @returns {Promise}
   */
  public toggleTranscribing = async (activate: boolean): undefined | Promise<void> => {
    // @ts-ignore
    return this.request({
      method: 'PUT',
      // @ts-ignore
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {transcribing: activate},
      },
    }).then(() => {
      if (activate && !this.areCaptionsEnabled) this.turnOnCaptions();
    });
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
