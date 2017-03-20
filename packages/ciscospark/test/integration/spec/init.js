/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import ciscospark from '../..';

describe(`ciscospark`, function() {
  this.timeout(60000);
  describe(`.init`, () => {
    let user;
    before(() => testUsers.create({count: 1})
      .then(([u]) => {user = u;}));

    it(`creates a new authenticated spark instance`, () => {
      /* eslint camelcase: [0] */
      const spark = ciscospark.init({
        credentials: {
          authorization: {
            access_token: user.token.access_token
          }
        }
      });

      assert.isDefined(spark.config.hydraServiceUrl);

      assert.property(spark, `credentials`);
      assert.property(spark.credentials, `authorization`);
      assert.property(spark.credentials.authorization, `access_token`);
      assert.isDefined(spark.credentials.authorization.access_token);
      assert.isAbove(spark.credentials.authorization.access_token.length, 0);

      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/rooms`
      })
        .then((res) => {
          assert.statusCode(res, 200);
        });
    });

    it(`creates a new authenticated spark instance via shorthand credentials`, () => {
      /* eslint camelcase: [0] */
      const spark = ciscospark.init({
        credentials: user.token
      });

      assert.isDefined(spark.config.hydraServiceUrl);

      assert.property(spark, `credentials`);
      assert.property(spark.credentials, `authorization`);
      assert.property(spark.credentials.authorization, `access_token`);
      assert.isDefined(spark.credentials.authorization.access_token);
      assert.isAbove(spark.credentials.authorization.access_token.length, 0);

      return spark.request({
        uri: `${spark.config.hydraServiceUrl}/rooms`
      })
        .then((res) => {
          assert.statusCode(res, 200);
        });
    });

  });
});
