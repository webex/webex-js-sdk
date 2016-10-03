/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {skipInNode} from '@ciscospark/test-helper-mocha';
import StorageAdapterLocalForage from '../..';

skipInNode(describe)(`StorageAdapterLocalStorage`, () => {
  runAbstractStorageAdapterSpec(new StorageAdapterLocalForage(`test`));
});
