/**
 * Mobius WebSocket event names for request and response messages
 * Response events follow the pattern: `{request_event}.response`
 */
// eslint-disable-next-line import/prefer-default-export
export enum MOBIUS_SOCKET_MESSAGE_TYPE {
  UNKNOWN = 'UNKNOWN',

  // Registration messages
  REGISTER = 'register',
  REGISTER_RESPONSE = 'register.response',
  UNREGISTER = 'unregister',
  UNREGISTER_RESPONSE = 'unregister.response',
  DEVICE_STATUS = 'device_status',
  DEVICE_STATUS_RESPONSE = 'device_status.response',
  DEVICE_GET = 'device_get',
  DEVICE_GET_RESPONSE = 'device_get.response',
  DEVICE_LIST = 'device_list',
  DEVICE_LIST_RESPONSE = 'device_list.response',

  // Call messages
  CALL_SETUP = 'call_setup',
  CALL_SETUP_RESPONSE = 'call_setup.response',
  CALL_STATE = 'call_state',
  CALL_STATE_RESPONSE = 'call_state.response',
  CALL_STATUS = 'call_status',
  CALL_STATUS_RESPONSE = 'call_status.response',
  CALL_MEDIA = 'call_media',
  CALL_MEDIA_RESPONSE = 'call_media.response',

  // Supplementary services messages
  CALL_HOLD = 'call_hold',
  CALL_HOLD_RESPONSE = 'call_hold.response',
  CALL_RESUME = 'call_resume',
  CALL_RESUME_RESPONSE = 'call_resume.response',
  CALL_TRANSFER = 'call_transfer',
  CALL_TRANSFER_RESPONSE = 'call_transfer.response',

  CALL_DELETE = 'call_delete',
  CALL_DELETE_RESPONSE = 'call_delete.response',
}

/**
 * Reason describing why the Mobius WebSocket disconnected.
 * - `PERMANENT`: socket closed and will not be reconnected automatically.
 * - `TRANSIENT`: socket closed and a reconnect attempt is in progress.
 * - `REPLACED`: socket was replaced by a newer connection.
 */
export enum MOBIUS_SOCKET_DISCONNECT_REASON {
  PERMANENT = 'permanent',
  TRANSIENT = 'transient',
  REPLACED = 'replaced',
}
