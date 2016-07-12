/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertLocalVideoDirection`, function(direction) {
  if (!direction) {
    throw new Error(`\`direction\` is required`);
  }

  return this
    .waitForElementByCssSelector(`.self-view .video-direction`)
      .text()
        .should.eventually.equal(direction);
});
