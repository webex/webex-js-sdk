/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/plugin-authorization-node';
import {nodeOnly} from '@webex/test-helper-mocha';
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import {createUser} from '@webex/test-helper-appid';
import WebexCore, {filterScope} from '@webex/webex-core';
import uuid from 'uuid';
import sinon from 'sinon';

const apiScope = filterScope('spark:kms', process.env.WEBEX_SCOPE);

nodeOnly(describe)('plugin-authorization-node', () => {
  describe('Authorization', () => {
    describe('#logout()', () => {
      let webex, spock;

      beforeEach('create authorized webex user', () =>
        testUsers.create({count: 1}).then(([u]) => {
          spock = u;
          webex = new WebexCore({credentials: spock.token});
        })
      );

      it("invalidates all of the use's tokens", () => {
        sinon.spy(webex.authorization, 'logout');
        sinon.spy(webex, 'logout');

        return webex.logout().then(() => {
          assert.called(webex.logout);
          assert.called(webex.authorization.logout);
        });
      });
    });

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

    describe('#requestAuthorizationCodeGrant()', () => {
      describe('when the user has the webex entitlement', () => {
        let code, webex;

        beforeEach('create auth code only test user', () =>
          testUsers.create({config: {authCodeOnly: true}}).then(([u]) => {
            webex = new WebexCore();
            code = u.token.auth_code;
          })
        );

        it('exchanges an authorization code for an access token', () =>
          webex.authorization.requestAuthorizationCodeGrant({code}).then(() => {
            assert.isDefined(webex.credentials.supertoken);

            return Promise.all([
              webex.credentials.getUserToken(apiScope),
              webex.credentials.getUserToken('spark:kms'),
            ]);
          }));
      });

      describe('when the user does not have the webex entitlement', () => {
        let code, webex;

        beforeEach('create non-webex-entitled test user', () =>
          testUsers
            .create({
              config: {
                // We omit the webex entitlment so that CI gives us a token lacking
                // spark:* scopes
                entitlements: [
                  'squaredCallInitiation',
                  'squaredRoomModeration',
                  'squaredInviter',
                  'webExSquared',
                ],
                authCodeOnly: true,
              },
            })
            .then(([u]) => {
              webex = new WebexCore();
              code = u.token.auth_code;
            })
        );

        it('exchanges an authorization code for an access token', () =>
          webex.authorization.requestAuthorizationCodeGrant({code}).then(() => {
            assert.isDefined(webex.credentials.supertoken);

            return Promise.all([
              webex.credentials
                .getUserToken(apiScope)
                .then((token) =>
                  assert.equal(token.access_token, webex.credentials.supertoken.access_token)
                ),
              webex.credentials
                .getUserToken('spark:kms')
                .then((token) =>
                  assert.equal(token.access_token, webex.credentials.supertoken.access_token)
                ),
            ]);
          }));
      });
    });
  });
});
