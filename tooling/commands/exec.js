/*!
 * Copyright (c) 2015-2019 Cisco Systems, Inc. See LICENSE file.
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
      // eslint-disable-next-line no-continue
      if (cmd === 'bash' && packageName === 'samples') continue;

      debug(`running ${cmd} ${args.join(' ')} in ${packageName}`);
      await spawn(packageName, cmd, args);
    }
  })
};
