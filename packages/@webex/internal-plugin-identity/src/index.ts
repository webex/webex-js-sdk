/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin} from '@webex/webex-core';

import Identity from './identity';
import config from './config';

registerInternalPlugin('identity', Identity, {config});

export {default} from './identity';
export type {
  CertSigningRequest,
  IdentityCredentials,
  IdentityProvider,
  IdentityTrustAnchors,
} from './types';
