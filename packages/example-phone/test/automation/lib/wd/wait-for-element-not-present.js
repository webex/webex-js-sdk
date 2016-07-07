/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`waitForElementNotPresent`, function(selector) {
  return this
    .hasElementByCssSelector(selector)
      .should.eventually.equal(false);
});
