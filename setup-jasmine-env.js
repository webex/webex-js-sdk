'use strict';

/* global jasmine */

var jasmineReporters = require('jasmine-reporters');

jasmine.VERBOSE = true;
if (process.env.XUNIT) {
  jasmine.getEnv().addReporter(
      new jasmineReporters.JUnitXmlReporter({
          consolidateAll: true,
          savePath: process.env.XUNIT_DIR || './reports/junit',
          filePrefix: 'jest-' + process.env.PACKAGE
      })
  );
}
