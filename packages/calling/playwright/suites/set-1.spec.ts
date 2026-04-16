import {sdkInitTests} from '../test-groups/sdk-init';
import {registrationLifecycleTests} from '../test-groups/registration-lifecycle';
import {registrationErrorTests} from '../test-groups/registration-errors';

// SDK init runs first (fresh pages per test), then registration lifecycle
// (shared browser context, serial), then error cases (fresh pages).
// Account role is resolved from testInfo.project.name → USER_SETS.
sdkInitTests();
registrationLifecycleTests();
registrationErrorTests();
