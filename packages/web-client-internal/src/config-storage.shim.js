/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import LocalForageStoreAdapter from '@ciscospark/storage-adapter-local-forage';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default {
  boundedAdapter: new LocalStorageStoreAdapter(`web-client-internal`),
  unboundedAdapter: new LocalForageStoreAdapter(`web-client-internal`)
};
