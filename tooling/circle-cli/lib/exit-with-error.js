'use strict';

const fs = require(`fs`);

module.exports = function exitWithError(reason) {
  console.log(Object.keys(reason));
  console.error(reason);
  console.error(reason.body);
  console.error(reason.stack);
  if (reason.message.indexOf(`503`) !== -1) {
    console.warn(`CircleCI appears to be having a capacity problem`);
    console.warn(`Please check http://status.circleci.com/`);
    console.warn(`Consider running this build internally until Circle recovers`);
    fs.writeFileSync(`503`, `yes`);
  }
  process.exit(1);
};
