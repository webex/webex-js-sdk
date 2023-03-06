const fs = require('fs');

const glob = require('glob');

// gets reference to all the package.json file
glob('packages/**/package.json', {}, (er, files) => {
  files.forEach((file) => {
    const currentPackageJson = fs.readFileSync(file);

    const parsedPackages = JSON.parse(currentPackageJson);

    if (parsedPackages.scripts) {
      parsedPackages.scripts['types'] =
        'yarn run -T tsc --declaration true --declarationDir ./dist/types';
      parsedPackages.scripts['doc:api'] = 'api-extractor run --local --verbose';
      parsedPackages.scripts['doc:md'] = 'api-documenter markdown -o ./api/markdown -i ./api';
    } else {
      parsedPackages.scripts = {
        types: 'yarn run -T tsc --declaration true --declarationDir ./dist/types',
        'doc:api': 'api-extractor run --local --verbose',
        'doc:md': 'api-documenter markdown -o ./api/markdown -i ./api',
      };
    }

    let stringified = JSON.stringify(parsedPackages, null, 2);

    // replace all the version which 'workspace:^' to the SDK version
    // stringified = stringified.replaceAll('workspace:^', parsedPackages.version);

    fs.writeFileSync(file, `${stringified}\n`);
  });
});
