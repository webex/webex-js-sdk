/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

module.exports = {
  command: `openh264`,
  desc: `Tasks for getting and using the open h264 codec in Firefox`,
  builder(yargs) {
    return yargs
      .demandCommand(1)
      .commandDir(`./openh264`);
  }
};
