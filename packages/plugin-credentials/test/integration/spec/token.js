/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-credentials`, function() {
  describe(`Token`, () => {
    this.timeout(20000);

    describe(`#downscope()`, () => {
      it(`retrieves an access token with a subset of scopes`);
    });

    describe(`#refresh()`, () => {
      it(`refreshes the token, returning a new Token instance`);
    });

    describe(`#revoke()`, () => {
      it(`revokes the token`);
    });
  });
});
