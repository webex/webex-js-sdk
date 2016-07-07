/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var defaults = require('lodash.defaults');
var wd = require('wd');

function delay(timeout) {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeout);
  });
}

wd.addPromiseChainMethod('login', function(user, options) {
  options = options || {};
  defaults(options, {
    remainingRetries: 3
  });

  if (!user.email) {
    throw new Error('`user.email` is required');
  }

  if (!user.password) {
    throw new Error('`user.password` is required');
  }

  return this
    .elementById('IDToken1')
      .sendKeys(user.email)
    .elementById('IDButton2')
      .click()
    .submitPassword(user, options);
});

wd.addPromiseChainMethod('submitPassword', function(user, options) {
  return this
    .elementById('IDToken2')
      .sendKeys(user.password)
    .elementById('Button1')
      .click()
    .hasElementByClassName('generic-error')
      .then(function(isPresent) {
        if (isPresent) {
          if (options.remainingRetries > 0) {
            options.remainingRetries = options.remainingRetries - 1;
            return delay(1000)
              .then(this.submitPassword.bind(this, user, options));
          }
          throw new Error('Failed to login after several attempts');
        }
      }.bind(this));
});
