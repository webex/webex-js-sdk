'use strict';

var denodeify = require('denodeify');
var FirefoxProfile = require('firefox-profile');
var forEach = require('lodash.foreach');
var fs = require('fs');
var os = require('os');
var path = require('path');

var copy = denodeify(FirefoxProfile.copy);
var writeFile = denodeify(fs.writeFile);

function encode(fp) {
  return new Promise(function(resolve) {
    fp.encode(function(encoded) {
      resolve(encoded);
    });
  });
}

function getBrowserName(def, key) {
  return (def.browserName || def.name || def.browser || key).toLowerCase();
}

function getBrowserPlatform(def, env) {
  var platform;
  if (env === 'local') {
    platform = os.platform();
  }
  else {
    platform = def.platform.toLowerCase();
  }
  if (contains('linux', platform)) {
    return 'linux';
  }
  else if (contains('windows', platform)) {
    return 'windows';
  }
  else if (contains('osx', platform) || contains('os x', platform) || contains('mac', platform) || contains('darwin', platform)) {
    return 'mac';
  }
  throw new Error('Could not determine platform');
}

function contains(needle, haystack) {
  return haystack.indexOf(needle) !== -1;
}

module.exports = function(grunt) {
  grunt.registerTask('inject-h264', function() {
    var inPath = path.join(__dirname, '..', 'packages', process.env.PACKAGE, 'browsers.js');
    var outPath = path.join(__dirname, '..', 'packages', process.env.PACKAGE, 'browsers.processed.js');

    var browsers = require(inPath)();
    console.log(browsers);
    var done = this.async();
    Promise.all([
      copy(path.join(__dirname, 'selenium', 'mac'))
        .then(encode),
      copy(path.join(__dirname, 'selenium', 'linux'))
        .then(encode)
      // copy(path.join(__dirname, 'selenium', 'windows'))
      //   .then(encode)
    ])
      .then(function(profiles) {
        var platforms = {
          mac: profiles[0],
          linux: profiles[1],
          windows: profiles[2]
        };

        return new Promise(function(resolve) {

          forEach(browsers, function(envBrowsers, env) {
            forEach(envBrowsers, function(browser, key) {
              var name = getBrowserName(browser, key);
              if (name.indexOf('firefox') !== -1) {
                // eslint-disable-next-line camelcase
                browser.firefox_profile = platforms[getBrowserPlatform(browser, env)];
              }
            });
          });

          resolve();
        });
      })
      .then(function() {
        var out = 'module.exports = function() { return ';
        out += JSON.stringify(browsers, null, 2);
        out += '}';
        return writeFile(outPath, out);
      })
      .then(done)
      .catch(done);
  });
};
