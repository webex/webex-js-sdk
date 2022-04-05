/* eslint-disable camelcase */
/* eslint-disable no-undef */

/**
 * Type for payload
 */
interface AnnouncementPayload {
  translation:{
    max_languages: number;
    allowed_languages: string[]
  };

  ASR: {
    spoken_languages: string[];
  };
}

// eslint-disable-next-line no-undef
type TRANSCRIPTION_TYPES = 'unknown'|
'eva_wake' |
'eva_thanks' |
'eva_cancel' |
'highlight_created'|
'transcript_interim_results'|
'transcript_final_result';

/**
 * Class for an Transcription Object
 */
interface Transcription {
  start_millis:number;
  end_millis:number;
  text:string;
  transcript_language_code: string;
  translations:{[x:string]:string};
  csis:number[];
  last_packet_timestamp_ms: number;
}

/**
 * Highlights
 */
 interface Highlight {
  highlight_id: string;
  transcript: string;
  highlight_label: string;
  highlight_source: string;
  start_millis:number;
  end_millis:number;
  csis:number[];
}
/**
 * Type for Transcription message
 */
interface TranscriptionResponse {
  type: TRANSCRIPTION_TYPES;
  transcript_id: string;
  translations?: {[x:string]:string};
  transcripts?: Transcription[];
  transcript?: Transcription;
  highlight?: Highlight;
  csis: number[];
  data:string;
  command_response: string;
}
/**
 * Type for CaptionLanguageResponse
 */
interface CaptionLanguageResponse {
  requestId: string;
  statusCode: number;
  errorCode:number;
  message:string;
}

interface IVoiceaChannel {
  setSpokenLanguage: (languageCode: string) => Promise<void>;
  requestLanguage: (languageCode: string) => void;
  turnOnCaptions: () => undefined | Promise<void>;
  toggleTranscribing: (activate:boolean) => undefined|Promise<void>;
}
export {AnnouncementPayload, CaptionLanguageResponse, TranscriptionResponse, Transcription, Highlight, IVoiceaChannel};
