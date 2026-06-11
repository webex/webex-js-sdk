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
 * Service-specific data attached to a converged recording. For calling recordings this carries
 * the `locationId` and the `callSessionId` shared with the originating call session.
 */
export type RecordingServiceData = {
  locationId?: string;
  callSessionId?: string;
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
 * Optional request body for {@link ICallRecording.deleteRecording}. Both fields are only required
 * when a Compliance Officer deletes another user's recording.
 */
export type DeleteRecordingOptions = {
  /** Reason for deleting the recording (e.g. `audit`). */
  reason?: string;
  /** Compliance Officer's explanation for the deletion. Max 255 characters. */
  comment?: string;
};

/**
 * Interface for the CallRecording client.
 *
 * Provides read access to Post Call Recordings (listing, single fetch, lookup by call session,
 * and metadata), permanent deletion of a recording, and emits recording lifecycle events received
 * over Mercury.
 */
export interface ICallRecording extends Eventing<CallRecordingEventTypes> {
  /**
   * Fetches the converged recordings for the current user.
   *
   * Calls `GET /convergedRecordings?from={now-days}&to={now}&status=available&max=30`,
   * with each query param overridable via {@link GetRecordingsOptions}. Both a `from` lower bound
   * (derived from `days` when not provided) and a `to` upper bound (defaults to `now`) are always
   * sent, because the API only returns results when the time window is bounded on both ends.
   *
   * @param options - Optional filters and pagination parameters.
   *
   * @example
   * ```javascript
   * const response = await callRecording.getRecordings({max: 30});
   * ```
   */
  getRecordings(options?: GetRecordingsOptions): Promise<RecordingListResponse>;

  /**
   * Fetches a single converged recording by its UUID.
   *
   * Calls `GET /convergedRecordings/{recordingId}`.
   *
   * @param recordingId - The recording id (`id`).
   *
   * @example
   * ```javascript
   * const response = await callRecording.getRecording(recordingId);
   * ```
   */
  getRecording(recordingId: string): Promise<RecordingResponse>;

  /**
   * Returns all recordings linked to a given call session id (`serviceData.callSessionId`).
   *
   * The recording API has no confirmed server-side filter for call session id, so this fetches a
   * list via {@link getRecordings} and filters client-side. The scan is therefore bounded by the
   * list query: by default only the first `max` recordings within the default time window/status
   * are searched. If the target session may fall outside those defaults (older than the default
   * window, a non-`available` status, or beyond the first page), pass `options` to widen the
   * window/status/page so the recording is included before filtering.
   *
   * @param callSessionId - The call session id to filter by.
   * @param options - Optional list query (time window/filter/pagination) forwarded to
   *   {@link getRecordings} to control the set of recordings scanned.
   *
   * @example
   * ```javascript
   * const response = await callRecording.getRecordingsByCallSessionId(callSessionId, {days: 30, max: 100});
   * ```
   */
  getRecordingsByCallSessionId(
    callSessionId: string,
    options?: GetRecordingsOptions
  ): Promise<RecordingListResponse>;

  /**
   * Fetches the metadata for a single recording.
   *
   * Calls `GET /convergedRecordings/{recordingId}/metadata`.
   *
   * @param recordingId - The recording id (`id`).
   *
   * @example
   * ```javascript
   * const response = await callRecording.getRecordingMetadata(recordingId);
   * ```
   */
  getRecordingMetadata(recordingId: string): Promise<RecordingMetadataResponse>;

  /**
   * Permanently deletes a single recording.
   *
   * Calls `DELETE /convergedRecordings/{recordingId}`. Per the API, the deleted recording
   * **cannot be recovered**; when a Compliance Officer deletes another user's recording it is
   * purged from Webex and becomes inaccessible to all parties. Requires the
   * `spark-compliance:recordings_write` scope on the access token.
   *
   * `options.reason` / `options.comment` are only required when a Compliance Officer deletes
   * another user's recording and are sent as the request body when provided.
   *
   * @param recordingId - The recording id (`id`) to delete.
   * @param options - Optional `reason`/`comment` (Compliance Officer deletions).
   *
   * @example
   * ```javascript
   * await callRecording.deleteRecording(recordingId);
   * await callRecording.deleteRecording(recordingId, {reason: 'audit', comment: 'Maintain data privacy'});
   * ```
   */
  deleteRecording(
    recordingId: string,
    options?: DeleteRecordingOptions
  ): Promise<RecordingDeleteResponse>;
}
