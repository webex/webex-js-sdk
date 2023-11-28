/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
const debug = require('debug')('*');
const jest = require('jest');

require('@babel/register')({
  only: [
    './packages/**/*.js',
    './packages/**/*.ts'
  ],
  extensions: ['.js', '.ts'],
  sourceMaps: true
});

exports.test = async function test(files) {
  debug(`testing ${files}`);

  return run(files)
    .catch((e) => {
      debug(`${files} failed`);
      console.log(e);
      throw new Error('Jest suite failed', e);
    });
};

/**
 * Runs test
 * @param {Array<string>} files
 * @returns {Promise<Number>}
 */
async function run(files) {
  return new Promise((resolve) => {
    jest.run(files);
    resolve();
  });
}
