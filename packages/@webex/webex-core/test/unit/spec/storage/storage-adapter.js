/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import runAbstractStorageAdapterSpec from '@webex/storage-adapter-spec';
import {MemoryStoreAdapter} from '@webex/webex-core';

describe('webex-core', () => {
  describe('MemoryStoreAdapter', () => {
    runAbstractStorageAdapterSpec(MemoryStoreAdapter);
  });
});
