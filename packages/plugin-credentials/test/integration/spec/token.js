/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import CiscoSpark from '@ciscospark/spark-core';

describe(`plugin-credentials`, function() {
  describe(`Token`, () => {
    this.timeout(30000);

    let spark, supertoken;

    beforeEach(() => testUsers.create({count: 1})
      .then((users) => {
        assert.isDefined(users[0].token);
        spark = new CiscoSpark({
          credentials: {
            supertoken: users[0].token
          }
        });

        assert.isDefined(spark.credentials.supertoken);

        supertoken = spark.credentials.supertoken;
      }));

    describe(`#downscope()`, () => {
      it(`retrieves an access token with a subset of scopes`, () => supertoken.downscope(`spark:kms`)
        .then((token) => token.validate())
        .then((result) => assert.deepEqual(result.scope, [`spark:kms`])));
    });

    describe(`#refresh()`, () => {
      it(`refreshes the token, returning a new Token instance`, () => supertoken.refresh()
        .then((token) => {
          assert.notEqual(token.access_token, supertoken.access_token);
          assert.equal(token.refresh_token, supertoken.refresh_token);
        }));
    });

    describe(`#revoke()`, () => {
      it(`revokes the token`, () => supertoken.revoke()
        .then(() => {
          assert.isUndefined(supertoken.access_token);
          assert.isDefined(supertoken.refresh_token);
          assert.isUndefined(supertoken.expires_in);
        }));
    });
  });
});
