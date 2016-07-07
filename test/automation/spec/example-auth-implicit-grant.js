/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var automation = require('../lib/automation');
var landingparty = require('../../integration/lib/landingparty');
var wd = require('wd');

describe('Examples', function() {
  describe('Auth', function() {
    describe('Implicit Grant', function() {
      this.timeout(120000);

      var party = {
        spock: false
      };

      before(function() {
        return landingparty.beamDown(party);
      });

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

      it('demonstrates the OAuth 2.0 Implicit Grant flow', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .elementByCssSelector('[title="Begin as an existing user"]')
            .click()
          .elementByCssSelector('[title="Login with Implicit Grant"]')
            .click()
          .login(party.spock)
          .waitForElementByClassName('example-app')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id);
      });

      it('demonstrates credentials stored between page loads', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id);
      });

      it('demonstrates logout', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .waitForElementByCssSelector('[title="Logout with Implicit Grant"]', wd.asserters.isDisplayed)
            .click()
          .waitForElementByClassName('error')
            .text()
              .should.eventually.become('returnURL is not allowed');
      });
    });
  });
});
