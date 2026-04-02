export const EMPTY_HASH = '99aa06d3014798d86001c324468d497f';

export const DataSetNames = {
  MAIN: 'main', // sent to web client, contains also panelists, over LLM
  ATTENDEES: 'attendees', // NOT SENT to web client, all the attendees in the locus
  ATD_ACTIVE: 'atd-active', // only sent to panelists, over LLM; the attendees that have their hands raised or are allowed to unmute themselves
  ATD_UNMUTED: 'atd-unmuted', // sent to web client, over LLM, not sent to panelists; the attendees that are unmuted
  SELF: 'self', // sent to web client, over Mercury
  UNJOINED: 'unjoined', // sent when you are not joined, but can still see some stuff from the meeting (mutually exclusive with "main")
};

// Priority order for initializing data sets — higher priority names come first.
// Data sets not listed here will be initialized after all prioritized ones.
// MAIN must come before SELF because LocusInfo.updateFromHashTree processes the
// batch of updatedObjects in order, and the SELF handler in updateLocusFromHashTreeObject
// checks locus.info?.isWebinar (which comes from MAIN) to decide whether to create a
// participant object for webinar attendees. If SELF were initialized first, locus.info
// would not yet be populated and the attendee participant would be skipped.
export const DATA_SET_INIT_PRIORITY: string[] = [DataSetNames.MAIN, DataSetNames.SELF];
