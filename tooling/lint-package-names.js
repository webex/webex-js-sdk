const fs = require(`fs`);
const package_lib = require(`./lib/package`);

package_lib.list((packages) => {
  packages.forEach((package_name) => {
    JSON.parse(fs.readFile(`./packages/node_modules/${package_name}/package.json`, `utf8`), (error, packageJson) => {
      if (module !== packageJson.name) {
        throw new Error(`package.json for '${package_name}' contains unexpected package name '${packageJson.name}'`);
      }
    });
  });
});
