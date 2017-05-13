'use strict';

const wrapHandler = require(`../../lib/wrap-handler`);
const {list, listVersions} = require(`../../lib/dependencies`);

module.exports = {
  command: `list packageName`,
  desc: `list dependencies for the specified package`,
  builder: {
    includeTransient: {
      default: true,
      description: `Also include subdependencies`,
      type: `boolean`
    },
    localOnly: {
      default: false,
      description: `Only show the local dependencies and (optionally)  subdependencies`,
      type: `boolean`
    },
    verions: {
      default: false,
      description: `Include dependency versions`,
      type: `boolean`
    }
  },
  handler: wrapHandler(async ({packageName, includeTransient, localOnly, versions}) => {
    if (versions) {
      console.log(await listVersions(packageName, {includeTransient, localOnly}));

    }
    else {
      console.log(await list(packageName, {includeTransient, localOnly}));
    }
  })
};
