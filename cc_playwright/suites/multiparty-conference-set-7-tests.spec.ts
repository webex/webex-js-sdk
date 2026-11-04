import {test} from '@playwright/test';
import createMultipartyConferenceTests from '../tests/multiparty-conference-test.spec';

test.describe('Multiparty Conference Tests - Set 7', () =>
  createMultipartyConferenceTests(['lifecycle', 'switch']));
