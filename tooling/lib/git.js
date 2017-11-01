/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require(`debug`)(`tooling:git`);
const {execSync} = require(`child_process`);

exports.diff = async function diff(tag) {
  debug(`diffing HEAD against ${tag}`);
  debug(`Shelling out to \`git diff --name-only HEAD..${tag}\``);
  const raw = String(execSync(`git diff --name-only HEAD..${tag}`));

  debug(`Done`);

  // This mapping is probably unecessary, but it's kept to minimize the number
  // of changes necessary to remove nodegit
  return raw.split(`\n`).map((r) => ({path: r}));
};

exports.lastLog = function lastLog() {
  debug(`Shelling out to \`git log -n 1 --format=%B\``);
  const log = String(execSync(`git log -n 1 --format=%B`));
  debug(`Done`);
  return log;
};
