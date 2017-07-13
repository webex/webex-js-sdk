const {updated} = require(`../lib/updated`);
const wrapHandler = require(`../lib/wrap-handler`);
const {list} = require(`../util/package`);

module.exports = {
  command: `list`,
  desc: `List packages`,
  builder: {
    fortests: {
      default: false,
      description: `list packages that should be tested in CI`,
      type: `boolean`
    }
  },
  handler: wrapHandler(async ({fortests}) => {
    let packages;
    if (fortests) {
      const changed = await updated({});
      if (changed.includes(`tooling`)) {
        packages = await list();
      }
      else {
        packages = await updated({dependents: true});
      }

      if (packages.includes(`legacy`)) {
        packages = packages.filter((p) => p !== `legacy`);
        packages.push(`legacy-node`);
        packages.push(`legacy-browser`);
      }

      packages = packages
        .filter((p) => !p.includes(`bin-`))
        .filter((p) => !p.includes(`test-helper-`))
        .filter((p) => !p.includes(`eslint-config`))
        .filter((p) => !p.includes(`xunit-with-logs`));
    }
    else {
      packages = await list();
    }

    for (const pkg of packages) {
      console.info(pkg);
    }
  })
};
