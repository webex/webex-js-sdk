/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {updated} = require(`../lib/updated`);
module.exports = {
  command: `updated`,
  desc: `List the packages that have been updated`,
  builder: {
    dependents: {
      default: false,
      description: `include dependent packages`,
      type: `boolean`
    },
    npm: {
      default: false,
      description: `Compare to version at 'latest' tag on npm`,
      type: `boolean`
    },
    upstream: {
      default: true,
      description: `Compare to upstream/master`,
      type: `boolean`
    }
  },
  async handler({dependents, npm, upstream}) {
    if (npm) {
      upstream = false;
    }
    if (upstream) {
      npm = false;
    }
    console.log(await updated({dependents, npm, upstream}));
  }
};
