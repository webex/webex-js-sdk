/*!
 * Copyright (c) 2015-2019 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:openh264');
const denodeify = require('denodeify');
const {rimraf} = require('./async');
const spawn = require('../util/spawn');
const FirefoxProfile = require('firefox-profile');
const os = require('os');
const path = require('path');
const {stat} = require('fs-promise');

const PROFILE_DIR = './.tmp/selenium';

const copy = denodeify(FirefoxProfile.copy);

/**
 * denodeifies FirefoxProfile.encode
 * @param {FirefoxProfile} fp
 * @returns {Promise<string>}
 */
function encode(fp) {
  return new Promise((resolve, reject) => {
    fp.encode((err, encoded) => {
      if (err) {
        reject(err);

        return;
      }
      resolve(encoded);
    });
  });
}

/**
 * rsyncs a directory
 * @param {string} src
 * @param {string} dest
 */
async function rsync(src, dest) {
  await spawn('rsync', [
    '--recursive',
    '--delete',
    '--perms',
    src,
    dest
  ]);
}

/**
 * Determines if a given file/directory already exists
 * @param {string} dir
 * @returns {Promise<boolean>}
 */
async function exists(dir) {
  try {
    debug(`checking if ${dir} exists`);
    const s = await stat(dir);

    debug(`${dir} exists`);

    return s.isDirectory();
  }
  catch (err) {
    debug(`${dir} does not exist`);

    return false;
  }
}

exports.download = async function download() {
  await rimraf(`${PROFILE_DIR}/mac`);
  await spawn(`${__dirname}/openh264.sh`, []);
};

exports.inject = async function inject(browsers) {
  debug('checking if openh264 has been downloaded');
  if (!await exists(`${PROFILE_DIR}/mac`)) {
    debug('openh264 for mac not found, downloading');
    await exports.download();
  }

  for (const key of Object.keys(browsers)) {
    const def = browsers[key];

    if (def.base === 'SauceLabs') {
      await injectSauce(def);
    }
    else {
      await injectLocal(def);
    }
  }
};

/**
 * Determines the switchabale platform name from a sauce definition or the
 * output of os.platform()
 * @param {string} platform
 * @returns {string}
 */
export function platformToShortName(platform) {
  if (platform.toLowerCase().includes('os x') || platform === 'darwin') {
    return 'mac';
  }

  return undefined;
}

/**
 * Injects a the path of a firefox profile directory into a local browser definition
 * @param {Object} def
 */
async function injectLocal(def) {
  debug(`checking ${def.base} for firefox`);
  if (def.base.toLowerCase().includes('firefox')) {
    debug('def is a firefox def');
    const platform = platformToShortName(os.platform());

    debug(`injecting ${platform} profile into ${def.base}`);
    const dest = await prepareLocalProfile(platform);

    def.profile = dest;
    debug(`injected ${dest} profile into ${def.base}`);
  }
}

/**
 * Prepares the local firefox profile directory for other tasks to reference it.
 * @param {string} platform
 * @returns {Promise}
 */
export async function prepareLocalProfile(platform) {
  if (platform !== 'mac') {
    throw new Error(`No tooling implemented for injecting h264 into ${platform}`);
  }
  // Note: the `/` has to come outside path.resolve for rsync to behave as
  // intended
  const src = `${path.resolve(`${PROFILE_DIR}/${platform}`)}/`;
  const dest = path.resolve(`${PROFILE_DIR}/${platform}.safe`);

  debug(`rsyncing firefox profile at ${src} to ${dest}`);
  await rsync(src, dest);
  debug('done');

  return dest;
}

/**
 * Injects a gzipped, base64-encoded firefox profile directory into a Sauce Labs
 * browser definition
 * @param {Object} def
 */
async function injectSauce(def) {
  debug(`checking ${def.base} for firefox`);
  if (def.browserName.toLowerCase().includes('firefox')) {
    debug('def is a firefox def');
    const platform = platformToShortName(def.platform);

    if (platform !== 'mac') {
      throw new Error(`No tooling implemented for injecting h264 into ${platform} (${def.platform})`);
    }

    debug(`injecting ${platform} profile into ${def.base}`);
    const dir = path.resolve(process.cwd(), `${PROFILE_DIR}/${platform}`);

    debug(`profile is at ${dir}`);
    const profile = await copy(dir);
    const encoded = await encode(profile);

    // eslint-disable-next-line camelcase
    def.firefox_profile = encoded;
    debug(`injected ${platform} profile into def`);
  }
}
