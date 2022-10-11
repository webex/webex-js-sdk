/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const wrapHandler = require('../lib/wrap-handler');
const {updated} = require('../lib/updated');

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
  command: 'updated',
  desc: 'List the packages that have been updated',
  builder: {
    dependents: {
      default: false,
      description: 'include dependent packages',
      type: 'boolean'
    },
    npm: {
      default: false,
      description: 'Compare to version at \'latest\' tag on npm',
      type: 'boolean'
    },
    upstream: {
      default: true,
      description: 'Compare to upstream/master',
      type: 'boolean'
    }
  },
  handler: wrapHandler(async ({dependents, npm = !!process.env.CI, upstream}) => {
    if (upstream) {
      npm = false;
    }
    console.log(await updated({dependents, npm}));
  })
};
