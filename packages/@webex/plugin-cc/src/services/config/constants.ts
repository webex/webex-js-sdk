// making query params configurable for List Teams and List Aux Codes API
export const DEFAULT_PAGE = 0;
export const DEFAULT_PAGE_SIZE = 100;
export const AGENT_STATE_AVAILABLE_ID = '0';
export const AGENT_STATE_AVAILABLE = 'Available';
export const AGENT_STATE_AVAILABLE_DESCRIPTION = 'Agent is available to receive calls';
export const DEFAULT_TEAM_ATTRIBUTES = ['name', 'id', 'dbId', 'desktopLayoutId'];
export const DEFAULT_AUXCODE_ATTRIBUTES = [
  'id',
  'isSystemCode',
  'name',
  'defaultCode',
  'workTypeCode',
  'active',
];
