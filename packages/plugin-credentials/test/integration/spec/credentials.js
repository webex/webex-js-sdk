/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import '@ciscospark/plugin-machine-account';

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import CiscoSpark from '@ciscospark/spark-core';
import {apiScope} from '../..';
import uuid from 'uuid';

describe(`plugin-credentials`, () => {
  describe(`Credentials`, () => {
    describe(`#refresh()`, () => {
      let spark;

      beforeEach(() => testUsers.create({count: 1})
        .then((users) => {
          spark = new CiscoSpark({
            credentials: {
              supertoken: users[0].token
            }
          });
        }));

      let apiToken, kmsToken, supertoken;
      beforeEach(() => {
        supertoken = spark.credentials.supertoken.access_token;
        apiToken = spark.credentials.userTokens.get(apiScope);
        apiToken = apiToken && apiToken.access_token;
        kmsToken = spark.credentials.userTokens.get(`spark:kms`);
        kmsToken = kmsToken && kmsToken.access_token;
      });

      it(`refreshes the supertoken and all child tokens`, () => spark.credentials.refresh()
        .then(() => {
          assert.notEqual(spark.credentials.supertoken.access_token, supertoken);
          assert.isDefined(spark.credentials.userTokens.get(apiScope));
          assert.notEqual(spark.credentials.userTokens.get(apiScope).access_token, apiToken);
          assert.isDefined(spark.credentials.userTokens.get(`spark:kms`));
          assert.notEqual(spark.credentials.userTokens.get(`spark:kms`).access_token, supertoken);
        }));
    });

    describe(`#requestAuthorizationCodeGrant()`, () => {

      describe(`when the user has the spark entitlement`, () => {
        let code, spark;

        beforeEach(() => testUsers.create({config: {authCodeOnly: true}})
          .then(([u]) => {
            spark = new CiscoSpark();
            code = u.token.auth_code;
          }));

        it(`exchanges an authorization code for an access token`, () => spark.credentials.requestAuthorizationCodeGrant({code})
          .then(() => {
            assert.isDefined(spark.credentials.supertoken);
            assert.isDefined(spark.credentials.userTokens.get(apiScope));
            assert.isDefined(spark.credentials.userTokens.get(`spark:kms`));
          }));
      });

      describe(`when the user does not have the spark entitlement`, () => {
        let code, spark;
        beforeEach(() => testUsers.create({
          config: {
            // We omit the spark entitlment so that CI gives us a token lacking
            // spark:* scopes
            entitlements: [
              `squaredCallInitiation`,
              `squaredRoomModeration`,
              `squaredInviter`,
              `webExSquared`
            ],
            authCodeOnly: true
          }
        })
          .then(([u]) => {
            spark = new CiscoSpark();
            code = u.token.auth_code;
          }));

        it(`exchanges an authorization code for an access token`, () => spark.credentials.requestAuthorizationCodeGrant({code})
          .then(() => {
            assert.isDefined(spark.credentials.supertoken);
            assert.isDefined(spark.credentials.userTokens.get(apiScope));
            assert.equal(spark.credentials.userTokens.get(apiScope).access_token, spark.credentials.supertoken.access_token);
            assert.isDefined(spark.credentials.userTokens.get(`spark:kms`));
            assert.equal(spark.credentials.userTokens.get(`spark:kms`).access_token, spark.credentials.supertoken.access_token);
          }));
      });
    });

    describe(`#requestClientCredentialsGrant()`, () => {
      let spark;
      beforeEach(() => {
        spark = new CiscoSpark();
      });

      it(`exchanges oauth secrets for a client token`, () => spark.credentials.requestClientCredentialsGrant()
        .then((token) => assert.isAccessToken(token)));
    });

    describe(`#requestSamlExtensionGrant()`, () => {
      let spark, user;

      beforeEach(() => testUsers.create({count: 1})
        .then((users) => {
          [user] = users;
          spark = new CiscoSpark({
            credentials: {
              supertoken: users[0].token
            }
          });

          return spark.device.register();
        }));

      let bot, sparkBot;
      beforeEach(() => spark.machineAccount.create({
        name: `spark-js-sdk-testbot-${uuid.v4()}`,
        contactEmail: user.email
      })
        .then((b) => {
          bot = b;
          sparkBot = new CiscoSpark();
        }));

      afterEach(() => spark && spark.machineAccount.delete(bot)
        .catch(() => spark.machineAccount.delete(bot))
        .catch(() => spark.machineAccount.delete(bot)));

      it(`exchanges oauth secrets for a client token`, () => sparkBot.credentials.requestSamlExtensionGrant(bot)
        .then(() => {
          assert.isTrue(sparkBot.canAuthorize);
          assert.isTrue(sparkBot.credentials.canAuthorize);
          assert.isTrue(sparkBot.credentials.canRefresh);
        }));
    });
  });
});
