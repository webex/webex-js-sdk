/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const wrapHandler = require('../lib/wrap-handler');
const {list} = require('../util/package');
const {buildPackage, buildSamples, buildUMDScript} = require('../lib/build');

/**
 * Each file under commands folder is a command confirguration
 * The file exports a JSON object with following attributes,
 *  command - what should be the keyword to invocate command
 *  desc - description
 *  builder - JSON object with parameters. Each parameter has a set of options,
 *          - default - Default value for the parameter
 *          - description - param description
 *          - type - what type of parameter
 *          - required - If the parameter is mandatory
 *  handler - * Method that is actually called when command is invoked
 *            * Whatever option given by user and default values will be available
 *            in argv of handler parameters
 */

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
    },
    umd: {
      default: false,
      description: 'build UMD script',
      type: 'boolean'
    }
  },
  handler: wrapHandler(async ({
    packageName,
    onlySamples,
    skipSamples,
    umd
  }) => {
    if (umd) {
      await buildUMDScript();
    }
    else {
      if (!onlySamples) { // All packages to be built
        if (packageName) { // If package name mentioned
          await buildPackage(packageName);
        }
        else { // All packages build if package name not mentioned
          for (const pName of await list()) { // list method will return path to all packages
            await buildPackage(pName);
          }
        }
      }

      if (!skipSamples) { // If samples aren't skipped, buildSamples is called
        if (!packageName) {
          // buildSamples method in turn uses webpack to build samples
          await buildSamples();
        }
      }
    }
  })
};
