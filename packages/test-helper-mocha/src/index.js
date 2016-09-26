/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

function inNode() {
  return typeof window === 'undefined';
}

function inBrowser() {
  return !inNode();
}

function noop() {
  // intentionally empty
}

module.exports = {
  /**
   * Wrap the desired mochaMethod with `flaky` to indicate it's a flaky test and
   * exclude it from the cloudapps pipeline
   * example:
   * `flaky(it)('sometimes passes and sometimes failes')`
   * @param {Function} mochaMethod `it` or `describe`
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  flaky: function flaky(mochaMethod) {
    // If mochaMethod doesn't have a skip method, assume that mochaMethod is
    // already either a .skip or a .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }
    return process.env.SKIP_FLAKY_TESTS ? mochaMethod.skip : mochaMethod;
  },

  inBrowser: inBrowser,

  inNode: inNode,

  /**
   * Wrap the desired mochaMethod with `skipInBrowser` to prevent the
   * corresponding test or group of tests from running in a web browser
   * example:
   * `skipInBrowser(it)('does a thing that only works in node')`
   * @param {Function} mochaMethod `it` or `describe`
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  skipInBrowser: function skipInBrowser(mochaMethod) {
    // If mochaMethod doesn't have a skip method, assume that mochaMethod is
    // already either a .skip or a .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }
    return inBrowser() ? mochaMethod.skip : mochaMethod;
  },

  /**
   * Wrap the desired mochaMethod with `skipInNode` to prevent the
   * corresponding test or group of tests from running in node.
   * example:
   * `skipInNode(it)('does a thing that only works in a web browser')`
   * @param {Function} mochaMethod `it` or `describe`
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  skipInNode: function skipInNode(mochaMethod) {
    // If mochaMethod doesn't have a skip method, assume that mochaMethod is
    // already either a .skip or a .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }
    return inNode() ? mochaMethod.skip : mochaMethod;
  },

  /**
   * Similar to skipInNode in that it prevents the test from running, but goes a
   * step further to hide it from the list of skipped tests. Should be used when
   * the test will never be valid in NodeJS
   * @param {Function} mochaMethod
   * @returns {Function}
   */
  browserOnly: function browserOnly(mochaMethod) {
    return inBrowser() ? mochaMethod : noop;
  },

  /**
   * Similar to skipInBrowser in that it prevents the test from running, but
   * goes a step further to hide it from the list of skipped tests. Should be
   * used when the test will never be valid in a Browser
   * @param {Function} mochaMethod
   * @returns {Function}
   */
  nodeOnly: function nodeOnly(mochaMethod) {
    return inNode() ? mochaMethod : noop;
  }
};
