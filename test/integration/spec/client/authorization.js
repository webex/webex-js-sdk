/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../lib/landingparty');

describe('Client', function() {
  describe('Credentials', function() {
    describe('Authorization', function() {
      this.timeout(20000);

      var party = {
        spock: true
      };
      var authorization;

      before(landingparty.beamDown.bind(landingparty, party));
      before(function() {
        authorization = party.spock.spark.credentials.authorization;
      });

      describe('#refresh()', function() {
        it('revokes supertoken and child tokens on a refresh', function() {
          var prevSuperToken;
          var prevApiToken;
          var prevKmsToken;
          return authorization.getToken('spark:kms')
            .then(function() {
              assert.isDefined(authorization.supertoken.access_token);
              assert.isDefined(authorization.apiToken.access_token);
              assert.isDefined(authorization.kmsToken.access_token);
              prevSuperToken = authorization.supertoken.access_token;
              prevApiToken = authorization.apiToken.access_token;
              prevKmsToken = authorization.kmsToken.access_token;
              return authorization.refresh()
                .then(function() {
                  assert.isDefined(authorization.supertoken.access_token);
                  assert.isDefined(authorization.apiToken.access_token);
                  assert.isDefined(authorization.kmsToken.access_token);
                  assert.notEqual(authorization.supertoken.access_token, prevSuperToken);
                  assert.notEqual(authorization.apiToken.access_token, prevApiToken);
                  assert.notEqual(authorization.kmsToken.access_token, prevKmsToken);
                });
            });
        });

      });

      describe('#getToken()', function() {
        describe('when called without arguments', function() {
          it('returns the main api token', function() {
            return assert.becomes(authorization.getToken(), authorization.apiToken);
          });
        });

        describe('when called with `spark:kms`', function() {
          it('returns the kms token', function() {
            return assert.becomes(authorization.getToken('spark:kms'), authorization.kmsToken);
          });
        });
      });

      // FYI: omitting the spark entitlement causes CI to give us a token without spark: scopes
      describe('#getToken()', function() {
        describe('when called by a user without the kms scope', function() {
          var redshirt;
          var auth;
          before(function beamDownRedshirt() {
            var userOptions = {
              entitlements: [
                'squaredCallInitiation',
                'squaredRoomModeration',
                'squaredInviter',
                'webExSquared'
              ],
              scopes: process.env.COMMON_IDENTITY_SCOPE.replace('spark:kms', '')
            };
            return landingparty.beamDownRedshirt({createClient: true}, userOptions)
              .then(function(rs) {
                redshirt = rs;
                auth = redshirt.spark.credentials.authorization;
              });
          });

          after(function killRedshirt() {
            return landingparty.killRedshirt(redshirt);
          });

          it('returns the supertoken', function() {
            // remove the kms scope to test that the super token is still returned
            return auth.getToken()
              .then(function(token) {
                // verify that the returned token is the supertoken
                assert.equal(token.access_token, auth.supertoken.access_token);
                // verify that auth.supertoken is defined and length is not 0
                assert.isDefined(auth.supertoken.access_token);
                assert.notEqual(auth.supertoken.access_token.length, 0);
                // kmsToken, apiToken should both be equal
                assert.equal(auth.kmsToken.access_token, auth.apiToken.access_token);
                // Also kmsToken, superToken should both be equal
                assert.equal(auth.kmsToken.access_token, auth.supertoken.access_token);
              });
          });

        });
      });
    });
  });
});
