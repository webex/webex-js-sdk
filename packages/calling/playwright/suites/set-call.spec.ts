import {callLifecycleTests, callLifecycleMediaTests} from '../test-groups/call-lifecycle';
import {callControlTests, callHoldTests, callHoldErrorTests} from '../test-groups/call-controls';
import {callErrorTests, callEdgeCaseTests} from '../test-groups/call-errors';
import {callKeepaliveTests} from '../test-groups/call-keepalive';

// Each group gets its own fresh browser contexts via beforeAll.
// Account roles resolved from testInfo.project.name → USER_SETS.
callLifecycleTests();
callLifecycleMediaTests();
callKeepaliveTests();
callErrorTests();
callEdgeCaseTests();
callHoldTests();
callHoldErrorTests();
callControlTests();
