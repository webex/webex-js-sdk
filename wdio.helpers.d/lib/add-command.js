const browserFirefox = browser.select('browserFirefox');
const browserChrome = browser.select('browserChrome');

/**
 * Wrapper around browser.addCommand that adds a command to all multiremote
 * browsers as well as the main browser instance.
 * @param {string} name
 * @param {Function} fn
 */
module.exports = function addCommand(name, fn) {
  [
    browser,
    browserChrome,
    browserFirefox
  ].forEach((b) => b.addCommand(name, fn));
};
