
const fs = require('fs');

const glob = require('glob');

// gets reference to all the package.json file
glob('packages/**/package.json', {}, (er, files) => {
  files.forEach((file) => {
    const currentPackageJson = fs.readFileSync(file);

    const parsedPackages = JSON.parse(currentPackageJson);

    let stringified = JSON.stringify(parsedPackages, null, 2);


    // replace all the version which 'workspace:^' to the SDK version
    stringified = stringified.replaceAll('workspace:^', parsedPackages.version);

    fs.writeFileSync(file, `${stringified}\n`);
  });
});

