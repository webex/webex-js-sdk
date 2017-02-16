/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import createBrowser from '../lib/create-browser';
import pkg from '../../../package.json';

import path from 'path';
import requireDir from 'require-dir';

requireDir(path.join(__dirname, `../lib/wd`), {recurse: true});

describe(`example-phone`, function() {
  this.timeout(3 * 60 * 1000);

  describe(`__`, () => {
    let browser;

    beforeEach(() => createBrowser(pkg, {name: `_setup`})
      .then((b) => {browser = b;}));

    afterEach(() => Promise.resolve(browser && browser.quit())
      .catch((reason) => {console.warn(reason);}));

    it(`loads the app and blocks until webpack finishes building`, () => browser
      .getMainPage());
  });
});
