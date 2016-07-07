/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var automation = require('../lib/automation');
var wd = require('wd');

describe('Examples', function() {
  // Skipping because this test doesn't prove anything useful right now and is
  // very flaky on Jenkins.
  describe.skip('User Registration', function() {
    this.timeout(120000);
    var email = 'Collabctg+spark-js-sdk-' + Date.now() + '@gmail.com';

    var browser;
    before(function createBrowser() {
      return automation.createBrowser()
        .then(function(b) {
          browser = b;
        });
    });

    after(function removeBrowser() {
      if (browser) {
        return browser.quit();
      }
    });

    it('demonstrates user registation and authentication', function() {
      return browser
        .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
        .title()
          .should.eventually.become('Example App')
        .elementByCssSelector('[title="Begin as a new user"]')
          .click()
        .elementByCssSelector('[title="Enter email address"]')
          .sendKeys(email)
        .elementById('form-user-verify')
          .submit()
        .waitForElementByCssSelector('#eqp:not(:empty)')
          .text(function(err, eqp) {
            if (err) {
              throw err;
            }
            return browser
              .elementByCssSelector('[title="Enter encrypted querystring"]')
                .sendKeys(eqp);
          })
        .elementById('form-user-activate')
          .submit()
        // TODO figure out how to login and set a password.
        .waitForElementByCssSelector('#activated:not(:empty)', wd.asserters.isVisible)
          .text()
            .should.eventually.become('Activated!');
    });

  });
});
