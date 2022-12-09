export const EVENT_TRIGGERS = {
  VOICEA_ANNOUNCEMENT: 'voicea:announcement',
  CAPTION_LANGUAGE_UPDATE: 'voicea:captionLanguageUpdate',
  SPOKEN_LANGUAGE_UPDATE: 'voicea:spokenLanguageUpdate',
  CAPTIONS_TURNED_ON: 'voicea:captionOn',
  NEW_CAPTION: 'voicea:newCaption',
  EVA_COMMAND: 'voicea:wxa',
  HIGHLIGHT_CREATED: 'voicea:highlightCreated',
};

export const VOICEA_RELAY_TYPES = {
  ANNOUNCEMENT: 'voicea.annc',
  CLIENT_ANNOUNCEMENT: 'client.annc',
  TRANSLATION_REQUEST: 'voicea.transl.req',
  TRANSLATION_RESPONSE: 'voicea.transl.rsp',
  TRANSCRIPTION: 'voicea.transcription',
};

export const TRANSCRIPTION_TYPE = {
  UNKNOWN: 'unknown',
  EVA_WAKE: 'eva_wake',
  EVA_THANKS: 'eva_thanks',
  EVA_CANCEL: 'eva_cancel',
  HIGHLIGHT_CREATED: 'highlight_created',
  TRANSCRIPT_INTERIM_RESULTS: 'transcript_interim_results',
  TRANSCRIPT_FINAL_RESULT: 'transcript_final_result',
};

export const VOICEA = 'voicea';
