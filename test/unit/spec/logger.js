/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var assert = chai.assert;
var sinon = require('sinon');
var Logger = require('../../../src/client/logger');
var MockSpark = require('../lib/mock-spark');
var skipInBrowser = require('../../lib/mocha-helpers').skipInBrowser;

describe('Logger', function() {
  var logger;
  var spark;
  var loggerLevel;

  var nodeEnv;
  before(function() {
    nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = '';
  });

  beforeEach(function() {
    spark = new MockSpark({
      children: {
        logger: Logger
      }
    });

    logger = spark.logger;

    spark.config = {
      logger: {}
    };
    loggerLevel = logger.config.level;
  });

  afterEach(function() {
    logger.config.level = loggerLevel;
  });

  after(function() {
    process.env.NODE_ENV = nodeEnv;
  });

  describe('#_buffer', function() {
    it('stores logged data', function() {
      assert.lengthOf(logger._buffer, 0);
      logger.log('a log statement');
      assert.lengthOf(logger._buffer, 1);
      assert.match(logger._buffer[0], /.+?\ LOG 'a log statement'/);
    });

    it('adds a timestamp to the beginning of each cached log statement', function() {
      logger.config.maxBufferSize = 3;
      logger.log('1');
      assert.match(logger._buffer[0], /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z LOG '1'/);
    });

    it('empties from the front as new items are added to the back', function() {
      logger.config.maxBufferSize = 3;
      logger.log('1');
      logger.log('2');
      logger.log('3');
      assert.lengthOf(logger._buffer, 3);
      logger.log('4');
      assert.lengthOf(logger._buffer, 3);

      assert.match(logger._buffer[0], / LOG '2'/);
      assert.match(logger._buffer[1], / LOG '3'/);
      assert.match(logger._buffer[2], / LOG '4'/);
    });
  });

  describe('#_getCurrentLevel()', function() {

    it('returns a level based on spark.config', function() {
      ['error', 'warn', 'log', 'info', 'debug', 'trace'].forEach(function(level) {
        logger.config.level = level;
        assert.equal(logger._getCurrentLevel(), level);
      });
    });

    // Can't change NODE_ENV in browser environments
    skipInBrowser(it)('logs at `trace` in development environments', function() {
      assert.notEqual(logger._getCurrentLevel(), 'trace');
      process.env.NODE_ENV = 'development';
      assert.equal(logger._getCurrentLevel(), 'trace');
      process.env.NODE_ENV = '';
    });

    // Can't change NODE_ENV in browser environments
    skipInBrowser(it)('logs at `trace` in test environments', function() {
      assert.notEqual(logger._getCurrentLevel(), 'trace');
      process.env.NODE_ENV = 'test';
      assert.equal(logger._getCurrentLevel(), 'trace');
      process.env.NODE_ENV = '';
    });

    // since NODE_ENV is set to test in browser env and it cannot be changed, it will always return trace
    skipInBrowser(it)('returns a level based on a developer toggle', function() {
      ['error', 'warn', 'log', 'info', 'debug', 'trace'].forEach(function(level) {
        spark.device.features.developer.get.returns(level);
        assert.equal(logger._getCurrentLevel(), level);
      });
    });

    // since NODE_ENV is set to test in browser env and it cannot be changed, it will always return trace
    skipInBrowser(it)('defaults to `log` for spark team members', function() {
      spark.device.features.entitlement.get.returns(true);
      assert.equal(logger._getCurrentLevel(), 'log');

      spark.device.features.entitlement.get.returns(false);
      assert.notEqual(logger._getCurrentLevel(), 'log');
    });

    // since NODE_ENV is set to test in browser env and it cannot be changed, it will always return trace
    skipInBrowser(it)('defaults to `error` if no other level has been specified', function() {
      assert.equal(logger._getCurrentLevel(), 'error');
    });
  });

  describe('#_cleanseMsg()', function() {
    it('removes Authorization headers', function() {
      var msg = {
        headers: {
          Authorization: 'Bearer'
        },
        options: {
          headers: {
            TrackingID: '123',
            Authorization: 'Bearer'
          }
        }
      };

      logger._cleanseMsg(msg);
      assert.doesNotThrow(function() {
        logger._cleanseMsg({});
        logger._cleanseMsg({headers: {}});
        logger._cleanseMsg({headers: {Authorization: ''}});
        logger._cleanseMsg({options: {}});
        logger._cleanseMsg({options: {headers: {}}});
        logger._cleanseMsg({options: {headers: {Authorization: ''}}});
      });
      assert.notDeepProperty(msg, 'headers.Authorization', 'it removes headers.Authorization');
      assert.notDeepProperty(msg, 'options.headers.Authorization', 'it removes options.headers.Authorization');
      assert.deepProperty(msg, 'options.headers.TrackingID', 'it does not remove other header values');
    });
  });

  describe('#_shouldPrint()', function() {
    it('indicates whether or not the desired log should be printed at the current log level', function() {
      /* eslint max-statements: [0] */
      logger.config.level = 'trace';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `trace`');
      assert.isTrue(logger._shouldPrint('warn'), 'it prints `warn` logs when the level is `trace`');
      assert.isTrue(logger._shouldPrint('log'), 'it prints `log` logs when the level is `trace`');
      assert.isTrue(logger._shouldPrint('info'), 'it prints `info` logs when the level is `trace`');
      assert.isTrue(logger._shouldPrint('debug'), 'it prints `debug` logs when the level is `trace`');
      assert.isTrue(logger._shouldPrint('trace'), 'it prints `trace` logs when the level is `trace`');

      logger.config.level = 'debug';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `debug`');
      assert.isTrue(logger._shouldPrint('warn'), 'it prints `warn` logs when the level is `debug`');
      assert.isTrue(logger._shouldPrint('log'), 'it prints `log` logs when the level is `debug`');
      assert.isTrue(logger._shouldPrint('info'), 'it prints `info` logs when the level is `debug`');
      assert.isTrue(logger._shouldPrint('debug'), 'it prints `debug` logs when the level is `debug`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `debug`');

      logger.config.level = 'info';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `info`');
      assert.isTrue(logger._shouldPrint('warn'), 'it prints `warn` logs when the level is `info`');
      assert.isTrue(logger._shouldPrint('log'), 'it prints `log` logs when the level is `info`');
      assert.isTrue(logger._shouldPrint('info'), 'it prints `info` logs when the level is `info`');
      assert.isFalse(logger._shouldPrint('debug'), 'it does not print `debug` logs when the level is `info`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `info`');

      logger.config.level = 'log';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `log`');
      assert.isTrue(logger._shouldPrint('warn'), 'it prints `warn` logs when the level is `log`');
      assert.isTrue(logger._shouldPrint('log'), 'it prints `log` logs when the level is `log`');
      assert.isFalse(logger._shouldPrint('info'), 'it does not print `info` logs when the level is `log`');
      assert.isFalse(logger._shouldPrint('debug'), 'it does not print `debug` logs when the level is `log`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `log`');

      logger.config.level = 'warn';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `warn`');
      assert.isTrue(logger._shouldPrint('warn'), 'it prints `warn` logs when the level is `warn`');
      assert.isFalse(logger._shouldPrint('log'), 'it does not print `log` logs when the level is `warn`');
      assert.isFalse(logger._shouldPrint('info'), 'it does not print `info` logs when the level is `warn`');
      assert.isFalse(logger._shouldPrint('debug'), 'it does not print `debug` logs when the level is `warn`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `warn`');

      logger.config.level = 'error';
      assert.isTrue(logger._shouldPrint('error'), 'it prints `error` logs when the level is `error`');
      assert.isFalse(logger._shouldPrint('warn'), 'it does not print `warn` logs when the lev`error`el is ');
      assert.isFalse(logger._shouldPrint('log'), 'it does not print `log` logs when the level is `error`');
      assert.isFalse(logger._shouldPrint('info'), 'it does not print `info` logs when the level is `error`');
      assert.isFalse(logger._shouldPrint('debug'), 'it does not print `debug` logs when the level is `error`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `error`');

      logger.config.level = 'silent';
      assert.isFalse(logger._shouldPrint('error'), 'it does not print `error` logs when the level is `silent`');
      assert.isFalse(logger._shouldPrint('warn'), 'it does not print `warn` logs when the level is `silent`');
      assert.isFalse(logger._shouldPrint('log'), 'it does not print `log` logs when the level is `silent`');
      assert.isFalse(logger._shouldPrint('info'), 'it does not print `info` logs when the level is `silent`');
      assert.isFalse(logger._shouldPrint('debug'), 'it does not print `debug` logs when the level is `silent`');
      assert.isFalse(logger._shouldPrint('trace'), 'it does not print `trace` logs when the level is `silent`');
    });
  });

  [
    'error',
    'warn',
    'log',
    'info',
    'debug',
    'trace'
  ].forEach(function(level) {
    if (console[level] && console[level] !== console.log) {
      describe('#' + level + '()', function() {
        beforeEach(function() {
          sinon.spy(console, level);
        });

        afterEach(function() {
          if (console[level].restore) {
            console[level].restore();
          }
        });

        it('proxies console.' + level, function() {
          logger.config.level = level;
          logger[level]('a log statement');
          assert.called(console[level]);
        });

        it('removes authorization data.' + level, function() {
          logger.config.level = level;
          logger[level]({
            headers: {
              Authorization: 'Bearer',
              TrackingID: '123'
            }
          });
          assert.calledWith(console[level], {
            headers: {
              TrackingID: '123'
            }
          });
        });
      });
    }
  });

});
