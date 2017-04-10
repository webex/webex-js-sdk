/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import runAbstractStorageAdapterSpec from '@ciscospark/storage-adapter-spec';
import {skipInNode} from '@ciscospark/test-helper-mocha';
import StorageAdapterLocalStorage from '../..';

skipInNode(describe)(`StorageAdapterLocalStorage`, () => {
  runAbstractStorageAdapterSpec(new StorageAdapterLocalStorage(`test`));
});
