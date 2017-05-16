'use strict';

const wrapHandler = require(`../../lib/wrap-handler`);
const {next} = require(`../../lib/version`);

module.exports = {
  command: `next`,
  desc: `Determine the next version`,
  builder: {},
  handler: wrapHandler(async () => {
    // eslint-disable-next-line callback-return
    console.log(await next());
  })
};
