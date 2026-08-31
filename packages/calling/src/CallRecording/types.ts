import {Eventing} from '../Events/impl';
import {CallRecordingEventTypes} from '../Events/types';
import {LOGGER} from '../Logger/types';

export interface LoggerInterface {
  level: LOGGER;
}

/**
 * Status of a converged recording, used both as the response field and as the list filter.
 *
 * - `available`: the recording is available (default).
 * - `deleted`: the recording has been moved into the recycle bin.
 */
export enum RecordingStatus {
  AVAILABLE = 'available',
  DELETED = 'deleted',
}

/**
 * Status of an AI-generated artifact (summary / suggested notes / action items).
 */
export enum AiGenerationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Which side of the call the recording owner was on, as reported by `serviceData.personality`:
 * - `originator`: the owner placed the call (the remote party is `calledParty`).
 * - `terminator`: the owner received the call (the remote party is `callingParty`).
 *
 * Use {@link getRemoteParty} to resolve the other party without having to branch on this manually.
 */
export type RecordingPersonality = 'originator' | 'terminator';

/**
 * The acting entity behind a call party. For Webex users `type` is `USER` and `id` is the Webex
 * person UUID — the identifier accepted by the avatar (`@webex/internal-plugin-avatar`) and
 * presence (DSS) services. External/PSTN parties may have only a `number`/`name` on the parent
 * {@link RecordingParty} and no `actor.id`.
 */
export type RecordingActor = {
  type?: string;
  id?: string;
  email?: string;
};

/**
 * A party (calling or called) involved in the recorded call. `actor.id` is the resolvable person
 * UUID when the party is a Webex user; `number`/`name` are the dialable number and display name.
 */
export type RecordingParty = {
  actor?: RecordingActor;
  number?: string;
  name?: string;
};

/**
 * Service-specific data attached to a converged recording. For calling recordings this carries the
 * `locationId` and the `callSessionId` shared with the originating call session.
 *
 * The party details (`personality`, `callingParty`, `calledParty`) identify who the call was with
 * and are returned by the metadata endpoint (`GET /convergedRecordings/{recordingId}/metadata`);
 * the list endpoint only populates `locationId`/`callSessionId`. Resolve the remote participant's
 * person UUID (for avatar/presence) via `getRemoteParty(serviceData)?.actor?.id`.
 */
export type RecordingServiceData = {
  callRecordingId?: string;
  locationId?: string;
  callSessionId?: string;
  personality?: RecordingPersonality;
  callingParty?: RecordingParty;
  calledParty?: RecordingParty;
  [key: string]: unknown;
};

/**
 * Temporary, direct download links for a recording's media, returned by
 * `GET /convergedRecordings/{recordingId}`. Only available for authorized users / Compliance
 * Officers and absent when downloading is prevented.
 */
export type TemporaryDirectDownloadLinks = {
  audioDownloadLink?: string;
  transcriptDownloadLink?: string;
  expiration?: string;
};

/**
 * A converged recording as returned by `GET /convergedRecordings` (list `items[]`) and
 * `GET /convergedRecordings/{recordingId}`.
 *
 * Field mapping note (matches the public Webex Converged Recordings API):
 *  - `id` is the recording id used by {@link ICallRecording.getRecording}.
 *  - `serviceData.callSessionId` is the call session id used by
 *    {@link ICallRecording.getRecordingsByCallSessionId}.
 */
export type Recording = {
  id: string;
  topic?: string;
  createTime?: string;
  timeRecorded?: string;
  format?: string;
  serviceType?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  status?: RecordingStatus;
  ownerId?: string;
  ownerEmail?: string;
  ownerType?: string;
  storageRegion?: string;
  serviceData?: RecordingServiceData;
  temporaryDirectDownloadLinks?: TemporaryDirectDownloadLinks;
};

/**
 * Raw list response body returned by `GET /convergedRecordings`.
 */
export type RecordingListBody = {
  items?: Recording[];
};

/**
 * Metadata returned by `GET /convergedRecordings/{recordingUUID}/metadata`.
 * The structure is preserved as returned by the backend; optional typed fields are provided
 * for the well-known properties.
 */
export type RecordingMetadataOwner = {
  ownerID?: string;
  ownerEmail?: string;
  ownerName?: string;
  orgID?: string;
};

export type RecordingMetadataParticipant = {
  id?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  joinTime?: string;
  leaveTime?: string;
};

export type RecordingMediaStream = {
  streamId?: string;
  type?: string;
  codec?: string;
  durationMS?: number;
};

export type RecordingExtensionData = {
  callData?: Record<string, unknown>;
  acd?: Record<string, unknown>;
  redirectInfo?: Record<string, unknown>;
};

export type RecordingMetadata = {
  id?: string;
  callSessionId?: string;
  owner?: RecordingMetadataOwner;
  session?: Record<string, unknown>;
  participants?: RecordingMetadataParticipant[];
  mediaStreams?: RecordingMediaStream[];
  extensionData?: RecordingExtensionData;
  /**
   * Service-specific data, including the call party details (`personality`, `callingParty`,
   * `calledParty`) used to resolve the remote participant for avatar/presence. See
   * {@link getRemoteParty}.
   */
  serviceData?: RecordingServiceData;
  [key: string]: unknown;
};

/**
 * Options for {@link ICallRecording.getRecordings}. All fields are optional and are passed through
 * to the recording API as query parameters where supported. `webexUserRequest` toggles the
 * `WebexUserRequest` header (ad-hoc rate-limit bypass), defaulting to `false`.
 */
export type GetRecordingsOptions = {
  /**
   * ISO-8601 start of the time window (inclusive). When omitted, it is derived from `days`
   * (`now - days`), mirroring CallHistory's mandatory `from` date.
   */
  from?: string;
  /**
   * ISO-8601 end of the time window (inclusive). When omitted, it defaults to the current time
   * (`now`). The API requires both `from` and `to` to return results.
   */
  to?: string;
  /**
   * Lookback window in days used to derive `from` when `from` is not provided. Defaults to `30`.
   * The list API only accepts a `from`/`to` interval of at most 30 days; larger windows are
   * rejected, so callers must keep custom values within that limit.
   * Ignored when an explicit `from` is supplied.
   */
  days?: number;
  /** Filter by recording status. Defaults to `available`. */
  status?: RecordingStatus;
  /** Maximum number of records to return per page. Defaults to `30`. */
  max?: number;
  /**
   * Filter by the service that produced the recording (e.g. `'calling'`). Sent only when provided;
   * when omitted the API applies its own default.
   */
  serviceType?: string;
  /** Filter by recording media format (e.g. `'MP3'`, `'MP4'`). Sent only when provided. */
  format?: string;
  /** Filter by recording owner type (e.g. `'user'`). Sent only when provided. */
  ownerType?: string;
  /** Filter by storage region (e.g. `'US'`). Sent only when provided. */
  storageRegion?: string;
  /** Filter by the location id the recording belongs to. Sent only when provided. */
  locationId?: string;
  /** Filter by recording topic. Sent only when provided. */
  topic?: string;
  /** When true, sends the `WebexUserRequest: true` header. Defaults to false. */
  webexUserRequest?: boolean;
};

export type RecordingListResponse = {
  statusCode: number;
  data: {
    recordings?: Recording[];
    error?: string;
  };
  message: string | null;
};

export type RecordingResponse = {
  statusCode: number;
  data: {
    recording?: Recording;
    error?: string;
  };
  message: string | null;
};

export type RecordingMetadataResponse = {
  statusCode: number;
  data: {
    metadata?: RecordingMetadata;
    error?: string;
  };
  message: string | null;
};

export type RecordingDeleteResponse = {
  statusCode: number;
  data: {
    error?: string;
  };
  message: string | null;
};

/**
 * @deprecated Ignored by {@link ICallRecording.deleteRecording}. Retained for backward-compatible
 * signatures only. Compliance permanent delete is not exposed on the CallRecording client.
 */
export type DeleteRecordingOptions = {
  /** Reason for deleting the recording (e.g. `audit`). */
  reason?: string;
  /** Compliance Officer's explanation for the deletion. Max 255 characters. */
  comment?: string;
};

/**
 * Discriminator for {@link GetCallRecordingRequest}. Selects which read operation
 * {@link ICallRecording.getCallRecording} performs based on the request body.
 *
 * - `LIST`: list the current user's recordings.
 * - `DETAIL`: fetch a single recording (with download/playback links).
 * - `METADATA`: fetch a single recording's metadata document.
 * - `BY_CALL_SESSION`: list recordings tied to a call session id (client-side filter).
 */
export enum RecordingRequestType {
  LIST = 'list',
  DETAIL = 'detail',
  METADATA = 'metadata',
  BY_CALL_SESSION = 'byCallSession',
}

/**
 * Lists the current user's converged recordings.
 * Maps to `GET /convergedRecordings` with the query params from {@link GetRecordingsOptions}.
 */
export type ListRecordingsRequest = {
  type: RecordingRequestType.LIST;
  options?: GetRecordingsOptions;
};

/**
 * Fetches a single converged recording by id.
 * Maps to `GET /convergedRecordings/{recordingId}`.
 */
export type DetailRecordingRequest = {
  type: RecordingRequestType.DETAIL;
  recordingId: string;
};

/**
 * Fetches the metadata document for a single recording.
 * Maps to `GET /convergedRecordings/{recordingId}/metadata`.
 */
export type MetadataRecordingRequest = {
  type: RecordingRequestType.METADATA;
  recordingId: string;
};

/**
 * Returns the recordings tied to a call session id (`serviceData.callSessionId`).
 * Fetches a list and filters client-side; `options` widen the scanned set.
 */
export type CallSessionRecordingsRequest = {
  type: RecordingRequestType.BY_CALL_SESSION;
  callSessionId: string;
  options?: GetRecordingsOptions;
};

/**
 * Discriminated union of every read request accepted by {@link ICallRecording.getCallRecording}.
 * The `type` field selects the operation and constrains the rest of the body, while
 * {@link RecordingResponseFor} maps each member to its concrete response type so the caller keeps
 * full type inference from a single method.
 */
export type GetCallRecordingRequest =
  | ListRecordingsRequest
  | DetailRecordingRequest
  | MetadataRecordingRequest
  | CallSessionRecordingsRequest;

/**
 * Maps a {@link GetCallRecordingRequest} member to the response type
 * {@link ICallRecording.getCallRecording} resolves with for that request, preserving per-request
 * return-type inference behind the single method.
 */
export type RecordingResponseFor<T extends GetCallRecordingRequest> =
  T extends DetailRecordingRequest
    ? RecordingResponse
    : T extends MetadataRecordingRequest
    ? RecordingMetadataResponse
    : RecordingListResponse;

/**
 * Interface for the CallRecording client.
 *
 * Provides read access to Post Call Recordings through a single {@link getCallRecording} method
 * (listing, single fetch, lookup by call session, and metadata — selected by the request `type`),
 * moves a recording to the recycle bin (soft delete), and emits recording lifecycle events received
 * over Mercury.
 */
export interface ICallRecording extends Eventing<CallRecordingEventTypes> {
  /**
   * Reads Post Call Recordings. The {@link GetCallRecordingRequest} `type` selects the operation
   * and constrains the rest of the request body; the resolved response type is inferred per
   * request via {@link RecordingResponseFor}:
   *
   * - `LIST` (`GET /convergedRecordings`) -> {@link RecordingListResponse}. The query params come
   *   from {@link GetRecordingsOptions}; both a `from` lower bound (derived from `days` when not
   *   provided) and a `to` upper bound (defaults to `now`) are always sent, because the API only
   *   returns results when the time window is bounded on both ends.
   * - `DETAIL` (`GET /convergedRecordings/{recordingId}`) -> {@link RecordingResponse}.
   * - `METADATA` (`GET /convergedRecordings/{recordingId}/metadata`) ->
   *   {@link RecordingMetadataResponse}.
   * - `BY_CALL_SESSION` -> {@link RecordingListResponse}. The recording API has no confirmed
   *   server-side filter for call session id, so this fetches a list and filters client-side on
   *   `serviceData.callSessionId`. The scan is bounded by the list query, so pass `options` to
   *   widen the time window/status/page when the target session may fall outside the defaults.
   *
   * @param request - The discriminated read request.
   *
   * @example
   * ```javascript
   * const list = await callRecording.getCallRecording({type: RecordingRequestType.LIST, options: {max: 30}});
   * const one = await callRecording.getCallRecording({type: RecordingRequestType.DETAIL, recordingId});
   * const meta = await callRecording.getCallRecording({type: RecordingRequestType.METADATA, recordingId});
   * const bySession = await callRecording.getCallRecording({
   *   type: RecordingRequestType.BY_CALL_SESSION,
   *   callSessionId,
   *   options: {days: 30, max: 100},
   * });
   * ```
   */
  getCallRecording<T extends GetCallRecordingRequest>(request: T): Promise<RecordingResponseFor<T>>;

  /**
   * Moves a recording to the recycle bin (soft delete).
   *
   * Calls `POST /convergedRecordings/softDelete` with `{ recordingIds: [recordingId] }`.
   * The recording can be restored from the recycle bin via the platform restore API. Requires
   * `spark:recordings_write` on the access token (recording owner). Control Hub
   * "Delete recordings and transcripts" enables this for the user; it does **not** grant
   * compliance-officer permanent delete.
   *
   * Mercury emits `convergedRecordings.updated` + `TRASH`, surfaced as `callRecording:deleted`.
   *
   * @param recordingId - The recording id (`id`) to move to the recycle bin.
   * @param _options - Deprecated. Ignored.
   *
   * @example
   * ```javascript
   * await callRecording.deleteRecording(recordingId);
   * ```
   */
  deleteRecording(
    recordingId: string,
    _options?: DeleteRecordingOptions
  ): Promise<RecordingDeleteResponse>;
}
