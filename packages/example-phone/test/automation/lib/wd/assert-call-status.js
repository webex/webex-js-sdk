/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertCallStatus`, function(state) {
  if (!state) {
    throw new Error(`\`state\` is required`);
  }

  return this
    .waitForElementByClassName(`call-status`)
      .text()
        .should.eventually.equal(state);
});
