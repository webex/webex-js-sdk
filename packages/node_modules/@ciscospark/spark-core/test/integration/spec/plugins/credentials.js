/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {createUser} from '@ciscospark/test-helper-appid';
import {assert} from '@ciscospark/test-helper-chai';
import {nodeOnly, browserOnly} from '@ciscospark/test-helper-mocha';
import sinon from '@ciscospark/test-helper-sinon';
import retry from '@ciscospark/test-helper-retry';
import Spark, {Authorization, grantErrors} from '../../..';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

describe(`spark-core`, function() {
  this.timeout(30000);
  describe(`Spark`, () => {

    describe(`Plugins`, () => {
      describe(`Credentials`, () => {
        let user;

        beforeEach(() => {
          return testUsers.create({count: 1})
            .then((users) => {
              user = users[0];
            });
        });

        afterEach(() => {
          user = undefined;
        });

        // Disabled until (a) the server code is tested and (b) the integration
        // environment is configured such that this test works.
        describe.skip(`#requestAccessTokenFromJwt()`, () => {
          let jwt;
          beforeEach(() => createUser({subject: `test-${uuid.v4()}`})
            .then((res) => {
              assert.isDefined(res.jwt);
              jwt = res.jwt;
            }));

          it(`exchanges a JWT for an access token`, () => {
            assert.isDefined(jwt);
            const spark = new Spark();
            const promise = spark.authenticate({jwt});
            return promise
              .then(() => assert.isTrue(spark.isAuthenticated));
          });
        });

        describe(`#requestAuthorizationCodeGrant()`, () => {
          beforeEach(() => {
            return testUsers.create({config: {authCodeOnly: true}})
              .then(([u]) => {
                assert.isObject(u);
                assert.property(u, `token`);
                assert.isObject(u.token);
                assert.property(u.token, `auth_code`);
                user = u;
              });
          });

          it(`exchanges an authorization code for an access_token`, () => {
            const spark = new Spark();

            return retry(() => {
              return spark.authenticate({code: user.token.auth_code});
            })
              .then(() => {
                assert.instanceOf(spark.credentials.authorization, Authorization);
                assert.property(spark.credentials.authorization, `access_token`);
                assert.property(spark.credentials.authorization, `token_type`);
                assert.property(spark.credentials.authorization, `expires`);
                assert.property(spark.credentials.authorization, `expires_in`);
                assert.property(spark.credentials.authorization, `refresh_token`);
                assert.property(spark.credentials.authorization, `refresh_token_expires`);
                assert.property(spark.credentials.authorization, `refresh_token_expires_in`);
                assert.property(spark.credentials.authorization, `spark`);
                assert.isDefined(spark.credentials.authorization.spark);
              });
          });
        });

        describe(`#requestClientCredentialsGrant`, () => {
          let spark;
          beforeEach(() => {
            spark = new Spark();
          });

          it(`requests client credentials using the client\`s client_id and client_secret`, () => {
            return spark.credentials.requestClientCredentialsGrant()
              .then(() => {
                assert.instanceOf(spark.credentials.clientAuthorization, Authorization);
                assert.property(spark.credentials.clientAuthorization, `access_token`);
                assert.property(spark.credentials.clientAuthorization, `token_type`);
                assert.property(spark.credentials.clientAuthorization, `expires`);
                assert.property(spark.credentials.clientAuthorization, `expires_in`);
                assert.property(spark.credentials.clientAuthorization, `spark`);
                assert.isDefined(spark.credentials.clientAuthorization.spark);
              });
          });

          // This is no longer true because we're hard-coding the scope for now.
          // This test will be revisited once we start keeping track of different
          // credentials for different scopes.
          it.skip(`rejects with a meaningful error representation`, () => {
            return assert.isRejected(spark.credentials.requestClientCredentialsGrant({scope: `not-a-scope`}))
              .then((error) => {
                assert.instanceOf(error, grantErrors.OAuthError);
                assert.instanceOf(error, grantErrors.InvalidScopeError);
              });
          });
        });

        describe(`#requestSamlExtensionGrant()`, () => {
          it(`authenticates a machine account`);
        });

        describe(`#refresh()`, () => {
          describe(`when invoked for a spark user`, () => {
            let spark;
            beforeEach(() => {
              return testUsers.create()
                .then(([u]) => {
                  user = u;
                  spark = new Spark({
                    credentials: {
                      authorization: user.token
                    }
                  });
                });
            });

            it(`refreshes an access token`, () => {
              // Make sure the timeout accounts for retries
              this.timeout(retry.timeout(20000));
              const originalAccessToken = spark.credentials.authorization.access_token;
              const originalAuthorization = spark.credentials.authorization;
              return retry(() => {
                return spark.credentials.refresh({force: true})
                  .catch((reason) => {
                    console.warn(`retrying test:`, reason.stack);
                    // If we get a refresh failure, put the original Authorization
                    // back so we can try again.
                    spark.credentials.set(`authorization`, originalAuthorization);
                    return Promise.reject(reason);
                  });
              })
                .then(() => {
                  assert.notEqual(spark.credentials.authorization.access_token, originalAccessToken);
                  assert.equal(spark.credentials.previousAuthorization.access_token, originalAccessToken);
                });
            });
          });

          // Disabled until (a) the server code is tested and (b) the
          // integration environment is configured such that this test works.
          describe.skip(`when invoked for a JWT user`, () => {
            let jwt;
            let id;
            beforeEach(() => {
              id = {subject: `test-${uuid.v4()}`};
            });

            beforeEach(() => createUser(id)
              .then((res) => {
                jwt = res.jwt;
              }));

            it(`refreshes an access token via jwt`, () => {
              const spark = new Spark({
                config: {
                  credentials: {
                    requestJWT() {
                      return createUser(id)
                        .then((res) => {
                          assert.isDefined(res.jwt);
                          return res;
                        });
                    }
                  }
                }
              });

              const promise = spark.authenticate({jwt});
              let originalAccessToken;
              return promise
                .then(() => {
                  assert.isTrue(spark.isAuthenticated);
                  originalAccessToken = spark.credentials.authorization.access_token;
                  return spark.refresh({force: true});
                })
                .then(() => assert.isTrue(spark.isAuthenticated))
                .then(() => assert.notEqual(spark.credentials.authorization.access_token, originalAccessToken));
            });
          });

        });

        describe(`#logout()`, () => {
          describe(`when invoked for an authenticated user`, () => {
            let spark;
            beforeEach(() => {
              return testUsers.create()
                .then(([u]) => {
                  user = u;
                  spark = new Spark({
                    credentials: {
                      authorization: user.token
                    }
                  });
                  spark.credentials._redirect = sinon.spy();
                });
            });

            browserOnly(it)(`revokes the access token`, () => {
              assert.isDefined(spark.credentials.authorization);
              return spark.credentials.logout()
                .then(() => {
                  assert.isUndefined(spark.credentials.authorization);
                  assert.calledOnce(spark.credentials._redirect);
                });
            });

            nodeOnly(it)(`revokes the access token`, () => {
              assert.isDefined(spark.credentials.authorization);
              return spark.credentials.logout()
                .then(() => {
                  assert.isUndefined(spark.credentials.authorization);
                  assert.notCalled(spark.credentials._redirect);
                });
            });

            describe(`when noRedirect: true`, () => {
              it(`revokes the access token, but does not redirect user`, () => {
                assert.isDefined(spark.credentials.authorization);
                return spark.credentials.logout({noRedirect: true})
                .then(() => {
                  assert.isUndefined(spark.credentials.authorization);
                  assert.notCalled(spark.credentials._redirect);
                });
              });
            });

          });

          describe(`when invoked for an unauthenticated user`, () => {
            let spark;
            beforeEach(() => {
              spark = new Spark();
              spark.credentials._redirect = sinon.spy();
            });

            it(`resolves successfully even if supertoken is not defined`, () => {
              assert.isUndefined(spark.credentials.authorization);
              return spark.credentials.logout({noRedirect: true})
                .then(() => {
                  assert.isUndefined(spark.credentials.authorization);
                  assert.notCalled(spark.credentials._redirect);
                });
            });
          });
        });

        describe(`when the api responds with a 401`, () => {
          it(`refreshes the access token`, () => {
            const spark = new Spark({
              credentials: {
                authorization: user.token
              }
            });
            const initialToken = user.token;
            // eslint-disable-next-line camelcase
            spark.credentials.authorization.access_token = `invalid`;
            return spark.request({
              // This is the only environmentally appropriate url available
              // to this test suite.
              uri: `${spark.config.credentials.hydraServiceUrl}/build_info`,
              method: `GET`,
              resource: `build_info`
            })
              .then((res) => {
                assert.equal(res.statusCode, 200);
                assert.notEqual(spark.credentials.authorization.access_token, initialToken);
              });

          });
        });

      });
    });
  });
});
