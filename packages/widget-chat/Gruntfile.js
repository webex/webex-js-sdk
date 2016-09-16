/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-jest');
  grunt.config('webpack',
    {
      options: Object.assign({}, require('./webpack.config'), {
        hot: false,
        inline: false,
        keepalive: false,
        progress: true,
        watch: false
      }),
      build: {
        progress: false
      }
    });
  grunt.config('webpack-dev-server',
    {
      options: {
        compress: true,
        historyApiFallback: true,
        host: '127.0.0.1',
        hot: true,
        inline: true,
        keepalive: true,
        progress: true,
        watch: true,
        port: parseInt(process.env.PORT || 8000),
        webpack: require('./webpack.config')
      },
      start: {
        keepAlive: true,
        webpack: {
          devtool: 'eval',
          debug: true
        }
      }
    });
  grunt.confg('jest',
    {
      options: {
        testPathPattern: /.*.test.js/
      }
    }
  );

  grunt.registerTask('build', [
    'webpack:build'
  ]);

  grunt.registerTask('test', ['jest'])

  grunt.registerTask('serve', ['webpack-dev-server:start'])

  grunt.registerTask('default', ['serve']);

};
