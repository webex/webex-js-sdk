'use strict';
const debug = require(`debug`)(`tooling:version`);
const _ = require(`lodash`);
const {getDistTag} = require(`./npm`);
const {list} = require(`./package`);
const {exec} = require(`./async`);
const {read, write} = require(`../util/package`);
const updated = require(`./updated`);
const git = require(`./git`);

/**
 * Determines the latest published package version for the repo
 * @returns {Promise<string>}
 */
exports.last = async function last() {
  const packages = Array.from(await list());
  const version = _(await Promise.all(packages
    .map(getDistTag)))
    .sort()
    .filter()
    .last()
    .trim();

  const tag = `v${version}`;
  return tag;
};

/**
 * Determines the next appropriate version to publish
 * @returns {Promise<string>}
 */
exports.next = async function next() {
  const version = await checkLastCommit();
  if (version) {
    return version.replace(`v`, ``);
  }

  const currentVersion = (await exports.last()).replace(`v`, ``);

  if (await hasBreakingChange()) {
    return increment(`major`, currentVersion);
  }

  const type = await getChangeType();
  if (!type) {
    return currentVersion;
  }

  return increment(type, currentVersion);
};

exports.set = async function set(version, {all, lastLog}) {
  if (lastLog) {
    const log = await git.lastLog();
    if (log.includes(`#force-publish`)) {
      all = true;
    }
  }

  // reminder, can't destructure updated because it's a circular dependency
  const packages = Array.from(all ? await list() : await updated.updated({dependents: true}))
    .filter((p) => ![`docs`, `legacy`, `tooling`].includes(p));

  if (packages.length === 0) {
    // eslint-disable-next-line no-console
    console.info(`no packages to update`);
    return;
  }

  for (const packageName of packages) {
    debug(`updating ${packageName} to ${version}`);
    const pkg = await read(packageName);
    debug(`${packageName} was at ${pkg.version}`);
    pkg.version = version;
    await write(packageName, pkg);
  }
};

/**
 * Determines if the last commit specified an explicit version to set
 * @returns {Promise<string>}
 */
async function checkLastCommit() {
  debug(`checking if the last commit message has explicit release instructions`);
  const summary = await git.lastLog();
  const re = /^#release v(.+?)(\s.+)?$/;
  const match = summary.match(re);
  if (match) {
    const version = match[1];
    if (version) {
      return version;
    }
  }
  return undefined;
}

/**
 * Determines if there are any breaking changes between HEAD and upstream/master
 * @returns {boolean}
 */
async function hasBreakingChange() {
  debug(`checking for breaking changes between HEAD and upstream/master`);
  const bodies = await exec(`git log upstream/master.. --format=%b`);
  if (/^BREAKING CHANGE:/.test(bodies)) {
    debug(`found breaking change`);
    return true;
  }
  debug(`no breaking changes detected`);
  return false;
}

/**
 * Checks commit messages to determine change type
 * @returns {Promise<boolean>}
 */
async function getChangeType() {
  const subjects = await exec(`git log upstream/master.. --format=%s`);
  for (const subject of subjects.split(`\n`)) {
    if (subject.startsWith(`feat`)) {
      return `minor`;
    }

    if (subject.startsWith(`fix`) || subject.startsWith(`perf`) || subject.startsWith(`refactor`)) {
      return `patch`;
    }
  }

  return undefined;
}

/* eslint-disable complexity */
/**
 * Increments a semver
 * @param {string} type
 * @param {string} version
 * @returns {string}
 */
function increment(type, version) {
  let [major, minor, patch] = version
    .replace(`v`, ``)
    .split(`.`)
    .map((v) => parseInt(v, 10));

  if (major === 0) {
    switch (type) {
    case `major`:
      minor += 1;
      patch = 0;
      break;
    case `minor`:
      patch += 1;
      break;
    case `patch`:
      patch += 1;
      break;
    default:
      throw new Error(`unrecognized change type`);
    }
  }
  else {
    switch (type) {
    case `major`:
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case `minor`:
      minor += 1;
      patch = 0;
      break;
    case `patch`:
      patch += 1;
      break;
    default:
      throw new Error(`unrecognized change type`);
    }
  }

  return `${major}.${minor}.${patch}`;
}
