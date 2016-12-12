/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');
var webpackConfig = require('./webpack.config');
var webpack = require('webpack');

module.exports = function configGrunt(grunt) {
  grunt.config('webpack',
    {
      options: Object.assign({}, webpackConfig, {
        hot: false,
        inline: false,
        keepalive: false,
        progress: true,
        watch: false
      }),
      build: {
        debug: false,
        progress: false,
        plugins: webpackConfig.plugins.concat(
          new webpack.optimize.UglifyJsPlugin(),
          new webpack.DefinePlugin({
            'process.env': {
              NODE_ENV: JSON.stringify("production")
            }
          })
        )
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
        webpack: webpackConfig
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
    'clean:dist',
    'env:build',
    'webpack:build'
  ]);

  grunt.registerTask('test', ['jest']);
  grunt.registerTask('test-clean', ['clean:snapshots', 'jest']);
  grunt.registerTask('start', ['webpack-dev-server:start']);
  grunt.registerTask('default', ['start']);
};
