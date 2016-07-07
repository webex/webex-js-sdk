/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../lib/landingparty');

describe('Client', function() {
  describe('Credentials', function() {
    describe('Token', function() {
      this.timeout(20000);

      var party = {
        spock: true
      };
      var supertoken;

      before(landingparty.beamDown.bind(landingparty, party));
      before(function() {
        supertoken = party.spock.spark.credentials.authorization.supertoken;
      });

      describe('#downscope()', function() {
        it('retrieves an access token with a subset of scopes', function() {
          return supertoken.downscope('spark:kms')
            .then(function(token) {
              assert.notEqual(token.access_token, supertoken.access_token);
              return token.validate();
            })
            .then(function(body) {
              assert.deepEqual(body.scope, ['spark:kms']);
            });
        });
      });

      describe('#refresh()', function() {
        it('refreshes the token', function() {
          return supertoken.refresh()
            .then(function(token) {
              assert.notEqual(token, supertoken);
              assert.notEqual(token.access_token, supertoken.access_token);
              assert.equal(token.refresh_token, supertoken.refresh_token);
              assert.equal(token.previousToken, supertoken);
            });
        });
      });

      describe('#revoke()', function() {
        it('revokes the token', function() {
          return supertoken.refresh()
            .then(function(token) {
              return token.revoke()
                .then(function() {
                  assert.isUndefined(token.access_token);
                  assert.isDefined(token.refresh_token);
                  assert.isUndefined(token.expires_in);
                  assert.isUndefined(token.token_type);
                });
            });
        });
      });

      describe('#toString()', function() {
        it('renders the token as a header', function() {
          assert.equal(supertoken.toString(), 'Bearer ' + supertoken.access_token);
        });
      });

    });
  });
});
