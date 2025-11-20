export const EMPTY_HASH = '99aa06d3014798d86001c324468d497f';

export const DataSetNames = {
  MAIN: 'main', // sent to web client, contains also panelists, over LLM
  ATTENDEES: 'attendees', // NOT SENT to web client, all the attendees in the locus
  ATD_ACTIVE: 'atd-active', // only sent to panelists, over LLM; the attendees that have their hands raised or are allowed to unmute themselves
  ATD_UNMUTED: 'atd-unmuted', // sent to web client, over LLM, not sent to panelists; the attendees that are unmuted
  SELF: 'self', // sent to web client, over Mercury
};
