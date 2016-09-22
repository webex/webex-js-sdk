/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';

describe(`plugin-credentials`, () => {
  describe(`Credentials`, () => {
    describe(`#requestClientCredentialsGrant()`, () => {
      let spark;
      beforeEach(() => {
        spark = new CiscoSpark();
      });

      it(`exchanges oauth secrets for a client token`, () => spark.credentials.requestClientCredentialsGrant()
        .then((token) => {
          console.log(token);
          assert.isAccessToken(token)}));
    });
  });
});
