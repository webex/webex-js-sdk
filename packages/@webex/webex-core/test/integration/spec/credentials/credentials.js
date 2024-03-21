/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import WebexCore from '@webex/webex-core';
import refreshCallback from '@webex/test-helper-refresh-callback';

/* eslint camelcase: [0] */

describe('webex-core', () => {
  describe('Credentials', () => {
    let user;

    before(() =>
      testUsers.create({count: 1}).then(([u]) => {
        user = u;
      })
    );

    describe('#config', () => {
      let webex;

      it('should accept an authorizationString to set authorizeUrl', () => {
        const authorizeUrl = 'https://api.example.com/v1/auth';

        webex = new WebexCore({
          config: {
            credentials: {
              authorizationString: `${authorizeUrl}?example=value`,
            },
          },
        });

        assert.equal(webex.config.credentials.authorizeUrl, authorizeUrl);
      });
    });

    describe('#determineOrgId()', () => {
      let credentials;
      let webex;

      beforeEach('generate the webex instance', () => {
        webex = new WebexCore({
          credentials: user.token,
        });

        credentials = webex.credentials;
      });

      it('should return the OrgId of a client authenticated user', () => {
        const orgId = credentials.getOrgId();

        assert.equal(orgId, user.orgId);
      });
    });

    describe('#extractOrgIdFromJWT()', () => {
      let credentials;
      let webex;

      beforeEach('generate a JWT and Webex Instance', () => {
        webex = new WebexCore({
          credentials: user.token,
        });

        credentials = webex.credentials;
      });

      it('should return the OrgId of the provided JWT', () => {
        // The access token in a client-auth scenario is a JWT.
        const token = user.token.access_token;

        assert.equal(credentials.extractOrgIdFromJWT(token), user.orgId);
      });
    });

    describe('#extractOrgIdFromUserToken()', () => {
      let credentials;
      let webex;

      beforeEach('define webex', () => {
        webex = new WebexCore({
          credentials: user.token,
        });

        credentials = webex.credentials;
      });

      it('should return the OrgId when the provided token is valid', () => {
        // The refresh token is formatted like a normal user token.
        const token = user.token.refresh_token;

        assert.equal(credentials.extractOrgIdFromUserToken(token), user.orgId);
      });
    });

    describe('#refresh()', () => {
      nodeOnly(it)('refreshes an access token', () => {
        const webex = new WebexCore({
          credentials: user.token,
        });

        return webex.credentials.refresh().then(() => {
          assert.isDefined(user.token.access_token);
          assert.isDefined(webex.credentials.supertoken.access_token);
          assert.notEqual(webex.credentials.supertoken.access_token, user.token.access_token);
        });
      });

      browserOnly(it)('throws without a refresh callback', () => {
        const webex = new WebexCore({
          credentials: user.token,
        });

        return assert.isRejected(webex.credentials.refresh());
      });

      browserOnly(it)('refreshes with a refresh callback', () => {
        const webex = new WebexCore({
          credentials: user.token,
          config: {
            credentials: {
              refreshCallback,
            },
          },
        });

        return webex.credentials.refresh().then(() => {
          assert.isDefined(user.token.access_token);
          assert.isDefined(webex.credentials.supertoken.access_token);
          assert.notEqual(webex.credentials.supertoken.access_token, user.token.access_token);
        });
      });
    });
  });
});
