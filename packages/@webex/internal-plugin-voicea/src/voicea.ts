import uuid from 'uuid';
import {TriggerProxy as Trigger} from '@webex/plugin-meetings';
import {WebexPlugin, config} from '@webex/webex-core';

import {EVENT_TRIGGERS, VOICEA_RELAY_TYPES, TRANSCRIPTION_TYPE, VOICEA} from './constants';
// eslint-disable-next-line no-unused-vars
import {
  AnnouncementPayload,
  CaptionLanguageResponse,
  TranscriptionResponse,
  IVoiceaChannel,
} from './voicea.types';
import {millisToMinutesAndSeconds} from './utils';

/**
 * VoiceaChannel to hold single instance of LLM
 */
export class VoiceaChannel extends WebexPlugin implements IVoiceaChannel {
  namespace = VOICEA;

  private seqNum: number;

  private hasVoiceaJoined: boolean;

  private areCaptionsEnabled: boolean;

  private isTranscribingEnabled: boolean;

  private vmcDeviceId: string;

  /**
   * Listen to websocket messages
   */
  private listenToEvents() {
    this.webex.internal.llm.on('event:relay.event', (e) => {
      this.seqNum = e.sequenceNumber + 1;
      switch (e.data.relayType) {
        case VOICEA_RELAY_TYPES.ANNOUNCEMENT:
          this.vmcDeviceId = e.headers.from;
          this.hasVoiceaJoined = true;
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
    });
  }

  /**
   * Initializes Voicea plugin
   * @param {any} args
   */
  constructor(...args) {
    super(...args);
    this.seqNum = 1;
    this.hasVoiceaJoined = false;
    this.areCaptionsEnabled = false;
    this.isTranscribingEnabled = false;
    this.vmcDeviceId = undefined;
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
    if (this.hasVoiceaJoined || !this.webex.internal.llm.isConnected()) return;

    this.listenToEvents();
    this.webex.internal.llm.socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
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
    this.request({
      method: 'PUT',
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
    if (!this.webex.internal.llm.isConnected()) return;
    this.webex.internal.llm.socket.send({
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
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
   * Turn on Captions
   * @returns {Promise}
   */
  public turnOnCaptions = async (): undefined | Promise<void> => {
    if (this.hasVoiceaJoined && this.areCaptionsEnabled) return undefined;

    return this.request({
      method: 'PUT',
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {caption: true},
      },
    }).then(() => {
      Trigger.trigger(
        this,
        {
          file: 'voicea',
          function: 'turnOnCaptions',
        },
        EVENT_TRIGGERS.CAPTIONS_TURNED_ON
      );
      this.areCaptionsEnabled = true;
      this.sendAnnouncement();
    });
  };

  /**
   * Toggle transcribing for highlights
   * @param {bool} activate if true transcribing is turned on
   * @returns {Promise}
   */
  public toggleTranscribing = async (activate: boolean): undefined | Promise<void> => {
    if (this.isTranscribingEnabled === activate) return undefined;

    return this.request({
      method: 'PUT',
      url: `${this.webex.internal.llm.getLocusUrl()}/controls/`,
      body: {
        transcribe: {transcribing: activate},
      },
    }).then(() => {
      Trigger.trigger(
        this,
        {
          file: 'voicea',
          function: 'toggleTranscribing',
        },
        activate ? EVENT_TRIGGERS.TRANSCRIBING_ON : EVENT_TRIGGERS.TRANSCRIBING_OFF
      );
      this.isTranscribingEnabled = activate;
      if (activate && !this.areCaptionsEnabled && !this.hasVoiceaJoined) this.turnOnCaptions();
    });
  };
}

export default VoiceaChannel;
