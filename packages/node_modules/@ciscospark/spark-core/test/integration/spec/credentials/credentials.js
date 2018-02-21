/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import Spark from '@ciscospark/spark-core';
import refreshCallback from '@ciscospark/test-helper-refresh-callback';

/* eslint camelcase: [0] */

describe('spark-core', () => {
  describe('Credentials', () => {
    let user;
    before(() => testUsers.create({count: 1})
      .then(([u]) => {
        user = u;
      }));

    describe('#refresh()', () => {
      nodeOnly(it)('refreshes an access token', () => {
        const spark = new Spark({
          credentials: user.token
        });

        return spark.credentials.refresh()
          .then(() => {
            assert.isDefined(user.token.access_token);
            assert.isDefined(spark.credentials.supertoken.access_token);
            assert.notEqual(spark.credentials.supertoken.access_token, user.token.access_token);
          });
      });

      browserOnly(it)('throws without a refresh callback', () => {
        const spark = new Spark({
          credentials: user.token
        });

        return assert.isRejected(spark.credentials.refresh());
      });

      browserOnly(it)('refreshes with a refresh callback', () => {
        const spark = new Spark({
          credentials: user.token,
          config: {
            credentials: {
              refreshCallback
            }
          }
        });

        return spark.credentials.refresh()
          .then(() => {
            assert.isDefined(user.token.access_token);
            assert.isDefined(spark.credentials.supertoken.access_token);
            assert.notEqual(spark.credentials.supertoken.access_token, user.token.access_token);
          });
      });
    });
  });
});
