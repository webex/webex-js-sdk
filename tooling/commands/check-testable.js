/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {updated} = require(`../lib/updated`);
const wrapHandler = require(`../lib/wrap-handler`);
const {list} = require(`../util/package`);
const {lastLog} = require(`../lib/git`);

module.exports = {
  command: `check-testable`,
  desc: `Check if this build has anything to test. Prints "run" or "skip"`,
  builder: {},
  handler: wrapHandler(async() => {
    const log = await lastLog();
    if (log.includes(`[ci skip]`) || log.includes(`[ci-skip]`)) {
      console.log(`skip`);
      return;
    }

    const changed = await updated({});
    const ignoreTooling = (await lastLog()).includes(`#ignore-tooling`);
    let packages;
    if (!ignoreTooling && changed.includes(`tooling`)) {
      packages = await list();
    }
    else {
      packages = await updated({dependents: true});
    }

    packages = packages
      .filter((p) => !p.includes(`bin-`))
      .filter((p) => !p.includes(`test-helper-`))
      .filter((p) => !p.includes(`eslint-config`))
      .filter((p) => !p.includes(`xunit-with-logs`))
      .filter((p) => !p.includes(`tooling`));

    if (packages.length === 0) {
      console.log(`skip`);
      return;
    }

    console.log(`run`);
    return;
  })
};
