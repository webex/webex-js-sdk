/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {MemoryStoreAdapter} from '../../..';

describe(`spark-core`, () => {
  describe(`MemoryStoreAdapter`, () => {
    runAbstractStorageAdapterSpec(MemoryStoreAdapter);
  });
});
