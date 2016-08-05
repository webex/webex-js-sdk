/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

/* eslint-env mocha */
/* eslint camelcase: [0] */

var _ = require('lodash');
var assert = require('assert');
var retry = require('@ciscospark/test-helper-retry');

var tui;
try {
  /* eslint global-require: [0] */
  tui = require('spark-js-sdk--test-users');
}
catch (e) {
  // ignore
}

var allUsers = [];
if (after) {
  after(function() {
    /* eslint no-invalid-this: [0] */
    this.timeout(120000);
    return _remove(allUsers);
  });
}

function _create(options) {
  options = options || {};
  var count = options.count;
  if (!count) {
    count = 1;
  }

  var promises = [];
  for (var i = 0; i < count; i++) {
    promises.push(retry(makeUser));
  }
  return Promise.all(promises);

  function makeUser() {
    const config = _.defaults({
      scopes: process.env.CISCOSPARK_SCOPE
    }, options.config);
    return tui.create(config)
      .then(function(user) {
        allUsers.push(user);
        return user;
      });
  }
}

function _extractFromEnv(options) {
  /* eslint complexity: [0] */
  var count = options.count;
  if (!count) {
    count = 1;
  }

  var users = [{
    id: process.env.CISCOSPARK_ID || process.env.CISCOSPARK_ID_0,
    token: {
      access_token: process.env.CISCOSPARK_ACCESS_TOKEN || process.env.CISCOSPARK_ACCESS_TOKEN_0,
      refresh_token: process.env.CISCOSPARK_REFRESH_TOKEN || process.env.CISCOSPARK_REFRESH_TOKEN_0
    },
    email: process.env.CISCOSPARK_EMAIL || process.env.CISCOSPARK_EMAIL_0,
    name: process.env.CISCOSPARK_NAME || process.env.CISCOSPARK_NAME_0,
    password: process.env.CISCOSPARK_PASSWORD || process.env.CISCOSPARK_PASSWORD_0
  }];

  for (var i = 1; i < count; i++) {
    users.push({
      id: process.env['CISCOSPARK_ID_' + i],
      token: {
        access_token: process.env['CISCOSPARK_ACCESS_TOKEN_' + i],
        refresh_token: process.env['CISCOSPARK_REFRESH_TOKEN_' + i]
      },
      email: process.env['CISCOSPARK_EMAIL_' + i],
      name: process.env['CISCOSPARK_NAME_' + i],
      password: process.env['CISCOSPARK_PASSWORD_' + i]
    });
  }

  for (var j = 0; j < count; j++) {
    assert(users[j].access_token, 'No access token available for user' + j);
  }

  return users;
}

function _remove(users) {
  return Promise.all(users.map(function(user) {
    return tui.remove(user)
      .catch(function(reason) {
        console.warn('failed to delete test user', reason);
      });
  }));
}

module.exports = {
  create: function create(options) {
    assert(process.env.COMMON_IDENTITY_CLIENT_ID, 'COMMON_IDENTITY_CLIENT_ID must be defined');
    assert(process.env.COMMON_IDENTITY_CLIENT_SECRET, 'COMMON_IDENTITY_CLIENT_SECRET must be defined');

    return new Promise(function(resolve) {
      resolve(tui ? _create(options) : _extractFromEnv(options));
    });
  },

  remove: function remove(users) {
    if (!tui) {
      return Promise.resolve();
    }

    return _remove(users);
  }
};
