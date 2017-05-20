'use strict';

const wrapHandler = require(`../../lib/wrap-handler`);
const {download} = require(`../../lib/openh264`);

module.exports = {
  command: `download`,
  desc: `Download the openh264 code`,
  builder: {},
  handler: wrapHandler(async () => {
    await download();
  })
};
