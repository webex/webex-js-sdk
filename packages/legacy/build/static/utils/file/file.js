const babel = require('@babel/core');
const fs = require('fs/promises');
const mkdirp = require('mkdirp');
const path = require('path');

/**
 * The File class handles individual files and their build mutations.
 */
class File {
  /**
   * Build a source file to a destination, with an optional map.
   *
   * @param {Record<string, any>} param - File.build param object.
   * @param {string} param.source - Source file to build.
   * @param {string} param.destination - Destination to build the param.source file to.
   * @param {boolean} param.generateMap - Whether to generate a map file.
   * @returns {Promise<void>} - A promise that resolves if building the file was successful.
   */
  static build({source, destination, generateMap}) {
    console.log(`building file from "${source}" to "${destination}"`);

    return File.transform({source})
      .then(({code, map}) => {
        const distributableFile = File.write({
          destination,
          data: `${code}\n//# sourceMappingURL=${path.basename(destination)}.map\n`,
        });

        const mapFile = generateMap
          ? File.write({
            destination: `${destination}.map`,
            data: JSON.stringify(map),
          })
          : Promise.resolve();

        return Promise.all([distributableFile, mapFile]);
      });
  }

  /**
   * Transform a source file, along with generating a map file.
   *
   * @param {Record<string, any>} param - File.transform param object.
   * @param {string} param.source - Source file to transform.
   * @returns {Promise<{code: string, map: string}>} - Promise resolving with transformed data.
   */
  static transform({source}) {
    return new Promise((resolve, reject) => {
      babel.transformFile(source, (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(results);
      })
    });
  }

  /**
   * Write a collection of data to a destination.
   *
   * @param {Record<string, any>} param - File.write param object.
   * @param {string} param.destination - Destination to write the param.data to.
   * @param {string} param.data - Data to write to the param.destination.
   * @returns {Promise<any>} - Results of the file write.
   */
  static write({destination, data}) {
    return new Promise((resolve, reject) => {
      mkdirp(path.dirname(destination), (error, made) => {
        if (error) {
          reject(error);

          return;
        }

        resolve(made);
      })
    })
      .then(() => fs.writeFile(destination, data));
  }
}

module.exports = File;
