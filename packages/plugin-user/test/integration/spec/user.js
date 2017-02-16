/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
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

  let spark, user1, user2, user3;

  before(() => testUsers.create({count: 3})
    .then((users) => {
      user1 = users[0];
      user2 = users[1];
      user3 = users[2];
      spark = new CiscoSpark({
        credentials: {
          supertoken: user1.token
        }
      });
      assert.isDefined(spark.credentials.supertoken);
      assert.isTrue(spark.canAuthorize);

      return spark.device.register();
    }));

  describe(`#verify()`, () => {
    const unauthSpark = new CiscoSpark();
    it(`registers a new user`, () => unauthSpark.user.verify({email: `Collabctg+spark-js-sdk-${uuid.v4()}@gmail.com`})
      .then((res) => {
        assert.property(res, `hasPassword`);
        assert.property(res, `verificationEmailTriggered`);
        assert.property(res, `sso`);
        assert.isFalse(res.hasPassword);
        assert.isTrue(res.verificationEmailTriggered);
        assert.isFalse(res.sso);
      })
    );

    it(`verifies an existing user`, () => unauthSpark.user.verify({email: user1.email})
      .then((res) => {
        assert.property(res, `hasPassword`);
        assert.property(res, `verificationEmailTriggered`);
        assert.property(res, `sso`);
        assert.isTrue(res.hasPassword);
        assert.isFalse(res.verificationEmailTriggered);
        assert.isFalse(res.sso);
      })
    );

    it(`leaves email address validation up to Atlas`, () => assert.isRejected(unauthSpark.user.register({email: `not an email address`}))
      .then((res) => assert.statusCode(res, 400)));
  });

  describe(`#setPassword()`, () => {
    it(`sets the user's password`, () => spark.user.setPassword({userId: user1.id, password: `P@ssword123`})
      .then(() => spark.user.verify({email: user1.email}))
      .then((res) => {
        assert.property(res, `hasPassword`);
        assert.property(res, `verificationEmailTriggered`);
        assert.property(res, `sso`);
        assert.isTrue(res.hasPassword);
        assert.isFalse(res.verificationEmailTriggered);
        assert.isFalse(res.sso);
      })
    );
  });

  // This test relies on setting a specific user agent, so it doesn't work in
  // browsers
  nodeOnly(describe)(`#activate()`, () => {
    it.skip(`retrieves a valid user token using verificationToken`, () => spark.request({
      service: `atlas`,
      resource: `users/email/verify`,
      method: `POST`,
      body: {
        reqId: `DESKTOP`,
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
