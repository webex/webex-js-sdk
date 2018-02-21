const addCommand = require('./lib/add-command');

/**
 * waits for a specific string (or regex) to appear in the specified selector
 * @param {string} selector
 * @param {string|RegExp} value
 * @param {number} [timeout=500]
 * @param {booean} [reverse=false]
 */
addCommand('waitForSpecificText', function waitForSpecificText(selector, value, timeout = 5000, reverse = false) {
  let condition;

  if (typeof value === 'string') {
    condition = () => this.getText(selector) === value;
  }
  else if (value instanceof RegExp) {
    condition = () => value.test(this.getText(selector));
  }
  else {
    throw new Error('`value` must be a string or a RegExp');
  }

  if (reverse) {
    this.waitUntil(() => !condition(), timeout, `$('${selector}') did not change from ${value} within the expected timeout`);
  }
  else {
    this.waitUntil(() => condition(), timeout, `$('${selector}') did not equal ${value} within the expected timeout`);
  }
});
