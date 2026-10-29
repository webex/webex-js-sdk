/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import MockWebex from '@webex/test-helper-mock-webex';
import Encryption from '@webex/internal-plugin-encryption';

import validateKMS from '../../../src/kms-certificate-validation';
import describeCertificateChain from '../../lib/kms-certificate-chain';

describeCertificateChain(validateKMS, () => new MockWebex({children: {encryption: Encryption}}));
