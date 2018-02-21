const browserSpock = browser.select('browserSpock');
const browserMccoy = browser.select('browserMccoy');

/**
 * Wrapper around browser.addCommand that adds a command to all multiremote
 * browsers as well as the main browser instance.
 * @param {string} name
 * @param {Function} fn
 */
module.exports = function addCommand(name, fn) {
  [
    browser,
    browserMccoy,
    browserSpock
  ].forEach((b) => b.addCommand(name, fn));
};
