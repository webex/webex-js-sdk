/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {MemoryStoreAdapter} from '@ciscospark/spark-core';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default {
  boundedAdapter: new LocalStorageStoreAdapter('ciscospark'),
  unboundedAdapter: MemoryStoreAdapter
};
