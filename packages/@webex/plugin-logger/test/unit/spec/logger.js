/* eslint-disable no-await-in-loop */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {browserOnly, nodeOnly, inBrowser} from '@webex/test-helper-mocha';
import Logger, {levels} from '@webex/plugin-logger';
import {WebexHttpError} from '@webex/webex-core';

import loggerConfig from '../../../src/config';

describe('plugin-logger', () => {
  const logSpies = [];

  beforeEach(() => {
    levels.forEach((level) => {
      if (console[level]) {
        logSpies[level] = sinon.spy(console, level);
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

  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        logger: Logger,
      },
    });
    webex.logger.config.historyLength = 10000;
  });

  const fallbacks = {
    error: ['log'],
    warn: ['error', 'log'],
    info: ['log'],
    debug: ['info', 'log'],
    trace: ['debug', 'info', 'log'],
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
      webex.config.logger.level = 'trace';
      webex.logger.log('test');
      assert.calledWith(console.log, 'wx-js-sdk', 'test');
    });

    it('stores the specified message in the log buffer', () => {
      webex.logger.log('test');
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.match(webex.logger.buffer.buffer[0][3], /test/);
    });

    it('adds the date to the beggining of the buffer entry', () => {
      webex.logger.log('test date');

      // Convert string back to date object
      const logDate = new Date(webex.logger.buffer.buffer[0][1]);

      // eslint-disable-next-line no-restricted-globals
      assert.isTrue(logDate instanceof Date && isNaN(webex.logger.buffer.buffer[0][1]));
      assert.isString(webex.logger.buffer.buffer[0][0]);
      assert.isString(webex.logger.buffer.buffer[0][1]);
      assert.match(webex.logger.buffer.buffer[0][3], /test date/);
    });

    it('stores the specified message in the client and sdk log buffer', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      webex.logger.log('testsdk');
      webex.logger.client_log('testclient');
      assert.lengthOf(webex.logger.sdkBuffer.buffer, 1);
      assert.isString(webex.logger.sdkBuffer.buffer[0][0]);
      assert.isString(webex.logger.sdkBuffer.buffer[0][1]);
      assert.match(webex.logger.sdkBuffer.buffer[0][2], /wx-js-sdk/);
      assert.match(webex.logger.sdkBuffer.buffer[0][3], /testsdk/);
      assert.lengthOf(webex.logger.clientBuffer.buffer, 1);
      assert.isString(webex.logger.clientBuffer.buffer[0][0]);
      assert.isString(webex.logger.clientBuffer.buffer[0][1]);
      assert.match(webex.logger.clientBuffer.buffer[0][2], /someclient/);
      assert.match(webex.logger.clientBuffer.buffer[0][3], /testclient/);
    });

    it('prevents the buffer from overflowing', () => {
      webex.config.logger.historyLength = 2;
      webex.logger.log(1);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      webex.logger.log(2);
      assert.lengthOf(webex.logger.buffer.buffer, 2);
      webex.logger.log(3);
      assert.lengthOf(webex.logger.buffer.buffer, 2);
      assert.equal(webex.logger.buffer.buffer[0][3], 2);
      assert.equal(webex.logger.buffer.buffer[1][3], 3);
    });

    it('adjusts lastSubmitted when buffer overflows in single buffer mode', () => {
      webex.config.logger.historyLength = 3;

      webex.logger.log('a');
      webex.logger.log('b');

      // simulate a successful upload
      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      assert.equal(webex.logger.buffer.lastSubmitted, 2);

      // add more logs to trigger overflow
      webex.logger.log('c');
      webex.logger.log('d');

      // buffer overflowed by 1, so lastSubmitted should be decremented by 1
      assert.equal(webex.logger.buffer.lastSubmitted, 1);
    });

    it('clamps lastSubmitted to 0 when buffer overflow exceeds lastSubmitted in single buffer mode', () => {
      webex.config.logger.historyLength = 2;

      webex.logger.log('a');

      // simulate a successful upload after just 1 log
      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      assert.equal(webex.logger.buffer.lastSubmitted, 1);

      // add enough logs to overflow past the lastSubmitted value
      webex.logger.log('b');
      webex.logger.log('c');
      webex.logger.log('d');

      assert.equal(webex.logger.buffer.lastSubmitted, 0);
      assert.lengthOf(webex.logger.buffer.buffer, 2);
    });

    it('adjusts lastSubmitted when buffer overflows in separate buffer mode', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      webex.config.logger.historyLength = 3;

      webex.logger.log('sdk1');
      webex.logger.log('sdk2');
      webex.logger.client_log('client1');
      webex.logger.client_log('client2');

      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      assert.equal(webex.logger.sdkBuffer.lastSubmitted, 2);
      assert.equal(webex.logger.clientBuffer.lastSubmitted, 2);

      // overflow both buffers by 1
      webex.logger.log('sdk3');
      webex.logger.log('sdk4');
      webex.logger.client_log('client3');
      webex.logger.client_log('client4');

      assert.equal(webex.logger.sdkBuffer.lastSubmitted, 1);
      assert.equal(webex.logger.clientBuffer.lastSubmitted, 1);
    });

    it('prevents the client and sdk buffer from overflowing', () => {
      webex.config.logger.historyLength = 2;
      webex.config.logger.separateLogBuffers = true;
      webex.logger.log(1);
      webex.logger.client_log(3);
      assert.lengthOf(webex.logger.sdkBuffer.buffer, 1);
      assert.lengthOf(webex.logger.clientBuffer.buffer, 1);
      webex.logger.log(2);
      webex.logger.client_log(2);
      assert.lengthOf(webex.logger.sdkBuffer.buffer, 2);
      assert.lengthOf(webex.logger.clientBuffer.buffer, 2);
      webex.logger.log(3);
      webex.logger.client_log(1);
      assert.lengthOf(webex.logger.sdkBuffer.buffer, 2);
      assert.lengthOf(webex.logger.clientBuffer.buffer, 2);
      assert.equal(webex.logger.sdkBuffer.buffer[0][3], 2);
      assert.equal(webex.logger.sdkBuffer.buffer[1][3], 3);
      assert.equal(webex.logger.sdkBuffer.buffer[0][3], 2);
      assert.equal(webex.logger.clientBuffer.buffer[1][3], 1);
    });

    // Node handles custom errors correctly, so this test is browser specific
    browserOnly(it)('prints custom errors in a readable fashion', () => {
      webex.config.logger.level = 'trace';
      const error = new WebexHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error',
        },
        options: {
          service: '',
          headers: {},
        },
      });

      webex.logger.log(error);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.match(console.log.args[0][1], /WebexHttpError/);
    });

    it('buffers custom errors in a readable fashion', () => {
      webex.config.logger.level = 'trace';
      const error = new WebexHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error',
        },
        options: {
          service: '',
          headers: {},
        },
      });

      webex.logger.log(error);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.match(webex.logger.buffer.buffer[0][3], /WebexHttpError/g);
    });

    it('formats objects as strings passed to the logger for readability not [Object object]', async () => {
      webex.config.logger.level = 'trace';
      const obj = {
        headers: {
          authorization: 'Bearer',
          trackingid: '123',
        },
        test: 'object',
        nested: {
          test2: 'object2',
        },
      };

      webex.logger.log('foo', 'bar', obj);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.lengthOf(webex.logger.buffer.buffer[0], 6);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'foo');
      assert.deepEqual(webex.logger.buffer.buffer[0][4], 'bar');
      assert.deepEqual(
        webex.logger.buffer.buffer[0][5],
        '{"headers":{"trackingid":"123"},"test":"object","nested":{"test2":"object2"}}'
      );
    });

    it('formats objects as strings passed to the logger for readability not [Object object] w/ circular reference', async () => {
      webex.config.logger.level = 'trace';
      const obj = {
        headers: {
          authorization: 'Bearer',
          trackingid: '123',
        },
        test: 'object',
        nested: {
          test2: 'object2',
        },
      };

      obj.selfReference = obj;

      webex.logger.log('foo', 'bar', obj);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.lengthOf(webex.logger.buffer.buffer[0], 6);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'foo');
      assert.deepEqual(webex.logger.buffer.buffer[0][4], 'bar');
      assert.deepEqual(
        webex.logger.buffer.buffer[0][5],
        '{"headers":{"trackingid":"123"},"test":"object","nested":{"test2":"object2"}}'
      );
    });

    it('formats Errors correctly', async () => {
      webex.config.logger.level = 'trace';
      const err = new Error('fake error for testing');

      webex.logger.log('I got this error:', err);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'I got this error:');
      const expected =
        process.env.NODE_ENV === 'test' && inBrowser()
          ? `${err}BEGIN STACK${err.stack}END STACK`
          : 'Error: fake error for testing';

      assert.deepEqual(webex.logger.buffer.buffer[0][4], expected);
    });
  });

  // We can't manipulate NODE_ENV in karma, tests, so run this chunk only in
  // node
  describe('#shouldPrint()', () => {
    nodeOnly(afterEach)(() => {
      process.env.WEBEX_LOG_LEVEL = undefined;
    });

    function testLevels(logType, logConfigSetting) {
      /* eslint max-statements: [0] */
      webex.logger.config[logConfigSetting] = 'trace';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `trace`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('warn', logType),
        'it prints `warn` logs when the level is `trace`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('log', logType),
        'it prints `log` logs when the level is `trace`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('info', logType),
        'it prints `info` logs when the level is `trace`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('debug', logType),
        'it prints `debug` logs when the level is `trace`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('trace', logType),
        'it prints `trace` logs when the level is `trace`'
      );

      webex.logger.config[logConfigSetting] = 'debug';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `debug`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('warn', logType),
        'it prints `warn` logs when the level is `debug`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('log', logType),
        'it prints `log` logs when the level is `debug`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('info', logType),
        'it prints `info` logs when the level is `debug`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('debug', logType),
        'it prints `debug` logs when the level is `debug`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `debug`'
      );

      webex.logger.config[logConfigSetting] = 'info';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `info`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('warn', logType),
        'it prints `warn` logs when the level is `info`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('log', logType),
        'it prints `log` logs when the level is `info`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('info', logType),
        'it prints `info` logs when the level is `info`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('debug', logType),
        'it does not print `debug` logs when the level is `info`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `info`'
      );

      webex.logger.config[logConfigSetting] = 'log';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `log`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('warn', logType),
        'it prints `warn` logs when the level is `log`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('log', logType),
        'it prints `log` logs when the level is `log`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('info', logType),
        'it does not print `info` logs when the level is `log`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('debug', logType),
        'it does not print `debug` logs when the level is `log`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `log`'
      );

      webex.logger.config[logConfigSetting] = 'warn';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `warn`'
      );
      assert.isTrue(
        webex.logger.shouldPrint('warn', logType),
        'it prints `warn` logs when the level is `warn`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('log', logType),
        'it does not print `log` logs when the level is `warn`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('info', logType),
        'it does not print `info` logs when the level is `warn`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('debug', logType),
        'it does not print `debug` logs when the level is `warn`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `warn`'
      );

      webex.logger.config[logConfigSetting] = 'error';
      assert.isTrue(
        webex.logger.shouldPrint('error', logType),
        'it prints `error` logs when the level is `error`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('warn', logType),
        'it does not print `warn` logs when the level `error` is '
      );
      assert.isFalse(
        webex.logger.shouldPrint('log', logType),
        'it does not print `log` logs when the level is `error`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('info', logType),
        'it does not print `info` logs when the level is `error`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('debug', logType),
        'it does not print `debug` logs when the level is `error`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `error`'
      );

      webex.logger.config[logConfigSetting] = 'silent';
      assert.isFalse(
        webex.logger.shouldPrint('error', logType),
        'it does not print `error` logs when the level is `silent`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('warn', logType),
        'it does not print `warn` logs when the level is `silent`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('log', logType),
        'it does not print `log` logs when the level is `silent`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('info', logType),
        'it does not print `info` logs when the level is `silent`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('debug', logType),
        'it does not print `debug` logs when the level is `silent`'
      );
      assert.isFalse(
        webex.logger.shouldPrint('trace', logType),
        'it does not print `trace` logs when the level is `silent`'
      );
    }

    it('indicates whether or not the desired log should be printed at the current log level', () => {
      // test independence from client log level
      ['trace', 'debug', 'info', 'log', 'warn', 'error', 'silent'].forEach((clientLevel) => {
        webex.logger.config.clientLevel = clientLevel;
        testLevels(undefined, 'level');
        testLevels('sdk', 'level');
      });
    });

    it('factors in log type when passed in as client', () => {
      // test independence from sdk log level
      ['trace', 'debug', 'info', 'log', 'warn', 'error', 'silent'].forEach((sdkLevel) => {
        webex.logger.config.level = sdkLevel;
        testLevels('client', 'clientLevel');
      });
    });

    nodeOnly(it)('uses the WEBEX_LOG_LEVEL environment varable to control log level', () => {
      levels.forEach((level) => {
        process.env.WEBEX_LOG_LEVEL = level;
        console[impl(level)].resetHistory();
        webex.logger[level](`test: ${level}`);
        assert.calledOnce(console[impl(level)]);
      });
    });

    it('prefers the config specified logger.level', () => {
      levels.forEach((level) => {
        webex.logger.config.level = level;
        console[impl(level)].resetHistory();
        webex.logger[level](`test: ${level}`);
        assert.calledOnce(console[impl(level)]);
      });
    });

    nodeOnly(it)('logs at TRACE in test environments', () => {
      console.trace.restore();
      sinon.stub(console, 'trace');
      process.env.NODE_ENV = undefined;
      assert.notCalled(console.trace);
      webex.logger.trace('test');
      assert.notCalled(console.trace);

      process.env.NODE_ENV = 'test';
      webex.logger.trace('test');
      assert.called(console.trace);
    });

    nodeOnly(it)('checks the developer feature toggle "log-level" when available', () => {
      assert.notCalled(console.info);
      webex.logger.info('test');
      assert.notCalled(console.info);

      webex.internal.device = {
        features: {
          developer: {
            get() {
              return 'info';
            },
          },
          entitlement: {
            get() {
              return false;
            },
          },
        },
      };
      webex.logger.info('test');
      assert.called(console.info);
    });

    nodeOnly(it)("doesn't break if the feature toggle is set to an incorrect value", () => {
      assert.doesNotThrow(() => {
        assert.notCalled(console.info);
        webex.logger.info('test');
        assert.notCalled(console.info);

        webex.internal.device = {
          features: {
            developer: {
              get() {
                return 'not-a-log-method';
              },
            },
            entitlement: {
              get() {
                return false;
              },
            },
          },
        };
        webex.logger.info('test');
        assert.notCalled(console.info);
      });
    });

    nodeOnly(it)('defaults to "error" for all other users', () => {
      webex.logger.error('test');
      assert.called(console.error);

      webex.logger.warn('test');
      assert.notCalled(console.warn);
    });
  });

  describe('#shouldBuffer()', () => {
    it('logs info level to buffer by default', () => {
      const shouldBuffer = webex.logger.shouldBuffer('info');

      assert.isTrue(shouldBuffer);
    });

    it('does not log debug level to buffer by default', () => {
      const shouldBuffer = webex.logger.shouldBuffer('debug');

      assert.isFalse(shouldBuffer);
    });

    it('logs debug level to buffer if level configured', () => {
      webex.logger.config.bufferLogLevel = 'debug';
      const shouldBuffer = webex.logger.shouldBuffer('debug');

      assert.isTrue(shouldBuffer);
    });
  });

  describe('#filter', () => {
    it('redacts email addresses', () => {
      const message = {
        blarg: 'test@example.com',
      };

      assert.deepEqual(webex.logger.filter(message), [
        {
          blarg: '[REDACTED]',
        },
      ]);
    });

    it('strips auth headers from log output', () => {
      const msg = {
        headers: {
          authorization: 'Bearer',
        },
        options: {
          headers: {
            trackingid: '123',
            authorization: 'Bearer',
          },
        },
      };

      assert.doesNotThrow(() => {
        webex.logger.filter({});
        webex.logger.filter({headers: {}});
        webex.logger.filter({headers: {authorization: ''}});
        webex.logger.filter({options: {}});
        webex.logger.filter({options: {headers: {}}});
        webex.logger.filter({options: {headers: {authorization: ''}}});
        webex.logger.filter([{options: {headers: {authorization: ''}}}]);
      });

      const [filtered] = webex.logger.filter(msg);

      assert.nestedProperty(msg, 'headers.authorization', 'it does not alter the original message');
      assert.nestedProperty(
        msg,
        'options.headers.authorization',
        'it does not alter the original message'
      );

      assert.notNestedProperty(
        filtered,
        'headers.authorization',
        'it removes headers.authorization'
      );
      assert.notNestedProperty(
        filtered,
        'options.headers.authorization',
        'it removes options.headers.authorization'
      );
      assert.nestedProperty(
        msg,
        'options.headers.trackingid',
        'it does not remove other header values'
      );
      assert.nestedProperty(
        filtered,
        'options.headers.trackingid',
        'it does not remove other header values'
      );
    });
  });

  ['error', 'warn', 'log', 'info', 'debug', 'trace'].forEach((level) => {
    describe(`#${level}()`, () => {
      it(`proxies console.${level}`, () => {
        webex.logger.config.level = level;
        assert.notCalled(console[impl(level)]);
        webex.logger[level]('a log statement');
        assert.called(console[impl(level)]);
      });

      it('removes authorization data', () => {
        webex.logger.config.level = level;
        webex.logger[level]({
          headers: {
            authorization: 'Bearer',
            trackingid: '123',
          },
        });

        if (inBrowser()) {
          assert.calledWith(
            console[impl(level)],
            'wx-js-sdk',
            JSON.stringify({
              headers: {
                trackingid: '123',
              },
            })
          );
        } else {
          assert.calledWith(console[impl(level)], 'wx-js-sdk', {
            headers: {
              trackingid: '123',
            },
          });
        }
      });
    });
  });

  describe('#walkAndFilter', () => {
    it('redact Authorization', () => {
      webex.config.logger.level = 'trace';
      webex.logger.log({
        Authorization: 'XXXXXXX',
        Key: 'myKey',
      });

      // Assert auth was filtered

      if (inBrowser()) {
        assert.calledWith(console.log, 'wx-js-sdk', JSON.stringify({Key: 'myKey'}));
      } else {
        assert.calledWith(console.log, 'wx-js-sdk', {Key: 'myKey'});
      }
      webex.logger.log({
        authorization: 'XXXXXXX',
        Key: 'myKey',
      });
      9;

      if (inBrowser()) {
        assert.calledWith(console.log, 'wx-js-sdk', JSON.stringify({Key: 'myKey'}));
      } else {
        assert.calledWith(console.log, 'wx-js-sdk', {Key: 'myKey'});
      }
    });

    it('redact emails', () => {
      webex.config.logger.level = 'trace';

      webex.logger.log('my email address is test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', 'my email address is [REDACTED]');

      webex.logger.log('test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', '[REDACTED]');
    });

    it('redact MTID', () => {
      webex.config.logger.level = 'trace';

      const destination =
        'https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5';

      webex.logger.log(`Info Unable to fetch meeting info for ${destination}.`);
      assert.calledWith(
        console.log,
        'wx-js-sdk',
        'Info Unable to fetch meeting info for https://example.com/example/j.php?MTID=[REDACTED]'
      );

      webex.logger.log(
        'https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5&abcdefg'
      );
      assert.calledWith(
        console.log,
        'wx-js-sdk',
        'https://example.com/example/j.php?MTID=[REDACTED]&abcdefg'
      );

      webex.logger.log(
        'https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5$abcdefg'
      );
      assert.calledWith(
        console.log,
        'wx-js-sdk',
        'https://example.com/example/j.php?MTID=[REDACTED]$abcdefg'
      );

      webex.logger.log(
        'https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5#abcdefg'
      );
      assert.calledWith(
        console.log,
        'wx-js-sdk',
        'https://example.com/example/j.php?MTID=[REDACTED]#abcdefg'
      );
    });

    nodeOnly(it)('handle circular references', () => {
      webex.config.logger.level = 'trace';

      const object = {
        authorization: 'XXXXXXX',
        string: 'test@cisco.com',
        Key: 'myKey',
      };

      // Add a circular reference to the object
      object.selfReference = object;

      webex.logger.log(object);

      const expected = {
        string: '[REDACTED]',
        Key: 'myKey',
      };

      // Has self reference which is bad
      expected.selfReference = expected;

      if (inBrowser()) {
        assert.calledWith(console.log, 'wx-js-sdk', JSON.stringify(expected));
      } else {
        assert.calledWith(console.log, 'wx-js-sdk', expected);
      }
    });

    nodeOnly(it)('handle circular references in complex objects', () => {
      webex.config.logger.level = 'trace';

      const func = () => true;
      const sym = Symbol('foo');

      const object = {
        primativeString: 'justastring',
        primativeNum: 5,
        primativeBool: true,
        primativeSymbol: sym,
        myFunction: func,
        subObject: {
          subPrimativeString: 'justastring',
          otherPrimativeString: 'otherstring',
          subPrimativeNum: 5,
          otherPrimativeNum: 6,
          subPrimativeBool: true,
          otherPrimativeBool: false,
          subPrimativeSymbol: sym,
        },
      };

      object.subObject.circularObjectRef = object;
      object.subObject.circularFunctionRef = func;
      object.subObject.circularFunctionRef.cat = func;

      webex.logger.log(object);

      const res = {
        primativeString: 'justastring',
        primativeNum: 5,
        primativeBool: true,
        primativeSymbol: sym,
        myFunction: func,
        subObject: {
          subPrimativeString: 'justastring',
          otherPrimativeString: 'otherstring',
          subPrimativeNum: 5,
          otherPrimativeNum: 6,
          subPrimativeBool: true,
          otherPrimativeBool: false,
          subPrimativeSymbol: sym,
          circularObjectRef: object,
          circularFunctionRef: func,
        },
      };

      if (inBrowser()) {
        assert.calledWith(console.log, 'wx-js-sdk', JSON.stringify(res));
      } else {
        assert.calledWith(console.log, 'wx-js-sdk', res);
      }
    });
  });

  describe('#formatLogs()', () => {
    function sendRandomLog(log) {
      const logMethod = Math.round(Math.random()) ? 'log' : 'client_log';

      webex.logger[logMethod](log);
    }
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function checkAscending(logs) {
      const logLines = logs.split('\n');

      let lastvalue;

      for (let i = 0; i < logLines.length; i += 1) {
        const fields = logLines[i].split(',');

        if (lastvalue) {
          assert.isTrue(lastvalue < fields[3]);
        }
        lastvalue = fields[3];
      }
    }

    it('formats mixed log types in order by default', async () => {
      for (let i = 0; i < 10; i += 1) {
        sendRandomLog(i);
        await sleep(i);
      }

      const logs = webex.logger.formatLogs();

      checkAscending(logs);
    });

    it('formats mixed log types in order with separate buffers', async () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      for (let i = 0; i < 10; i += 1) {
        sendRandomLog(i);
        await sleep(i);
      }

      const logs = webex.logger.formatLogs();

      checkAscending(logs);
    });

    it('handles only sdk logs with separate buffers', async () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      for (let i = 0; i < 10; i += 1) {
        webex.logger.log(i);
        await sleep(i);
      }

      const logs = webex.logger.formatLogs();

      checkAscending(logs);
    });

    it('handles only client logs with separate buffers', async () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      for (let i = 0; i < 10; i += 1) {
        webex.logger.client_log(i);
        await sleep(i);
      }

      const logs = webex.logger.formatLogs();

      checkAscending(logs);
    });

    describe('diff vs full logs', () => {
      let counter;
      let clock;

      const doSomeLogs = (count) => {
        // do alternate logs from client and sdk
        for (let i = 0; i < count; i += 1) {
          if (webex.config.logger.separateLogBuffers) {
            webex.logger.client_log(counter);
            clock.tick(1000);
          }
          webex.logger.log(counter);
          clock.tick(1000);

          counter += 1;
        }
      };

      beforeEach(() => {
        counter = 0;
        clock = sinon.useFakeTimers();
      });

      afterEach(() => {
        clock.restore();
      });

      it('sends diff logs correctly (with separateLogBuffers)', async () => {
        webex.config.logger.separateLogBuffers = true;
        webex.config.logger.clientName = 'someclient';

        doSomeLogs(5);

        const logs1 = webex.logger.formatLogs({diff: true});

        assert.deepEqual(logs1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,someclient,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:02.000Z,someclient,1',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:04.000Z,someclient,2',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
        ]);

        // log more lines
        doSomeLogs(2);

        const logs2 = webex.logger.formatLogs({diff: true});

        // only the logs added after previous call to formatLogs() should be returned
        assert.deepEqual(logs2.split('\n'), [
          ',1970-01-01T00:00:10.000Z,someclient,5',
          ',1970-01-01T00:00:11.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:12.000Z,someclient,6',
          ',1970-01-01T00:00:13.000Z,wx-js-sdk,6',
        ]);

        // now ask for full logs - it should contain all 15 logs
        const fullLogs1 = webex.logger.formatLogs();

        assert.deepEqual(fullLogs1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,someclient,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:02.000Z,someclient,1',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:04.000Z,someclient,2',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:10.000Z,someclient,5',
          ',1970-01-01T00:00:11.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:12.000Z,someclient,6',
          ',1970-01-01T00:00:13.000Z,wx-js-sdk,6',
        ]);

        // asking for full logs should not affect the next diff
        const logs3 = webex.logger.formatLogs({diff: true});

        // expect empty logs, because we didn't log anything since previous call to formatLogs with diff=true
        assert.deepEqual(logs3.split('\n'), ['']);

        // add more logs again
        doSomeLogs(1);

        const logs4 = webex.logger.formatLogs({diff: true});

        assert.deepEqual(logs4.split('\n'), [
          ',1970-01-01T00:00:14.000Z,someclient,7',
          ',1970-01-01T00:00:15.000Z,wx-js-sdk,7',
        ]);

        // and check that full log contains everything right from the beginning irrespective of any previous calls to formatLogs()
        const fullLogs2 = webex.logger.formatLogs();

        assert.deepEqual(fullLogs2.split('\n'), [
          ',1970-01-01T00:00:00.000Z,someclient,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:02.000Z,someclient,1',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:04.000Z,someclient,2',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:10.000Z,someclient,5',
          ',1970-01-01T00:00:11.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:12.000Z,someclient,6',
          ',1970-01-01T00:00:13.000Z,wx-js-sdk,6',
          ',1970-01-01T00:00:14.000Z,someclient,7',
          ',1970-01-01T00:00:15.000Z,wx-js-sdk,7',
        ]);
      });

      it('sends diff logs correctly (without separateLogBuffers)', async () => {
        webex.config.logger.separateLogBuffers = false;

        doSomeLogs(5);

        const logs1 = webex.logger.formatLogs({diff: true});

        assert.deepEqual(logs1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:02.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
        ]);

        // log more lines
        doSomeLogs(2);

        const logs2 = webex.logger.formatLogs({diff: true});

        // only the logs added after previous call to formatLogs() should be returned
        assert.deepEqual(logs2.split('\n'), [
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:06.000Z,wx-js-sdk,6',
        ]);

        // now ask for full logs - it should contain all 7 logs
        const fullLogs1 = webex.logger.formatLogs();

        assert.deepEqual(fullLogs1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:02.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:06.000Z,wx-js-sdk,6',
        ]);

        // asking for full logs should not affect the next diff
        const logs3 = webex.logger.formatLogs({diff: true});

        // expect empty logs, because we didn't log anything since previous call to formatLogs with diff=true
        assert.deepEqual(logs3.split('\n'), ['']);

        // add more logs again
        doSomeLogs(1);

        const logs4 = webex.logger.formatLogs({diff: true});

        assert.deepEqual(logs4.split('\n'), [',1970-01-01T00:00:07.000Z,wx-js-sdk,7']);

        // and check that full log contains everything right from the beginning irrespective of any previous calls to formatLogs()
        const fullLogs2 = webex.logger.formatLogs();

        assert.deepEqual(fullLogs2.split('\n'), [
          ',1970-01-01T00:00:00.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:02.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:06.000Z,wx-js-sdk,6',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,7',
        ]);
      });

      it('works correctly when history limit is reached (with separateLogBuffers)', async () => {
        webex.config.logger.separateLogBuffers = true;
        webex.config.logger.clientName = 'someclient';
        webex.config.logger.historyLength = 5;

        // fill up the history
        doSomeLogs(5);

        const logsFull1 = webex.logger.formatLogs({diff: false});

        assert.deepEqual(logsFull1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,someclient,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:02.000Z,someclient,1',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:04.000Z,someclient,2',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
        ]);

        // log more lines, this should cause removal of the oldest logs
        doSomeLogs(2);

        const logsFull2 = webex.logger.formatLogs({diff: false});

        const last5Logs = [
          ',1970-01-01T00:00:04.000Z,someclient,2',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:10.000Z,someclient,5',
          ',1970-01-01T00:00:11.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:12.000Z,someclient,6',
          ',1970-01-01T00:00:13.000Z,wx-js-sdk,6',
        ];
        assert.deepEqual(logsFull2.split('\n'), last5Logs);

        // check also the diff logs - they should also have just last 5 logs
        const logsDiff1 = webex.logger.formatLogs({diff: true});
        assert.deepEqual(logsDiff1.split('\n'), last5Logs);

        // add more logs again and check full and diff logs
        doSomeLogs(1);

        const logsFull3 = webex.logger.formatLogs({diff: false});

        assert.deepEqual(logsFull3.split('\n'), [
          ',1970-01-01T00:00:06.000Z,someclient,3',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:08.000Z,someclient,4',
          ',1970-01-01T00:00:09.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:10.000Z,someclient,5',
          ',1970-01-01T00:00:11.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:12.000Z,someclient,6',
          ',1970-01-01T00:00:13.000Z,wx-js-sdk,6',
          ',1970-01-01T00:00:14.000Z,someclient,7',
          ',1970-01-01T00:00:15.000Z,wx-js-sdk,7',
        ]);

        const logsDiff2 = webex.logger.formatLogs({diff: true});
        assert.deepEqual(logsDiff2.split('\n'), [
          ',1970-01-01T00:00:14.000Z,someclient,7',
          ',1970-01-01T00:00:15.000Z,wx-js-sdk,7',
        ]);
      });

      it('works correctly when history limit is reached (without separateLogBuffers)', async () => {
        webex.config.logger.separateLogBuffers = false;
        webex.config.logger.historyLength = 5;

        // fill up the history
        doSomeLogs(5);

        const logsFull1 = webex.logger.formatLogs({diff: false});

        assert.deepEqual(logsFull1.split('\n'), [
          ',1970-01-01T00:00:00.000Z,wx-js-sdk,0',
          ',1970-01-01T00:00:01.000Z,wx-js-sdk,1',
          ',1970-01-01T00:00:02.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
        ]);

        // log more lines, this should cause removal of the oldest logs
        doSomeLogs(2);

        const logsFull2 = webex.logger.formatLogs({diff: false});

        const last5Logs = [
          ',1970-01-01T00:00:02.000Z,wx-js-sdk,2',
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:06.000Z,wx-js-sdk,6',
        ];
        assert.deepEqual(logsFull2.split('\n'), last5Logs);

        // check also the diff logs - they should also have just last 5 logs
        const logsDiff1 = webex.logger.formatLogs({diff: true});
        assert.deepEqual(logsDiff1.split('\n'), last5Logs);

        // add more logs again and check full and diff logs
        doSomeLogs(1);

        const logsFull3 = webex.logger.formatLogs({diff: false});

        assert.deepEqual(logsFull3.split('\n'), [
          ',1970-01-01T00:00:03.000Z,wx-js-sdk,3',
          ',1970-01-01T00:00:04.000Z,wx-js-sdk,4',
          ',1970-01-01T00:00:05.000Z,wx-js-sdk,5',
          ',1970-01-01T00:00:06.000Z,wx-js-sdk,6',
          ',1970-01-01T00:00:07.000Z,wx-js-sdk,7',
        ]);

        const logsDiff2 = webex.logger.formatLogs({diff: true});
        assert.deepEqual(logsDiff2.split('\n'), [',1970-01-01T00:00:07.000Z,wx-js-sdk,7']);
      });
    });
  });

  describe('#logToBuffer()', () => {
    it('logs only to buffer by default', () => {
      webex.logger.logToBuffer('sdklog');
      webex.logger.client_logToBuffer('clientlog');

      assert.lengthOf(webex.logger.buffer.buffer, 2);

      logSpies.forEach((logSpy) => {
        assert.notCalled(logSpy);
      });
    });
    it('logs only to buffer with separate buffers', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';

      webex.logger.logToBuffer('sdklog');
      webex.logger.client_logToBuffer('clientlog');

      assert.lengthOf(webex.logger.sdkBuffer.buffer, 1);
      assert.lengthOf(webex.logger.clientBuffer.buffer, 1);

      logSpies.forEach((logSpy) => {
        assert.notCalled(logSpy);
      });
    });
  });
  describe('limit', () => {
    function logMessages() {
      return webex.logger.buffer.buffer.map((item) => item[3]);
    }

    it('can be increased in runtime', () => {
      webex.logger.config.historyLength = 5;
      for (let i = 0; i < 10; i += 1) {
        webex.logger.log(i);
      }

      assert.deepEqual(logMessages(), [5, 6, 7, 8, 9]);
      assert.lengthOf(webex.logger.buffer.buffer, 5);

      webex.logger.config.historyLength = 10;
      webex.logger.log(10);
      assert.deepEqual(logMessages(), [5, 6, 7, 8, 9, 10]);
      assert.lengthOf(webex.logger.buffer.buffer, 6);
    });

    it('can be decreased in runtime', () => {
      for (let i = 0; i < 10; i += 1) {
        webex.logger.log(i);
      }

      assert.deepEqual(logMessages(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.lengthOf(webex.logger.buffer.buffer, 10);

      webex.logger.config.historyLength = 5;

      // Log buffer truncated when the next log added
      assert.lengthOf(webex.logger.buffer.buffer, 10);

      webex.logger.log(10);
      assert.deepEqual(logMessages(), [6, 7, 8, 9, 10]);
      assert.lengthOf(webex.logger.buffer.buffer, 5);
    });
  });

  describe('#updateLastSubmittedIndex()', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('updates lastSubmitted to the current nextIndex in single buffer mode', () => {
      webex.config.logger.separateLogBuffers = false;

      webex.logger.log('a');
      clock.tick(1000);
      webex.logger.log('b');
      clock.tick(1000);

      // advance nextIndex by consuming a diff
      webex.logger.formatLogs({diff: true});
      const nextIndexAfterDiff = webex.logger.buffer.nextIndex;

      assert.equal(webex.logger.buffer.lastSubmitted, 0);

      webex.logger.updateLastSubmittedIndex();

      assert.equal(webex.logger.buffer.lastSubmitted, nextIndexAfterDiff);
    });

    it('updates lastSubmitted to the current nextIndex in separate buffer mode', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';

      webex.logger.log('sdk1');
      clock.tick(1000);
      webex.logger.client_log('client1');
      clock.tick(1000);

      webex.logger.formatLogs({diff: true});
      const sdkNextIndex = webex.logger.sdkBuffer.nextIndex;
      const clientNextIndex = webex.logger.clientBuffer.nextIndex;

      assert.equal(webex.logger.sdkBuffer.lastSubmitted, 0);
      assert.equal(webex.logger.clientBuffer.lastSubmitted, 0);

      webex.logger.updateLastSubmittedIndex();

      assert.equal(webex.logger.sdkBuffer.lastSubmitted, sdkNextIndex);
      assert.equal(webex.logger.clientBuffer.lastSubmitted, clientNextIndex);
    });

    it('stores lastSubmitted as 0 when no diff has been consumed yet in single buffer mode', () => {
      webex.config.logger.separateLogBuffers = false;

      webex.logger.log('a');
      webex.logger.updateLastSubmittedIndex();

      // nextIndex is still 0 because no diff was consumed
      assert.equal(webex.logger.buffer.lastSubmitted, webex.logger.buffer.nextIndex);
    });
  });

  describe('#resetBufferToLastSuccessfulUpload()', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('resets nextIndex to lastSubmitted in single buffer mode', () => {
      webex.config.logger.separateLogBuffers = false;

      webex.logger.log('a');
      clock.tick(1000);
      webex.logger.log('b');
      clock.tick(1000);

      // simulate a successful upload: consume diff then mark as submitted
      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      const submittedIndex = webex.logger.buffer.lastSubmitted;

      // log more entries (simulating logs added after the upload)
      webex.logger.log('c');
      clock.tick(1000);
      webex.logger.formatLogs({diff: true});
      assert.isAbove(webex.logger.buffer.nextIndex, submittedIndex);

      // simulate upload failure — reset so the next diff re-includes logs since last success
      webex.logger.resetBufferToLastSuccessfulUpload();

      assert.equal(webex.logger.buffer.nextIndex, submittedIndex);
    });

    it('resets nextIndex to lastSubmitted in separate buffer mode', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';

      webex.logger.log('sdk1');
      clock.tick(1000);
      webex.logger.client_log('client1');
      clock.tick(1000);

      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      const submittedSdk = webex.logger.sdkBuffer.lastSubmitted;
      const submittedClient = webex.logger.clientBuffer.lastSubmitted;

      webex.logger.log('sdk2');
      clock.tick(1000);
      webex.logger.client_log('client2');
      clock.tick(1000);
      webex.logger.formatLogs({diff: true});

      assert.isAbove(webex.logger.sdkBuffer.nextIndex, submittedSdk);
      assert.isAbove(webex.logger.clientBuffer.nextIndex, submittedClient);

      webex.logger.resetBufferToLastSuccessfulUpload();

      assert.equal(webex.logger.sdkBuffer.nextIndex, submittedSdk);
      assert.equal(webex.logger.clientBuffer.nextIndex, submittedClient);
    });

    it('causes the next diff to re-include logs since the last successful upload', () => {
      webex.config.logger.separateLogBuffers = false;

      webex.logger.log('a');
      clock.tick(1000);
      webex.logger.log('b');
      clock.tick(1000);

      // first successful upload
      const diff1 = webex.logger.formatLogs({diff: true});

      assert.deepEqual(diff1.split('\n'), [
        ',1970-01-01T00:00:00.000Z,wx-js-sdk,a',
        ',1970-01-01T00:00:01.000Z,wx-js-sdk,b',
      ]);
      webex.logger.updateLastSubmittedIndex();

      // new logs arrive
      webex.logger.log('c');
      clock.tick(1000);

      // consume the diff (upload attempt that fails)
      const diff2 = webex.logger.formatLogs({diff: true});

      assert.deepEqual(diff2.split('\n'), [',1970-01-01T00:00:02.000Z,wx-js-sdk,c']);

      // upload failed — roll back
      webex.logger.resetBufferToLastSuccessfulUpload();

      // retry: should get 'c' again
      const diff3 = webex.logger.formatLogs({diff: true});

      assert.deepEqual(diff3.split('\n'), [',1970-01-01T00:00:02.000Z,wx-js-sdk,c']);
    });

    it('resets nextIndex to 0 when updateLastSubmittedIndex was never called', () => {
      webex.config.logger.separateLogBuffers = false;

      webex.logger.log('a');
      webex.logger.formatLogs({diff: true});
      assert.equal(webex.logger.buffer.nextIndex, 1);

      // lastSubmitted defaults to 0 before any call to updateLastSubmittedIndex
      webex.logger.resetBufferToLastSuccessfulUpload();

      assert.equal(webex.logger.buffer.nextIndex, 0);
    });
  });
  // Each case reads the logger created by beforeEach. Console calls are the contract under test.
  /* eslint-disable no-loop-func, no-console */
  describe('record bridge', () => {
    const timestamp = 1700000000123;
    const isoTimestamp = '2023-11-14T22:13:20.123Z';
    let sandbox;
    let clock;
    let savedConsole;

    const expectedRecord = (
      sequence,
      {type = 'sdk', level = 'info', values = ['message'], metadata} = {}
    ) => ({
      sequence,
      timestamp,
      observedTimestamp: timestamp,
      level,
      source: metadata?.source || type,
      body: ['', isoTimestamp, type === 'sdk' ? 'wx-js-sdk' : 'WebClient', ...values].join(','),
      ...(metadata ? {eventName: metadata.eventName, attributes: metadata.attributes} : {}),
    });

    const expectedEntry = (sequence, options = {}) => {
      const {type = 'sdk', level = 'info', values = ['message'], metadata} = options;

      return Object.assign(
        ['', isoTimestamp, type === 'sdk' ? 'wx-js-sdk' : 'WebClient', ...values],
        {
          sequence,
          timestamp,
          level,
          source: metadata?.source || type,
          metadata,
        }
      );
    };

    const saveConsoleMethod = (level) => {
      const method = sinon.spy();

      Object.defineProperty(console, `std${impl(level)}`, {
        configurable: true,
        writable: true,
        value: method,
      });

      return method;
    };

    const bufferState = () =>
      Object.fromEntries(
        ['buffer', 'sdkBuffer', 'clientBuffer'].map((name) => [
          name,
          {
            ...webex.logger[name],
            buffer: webex.logger[name].buffer.map((entry) => Object.assign([...entry], entry)),
          },
        ])
      );

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      clock = sandbox.useFakeTimers({now: timestamp, toFake: ['Date']});
      savedConsole = Object.fromEntries(
        levels.map((level) => [level, Object.getOwnPropertyDescriptor(console, `std${level}`)])
      );
      Object.assign(webex.logger.config, {
        level: 'silent',
        clientLevel: 'silent',
        bufferLogLevel: 'trace',
        metadataField: 'metadata',
        clientName: 'WebClient',
      });
    });

    afterEach(() => {
      sandbox.restore();
      for (const level of levels) {
        if (savedConsole[level]) {
          Object.defineProperty(console, `std${level}`, savedConsole[level]);
        } else {
          Reflect.deleteProperty(console, `std${level}`);
        }
      }
    });

    it('reads current level configuration through the existing derived properties', () => {
      assert.strictEqual(webex.logger.level, 'silent');
      assert.strictEqual(webex.logger.client_level, 'silent');
      webex.logger.config.level = 'warn';
      webex.logger.config.clientLevel = 'debug';
      assert.strictEqual(webex.logger.level, 'warn');
      assert.strictEqual(webex.logger.client_level, 'debug');
      delete webex.logger.config.clientLevel;
      assert.strictEqual(webex.logger.client_level, 'warn');
    });

    nodeOnly(it)('keeps test-mode Error arguments intact in Node', () => {
      process.env.NODE_ENV = 'test';
      const error = new Error('test error');

      assert.strictEqual(webex.logger.filter(error)[0], error);
    });

    nodeOnly(it)('uses the existing device prefix only for test console output', () => {
      process.env.NODE_ENV = 'test';
      webex.logger.config.level = 'info';
      webex.internal.device.url = 'https://example.test/device/abc';
      // Supply the own root binding checked by the legacy test-prefix helper.
      Object.defineProperty(webex.logger, 'webex', {configurable: true, value: webex});
      const output = saveConsoleMethod('info');

      webex.logger.info('message');
      assert.calledOnceWithExactly(output, 'abc', 'wx-js-sdk', 'message');
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1)]);
    });

    nodeOnly(it)('selects the existing console fallback when a level method is missing', () => {
      const {trace} = console;

      console.trace = undefined;
      try {
        let FallbackLogger;

        jest.isolateModules(() => {
          // Reload this module to select its console method while trace is absent.
          // eslint-disable-next-line global-require
          FallbackLogger = require('../../../src/logger').default;
        });
        const other = new MockWebex({children: {logger: FallbackLogger}});

        Object.assign(other.logger.config, {level: 'trace', bufferLogLevel: 'silent'});
        other.logger.trace('fallback');
        assert.calledOnceWithExactly(console.log, 'wx-js-sdk', 'fallback');
        assert.deepEqual(other.logger.getRecords(), []);
      } finally {
        console.trace = trace;
      }
    });

    it('keeps the configured history default at 10,000 entries', () => {
      assert.strictEqual(loggerConfig.logger.historyLength, 10000);
    });

    for (const metadataField of [undefined, '']) {
      it(`keeps ordinary object fields when metadata extraction is disabled: ${metadataField}`, () => {
        webex.logger.config.metadataField = metadataField;
        const value = {[String(metadataField)]: {eventName: 'ordinary'}, message: 'kept'};

        webex.logger.info(value);
        assert.deepEqual(webex.logger.getRecords(), [
          expectedRecord(1, {values: [JSON.stringify(value)]}),
        ]);
        assert.deepEqual(value, {
          [String(metadataField)]: {eventName: 'ordinary'},
          message: 'kept',
        });
      });
    }

    it('keeps sequence and retained state separate for each logger instance', () => {
      const other = new MockWebex({children: {logger: Logger}});

      Object.assign(other.logger.config, {level: 'silent', bufferLogLevel: 'info'});
      webex.logger.info('message');
      other.logger.info('independent');
      webex.logger.info('next');
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1),
        expectedRecord(2, {values: ['next']}),
      ]);
      assert.deepEqual(other.logger.getRecords(), [expectedRecord(1, {values: ['independent']})]);
      assert.notStrictEqual(webex.logger.recordState, other.logger.recordState);
      assert.notStrictEqual(webex.logger.buffer, other.logger.buffer);
    });

    for (const source of [undefined, '', 'explicit']) {
      it(`uses the SDK source when the metadata source is empty: ${source}`, () => {
        const metadata = {source};

        webex.logger.info('message', {metadata});
        assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1, {metadata})]);
      });
    }

    for (const type of ['sdk', 'client']) {
      for (const level of levels) {
        for (const {print, buffer} of [
          {print: false, buffer: false},
          {print: false, buffer: true},
          {print: true, buffer: false},
          {print: true, buffer: true},
        ]) {
          it(`keeps ${type}/${level} print=${print} and buffer=${buffer} independent of metadata`, () => {
            const metadata = {source: 'producer', eventName: 'event', attributes: {number: 2}};
            const output = saveConsoleMethod(level);
            const listener = sinon.spy();

            webex.logger.config[type === 'sdk' ? 'level' : 'clientLevel'] = print
              ? 'trace'
              : 'silent';
            webex.logger.config.bufferLogLevel = buffer ? 'trace' : 'silent';
            webex.logger.on('log:record', listener);
            webex.logger[type === 'sdk' ? level : `client_${level}`]('message', {metadata});
            assert.deepEqual(
              output.args,
              print ? [[type === 'sdk' ? 'wx-js-sdk' : 'WebClient', 'message']] : []
            );
            if (print) assert.strictEqual(output.firstCall.thisValue, console);
            assert.deepEqual(
              webex.logger.getRecords(),
              buffer ? [expectedRecord(1, {type, level, metadata})] : []
            );
            assert.deepEqual(webex.logger.buffer, {
              buffer: buffer ? [expectedEntry(1, {type, level, metadata})] : [],
              nextIndex: 0,
              lastSubmitted: 0,
            });
            assert.deepEqual(
              listener.args,
              buffer ? [[expectedRecord(1, {type, level, metadata})]] : []
            );
            assert.equal(webex.logger.recordState.lastSequence, buffer ? 1 : 0);
            assert.equal(webex.logger.groupLevel, buffer && level === 'group' ? 1 : 0);
          });
        }
      }
    }

    for (const position of [0, 1, 2]) {
      it(`extracts metadata at argument position ${position} and redacts the other fields`, () => {
        const attributes = Object.freeze({detail: 'caller-value'});
        const metadata = Object.freeze({source: 'producer', eventName: 'event', attributes});
        const value = {
          metadata,
          headers: {authorization: 'Bearer', kept: 'value'},
          email: 'test@example.com',
        };
        const input = ['first', 'second'];

        input.splice(position, 0, value);
        webex.logger.info(...input);
        const expected = ['first', 'second'];

        expected.splice(position, 0, '{"headers":{"kept":"value"},"email":"[REDACTED]"}');
        assert.deepEqual(webex.logger.getRecords(), [
          expectedRecord(1, {values: expected, metadata}),
        ]);
        assert.strictEqual(webex.logger.getRecords()[0].attributes, attributes);
        assert.deepEqual(value, {
          metadata,
          headers: {authorization: 'Bearer', kept: 'value'},
          email: 'test@example.com',
        });
        assert.strictEqual(input[position], value);
        assert.deepEqual(
          input.filter((item) => item !== value),
          ['first', 'second']
        );
      });
    }

    for (const field of ['metadata', 'anotherField']) {
      it(`uses the configured own field ${field} and keeps the filter array contract`, () => {
        webex.logger.config.metadataField = field;
        const metadata = {eventName: 'event'};
        const input = {[field]: metadata, message: 'value'};

        assert.deepEqual(webex.logger.filter('first', input, 'last'), [
          'first',
          {message: 'value'},
          'last',
        ]);
        assert.deepEqual(input, {[field]: metadata, message: 'value'});
        webex.logger.info(input);
        assert.deepEqual(webex.logger.getRecords(), [
          expectedRecord(1, {values: ['{"message":"value"}'], metadata}),
        ]);
      });
    }

    for (const metadata of [undefined, null, {}, {eventName: 'last'}]) {
      it(`uses the last supplied metadata value ${JSON.stringify(metadata)}`, () => {
        webex.logger.info({metadata: {eventName: 'first'}}, 'message', {metadata});
        assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1, {metadata})]);
      });
    }

    it('omits metadata-only arguments from the message', () => {
      const metadata = {eventName: 'metadata-only', attributes: {flag: false}};

      webex.logger.info({metadata});
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1, {values: [], metadata})]);
      assert.deepEqual(webex.logger.buffer.buffer[0], expectedEntry(1, {values: [], metadata}));
    });

    it('keeps all arguments as message data when metadata config is absent', () => {
      delete webex.logger.config.metadataField;
      const value = {metadata: {eventName: 'ordinary-data'}, message: 'value'};

      webex.logger.info(value);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1, {values: [JSON.stringify(value)]}),
      ]);
      assert.deepEqual(webex.logger.filter(value), [value]);
    });

    it('does not read an inherited metadata property', () => {
      const prototype = {metadata: {eventName: 'inherited'}};
      const value = Object.assign(Object.create(prototype), {message: 'own'});

      webex.logger.info(value);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1, {values: ['{"message":"own"}']}),
      ]);
      assert.strictEqual(Object.getPrototypeOf(value), prototype);
      assert.deepEqual(value.metadata, prototype.metadata);
    });

    it('keeps primitives, arrays and Error objects on their normal formatting paths', () => {
      const array = ['array'];
      const error = new Error('original error');

      array.metadata = {source: 'not-array-metadata'};
      error.metadata = {source: 'not-error-metadata'};
      const errorText =
        process.env.NODE_ENV === 'test' && inBrowser()
          ? `${error}BEGIN STACK${error.stack}END STACK`
          : error.toString();

      webex.logger.info(null, undefined, false, 0, 'text', array, error);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1, {
          values: ['null', undefined, false, 0, 'text', '["array"]', errorText],
        }),
      ]);
      assert.deepEqual(array, Object.assign(['array'], {metadata: {source: 'not-array-metadata'}}));
      assert.deepEqual(error.metadata, {source: 'not-error-metadata'});
      const filteredError = webex.logger.filter(error)[0];

      if (process.env.NODE_ENV === 'test' && inBrowser()) {
        assert.strictEqual(filteredError, errorText);
      } else {
        assert.strictEqual(filteredError, error);
      }
    });

    it('keeps trusted metadata out of message redaction', () => {
      const attributes = {authorization: 'caller-owned', email: 'metadata@example.com'};
      const metadata = {attributes};

      webex.logger.info({metadata, authorization: 'Bearer', email: 'body@example.com'});
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1, {metadata, values: ['{"email":"[REDACTED]"}']}),
      ]);
      assert.strictEqual(webex.logger.getRecords()[0].attributes, attributes);
      assert.deepEqual(attributes, {authorization: 'caller-owned', email: 'metadata@example.com'});
    });

    it('uses one Date for the support timestamp and the fixed record times', () => {
      const toISOString = sandbox.spy(Date.prototype, 'toISOString');
      const getTime = sandbox.spy(Date.prototype, 'getTime');
      const parse = sandbox.spy(Date, 'parse');

      webex.logger.info('message');
      clock.tick(5000);
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1)]);
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1)]);
      assert.calledOnce(toISOString);
      assert.calledOnce(getTime);
      assert.strictEqual(toISOString.firstCall.thisValue, getTime.firstCall.thisValue);
      assert.notCalled(parse);
      assert.strictEqual(webex.logger.buffer.buffer[0][1], isoTimestamp);
    });

    for (const separate of [false, true]) {
      for (const order of [
        [],
        ['sdk'],
        ['client'],
        ['sdk', 'client', 'sdk'],
        ['client', 'sdk', 'client'],
      ]) {
        it(`reads retained ${order.join(
          '/'
        )} records without changing state; separate=${separate}`, () => {
          webex.logger.config.separateLogBuffers = separate;
          order.forEach((type) => webex.logger[type === 'sdk' ? 'info' : 'client_info']('message'));
          webex.logger.formatLogs({diff: true});
          webex.logger.updateLastSubmittedIndex();
          const before = bufferState();
          const {groupLevel} = webex.logger;
          const expected = order.map((type, index) => expectedRecord(index + 1, {type}));

          assert.deepEqual(webex.logger.getRecords(), expected);
          assert.deepEqual(webex.logger.getRecords(), expected);
          assert.deepEqual(bufferState(), before);
          assert.equal(webex.logger.groupLevel, groupLevel);
          webex.logger.info('next');
          assert.deepEqual(webex.logger.getRecords(), [
            ...expected,
            expectedRecord(order.length + 1, {values: ['next']}),
          ]);
        });
      }
    }

    it('creates fresh history wrappers and shares only caller metadata values', () => {
      const attributes = {nested: {value: 'kept'}};
      const metadata = {eventName: 'event', attributes};
      const listener = sinon.spy();

      webex.logger.on('log:record', listener);
      webex.logger.info('message', {metadata});
      const first = webex.logger.getRecords()[0];
      const second = webex.logger.getRecords()[0];

      assert.deepEqual(first, expectedRecord(1, {metadata}));
      assert.deepEqual(second, first);
      assert.notStrictEqual(first, second);
      assert.notStrictEqual(first, listener.firstCall.args[0]);
      assert.strictEqual(first.attributes, attributes);
      assert.strictEqual(second.attributes, attributes);
      first.body = 'changed wrapper';
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1, {metadata})]);
      assert.strictEqual(webex.logger.buffer.buffer[0].metadata, metadata);
    });

    for (const separate of [false, true]) {
      it(`keeps sequence after trimming and runtime limit changes; separate=${separate}`, () => {
        webex.logger.config.separateLogBuffers = separate;
        webex.logger.config.historyLength = 2;
        ['info', 'client_info', 'info', 'client_info', 'info', 'client_info'].forEach((method) =>
          webex.logger[method]('message')
        );
        const expected = separate
          ? [
              expectedRecord(3),
              expectedRecord(4, {type: 'client'}),
              expectedRecord(5),
              expectedRecord(6, {type: 'client'}),
            ]
          : [expectedRecord(5), expectedRecord(6, {type: 'client'})];

        assert.deepEqual(webex.logger.getRecords(), expected);
        webex.logger.config.historyLength = 1;
        webex.logger.info('message');
        assert.deepEqual(
          webex.logger.getRecords(),
          separate
            ? [
                expectedRecord(4, {type: 'client'}),
                expectedRecord(6, {type: 'client'}),
                expectedRecord(7),
              ]
            : [expectedRecord(7)]
        );
        webex.logger.config.historyLength = 3;
        webex.logger.client_info('message');
        assert.deepEqual(
          webex.logger.getRecords(),
          separate
            ? [
                expectedRecord(4, {type: 'client'}),
                expectedRecord(6, {type: 'client'}),
                expectedRecord(7),
                expectedRecord(8, {type: 'client'}),
              ]
            : [expectedRecord(7), expectedRecord(8, {type: 'client'})]
        );
      });
    }

    it('uses clientHistoryLength for each separate buffer and keeps SDK/client state isolated', () => {
      webex.logger.config.separateLogBuffers = true;
      webex.logger.config.historyLength = 5;
      webex.logger.config.clientHistoryLength = 1;
      webex.logger.info('old sdk');
      webex.logger.client_info('old client');
      webex.logger.formatLogs({diff: true});
      webex.logger.updateLastSubmittedIndex();
      webex.logger.info('new sdk');
      assert.deepEqual(webex.logger.sdkBuffer, {
        buffer: [expectedEntry(3, {values: ['new sdk']})],
        nextIndex: 0,
        lastSubmitted: 0,
      });
      assert.deepEqual(webex.logger.clientBuffer, {
        buffer: [expectedEntry(2, {type: 'client', values: ['old client']})],
        nextIndex: 1,
        lastSubmitted: 1,
      });
      webex.logger.client_info('new client');
      assert.deepEqual(webex.logger.clientBuffer, {
        buffer: [expectedEntry(4, {type: 'client', values: ['new client']})],
        nextIndex: 0,
        lastSubmitted: 0,
      });
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(3, {values: ['new sdk']}),
        expectedRecord(4, {type: 'client', values: ['new client']}),
      ]);
    });

    for (const separate of [false, true]) {
      it(`keeps group indentation and support-upload cursors unchanged by reads; separate=${separate}`, () => {
        webex.logger.config.separateLogBuffers = separate;
        webex.logger.group('open');
        webex.logger.info('inside');
        const state = bufferState();
        const records = webex.logger.getRecords();

        assert.equal(webex.logger.groupLevel, 1);
        assert.deepEqual(bufferState(), state);
        assert.deepEqual(records, [
          expectedRecord(1, {level: 'group', values: ['open']}),
          {
            ...expectedRecord(2, {values: ['inside']}),
            body: `|  ,${isoTimestamp},wx-js-sdk,inside`,
          },
        ]);
        assert.strictEqual(
          webex.logger.formatLogs(),
          records.map((record) => record.body).join('\n')
        );
        const first = webex.logger.formatLogs({diff: true});

        webex.logger.updateLastSubmittedIndex();
        webex.logger.groupEnd();
        assert.equal(webex.logger.groupLevel, 0);
        const next = webex.logger.formatLogs({diff: true});

        webex.logger.resetBufferToLastSuccessfulUpload();
        assert.strictEqual(webex.logger.formatLogs({diff: true}), next);
        assert.strictEqual(webex.logger.formatLogs(), `${first}\n${next}`);
        assert.deepEqual(
          webex.logger.getRecords().map((record) => record.sequence),
          [1, 2, 3]
        );
      });
    }

    it('does not emit records during subscription or history reads and removes the same callback', () => {
      const listener = sinon.spy();
      const changes = sinon.spy();

      webex.logger.on('log:record', listener);
      webex.logger.on('change:recordState', changes);
      assert.deepEqual(webex.logger.getRecords(), []);
      assert.notCalled(listener);
      webex.logger.info('message');
      assert.calledOnceWithExactly(listener, expectedRecord(1));
      webex.logger.getRecords();
      assert.calledOnce(listener);
      webex.logger.off('log:record', listener);
      webex.logger.info('second');
      assert.calledOnce(listener);
      assert.notCalled(changes);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1),
        expectedRecord(2, {values: ['second']}),
      ]);
    });

    it('keeps native nested event order while retained history keeps acceptance order', () => {
      const laterListener = sinon.spy();

      webex.logger.on('log:record', (record) => {
        if (record.sequence === 1) webex.logger.info('nested');
      });
      webex.logger.on('log:record', laterListener);
      webex.logger.info('message');
      assert.deepEqual(laterListener.args, [
        [expectedRecord(2, {values: ['nested']})],
        [expectedRecord(1)],
      ]);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1),
        expectedRecord(2, {values: ['nested']}),
      ]);
    });

    for (const method of ['info', 'logToBuffer', 'client_logToBuffer']) {
      it(`contains a listener failure from ${method} and keeps the accepted record`, () => {
        const failure = new Error('listener failed');
        const bad = () => {
          throw failure;
        };
        const later = sinon.spy();

        webex.logger.on('log:record', bad);
        webex.logger.on('log:record', later);
        assert.doesNotThrow(() => webex.logger[method]('message'));
        assert.notCalled(later);
        assert.deepEqual(webex.logger.getRecords(), [
          expectedRecord(1, {type: method.startsWith('client_') ? 'client' : 'sdk'}),
        ]);
        webex.logger.off('log:record', bad);
        webex.logger.info('next');
        assert.calledOnceWithExactly(later, expectedRecord(2, {values: ['next']}));
      });
    }

    for (const method of ['logToBuffer', 'client_logToBuffer']) {
      it(`buffers ${method} at info even when configured levels are silent`, () => {
        webex.logger.config.bufferLogLevel = 'silent';
        const output = saveConsoleMethod('info');
        const listener = sinon.spy();

        webex.logger.on('log:record', listener);
        webex.logger[method]('message');
        const record = expectedRecord(1, {type: method.startsWith('client_') ? 'client' : 'sdk'});

        assert.calledOnceWithExactly(listener, record);
        assert.deepEqual(webex.logger.getRecords(), [record]);
        assert.notCalled(output);
      });
    }

    it('prints through the saved console method with the console receiver', () => {
      webex.logger.config.level = 'info';
      webex.logger.config.bufferLogLevel = 'silent';
      const output = saveConsoleMethod('info');

      webex.logger.info('message');
      assert.calledOnceWithExactly(output, 'wx-js-sdk', 'message');
      assert.strictEqual(output.firstCall.thisValue, console);
      assert.notCalled(console.info);
      assert.deepEqual(webex.logger.getRecords(), []);
    });

    it('uses the normal console method when the saved method is absent', () => {
      webex.logger.config.level = 'info';
      Reflect.deleteProperty(console, 'stdinfo');
      webex.logger.info('message');
      assert.calledOnceWithExactly(console.info, 'wx-js-sdk', 'message');
      assert.strictEqual(console.info.firstCall.thisValue, console);
      assert.deepEqual(webex.logger.getRecords(), [expectedRecord(1)]);
    });

    it('keeps the existing stringify fallback without exposing metadata in text', () => {
      const metadata = {eventName: 'event'};
      const value = {
        metadata,
        toJSON() {
          throw new Error('stringify failed');
        },
      };

      webex.logger.info(value);
      assert.deepEqual(webex.logger.getRecords(), [
        expectedRecord(1, {metadata, values: ['Failed to stringify: [object Object]']}),
      ]);
      assert.strictEqual(value.metadata, metadata);
    });

    it('contains an argument getter failure before accepting a record', () => {
      const failure = new Error('metadata getter failed');
      const value = Object.defineProperty({}, 'metadata', {
        enumerable: true,
        get() {
          throw failure;
        },
      });

      assert.doesNotThrow(() => webex.logger.info(value));
      assert.deepEqual(webex.logger.getRecords(), []);
      assert.equal(webex.logger.recordState.lastSequence, 0);
      assert.calledWithExactly(console.warn, 'failed to execute Logger#info', failure);
    });
  });
  /* eslint-enable no-loop-func, no-console */
});
