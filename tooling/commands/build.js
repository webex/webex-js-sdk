/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const wrapHandler = require('../lib/wrap-handler');
const {list} = require('../util/package');
const {buildPackage, buildSamples, buildScript} = require('../lib/build');

module.exports = {
  command: 'build [packageName]',
  desc: 'Build one or all packages',
  builder: {
    onlySamples: {
      default: false,
      description: 'Only build samples',
      type: 'boolean'
    },
    skipSamples: {
      default: false,
      description: 'Do not build samples',
      type: 'boolean'
    }
  },
  handler: wrapHandler(async ({packageName, onlySamples, skipSamples}) => {
    if (!onlySamples) {
      if (packageName) {
        await buildPackage(packageName);
      }
      else {
        for (const pName of await list()) {
          await buildPackage(pName);
        }

        // only build script after ALL packages are built
        await buildScript();
      }
    }

    if (!skipSamples) {
      if (!packageName) {
        await buildSamples();
      }
    }
  })
};
