/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var helpers = require('../../../lib/helpers');
var MockSpark = require('../../../lib/mock-spark');
var UserService = require('../../../../../src/client/services/user');
var uuid = require('uuid');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('User', function() {
    var userService;

    beforeEach(function() {
      var spark = new MockSpark({
        children: {
          user: UserService
        }
      });

      userService = spark.user;
    });

    describe('#getUUID()', function() {
      it('requires a user', function() {
        return assert.isRejected(userService.getUUID(), /`user` is a required parameter/);
      });

      it('shortcircuits if the user already has a user id', function() {
        return Promise.all([
          assert.isFulfilled(userService.getUUID(uuid.v4())),
          assert.isFulfilled(userService.getUUID({id: uuid.v4()})),
          assert.isFulfilled(userService.getUUID({entryUUID: uuid.v4()}))
        ]);
      });

      it('treats `entryUUID` as the user\'s canonnical uuid', function() {
        var id = uuid.v4();
        var entryUUID = uuid.v4();

        var user = {
          id: id,
          entryUUID: entryUUID
        };

        assert.becomes(userService.getUUID(user), entryUUID);
      });

      it('requires an email or uuid', function() {
        return Promise.all([
          assert.isRejected(userService.getUUID('not a useful id'), /provided email address does not appear to identify a valid user/),
          assert.isRejected(userService.getUUID({email: 'not a useful id'}), /provided email address does not appear to identify a valid user/),
          assert.isRejected(userService.getUUID({emailAddress: 'not a useful id'}), /provided email address does not appear to identify a valid user/),
          assert.isRejected(userService.getUUID({entryEmail: 'not a useful id'}), /provided email address does not appear to identify a valid user/),
          assert.isRejected(userService.getUUID({id: 'not a useful id'}), /provided email address does not appear to identify a valid user/)
        ]);
      });
    });

    describe('#recordUUID()', function() {
      it('requires a `user`', function() {
        return assert.isRejected(userService.recordUUID(), /`user` is required/);
      });

      it('requires an `id`', function() {
        return assert.isRejected(userService.recordUUID({}, /`user.id` is required/));
      });

      it('requires the `id` to be a uuid', function() {
        return assert.isRejected(userService.recordUUID({
          id: 'not a uuid'
        }, /`user.id` must be a uuid/));
      });

      it('requires an `emailAddress`', function() {
        return assert.isRejected(userService.recordUUID({
          id: uuid.v4()
        }, /`user.emailAddress` is required/));
      });

      it('requires the `emailAddress` to be a uuid', function() {
        return assert.isRejected(userService.recordUUID({
          id: uuid.v4(),
          emailAddress: 'not an email address'
        }, /`user.emailAddress` must be an email address/));
      });

      it('places the user in the userstore', function() {
        var spy = sinon.stub(userService.userstore, 'add').returns(Promise.resolve());

        var user = {
          id: uuid.v4(),
          emailAddress: 'test@example.com'
        };

        userService.recordUUID(user);

        assert.calledWith(spy, user);
      });
    });

    describe('#register()', function() {
      it('requires an `email` param', function() {
        return helpers.requiresParam(function() {
          return userService.register();
        }, 'email');
      });
    });

    describe('#activate()', function() {
      it('requires an `encryptedQueryString`', function() {
        return helpers.requiresParam(function() {
          return userService.activate();
        }, 'encryptedQueryString');
      });
    });

    describe('#update()', function() {
      it('requires a `displayName`', function() {
        return helpers.requiresParam(function() {
          return userService.update();
        }, 'displayName');
      });

      it('rejects with a reason', function() {
        sinon.stub(userService, 'request').returns(Promise.reject('error message'));
        return assert.isRejected(userService.update({
          displayName: 'New Name'
        }), /failed to update user: error message/);
      });
    });

  });
});
