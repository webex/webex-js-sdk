/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertIsInCall`, function() {
  return this
    .hasElementByCssSelector(`.self-view video[src]`)
    .hasElementByCssSelector(`.remote-view video[src]`);
});
