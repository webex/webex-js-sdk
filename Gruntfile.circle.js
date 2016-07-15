/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

module.exports = function gruntConfig(grunt) {
  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);

  grunt.registerTask('static-analysis', [
    'eslint'
  ]);

  grunt.initConfig({
    eslint: {
      all: [
        './packages/*/src/**/*.js',
        './packages/*/test/**/*.js',
        './packages/*/*.js'
      ]
    }
  });
};
