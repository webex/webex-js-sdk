/* eslint no-console: [0] */
/* eslint no-process-exit: [0] */
/* eslint no-sync: [0] */

const fs = require(`fs-extra`);
const argv = require(`yargs`).argv;

const packagesDir = `./packages/node_modules`;
const packageJson = `package.json`;

const files = fs
  .readdirSync(packagesDir)
  .concat(fs.readdirSync(`${packagesDir}/@ciscospark`))
  .filter((p) => p === `@ciscospark`);

const invalidPackages = [];

files.forEach((file) => {
  const packageDir = `${packagesDir}/${file}`;
  try {
    const stats = fs.statSync(packageDir);
    if (!stats.isDirectory()) {
      return;
    }
    const packagePackageJson = `${packageDir}/${packageJson}`;
    try {
      fs.statSync(packagePackageJson);
    }
    catch (jsonE) {
      invalidPackages.push(packageDir);
    }

  }
  catch (e) {
    console.error(e);
  }
});

console.log(`(${invalidPackages.length}) INVALID PACKAGES:`);
invalidPackages.forEach((pkg) => {
  console.log(pkg);
  if (argv.clean) {
    fs.removeSync(pkg);
  }
});

process.exit();
