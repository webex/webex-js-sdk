/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var browsers = require('../../../browsers');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var defaults = require('lodash.defaults');
var fs = require('fs');
var landingparty = require('../../integration/lib/landingparty');
var path = require('path');
var pkg = require('../../../package');
var wd = require('wd');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

requireDir(path.join(__dirname, 'wd'));

function requireDir(basePath) {
  fs
    .readdirSync(basePath)
    .forEach(function(filename) {
      var filePath = path.join(basePath, filename);
      if (fs.statSync(filePath).isDirectory()) {
        requireDir(filePath);
      }
      else {
        require(filePath);
      }
    });
}

after(function deleteTestUsers() {
  this.timeout(20000);
  return landingparty.beamUp();
});

var automation = {
  createBrowser: function(browserDef) {
    if (!browserDef) {
      var envBrowsers = browsers[process.env.BROWSER_ENVIRONMENT];
      if (process.env.BROWSER) {
        browserDef = envBrowsers[process.env.BROWSER];
        if (!browserDef) {
          throw new Error('No browser definition for "' + process.env.BROWSER_ENVIRONMENT + '":"' + process.env.BROWSER + '"');
        }
      }
      else {
        browserDef = envBrowsers[Object.keys(envBrowsers)[0]];
      }
    }

    defaults(browserDef, {
      build: process.env.BUILD_NUMBER || ('local-' + process.env.USER + '-' + Date.now()),
      name: pkg.name,
      public: 'team',
      tunnelIdentifier: process.env.SC_TUNNEL_IDENTIFIER
    });

    var browser;
    switch (process.env.BROWSER_ENVIRONMENT) {
      case 'local':
        browser = wd.promiseChainRemote();
        break;
      case 'sauce':
        browser = wd.promiseChainRemote('ondemand.saucelabs.com', 80);
        break;
    }

    return browser.init(browserDef)
      .setImplicitWaitTimeout(10000)
        .then(function() {
          return browser;
        });
  }

};

module.exports = automation;
