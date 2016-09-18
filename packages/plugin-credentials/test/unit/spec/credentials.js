/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import uuid from 'uuid';
import {grantErrors} from '@ciscospark/spark-core';
import {
  apiScope,
  Credentials,
  Token
} from '../..';

describe(`plugin-credentials`, () => {
  describe(`Credentials`, () => {
    function makeToken(scope, spark) {
      return new Token({
        access_token: `AT-${uuid.v4()}`,
        token_type: `Fake`,
        expires_in: `6000`,
        refresh_token: `RT`,
        refresh_token_expires_in: `24000`,
        scope
      }, {parent: spark});
    }

    beforeEach(() => {
      sinon.stub(Token.prototype, `downscope`, (scope) => {
        return Promise.resolve(makeToken(scope, this));
      });
    });

    afterEach(() => {
      Token.prototype.downscope.restore();
    });

    describe(`getUserToken`, () => {
      let spark;
      let apiToken, kmsToken, supertoken;
      beforeEach(() => {
        spark = new MockSpark({
          credentials: Credentials
        });

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

      it(`blocks while a token refresh is inflight`);
      it(`blocks while a token exchange is in flight`);
    });

    describe(`#initialize()`, () => {
      it(`handles all the possible shapes of cached credentials`);
    });

    describe(`#refresh()`, () => {
      it(`sets #isRefreshing`);
    });

    describe(`#requestAuthorizationCodeGrant`, () => {
      it(`sets #isAuthenticating`);
    });

    describe(`#requestSamlExtensionGrant`, () => {
      it(`sets #isAuthenticating`);
    });
  });
});
