var fs = require('fs-extra');
var argv = require('yargs').argv;

var packagesDir = './packages';
var packageJson = 'package.json';

var files = fs.readdirSync(packagesDir);
var invalidPackages = [];

files.forEach((file) => {
    var packageDir = `${packagesDir}/${file}`;
    try {
      var stats = fs.statSync(packageDir);
      if (!stats.isDirectory()) {
        return;
      }
      var packagePackageJson = `${packageDir}/${packageJson}`;
      try {
        fs.statSync(packagePackageJson);
      }
      catch(jsonE) {
        invalidPackages.push(packageDir);
      }

    }
    catch(e) {
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
