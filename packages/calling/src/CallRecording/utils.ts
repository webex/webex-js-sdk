import {RecordingParty, RecordingServiceData} from './types';

/**
 * Resolves the *remote* party of a recorded call (the party that is not the recording owner) from a
 * recording's {@link RecordingServiceData}.
 *
 * The owner's side is indicated by `serviceData.personality`:
 * - `originator` -> the owner placed the call, so the remote party is `calledParty`.
 * - `terminator` -> the owner received the call, so the remote party is `callingParty`.
 *
 * Returns `undefined` when the party details are absent (e.g. the list endpoint, which only
 * populates `locationId`/`callSessionId`) or when `personality` is unknown. The party details are
 * returned by the metadata endpoint (`GET /convergedRecordings/{recordingId}/metadata`).
 *
 * Use `getRemoteParty(serviceData)?.actor?.id` for the Webex person UUID (avatar/presence
 * services). External/PSTN parties may have no `actor.id`; fall back to `?.name` for display.
 *
 * @param serviceData - The `serviceData` from a {@link Recording} or {@link RecordingMetadata}.
 * @returns The remote {@link RecordingParty}, or `undefined` when it cannot be determined.
 */
export const getRemoteParty = (serviceData?: RecordingServiceData): RecordingParty | undefined => {
  if (!serviceData) {
    return undefined;
  }

  const {personality, callingParty, calledParty} = serviceData;

  switch (personality) {
    case 'originator':
      return calledParty;
    case 'terminator':
      return callingParty;
    default:
      return undefined;
  }
};
