/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const fs = require('fs');
const {version} = require('./package.json');

let fileNames;
let file;

// eslint-disable-next-line consistent-return
/**
 *
 * @param err-.
 * @param data-.
 */
// eslint-disable-next-line consistent-return
const replaceVersion = (err, data) => {
  if (err) {
    return console.log(err);
  }
  const result = data.replace(/VERSION = '(\d+\.){2}\d+';/g, `VERSION = '${version}';`);

  console.log(`Injected Version : ${version}`);
  // eslint-disable-next-line consistent-return
  fs.writeFileSync(file, result, 'utf8', (err) => {
    if (err) return console.log(err);
  });
};

/**
 *
 * @param options -.
 */
const versionPlugin = (options = []) => {
  const {hook = 'buildStart'} = options;

  return {
    name: 'versionPlugin',
    /**
     *
     */
    [hook]: async () => {
      fileNames = ['dist/esm/CallingClient/constants.js', 'src/CallingClient/constants.ts'];
      for (const filename of fileNames) {
        file = filename;
        fs.readFile(filename, 'utf-8', replaceVersion);
      }
    },
  };
};

export default versionPlugin;
