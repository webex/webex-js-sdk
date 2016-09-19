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

    beforeEach(() => {
      sinon.stub(Token.prototype, `downscope`, (scope) => {
        return Promise.resolve(makeToken(scope, this));
      });
    });

    afterEach(() => {
      if (Token.prototype.downscope.restore) {
        Token.prototype.downscope.restore();
      }
    });

    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          credentials: Credentials
        }
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

      it(`resolves with the token identified by the specified scopes`, () => Promise.all([
        assert.becomes(spark.credentials.getUserToken(apiScope), apiToken),
        assert.becomes(spark.credentials.getUserToken(`spark:kms`), kmsToken)
      ]));

      describe(`when no matching token is found`, () => {
        it(`downscopes the supertoken`, () => spark.credentials.getUserToken(`spark:people_read`)
          .then(() => {
            assert.calledOnce(supertoken.downscope);
            assert.calledWith(`spark:people_read`);
          }));
      });

      describe(`when no scope is specified`, () => {
        it(`resolves with a token containing all but the kms scopes`, () => assert.becomes(spark.credentials.getUserToken(), apiToken));
      });

      describe(`when the kms downscope request fails`, () => {
        beforeEach(() => {
          spark.credentials.userTokens.remove(`spark:kms`);
          assert.isUndefined(spark.credentials.userTokens.get(`spark:kms`));
          supertoken.downscope.returns(Promise.reject(new grantErrors.InvalidScopeError()));
        });

        it(`falls back to the supertoken`, () => assert.becomes(spark.credentials.getUserToken(`spark:kms`), supertoken));
      });

      it(`blocks while a token refresh is inflight`, () => {
        const defer = new Defer();
        // For reasons not enitrely clear, supertoken.returns doesn't seem to
        // work, so we need to restore and restub it.
        spark.credentials.supertoken.downscope.restore();
        sinon.stub(spark.credentials.supertoken, `downscope`).returns(defer.promise);
        // spark.credentials.supertoken.downscope.returns(defer.promise);

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
            assert.equal(a1, a2);
            assert.equal(a1.access_token, `AT2`);
            assert.equal(a2.access_token, `AT2`);
          });
      });

      it(`blocks while a token exchange is in flight`, () => {
        const defer = new Defer();
        spark.credentials.unset(`supertoken`);

        spark.request.returns(defer);

        spark.requestAuthorizationCodeGrant({code: 5});

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
            assert.equal(a1, a2);
            assert.equal(a1.access_token, `AT2`);
            assert.equal(a2.access_token, `AT2`);
          });
      });
    });

    describe(`#initialize()`, () => {
      it(`handles all the possible shapes of cached credentials`, () => {
        [
          {
            access_token: `ST`
          },
          {
            supertoken: {
              access_token: `ST`
            }
          },
          {
            authorization: {
              supertoken: {
                access_token: `ST`
              }
            }
          }
        ].forEach((credentials) => {
          const s = new CiscoSpark({credentials});
          assert.equal(s.credentials.supertoken.access_token, `ST`);
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
        assert.equal(s.credentials.userTokens.get(apiScope).access_token, `AT`);
        assert.equal(s.credentials.userTokens.get(`spark:kms`).access_token, `KT`);
      });
    });

    describe(`#refresh()`, () => {
      it(`sets #isRefreshing`, () => {
        const promise = spark.credentials.refresh();
        assert.isTrue(spark.credentials.isRefreshing);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isRefreshing));
      });
    });

    describe(`#requestAuthorizationCodeGrant`, () => {
      it(`sets #isAuthenticating`, () => {
        const promise = spark.credentials.requestAuthorizationCodeGrant();
        assert.isTrue(spark.credentials.isAuthenticating);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isAuthenticating));
      });
    });

    describe(`#requestSamlExtensionGrant`, () => {
      it(`sets #isAuthenticating`, () => {
        const promise = spark.credentials.requestSamlExtensionGrant();
        assert.isTrue(spark.credentials.isAuthenticating);
        return assert.isFulfilled(promise)
          .then(() => assert.isFalse(spark.credentials.isAuthenticating));
      });
    });
  });
});
