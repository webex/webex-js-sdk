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
        host: '0.0.0.0',
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

  grunt.registerTask('build', [
    'webpack:build'
  ]);

  grunt.registerTask('test', ['jest']);
  grunt.registerTask('test-clean', ['clean:snapshots', 'jest']);
  grunt.registerTask('start', ['webpack-dev-server:start']);
  grunt.registerTask('default', ['start']);
};
