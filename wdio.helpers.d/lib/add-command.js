/**
 * Wrapper around browser.addCommand that adds a command to all multiremote
 * browsers as well as the main browser instance.
 * @param {string} name
 * @param {Function} fn
 * @returns {null}
 */
module.exports = function addCommand(name, fn) {
  browser.addCommand(name, fn);
};
