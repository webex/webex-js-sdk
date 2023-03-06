const fse = require('fs-extra');

const glob = require('glob');

const destDir = 'docs-new/sdk-portal/static/apijson';
// gets reference to all the package.json file
glob('packages/**/api', {}, (er, files) => {
  files.forEach((file) => {
    console.log(file);
    // To copy a folder or file, select overwrite accordingly
    try {
      fse.copy(file, destDir);
    } catch (err) {
      console.error(err);
    }
  });
});
