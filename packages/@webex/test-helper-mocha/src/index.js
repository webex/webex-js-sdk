/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const bowser = require('bowser');

/**
 * Indicates if we're running in node
 * @returns {boolean}
 * @private
 */
function inNode() {
  return typeof window === 'undefined';
}

/**
 * Indicates if we're running in a web browser
 * @returns {boolean}
 * @private
 */
function inBrowser() {
  return !inNode();
}

/**
 * Indicates if we are running in the named browser
 * @param {string} name name of the browser
 * @returns {boolean}
 */
function inSpecificBrowser(name) {
  return window && bowser.getParser(window.navigator.userAgent).isBrowser(name);
}

/**
 * Indicates if we're running in firefox
 * @returns {boolean}
 * @private
 */
function inFirefox() {
  return inSpecificBrowser('firefox');
}

/**
 * Indicates if we're running in safari
 * @returns {boolean}
 * @private
 */
function inSafari() {
  return inSpecificBrowser('safari');
}

/**
 * Indicates if we're running on Jenkins
 * @returns {boolean}
 * @private
 */
function inJenkins() {
  return process.env.JENKINS;
}

/**
 * noop
 * @returns {undefined}
 * @private
 */
function noop() {
  // intentionally empty
}

module.exports = {
  /**
   * Wrap the desired mochaMethod with `flaky` to indicate it's a flaky test
   * and exclude it from the test suite.
   * example:
   * `flaky(it)('sometimes passes and sometimes failes')`
   * @param {Function} mochaMethod `it` or `describe`
   * @param {string} envVar process.env.SKIP_FLAKY_TESTS
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  flaky: function flaky(mochaMethod, envVar) {
    // If mochaMethod doesn't have a skip method,
    // assume the mochaMethod is either a .skip or .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }

    const shouldSkip = envVar && envVar !== 'false' && !!envVar;

    return shouldSkip ? mochaMethod.skip : mochaMethod;
  },

  /**
   * A lot of failures get produced by EventEmitters, which makes them difficult to
   * detect in tests (they just look like timeouts). This is a test helper that
   * captures that error and turns it into a rejected promise
   * @param {EventEmitter} emitter
   * @param {Function} fn
   * @returns {Promise}
   */
  handleErrorEvent: function handleErrorEvent(emitter, fn) {
    let r;
    const p = new Promise((resolve, reject) => {
      r = reject;
      emitter.once('error', reject);
    });

    const handler = Promise.race([p, fn(emitter)])
      .then(unbind)
      .catch((reason) => {
        unbind();
        throw reason;
      });

    // Make it possible to add additional emitters
    handler.add = (e) => e.once('error', r);

    return handler;

    /**
     * unbinder
     * @private
     * @returns {undefined}
     */
    function unbind() {
      try {
        emitter.off('error', r);
      } catch (err) {
        // ignore
      }
    }
  },

  inBrowser,

  inNode,

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
   * Wrap the desired mochaMethod with `skipInFirefox` to prevent the
   * corresponding test or group of tests from running in Firefox.
   * example:
   * `skipInFirefox(it)('does a thing that does not work in Firefox')`
   * @param {Function} mochaMethod `it` or `describe`
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  skipInFirefox: function skipInFirefox(mochaMethod) {
    // If mochaMethod doesn't have a skip method, assume that mochaMethod is
    // already either a .skip or a .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }

    return inFirefox() ? mochaMethod.skip : mochaMethod;
  },

  /**
   * Wrap the desired mochaMethod with `skipInSafari` to prevent the
   * corresponding test or group of tests from running in Safari.
   * example:
   * `skipInSafari(it)('does a thing that does not work in Safari')`
   * @param {Function} mochaMethod `it` or `describe`
   * @returns {Function} mochaMethod or mochaMethod.skip
   */
  skipInSafari: function skipInSafari(mochaMethod) {
    // If mochaMethod doesn't have a skip method, assume that mochaMethod is
    // already either a .skip or a .only
    if (!mochaMethod.skip) {
      return mochaMethod;
    }

    return inSafari() ? mochaMethod.skip : mochaMethod;
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
  },

  /**
   * Similar to skipInBrowser in that it prevents the test from running, but
   * goes a step further to hide it from the list of skipped tests. Should be
   * used when the test should be run on Jenkins only
   * @param {*} mochaMethod
   * @returns {Functions}
   */
  jenkinsOnly: function jenkinsOnly(mochaMethod) {
    return inJenkins() ? mochaMethod : noop;
  },

  /**
   * @param {number} max
   * @param {string} event
   * @param {EventEmitter} emitter
   * @param {function} activityChecker // callback to check if activity matches
   * @param {string} msg
   * @returns {Promise<mixed>} Resolves with the activity
   */
  expectActivity: function expectActivity(max, event, emitter, activityChecker, msg) {
    let timer;

    /**
     * helper
     * @private
     * @returns {undefined}
     */
    function unbind() {
      try {
        clearTimeout(timer);
        emitter.off(event);
      } catch (err) {
        // ignore
      }
    }

    return Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${event} did not fire within ${max}ms${msg ? `: ${msg}` : ''}`));
        }, max);
      }),
      new Promise((resolve) => {
        emitter.on(event, (result) => {
          const {
            data: {activity},
          } = result;

          if (activityChecker(activity)) {
            unbind();
            resolve(activity);
          }
        });
      }),
    ]).catch((reason) => {
      unbind();
      throw reason;
    });
  },

  /**
   * Returns a promise that resolves after timeout or rejects
   * when count has been exceeded. Will also reject if count
   * hasn't been met after timeout
   * @param {number} max amount of time to wait for events in ms
   * @param {number} count number of events to expect in timeframe
   * @param {string} event
   * @param {EventEmitter} emitter
   * @returns {Promise}
   */
  expectExactlyNEvents: function expectExactlyNEvents(max, count, event, emitter) {
    let lastResult;
    let timer;

    let currentCount = 0;

    return Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          if (currentCount === count) {
            resolve(lastResult);
          } else {
            reject(
              new Error(
                `${event} fired only ${currentCount} times within ${max}ms. expected ${count} times`
              )
            );
          }
        }, max);
      }),
      new Promise((resolve, reject) => {
        emitter.on(event, fn);

        /**
         * helper
         * @private
         * @param {object} result
         * @returns {undefined}
         */
        function fn(result) {
          lastResult = result;
          currentCount += 1;
          if (currentCount > count) {
            emitter.off(event, fn);
            clearTimeout(timer);
            reject(
              new Error(
                `${event} fired ${currentCount} times within ${max}ms. expected ${count} times`
              )
            );
          }
        }
      }),
    ]);
  },

  /**
   * Returns a promise that resolves when event is fired count times or rejects
   * when max expires
   * @param {number} max
   * @param {number} count
   * @param {string} event
   * @param {EventEmitter} emitter
   * @returns {Promise}
   */
  expectNEvents: function expectNEvents(max, count, event, emitter) {
    let timer;

    let currentCount = 0;

    return Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${event} fired only ${currentCount} times within ${max}ms. expected ${count} times`
            )
          );
        }, max);
      }),
      new Promise((resolve) => {
        emitter.on(event, fn);

        /**
         * helper
         * @private
         * @returns {undefined}
         */
        function fn() {
          currentCount += 1;
          if (currentCount === count) {
            emitter.off(event, fn);
            clearTimeout(timer);
            resolve();
          }
        }
      }),
    ]);
  },

  /**
   * @param {number} max
   * @param {string} event
   * @param {EventEmitter} emitter
   * @param {string} msg
   * @returns {Promise<mixed>} Resolves with the results of the event
   */
  expectEvent: function expectEvent(max, event, emitter, msg) {
    let timer;

    return Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${event} did not fire within ${max}ms${msg ? `: ${msg}` : ''}`));
        }, max);
      }),
      new Promise((resolve) => {
        emitter.once(event, (result) => {
          clearTimeout(timer);
          resolve(result);
        });
      }),
    ]);
  },

  /**
   * Only run the specified test in firefox
   * @param {Function} mochaMethod
   * @returns {Function}
   */
  firefoxOnly: function firefoxOnly(mochaMethod) {
    return inFirefox() ? mochaMethod : noop;
  },

  /**
   * Waits max ms or until emitter fires event, then resolves
   * @param {number} max
   * @param {string} event
   * @param {EventEmitter} emitter
   * @returns {Promise<mixed>}
   */
  maxWaitForEvent: function maxWaitForEvent(max, event, emitter) {
    return Promise.race([
      new Promise((resolve) => {
        setTimeout(resolve, max);
      }),
      new Promise((resolve) => {
        emitter.once(event, resolve);
      }),
    ]);
  },

  /**
   * Waits timeout ms or until the promise resolves. Rejects if the timeout is
   * hit, otherwise resolves
   * @param {number} timeout
   * @param {Promise} promise
   * @returns {Promise<mixed>}
   */
  maxWaitForPromise: function maxWaitForPromise(timeout, promise) {
    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout of ${timeout} expired before promise completed`));
        }, timeout);
      }),
    ]);
  },

  /**
   * Do not execute the specified mochaMethod until we pass the specified date
   * @param {Date|string} until
   * @param {string} explanation - Doesn't do anything, but forces you to defend
   * your decision to snooze a test
   * @returns {Function}
   */
  snoozeUntil: function snoozeUntil(until, explanation) {
    const now = new Date();

    if (!explanation) {
      throw new Error('You must defend your decision to snooze this test');
    }

    const d = new Date(until);

    if (Number.isNaN(d.getTime())) {
      throw new Error(`"${until}" does not appear to a valid date`);
    }

    const skip = now < d;

    return (mochaMethod) => {
      if (skip) {
        return mochaMethod.skip;
      }

      return mochaMethod;
    };
  },
};
