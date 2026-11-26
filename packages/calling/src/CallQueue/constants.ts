/** Agent ACD state values used by the REST API. */
export enum ACD_STATE {
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  WRAP_UP = 'WRAP_UP',
}

/** Both REST and Mercury names map to the same public ACD state. */
export const ACD_STATE_VALUES: ReadonlyArray<{state: ACD_STATE; values: readonly string[]}> = [
  {state: ACD_STATE.SIGN_IN, values: [ACD_STATE.SIGN_IN, 'signIn']},
  {state: ACD_STATE.SIGN_OUT, values: [ACD_STATE.SIGN_OUT, 'signOut']},
  {state: ACD_STATE.AVAILABLE, values: [ACD_STATE.AVAILABLE, 'available']},
  {state: ACD_STATE.UNAVAILABLE, values: [ACD_STATE.UNAVAILABLE, 'unavailable']},
  {state: ACD_STATE.WRAP_UP, values: [ACD_STATE.WRAP_UP, 'wrapUp']},
];

/** Mercury topics are queue-specific; retain both topic spellings. */
export enum CALL_QUEUE_MERCURY_EVENT_KEYS {
  TELEPHONY_AGENT_SYNC = 'event:telephony_agents.sync',
  TELEPHONY_AGENT_STATE = 'event:telephony_agents.state',
  TELEPHONY_AGENT_JOIN = 'event:telephony_agents.join',
  TELEPHONY_AGENT_SYNC_SINGULAR = 'event:telephony_agent.sync',
  TELEPHONY_AGENT_STATE_SINGULAR = 'event:telephony_agent.state',
  TELEPHONY_AGENT_JOIN_SINGULAR = 'event:telephony_agent.join',
}

export const SUPPORTED_STATES = new Set<string>(Object.values(ACD_STATE));

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export const WDM_DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;

export const UNSUPPORTED_BACKEND_MESSAGE = 'Call queues are supported for Webex Calling cloud only';
