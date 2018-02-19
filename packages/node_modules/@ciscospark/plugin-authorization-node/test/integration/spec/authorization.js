/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/plugin-authorization-node';
import {nodeOnly} from '@ciscospark/test-helper-mocha';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import {createUser} from '@ciscospark/test-helper-appid';
import CiscoSpark, {filterScope} from '@ciscospark/spark-core';
import uuid from 'uuid';
import sinon from '@ciscospark/test-helper-sinon';

const apiScope = filterScope('spark:kms', process.env.CISCOSPARK_SCOPE);

nodeOnly(describe)('plugin-authorization-node', () => {
  describe('Authorization', () => {
    describe('#logout()', () => {
      let spark, spock;
      beforeEach('create authorized spark user', () => testUsers.create({count: 1})
        .then(([u]) => {
          spock = u;
          spark = new CiscoSpark({credentials: spock.token});
        }));

      it('invalidates all of the use\'s tokens', () => {
        sinon.spy(spark.authorization, 'logout');
        sinon.spy(spark, 'logout');
        return spark.logout()
          .then(() => {
            assert.called(spark.logout);
            assert.called(spark.authorization.logout);
          });
      });
    });

    describe('#requestAccessTokenFromJwt', () => {
      it('exchanges a JWT for an appid access token', () => {
        const userId = uuid.v4();
        const displayName = `test-${userId}`;
        return createUser({displayName, userId})
          .then(({jwt}) => {
            const spark = new CiscoSpark();
            return spark.authorization.requestAccessTokenFromJwt({jwt})
              .then(() => assert.isTrue(spark.canAuthorize));
          });
      });
    });

    describe('\'#refresh', () => {
      describe('when used with an appid access token', () => {
        it('refreshes the access token', () => {
          const userId = uuid.v4();
          const displayName = `test-${userId}`;
          return createUser({displayName, userId})
            .then(({jwt}) => {
              const spark = new CiscoSpark({
                config: {
                  credentials: {
                    jwtRefreshCallback() {
                      return createUser({displayName, userId})
                        .then(({jwt}) => jwt);
                    }
                  }
                }
              });
              let token;
              return spark.authorization.requestAccessTokenFromJwt({jwt})
                .then(() => {
                  token = spark.credentials.supertoken.access_token;
                  assert.isTrue(spark.canAuthorize);
                })
                .then(() => spark.refresh())
                .then(() => {
                  assert.isTrue(spark.canAuthorize);
                  assert.notEqual(spark.credentials.supertoken.access_token, token);
                });
            });
        });
      });
    });

    describe('#requestAuthorizationCodeGrant()', () => {
      describe('when the user has the spark entitlement', () => {
        let code, spark;

        beforeEach('create auth code only test user', () => testUsers.create({config: {authCodeOnly: true}})
          .then(([u]) => {
            spark = new CiscoSpark();
            code = u.token.auth_code;
          }));

        it('exchanges an authorization code for an access token', () => spark.authorization.requestAuthorizationCodeGrant({code})
          .then(() => {
            assert.isDefined(spark.credentials.supertoken);
            return Promise.all([
              spark.credentials.getUserToken(apiScope),
              spark.credentials.getUserToken('spark:kms')
            ]);
          }));
      });

      describe('when the user does not have the spark entitlement', () => {
        let code, spark;
        beforeEach('create non-spark-entitled test user', () => testUsers.create({
          config: {
            // We omit the spark entitlment so that CI gives us a token lacking
            // spark:* scopes
            entitlements: [
              'squaredCallInitiation',
              'squaredRoomModeration',
              'squaredInviter',
              'webExSquared'
            ],
            authCodeOnly: true
          }
        })
          .then(([u]) => {
            spark = new CiscoSpark();
            code = u.token.auth_code;
          }));

        it('exchanges an authorization code for an access token', () => spark.authorization.requestAuthorizationCodeGrant({code})
          .then(() => {
            assert.isDefined(spark.credentials.supertoken);
            return Promise.all([
              spark.credentials.getUserToken(apiScope)
                .then((token) => assert.equal(token.access_token, spark.credentials.supertoken.access_token)),
              spark.credentials.getUserToken('spark:kms')
                .then((token) => assert.equal(token.access_token, spark.credentials.supertoken.access_token))
            ]);
          }));
      });
    });
  });
});
