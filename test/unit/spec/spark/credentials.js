/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Credentials = require('../../../../src/client/credentials');
var MockSpark = require('../../lib/mock-spark');
var Authorization = require('../../../../src/client/credentials/authorization');
var delay = require('../../../lib/delay');
var sinon = require('sinon');
var skipInBrowser = require('../../../lib/mocha-helpers').skipInBrowser;

var assert = chai.assert;

describe('Spark', function() {
  describe('Credentials', function() {

    var credentials;
    var spark;
    beforeEach(function() {
      spark = new MockSpark({
        children: {
          credentials: Credentials
        }
      });
      spark.config.credentials.clientType = 'confidential';

      credentials = spark.credentials;
    });

    describe('#canRefresh', function() {
      it('proxies to #authorization.canRefresh', function() {
        /* eslint camelcase: [0] */
        assert.isFalse(credentials.canRefresh, 'Cannot refresh without refresh token');
        credentials.authorization = new Authorization({
          supertoken: {
            refresh_token: 'REFRESH TOKEN',
            access_token: 'ACCESS TOKEN'
          }
        }, {parent: spark});
        assert.isTrue(credentials.canRefresh, 'Can refresh when refresh token is set');
      });
    });

    describe('#isAuthenticated', function() {
      it('proxies to #authorization.isAuthenticated', function() {
        /* eslint camelcase: [0] */
        assert.isFalse(credentials.isAuthenticated, 'Credentials is not authenticated when authorization is not set');

        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN'
          }
        }, {parent: spark});
        assert.isTrue(credentials.isAuthenticated, 'Credentials is authenticated when access token is set and there is no expires date');

        credentials.authorization = new Authorization({
          supertoken: {
            refresh_token: 'REFRESH TOKEN',
            access_token: 'ACCESS TOKEN'
          }
        }, {parent: spark});
        assert.isTrue(credentials.isAuthenticated, 'Credentials is authenticated even if only a refresh token is set');

        credentials.authorization.supertoken.unset('refresh_token');
        credentials.authorization.supertoken.unset('access_token');
        assert.isFalse(credentials.isAuthenticated, 'Credentials is not authenticated if neither token is set');
      });
    });

    describe('#isExpired', function() {
      it('proxies to #authorization.isExpired', function() {
        assert.isFalse(credentials.isExpired, '`Credentials` is not expired when no authorization is set');

        credentials.authorization = new Authorization({
          supertoken: {
            expires: Date.now() - 10000,
            access_token: 'ACCESS TOKEN'
          }
        }, {parent: spark});

        assert.isTrue(credentials.isExpired, '`Credentials` is expired when authorization `expires` is before now');

        credentials.authorization.supertoken.expires = Date.now() + 10000;
        assert.isFalse(credentials.isExpired, '`Credentials` is not expired when authorization `expires` is after now');
      });
    });

    describe('#getAuthorization()', function() {
      it('resolves with a string containing a Bearer token', function() {

        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            token_type: 'Bearer',
            expires: Date.now() + 10000
          },
          apiToken: {
            access_token: 'ACCESS TOKEN',
            token_type: 'Bearer',
            expires: Date.now() + 10000
          }
        }, {parent: spark});

        sinon.spy(credentials, 'refresh');

        return assert.becomes(credentials.getAuthorization(), 'Bearer ACCESS TOKEN')
          .then(function() {
            assert.notCalled(credentials.refresh);
          });
      });

      it('rejects if the token cannot be refreshed', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            token_type: 'Bearer',
            expires: Date.now() - 10000
          }
        }, {parent: spark});

        sinon.spy(credentials, 'refresh');

        return assert.isRejected(credentials.getAuthorization(), /Access token has expired or cannot be refreshed/)
          .then(function() {
            assert.notCalled(credentials.refresh);
          });
      });

      it('rejects if no refresh token or access token is available', function() {
        sinon.spy(credentials, 'refresh');

        return assert.isRejected(credentials.getAuthorization(), /not authenticated/)
          .then(function() {
            assert.notCalled(credentials.refresh);
          });
      });

      it('triggers a refresh if the token has expired and can be refreshed', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            refresh_token: 'REFRESH TOKEN',
            token_type: 'Bearer',
            expires: Date.now() - 10000
          }
        }, {parent: spark});

        sinon.stub(credentials, 'refresh').returns(Promise.resolve({}));

        return assert.isFulfilled(credentials.getAuthorization())
          .then(function() {
            assert.called(credentials.refresh);
          });
      });

      it('allows only one inflight request', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            expires: Date.now() + 10000
          }
        }, {parent: spark});

        var p1 = credentials.getAuthorization();
        assert.instanceOf(p1, Promise);
        var p2 = credentials.getAuthorization();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    describe('#refresh()', function() {
      it('proxies to #authorization.refresh()', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            expires: Date.now() - 10000
          }
        }, {parent: spark});

        sinon.stub(credentials.authorization, 'refresh').returns(Promise.resolve());

        credentials.refresh();
        assert.called(credentials.authorization.refresh);
      });

      it('allows only one inflight request', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            refresh_token: 'REFRESH TOKEN',
            expires: Date.now() - 10000
          }
        }, {parent: spark});

        sinon.stub(credentials.authorization, 'refresh').returns(Promise.resolve({}));

        var p1 = credentials.refresh();
        assert.instanceOf(p1, Promise);
        var p2 = credentials.refresh();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    // Node Only
    // FIXME this should work in browsers, but I don't have time to fix it right now
    skipInBrowser(describe)('#authenticate()', function() {
      beforeEach(function() {
        sinon.stub(credentials, 'requestSamlExtensionGrant').returns(Promise.resolve({}));
        sinon.stub(credentials, 'requestAuthorizationCodeGrant').returns(Promise.resolve({}));
        sinon.stub(credentials, 'refresh').returns(Promise.resolve({}));
      });

      it('invokes #requestAuthorizationCodeGrant() if a code is provided', function() {
        credentials.authenticate({
          code: 'code',
          scope: 'scope'
        });

        assert.called(credentials.requestAuthorizationCodeGrant);
      });

      skipInBrowser(it)('invokes refresh if the current credentials are refreshable', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            refresh_token: 'REFRESH TOKEN',
            access_token: 'ACCESS TOKEN'
          }
        }, {parent: spark});

        credentials.authenticate();
        assert.called(credentials.refresh);
      });

      it('invokes #requestSamlExtensionGrant() if name, orgId, and password are available', function() {
        credentials.authenticate({
          name: 'name',
          orgId: 'orgId',
          password: 'password'
        });
        assert.called(credentials.requestSamlExtensionGrant);
      });

      it('sets `this.name`, `this.orgId`, and `this.password`', function() {
        credentials.set({
          name: 'name',
          orgId: 'orgId',
          password: 'password'
        });
        credentials.authenticate();
        assert.called(credentials.requestSamlExtensionGrant);
      });

      skipInBrowser(it)('rejects if no credentials are specified', function() {
        return assert.isRejected(credentials.authenticate(), /not enough parameters to authenticate/);
      });

      it('allows only one inflight request', function() {
        sinon.stub(credentials, 'request').returns(Promise.resolve());
        var p1 = credentials.authenticate();
        assert.instanceOf(p1, Promise);
        var p2 = credentials.authenticate();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    describe('#requestAuthorizationCodeGrant()', function() {
      it('requires a `code` option', function() {
        return assert.isRejected(credentials.requestAuthorizationCodeGrant({scope: 'scope'}), /`options.code` is required/);
      });

      it('allows only one inflight request', function() {
        sinon.stub(credentials, 'request').returns(Promise.resolve());
        credentials.config.oauth = {};
        var p1 = credentials.requestAuthorizationCodeGrant();
        assert.instanceOf(p1, Promise);
        var p2 = credentials.requestAuthorizationCodeGrant();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    describe('#_getSamlBearerToken()', function() {
      it('requires `this.orgId`', function() {
        return assert.isRejected(credentials._getSamlBearerToken(), /`this.orgId` is required/);
      });

      it('requires `this.name`', function() {
        credentials.set('orgId', 'orgId');
        return assert.isRejected(credentials._getSamlBearerToken(), /`this.name` is required/);
      });

      it('requires `this.password`', function() {
        credentials.set('orgId', 'orgId');
        credentials.set('name', 'name');
        return assert.isRejected(credentials._getSamlBearerToken(), /`this.password` is required/);
      });
    });

    describe('#refresh() with downscope on expired supertoken', function() {
      this.timeout(5000);
      it('waits for supertoken refresh before downscoping if supertoken is expired', function() {
        credentials.authorization = new Authorization({
          supertoken: {
            access_token: 'ACCESS TOKEN',
            refresh_token: 'REFRESH TOKEN',
            token_type: 'Bearer',
            expires: Date.now() - 100
          },
          apiToken: {
            access_token: 'API Token'
          },
          kmsToken: {
            access_token: 'KMS Token'
          }
        }, {parent: spark});

        sinon.stub(credentials.authorization.supertoken, 'refresh', function() {
          return delay(3000)
          .then(function() {
            return Promise.resolve({
              access_token: 'ACCESS TOKEN2',
              refresh_token: 'REFRESH TOKEN2',
              token_type: 'Bearer2',
              expires: Date.now() + 1000,
              downscope: function downscope() {
                return Promise.resolve({
                  access_token: 'ACCESS TOKEN DOWNSCOPED',
                  refresh_token: 'REFRESH TOKEN DOWNSCOPED',
                  token_type: 'Bearer DOWNSCOPED',
                  expires: Date.now() + 1000
                });
              }
            });
          });
        });

        sinon.spy(credentials, 'refresh');
        sinon.spy(credentials.authorization, 'refresh');
        sinon.spy(credentials.authorization, 'getToken');
        sinon.spy(credentials.authorization, '_getToken');
        sinon.spy(credentials.authorization, '_split');

        var originalSuperToken = credentials.authorization.supertoken.access_token;
        return Promise.all([
          credentials.refresh({force: true})
            .then(function() {
              assert.called(credentials.refresh);
              assert.called(credentials.authorization.refresh);
              assert.called(credentials.authorization._split);
            }),
          credentials.authorization.getToken('')
            .then(function() {
              assert.called(credentials.authorization.getToken);
              assert.called(credentials.authorization._getToken);
              // since supertoken refresh is in progress hence the value of supertoken should not be equal to originalSuperToken, hence should equal to newly refreshed supertoken
              assert.notEqual(credentials.authorization.supertoken.access_token, originalSuperToken);
              assert.equal(credentials.authorization.supertoken.access_token, 'ACCESS TOKEN2');
            })
        ]);
      });

    });


  });
});
