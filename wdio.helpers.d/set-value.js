const addCommand = require('./lib/add-command');

/**
 * Helper. Runs in the browser context.
 * @param {string} selector
 * @param {string} token
 */
function setValueInDOMHelper(selector, token) {
  /* eslint-env browser */
  document.querySelector(selector).value = token;
}

/**
 * Similar to the interface for setValue, but rather than setting a form-field
 * value by sending a series of key-strokes, this runs a function in the browser
 * context to call `$(selector).value = value`. In general, use setValue, but
 * for very large fields (namely, self-contained access tokens), this will save
 * noticeable amount of test time
 * @param {string} selector
 * @param {string} value
 */
addCommand('setValueInDOM', function setValueInDOM(selector, value) {
  this.execute(setValueInDOMHelper, selector, value);
});
