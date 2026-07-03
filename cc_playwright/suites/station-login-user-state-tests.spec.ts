import {test} from '@playwright/test';
import createStationLoginTests from '../tests/station-login-test.spec';
import createUserStateTests from '../tests/user-state-test.spec';
import createIncomingTelephonyTaskTests from '../tests/incoming-telephony-task-test.spec';

test.describe('Station Login Tests', createStationLoginTests);
test.describe('User State Tests', createUserStateTests);
test.describe('Incoming Telephony Task Tests', createIncomingTelephonyTaskTests);
