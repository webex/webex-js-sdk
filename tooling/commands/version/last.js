/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {last} = require(`../../lib/version`);

module.exports = {
  command: `last`,
  desc: `Go to npm to read the highest published version of any package in the repo`,
  builder: {},
  async handler() {
    console.log(await last());
  }
};
