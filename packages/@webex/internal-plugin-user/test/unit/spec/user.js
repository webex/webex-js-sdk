/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import UserService from '@webex/internal-plugin-user';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import uuid from 'uuid';

describe('plugin-user', () => {
  describe('User', () => {
    let webex, userService;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          user: UserService
        }
      });

      userService = webex.internal.user;
    });

    describe('#activate()', () => {
      it('requires a `verificationToken` or a confirmationCode + user id', () => {
        assert.isRejected(userService.activate(), /either options.verificationToken is required or both options.confirmationCode and options.id are required/);
      });
    });

    describe('#asUUID()', () => {
      it('requires a `user`', () => assert.isRejected(userService.asUUID(), /`user` is required/));

      it('requires a `user` in the array', () => assert.isRejected(userService.asUUID(['']), /`user` is required/));

      it('requires a valid email', () => assert.isRejected(userService.asUUID('not valid email'), /Provided user object does not appear to identify a user/));

      it('resolves id if id is passed', () => {
        const id = uuid.v4();

        return userService.asUUID(id)
          .then((res) => {
            assert.equal(res, id);
          });
      });
    });

    describe('#recordUUID()', () => {
      it('requires a `user`', () => assert.isRejected(userService.recordUUID(), /`user` is required/));

      it('requires an `id`', () => assert.isRejected(userService.recordUUID({}), /`user.id` is required/));

      it('requires the `id` to be a uuid', () => assert.isRejected(userService.recordUUID({
        id: 'not a uuid'
      }), /`user.id` must be a uuid/));

      it('requires an `emailAddress`', () => assert.isRejected(userService.recordUUID({
        id: uuid.v4()
      }), /`user.emailAddress` is required/));

      it('requires the `emailAddress` to be a uuid', () => assert.isRejected(userService.recordUUID({
        id: uuid.v4(),
        emailAddress: 'not an email address'
      }), /`user.emailAddress` must be an email address/));

      it('places the user in the userstore', () => {
        const spy = sinon.stub(userService.store, 'add').returns(Promise.resolve());

        const user = {
          id: uuid.v4(),
          emailAddress: 'test@example.com'
        };

        userService.recordUUID(user);

        assert.calledWith(spy, user);
      });
    });

    describe('#generateOTP()', () => {
      it('requires one of `email` or `id`', () => assert.isRejected(userService.generateOTP(), /One of `options.email` or `options.id` is required/));
    });

    describe('#validateOTP()', () => {
      it('requires one of `email` or `id` and `oneTimePassword`', () => assert.isRejected(userService.validateOTP(), /One of `options.email` or `options.id` and `options.oneTimePassword` are required/));
      it('requires one of `email` or `id` even when otp is given', () => assert.isRejected(userService.validateOTP({oneTimePassword: '123456'}), /One of `options.email` or `options.id` and `options.oneTimePassword` are required/));
      it('requires oneTimePassword even when email is given', () => assert.isRejected(userService.validateOTP({email: 'example@test.com'}), /One of `options.email` or `options.id` and `options.oneTimePassword` are required/));
      it('requires oneTimePassword even when id is given', () => assert.isRejected(userService.validateOTP({id: 'some-fake-id'}), /One of `options.email` or `options.id` and `options.oneTimePassword` are required/));
    });

    describe('#setPassword()', () => {
      it('requires a `password`', () => assert.isRejected(userService.setPassword(), /`options.password` is required/));
    });

    describe('#update()', () => {
      it('requires a `displayName`', () => assert.isRejected(userService.update(), /`options.displayName` is required/));
    });

    describe('#updateName()', () => {
      it('requires one of `givenName` `familyName` or `displayName`', () => assert.isRejected(userService.updateName(), /One of `givenName` and `familyName` or `displayName` is required/));
    });

    describe('#verify()', () => {
      it('requires an `email` param', () => assert.isRejected(userService.verify(), /`options.email` is required/));
    });
  });
});
