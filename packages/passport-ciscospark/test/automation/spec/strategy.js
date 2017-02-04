/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package';
import {assert} from '@ciscospark/test-helper-chai';

const redirectUri = process.env.CISCOSPARK_REDIRECT_URI || process.env.REDIRECT_URI;

describe(`passport-ciscospark`, function() {
  this.timeout(60000);

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

  it(`logs in a user`, () => browser
    .get(redirectUri)
    .login(user)
    .then(() => console.log(`login complete`))
    .waitForElementByTagName(`body`)
      .text()
        .then((text) => assert.include(text, user.id))
  );
});
