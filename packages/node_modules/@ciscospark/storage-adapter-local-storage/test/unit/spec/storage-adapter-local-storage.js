/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {skipInNode} from '@ciscospark/test-helper-mocha';
import StorageAdapterLocalStorage from '@ciscospark/storage-adapter-local-storage';

skipInNode(describe)('StorageAdapterLocalStorage', () => {
  runAbstractStorageAdapterSpec(new StorageAdapterLocalStorage('test'));
});
