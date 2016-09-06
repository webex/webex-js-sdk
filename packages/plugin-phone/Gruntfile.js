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
      tasks: process.env.UNIT_ONLY ? [] : ['test:browser'],
      options: {
        logConcurrentOutput: true
      }
    }
  });

  var env = grunt.config('env');
  env.forceNodeEnv = {
    NODE_ENV: 'test'
  };
  grunt.config('env', env);

  grunt.task.run('env:forceNodeEnv');
};
