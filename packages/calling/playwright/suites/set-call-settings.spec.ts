import {callSettingsTests, callSettingsCallTests} from '../test-groups/call-settings';

// Account roles resolved from testInfo.project.name → USER_SETS.
// SET_CALL_SETTINGS: accounts[0] = USER_3 (settings owner), accounts[1] = USER_2 (caller).
callSettingsTests();
callSettingsCallTests();
