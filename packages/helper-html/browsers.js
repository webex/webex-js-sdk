/* eslint-disable */

'use strict';

module.exports = function(browsers) {
  // For reasons as-yet unexplained, the html filter test suite hangs when run
  // on Safari/Sauce Labs
  Object.keys(browsers.sauce).forEach(function(key) {
    if (key.indexOf('safari') !== -1) {
      delete browsers.sauce[key];
    }
  });
  return browsers;
};
