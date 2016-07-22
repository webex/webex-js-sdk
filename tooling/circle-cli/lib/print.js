'use strict';

const _ = require(`lodash`);
const util = require(`util`);

module.exports = _.curry((argv, result) => {
  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
  }
  else {
    console.log(util.inspect(result, {depth: null}));
  }
  return result;
});
