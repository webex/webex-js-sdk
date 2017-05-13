'use strict';

const wrapHandler = require(`../../lib/wrap-handler`);
const {set} = require(`../../lib/version`);

module.exports = {
  command: `set version`,
  desc: `Set packages to the specified version`,
  builder: {
    all: {
      default: false,
      type: `boolean`
    }
  },
  handler: wrapHandler(async ({all, version}) => {
    await set(version, {all});
  })
};
