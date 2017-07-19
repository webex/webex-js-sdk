// const shelljs = require(`shelljs`);
const fs = require(`fs`);

const modules = [];


// JS equivelent of "set -e" bash command
// for (var envVariable in process.env ) {
//     shelljs.exec(`echo ${envVariable}`);
// }

// Grab the module names of each package in the packages/node_modules 
// and package/node_modules/@ciscospark directories containing the ciscospark substring
// Using a Promise to excecute async functions in a sync manner to pass linting tests
new Promise((resolve, reject) => {

  fs.readdir(`./packages/node_modules/`, (error, files) => {
    if (error) {
      reject();
    }

    files.forEach((module) => {
      const regex = new RegExp(`ciscospark`);
      if (regex.test(module) && module !== `@ciscospark`) {
        modules.push(module);
      }
    });

  });

  resolve();
}).then(fs.readdir(`./packages/node_modules/@ciscospark/`, (error, files) => {
  if (error) {
    throw new Error(error);
  }

  files.forEach((module) => {
    modules.push(module);
  });

})).then(modules.forEach((module) => {

  JSON.parse(fs.readFile(`./packages/node_modules/${module}/package.json`, `utf8`), (error, packageJson) => {
    if (module !== packageJson.name) {
      throw new Error(`package.json for '${module}' contains unexpected package name '${packageJson.name}'`);
    }
  });
})).catch((error) => {

  throw new Error(error);
});


