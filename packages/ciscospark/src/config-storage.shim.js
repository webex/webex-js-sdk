/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {MemoryStoreAdapter} from './lib/storage';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default {
  boundedAdapter: new LocalStorageStoreAdapter(`ciscospark`),
  unboundedAdapter: MemoryStoreAdapter
};
