type Enum<T extends Record<string, unknown>> = T[keyof T];

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
  UPLOAD_LOGS_SUCCESS: 'Upload Logs Success',
  UPLOAD_LOGS_FAILED: 'Upload Logs Failed',
} as const;

// Derive the type using the utility type
export type METRIC_EVENT_NAMES = Enum<typeof METRIC_EVENT_NAMES>;
