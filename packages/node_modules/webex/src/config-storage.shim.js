/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {MemoryStoreAdapter} from '@webex/webex-core';
import LocalStorageStoreAdapter from '@webex/storage-adapter-local-storage';

export default {
  boundedAdapter: new LocalStorageStoreAdapter('webex'),
  unboundedAdapter: MemoryStoreAdapter
};
