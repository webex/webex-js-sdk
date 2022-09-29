/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable indent */

import {createBrowser} from '@webex/test-helper-automation';
import testUsers from '@webex/test-helper-test-users';

import pkg from '../../../package';

const redirectUri = process.env.WEBEX_REDIRECT_URI || process.env.REDIRECT_URI;

describe('plugin-authorization-browser', function () {
  this.timeout(120000);
  describe('Authorization', () => {
    describe.skip('Implicit Grant', () => {
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

      it('authorizes a user', () => browser
        .get(`${redirectUri}/${pkg.name}`)
        .waitForElementByClassName('ready')
        .title()
          .should.eventually.become('Authorization Automation Test')
        .waitForElementByCssSelector('[title="Login with Implicit Grant"]')
          .click()
        .login(user)
        .waitForElementByClassName('authorization-automation-test')
        .waitForElementByCssSelector('#ping-complete:not(:empty)')
          .text()
            .should.eventually.become('success'));

      it('is still logged in after reloading the page', () => browser
        .waitForElementById('access-token')
          .text()
            .should.eventually.not.be.empty
        .url()
          .then((url) => browser.get(url))
        .sleep(500)
        .waitForElementById('access-token')
          .text()
            .should.eventually.not.be.empty);

      it('logs out a user', () => browser
        .title()
          .should.eventually.become('Authorization Automation Test')
        .waitForElementByCssSelector('[title="Logout"]')
          .click()
        // We need to revoke three tokens before the window.location assignment.
        // So far, I haven't found any ques to wait for, so sleep seems to be
        // the only option.
        .sleep(3000)
        .title()
          .should.eventually.become('Redirect Dispatcher')
        .get(`${redirectUri}/${pkg.name}`)
        .title()
          .should.eventually.become('Authorization Automation Test')
        .waitForElementById('access-token')
          .text()
            .should.eventually.be.empty
        .waitForElementByCssSelector('[title="Login with Implicit Grant"]')
          .click()
        .waitForElementById('IDToken1'));
    });
  });
});
