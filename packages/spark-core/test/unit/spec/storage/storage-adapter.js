/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {MemoryStoreAdapter} from '../../..';

describe(`spark-core`, () => {
  describe(`MemoryStoreAdapter`, () => {
    runAbstractStorageAdapterSpec(MemoryStoreAdapter);
  });
});
