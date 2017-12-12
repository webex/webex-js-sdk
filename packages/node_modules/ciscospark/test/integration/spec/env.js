/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe('ciscospark', function () {
  this.timeout(60000);
  describe('ciscospark/env', () => {
    browserOnly(it)('does not work in web browsers', () => {
      assert.throws(() => {
        // eslint-disable-next-line
        const spark = require(`ciscospark/env`);
      }, /ciscospark\/env cannot be used in browser environments/);
    });

    nodeOnly(describe)('when CISCOSPARK_ACCESS_TOKEN is set', () => {
      let initialEnvToken;
      before(() => testUsers.create({count: 1})
        .then(([user]) => {
          initialEnvToken = process.env.CISCOSPARK_ACCESS_TOKEN;
          process.env.CISCOSPARK_ACCESS_TOKEN = user.token.access_token;
        }));

      after(() => {
        process.env.CISCOSPARK_ACCESS_TOKEN = initialEnvToken;
      });

      it('exports (commonjs-style) an authorized spark instance', () => {
        // eslint-disable-next-line global-require
        const spark = require('ciscospark/env');
        assert.isTrue(spark.canAuthorize);
        return new Promise((resolve) => spark.once('ready', resolve))
          .then(() => assert.isTrue(spark.canAuthorize));
      });
    });
  });
});
