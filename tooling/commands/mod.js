/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

module.exports = {
  command: 'mod',
  desc: 'Apply source transformations',
  /**
   * Yargs builder
   * @param {Object} yargs
   * @returns {Object}
   */
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir('./mod');
  }
};
