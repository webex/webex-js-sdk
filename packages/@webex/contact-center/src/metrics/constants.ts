type Enum<T extends Record<string, unknown>> = T[keyof T];

/**
 * @ignore
 * @module METRIC_EVENT_NAMES
 * @export
 * @description
 * A constant object containing all metric event names used for tracking various agent and task-related events
 * within the Contact Center plugin. Each property represents a specific event and its corresponding string value
 * as reported in metrics.
 *
 * @property {string} STATION_LOGIN_SUCCESS - Event name for successful station login.
 * @property {string} STATION_LOGIN_FAILED - Event name for failed station login.
 * @property {string} STATION_LOGOUT_SUCCESS - Event name for successful station logout.
 * @property {string} STATION_LOGOUT_FAILED - Event name for failed station logout.
 * @property {string} STATION_RELOGIN_SUCCESS - Event name for successful station relogin.
 * @property {string} STATION_RELOGIN_FAILED - Event name for failed station relogin.
 * @property {string} AGENT_STATE_CHANGE_SUCCESS - Event name for successful agent state change.
 * @property {string} AGENT_STATE_CHANGE_FAILED - Event name for failed agent state change.
 * @property {string} FETCH_BUDDY_AGENTS_SUCCESS - Event name for successfully fetching buddy agents.
 * @property {string} FETCH_BUDDY_AGENTS_FAILED - Event name for failed attempt to fetch buddy agents.
 * @property {string} WEBSOCKET_REGISTER_SUCCESS - Event name for successful websocket registration.
 * @property {string} WEBSOCKET_REGISTER_FAILED - Event name for failed websocket registration.
 * @property {string} AGENT_RONA - Event name for agent RONA (Ring No Answer).
 * @property {string} AGENT_CONTACT_ASSIGN_FAILED - Event name for failed agent contact assignment.
 * @property {string} AGENT_INVITE_FAILED - Event name for failed agent invite.
 *
 * @property {string} TASK_ACCEPT_SUCCESS - Event name for successful task acceptance.
 * @property {string} TASK_ACCEPT_FAILED - Event name for failed task acceptance.
 * @property {string} TASK_DECLINE_SUCCESS - Event name for successful task decline.
 * @property {string} TASK_DECLINE_FAILED - Event name for failed task decline.
 * @property {string} TASK_END_SUCCESS - Event name for successful task end.
 * @property {string} TASK_END_FAILED - Event name for failed task end.
 * @property {string} TASK_WRAPUP_SUCCESS - Event name for successful task wrap-up.
 * @property {string} TASK_WRAPUP_FAILED - Event name for failed task wrap-up.
 * @property {string} TASK_HOLD_SUCCESS - Event name for successful task hold.
 * @property {string} TASK_HOLD_FAILED - Event name for failed task hold.
 * @property {string} TASK_RESUME_SUCCESS - Event name for successful task resume.
 * @property {string} TASK_RESUME_FAILED - Event name for failed task resume.
 *
 * @property {string} TASK_CONSULT_START_SUCCESS - Event name for successful consult start.
 * @property {string} TASK_CONSULT_START_FAILED - Event name for failed consult start.
 * @property {string} TASK_CONSULT_END_SUCCESS - Event name for successful consult end.
 * @property {string} TASK_CONSULT_END_FAILED - Event name for failed consult end.
 * @property {string} TASK_TRANSFER_SUCCESS - Event name for successful task transfer.
 * @property {string} TASK_TRANSFER_FAILED - Event name for failed task transfer.
 * @property {string} TASK_RESUME_RECORDING_SUCCESS - Event name for successful resume of recording.
 * @property {string} TASK_RESUME_RECORDING_FAILED - Event name for failed resume of recording.
 * @property {string} TASK_PAUSE_RECORDING_SUCCESS - Event name for successful pause of recording.
 * @property {string} TASK_PAUSE_RECORDING_FAILED - Event name for failed pause of recording.
 * @property {string} TASK_ACCEPT_CONSULT_SUCCESS - Event name for successful consult acceptance.
 * @property {string} TASK_ACCEPT_CONSULT_FAILED - Event name for failed consult acceptance.
 *
 * @property {string} TASK_OUTDIAL_SUCCESS - Event name for successful outdial task.
 * @property {string} TASK_OUTDIAL_FAILED - Event name for failed outdial task.
 *
 * @property {string} UPLOAD_LOGS_SUCCESS - Event name for successful log upload.
 * @property {string} UPLOAD_LOGS_FAILED - Event name for failed log upload.
 * @property {string} WEBSOCKET_DEREGISTER_SUCCESS - Event name for successful websocket deregistration.
 * @property {string} WEBSOCKET_DEREGISTER_FAIL - Event name for failed websocket deregistration.
 *
 * @property {string} AGENT_DEVICE_TYPE_UPDATE_SUCCESS - Event name for successful agent device type update.
 * @property {string} AGENT_DEVICE_TYPE_UPDATE_FAILED - Event name for failed agent device type update.
 *
 * @readonly
 */
export const METRIC_EVENT_NAMES = {
  STATION_LOGIN_SUCCESS: 'Station Login Success',
  STATION_LOGIN_FAILED: 'Station Login Failed',
  STATION_LOGOUT_SUCCESS: 'Station Logout Success',
  STATION_LOGOUT_FAILED: 'Station Logout Failed',
  STATION_RELOGIN_SUCCESS: 'Station Relogin Success',
  STATION_RELOGIN_FAILED: 'Station Relogin Failed',
  AGENT_STATE_CHANGE_SUCCESS: 'Agent State Change Success',
  AGENT_STATE_CHANGE_FAILED: 'Agent State Change Failed',
  FETCH_BUDDY_AGENTS_SUCCESS: 'Fetch Buddy Agents Success',
  FETCH_BUDDY_AGENTS_FAILED: 'Fetch Buddy Agents Failed',
  WEBSOCKET_REGISTER_SUCCESS: 'Websocket Register Success',
  WEBSOCKET_REGISTER_FAILED: 'Websocket Register Failed',
  AGENT_RONA: 'Agent RONA',
  AGENT_CONTACT_ASSIGN_FAILED: 'Agent Contact Assign Failed',
  AGENT_INVITE_FAILED: 'Agent Invite Failed',

  // Basic Tasks
  TASK_ACCEPT_SUCCESS: 'Task Accept Success',
  TASK_ACCEPT_FAILED: 'Task Accept Failed',
  TASK_DECLINE_SUCCESS: 'Task Decline Success',
  TASK_DECLINE_FAILED: 'Task Decline Failed',
  TASK_END_SUCCESS: 'Task End Success',
  TASK_END_FAILED: 'Task End Failed',
  TASK_WRAPUP_SUCCESS: 'Task Wrapup Success',
  TASK_WRAPUP_FAILED: 'Task Wrapup Failed',
  TASK_HOLD_SUCCESS: 'Task Hold Success',
  TASK_HOLD_FAILED: 'Task Hold Failed',
  TASK_RESUME_SUCCESS: 'Task Resume Success',
  TASK_RESUME_FAILED: 'Task Resume Failed',

  // Advanced Tasks
  TASK_CONSULT_START_SUCCESS: 'Task Consult Start Success',
  TASK_CONSULT_START_FAILED: 'Task Consult Start Failed',
  TASK_CONSULT_END_SUCCESS: 'Task Consult End Success',
  TASK_CONSULT_END_FAILED: 'Task Consult End Failed',
  TASK_TRANSFER_SUCCESS: 'Task Transfer Success',
  TASK_TRANSFER_FAILED: 'Task Transfer Failed',
  TASK_RESUME_RECORDING_SUCCESS: 'Task Resume Recording Success',
  TASK_RESUME_RECORDING_FAILED: 'Task Resume Recording Failed',
  TASK_PAUSE_RECORDING_SUCCESS: 'Task Pause Recording Success',
  TASK_PAUSE_RECORDING_FAILED: 'Task Pause Recording Failed',
  TASK_ACCEPT_CONSULT_SUCCESS: 'Task Accept Consult Success',
  TASK_ACCEPT_CONSULT_FAILED: 'Task Accept Consult Failed',

  TASK_OUTDIAL_SUCCESS: 'Task Outdial Success',
  TASK_OUTDIAL_FAILED: 'Task Outdial Failed',

  UPLOAD_LOGS_SUCCESS: 'Upload Logs Success',
  UPLOAD_LOGS_FAILED: 'Upload Logs Failed',
  WEBSOCKET_DEREGISTER_SUCCESS: 'Websocket Deregister Success',
  WEBSOCKET_DEREGISTER_FAIL: 'Websocket Deregister Failed',

  // WebSocket message events
  WEBSOCKET_EVENT_RECEIVED: 'Websocket Event Received',

  AGENT_DEVICE_TYPE_UPDATE_SUCCESS: 'Agent Device Type Update Success',
  AGENT_DEVICE_TYPE_UPDATE_FAILED: 'Agent Device Type Update Failed',
} as const;

/**
 * Represents the possible metric event names used within the metrics system.
 *
 * This type is derived from the keys of the `METRIC_EVENT_NAMES` constant, ensuring
 * type safety and consistency when referring to metric event names throughout the codebase.
 * @export
 * @typedef {Enum<typeof METRIC_EVENT_NAMES>} METRIC_EVENT_NAMES
 * @typeParam T - The type of the `METRIC_EVENT_NAMES` constant.
 *
 * @see {@link METRIC_EVENT_NAMES}
 */
export type METRIC_EVENT_NAMES = Enum<typeof METRIC_EVENT_NAMES>;
