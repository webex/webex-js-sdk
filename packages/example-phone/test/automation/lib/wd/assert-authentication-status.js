/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertAuthenticationStatus`, function(status) {
  return this
    .waitForElementByClassName(`authentication-status`)
      .text()
        .should.eventually.become(status);
});
