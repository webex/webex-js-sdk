import {test} from '@playwright/test';
import createMultipartyConferenceTests from '../tests/multiparty-conference-test.spec';

test.describe('Multiparty Conference Tests - Set 8', () =>
  createMultipartyConferenceTests(['transferAgent']));
