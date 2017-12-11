/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import {browserOnly, nodeOnly} from '@ciscospark/test-helper-mocha';
import Logger, {levels} from '@ciscospark/plugin-logger';
import {SparkHttpError} from '@ciscospark/spark-core';

describe('plugin-logger', () => {
  beforeEach(() => {
    levels.forEach((level) => {
      if (console[level]) {
        sinon.spy(console, level);
      }
    });
  });

  afterEach(() => {
    levels.forEach((level) => {
      if (console[level] && console[level].restore) {
        console[level].restore();
      }
    });
  });

  let nodeEnv;
  beforeEach(() => {
    nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = '';
  });

  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  let spark;
  beforeEach(() => {
    spark = new MockSpark({
      children: {
        logger: Logger
      }
    });
  });

  const fallbacks = {
    error: ['log'],
    warn: ['error', 'log'],
    info: ['log'],
    debug: ['info', 'log'],
    trace: ['debug', 'info', 'log']
  };

  function impl(level) {
    let impls = fallbacks[level];
    let i = level;
    if (impls) {
      impls = impls.slice();
      while (!console[i]) {
        i = impls.pop();
      }
    }
    return i;
  }

  describe('#log()', () => {
    it('prints the specified message to the console', () => {
      spark.config.logger.level = 'trace';
      spark.logger.log('test');
      assert.calledWith(console.log, 'test');
    });

    it('stores the specified message in the log buffer', () => {
      spark.logger.log('test');
      assert.lengthOf(spark.logger.buffer, 1);
      assert.isNumber(spark.logger.buffer[0][0]);
      assert.match(spark.logger.buffer[0][1], /test/);
    });

    it('prevents the buffer from overflowing', () => {
      spark.config.logger.historyLength = 2;
      spark.logger.log(1);
      assert.lengthOf(spark.logger.buffer, 1);
      spark.logger.log(2);
      assert.lengthOf(spark.logger.buffer, 2);
      spark.logger.log(3);
      assert.lengthOf(spark.logger.buffer, 2);
      assert.equal(spark.logger.buffer[0][1], 2);
      assert.equal(spark.logger.buffer[1][1], 3);
    });

    // Node handles custom errors correctly, so this test is browser specific
    browserOnly(it)('prints custom errors in a readable fashion', () => {
      spark.config.logger.level = 'trace';
      const error = new SparkHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error'
        },
        options: {
          service: '',
          headers: {}
        }
      });
      spark.logger.log(error);
      assert.lengthOf(spark.logger.buffer, 1);
      assert.match(console.log.args[0][0], /SparkHttpError/);
    });

    it('buffers custom errors in a readable fashion', () => {
      spark.config.logger.level = 'trace';
      const error = new SparkHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error'
        },
        options: {
          service: '',
          headers: {}
        }
      });
      spark.logger.log(error);
      assert.lengthOf(spark.logger.buffer, 1);
      assert.match(spark.logger.buffer[0][1], /SparkHttpError/g);
    });
  });

  // We can't manipulate NODE_ENV in karma, tests, so run this chunk only in
  // node
  describe('#shouldPrint()', () => {
    nodeOnly(afterEach)(() => {
      process.env.CISCOSPARK_LOG_LEVEL = undefined;
    });

    it('indicates whether or not the desired log should be printed at the current log level', () => {
      /* eslint max-statements: [0] */
      spark.logger.config.level = 'trace';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `trace`');
      assert.isTrue(spark.logger.shouldPrint('warn'), 'it prints `warn` logs when the level is `trace`');
      assert.isTrue(spark.logger.shouldPrint('log'), 'it prints `log` logs when the level is `trace`');
      assert.isTrue(spark.logger.shouldPrint('info'), 'it prints `info` logs when the level is `trace`');
      assert.isTrue(spark.logger.shouldPrint('debug'), 'it prints `debug` logs when the level is `trace`');
      assert.isTrue(spark.logger.shouldPrint('trace'), 'it prints `trace` logs when the level is `trace`');

      spark.logger.config.level = 'debug';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `debug`');
      assert.isTrue(spark.logger.shouldPrint('warn'), 'it prints `warn` logs when the level is `debug`');
      assert.isTrue(spark.logger.shouldPrint('log'), 'it prints `log` logs when the level is `debug`');
      assert.isTrue(spark.logger.shouldPrint('info'), 'it prints `info` logs when the level is `debug`');
      assert.isTrue(spark.logger.shouldPrint('debug'), 'it prints `debug` logs when the level is `debug`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `debug`');

      spark.logger.config.level = 'info';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `info`');
      assert.isTrue(spark.logger.shouldPrint('warn'), 'it prints `warn` logs when the level is `info`');
      assert.isTrue(spark.logger.shouldPrint('log'), 'it prints `log` logs when the level is `info`');
      assert.isTrue(spark.logger.shouldPrint('info'), 'it prints `info` logs when the level is `info`');
      assert.isFalse(spark.logger.shouldPrint('debug'), 'it does not print `debug` logs when the level is `info`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `info`');

      spark.logger.config.level = 'log';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `log`');
      assert.isTrue(spark.logger.shouldPrint('warn'), 'it prints `warn` logs when the level is `log`');
      assert.isTrue(spark.logger.shouldPrint('log'), 'it prints `log` logs when the level is `log`');
      assert.isFalse(spark.logger.shouldPrint('info'), 'it does not print `info` logs when the level is `log`');
      assert.isFalse(spark.logger.shouldPrint('debug'), 'it does not print `debug` logs when the level is `log`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `log`');

      spark.logger.config.level = 'warn';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `warn`');
      assert.isTrue(spark.logger.shouldPrint('warn'), 'it prints `warn` logs when the level is `warn`');
      assert.isFalse(spark.logger.shouldPrint('log'), 'it does not print `log` logs when the level is `warn`');
      assert.isFalse(spark.logger.shouldPrint('info'), 'it does not print `info` logs when the level is `warn`');
      assert.isFalse(spark.logger.shouldPrint('debug'), 'it does not print `debug` logs when the level is `warn`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `warn`');

      spark.logger.config.level = 'error';
      assert.isTrue(spark.logger.shouldPrint('error'), 'it prints `error` logs when the level is `error`');
      assert.isFalse(spark.logger.shouldPrint('warn'), 'it does not print `warn` logs when the level `error` is ');
      assert.isFalse(spark.logger.shouldPrint('log'), 'it does not print `log` logs when the level is `error`');
      assert.isFalse(spark.logger.shouldPrint('info'), 'it does not print `info` logs when the level is `error`');
      assert.isFalse(spark.logger.shouldPrint('debug'), 'it does not print `debug` logs when the level is `error`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `error`');

      spark.logger.config.level = 'silent';
      assert.isFalse(spark.logger.shouldPrint('error'), 'it does not print `error` logs when the level is `silent`');
      assert.isFalse(spark.logger.shouldPrint('warn'), 'it does not print `warn` logs when the level is `silent`');
      assert.isFalse(spark.logger.shouldPrint('log'), 'it does not print `log` logs when the level is `silent`');
      assert.isFalse(spark.logger.shouldPrint('info'), 'it does not print `info` logs when the level is `silent`');
      assert.isFalse(spark.logger.shouldPrint('debug'), 'it does not print `debug` logs when the level is `silent`');
      assert.isFalse(spark.logger.shouldPrint('trace'), 'it does not print `trace` logs when the level is `silent`');
    });

    nodeOnly(it)('uses the CISCOSPARK_LOG_LEVEL environment varable to control log level', () => {
      levels.forEach((level) => {
        process.env.CISCOSPARK_LOG_LEVEL = level;
        console[impl(level)].reset();
        spark.logger[level](`test: ${level}`);
        assert.calledOnce(console[impl(level)]);
      });
    });

    it('prefers the config specified logger.level', () => {
      levels.forEach((level) => {
        spark.logger.config.level = level;
        console[impl(level)].reset();
        spark.logger[level](`test: ${level}`);
        assert.calledOnce(console[impl(level)]);
      });
    });

    nodeOnly(it)('logs at TRACE in test environments', () => {
      console.trace.restore();
      sinon.stub(console, 'trace');
      process.env.NODE_ENV = undefined;
      assert.notCalled(console.trace);
      spark.logger.trace('test');
      assert.notCalled(console.trace);

      process.env.NODE_ENV = 'test';
      spark.logger.trace('test');
      assert.called(console.trace);
    });

    nodeOnly(it)('checks the developer feature toggle "log-level" when available', () => {
      assert.notCalled(console.info);
      spark.logger.info('test');
      assert.notCalled(console.info);

      spark.internal.device = {
        features: {
          developer: {
            get() {
              return 'info';
            }
          },
          entitlement: {
            get() {
              return false;
            }
          }
        }
      };
      spark.logger.info('test');
      assert.called(console.info);
    });

    nodeOnly(it)('doesn\'t break if the feature toggle is set to an incorrect value', () => {
      assert.doesNotThrow(() => {
        assert.notCalled(console.info);
        spark.logger.info('test');
        assert.notCalled(console.info);

        spark.internal.device = {
          features: {
            developer: {
              get() {
                return 'not-a-log-method';
              }
            },
            entitlement: {
              get() {
                return false;
              }
            }
          }
        };
        spark.logger.info('test');
        assert.notCalled(console.info);
      });
    });

    nodeOnly(it)('defaults to "error" for all other users', () => {
      spark.logger.error('test');
      assert.called(console.error);

      spark.logger.warn('test');
      assert.notCalled(console.warn);
    });
  });

  describe('#filter', () => {
    it('redacts email addresses', () => {
      const message = {
        blarg: 'test@example.com'
      };

      assert.deepEqual(spark.logger.filter(message), [{
        blarg: '-- REDACTED --'
      }]);
    });

    it('strips auth headers from log output', () => {
      const msg = {
        headers: {
          authorization: 'Bearer'
        },
        options: {
          headers: {
            trackingid: '123',
            authorization: 'Bearer'
          }
        }
      };

      assert.doesNotThrow(() => {
        spark.logger.filter({});
        spark.logger.filter({headers: {}});
        spark.logger.filter({headers: {authorization: ''}});
        spark.logger.filter({options: {}});
        spark.logger.filter({options: {headers: {}}});
        spark.logger.filter({options: {headers: {authorization: ''}}});
        spark.logger.filter([{options: {headers: {authorization: ''}}}]);
      });

      const [filtered] = spark.logger.filter(msg);
      assert.nestedProperty(msg, 'headers.authorization', 'it does not alter the original message');
      assert.nestedProperty(msg, 'options.headers.authorization', 'it does not alter the original message');

      assert.notNestedProperty(filtered, 'headers.authorization', 'it removes headers.authorization');
      assert.notNestedProperty(filtered, 'options.headers.authorization', 'it removes options.headers.authorization');
      assert.nestedProperty(msg, 'options.headers.trackingid', 'it does not remove other header values');
      assert.nestedProperty(filtered, 'options.headers.trackingid', 'it does not remove other header values');
    });
  });

  [
    'error',
    'warn',
    'log',
    'info',
    'debug',
    'trace'
  ].forEach((level) => {
    describe(`#${level}()`, () => {
      it(`proxies console.${level}`, () => {
        spark.logger.config.level = level;
        assert.notCalled(console[impl(level)]);
        spark.logger[level]('a log statement');
        assert.called(console[impl(level)]);
      });

      it('removes authorization data', () => {
        spark.logger.config.level = level;
        spark.logger[level]({
          headers: {
            authorization: 'Bearer',
            trackingid: '123'
          }
        });
        assert.calledWith(console[impl(level)], {
          headers: {
            trackingid: '123'
          }
        });
      });
    });
  });
});
