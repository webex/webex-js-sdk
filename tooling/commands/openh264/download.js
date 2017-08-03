/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const {download} = require(`../../lib/openh264`);

module.exports = {
  command: `download`,
  desc: `Download the openh264 code`,
  builder: {},
  async handler() {
    await download();
  }
};
