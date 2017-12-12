/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@ciscospark/test-helper-chai';
import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import Authorization from '@ciscospark/plugin-authorization-node';
import {Credentials} from '@ciscospark/spark-core';

browserOnly(describe)('hack', () => {
  it('prevents the suite from crashing', () => assert(true));
});

nodeOnly(describe)('plugin-authorization-node', () => {
  describe('Authorization', () => {
    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          authorization: Authorization,
          credentials: Credentials
        }
      });

      spark.request.returns(Promise.resolve({
        statusCode: 200,
        body: {
          access_token: 'AT3',
          token_type: 'Fake'
        }
      }));
    });

    describe('#requestAuthorizationCodeGrant', () => {
      it('requires a `code`', () => assert.isRejected(spark.authorization.requestAuthorizationCodeGrant(), /`options.code` is required/));

      it('exchanges an authorization code for an access token', () => spark.authorization.requestAuthorizationCodeGrant({code: 1})
        .then(() => assert.equal(spark.credentials.supertoken.access_token, 'AT3')));

      it('sets #isAuthenticating', () => {
        const promise = spark.authorization.requestAuthorizationCodeGrant({code: 5});
        assert.isTrue(spark.authorization.isAuthenticating);
        return promise
          .then(() => assert.isFalse(spark.authorization.isAuthenticating));
      });

      it('sets #isAuthorizing', () => {
        const promise = spark.authorization.requestAuthorizationCodeGrant({code: 5});
        assert.isTrue(spark.authorization.isAuthorizing);
        return promise
          .then(() => assert.isFalse(spark.authorization.isAuthorizing));
      });
    });
  });
});
