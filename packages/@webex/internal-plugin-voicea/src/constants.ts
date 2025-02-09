export const EVENT_TRIGGERS = {
  VOICEA_ANNOUNCEMENT: 'voicea:announcement',
  CAPTION_LANGUAGE_UPDATE: 'voicea:captionLanguageUpdate',
  SPOKEN_LANGUAGE_UPDATE: 'voicea:spokenLanguageUpdate',
  CAPTIONS_TURNED_ON: 'voicea:captionOn',
  TRANSCRIBING_ON: 'voicea:transcribingOn',
  TRANSCRIBING_OFF: 'voicea:transcribingOff',

  NEW_CAPTION: 'voicea:newCaption',
  EVA_COMMAND: 'voicea:wxa',
  HIGHLIGHT_CREATED: 'voicea:highlightCreated',
  NEW_MANUAL_CAPTION: 'aibridge:newManualCaption',
};

export const AIBRIDGE_RELAY_TYPES = {
  VOICEA: {
    ANNOUNCEMENT: 'voicea.annc',
    CLIENT_ANNOUNCEMENT: 'client.annc',
    TRANSLATION_REQUEST: 'voicea.transl.req',
    TRANSLATION_RESPONSE: 'voicea.transl.rsp',
    TRANSCRIPTION: 'voicea.transcription',
  },
  MANUAL: {
    TRANSCRIPTION: 'aibridge.manual_transcription',
  },
};

export const TRANSCRIPTION_TYPE = {
  UNKNOWN: 'unknown',
  EVA_WAKE: 'eva_wake',
  EVA_THANKS: 'eva_thanks',
  EVA_CANCEL: 'eva_cancel',
  HIGHLIGHT_CREATED: 'highlight_created',
  TRANSCRIPT_INTERIM_RESULTS: 'transcript_interim_results',
  TRANSCRIPT_FINAL_RESULT: 'transcript_final_result',
  MANUAL_CAPTION_INTERIM_RESULTS: 'manual_caption_interim_results',
  MANUAL_CAPTION_FINAL_RESULT: 'manual_caption_final_result',
};

export const VOICEA = 'voicea';

export const ANNOUNCE_STATUS = {
  IDLE: 'idle',
  JOINED: 'joined',
  JOINING: 'joining',
};

export const TURN_ON_CAPTION_STATUS = {
  IDLE: 'idle',
  ENABLED: 'enabled',
  SENDING: 'sending',
};
