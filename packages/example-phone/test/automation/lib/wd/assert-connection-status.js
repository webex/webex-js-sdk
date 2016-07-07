/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertConnectionStatus`, function(status) {
  return this
    .waitForElementByClassName(`connection-status`)
      .text()
        .should.eventually.become(status);
});
