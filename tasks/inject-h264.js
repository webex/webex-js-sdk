// eslint-disable-next-line
'use strict';

const denodeify = require(`denodeify`);
const FirefoxProfile = require(`firefox-profile`);
const forEach = require(`lodash.foreach`);
const fs = require(`fs`);
const os = require(`os`);
const path = require(`path`);
const cp = require(`child_process`);

const copy = denodeify(FirefoxProfile.copy);
const writeFile = denodeify(fs.writeFile);

function encode(fp) {
  return new Promise((resolve) => {
    fp.encode((encoded) => {
      resolve(encoded);
    });
  });
}

function getBrowserName(def, key) {
  return (def.browserName || def.name || def.browser || key).toLowerCase();
}

function getBrowserPlatform(def, env) {
  let platform;
  if (env === `local`) {
    platform = os.platform();
  }
  else {
    platform = def.platform.toLowerCase();
  }
  if (contains(`linux`, platform)) {
    return `linux`;
  }
  else if (contains(`windows`, platform)) {
    return `windows`;
  }
  else if (contains(`osx`, platform) || contains(`os x`, platform) || contains(`mac`, platform) || contains(`darwin`, platform)) {
    return `mac`;
  }
  throw new Error(`Could not determine platform`);
}

function contains(needle, haystack) {
  return haystack.indexOf(needle) !== -1;
}

function rsync(src, dest) {
  return new Promise((resolve, reject) => {
    cp.exec(`rsync -r --delete ${src} ${dest}`, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

module.exports = function(grunt) {
  grunt.registerTask(`inject-h264`, function() {
    const inPath = path.join(__dirname, `..`, `packages`, process.env.PACKAGE, `browsers.js`);
    const outPath = path.join(__dirname, `..`, `packages`, process.env.PACKAGE, `browsers.processed.js`);

    try {
      fs.statSync(path.join(__dirname, `selenium`));
    }
    catch (err) {
      console.warn(`Could not find firefox profiles folder at ${__dirname}/selenium; expect call tests in firefox to fail`);
      return;
    }

    const browsers = require(inPath)();
    const done = this.async();
    Promise.all([
      copy(path.join(__dirname, `selenium`, `mac`))
        .then(encode),
      copy(path.join(__dirname, `selenium`, `linux`))
        .then(encode),
      copy(path.join(__dirname, `selenium`, `windows`))
        .then(encode),
      rsync(path.join(__dirname, `selenium`, `mac`), path.join(__dirname, `..`, `.tmp`, `selenium`))
    ])
      .then((profiles) => {
        const platforms = {
          mac: profiles[0],
          linux: profiles[1],
          windows: profiles[2]
        };

        return new Promise((resolve) => {
          const promises = [];
          forEach(browsers, (envBrowsers, env) => {
            if (env === `local`) {
              return;
            }
            forEach(envBrowsers, (browser, key) => {
              const name = getBrowserName(browser, key);
              if (name.indexOf(`firefox`) !== -1) {
                // eslint-disable-next-line camelcase
                browser.firefox_profile = platforms[getBrowserPlatform(browser, env)];
              }
            });
          });

          resolve(Promise.all(promises));
        });
      })
      .then(() => {
        let out = `module.exports = function() { return `;
        out += JSON.stringify(browsers, null, 2);
        out += `}`;
        return writeFile(outPath, out);
      })
      .then(done)
      .catch(done);
  });
};
