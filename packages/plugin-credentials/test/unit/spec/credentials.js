/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {Defer} from '@ciscospark/common';
import {assert} from '@ciscospark/test-helper-chai';
import {nodeOnly, browserOnly} from '@ciscospark/test-helper-mocha';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import uuid from 'uuid';
import CiscoSpark, {grantErrors} from '@ciscospark/spark-core';
import Credentials, {
  filterScope,
  Token
} from '../..';

describe(`plugin-credentials`, () => {
  describe(`Credentials`, () => {
    function makeToken(scope, spark) {
      return new Token({
        access_token: `AT-${uuid.v4()}`,
        token_type: `Fake`,
        expires_in: 6000,
        refresh_token: `RT`,
        refresh_token_expires_in: 24000,
        scope
      }, {parent: spark});
    }

    let apiScope, spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          credentials: Credentials
        }
      });

      apiScope = filterScope(`spark:kms`, spark.config.credentials.scope);

      spark.request.returns(Promise.resolve({
        statusCode: 200,
        body: {
          access_token: `AT3`,
          token_type: `Fake`
        }
      }));
    });

    let nextApiToken, nextKmsToken;
    beforeEach(() => {
      nextApiToken = makeToken(apiScope, spark);
      nextKmsToken = makeToken(`spark:kms`, spark);

      sinon.stub(Token.prototype, `downscope`, (scope) => {
        if (scope === `spark:kms`) {
          return Promise.resolve(nextApiToken);
        }

        if (scope === apiScope) {
          return Promise.resolve(nextKmsToken);
        }
        return Promise.resolve(makeToken(scope, this));
      });
    });

    afterEach(() => {
      if (Token.prototype.downscope.restore) {
        Token.prototype.downscope.restore();
      }
    });

    describe(`#getClientToken()`, () => {
      it(`resolves with the client token`, () => {
        sinon.spy(spark.credentials, `requestClientCredentialsGrant`);

        spark.credentials.set({
          clientToken: {
            access_token: `a token`,
            token_type: `fake`
          }
        });

        return spark.credentials.getClientToken()
          .then((token) => {
            assert.notCalled(spark.credentials.requestClientCredentialsGrant);
            assert.equal(token.access_token, `a token`);
          });
      });

      it(`fetches a new client token if one does not exist`, () => {
        sinon.stub(spark.credentials, `requestClientCredentialsGrant`).returns(Promise.resolve({
          access_token: `this should really be a Token instance, but that's not relevant for this test`
        }));

        return spark.credentials.getClientToken()
          .then(() => assert.calledOnce(spark.credentials.requestClientCredentialsGrant));
      });
    });

    describe(`#getUserToken()`, () => {
      let apiToken, kmsToken, supertoken;
      beforeEach(() => {
        supertoken = makeToken(`${apiScope} spark:kms`);
        apiToken = makeToken(`${apiScope}`);
        kmsToken = makeToken(`spark:kms`);

        spark.credentials.supertoken = supertoken;
        spark.credentials.userTokens.add(apiToken);
        spark.credentials.userTokens.add(kmsToken);
      });

      describe(`when logging out`, () => {
        it(`rejects getUserToken`, () => {
          spark.credentials.isLoggingOut = true;
          return assert.isRejected(spark.credentials.getUserToken(), `credentials: Cannot get UserToken while logging out`);
        });
      });

      it(`resolves with the token identified by the specified scopes`, () => Promise.all([
        assert.becomes(spark.credentials.getUserToken(apiScope), apiToken),
        assert.becomes(spark.credentials.getUserToken(`spark:kms`), kmsToken)
      ]));

      describe(`when no matching token is found`, () => {
        it(`downscopes the supertoken`, () => spark.credentials.getUserToken(`spark:people_read`)
          .then(() => {
            assert.calledOnce(supertoken.downscope);
            assert.calledWith(supertoken.downscope, `spark:people_read`);
          }));
      });

      describe(`when no scope is specified`, () => {
        it(`resolves with a token containing all but the kms scopes`, () => assert.isFulfilled(spark.credentials.getUserToken())
            .then((token) => assert.equal(token.access_token, apiToken.access_token)));
      });

      describe(`when the kms downscope request fails`, () => {
        beforeEach(() => {
          spark.credentials.userTokens.remove(`spark:kms`);
          assert.isUndefined(spark.credentials.userTokens.get(`spark:kms`));
          supertoken.downscope.restore();
          sinon.stub(supertoken, `downscope`);
          supertoken.downscope.returns(Promise.reject(new grantErrors.InvalidScopeError({
            statusCode: 400,
            body: {
              error: `fake error`
            }
          })));
        });

        // Note: don't use becomes here. they are different state objects, so
        // they have different cids. as such, the assertion fails, but then
        // hangs (I think) because there's a recursive loop trying to render the
        // diff.
        it(`falls back to the supertoken`, () => assert.isFulfilled(spark.credentials.getUserToken(`spark:kms`))
          .then((token) => assert.deepEqual(token.serialize(), supertoken.serialize())));
      });

      it(`blocks while a token refresh is inflight`, () => {
        const defer = new Defer();
        // For reasons not entirely clear, supertoken.returns doesn't seem to
        // work, so we need to restore and restub it.
        Token.prototype.downscope.restore();
        sinon.stub(Token.prototype, `downscope`).returns(defer.promise);

        spark.credentials.refresh()
          .catch((reason) => {
            console.error(reason);
          });

        const promise1 = spark.credentials.getUserToken();
        const promise2 = spark.credentials.getUserToken();

        const nextApiToken = makeToken(apiScope, spark);
        defer.resolve(nextApiToken);

        return Promise.all([promise1, promise2])
          .then(([a1, a2]) => {
            assert.equal(a1, nextApiToken);
            assert.equal(a2, nextApiToken);
          });
      });

      it(`blocks while a token exchange is in flight`, () => {
        const defer = new Defer();
        spark.credentials.unset(`supertoken`);
        spark.credentials.userTokens.reset();

        spark.request.returns(defer.promise);

        spark.credentials.requestAuthorizationCodeGrant({code: 5});

        const promise1 = spark.credentials.getUserToken();
        const promise2 = spark.credentials.getUserToken();

        defer.resolve({
          statusCode: 200,
          body: {
            access_token: `AT2`,
            token_type: `Fake`,
            expires_in: 10000
          }
        });

        return Promise.all([promise1, promise2])
          .then(([a1, a2]) => {
            assert.equal(a1, nextApiToken);
            assert.equal(a2, nextApiToken);
          });
      });
    });

    describe(`#initialize()`, () => {
      [
        {
          msg: `accepts an access_token`,
          credentials: {
            access_token: `Fake ST`
          }
        },
        {
          msg: `accepts a supertoken`,
          credentials: {
            supertoken: {
              access_token: `ST`,
              token_type: `Fake`
            }
          }
        },
        {
          msg: `accepts an authorization`,
          credentials: {
            authorization: {
              access_token: `ST`,
              token_type: `Fake`
            }
          }
        },
        {
          msg: `accepts an authorization with a supertoken`,
          credentials: {
            authorization: {
              supertoken: {
                access_token: `ST`,
                token_type: `Fake`
              }
            }
          }
        }
      ]
        .forEach(({msg, credentials}) => {
          it(msg, () => {
            const s = new CiscoSpark({credentials});
            assert.isTrue(s.canAuthorize);
            assert.equal(s.credentials.supertoken.access_token, `ST`);
            assert.equal(s.credentials.supertoken.token_type, `Fake`);
          });
        });

      it(`accepts a complete set of credentials`, () => {
        const credentials = {
          authorization: {
            supertoken: {
              access_token: `ST`,
              scope: process.env.CISCOSPARK_SCOPE
            },
            apiToken: {
              access_token: `AT`,
              scope: apiScope
            },
            kmsToken: {
              access_token: `KT`,
              scope: `spark:kms`
            }
          }
        };

        const s = new CiscoSpark({credentials});
        assert.equal(s.credentials.supertoken.access_token, `ST`);
        assert.equal(s.credentials.supertoken.token_type, `Bearer`);
        assert.equal(s.credentials.userTokens.get(apiScope).access_token, `AT`);
        assert.equal(s.credentials.userTokens.get(apiScope).token_type, `Bearer`);
        assert.equal(s.credentials.userTokens.get(`spark:kms`).access_token, `KT`);
        assert.equal(s.credentials.userTokens.get(`spark:kms`).token_type, `Bearer`);
      });
    });

    describe(`#refresh()`, () => {

      describe(`when logging out`, () => {
        it(`rejects refresh`, () => {
          spark.credentials.isLoggingOut = true;
          return assert.isRejected(spark.credentials.refresh(), `credentials: Cannot refresh while logging out`);
        });
      });

      it(`sets #isRefreshing`, () => {
        spark.set({
          credentials: {
            supertoken: {
              access_token: `AT`,
              token_type: `Fake`,
              refresh_token: `RT`
            }
          }
        });
        const promise = spark.credentials.refresh();
        assert.isTrue(spark.credentials.isRefreshing);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isRefreshing));
      });
    });

    describe(`#buildOAuthUrl`, () => {
      it(`requires a \`state\` to be an object`, () => {
        assert.throws(() => {spark.credentials.buildOAuthUrl({state: `state`});}, /if specified, `options.state` must be an object/);
      });

      it(`requires a \`response_type\``, () => {
        assert.throws(() => {spark.credentials.buildOAuthUrl({state: {}});}, /`options.response_type` is required/);
      });

    });

    describe(`#requestAuthorizationCodeGrant`, () => {
      it(`requires a \`code\``, () => {
        return assert.isRejected(spark.credentials.requestAuthorizationCodeGrant(), /`options.code` is required/);
      });

      it(`sets #isAuthenticating`, () => {
        const promise = spark.credentials.requestAuthorizationCodeGrant({code: 5});
        assert.isTrue(spark.credentials.isAuthenticating);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isAuthenticating));
      });
    });

    describe(`#_getSamlBearerToken`, () => {
      it(`requires an \`orgId\``, () => {
        return assert.isRejected(spark.credentials._getSamlBearerToken({}), /`options.orgId` is required/);
      });

      it(`requires a \`name\``, () => {
        return assert.isRejected(spark.credentials._getSamlBearerToken({orgId: 123}), /`options.name` is required/);
      });

      it(`requires a \`password\``, () => {
        return assert.isRejected(spark.credentials._getSamlBearerToken({orgId: 123, name: `name`}), /`options.password` is required/);
      });

    });

    describe(`#logout`, () => {

      // logout redirect only happens in browser
      browserOnly(it)(`revokes the access token`, () => {
        spark.set({
          credentials: {
            supertoken: {
              access_token: `AT`,
              token_type: `Fake`,
              refresh_token: `RT`
            }
          }
        });
        spark.credentials._redirect = sinon.spy();
        assert.isDefined(spark.credentials.supertoken);
        return spark.credentials.logout()
          .then(() => {
            assert.isUndefined(spark.credentials.supertoken.access_token);
            assert.calledOnce(spark.credentials._redirect);
          });
      });

      nodeOnly(it)(`revokes the access token`, () => {
        spark.set({
          credentials: {
            supertoken: {
              access_token: `AT`,
              token_type: `Fake`,
              refresh_token: `RT`
            }
          }
        });
        spark.credentials._redirect = sinon.spy();
        assert.isDefined(spark.credentials.supertoken);
        return spark.credentials.logout()
          .then(() => {
            assert.isUndefined(spark.credentials.supertoken.access_token);
            assert.notCalled(spark.credentials._redirect);
          });
      });

      describe(`when noRedirect:true`, () => {
        it(`revokes the access token, but does not redirect user`, () => {
          spark.set({
            credentials: {
              supertoken: {
                access_token: `AT`,
                token_type: `Fake`,
                refresh_token: `RT`
              }
            }
          });
          spark.credentials._redirect = sinon.spy();
          assert.isDefined(spark.credentials.supertoken);
          return spark.credentials.logout({noRedirect: true})
            .then(() => {
              assert.isUndefined(spark.credentials.supertoken.access_token);
              assert.notCalled(spark.credentials._redirect);
            });
        });

        it(`resolves successfully even if supertoken is not defined`, () => {
          spark.credentials._redirect = sinon.spy();
          assert.isUndefined(spark.credentials.supertoken);
          return spark.credentials.logout({noRedirect: true})
          .then(() => {
            assert.isUndefined(spark.credentials.supertoken);
            assert.notCalled(spark.credentials._redirect);
          });
        });
      });
    });

    describe(`#receiveSupertoken`, () => {
      it(`sets the supertoken`, () => {
        const token = {
          access_token: `ST`,
          token_type: `Fake`,
          expires_in: 6000,
          refresh_token: `RT`,
          refresh_token_expires_in: 24000,
          hasPassword: true
        };
        const s = new CiscoSpark();
        assert.isFalse(s.hasPassword);
        assert.isFalse(s.canAuthorize);
        assert.isUndefined(s.credentials.supertoken);
        assert.isUndefined(s.credentials.supertoken);
        return s.credentials.receiveSupertoken(token)
          .then(() => {
            assert.isTrue(s.hasPassword);
            assert.isTrue(s.canAuthorize);
            assert.equal(s.credentials.supertoken.access_token, `ST`);
            assert.equal(s.credentials.supertoken.token_type, `Fake`);
          });
      });
    });

    describe(`#setPasswordStatus`, () => {
      it(`sets the password status`, () => {
        const credentials = {
          authorization: {
            supertoken: {
              access_token: `ST`,
              token_type: `Fake`
            }
          }
        };
        const s = new CiscoSpark({credentials});
        assert.isTrue(s.canAuthorize);
        assert.equal(s.credentials.supertoken.access_token, `ST`);
        assert.equal(s.credentials.supertoken.token_type, `Fake`);
        assert.isFalse(s.credentials.hasPassword);
        s.credentials.setPasswordStatus(true);
        assert.isTrue(s.credentials.hasPassword);
      });

      it(`does not set the password status if supertoken doesn't exist`, () => {
        const s = new CiscoSpark();
        assert.isUndefined(s.credentials.supertoken);
        s.credentials.setPasswordStatus(true);
        assert.isUndefined(s.credentials.supertoken);
      });
    });
  });
});
