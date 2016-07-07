/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-console:[0] */

/**
 * Module dependencies.
 */

var Base = require('mocha/lib/reporters/base');
var utils = require('mocha/lib/utils');
var util = require('util');
var fs = require('fs');
var escape = utils.escape;
var mkdirp = require('mkdirp');
var path = require('path');
var pick = require('lodash').pick;

/**
 * Expose `XUnit`.
 */

exports = module.exports = XUnit;

/**
 * Initialize a new `XUnit` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function XUnit(runner, options) {
  Base.call(this, runner);
  var stats = this.stats;
  var tests = [];
  var self = this;

  if (options.reporterOptions && options.reporterOptions.output) {
    if (!fs.createWriteStream) {
      throw new Error('file output not supported in browser');
    }
    mkdirp.sync(path.dirname(options.reporterOptions.output));
    self.fileStream = fs.createWriteStream(options.reporterOptions.output);
  }

  runner.on('pending', function(test) {
    tests.push(test);
  });

  runner.on('pass', function(test) {
    tests.push(test);
  });

  runner.on('fail', function(test) {
    tests.push(test);
  });

  var logMethodNames = ['error', 'warn', 'log', 'info', 'debug', 'trace'];
  var originalMethods = pick(console, logMethodNames);

  runner.on('test', function(test) {
    test.systemErr = [];
    test.systemOut = [];

    logMethodNames.forEach(function(methodName) {
      if (!console[methodName]) {
        methodName = 'log';
      }

      console[methodName] = function() {
        originalMethods[methodName].apply(console, arguments);

        var args = Array.prototype.slice.call(arguments);

        var callerInfo = (new Error())
          .stack
          .split('\n')[2]
          .match(/\((.+?)\:(\d+)\:\d+/);

        if (callerInfo && callerInfo.length >= 2) {
          var callerFile = path.relative(__dirname, '..', callerInfo[1]);
          args.unshift('(FILE:' + (callerFile || 'UNKNOWN') + ')');
          args.unshift('(LINE:' + (callerInfo[2] || 'UNKNOWN') + ')');
        }

        if (methodName === 'error') {
          test.systemErr.push(args);
        }
        else {
          args.unshift(methodName.toUpperCase() + ':');

          test.systemOut.push(args);
        }
      };
    });
  });

  runner.on('test end', function() {
    logMethodNames.forEach(function(methodName) {
      console[methodName] = originalMethods[methodName];
    });
  });

  runner.on('end', function() {
    self.write('<testsuites>');
    self.write(tag('testsuite', {
      name: 'Mocha Tests',
      tests: stats.tests,
      failures: stats.failures,
      errors: stats.failures,
      skipped: stats.tests - stats.failures - stats.passes,
      timestamp: (new Date()).toUTCString(),
      time: stats.duration / 1000 || 0
    }, false));

    tests.forEach(function(t) {
      self.test(t);
    });

    self.write('</testsuite>');
    self.write('</testsuites>');
  });
}

/**
 * Inherit from `Base.prototype`.
 */
util.inherits(XUnit, Base);

/**
 * Override done to close the stream (if it's a file).
 *
 * @param {Array} failures
 * @param {Function} fn
 * @returns {undefined}
 */
XUnit.prototype.done = function(failures, fn) {
  if (this.fileStream) {
    this.fileStream.end(function() {
      fn(failures);
    });
  }
  else {
    fn(failures);
  }
};

/**
 * Write out the given line.
 *
 * @param {string} line
 * @returns {undefined}
 */
XUnit.prototype.write = function(line) {
  if (this.fileStream) {
    this.fileStream.write(line + '\n');
  }
  else {
    console.log(line);
  }
};

/**
 * Output tag for the given `test.`
 *
 * @param {Test} test
 * @returns {undefined}
 */
XUnit.prototype.test = function(test) {
  var attrs = {
    classname: test.parent.fullTitle(),
    name: test.title,
    time: test.duration / 1000 || 0
  };

  var systemErr;
  if (test.systemErr && test.systemErr.length > 0) {
    systemErr = tag('system-err', {}, false, cdata(test.systemErr.reduce(reducer, '\n')));
  }
  else {
    systemErr = '';
  }

  var systemOut;
  if (test.systemOut && test.systemOut.length > 0) {
    systemOut = tag('system-out', {}, false, cdata(test.systemOut.reduce(reducer, '\n')));
  }
  else {
    systemOut = '';
  }

  if (test.state === 'failed') {
    var err = test.err;
    var failureMessage = tag('failure', {}, false, cdata(escape(err.message) + '\n' + err.stack));
    this.write(tag('testcase', attrs, false, failureMessage + systemOut + systemErr));
  }
  else if (test.pending) {
    this.write(tag('testcase', attrs, false, tag('skipped', {}, true)));
  }
  else {
    this.write(tag('testcase', attrs, true));
  }

  function reducer(out, args) {
    return out + args.reduce(function(innerOut, arg) {
      return innerOut + arg + ' ';
    }, '') + '\n';
  }
};

/**
 * HTML tag helper.
 *
 * @param {string} name
 * @param {Object} attrs
 * @param {boolean} close
 * @param {string} content
 * @returns {string}
 */
function tag(name, attrs, close, content) {
  var end = close ? '/>' : '>';
  var pairs = [];
  var innerTag;

  for (var key in attrs) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) {
      pairs.push(key + '="' + escape(attrs[key]) + '"');
    }
  }

  innerTag = '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + end;
  if (content) {
    innerTag += content + '</' + name + end;
  }
  return innerTag;
}

/**
 * Return cdata escaped CDATA `str`.
 */

function cdata(str) {
  return '<![CDATA[' + escape(str) + ']]>';
}
