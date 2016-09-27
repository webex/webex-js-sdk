/* eslint quotes: [2, backtick] */

'use strict';

const _ = require(`lodash`);

module.exports = function(grunt) {
  grunt.registerMultiTask(`package-json`, `Apply transforms to package/*/package.json to ensure consistency`, function() {
    const options = this.options({
      defaults: {},
      overrides: {},
      order: [
        `name`,
        `version`,
        `description`,
        `keywords`,
        `homepage`,
        `bugs`,
        `license`,
        `author`,
        `contributors`,
        `files`,
        `main`,
        `devMain`,
        `bin`,
        `man`,
        `directories`,
        `directories.lib`,
        `directories.bin`,
        `directories.man`,
        `directories.doc`,
        `directories.example`,
        `repository`,
        `scripts`,
        `config`,
        `dependencies`,
        `devDependencies`,
        `peerDependencies`,
        `bundledDependencies`,
        `optionalDependencies`,
        `engines`,
        `engineString`,
        `os`,
        `cpu`,
        `preferGlobal`,
        `private`,
        `publishConfig`,
        `browser`,
        `browserify`
      ],
      packages: `./packages`
    });

    const folders = grunt.file.expand({
      cwd: options.packages
    }, `*`);

    folders.forEach((folder) => {
      try {
        const filename = `./packages/${folder}/package.json`;
        const pkg = grunt.file.readJSON(filename);
        const defaultValues = _.isFunction(options.defaults) ? options.defaults(folder) : options.defaults;
        const overrideValues = _.isFunction(options.overrides) ? options.overrides(folder) : options.overrides;

        const transformed = Object.assign(_.defaults(pkg, defaultValues), overrideValues);

        let result = options.order.reduce((acc, key) => {
          acc[key] = transformed[key];
          return acc;
        }, {});

        const unknownKeys = _.difference(Object.keys(pkg), options.order);

        result = unknownKeys.reduce((acc, key) => {
          acc[key] = transformed[key];
          return acc;
        }, result);

        // console.log(unknownKeys);

        grunt.file.write(filename, `${JSON.stringify(result, null, 2)}\n`);
      }
      catch(reason) {
        grunt.log.warn(reason);
      }
    });

  });
};
