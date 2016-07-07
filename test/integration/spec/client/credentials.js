/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var Authorization = require('../../../../src/client/credentials/authorization');
var Token = require('../../../../src/client/credentials/token');
var clone = require('lodash.clone');
var flaky = require('../../../lib/mocha-helpers').flaky;
var grantErrors = require('../../../../src/client/credentials/grant-errors');
var landingparty = require('../../lib/landingparty');
var retry = require('../../lib/retry');
var Spark = require('../../../../src');
var TestUsersInterface = require('spark-js-sdk--test-users');
var uuid = require('uuid');

describe('Client', function() {
  describe('Credentials', function() {
    this.timeout(40000);

    describe('#requestAuthorizationCodeGrant', function() {
      var redshirt;

      beforeEach(function() {
        return TestUsersInterface.create({
          authCodeOnly: true,
          scopes: process.env.COMMON_IDENTITY_SCOPE
        })
          .then(function(rs) {
            assert.property(rs.token, 'auth_code');
            redshirt = rs;
          });
      });

      it('exchanges an authorization code for an access_token', function() {
        var spark = new Spark({
          config: clone(require('../../fixtures/spark-config'))
        });

        return retry(function() {
          return spark.authenticate({code: redshirt.token.auth_code});
        })
          .then(function() {
            assert.instanceOf(spark.credentials.authorization, Authorization);

            assert.property(spark.credentials.authorization, 'supertoken');
            assert.property(spark.credentials.authorization.supertoken, 'access_token');
            assert.property(spark.credentials.authorization.supertoken, 'token_type');
            assert.property(spark.credentials.authorization.supertoken, 'expires');
            assert.property(spark.credentials.authorization.supertoken, 'expires_in');
            assert.property(spark.credentials.authorization.supertoken, 'refresh_token');
            assert.property(spark.credentials.authorization.supertoken, 'refresh_token_expires');
            assert.property(spark.credentials.authorization.supertoken, 'refresh_token_expires_in');
            assert.property(spark.credentials.authorization.supertoken, 'spark');

            assert.property(spark.credentials.authorization, 'apiToken');
            assert.property(spark.credentials.authorization.apiToken, 'access_token');

            assert.property(spark.credentials.authorization, 'kmsToken');
            assert.property(spark.credentials.authorization.kmsToken, 'access_token');

            assert.isDefined(spark.credentials.authorization.spark);
          });
      });
    });

    describe('#requestClientCredentialsGrant', function() {
      var spark;
      beforeEach(function() {
        spark = new Spark({
          config: clone(require('../../fixtures/spark-config'))
        });
      });

      it('requests client credentials using the client\'s client_id and client_secret', function() {
        return spark.credentials.requestClientCredentialsGrant()
          .then(function() {
            assert.instanceOf(spark.credentials.clientAuthorization, Token);
            assert.property(spark.credentials.clientAuthorization, 'access_token');
            assert.property(spark.credentials.clientAuthorization, 'token_type');
            assert.property(spark.credentials.clientAuthorization, 'expires');
            assert.property(spark.credentials.clientAuthorization, 'expires_in');
            assert.property(spark.credentials.clientAuthorization, 'spark');
            assert.isDefined(spark.credentials.clientAuthorization.spark);
          });
      });

      // This is no longer true because we're hard-coding the scope for now.
      // This test will be revisiting once we start keeping track of different
      // credentials for different scopes.
      it.skip('rejects with a meaningful error representation', function() {
        return assert.isRejected(spark.credentials.requestClientCredentialsGrant({scope: 'not-a-scope'}))
          .then(function(error) {
            assert.instanceOf(error, grantErrors.OAuthError);
            assert.instanceOf(error, grantErrors.InvalidScopeError);
          });
      });
    });

    describe('#requestSamlExtensionGrant', function() {
      var party = {
        spock: true
      };

      before(function() {
        return landingparty.beamDown(party);
      });

      flaky(it)('authenticates a machine account', function() {
        var spark;

        return party.spock.spark.bot.create({
          name: 'spark-js-sdk-testbot-' + uuid.v4(),
          contactEmail: party.spock.email
        })
          .then(function(bot) {
            spark = new Spark({
              credentials: bot,
              config: clone(require('../../fixtures/spark-config'))
            });

            return retry(function() {
              return spark.credentials.requestSamlExtensionGrant(bot);
            });
          })
          .then(function() {
            return spark.device.register();
          })
          .then(function() {
            return spark.bot.remove();
          });
      });
    });

    describe('#refresh', function() {
      var party = {
        spock: true
      };

      beforeEach(function() {
        return landingparty.beamDown(party);
      });

      it('refreshes an access token', function() {
        var originalAccessToken = party.spock.spark.credentials.authorization.supertoken.access_token;

        return party.spock.spark.credentials.refresh({force: true})
          .then(function() {
            assert.notEqual(party.spock.spark.credentials.authorization.supertoken.access_token, originalAccessToken);
            assert.equal(party.spock.spark.credentials.authorization.supertoken.previousToken.access_token, originalAccessToken);
          });
      });
    });

  });
});
