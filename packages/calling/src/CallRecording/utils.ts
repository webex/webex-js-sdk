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

/**
 * Resolves the Webex person UUID of the remote party of a recorded call, suitable for the avatar
 * (`@webex/internal-plugin-avatar`) and presence (DSS) services.
 *
 * Returns `undefined` when the remote party cannot be resolved (see {@link getRemoteParty}) or when
 * the remote party is an external/PSTN caller with no Webex `actor.id` (only a `number`/`name`); in
 * that case callers should fall back to initials from `getRemoteParty(serviceData)?.name`.
 *
 * @param serviceData - The `serviceData` from a {@link Recording} or {@link RecordingMetadata}.
 * @returns The remote party's person UUID, or `undefined` when unavailable.
 */
export const getRemotePartyId = (serviceData?: RecordingServiceData): string | undefined =>
  getRemoteParty(serviceData)?.actor?.id;
