/* eslint-disable no-await-in-loop */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {browserOnly, nodeOnly} from '@webex/test-helper-mocha';
import Logger, {levels} from '@webex/plugin-logger';
import {WebexHttpError} from '@webex/webex-core';

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
      webex.config.logger.level = 'trace';
      webex.logger.log('test');
      assert.calledWith(console.log, 'wx-js-sdk', 'test');
    });

    it('stores the specified message in the log buffer', () => {
      webex.logger.log('test');
      assert.lengthOf(webex.logger.buffer, 1);
      assert.match(webex.logger.buffer[0][3], /test/);
    });

    it('adds the date to the beggining of the buffer entry', () => {
      webex.logger.log('test date');

      // Convert string back to date object
      const logDate = new Date(webex.logger.buffer[0][1]);

      // eslint-disable-next-line no-restricted-globals
      assert.isTrue(logDate instanceof Date && isNaN(webex.logger.buffer[0][1]));
      assert.isString(webex.logger.buffer[0][0]);
      assert.isString(webex.logger.buffer[0][1]);
      assert.match(webex.logger.buffer[0][3], /test date/);
    });

    it('stores the specified message in the client and sdk log buffer', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';
      webex.logger.log('testsdk');
      webex.logger.client_log('testclient');
      assert.lengthOf(webex.logger.sdkBuffer, 1);
      assert.isString(webex.logger.sdkBuffer[0][0]);
      assert.isString(webex.logger.sdkBuffer[0][1]);
      assert.match(webex.logger.sdkBuffer[0][2], /wx-js-sdk/);
      assert.match(webex.logger.sdkBuffer[0][3], /testsdk/);
      assert.lengthOf(webex.logger.clientBuffer, 1);
      assert.isString(webex.logger.clientBuffer[0][0]);
      assert.isString(webex.logger.clientBuffer[0][1]);
      assert.match(webex.logger.clientBuffer[0][2], /someclient/);
      assert.match(webex.logger.clientBuffer[0][3], /testclient/);
    });

    it('prevents the buffer from overflowing', () => {
      webex.config.logger.historyLength = 2;
      webex.logger.log(1);
      assert.lengthOf(webex.logger.buffer, 1);
      webex.logger.log(2);
      assert.lengthOf(webex.logger.buffer, 2);
      webex.logger.log(3);
      assert.lengthOf(webex.logger.buffer, 2);
      assert.equal(webex.logger.buffer[0][3], 2);
      assert.equal(webex.logger.buffer[1][3], 3);
    });

    it('prevents the client and sdk buffer from overflowing', () => {
      webex.config.logger.historyLength = 2;
      webex.config.logger.separateLogBuffers = true;
      webex.logger.log(1);
      webex.logger.client_log(3);
      assert.lengthOf(webex.logger.sdkBuffer, 1);
      assert.lengthOf(webex.logger.clientBuffer, 1);
      webex.logger.log(2);
      webex.logger.client_log(2);
      assert.lengthOf(webex.logger.sdkBuffer, 2);
      assert.lengthOf(webex.logger.clientBuffer, 2);
      webex.logger.log(3);
      webex.logger.client_log(1);
      assert.lengthOf(webex.logger.sdkBuffer, 2);
      assert.lengthOf(webex.logger.clientBuffer, 2);
      assert.equal(webex.logger.sdkBuffer[0][3], 2);
      assert.equal(webex.logger.sdkBuffer[1][3], 3);
      assert.equal(webex.logger.sdkBuffer[0][3], 2);
      assert.equal(webex.logger.clientBuffer[1][3], 1);
    });

    // Node handles custom errors correctly, so this test is browser specific
    browserOnly(it)('prints custom errors in a readable fashion', () => {
      webex.config.logger.level = 'trace';
      const error = new WebexHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error'
        },
        options: {
          service: '',
          headers: {}
        }
      });

      webex.logger.log(error);
      assert.lengthOf(webex.logger.buffer, 1);
      assert.match(console.log.args[0][1], /WebexHttpError/);
    });

    it('buffers custom errors in a readable fashion', () => {
      webex.config.logger.level = 'trace';
      const error = new WebexHttpError({
        statusCode: 500,
        body: {
          error: 'Internal Error'
        },
        options: {
          service: '',
          headers: {}
        }
      });

      webex.logger.log(error);
      assert.lengthOf(webex.logger.buffer, 1);
      assert.match(webex.logger.buffer[0][3], /WebexHttpError/g);
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
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `trace`');
      assert.isTrue(webex.logger.shouldPrint('warn', logType), 'it prints `warn` logs when the level is `trace`');
      assert.isTrue(webex.logger.shouldPrint('log', logType), 'it prints `log` logs when the level is `trace`');
      assert.isTrue(webex.logger.shouldPrint('info', logType), 'it prints `info` logs when the level is `trace`');
      assert.isTrue(webex.logger.shouldPrint('debug', logType), 'it prints `debug` logs when the level is `trace`');
      assert.isTrue(webex.logger.shouldPrint('trace', logType), 'it prints `trace` logs when the level is `trace`');

      webex.logger.config[logConfigSetting] = 'debug';
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `debug`');
      assert.isTrue(webex.logger.shouldPrint('warn', logType), 'it prints `warn` logs when the level is `debug`');
      assert.isTrue(webex.logger.shouldPrint('log', logType), 'it prints `log` logs when the level is `debug`');
      assert.isTrue(webex.logger.shouldPrint('info', logType), 'it prints `info` logs when the level is `debug`');
      assert.isTrue(webex.logger.shouldPrint('debug', logType), 'it prints `debug` logs when the level is `debug`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `debug`');

      webex.logger.config[logConfigSetting] = 'info';
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `info`');
      assert.isTrue(webex.logger.shouldPrint('warn', logType), 'it prints `warn` logs when the level is `info`');
      assert.isTrue(webex.logger.shouldPrint('log', logType), 'it prints `log` logs when the level is `info`');
      assert.isTrue(webex.logger.shouldPrint('info', logType), 'it prints `info` logs when the level is `info`');
      assert.isFalse(webex.logger.shouldPrint('debug', logType), 'it does not print `debug` logs when the level is `info`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `info`');

      webex.logger.config[logConfigSetting] = 'log';
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `log`');
      assert.isTrue(webex.logger.shouldPrint('warn', logType), 'it prints `warn` logs when the level is `log`');
      assert.isTrue(webex.logger.shouldPrint('log', logType), 'it prints `log` logs when the level is `log`');
      assert.isFalse(webex.logger.shouldPrint('info', logType), 'it does not print `info` logs when the level is `log`');
      assert.isFalse(webex.logger.shouldPrint('debug', logType), 'it does not print `debug` logs when the level is `log`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `log`');

      webex.logger.config[logConfigSetting] = 'warn';
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `warn`');
      assert.isTrue(webex.logger.shouldPrint('warn', logType), 'it prints `warn` logs when the level is `warn`');
      assert.isFalse(webex.logger.shouldPrint('log', logType), 'it does not print `log` logs when the level is `warn`');
      assert.isFalse(webex.logger.shouldPrint('info', logType), 'it does not print `info` logs when the level is `warn`');
      assert.isFalse(webex.logger.shouldPrint('debug', logType), 'it does not print `debug` logs when the level is `warn`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `warn`');

      webex.logger.config[logConfigSetting] = 'error';
      assert.isTrue(webex.logger.shouldPrint('error', logType), 'it prints `error` logs when the level is `error`');
      assert.isFalse(webex.logger.shouldPrint('warn', logType), 'it does not print `warn` logs when the level `error` is ');
      assert.isFalse(webex.logger.shouldPrint('log', logType), 'it does not print `log` logs when the level is `error`');
      assert.isFalse(webex.logger.shouldPrint('info', logType), 'it does not print `info` logs when the level is `error`');
      assert.isFalse(webex.logger.shouldPrint('debug', logType), 'it does not print `debug` logs when the level is `error`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `error`');

      webex.logger.config[logConfigSetting] = 'silent';
      assert.isFalse(webex.logger.shouldPrint('error', logType), 'it does not print `error` logs when the level is `silent`');
      assert.isFalse(webex.logger.shouldPrint('warn', logType), 'it does not print `warn` logs when the level is `silent`');
      assert.isFalse(webex.logger.shouldPrint('log', logType), 'it does not print `log` logs when the level is `silent`');
      assert.isFalse(webex.logger.shouldPrint('info', logType), 'it does not print `info` logs when the level is `silent`');
      assert.isFalse(webex.logger.shouldPrint('debug', logType), 'it does not print `debug` logs when the level is `silent`');
      assert.isFalse(webex.logger.shouldPrint('trace', logType), 'it does not print `trace` logs when the level is `silent`');
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
            }
          },
          entitlement: {
            get() {
              return false;
            }
          }
        }
      };
      webex.logger.info('test');
      assert.called(console.info);
    });

    nodeOnly(it)('doesn\'t break if the feature toggle is set to an incorrect value', () => {
      assert.doesNotThrow(() => {
        assert.notCalled(console.info);
        webex.logger.info('test');
        assert.notCalled(console.info);

        webex.internal.device = {
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
        blarg: 'test@example.com'
      };

      assert.deepEqual(webex.logger.filter(message), [{
        blarg: '[REDACTED]'
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
            trackingid: '123'
          }
        });
        assert.calledWith(console[impl(level)], 'wx-js-sdk', {
          headers: {
            trackingid: '123'
          }
        });
      });
    });
  });

  describe('#walkAndFilter', () => {
    it('redact Authorization', () => {
      webex.config.logger.level = 'trace';
      webex.logger.log({
        Authorization: 'XXXXXXX',
        Key: 'myKey'
      });

      // Assert auth was filtered
      assert.calledWith(console.log, 'wx-js-sdk', {Key: 'myKey'});

      webex.logger.log({
        authorization: 'XXXXXXX',
        Key: 'myKey'
      });

      assert.calledWith(console.log, 'wx-js-sdk', {Key: 'myKey'});
    });

    it('redact emails', () => {
      webex.config.logger.level = 'trace';

      webex.logger.log('my email address is test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', 'my email address is [REDACTED]');

      webex.logger.log('test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', '[REDACTED]');
    });

    it('handle circular references', () => {
      webex.config.logger.level = 'trace';

      const object = {
        authorization: 'XXXXXXX',
        string: 'test@cisco.com',
        Key: 'myKey'
      };

      // Add a circular reference to the object
      object.selfReference = object;

      webex.logger.log(object);

      const expected = {
        string: '[REDACTED]',
        Key: 'myKey'
      };

      expected.selfReference = expected;

      assert.calledWith(console.log, 'wx-js-sdk', expected);
    });

    it('handle circular references in complex objects', () => {
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
          subPrimativeSymbol: sym
        }
      };

      object.subObject.circularObjectRef = object;
      object.subObject.circularFunctionRef = func;
      object.subObject.circularFunctionRef.cat = func;

      webex.logger.log(object);

      assert.calledWith(console.log, 'wx-js-sdk', {
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
          circularFunctionRef: func
        }
      });
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
  });

  describe('#logToBuffer()', () => {
    it('logs only to buffer by default', () => {
      webex.logger.logToBuffer('sdklog');
      webex.logger.client_logToBuffer('clientlog');

      assert.lengthOf(webex.logger.buffer, 2);

      logSpies.forEach((logSpy) => {
        assert.notCalled(logSpy);
      });
    });
    it('logs only to buffer with separate buffers', () => {
      webex.config.logger.separateLogBuffers = true;
      webex.config.logger.clientName = 'someclient';

      webex.logger.logToBuffer('sdklog');
      webex.logger.client_logToBuffer('clientlog');

      assert.lengthOf(webex.logger.sdkBuffer, 1);
      assert.lengthOf(webex.logger.clientBuffer, 1);

      logSpies.forEach((logSpy) => {
        assert.notCalled(logSpy);
      });
    });
  });
});
