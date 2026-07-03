import {test} from '@playwright/test';
import createCallTaskControlsTests from '../tests/basic-task-controls-test.spec';
import createAdvanceCombinationsTests from '../tests/advance-task-control-combinations-test.spec';

test.describe('Call Task Controls Tests', createCallTaskControlsTests);
test.describe('Advanced Combinations Tests', createAdvanceCombinationsTests);
