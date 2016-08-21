/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Authorization = require('../../../../../src/client/credentials/authorization');
var chai = require('chai');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');

var assert = chai.assert;

describe('Spark', function() {
  describe('Credentials', function() {
    describe('Authorization', function() {

      var authorization;
      var spark;
      beforeEach(function() {
        spark = new MockSpark({
          children: {
            authorization: Authorization
          }
        });

        authorization = spark.authorization;
      });

      describe('#canRefresh', function() {
        it('indicates that the access token can be refreshed', function() {
          assert.isFalse(authorization.canRefresh);
          authorization.supertoken = {
            refresh_token: 'REFRESH TOKEN',
            access_token: 'ACCESS TOKEN'
          };
          assert.isTrue(authorization.canRefresh);
        });
      });

      describe('#isAuthenticated', function() {
        it('indicates the access token is valid or refreshable', function() {
          /* eslint camelcase: [0] */
          assert.isFalse(authorization.isAuthenticated, 1);
          authorization.supertoken = {
            access_token: 'ACCESS TOKEN'
          };
          assert.isTrue(authorization.isAuthenticated, 2);
          authorization.supertoken = {
            refresh_token: 'REFRESH TOKEN',
            access_token: 'ACCESS TOKEN'
          };
          assert.isTrue(authorization.isAuthenticated, 3);
          authorization.supertoken.unset('access_token');
          assert.isTrue(authorization.isAuthenticated, 4);
          authorization.supertoken.unset('refresh_token');

          assert.isFalse(authorization.isAuthenticated, 5);
        });
      });

      describe('#isExpired', function() {
        it('indicates the access token has expired', function() {
          authorization.supertoken = {
            access_token: 'ACCESS TOKEN1'
          };
          assert.isFalse(authorization.isExpired);
          authorization.supertoken.expires = Date.now() - 10000;
          assert.isTrue(authorization.isExpired);
          authorization.supertoken.access_token = 'ACCESS TOKEN2';
          assert.isTrue(authorization.isExpired);
          authorization.supertoken.expires = Date.now() + 10000;
          assert.isFalse(authorization.isExpired);
        });
      });

      describe('#initialize', function() {
        it('computes the expires date if it is not defined');
        it('computes the refresh_token_expires date if it is not defined');
      });

      // Node only

      describe('#refresh', function() {
        it('exchanges a refresh token for an access token if possible', function() {
          assert.isFalse(authorization.canRefresh);
          return assert.isRejected(authorization.refresh(), /Authorization cannot be refreshed/);
        });

        it('allows only one inflight request', function() {
          authorization.refresh_token = 'REFRESH TOKEN';
          sinon.stub(authorization, 'request').returns(Promise.resolve());
          authorization.config.oauth = {};

          var p1 = authorization.refresh();
          assert.instanceOf(p1, Promise);
          var p2 = authorization.refresh();
          assert.instanceOf(p2, Promise);
          assert.equal(p1, p2);
        });
      });

      describe('#revoke()', function() {
        it('does not attempt revocation if this access token has expired', function() {
          authorization.supertoken = {
            access_token: 'ACCESS TOKEN',
            expires: Date.now() - 10000
          };
          assert.isTrue(authorization.isExpired, 0);
          assert.notCalled(spark.request, 1);
          return authorization.revoke()
            .then(function() {
              assert.notCalled(spark.request, 2);
            });
        });

        it('revokes the authorization');

        it('allows only one inflight request', function() {
          authorization.access_token = 'ACCESS TOKEN';
          authorization.expires = Date.now() + 10000;
          authorization.config.oauth = {};

          sinon.stub(authorization, 'request').returns(Promise.resolve());
          var p1 = authorization.revoke();
          assert.instanceOf(p1, Promise);
          var p2 = authorization.revoke();
          assert.instanceOf(p2, Promise);
          assert.equal(p1, p2);
        });
      });

      // Browser

      describe('canRefresh', function() {
        it('returns false for public client');
        it('returns true for confidential client');
      });

    });
  });
});
