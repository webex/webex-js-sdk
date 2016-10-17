/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {Defer} from '@ciscospark/common';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import uuid from 'uuid';
import CiscoSpark, {grantErrors} from '@ciscospark/spark-core';
import Credentials, {
  apiScope,
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

    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          credentials: Credentials
        }
      });

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
      it(`handles all the possible shapes of cached credentials`, () => {
        [
          {
            access_token: `Fake ST`
          },
          {
            supertoken: {
              access_token: `ST`,
              token_type: `Fake`
            }
          },
          {
            authorization: {
              supertoken: {
                access_token: `ST`,
                token_type: `Fake`
              }
            }
          }
        ].forEach((credentials) => {
          const s = new CiscoSpark({credentials});
          assert.equal(s.credentials.supertoken.access_token, `ST`);
          assert.equal(s.credentials.supertoken.token_type, `Fake`);
        });

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

    describe(`#requestAuthorizationCodeGrant`, () => {
      it(`sets #isAuthenticating`, () => {
        const promise = spark.credentials.requestAuthorizationCodeGrant({code: 5});
        assert.isTrue(spark.credentials.isAuthenticating);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isAuthenticating));
      });
    });
  });
});
