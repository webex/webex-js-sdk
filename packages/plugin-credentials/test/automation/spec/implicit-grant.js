/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

const redirectUri = process.env.CISCOSPARK_REDIRECT_URI || process.env.REDIRECT_URI;

describe(`spark-core`, function() {
  this.timeout(120000);
  describe(`Authorization`, () => {
    describe(`Implicit Grant`, () => {
      let browser, user;

      before(() => testUsers.create({count: 1})
        .then((users) => {
          user = users[0];
        }));

      before(() => createBrowser(pkg)
        .then((b) => {
          browser = b;
        }));

      after(() => browser && browser.printLogs());

      after(() => browser && browser.quit()
        .catch((reason) => {
          console.warn(reason);
        }));

      it(`authorizes a user`, () => browser
        .get(redirectUri)
        .waitForElementByClassName(`ready`)
        .title()
          .should.eventually.become(`Authorization Automation Test`)
        .waitForElementByCssSelector(`[title="Login with Implicit Grant"]`)
          .click()
        .login(user)
        .waitForElementByClassName(`authorization-automation-test`)
        .waitForElementByCssSelector(`#ping-complete:not(:empty)`)
          .text()
            .should.eventually.become(`success`));

      it(`is still logged in after reloading the page`, () => browser
        .waitForElementById(`access-token`)
          .text()
            .should.eventually.not.be.empty
        .get(redirectUri)
        .sleep(500)
        .waitForElementById(`access-token`)
          .text()
            .should.eventually.not.be.empty);

      it(`logs out a user`, () => browser
        .title()
          .should.eventually.become(`Authorization Automation Test`)
        .waitForElementByCssSelector(`[title="Logout"]`)
          .click()
        // Need to give the click action enough time to start the redirect
        // process; this is more of a "nextTick" than an actual sleep, so I
        // *think* we can safely use a smallish number and not be concerned
        // about flakiness
        .sleep(500)
        .title()
          .should.eventually.become(`Authorization Automation Test`)
        .waitForElementByCssSelector(`[title="Login with Implicit Grant"]`)
          .click()
        .waitForElementByCssSelector(`#IDToken1`));
    });
  });
});
