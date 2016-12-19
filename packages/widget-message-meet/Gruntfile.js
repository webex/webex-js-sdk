/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.config('webpack',
    {
      options: require('./webpack/webpack.prod'),
      build: {
        hot: false,
        inline: false,
        keepalive: false,
        progress: false,
        watch: false,
        debug: false
      }
    });
  grunt.config('webpack-dev-server',
    {
      options: {
        host: '0.0.0.0',
        hot: true,
        keepalive: true,
        progress: true,
        watch: true,
        port: parseInt(process.env.PORT || 8000),
        webpack: require('./webpack/webpack.dev')
      },
      start: {}
    });

  grunt.registerTask('build', [
    'clean:dist',
    'webpack:build'
  ]);

  grunt.registerTask('test', ['jest']);
  grunt.registerTask('test-clean', ['clean:snapshots', 'jest']);
  grunt.registerTask('start', ['webpack-dev-server:start']);
  grunt.registerTask('default', ['start']);
};
