/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import Spark, {filterScope} from '@ciscospark/spark-core';
import refreshCallback from '@ciscospark/test-helper-refresh-callback';

/* eslint camelcase: [0] */

describe('spark-core', () => {
  describe('Credentials', () => {
    describe('Token', () => {
      let spark, user;
      before(() => testUsers.create({count: 1})
        .then(([u]) => {
          user = u;
        }));

      describe('#downscope()', () => {
        it('retrieves an access token with a subset of scopes', () => {
          spark = new Spark({credentials: user.token});
          const allScope = spark.credentials.config.scope;
          const apiScope = filterScope('spark:kms', allScope);

          return spark.credentials.supertoken.downscope('spark:kms')
            .then((downscopedToken) => downscopedToken.validate())
            .then((details) => assert.deepEqual(details.scope, ['spark:kms']))
            .then(() => spark.credentials.supertoken.downscope(apiScope))
            .then((downscopedToken) => downscopedToken.validate())
            .then((details) => assert.sameMembers(details.scope, apiScope.split(' ')))
            .then(() => assert.isRejected(spark.credentials.supertoken.downscope(allScope), /token: scope reduction requires a reduced scope/));
        });
      });

      describe('#refresh()', () => {
        nodeOnly(it)('refreshes the token, returning a new Token instance', () => {
          spark = new Spark({credentials: user.token});
          return spark.credentials.supertoken.refresh()
            .then((token2) => {
              assert.notEqual(token2.access_token, spark.credentials.supertoken.access_token);
              assert.equal(token2.refresh_token, spark.credentials.supertoken.refresh_token);
            });
        });

        browserOnly(it)('refreshes the token, returning a new Token instance', () => {
          spark = new Spark({
            credentials: user.token,
            config: {
              credentials: {
                refreshCallback
              }
            }
          });

          return spark.credentials.supertoken.refresh()
            .then((token2) => {
              assert.notEqual(token2.access_token, spark.credentials.supertoken.access_token);
              assert.equal(token2.refresh_token, spark.credentials.supertoken.refresh_token);
            });
        });
      });

      describe('#validate()', () => {
        it('shows the token\'s scopes', () => {
          spark = new Spark({credentials: user.token});
          return spark.credentials.supertoken.validate()
            .then((details) => {
              const detailScope = details.scope.sort();
              const localScope = spark.credentials.config.scope.split(' ').sort();
              assert.sameMembers(detailScope, localScope);
              assert.lengthOf(detailScope, localScope.length);
              assert.equal(details.clientId, spark.credentials.config.client_id);
            });
        });
      });

      // These tests have a bit of shared state, so revoke() needs to go last
      describe('#revoke()', () => {
        it('revokes the token', () => {
          spark = new Spark({credentials: user.token});
          return spark.credentials.supertoken.revoke()
            .then(() => {
              assert.isUndefined(spark.credentials.supertoken.access_token);
              assert.isDefined(spark.credentials.supertoken.refresh_token);
              assert.isUndefined(spark.credentials.supertoken.expires_in);
            });
        });
      });
    });
  });
});
