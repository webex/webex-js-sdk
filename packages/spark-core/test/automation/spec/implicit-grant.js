/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

const redirectUri = process.env.COMMON_IDENTITY_REDIRECT_URI || process.env.CISCOSPARK_REDIRECT_URI || process.env.REDIRECT_URI;

describe(`Authorization`, function() {
  this.timeout(60000);
  describe(`Implicit Grant`, () => {
    let browser, user;

    before(() => {
      return testUsers.create({count: 1})
        .then((users) => {
          user = users[0];
        });
    });

    before(() => {
      return createBrowser(pkg)
        .then((b) => {
          browser = b;
        });
    });

    after(() => {
      if (browser) {
        return browser.quit()
          .catch((reason) => {
            console.warn(reason);
          });
      }

      return Promise.resolve();
    });

    it(`authorizes a user`, () => {
      return browser
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
            .should.eventually.become(`success`);

    });

    // Skipped because CI started flaking (on a weekend) if returnURL
    // isn't registered.
    it.skip(`logs out a user`, () => {
      return browser
        .title()
          .should.eventually.become(`Authorization Automation Test`)
        .waitForElementByCssSelector(`[title="Logout"]`)
          .click()
        // Until we can configure a returnURL, we need to treat a failure as a
        // success
        .waitForElementByClassName(`error`)
          .text()
            .should.eventually.become(`returnURL is not allowed`);
    });
  });
});
