// TODO: Consider moving these to the main meetings constants file at some point
// Only worth doing so if they are used outside of the hash tree

export const EMPTY_HASH = '99aa06d3014798d86001c324468d497f';

export const DATA_SETS = {
  MAIN: 'main',
  ATTENDEES: 'attendees', // All the attendees in the locus
  ATD_ACTIVE: 'atd-active', // The attendees that have their hands raised or are allowed to unmute themselves
  ATD_UNMUTED: 'atd-unmuted', // The attendees that are unmuted
  SELF: 'self',
};
