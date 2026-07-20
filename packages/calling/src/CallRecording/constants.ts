export const CALL_RECORDING_FILE = 'CallRecording';

// Recording API (hydra developer API) endpoint segments.
export const CONVERGED_RECORDINGS = 'convergedRecordings';
export const SOFT_DELETE = 'softDelete';
export const METADATA = 'metadata';

// Query parameter keys for the list request.
export const FROM = 'from';
export const TO = 'to';
export const STATUS = 'status';
export const MAX = 'max';
export const SERVICE_TYPE = 'serviceType';
export const FORMAT = 'format';
export const OWNER_TYPE = 'ownerType';
export const STORAGE_REGION = 'storageRegion';
export const LOCATION_ID = 'locationId';
export const TOPIC = 'topic';

// Default list query values.
export const DEFAULT_STATUS = 'available';
export const DEFAULT_MAX = 30;

// Default lookback window (in days) used to derive `from` when the caller does not provide one.
// The Converged Recordings list API only accepts a `from`/`to` interval of at most 30 days, so the
// default must stay within that limit; a larger default window would be rejected by the API.
export const DEFAULT_NUMBER_OF_DAYS = 30;

// Header used to flag an explicit end-user request (rate-limit bypass). Off by default.
export const WEBEX_USER_REQUEST_HEADER = 'WebexUserRequest';

export const RECORDING_NOT_FOUND_MESSAGE = 'No recordings found for the given call session id.';

// Method names (for structured logging).
export const METHODS = {
  INITIALIZE_BACKEND_CONNECTOR: 'initializeBackendConnector',
  GET_CALL_RECORDING: 'getCallRecording',
  GET_RECORDINGS: 'getRecordings',
  GET_RECORDING: 'getRecording',
  GET_RECORDINGS_BY_CALL_SESSION_ID: 'getRecordingsByCallSessionId',
  GET_RECORDING_METADATA: 'getRecordingMetadata',
  DELETE_RECORDING: 'deleteRecording',
};
