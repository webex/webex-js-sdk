/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import retry from '@ciscospark/test-helper-retry';
import {default as Spark, Authorization, grantErrors} from '../../..';
import TestUsersInterface from 'spark-js-sdk--test-users';

describe(`Spark`, function() {
  this.timeout(20000);

  describe(`Plugins`, () => {
    describe(`Credentials`, () => {
      let user;

      afterEach(() => {
        if (!user) {
          return Promise.resolve();
        }

        return TestUsersInterface.remove(user)
          .catch((reason) => {
            console.warn(`Failed to delete test user`, reason.message);
          })
          .then(() => {
            user = undefined;
          });
      });

      describe(`#requestAuthorizationCodeGrant()`, () => {
        beforeEach(() => {
          return TestUsersInterface.create({authCodeOnly: true})
            .then((u) => {
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
        let spark;
        beforeEach(() => {
          return TestUsersInterface.create()
            .then((u) => {
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

    });
  });
});
