/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {set} from 'lodash';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {Credentials, Token, grantErrors} from '@webex/webex-core';
import {inBrowser} from '@webex/common';
import FakeTimers from '@sinonjs/fake-timers';
import {skipInBrowser} from '@webex/test-helper-mocha';
import Logger from '@webex/plugin-logger';

/* eslint camelcase: [0] */

// eslint-disable-next-line no-empty-function
function noop() {}

function promiseTick(count) {
  let promise = Promise.resolve();

  while (count > 1) {
    promise = promise.then(() => promiseTick(1));
    count -= 1;
  }

  return promise;
}

const AUTHORIZATION_STRING =
  'https://api.ciscospark.com/v1/authorize?client_id=MOCK_CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8000&scope=spark%3Arooms_read%20spark%3Ateams_read&state=set_state_here';

describe('webex-core', () => {
  describe('Credentials', () => {
    let clock;

    beforeEach(() => {
      clock = FakeTimers.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    function makeToken(webex, options) {
      return new Token(options, {parent: webex});
    }

    describe('#calcRefreshTimeout', () => {
      it('generates a number between 60-90% of expiration', () => {
        const expiration = 1000;
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});
        const result = credentials.calcRefreshTimeout(expiration);

        assert.isTrue(result >= expiration * 0.6);
        assert.isTrue(result <= expiration * 0.9);
      });
    });

    describe('#canAuthorize', () => {
      it('indicates if the current state has enough information to populate an auth header, even if a token refresh or token downscope is required', () => {
        const webex = new MockWebex();

        webex.config.credentials.refreshCallback = inBrowser && noop;
        let credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.isFalse(credentials.canAuthorize);

        credentials.supertoken = makeToken(webex, {
          access_token: 'AT',
        });
        assert.isTrue(credentials.canAuthorize);

        credentials.supertoken.unset('access_token');
        assert.isFalse(credentials.canAuthorize);

        credentials.supertoken = makeToken(webex, {
          access_token: 'AT',
        });
        assert.isTrue(credentials.canAuthorize);

        credentials.supertoken = makeToken(webex, {
          access_token: 'AT',
          expires: Date.now() - 10000,
        });
        assert.isFalse(credentials.supertoken.canAuthorize);
        assert.isFalse(credentials.canRefresh);
        assert.isFalse(credentials.canAuthorize);

        webex.config.credentials.refreshCallback = inBrowser && noop;
        credentials = new Credentials(undefined, {parent: webex});
        webex.trigger('change:config');
        assert.isFalse(credentials.canAuthorize);
        credentials.supertoken = makeToken(webex, {
          access_token: 'AT',
          refresh_token: 'RT',
        });
        credentials.supertoken.unset('access_token');
        assert.isTrue(credentials.canAuthorize);
      });
    });

    describe('#canRefresh', () => {
      it('indicates if there is presently enough information to refresh', () => {
        const webex = new MockWebex();
        let credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.isFalse(credentials.canRefresh);
        credentials.supertoken = makeToken(
          webex,
          {
            access_token: 'AT',
          },
          {parent: true}
        );
        assert.isFalse(credentials.canRefresh);

        webex.config.credentials.refreshCallback = inBrowser && noop;
        credentials = new Credentials(undefined, {parent: webex});
        webex.trigger('change:config');
        assert.isFalse(credentials.canRefresh);
        credentials.supertoken = makeToken(webex, {
          access_token: 'AT',
          refresh_token: 'RT',
        });
        assert.isTrue(credentials.supertoken.canRefresh);
        assert.isTrue(credentials.canRefresh);
      });
    });

    describe('#buildLoginUrl()', () => {
      it('requires `state` to be an object', () => {
        const webex = new MockWebex({
          children: {
            credentials: Credentials,
          },
        });

        webex.trigger('change:config)');
        assert.doesNotThrow(() => {
          webex.credentials.buildLoginUrl();
        }, /if specified, `options.state` must be an object/);

        assert.doesNotThrow(() => {
          webex.credentials.buildLoginUrl({});
        }, /if specified, `options.state` must be an object/);

        assert.throws(() => {
          webex.credentials.buildLoginUrl({state: 'state'});
        }, /if specified, `options.state` must be an object/);

        assert.doesNotThrow(() => {
          webex.credentials.buildLoginUrl({state: {}});
        }, /if specified, `options.state` must be an object/);
      });

      it('prefers the hydra auth url, but falls back to idbroker', () => {
        const webex = new MockWebex();
        let credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');

        assert.match(credentials.buildLoginUrl({state: {}}), /idbroker/);
        webex.config.credentials = {
          authorizationString: AUTHORIZATION_STRING,
        };
        credentials = new Credentials({}, {parent: webex});
        webex.trigger('change:config');
        assert.match(credentials.buildLoginUrl({state: {}}), /api.ciscospark.com/);
      });

      skipInBrowser(it)('generates the login url', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');

        assert.equal(
          credentials.buildLoginUrl({state: {page: 'front'}}),
          `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/authorize?state=eyJwYWdlIjoiZnJvbnQifQ&client_id=fake&redirect_uri=http%3A%2F%2Fexample.com&scope=scope%3Aone&response_type=code`
        );
      });

      skipInBrowser(it)('generates the login url with empty state param', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');

        assert.equal(
          credentials.buildLoginUrl({state: {}}),
          `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/authorize?client_id=fake&redirect_uri=http%3A%2F%2Fexample.com&scope=scope%3Aone&response_type=code`
        );
      });
    });

    describe('#buildLogoutUrl()', () => {
      skipInBrowser(it)('generates the logout url', () => {
        const webex = new MockWebex();

        webex.config.credentials.redirect_uri = 'ru';
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.equal(
          credentials.buildLogoutUrl(),
          `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/logout?cisService=webex&goto=ru`
        );
      });

      skipInBrowser(it)('includes a token param if passed', () => {
        const webex = new MockWebex();

        webex.config.credentials.redirect_uri = 'ru';
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.equal(
          credentials.buildLogoutUrl({token: 't'}),
          `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/logout?cisService=webex&goto=ru&token=t`
        );
      });

      it('always fallsback to idbroker', () => {
        const webex = new MockWebex();

        webex.config.credentials.redirect_uri = 'ru';
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.match(credentials.buildLogoutUrl(), /idbroker.*?goto=ru/);
      });

      it('allows overriding the goto url', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        assert.match(
          credentials.buildLogoutUrl({goto: 'http://example.com/'}),
          /goto=http%3A%2F%2Fexample.com%2F/
        );
      });
    });

    describe('#getOrgId()', () => {
      let credentials;
      let orgId;
      let webex;

      beforeEach(() => {
        webex = new MockWebex();
        credentials = new Credentials(undefined, {parent: webex});
      });

      it('should return the OrgId of JWT-authenticated user', () => {
        credentials.supertoken = {
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJyZWFsbSI6Im15LXJlYWxtIn0.U16gzUsaRW1VVikJA2VeXRHPX716tG1_B42oxzy1UMk',
        };

        orgId = 'my-realm';

        assert.equal(credentials.getOrgId(), orgId);
      });

      it('should return the OrgId of a user-token-authenticated user', () => {
        orgId = 'this-is-an-org-id';

        credentials.supertoken = {
          access_token: `000_000_${orgId}`,
        };

        assert.equal(credentials.getOrgId(), orgId);
      });

      it('should throw if the OrgId was not determined', () =>
        expect(() => credentials.getOrgId()).toThrow('the provided token is not a valid format'));
    });

    describe('#extractOrgIdFromJWT()', () => {
      let credentials;
      let webex;

      beforeEach(() => {
        webex = new MockWebex();
        credentials = new Credentials(undefined, {parent: webex});
      });

      it('should return the OrgId of a provided JWT', () => {
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJyZWFsbSI6Im15LXJlYWxtIn0.U16gzUsaRW1VVikJA2VeXRHPX716tG1_B42oxzy1UMk';
        const realm = 'my-realm';

        assert.equal(credentials.extractOrgIdFromJWT(jwt), realm);
      });

      it('should throw if the provided JWT is not valid', () =>
        expect(() => credentials.extractOrgIdFromJWT('not-valid')).toThrow());

      it('should throw if the provided JWT does not contain an OrgId', () => {
        const jwtNoOrg =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

        expect(() => credentials.extractOrgIdFromJWT(jwtNoOrg)).toThrow();
      });

      it('should throw if no JWT was provided', () =>
        expect(() => credentials.extractOrgIdFromJWT()).toThrow());
    });

    describe('#extractOrgIdFromUserToken()', () => {
      let credentials;
      let webex;

      beforeEach(() => {
        webex = new MockWebex();
        credentials = new Credentials(undefined, {parent: webex});
      });

      it('should return the OrgId of the provided user token', () => {
        const orgId = 'this-is-an-org-id';
        const userToken = `000_000_${orgId}`;

        assert.equal(credentials.extractOrgIdFromUserToken(userToken), orgId);
      });

      it('should throw when provided an invalid token', () =>
        expect(() => credentials.extractOrgIdFromUserToken()).toThrow('the provided token is not a valid format'));

      it('should throw when no token is provided', () =>
        expect(() => credentials.extractOrgIdFromUserToken()).toThrow());
    });

    describe('#initialize()', () => {
      it('turns a portal auth string into a configuration object', () => {
        const webex = new MockWebex();

        webex.config.credentials = {
          client_id: 'ci',
          redirect_uri: 'ru',
          scope: 's',
        };

        let credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        webex.trigger('change:config');
        assert.equal(webex.config.credentials.client_id, 'ci');
        assert.equal(credentials.config.client_id, 'ci');
        assert.equal(webex.config.credentials.redirect_uri, 'ru');
        assert.equal(credentials.config.redirect_uri, 'ru');
        assert.equal(webex.config.credentials.scope, 's');
        assert.equal(credentials.config.scope, 's');

        // Accept a portal auth string via environment variables
        webex.config.credentials.authorizationString = AUTHORIZATION_STRING;
        credentials = new Credentials(undefined, {parent: webex});
        webex.trigger('change:config');
        webex.trigger('change:config');
        assert.equal(webex.config.credentials.client_id, 'MOCK_CLIENT_ID');
        assert.equal(credentials.config.client_id, 'MOCK_CLIENT_ID');
        assert.equal(webex.config.credentials.redirect_uri, 'http://localhost:8000');
        assert.equal(credentials.config.redirect_uri, 'http://localhost:8000');
        assert.equal(webex.config.credentials.scope, 'spark:rooms_read spark:teams_read');
        assert.equal(credentials.config.scope, 'spark:rooms_read spark:teams_read');
      });

      [
        'data',
        'data.access_token',
        'data.supertoken',
        'data.supertoken.access_token',
        'data.authorization',
        'data.authorization.supertoken',
        'data.authorization.supertoken.access_token',
      ]
        .reduce(
          (acc, path) =>
            acc.concat(
              ['ST', 'Bearer ST'].map((str) => {
                const obj = {
                  msg: `accepts token string "${str}" at path "${path
                    .split('.')
                    .slice(1)
                    .join('.')}"`,
                };

                set(obj, path, str);

                return obj;
              })
            ),
          []
        )
        .forEach(({msg, data}) => {
          it(msg, () => {
            const webex = new MockWebex();
            const credentials = new Credentials(data, {parent: webex});

            assert.isTrue(credentials.canAuthorize);
            assert.equal(credentials.supertoken.access_token, 'ST');
            assert.equal(credentials.supertoken.token_type, 'Bearer');
          });
        });

      it('schedules a refreshTimer', () => {
        const webex = new MockWebex();
        const supertoken = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
          expires: Date.now() + 10000,
        });
        const supertoken2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
          expires: Date.now() + 20000,
        });

        sinon.stub(supertoken, 'refresh').returns(Promise.resolve(supertoken2));
        const credentials = new Credentials(supertoken, {parent: webex});

        webex.trigger('change:config');

        const firstTimer = credentials.refreshTimer;

        assert.isDefined(firstTimer);
        assert.notCalled(supertoken.refresh);
        clock.tick(10000);

        return promiseTick(8)
          .then(() => assert.called(supertoken.refresh))
          .then(() => assert.isDefined(credentials.refreshTimer))
          .then(() => assert.notEqual(credentials.refreshTimer, firstTimer));
      });

      it.skip('does not schedule a refreshTimer', () => {
        const webex = new MockWebex();
        const supertoken = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
          expires: Date.now() - 10000,
        });

        sinon.stub(supertoken, 'refresh').returns(Promise.reject());
        const credentials = new Credentials(supertoken, {parent: webex});

        webex.trigger('change:config');

        assert.isUndefined(credentials.refreshTimer);
      });
    });

    describe('#getUserToken()', () => {
      // it('resolves with the supertoken if the supertoken matches the requested scopes');

      it('resolves with the token identified by the specified scopes', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {access_token: 'ST'});
        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });
        const t2 = makeToken(webex, {
          access_token: 'AT2',
          scope: 'scope2',
        });

        credentials.set({
          supertoken: st,
          userTokens: [t1, t2],
        });

        return Promise.all([
          credentials.getUserToken('scope1').then((result) => assert.deepEqual(result, t1)),
          credentials.getUserToken('scope2').then((result) => assert.deepEqual(result, t2)),
        ]);
      });

      describe('when no matching token is found', () => {
        it('downscopes the supertoken', () => {
          const webex = new MockWebex();
          const credentials = new Credentials(undefined, {parent: webex});

          webex.trigger('change:config');

          credentials.supertoken = makeToken(webex, {
            access_token: 'ST',
          });

          const t2 = makeToken(webex, {
            access_token: 'AT2',
          });

          sinon.stub(credentials.supertoken, 'downscope').returns(Promise.resolve(t2));

          const t1 = makeToken(webex, {
            access_token: 'AT1',
            scope: 'scope1',
          });

          credentials.set({
            userTokens: [t1],
          });

          return credentials
            .getUserToken('scope2')
            .then((result) => assert.deepEqual(result, t2))
            .then(() => assert.calledWith(credentials.supertoken.downscope, 'scope2'));
        });
      });

      describe('when no scope is specified', () => {
        it('resolves with a token containing all but the kms scopes', () => {
          const webex = new MockWebex();

          webex.config.credentials.scope = 'scope1 spark:kms';
          const credentials = new Credentials(undefined, {parent: webex});

          webex.trigger('change:config');

          credentials.supertoken = makeToken(webex, {
            access_token: 'ST',
          });

          // const t2 = makeToken(webex, {
          //   access_token: `AT2`
          // });

          // sinon.stub(credentials.supertoken, `downscope`).returns(Promise.resolve(t2));

          const t1 = makeToken(webex, {
            access_token: 'AT1',
            scope: 'scope1',
          });

          credentials.set({
            userTokens: [t1],
          });

          return credentials.getUserToken().then((result) => assert.deepEqual(result, t1));
        });
      });

      describe('when the kms downscope request fails', () => {
        it('falls back to the supertoken', () => {
          const webex = new MockWebex({
            children: {
              logger: Logger,
            },
          });

          webex.config.credentials.scope = 'scope1 spark:kms';
          const credentials = new Credentials(undefined, {parent: webex});

          webex.trigger('change:config');

          credentials.supertoken = makeToken(webex, {
            access_token: 'ST',
          });

          sinon
            .stub(credentials.supertoken, 'downscope')
            .returns(Promise.reject(new Error('downscope failed')));

          const t1 = makeToken(webex, {
            access_token: 'AT1',
            scope: 'scope1',
          });

          credentials.set({
            userTokens: [t1],
          });

          return credentials
            .getUserToken('scope2')
            .then((t) => assert.equal(t.access_token, credentials.supertoken.access_token));
        });
      });

      it('is blocked while a token refresh is inflight', () => {
        const webex = new MockWebex();

        webex.config.credentials.scope = 'scope1 spark:kms';
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');

        const supertoken1 = makeToken(webex, {
          access_token: 'ST1',
          refresh_token: 'RT1',
        });

        credentials.set({supertoken: supertoken1});

        sinon
          .stub(supertoken1, 'downscope')
          .returns(Promise.resolve(new Token({access_token: 'ST1ATD'})));
        const supertoken2 = makeToken(webex, {
          access_token: 'ST2',
        });

        sinon.stub(supertoken1, 'refresh').returns(Promise.resolve(supertoken2));

        const at2 = makeToken(webex, {access_token: 'ST2ATD'});

        sinon.stub(supertoken2, 'downscope').returns(Promise.resolve(at2));

        return Promise.all([
          credentials.refresh(),
          credentials.getUserToken('scope2').then((result) => assert.deepEqual(result, at2)),
        ]);
      });
    });

    describe('#invalidate()', () => {
      it('clears the refreshTimer', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
        });

        credentials.set({
          supertoken: st,
        });

        sinon.stub(credentials, 'refresh').returns(Promise.resolve(st2));

        credentials.scheduleRefresh(Date.now() + 10000);
        assert.isDefined(credentials.refreshTimer);
        assert.notCalled(credentials.refresh);

        return credentials.invalidate().then(() => {
          clock.tick(10000);
          assert.isUndefined(credentials.refreshTimer);
          assert.notCalled(credentials.refresh);
        });
      });

      it('clears the tokens from boundedStorage', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        const t2 = makeToken(webex, {
          access_token: 'AT2',
          scope: 'scope2',
        });

        credentials.set({
          supertoken: st,
          userTokens: [t1, t2],
        });

        return new Promise((resolve) => {
          setTimeout(resolve, 1);
          clock.tick(1000);
        })
          .then(() => webex.boundedStorage.get('Credentials', '@'))
          .then((data) => {
            assert.equal(data.userTokens[0].access_token, t1.access_token);
            assert.equal(data.userTokens[1].access_token, t2.access_token);

            return credentials.invalidate();
          })
          .then(() => promiseTick(500))
          .then(
            () =>
              new Promise((resolve) => {
                setTimeout(resolve, 1);
                clock.tick(1000);
              })
          )
          .then(() => promiseTick(500))
          .then(
            () =>
              new Promise((resolve) => {
                setTimeout(resolve, 1);
                clock.tick(1000);
              })
          )
          .then(() => assert.isRejected(webex.boundedStorage.get('Credentials', '@'), /NotFound/));
      });


      // it('does not induce any token refreshes');

      it('prevents #getUserToken() from being invoked', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        credentials.set({
          supertoken: st,
          userTokens: [t1],
        });

        return credentials
          .invalidate()
          .then(() =>
            assert.isRejected(
              credentials.getUserToken(),
              /Current state cannot produce an access token/
            )
          );
      });
    });

    describe('#refresh()', () => {
      it('refreshes and downscopes the supertoken, and revokes previous tokens', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        const t2 = makeToken(webex, {
          access_token: 'AT2',
          scope: 'scope2',
        });

        sinon.stub(st2, 'downscope').returns(Promise.resolve(t2));
        sinon.stub(st, 'refresh').returns(Promise.resolve(st2));
        sinon.stub(t1, 'revoke').returns(Promise.resolve());
        sinon.spy(credentials, 'scheduleRefresh');

        credentials.set({
          supertoken: st,
          userTokens: [t1],
        });

        assert.equal(credentials.userTokens.get(t1.scope), t1);

        return credentials
          .refresh()
          .then(() => assert.called(st.refresh))
          .then(() => assert.calledWith(st2.downscope, 'scope1'))
          .then(() => assert.called(t1.revoke))
          .then(() => assert.isUndefined(credentials.userTokens.get(t1.scope)))
          .then(() => assert.equal(credentials.userTokens.get(t2.scope), t2))
          .then(() => assert.calledWith(credentials.scheduleRefresh, st.expires));
      });

      it('refreshes and downscopes the supertoken even if revocation of previous token fails', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        const t2 = makeToken(webex, {
          access_token: 'AT2',
          scope: 'scope2',
        });

        sinon.stub(st2, 'downscope').returns(Promise.resolve(t2));
        sinon.stub(st, 'refresh').returns(Promise.resolve(st2));
        sinon.stub(t1, 'revoke').returns(Promise.reject());
        sinon.spy(credentials, 'scheduleRefresh');

        credentials.set({
          supertoken: st,
          userTokens: [t1],
        });

        assert.equal(credentials.userTokens.get(t1.scope), t1);

        return credentials
          .refresh()
          .then(() => assert.called(st.refresh))
          .then(() => assert.calledWith(st2.downscope, 'scope1'))
          .then(() => assert.called(t1.revoke))
          .then(() => assert.isUndefined(credentials.userTokens.get(t1.scope)))
          .then(() => assert.equal(credentials.userTokens.get(t2.scope), t2))
          .then(() => assert.calledWith(credentials.scheduleRefresh, st.expires));
      });

      it('removes and revokes all child tokens', () => {
        const webex = new MockWebex({
          children: {
            logger: Logger,
          },
        });
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        sinon.stub(st, 'refresh').returns(Promise.resolve(makeToken(webex, {access_token: 'ST2'})));

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        credentials.set({
          supertoken: st,
          userTokens: [t1],
        });

        return credentials.refresh().then(() => assert.called(st.refresh));
      });

      it('allows #getUserToken() to be revoked, but #getUserToken() promises will not resolve until the suport token has been refreshed', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st1 = makeToken(webex, {
          access_token: 'ST1',
          refresh_token: 'RT1',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT1',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        const t2 = makeToken(webex, {
          access_token: 'AT2',
          scope: 'scope1',
        });

        sinon.stub(st1, 'refresh').returns(Promise.resolve(st2));
        sinon.stub(st2, 'downscope').returns(Promise.resolve(t2));

        credentials.set({
          supertoken: st1,
          userTokens: [t1],
        });

        credentials.refresh();

        return credentials.getUserToken('scope1').then((result) => assert.deepEqual(result, t2));
      });

      it('emits InvalidRequestError when the refresh token and access token expire', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const t1 = makeToken(webex, {
          access_token: 'AT1',
          scope: 'scope1',
        });

        const res = {
          body: {
            error: 'invalid_request',
            error_description:
              'The refresh token provided is expired, revoked, malformed, or invalid.',
            trackingID: 'test123',
          },
        };

        const ErrorConstructor = grantErrors.select(res.body.error);

        sinon
          .stub(st, 'refresh')
          .returns(Promise.reject(new ErrorConstructor('InvalidRequestError')));
        sinon.stub(credentials, 'unset').returns(Promise.resolve());
        const triggerSpy = sinon.spy(webex, 'trigger');

        credentials.set({
          supertoken: st,
          userTokens: [t1],
        });

        return credentials
          .refresh()
          .then(() => assert.called(st.refresh))
          .catch(() => {
            assert.called(credentials.unset);
            assert.calledWith(triggerSpy, sinon.match('client:InvalidRequestError'));
          });
      });
    });

    describe('#scheduleRefresh()', () => {
      it('refreshes token immediately if token is expired', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
        });

        credentials.set({
          supertoken: st,
        });

        sinon.stub(credentials, 'refresh').returns(Promise.resolve(st2));

        credentials.scheduleRefresh(Date.now() - 10000);
        assert.isUndefined(credentials.refreshTimer);
        assert.called(credentials.refresh);
      });

      it('schedules a token refresh', () => {
        const webex = new MockWebex();
        const credentials = new Credentials(undefined, {parent: webex});

        webex.trigger('change:config');
        const st = makeToken(webex, {
          access_token: 'ST',
          refresh_token: 'RT',
        });

        const st2 = makeToken(webex, {
          access_token: 'ST2',
          refresh_token: 'RT2',
        });

        credentials.set({
          supertoken: st,
        });

        sinon.stub(credentials, 'refresh').returns(Promise.resolve(st2));

        credentials.scheduleRefresh(Date.now() + 10000);
        assert.isDefined(credentials.refreshTimer);
        assert.notCalled(credentials.refresh);
        clock.tick(10000);
        assert.called(credentials.refresh);
      });
    });
  });
});
