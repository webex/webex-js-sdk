import {test} from '@playwright/test';
import createDigitalIncomingTaskAndTaskControlsTests from '../tests/digital-incoming-task-and-task-controls.spec';

test.describe(
  'Digital Incoming and Task Controls Tests',
  createDigitalIncomingTaskAndTaskControlsTests
);
