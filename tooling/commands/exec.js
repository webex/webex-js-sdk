/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const wrapHandler = require(`../lib/wrap-handler`);
const {list, spawn} = require(`../util/package`);

module.exports = {
  command: `exec cmd [args...]`,
  desc: `Run a command in each package directory`,
  builder: {},
  handler: wrapHandler(async ({cmd, args}) => {
    for (const packageName of await list()) {
      await spawn(packageName, cmd, args);
    }
  })
};
