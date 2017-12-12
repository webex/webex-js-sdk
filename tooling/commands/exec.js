/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:command:exec');
const wrapHandler = require('../lib/wrap-handler');
const {list, spawn} = require('../util/package');

module.exports = {
  command: 'exec cmd [args...]',
  desc: 'Run a command in each package directory',
  builder: {},
  handler: wrapHandler(async ({cmd, args}) => {
    for (const packageName of await list()) {
      debug(`running ${cmd} ${args.join(' ')} in ${packageName}`);
      await spawn(packageName, cmd, args);
    }
  })
};
