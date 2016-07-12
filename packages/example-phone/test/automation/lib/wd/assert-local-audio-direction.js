/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertLocalAudioDirection`, function(direction) {
  if (!direction) {
    throw new Error(`\`direction\` is required`);
  }

  return this
    .waitForElementByCssSelector(`.self-view .audio-direction`)
      .text()
        .should.eventually.equal(direction);
});
