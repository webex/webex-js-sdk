/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var chai = require('chai');
var UserStore = require('../../../../../src/client/services/user/user-store');

var assert = chai.assert;
chai.use(require('chai-as-promised'));

describe('Services', function() {
  describe('User', function() {
    describe('UserStore', function() {

      var userStore;
      var user1;
      var user2;

      beforeEach(function() {
        userStore = new UserStore();

        user1 = {
          id: '88888888-4444-4444-4444-aaaaaaaaaaa1',
          emailAddress: 'user1@example.com'
        };

        user2 = {
          id: '88888888-4444-4444-4444-aaaaaaaaaaa2',
          emailAddress: 'user2@example.com'
        };
      });

      describe('#getById()', function() {
        it('gets user by id', function() {
          userStore.usersById = {};
          userStore.usersById[user1.id] = user1;
          userStore.usersById[user2.id] = user2;

          assert.becomes(userStore.getById(user1.id), user1);
          assert.becomes(userStore.getById(user2.id), user2);
        });

        it('rejects an id if it is not valid', function() {
          assert.isRejected(userStore.getById('invalid-id'), /`id` is not a uuid/);
        });

        it('rejects if user is not in the store', function() {
          assert.isRejected(userStore.getById('88888888-4444-4444-4444-aaaaaaaaaaa1'), /'No user found with id "88888888-4444-4444-4444-aaaaaaaaaaa1"'/);
        });
      });

      describe('#getByEmail()', function() {
        it('gets user by email', function() {
          userStore.usersByEmail = {};
          userStore.usersByEmail[user1.emailAddress] = user1;
          userStore.usersByEmail[user2.emailAddress] = user2;

          assert.becomes(userStore.getByEmail(user1.emailAddress), user1);
          assert.becomes(userStore.getByEmail(user2.emailAddress), user2);
        });

        it('rejects an email if it is not valid', function() {
          assert.isRejected(userStore.getByEmail('invalid-email'), /`email` is not an email address/);
        });

        it('rejects if user is not in the store', function() {
          assert.isRejected(userStore.getByEmail('user-not-in-store@cisco.com'), /'No user found with email "user-not-in-store@cisco.com"'/);
        });
      });

      describe('#get()', function() {
        it('gets user by uuid', function() {
          userStore.usersById = {};
          userStore.usersById[user1.id] = user1;

          assert.becomes(userStore.get(user1.id), user1);
        });

        it('gets user by email', function() {
          userStore.usersByEmail = {};
          userStore.usersByEmail[user1.emailAddress] = user1;

          assert.becomes(userStore.get(user1.emailAddress), user1);
        });

        it('rejects if id is neither uuid nor email', function() {
          assert.isRejected(userStore.get('neither-uui-nor-email'), /'`id` does not appear to be a valid identifier'/);
        });
      });

      describe('#add()', function() {
        it('adds a new user to the store', function() {
          return userStore.add(user1)
            .then(function() {
              assert.becomes(userStore.getById(user1.id), user1);
              assert.becomes(userStore.getByEmail(user1.emailAddress), user1);

              assert.deepEqual(userStore.usersById, {
                '88888888-4444-4444-4444-aaaaaaaaaaa1': assign({userExists: undefined}, user1)
              });

              assert.deepEqual(userStore.usersByEmail, {
                'user1@example.com': assign({userExists: undefined}, user1)
              });
            });
        });

        it('adds an existing user to the store', function() {
          return userStore.add(user2)
            .then(function() {
              return userStore.add(user2);
            })
            .then(function() {
              assert.becomes(userStore.getById(user2.id), user2);
              assert.becomes(userStore.getByEmail(user2.emailAddress), user2);

              assert.deepEqual(userStore.usersById, {
                '88888888-4444-4444-4444-aaaaaaaaaaa2': assign({userExists: undefined}, user2)
              });

              assert.deepEqual(userStore.usersByEmail, {
                'user2@example.com': assign({userExists: undefined}, user2)
              });
            });
        });

        it('adds email to the store even if uuid is invalid', function() {
          user1.id = 'invalid-id';
          return userStore.add(user1)
            .then(function() {
              assert.isRejected(userStore.getById(user1.id), /`id` is not a uuid/);
              assert.becomes(userStore.getByEmail(user1.id), user1);

              assert.deepEqual(userStore.usersById, {});

              assert.deepEqual(userStore.usersByEmail, {
                'user1@example.com': assign({userExists: undefined}, user1)
              });
            });
        });

        it('adds uuid to the store even if email is invalid', function() {
          user1.emailAddress = 'invalid-email';
          return userStore.add(user1)
            .then(function() {
              assert.isRejected(userStore.getById(user1.id), user1);
              assert.becomes(userStore.getByEmail(user1.id), /`email` is not an email address/);

              assert.deepEqual(userStore.usersByEmail, {});

              assert.deepEqual(userStore.usersById, {
                '88888888-4444-4444-4444-aaaaaaaaaaa1': assign({userExists: undefined}, user1)
              });
            });
        });

        it('normalizes key of uuid to `id`', function() {
          var user3 = {
            entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaa3',
            emailAddress: 'invalid-email'
          };
          return userStore.add(user3)
            .then(function() {
              assert.deepEqual(userStore.usersById, {
                '88888888-4444-4444-4444-aaaaaaaaaaa3': {
                  id: user3.entryUUID,
                  emailAddress: user3.emailAddress,
                  userExists: undefined
                }
              });
            });
        });

        it('normalizes key of email to `emailAddress`', function() {
          var user3;

          ['entryEmail', 'emailAddress', 'email', 'id'].forEach(function(emailKey) {
            userStore.usersById = {};
            userStore.usersByEmail = {};
            user3 = {
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaa3'
            };

            user3[emailKey] = 'user3@example.com';
            return userStore.add(user3)
              .then(function() {
                assert.deepEqual(userStore.usersById, {
                  '88888888-4444-4444-4444-aaaaaaaaaaa3': {
                    id: user3.entryUUID,
                    emailAddress: user3[emailKey]
                  }
                });
              });
          });
        });

      });

    });
  });
});
