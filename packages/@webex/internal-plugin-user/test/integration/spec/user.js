/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-user';

import querystring from 'querystring';
import url from 'url';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import {patterns} from '@webex/common';
import uuid from 'uuid';
import {merge} from 'lodash';

// Run the tests with and without Federation enabled,
// for test users in EU (Federation) and US
// Also try US user with Federation enabled
const runs = [
  // This line can be ommited until a future pull request is generated to update @ciscospark/test-users-legacy
  // {it: 'with EU user with Federation enabled', EUUser: true, attrs: {config: {credentials: {federation: true}}}},
  {it: 'with US user without Federation enabled', EUUser: false, attrs: {}},
  {
    it: 'with US user with Federation enabled',
    EUUser: false,
    attrs: {config: {credentials: {federation: true}}},
  },
];

runs.forEach((run) => {
  describe(`plugin-user ${run.it}`, function () {
    this.timeout(30000);

    let webex, user1, user2, user3;

    const testUserParm = {count: 3};

    if (run.EUUser) {
      testUserParm.config = {orgId: process.env.EU_PRIMARY_ORG_ID};
    }

    before(() =>
      testUsers.create(testUserParm).then((users) => {
        user1 = users[0];
        user2 = users[1];
        user3 = users[2];
        webex = new WebexCore(
          merge({}, run.attrs, {
            credentials: {
              supertoken: user1.token,
            },
          })
        );
        assert.isDefined(webex.credentials.supertoken);
        assert.isTrue(webex.canAuthorize);
        assert.isFalse(webex.internal.user.hasPassword);

        return webex.internal.device.register();
      })
    );

    describe('#verify()', () => {
      const unauthWebex = new WebexCore(run.attrs);

      it('registers a new user', () =>
        unauthWebex.internal.user
          .verify({email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`})
          .then((res) => {
            assert.property(res, 'hasPassword');
            assert.property(res, 'verificationEmailTriggered');
            assert.property(res, 'sso');
            assert.isFalse(res.hasPassword);
            assert.isTrue(res.verificationEmailTriggered);
            assert.isFalse(res.sso);
            assert.isFalse(webex.internal.user.hasPassword);
          }));

      it('verifies an existing user', () =>
        unauthWebex.internal.user.verify({email: user1.email}).then((res) => {
          assert.property(res, 'hasPassword');
          assert.property(res, 'verificationEmailTriggered');
          assert.property(res, 'sso');
          assert.isTrue(res.hasPassword);
          assert.isFalse(res.verificationEmailTriggered);
          assert.isFalse(res.sso);
          assert.isTrue(unauthWebex.internal.user.hasPassword);
        }));

      it('leaves email address validation up to Atlas', () =>
        assert
          .isRejected(unauthWebex.internal.user.verify({email: 'not an email address'}))
          .then((res) => assert.statusCode(res, 400)));
    });

    describe('#setPassword()', () => {
      it("sets the user's password", () =>
        webex.internal.user
          .setPassword({password: 'P@ssword123'})
          .then(() => webex.internal.user.verify({email: user1.email}))
          .then((res) => {
            assert.property(res, 'hasPassword');
            assert.property(res, 'verificationEmailTriggered');
            assert.property(res, 'sso');
            assert.isTrue(res.hasPassword);
            assert.isFalse(res.verificationEmailTriggered);
            assert.isFalse(res.sso);
            assert.isTrue(webex.internal.user.hasPassword);
          }));
    });

    // NOTE: need collabctg+*@gmail.com to get verifyEmailURL
    describe('#activate()', () => {
      const unauthWebex = new WebexCore(run.attrs);

      it('retrieves a valid user token', () => {
        assert.isUndefined(unauthWebex.credentials.supertoken);
        const email = `collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`;

        return unauthWebex.internal.user
          .verify({email})
          .then((res) => {
            assert.isTrue(res.verificationEmailTriggered);
            assert.property(res, 'verifyEmailURL');
            const {query} = url.parse(res.verifyEmailURL);
            const token = querystring.parse(query).t;

            return unauthWebex.internal.user.activate({email, verificationToken: token});
          })
          .then((res) => {
            assert.property(res, 'email');
            assert.property(res, 'tokenData');
            assert.equal(res.email, email);
            assert.isDefined(unauthWebex.credentials.supertoken.access_token);

            return unauthWebex.internal.user.verify({email});
          })
          .then((res) => {
            // verification email should not trigger if already have valid user token
            assert.property(res, 'hasPassword');
            assert.property(res, 'verificationEmailTriggered');
            assert.property(res, 'sso');
            assert.isFalse(res.hasPassword);
            assert.isFalse(res.verificationEmailTriggered);
            assert.isFalse(res.sso);
            assert.isFalse(unauthWebex.internal.user.hasPassword);
          });
      });

      it('retrieves a valid user token and sets the password', () => {
        const unauthWebex = new WebexCore(run.attrs);

        assert.isUndefined(unauthWebex.credentials.supertoken);
        const email = `collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`;

        return unauthWebex.internal.user
          .verify({email})
          .then((res) => {
            assert.isTrue(res.verificationEmailTriggered);
            assert.property(res, 'verifyEmailURL');
            const {query} = url.parse(res.verifyEmailURL);
            const token = querystring.parse(query).t;

            return unauthWebex.internal.user.activate({email, verificationToken: token});
          })
          .then((res) => {
            assert.property(res, 'email');
            assert.property(res, 'tokenData');
            assert.equal(res.email, email);
            assert.isDefined(unauthWebex.credentials.supertoken.access_token);
          })
          .then(() => unauthWebex.internal.device.register())
          .then(() => unauthWebex.internal.user.get())
          .then((user) =>
            unauthWebex.internal.user.setPassword({email: user.email, password: 'P@ssword123'})
          )
          .then(() => unauthWebex.internal.user.verify({email}))
          .then((res) => {
            assert.property(res, 'hasPassword');
            assert.property(res, 'verificationEmailTriggered');
            assert.property(res, 'sso');
            assert.isTrue(res.hasPassword);
            assert.isFalse(res.verificationEmailTriggered);
            assert.isFalse(res.sso);
            assert.isTrue(unauthWebex.internal.user.hasPassword);
          });
      });
    });

    describe('#generateOTP() and #validateOTP()', () => {
      it('generates and validates OTP', () => {
        const unauthWebex = new WebexCore(run.attrs);

        assert.isUndefined(unauthWebex.credentials.supertoken);
        // NOTE: need collabctg+*@gmail.com to get oneTimePassword
        const email = `collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`;

        return unauthWebex.internal.user
          .verify({email})
          .then((res) => {
            const {query} = url.parse(res.verifyEmailURL);
            const token = querystring.parse(query).t;

            return unauthWebex.internal.user.activate({email, verificationToken: token});
          })
          .then(() => unauthWebex.internal.device.register())
          .then(() => unauthWebex.internal.user.get())
          .then((user) =>
            unauthWebex.internal.user.setPassword({email: user.email, password: 'P@ssword123'})
          )
          .then(() => unauthWebex.internal.user.verify({email}))
          .then(() => unauthWebex.internal.user.generateOTP({email}))
          .then((res) => {
            assert.property(res, 'oneTimePassword');
            assert.property(res, 'email');
            assert.equal(res.email, email);
            assert.property(res, 'id');
            assert.property(res, 'url');
            assert.property(res, 'status');

            return unauthWebex.internal.user.validateOTP({
              email,
              oneTimePassword: res.oneTimePassword,
            });
          })
          .then((res) => {
            assert.property(res, 'email');
            assert.property(res, 'id');
            assert.property(res, 'url');
            assert.property(res, 'tokenData');
            assert.equal(res.email, email);
            assert.equal(res.tokenData.token_type, unauthWebex.credentials.supertoken.token_type);
            assert.equal(res.tokenData.expires_in, unauthWebex.credentials.supertoken.expires_in);
            assert.equal(
              res.tokenData.access_token,
              unauthWebex.credentials.supertoken.access_token
            );
            assert.equal(
              res.tokenData.refresh_token_expires_in,
              unauthWebex.credentials.supertoken.refresh_token_expires_in
            );
          });
      });
    });

    describe('#get()', () => {
      it('gets the current user', () =>
        webex.internal.user.get().then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'entitlements');
          assert.property(user, 'email');
          assert.property(user, 'name');
        }));
    });

    describe('#asUUID()', () => {
      function makeEmailAddress() {
        return `webex-js-sdk--test-${uuid.v4()}@example.com`;
      }

      let email;

      beforeEach(() => {
        email = makeEmailAddress();
      });

      it('maps an email address to a uuid', () =>
        webex.internal.user
          .asUUID(user2, {force: true})
          .then((result) => assert.equal(result, user2.id)));

      it('maps an email address for a non-existent user to a fake uuid', () =>
        webex.internal.user
          .asUUID(email)
          .then((result) => assert.match(result, patterns.uuid))
          .then(() => webex.internal.user.store.getByEmail(email))
          .then((u) => assert.isFalse(u.userExists, 'User does not exist')));

      describe('with {create: true}', () => {
        let spy;

        beforeEach(() => {
          spy = sinon.spy(webex.internal.user, 'fetchUUID');
        });
        afterEach(() => spy.restore());

        it('creates a new user', () =>
          webex.internal.user
            .asUUID(email, {create: true})
            .then((result) => assert.match(result, patterns.uuid))
            .then(() => webex.internal.user.store.getByEmail(email))
            .then((u) => assert.isTrue(u.userExists, 'User exists')));

        it('does not use a cached value if the previous value was marked as non-existent', () =>
          webex.internal.user
            .asUUID(email)
            .then((result) => assert.match(result, patterns.uuid))
            .then(() => webex.internal.user.store.getByEmail(email))
            .then((u) => assert.isFalse(u.userExists, 'User does not exist'))
            .then(() => webex.internal.user.asUUID(email, {create: true}), patterns.uuid)
            .then(() => webex.internal.user.store.getByEmail(email))
            .then((u) => assert.isTrue(u.userExists, 'User exists'))
            .then(() => assert.calledTwice(spy)));

        it("does not use a cached value if the previous value's existence is unknown", () =>
          webex.internal.user
            .recordUUID({
              id: user3.id,
              emailAddress: user3.email,
            })
            .then(() => webex.internal.user.store.getByEmail(user3.email))
            .then((user) => assert.isUndefined(user.userExists, "User's existence is unknown"))
            .then(() =>
              webex.internal.user
                .asUUID(user3.email, {create: true})
                .then((result) => assert.equal(result, user3.id))
            )
            .then(() => assert.called(spy))
            .then(() => webex.internal.user.store.getByEmail(user3.email))
            .then((user) => assert.isTrue(user.userExists, 'User exists')));
      });
    });

    describe('#update()', () => {
      it("updates a user's name", () =>
        webex.internal.user.update({displayName: 'New Display Name'}).then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'entitlements');
          assert.property(user, 'email');
          assert.property(user, 'name');
          assert.equal(user.name, 'New Display Name');
        }));
    });
    describe('#updateName()', () => {
      it("updates a user's displayName", () =>
        webex.internal.user.updateName({displayName: 'New Name'}).then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'displayName');
          assert.equal(user.displayName, 'New Name');
        }));
      it("updates a user's givenName", () =>
        webex.internal.user.updateName({givenName: 'Jack'}).then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'name');
          assert.property(user.name, 'givenName');
          assert.equal(user.name.givenName, 'Jack');
        }));
      it("updates a user's familyName", () =>
        webex.internal.user.updateName({familyName: 'Jill'}).then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'name');
          assert.property(user.name, 'familyName');
          assert.equal(user.name.familyName, 'Jill');
        }));
      it("updates a user's givenName and familyName", () =>
        webex.internal.user.updateName({givenName: 'T', familyName: 'Rex'}).then((user) => {
          assert.equal(user.id, webex.internal.device.userId);
          assert.property(user, 'name');
          assert.property(user.name, 'givenName');
          assert.property(user.name, 'familyName');
          assert.equal(user.name.givenName, 'T');
          assert.equal(user.name.familyName, 'Rex');
        }));
      it("updates a user's givenName familyName and displayName", () =>
        webex.internal.user
          .updateName({givenName: 'Max', familyName: 'Bob', displayName: 'Max Bob'})
          .then((user) => {
            assert.equal(user.id, webex.internal.device.userId);
            assert.property(user, 'displayName');
            assert.equal(user.displayName, 'Max Bob');
            assert.property(user, 'name');
            assert.property(user.name, 'givenName');
            assert.property(user.name, 'familyName');
            assert.equal(user.name.givenName, 'Max');
            assert.equal(user.name.familyName, 'Bob');
          }));
    });
  });
});
