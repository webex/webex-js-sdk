import {callSettingsTests} from '../test-groups/call-settings';

// Account role is resolved from testInfo.project.name → USER_SETS.
// Uses SET_CALL_SETTINGS → USER_1 (single user, WXC backend).
callSettingsTests();
