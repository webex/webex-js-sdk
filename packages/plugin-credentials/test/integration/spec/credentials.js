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
          assert.isDefined(spark.credentials.userTokens.get(apiScope));
          assert.isDefined(spark.credentials.userTokens.get(`spark:kms`));
          assert.notEqual(spark.credentials.userTokens.get(`spark:kms`).access_token, supertoken);
          assert.isDefined(spark.credentials.userTokens.get(`spark:kms`));
        }));
    });

    describe(`#requestAuthorizationCodeGrant()`, () => {
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

    describe(`#requestClientCredentialsGrant()`, () => {
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

      afterEach(() => spark.machineAccount.delete(bot)
        .catch(() => spark.machineAccount.delete(bot))
        .catch(() => spark.machineAccount.delete(bot)));

      it(`exchanges oauth secrets for a client token`, () => sparkBot.credentials.requestClientCredentialsGrant(bot)
        .then((token) => assert.isAccessToken(token)));
    });
  });
});
