/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {StorageAdapter} from '../../..';

describe(`spark-core`, () => {
  describe(`StorageAdapter`, () => {
    runAbstractStorageAdapterSpec(StorageAdapter);
  });
});
