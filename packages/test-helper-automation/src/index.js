/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

// Reminder: this is intentionally a different instance of chai than
// @ciscospark/test-helper-chai.
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var defaults = require('lodash').defaults;
var path = require('path');
var requireDir = require('require-dir');
var wd = require('wd');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

requireDir(path.join(__dirname, 'wd'));

module.exports = {
  /**
   * Resolves with a wd browser instance
   * @param {Object} pkg package.json as JavaScript Object
   * @param {Object} browserDef wd-compatible browser definition
   * @returns {Promise}
   */
  createBrowser: function createBrowser(pkg, browserDef) {
    if (!pkg) {
      throw new Error('pkg is required');
    }

    if (!browserDef) {
      browserDef = {browserName: 'chrome'};
    }

    if (!browserDef) {
      throw new Error('No browser definition available');
    }

    browserDef = defaults(browserDef, {
      build: process.env.BUILD_NUMBER || 'local-' + process.env.USER + '-' + pkg.name + '-' + Date.now(),
      name: pkg.name + ' (automation)',
      public: 'team',
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER
    });

    var browser = process.env.SC_TUNNEL_IDENTIFIER ? wd.promiseChainRemote('ondemand.saucelabs.com', 80) : wd.promiseChainRemote();

    return browser.init(browserDef)
      .setImplicitWaitTimeout(10000)
      .setWindowSize(1600, 1200)
      .then(function returnBrowser() {
        return browser;
      });
  },

  wd: wd
};
