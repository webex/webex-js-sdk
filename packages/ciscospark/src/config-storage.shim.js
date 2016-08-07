/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {MemoryStoreAdapter} from '@ciscospark/spark-core';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default {
  boundedAdapter: new LocalStorageStoreAdapter(`ciscospark`),
  unboundedAdapter: MemoryStoreAdapter
};
