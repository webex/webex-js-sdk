/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {MemoryStoreAdapter} from '@ciscospark/spark-core';

describe('spark-core', () => {
  describe('MemoryStoreAdapter', () => {
    runAbstractStorageAdapterSpec(MemoryStoreAdapter);
  });
});
