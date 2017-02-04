/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt, p) {
  grunt.config('concurrent', {
    test: {
      tasks: (function generateTasks() {
        if (process.env.UNIT_ONLY) {
          return [`test:node`];
        }

        if (process.env.SAUCE_IS_DOWN) {
          return [
            `test:node`
          ];
        }

        return [
          `test:automation`,
          `test:node`
        ];
      }()),
      options: {
        logConcurrentOutput: true
      }
    }
  });
};
