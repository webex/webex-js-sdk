import {registerInternalPlugin} from '@webex/webex-core';

import Identity from './identity';
import config from './config';

registerInternalPlugin('identity', Identity, {config});

export {default} from './identity';
export type {CertSigningRequest, IdentityCredentials, IdentityTrustAnchors} from './types';
