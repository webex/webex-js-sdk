/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var automation = require('../lib/automation');
var landingparty = require('../../integration/lib/landingparty');
var wd = require('wd');

var assert = require('chai').assert;

describe('Examples', function() {
  describe('Auth', function() {
    describe('Authorization Code Grant (Passport)', function() {
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

      it('demonstrates the OAuth 2.0 Authorization Code Grant flow with a PassportJS enabled server', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .elementByCssSelector('[title="Begin as an existing user"]')
            .click()
          .elementByCssSelector('[title="Login with Passport"]')
            .click()
          .login(party.spock)
          .waitForElementByClassName('example-app')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id);
      });

      it('demonstrates the OAuth 2.0 Token Refresh Grant with PassportJS', function() {
        var originalAccessToken;
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .waitForElementByClassName('example-app')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id)
          .waitForElementByCssSelector('#access-token:not(:empty)')
            .text(function(err, oat) {
              if (err) {
                throw err;
              }
              originalAccessToken = oat;
              return browser;
            })
          // Not sure why, but the title selector doesn't seem to work here.
          .elementById('button-refresh-token-passport')
            .click()
          .waitForElementByCssSelector('#access-token:not(:empty)')
            .text(function(err, newAccessToken) {
              if (err) {
                throw err;
              }
              assert.notEqual(newAccessToken, originalAccessToken);
              originalAccessToken = newAccessToken;
            })
          // And do it one more time because there had been a bug where refresh
          // only worked once.
          .elementById('button-refresh-token-passport')
            .click()
          .waitForElementByCssSelector('#access-token:not(:empty)')
            .text(function(err, newAccessToken) {
              if (err) {
                throw err;
              }
              assert.notEqual(newAccessToken, originalAccessToken);
            });
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

      it('demonstrates access token stored on server even if localStorage cleared', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id)
          .clearLocalStorage()
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
            .title()
              .should.eventually.become('Example App')
          .elementByCssSelector('[title="Begin as an existing user"]')
            .click()
          .elementByCssSelector('[title="Login with Passport"]')
            .click()
          .waitForElementByCssSelector('#user-id:not(:empty)')
            .text()
              .should.eventually.become(party.spock.id);
      });

      it('demonstrates logout with PassportJS', function() {
        return browser
          .get(process.env.COMMON_IDENTITY_REDIRECT_URI)
          .title()
            .should.eventually.become('Example App')
          .waitForElementByCssSelector('body.ready')
          .waitForElementByCssSelector('[title="Logout with Passport"]', wd.asserters.isDisplayed)
            .click()
          .waitForElementByClassName('error')
            .text()
              .should.eventually.become('returnURL is not allowed');
      });

    });
  });
});
