/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package';

const redirectUri = process.env.COMMON_IDENTITY_REDIRECT_URI || process.env.CISCOSPARK_REDIRECT_URI || process.env.REDIRECT_URI;

describe(`spark-core`, function() {
  this.timeout(120000);
  describe(`Authorization`, () => {
    describe(`Authorization Code Grant`, () => {
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
          .waitForElementByCssSelector(`[title="Login with Authorization Code Grant"]`)
            .click()
          .login(user)
          .waitForElementByClassName(`authorization-automation-test`)
          .waitForElementById(`refresh-token`)
            .text()
              .should.eventually.not.be.empty
          .waitForElementByCssSelector(`#ping-complete:not(:empty)`)
            .text()
              .should.eventually.become(`success`);
      });

      it(`logs out a user`, () => {
        return browser
          .title()
            .should.eventually.become(`Authorization Automation Test`)
          .waitForElementByCssSelector(`[title="Logout"]`)
            .click()
          // We need to revoke the token before the window.location assignment.
          // So far, I haven't found any ques to wait for, so sleep seems to be
          // the only option.
          .sleep(3000)
          .title()
            .should.eventually.become(`Authorization Automation Test`)
          .waitForElementById(`access-token`)
            .text()
              .should.eventually.be.empty
          .waitForElementByCssSelector(`[title="Login with Authorization Code Grant"]`)
            .click()
          .waitForElementById(`IDToken1`);
      });
    });
  });
});
