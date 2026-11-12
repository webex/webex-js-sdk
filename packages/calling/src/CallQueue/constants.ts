export const CALL_QUEUE_FILE = 'CallQueue';

export const METHODS = {
  GET_CALL_QUEUE_SETTINGS: 'getCallQueueSettings',
  GET_CALL_QUEUE_NAMES: 'getCallQueueNames',
  UPDATE_CALL_QUEUE_SETTINGS: 'updateCallQueueSettings',
  SYNC_TELEPHONY_CALLS: 'syncTelephonyCalls',
};

export const QUEUES_PATH = 'telephony/config/people/me/settings/queues';
export const QUEUES_CATALOG_PATH = 'telephony/config/queues';
export const SYNC_PATH = 'telephony/calls/sync/invoke';
export const MAX_QUEUE_CATALOG_PAGES = 10;
export const SECONDARY_LINES_PATH = 'telephony/config/people/me/settings/secondaryLines';

export const LINE_OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const UNSUPPORTED_BACKEND_MESSAGE = 'Call queues are supported for Webex Calling cloud only';
