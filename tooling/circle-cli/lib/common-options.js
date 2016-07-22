'use strict';

module.exports = {
  auth: {
    demand: true,
    describe: `Circle CI Auth Token`,
    type: `string`
  },
  build_num: {
    alias: `b`,
    demand: false,
    describe: `Circle CI build number`,
    type: `number`
  },
  json: {
    alias: `j`,
    describe: `Render output using JSON.stringify() instead of util.inspect (e.g. for piping to jq)`,
    type: `boolean`
  },
  project: {
    alias: `p`,
    demand: true,
    describe: `GitHub repo name`,
    type: `string`
  },
  username: {
    alias: `u`,
    demand: true,
    describe: `GitHub user/org`,
    type: `string`
  }
};
