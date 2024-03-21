/* eslint-disable no-underscore-dangle */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env mocha */
/* eslint camelcase: [0] */

const assert = require('assert');

const _ = require('lodash');
const retry = require('@webex/test-helper-retry');
const {
  createTestUser,
  removeTestUser,
  createWhistlerTestUser,
  removeWhistlerTestUser,
} = require('@webex/test-users');

const allUsers = [];

if (after) {
  after(function () {
    /* eslint no-invalid-this: [0] */
    this.timeout(120000);
    allUsers.forEach(
      (user) =>
        user.webex && user.webex.internal.mercury && user.webex.internal.mercury.disconnect()
    );

    return _remove(allUsers);
  });
}

/**
 * Helper
 * @param {Object} options
 * @param {number} options.count amount of users to create
 * @param {boolean} options.whistler use Whistler Service to generate test users
 * @param {Object} options.config configuration to pass to test-users library
 * see test-users package for full options
 * @private
 * @returns {Promise<Array<User>>}
 */
function _create(options) {
  options = options || {};
  let {count} = options;

  if (!count) {
    count = 1;
  }

  const promises = [];

  for (let i = 0; i < count; i += 1) {
    promises.push(retry(makeUser));
  }

  return Promise.all(promises);

  /**
   * Helper
   * @private
   * @returns {Promise<User>}
   */
  function makeUser() {
    const config = _.defaults(
      {
        scopes: process.env.WEBEX_SCOPE,
      },
      options.config
    );

    return options.whistler
      ? createWhistlerTestUser(config).then((user) => {
          allUsers.push(user);

          return user;
        })
      : createTestUser(config).then((user) => {
          allUsers.push(user);

          return user;
        });
  }
}

/**
 * Helper
 * @param {Array<User>} users
 * @returns {Promise}
 */
function _remove(users) {
  return Promise.all(
    users.map(async (user) => {
      // Check if user was created using whistler
      if (user.reservationUrl) {
        await removeWhistlerTestUser(user).catch((reason) => {
          console.warn('failed to delete test user', reason);
        });
      } else {
        if (user.token && !user.token.authorization) {
          Reflect.deleteProperty(user, 'token');
        }

        await removeTestUser(user).catch((reason) => {
          console.warn('failed to delete test user', reason);
        });
      }

      // Edge times out waiting for the delete calls to complete (and test user
      // deletion isn't really something we need to wait for anyway) so we'll just
      // give enough time for the requests to go out, then allow the browser to
      // close, even if the requests haven't returned.
      return new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    })
  );
}

module.exports = {
  create: (options) => {
    assert(process.env.WEBEX_CLIENT_ID, 'WEBEX_CLIENT_ID must be defined');
    assert(process.env.WEBEX_CLIENT_SECRET, 'WEBEX_CLIENT_SECRET must be defined');

    return _create(options);
  },
  remove: _remove,
};
