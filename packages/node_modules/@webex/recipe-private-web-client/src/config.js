/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import LocalForageStoreAdapter from '@webex/storage-adapter-local-forage';
import LocalStorageStoreAdapter from '@webex/storage-adapter-local-storage';

export default {
  device: {
    enableInactivityEnforcement: true
  },
  storage: {
    boundedAdapter: new LocalStorageStoreAdapter('web-client-internal'),
    unboundedAdapter: new LocalForageStoreAdapter('web-client-internal')
  }
};
