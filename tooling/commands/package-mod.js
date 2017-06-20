'use strict';

const debug = require(`debug`)(`tooling:command:packagemod`);
const wrapHandler = require(`../lib/wrap-handler`);
const {applyTransform} = require(`../lib/package`);
const path = require(`path`);
const requireDir = require(`require-dir`);

module.exports = {
  command: `packagemod [options]`,
  desc: `Apply default mods`,
  builder: {
    txpath: {
      description: `Path to a file that implements a transform "pkg = await tx(pkg);" (if specified, default mods are omitted)`,
      type: `string`
    }
  },
  handler: wrapHandler(async ({txpath}) => {
    if (txpath) {
      if (!txpath.startsWith(`/`)) {
        txpath = path.resolve(process.cwd(), txpath);
      }

      // eslint-disable-next-line global-require
      const tx = require(txpath);
      await applyTransform(tx);
    }
    else {
      const dir = path.resolve(process.cwd(), `tooling`, `packagemods`);
      debug(`loading packagemods in directory ${dir}`);
      const transforms = requireDir(dir);
      console.info(transforms);
      await applyTransform(async (pkg) => {
        for (const key of Object.keys(transforms)) {
          debug(`applying transform ${key} to ${pkg.name}`);
          const tx = transforms[key];
          pkg = await tx(pkg);
        }
        return pkg;
      });
    }

  })
};
