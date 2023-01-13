/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {nodeOnly, browserOnly} from '@webex/test-helper-mocha';
import FakeTimers from '@sinonjs/fake-timers';
import MockWebex from '@webex/test-helper-mock-webex';
import {Token} from '@webex/webex-core';

/* eslint camelcase: [0] */

// eslint-disable-next-line no-empty-function
function noop() {}

describe('webex-core', () => {
  describe('Credentials', () => {
    describe('Token', () => {
      let webex;

      beforeEach(() => {
        webex = new MockWebex();
      });

      function makeToken(options = {}) {
        return new Token(
          Object.assign(
            {
              access_token: 'AT',
              expires_in: 10000,
              token_type: 'Fake',
              refresh_token: 'RT',
              refresh_token_expires_in: 20000,
            },
            options
          ),
          {parent: webex}
        );
      }

      describe('#canAuthorize', () => {
        it('indicates if this token can be used to authorize a request', () => {
          let token = makeToken();

          assert.isTrue(token.canAuthorize);

          token = makeToken({expires: Date.now() + 10000});
          assert.isFalse(token.isExpired);
          assert.isTrue(token.canAuthorize);

          token = makeToken({expires: Date.now() - 10000});
          assert.isTrue(token.isExpired);
          assert.isFalse(token.canAuthorize);

          token.unset('expires');
          assert.isFalse(token.isExpired);
          assert.isTrue(token.canAuthorize);

          token.unset('access_token');
          assert.isFalse(token.canAuthorize);
        });
      });

      describe('#canDownscope', () => {
        it('indicates if this token can be used to get a token of lesser scope', () => {
          let token = makeToken();

          assert.isTrue(token.canDownscope);

          webex.config.credentials.client_id = undefined;
          token = makeToken();
          assert.isFalse(token.canDownscope);

          webex.config.credentials.client_id = 'blarg';
          token = makeToken();
          assert.isTrue(token.canDownscope);

          token = makeToken({expires: Date.now() - 10000});
          assert.isFalse(token.canAuthorize);
          assert.isFalse(token.canDownscope);

          token.unset('expires');
          assert.isTrue(token.canDownscope);

          token = makeToken({expires: Date.now() + 10000});
          assert.isTrue(token.canAuthorize);
          assert.isTrue(token.canDownscope);

          token.unset('access_token');
          assert.isFalse(token.canDownscope);
        });
      });

      describe('#canRefresh', () => {
        browserOnly(it)('indicates if this token can be refreshed', () => {
          let token = makeToken();

          assert.isFalse(token.canRefresh);
          token.unset('refresh_token');
          assert.isFalse(token.canRefresh);

          webex.config.credentials.refreshCallback = noop;
          token = makeToken();
          assert.isTrue(token.canRefresh);
          token.unset('refresh_token');
          assert.isFalse(token.canRefresh);
        });

        nodeOnly(it)('indicates if this token can be refreshed', () => {
          let token = makeToken();

          assert.isTrue(token.canRefresh);
          token.unset('refresh_token');
          assert.isFalse(token.canRefresh);

          webex.config.credentials.client_secret = undefined;
          token = makeToken();
          assert.isFalse(token.canRefresh);
        });
      });

      describe('#isExpired', () => {
        it('derives from `expires`', () => {
          let token = makeToken();

          token.unset('expires');
          token.unset('expires_in');
          assert.isFalse(token.isExpired);

          token = makeToken({expires: Date.now() - 10000});
          assert.isTrue(token.isExpired);

          token = makeToken({expires: Date.now() + 10000});
          assert.isFalse(token.isExpired);
        });
      });

      describe('#_string', () => {
        it('derives from `access_token` and `token_type`', () => {
          const token = makeToken();

          assert.equal(token._string, 'Fake AT');

          token.token_type = 'Fake';
          token.unset('access_token');
          assert.equal(token._string, '');
        });
      });

      describe('#downscope()', () => {
        it('requires an access token', () => {
          const token = makeToken();

          token.unset('access_token');

          return assert.isRejected(token.downscope('spark:kms'), /cannot downscope access token/);
        });

        it('requires an unexpired access token', () => {
          const token = makeToken({expires: Date.now() - 10000});

          return assert.isRejected(
            token.downscope('spark:kms'),
            /cannot downscope expired access token/
          );
        });

        it('alphabetizes the requested scope', () => {
          const token = makeToken();

          webex.request.returns(Promise.resolve({body: {access_token: 'AT2'}}));

          return token
            .downscope('b a')
            .then(() => assert.equal(webex.request.args[0][0].form.scope, 'a b'));
        });
      });

      describe('#initialize()', () => {
        let clock;

        beforeEach(() => {
          clock = FakeTimers.install();
        });
        afterEach(() => clock.uninstall());

        it('requires an access token', () => {
          assert.throws(() => {
            // eslint-disable-next-line no-unused-vars
            const x = new Token();
          }, /`access_token` is required/);

          assert.doesNotThrow(() => {
            // eslint-disable-next-line no-unused-vars
            const x = new Token({access_token: 'AT'});
          }, /`access_token` is required/);
        });

        it('infers token_type from an access token string', () => {
          const t = new Token({
            access_token: 'Fake AT',
          });

          assert.equal(t.access_token, 'AT');
          assert.equal(t.token_type, 'Fake');
        });

        it('computes expires_in and refresh_token_expires_in if not specified', () => {
          const now = Date.now();

          const t = makeToken({
            expires_in: 6000,
            refresh_token_expires_in: 12000,
            expires: null,
            refresh_token_expires: null,
          });

          assert.approximately(t.expires, 6000000 + now, 5);
          assert.approximately(t.refresh_token_expires, 12000000 + now, 5);
        });

        it("alphabetizes the token's scopes", () => {
          const t = new Token({
            access_token: 'AT',
            scope: 'b a',
          });

          assert.equal(t.scope, 'a b');
        });

        it('it sets a timer to set Token#_isExpired (and therefore Token#isExpired)', () => {
          const t = makeToken({
            // Reminder: expires_in is in seconds, ticks are in miliseconds
            expires_in: 1,
          });

          assert.isFalse(t.isExpired);
          clock.tick(900);
          assert.isFalse(t.isExpired);
          clock.tick(100);
          assert.isTrue(t.isExpired);
        });

        it('accepts a string as an access token', () => {
          const token = new Token('AT', {parent: webex});

          assert.isTrue(token.canAuthorize);
          assert.equal(token.toString(), 'Bearer AT');
        });

        it('accepts a string as an access token (with token type)', () => {
          const token = new Token('Fake AT', {parent: webex});

          assert.isTrue(token.canAuthorize);
          assert.equal(token.toString(), 'Fake AT');
        });
      });

      describe('#refresh()', () => {
        browserOnly(it)('refreshes the access_token', () => {
          const token = makeToken();

          webex.config.credentials.refreshCallback = sinon.stub().returns(
            Promise.resolve({
              access_token: 'AT2',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          // FIXME this next line should be necessary. we need a better way to
          // do config
          token.trigger('change:config');

          return token.refresh().then((token2) => {
            assert.equal(token2.access_token, 'AT2');
          });
        });

        nodeOnly(it)('refreshes the access_token', () => {
          const token = makeToken();

          webex.request.onCall(0).returns(
            Promise.resolve({
              body: {
                access_token: 'AT2',
                expires_in: 10000,
                token_type: 'Fake',
              },
            })
          );

          return token.refresh().then((token2) => {
            assert.equal(token2.access_token, 'AT2');
          });
        });

        browserOnly(it)('revokes the previous token when set', () => {
          const token = makeToken();

          sinon.spy(token, 'revoke');
          webex.config.credentials.refreshCallback = sinon.stub();

          webex.config.credentials.refreshCallback.onCall(0).returns(
            Promise.resolve({
              access_token: 'AT2',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          webex.config.credentials.refreshCallback.onCall(1).returns(
            Promise.resolve({
              access_token: 'AT3',
              expires_in: 10000,
              token_type: 'Fake',
            })
          );

          // FIXME this next line should be necessary. we need a better way to
          // do config
          token.trigger('change:config');

          return token
            .refresh()
            .then((token2) => {
              assert.isTrue(token.canRefresh);
              assert.notCalled(token.revoke);

              return token2.refresh();
            })
            .then((token3) => {
              assert.equal(token3.access_token, 'AT3');
              assert.called(token.revoke);
            });
        });

        nodeOnly(it)('revokes the previous token when set', () => {
          const token = makeToken();

          sinon.spy(token, 'revoke');

          webex.request.onCall(0).returns(
            Promise.resolve({
              body: {
                access_token: 'AT2',
                expires_in: 10000,
                token_type: 'Fake',
              },
            })
          );

          webex.request.onCall(1).returns(
            Promise.resolve({
              body: {
                access_token: 'AT3',
                expires_in: 10000,
                token_type: 'Fake',
              },
            })
          );

          return token
            .refresh()
            .then((token2) => {
              assert.isTrue(token.canRefresh);
              assert.notCalled(token.revoke);

              return token2.refresh();
            })
            .then((token3) => {
              assert.equal(token3.access_token, 'AT3');
              assert.called(token.revoke);
            });
        });
      });

      describe('#revoke()', () => {
        describe('when the token has expired', () => {
          it('is a noop', () => {
            const token = makeToken({expires: Date.now() - 10000});

            return token.revoke().then(() => assert.notCalled(webex.request));
          });
        });

        describe('when access_token has been unset', () => {
          it('is a noop', () => {
            const token = makeToken();

            token.unset('access_token');

            return token.revoke().then(() => assert.notCalled(webex.request));
          });
        });

        // FIXME this test is temporary; there's currently no practical way to
        // revoke a token without a client secret.
        describe('when the client_secret is unavailable', () => {
          it('is a noop', () => {
            webex.config.credentials.client_secret = undefined;

            const token = makeToken();

            token.unset('access_token');

            return token.revoke().then(() => assert.notCalled(webex.request));
          });
        });

        it('unsets the access_token and related values', () => {
          const token = makeToken();

          return token.revoke().then(() => {
            assert.isUndefined(token.access_token);
            assert.isUndefined(token.expires);
            assert.isUndefined(token.expires_in);
            assert.isDefined(token.refresh_token);
            assert.isDefined(token.refresh_token_expires);
            assert.isDefined(token.refresh_token_expires_in);
          });
        });
      });

      describe('#toString()', () => {
        it('produces a value for an auth header', () => {
          const token = makeToken();

          assert.equal(token.toString(), 'Fake AT');

          token.unset('access_token');

          assert.throws(() => {
            token.toString();
          }, /cannot stringify Token/);
        });
      });
    });
  });
});
