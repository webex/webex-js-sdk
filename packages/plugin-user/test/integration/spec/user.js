/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import {patterns} from '@ciscospark/common';
import uuid from 'uuid';
import {nodeOnly} from '@ciscospark/test-helper-mocha';

describe(`plugin-user`, function() {
  this.timeout(30000);

  let spark, user2, user3;

  before(() => testUsers.create({count: 3})
    .then((users) => {
      const user = users[0];
      user2 = users[1];
      user3 = users[2];
      spark = new CiscoSpark({
        credentials: {
          authorization: user.token
        }
      });
      assert.isTrue(spark.isAuthenticated || spark.canAuthorize);

      return spark.device.register();
    }));

  describe(`#verify()`, () => {
    it(`registers a new user`, () => spark.user.verify({email: `Collabctg+spark-js-sdk-${uuid.v4()}@gmail.com`})
      .then((res) => {
        assert.property(res, `showPasswordPage`);
        assert.isFalse(res.showPasswordPage);

        assert.isFalse(res.showConfirmationCodePage);
        assert.isFalse(res.showPasswordPage);
        assert.isTrue(res.isUserCreated);
        assert.isFalse(res.isSSOUser);
        assert.isTrue(res.newUserSignUp);
      }));

    it(`leaves email address validation up to Atlas`, () => assert.isRejected(spark.user.register({email: `not an email address`}))
      .then((res) => assert.statusCode(res, 400)));
  });

  // This test relies on setting a specific user agent, so it doesn't work in
  // browsers
  nodeOnly(describe)(`#activate()`, () => {
    it(`completes the mobile signup process`, () => spark.request({
      service: `atlas`,
      resource: `users/email/verify`,
      method: `POST`,
      body: {
        deviceName: `DESKTOP`,
        deviceId: `not a mobile device`,
        pushId: `not a mobile device`,
        email: `Collabctg+spark-js-sdk-${uuid.v4()}@gmail.com`
      },
      requiresClientCredentials: true,
      headers: {
        'user-agent': `wx2-android`
      }
    })
      .then((res) => {
        assert.property(res.body, `eqp`);
        return assert.isFulfilled(spark.user.activate({encryptedQueryString: res.body.eqp}));
      })
      .then((res) => spark.user.verify({email: res.email}))
      .then((res) => {
        assert.isFalse(res.showConfirmationCodePage);
        assert.isFalse(res.showPasswordPage);
        assert.isFalse(res.isUserCreated);
        assert.isFalse(res.isSSOUser);
        assert.isFalse(res.newUserSignUp);
      }));
  });

  describe(`#get()`, () => {
    it(`gets the current user`, () => spark.user.get()
      .then((user) => {
        assert.equal(user.id, spark.device.userId);
        assert.property(user, `entitlements`);
        assert.property(user, `email`);
        assert.property(user, `name`);
      }));
  });

  describe(`#asUUID()`, () => {
    function makeEmailAddress() {
      return `spark-js-sdk--test-${uuid.v4()}@example.com`;
    }

    let email;
    beforeEach(() => {
      email = makeEmailAddress();
    });

    it(`maps an email address to a uuid`, () => assert.eventually.equal(spark.user.asUUID(user2, {force: true}), user2.id));

    it(`maps an email address for a non-existent user to a fake uuid`, () => assert.eventually.match(spark.user.asUUID(email), patterns.uuid)
        .then(() => spark.user.store.getByEmail(email))
        .then((u) => assert.isFalse(u.userExists, `User does not exist`)));

    describe(`with {create: true}`, () => {
      let spy;
      beforeEach(() => {
        spy = sinon.spy(spark.user, `fetchUUID`);
      });
      afterEach(() => spy.restore());

      it(`creates a new user`, () => assert.eventually.match(spark.user.asUUID(email, {create: true}), patterns.uuid)
        .then(() => spark.user.store.getByEmail(email))
        .then((u) => assert.isTrue(u.userExists, `User exists`)));

      it(`does not use a cached value if the previous value was marked as non-existent`, () => assert.eventually.match(spark.user.asUUID(email), patterns.uuid)
          .then(() => spark.user.store.getByEmail(email))
          .then((u) => assert.isFalse(u.userExists, `User does not exist`))
          .then(() => spark.user.asUUID(email, {create: true}), patterns.uuid)
          .then(() => spark.user.store.getByEmail(email))
          .then((u) => assert.isTrue(u.userExists, `User exists`))
          .then(() => assert.calledTwice(spy)));

      it(`does not use a cached value if the previous value's existence is unknown`, () => spark.user.recordUUID({
        id: user3.id,
        emailAddress: user3.email
      })
        .then(() => spark.user.store.getByEmail(user3.email))
        .then((user) => assert.isUndefined(user.userExists, `User's existence is unknown`))
        .then(() => assert.eventually.equal(spark.user.asUUID(user3.email, {create: true}), user3.id))
        .then(() => assert.called(spy))
        .then(() => spark.user.store.getByEmail(user3.email))
        .then((user) => assert.isTrue(user.userExists, `User exists`)));
    });
  });

  describe(`#update()`, () => {
    it(`updates a user's name`, () => spark.user.update({displayName: `New Display Name`})
      .then((user) => {
        assert.equal(user.id, spark.device.userId);
        assert.property(user, `entitlements`);
        assert.property(user, `email`);
        assert.property(user, `name`);
        assert.equal(user.name, `New Display Name`);
      }));
  });
});
