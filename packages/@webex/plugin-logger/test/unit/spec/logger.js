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
        }
      }

      webex.logger.log('foo', 'bar', obj);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.lengthOf(webex.logger.buffer.buffer[0], 6);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'foo');
      assert.deepEqual(webex.logger.buffer.buffer[0][4], 'bar');
      assert.deepEqual(webex.logger.buffer.buffer[0][5], '{"headers":{"trackingid":"123"},"test":"object","nested":{"test2":"object2"}}');
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
        }
      }

      obj.selfReference = obj;

      webex.logger.log('foo', 'bar', obj);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.lengthOf(webex.logger.buffer.buffer[0], 6);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'foo');
      assert.deepEqual(webex.logger.buffer.buffer[0][4], 'bar');
      assert.deepEqual(webex.logger.buffer.buffer[0][5], '{"headers":{"trackingid":"123"},"test":"object","nested":{"test2":"object2"}}');
    });

    it('formats Errors correctly', async () => {
      webex.config.logger.level = 'trace';
      const err = new Error('fake error for testing')

      webex.logger.log('I got this error:', err);
      assert.lengthOf(webex.logger.buffer.buffer, 1);
      assert.deepEqual(webex.logger.buffer.buffer[0][2], 'wx-js-sdk');
      assert.deepEqual(webex.logger.buffer.buffer[0][3], 'I got this error:');
      assert.deepEqual(webex.logger.buffer.buffer[0][4], 'Error: fake error for testing');

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

        if(inBrowser()) {
          assert.calledWith(console[impl(level)], 'wx-js-sdk', JSON.stringify({
            headers: {
              trackingid: '123',
            },
          }));
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

      if(inBrowser()) { 
        assert.calledWith(console.log, "wx-js-sdk", JSON.stringify({Key: 'myKey'}));
      } else {
        assert.calledWith(console.log, "wx-js-sdk", {Key: 'myKey'});
      }
        webex.logger.log({
        authorization: 'XXXXXXX',
        Key: 'myKey',
      });
9
      
      if(inBrowser()) { 
      assert.calledWith(console.log, "wx-js-sdk", JSON.stringify({Key: 'myKey'}));

      } else {
      assert.calledWith(console.log, "wx-js-sdk", {Key: 'myKey'});

      } });

    it('redact emails', () => {
      webex.config.logger.level = 'trace';

      webex.logger.log('my email address is test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', 'my email address is [REDACTED]');

      webex.logger.log('test@cisco.com');
      assert.calledWith(console.log, 'wx-js-sdk', '[REDACTED]');
    });

    it('redact MTID', () => {
      webex.config.logger.level = 'trace';

      const destination = 'https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5';

      webex.logger.log(
        `Info Unable to fetch meeting info for ${destination}.`
      );
      assert.calledWith(console.log, 'wx-js-sdk', 'Info Unable to fetch meeting info for https://example.com/example/j.php?MTID=[REDACTED]');

      webex.logger.log('https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5&abcdefg');
      assert.calledWith(console.log, 'wx-js-sdk', 'https://example.com/example/j.php?MTID=[REDACTED]&abcdefg');

      webex.logger.log('https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5$abcdefg');
      assert.calledWith(console.log, 'wx-js-sdk', 'https://example.com/example/j.php?MTID=[REDACTED]$abcdefg');

      webex.logger.log('https://example.com/example/j.php?MTID=m678957bc1eff989c2176b43ead9d46b5#abcdefg');
      assert.calledWith(console.log, 'wx-js-sdk', 'https://example.com/example/j.php?MTID=[REDACTED]#abcdefg');
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

      if(inBrowser()) { 
        assert.calledWith(console.log, "wx-js-sdk", JSON.stringify(expected));
  
        } else {
        assert.calledWith(console.log, "wx-js-sdk", expected);
  
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
      }


      if(inBrowser()) { 
        assert.calledWith(console.log, "wx-js-sdk", JSON.stringify(res));
  
        } else {
        assert.calledWith(console.log, "wx-js-sdk", res);
  
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
});
