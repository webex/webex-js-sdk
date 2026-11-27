/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import WebexCore from '@webex/webex-core';

import validateKMS from '../../../dist/kms-certificate-validation';
import describeCertificateChain from '../../lib/kms-certificate-chain';

describeCertificateChain(
  validateKMS,
  () => new WebexCore({config: {services: {skipPreauthCatalogOnUnauthenticated: true}}})
);
