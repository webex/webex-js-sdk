export const CALL_RECORDING_FILE = 'CallRecording';

export const SOFT_DELETE = 'softDelete';

export const USERHUB_SERVICE_NAME = 'webex-user-hub-service';
export const USERHUB_RECORDINGS_PATH = 'webappng/api/v1/hub/convergedRecordings';
export const ORDER_TYPE = 'orderType';
export const ORDER_BY = 'orderBy';
export const CATEGORY = 'category';
export const OFFSET = 'offset';
export const LIMIT = 'limit';
export const DEFAULT_ORDER_TYPE = 'DESC';
export const DEFAULT_ORDER_BY = 'appCreateTime';
export const DEFAULT_CATEGORY = 'calling';
export const DEFAULT_OFFSET = '0';

export const STATUS = 'status';

export const DEFAULT_STATUS = 'available';
export const DEFAULT_MAX = 30;

export const WEBEX_USER_REQUEST_HEADER = 'WebexUserRequest';

export const RECORDING_NOT_FOUND_MESSAGE = 'No recordings found for the given call session id.';

export const METHODS = {
  INITIALIZE_BACKEND_CONNECTOR: 'initializeBackendConnector',
  GET_CALL_RECORDING: 'getCallRecording',
  GET_RECORDINGS: 'getRecordings',
  GET_RECORDING: 'getRecording',
  GET_RECORDINGS_BY_CALL_SESSION_ID: 'getRecordingsByCallSessionId',
  GET_RECORDING_METADATA: 'getRecordingMetadata',
  DELETE_RECORDING: 'deleteRecording',
};
