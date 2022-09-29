/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@webex/test-helper-chai';
import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import MockWebex from '@webex/test-helper-mock-webex';
import Authorization from '@webex/plugin-authorization-node';
import {Credentials} from '@webex/webex-core';

browserOnly(describe)('hack', () => {
  it('prevents the suite from crashing', () => assert(true));
});

nodeOnly(describe)('plugin-authorization-node', () => {
  describe('Authorization', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          authorization: Authorization,
          credentials: Credentials
        }
      });

      webex.request.returns(Promise.resolve({
        statusCode: 200,
        body: {
          access_token: 'AT3',
          token_type: 'Fake'
        }
      }));
    });

    describe('#requestAuthorizationCodeGrant', () => {
      it('requires a `code`', () => assert.isRejected(webex.authorization.requestAuthorizationCodeGrant(), /`options.code` is required/));

      it('exchanges an authorization code for an access token', () => webex.authorization.requestAuthorizationCodeGrant({code: 1})
        .then(() => assert.equal(webex.credentials.supertoken.access_token, 'AT3')));

      it('sets #isAuthenticating', () => {
        const promise = webex.authorization.requestAuthorizationCodeGrant({code: 5});

        assert.isTrue(webex.authorization.isAuthenticating);

        return promise
          .then(() => assert.isFalse(webex.authorization.isAuthenticating));
      });

      it('sets #isAuthorizing', () => {
        const promise = webex.authorization.requestAuthorizationCodeGrant({code: 5});

        assert.isTrue(webex.authorization.isAuthorizing);

        return promise
          .then(() => assert.isFalse(webex.authorization.isAuthorizing));
      });
    });
  });
});
