/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`clickOnTitle`, function(title) {
  return this
    .waitForElementByCssSelector(`[title="${title}"]`)
      .click();
});
