'use strict';

const wrapHandler = require(`../lib/wrap-handler`);
const {applyTransform} = require(`../lib/package`);
const path = require(`path`);

module.exports = {
  command: `packagemod`,
  desc: `Apply the transform at "path" to each each package.json`,
  builder: {
    txpath: {
      demand: true,
      description: `Path to a file that implements a transform "pkg = await tx(pkg);"`,
      type: `string`
    }
  },
  handler: wrapHandler(async ({txpath}) => {
    if (!txpath.startsWith(`/`)) {
      txpath = path.resolve(process.cwd(), txpath);
    }

    // eslint-disable-next-line global-require
    const tx = require(txpath);
    await applyTransform(tx);
  })
};
