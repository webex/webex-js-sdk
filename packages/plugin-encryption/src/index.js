/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// Note: There's a bug where if bind gets replayed because of a timeout in which
// the original request eventually completed, there'll be an error indicating
// the key can't be bound (because it already has been). This could be mitigated
// by using Promise.race to resolve replays (as more requests get enqueue for a
// specific action, accept whichever one completes first).

import {registerPlugin} from '@ciscospark/spark-core';
import Encryption from './encryption';
import config from './config';
import EncryptionInterceptor from './interceptor';

import '@ciscospark/plugin-wdm';
import '@ciscospark/plugin-mercury';

registerPlugin(`encryption`, Encryption, {
  interceptors: {
    EncryptionInterceptor: EncryptionInterceptor.create
  },
  config
});

export {default as default} from './encryption';
export {default as KMS} from './kms';
