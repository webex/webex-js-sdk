import {callLifecycleTests, callLifecycleMediaTests} from '../test-groups/call-lifecycle';
import {callControlTests, callHoldTests, callHoldErrorTests} from '../test-groups/call-controls';
import {callErrorTests, callEdgeCaseTests} from '../test-groups/call-errors';
import {callKeepaliveTests} from '../test-groups/call-keepalive';
import {callHistoryTests} from '../test-groups/call-history';

// Each group gets its own fresh browser contexts via beforeAll.
// Account roles resolved from testInfo.project.name → USER_SETS.
callLifecycleTests();
callLifecycleMediaTests();
callHistoryTests();
callKeepaliveTests();
callErrorTests();
callEdgeCaseTests();
callHoldTests();
callHoldErrorTests();
callControlTests();
