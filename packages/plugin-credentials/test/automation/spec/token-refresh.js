/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {createBrowser} from '@ciscospark/test-helper-automation';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

const redirectUri = process.env.CISCOSPARK_REDIRECT_URI || process.env.REDIRECT_URI;

describe(`spark-core`, function() {
  this.timeout(120000);
  describe(`Authorization`, () => {
    describe(`Token Refresh`, () => {
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

      before(() => browser
        .get(redirectUri)
        .waitForElementByClassName(`ready`)
        .title()
          .should.eventually.become(`Authorization Automation Test`)
        .waitForElementByCssSelector(`[title="Login with Authorization Code Grant"]`)
          .click()
        .login(user)
        .waitForElementByClassName(`authorization-automation-test`)
        .waitForElementByCssSelector(`#ping-complete:not(:empty)`)
          .text()
            .should.eventually.become(`success`));

      it(`refreshes the user's access token`, () => {
        let accessToken = ``;
        return browser
          .waitForElementByCssSelector(`#access-token:not(:empty)`)
            .text()
              .then((text) => {
                accessToken = text;
                assert.isString(accessToken);
                assert.isAbove(accessToken.length, 0);
                return browser;
              })
          .waitForElementByCssSelector(`[title="Refresh Access Token"]`)
            .click()
          // Not thrilled by a sleep, but we just need to give the button click
          // enough time to clear the #access-token box
          .sleep(500)
          .waitForElementByCssSelector(`#access-token:not(:empty)`)
            .text()
              .then((text) => {
                assert.isString(text);
                assert.isAbove(text.length, 0);
                assert.notEqual(text, accessToken);
                return browser;
              })
          // The remainder belongs in after(), but makes selenium unhappy there.
          .waitForElementByCssSelector(`[title="Logout"]`)
            .click()
          // Need to give the click action enough time to start the redirect
          // process; this is more of a "nextTick" than an actual sleep, so I
          // *think* we can safely use a smallish number and not be concerned
          // about flakiness
          .sleep(500)
          .title()
            .should.eventually.become(`Authorization Automation Test`);
      });
    });
  });
});
