

const wrapHandler = require(`../../lib/wrap-handler`);
const {list} = require(`../../util/package`);
const {modPackage} = require(`../../lib/package-mod`);

module.exports = {
  command: `package`,
  desc: `Apply mods to package.jsons`,
  builder: {
    dir: {
      default: `${process.cwd()}/tooling/mods/package`,
      description: `If specifed (and 'mod' not specified), indicates a directory containing transforms to iterate over and apply to all packages`,
      type: `string`
    },
    mod: {
      description: `Specifies a single mod file to apply to all packages`,
      type: `string`
    },
    packageName: {
      description: `Apply transforms to the specified package instead of all packages`,
      type: `string`
    }
  },
  handler: wrapHandler(async ({dir, mod, packageName}) => {
    if (!dir && !mod) {
      throw new Error(`One of --mod or --dir must be specified`);
    }

    if (packageName) {
      await modPackage({dir, mod, packageName});
    }
    else {
      for (const pName of await list()) {
        await modPackage({dir, mod, packageName: pName});
      }
    }
  })
};
