import {voicemailTests} from '../test-groups/voicemail';

// Account roles resolved from testInfo.project.name -> USER_SETS.
// SET_VOICEMAIL: accounts[0] = USER_1 (caller), accounts[1] = USER_2 (voicemail owner).
voicemailTests();
