const glob = require('glob');
const path = require('path');

const File = require('../file/file');

/**
 * The Package class handles building all files within the execution scope.
 */
class Package {
  /**
   * Build all source files within the config.source to config.destination.
   *
   * @param {Record<string, any>} config - Package.build param object.
   * @param {string} config.destination - Destination to build config.source to.
   * @param {boolean} config.generateMap - Whether to generate map files.
   * @param {boolean} config.javascript - Whether to build javascript files.
   * @param {string} config.source - Source files to build to config.destination.
   * @param {boolean} config.typescript - Whether to build typescript files.
   * @returns {Promise<void>} - Resolves if the build was successful.
   */
  static build(config) {
    const {javascript, typescript, source, destination, generateMap} = config;

    console.log(`building package with configuration "${JSON.stringify(config)}"`);

    const root = process.cwd();
    const absoluteSource = path.join(root, source);
    const absoluteDestination = path.join(root, destination);

    const javascriptFilesCollecting = javascript
      ? Package.getFiles({
        pattern: `${absoluteSource}/**/*.js`,
      })
      : Promise.resolve();

    const typescriptFilesCollecting = typescript
      ? Package.getFiles({
        pattern: `${absoluteSource}/**/*.ts`
      })
      : Promise.resolve();

    return Promise.all([javascriptFilesCollecting, typescriptFilesCollecting])
      .then(([javascriptFiles = [], typescriptFiles = []]) => {
        const allFiles = [...javascriptFiles, ...typescriptFiles];

        const fileBuilds = allFiles.map((file) => File.build({
          source: file,
          destination: file.replace(absoluteSource, absoluteDestination),
          generateMap,
        }));

        return Promise.all(fileBuilds)
      });
  }

  /**
   * Get file paths based on the provided glob pattern.
   *
   * @param {Record<string, any>} param - Package.getFiles param object.
   * @param {string} param.pattern - Glob pattern used to collect files.
   * @returns {Promise<Array<string>>} - Promise resolving to an array of found files.
   */
  static getFiles({pattern}) {
    return new Promise((resolve, reject) => {
      glob(pattern, {}, (error, files) => {
        if (error) {
          reject(error);
        }

        resolve(files);
      });
    });
  }
}

module.exports = Package;
