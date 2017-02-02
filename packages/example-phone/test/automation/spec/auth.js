/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import createBrowser from '../lib/create-browser';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package';

describe(`example-phone`, () => {
  describe(`auth`, () => {
    let browser, user;

    before(`create user`, () => testUsers.create({count: 1})
      .then((users) => {user = users[0];}));

    beforeEach(`create browser`, () => createBrowser(pkg, {name: `auth`})
      .then((b) => {browser = b;}));

    afterEach(`quit browser`, () => browser && browser.quit()
      .catch((reason) => {console.warn(reason);}));

    describe(`An unauthenticated user`, () => {
      it.skip(`can authenticate by entering an email address`, () => browser
        .getMainPage()
        .waitForElementByCssSelector(`[href="/auth"]`)
          .click()
        .waitForElementByCssSelector(`[title="Enter email"]`)
          .sendKeys(user.email)
        .waitForElementByCssSelector(`[title="Login by email address"]`)
          .click()
        .login(user)
        .waitForElementByClassName(`ready`)
        .title()
          .should.eventually.become(`Example: Phone`)
        .waitForElementById(`authstate`)
          .text()
            .should.eventually.become(`Authenticated`));

      it.skip(`can authenticate by starting the CI login flow`, () => browser
        .getMainPage()
        .loginWithUI(user)
        .title()
          .should.eventually.become(`Example: Phone`)
        .assertAuthenticationStatus(`authenticated`));

      it.skip(`can authorize by entering an access token`, () => browser
        .getMainPage()
        .waitForElementByCssSelector(`[href="/auth"]`)
          .click()
        .waitForElementByCssSelector(`[title="Enter access token"]`)
          .sendKeys(user.token.access_token)
        .waitForElementByCssSelector(`[title="Set access token"]`)
          .click()
        .waitForElementById(`authstate`)
          .text()
            .should.eventually.become(`Authenticated`));
    });

    describe(`An authenticated user`, () => {
      beforeEach(`login`, () => browser
        .getMainPage()
        .waitForElementByCssSelector(`[href="/auth"]`)
          .click()
        .waitForElementByCssSelector(`[title="Enter access token"]`)
          .click(user.token.access_token)
        .waitForElementByCssSelector(`[title="Set access token"]`)
          .click()
        .hasElementByClassName(`.authenticating`)
          .should.eventually.become(false));

      it(`can logout`);
    });
  });
});
