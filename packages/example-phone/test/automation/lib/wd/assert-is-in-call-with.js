/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`assertIsInCallWith`, function(participant) {
  const name = participant.name || participant;
  return this
    .waitForElementByClassName(`remote-party-name`)
      .text()
        .should.eventually.equal(name)
    .hasElementByCssSelector(`.self-view video[src]`)
    .hasElementByCssSelector(`.remote-view video[src]`);
});
