/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var defaults = require('lodash').defaults;
var wd = require('wd');

/**
 * @method login
 * @memberof wd
 * @param {Object} user
 * @param {stirng} user.email
 * @param {stirng} user.password
 * @param {Object} options
 * @param {number} options.remainingRetries
 */
wd.addPromiseChainMethod('login', function login(user, options) {
  options = options || {};
  defaults(options, {
    remainingRetries: 3
  });

  if (!user.email) {
    throw new Error('\`user.email\` is required');
  }

  if (!user.password) {
    throw new Error('\`user.password\` is required');
  }

  return this
    .hasElementByCssSelector('#IDToken1[readonly]')
      .then(function enterEmailIfMissing(emailAlreadyEntered) {
        if (!emailAlreadyEntered) {
          return this
            .elementById('IDToken1')
              .sendKeys(user.email)
            .elementById('IDButton2')
              .click();
        }

        return this;
      }.bind(this))
    .submitPassword(user, options)
    .acceptGrant();
});
