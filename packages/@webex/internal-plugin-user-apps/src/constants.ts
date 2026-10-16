export const USER_APPS_SERVICE = 'userApps';
export const SECTIONS_APP = 'sections';
export const DERIVED_SECTIONS_PREFIX = `${SECTIONS_APP}_`;
export const FAVORITES_SECTION_ID = 'FAVORITES';
export const OTHER_SECTION_ID = 'OTHER';

export const USER_APP_ITEM_EVENT = 'event:user.app_item';
export const USER_APP_METADATA_EVENT = 'event:user.app_metadata';
export const USER_APPS_SECTIONS_CHANGED = 'user-apps:sections-changed';
export const USER_APPS_SYNC_ERROR = 'user-apps:sync-error';
export const USER_APPS_REGISTERED = 'user-apps:registered';
export const USER_APPS_UNREGISTERED = 'user-apps:unregistered';

export const CATCHUP_RESOURCE = '/catchup';
export const HIGH_WATER_HEADER = 'x-cisco-enddate';
export const RECOVERABLE_CATCHUP_STATUS_CODES = new Set([400, 413]);

export const DEFAULT_SECTION_ORDER = [FAVORITES_SECTION_ID, OTHER_SECTION_ID];

export const USER_APP_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;
