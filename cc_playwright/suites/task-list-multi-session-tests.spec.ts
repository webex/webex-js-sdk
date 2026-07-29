import {test} from '@playwright/test';
import createTaskListTests from '../tests/tasklist-test.spec';
import createIncomingTaskAndControlsMultiSessionTests from '../tests/incoming-task-and-controls-multi-session.spec';

test.describe('Incoming Task Multi-Session Tests', createIncomingTaskAndControlsMultiSessionTests);
test.describe('Task List Tests', createTaskListTests);
