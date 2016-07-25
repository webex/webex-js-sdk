/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.config('mochaTest', {
    options: {
      reporter: process.env.XUNIT ? path.join(__dirname, '../xunit-with-logs') : 'spec',
      timeout: 30000
    },
    all: {
      options: {
        reporterOptions: {
          output: './reports/junit/mocha-<%= package %>.xml'
        }
      },
      src: './packages/<%= package %>/test/*/spec/**/*.js'
    }
  });

  grunt.registerTask('build', []);

  grunt.registerTask('test', [
    'mochaTest:all'
  ]);

  grunt.register('build', []);
};
