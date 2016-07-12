/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`getMainPage`, function() {
  return this
    .get(`http://127.0.0.1:8000`)
    .waitForElementByClassName(`ready`);
});
