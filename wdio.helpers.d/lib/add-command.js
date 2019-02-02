// const browserSpock = browser.browserSpock;
// const browserMccoy = browser.browserMccoy;

/**
 * Wrapper around browser.addCommand that adds a command to all multiremote
 * browsers as well as the main browser instance.
 * @param {string} name
 * @param {Function} fn
 */
module.exports = function addCommand(name, fn) {
  [
    browser,
    browser.browserMccoy,
    browser.browserSpock
  ].forEach((b) => b.addCommand(name, fn));
};
