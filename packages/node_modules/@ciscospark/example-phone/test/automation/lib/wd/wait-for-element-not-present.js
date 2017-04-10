/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`waitForElementNotPresent`, function(selector) {
  return this
    .hasElementByCssSelector(selector)
      .should.eventually.equal(false);
});
