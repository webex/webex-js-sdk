/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/plugin-authorization-node';
import {browserOnly} from '@webex/test-helper-mocha';
import {assert} from '@webex/test-helper-chai';
import {createUser} from '@webex/test-helper-appid';
import WebexCore from '@webex/webex-core';
import uuid from 'uuid';
import sinon from 'sinon';

browserOnly(describe)('plugin-authorization-browser', () => {
  describe('Authorization', () => {
    describe('#requestAccessTokenFromJwt', () => {
      it('exchanges a JWT for an appid access token', () => {
        const userId = uuid.v4();
        const displayName = `test-${userId}`;

        return createUser({displayName, userId}).then(({jwt}) => {
          const webex = new WebexCore();

          return webex.authorization
            .requestAccessTokenFromJwt({jwt})
            .then(() => assert.isTrue(webex.canAuthorize));
        });
      });

      it('should call services#initServiceCatalogs()', () => {
        const webex = new WebexCore();
        const userId = uuid.v4();
        const displayName = `test-${userId}`;

        webex.internal.services.initServiceCatalogs = sinon.spy();

        return createUser({displayName, userId})
          .then(({jwt}) => webex.authorization.requestAccessTokenFromJwt({jwt}))
          .then(() => assert.called(webex.internal.services.initServiceCatalogs));
      });
    });

    describe.skip("'#refresh", () => {
      describe('when used with an appid access token', () => {
        it('refreshes the access token', () => {
          const userId = uuid.v4();
          const displayName = `test-${userId}`;

          return createUser({displayName, userId}).then(({jwt}) => {
            const webex = new WebexCore({
              config: {
                credentials: {
                  jwtRefreshCallback() {
                    return createUser({displayName, userId}).then(({jwt}) => jwt);
                  },
                },
              },
            });
            let token;

            return webex.authorization
              .requestAccessTokenFromJwt({jwt})
              .then(() => {
                token = webex.credentials.supertoken.access_token;
                assert.isTrue(webex.canAuthorize);
              })
              .then(() => webex.refresh())
              .then(() => {
                assert.isTrue(webex.canAuthorize);
                assert.notEqual(webex.credentials.supertoken.access_token, token);
              });
          });
        });
      });
    });
  });
});
