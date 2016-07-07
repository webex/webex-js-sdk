/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var automation = require('../lib/automation');
var landingparty = require('../../integration/lib/landingparty');

describe('Examples', function() {
  describe('Auth', function() {
    // Disabling this test for now because its use case is pretty complicated to
    // set up in the example app. Generally speaking, Passport is the way to go
    // anyway.
    describe.skip('Authorization Code Grant', function() {
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

      it('demonstrates the OAuth 2.0 Authorization Code Grant flow', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .elementByCssSelector('[title="Begin as an existing user"]')
            .click()
          .elementByCssSelector('[title="Login with Authorization Code Grant"]')
            .click()
          .login(party.spock)
          .waitForElementByClassName('example-app')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id);
      });

    });
  });
});
