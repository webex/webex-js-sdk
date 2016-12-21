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
        devtool: 'source-map',
        plugins: webpackConfig.plugins.concat(
          new webpack.DefinePlugin({
            'process.env': {
              NODE_ENV: JSON.stringify("production")
            }
          }),
          new webpack.optimize.OccurenceOrderPlugin(),
          new webpack.optimize.UglifyJsPlugin({
            sourceMap: true,
            compress: {
              warnings: false
            }
          })
        )
      },
      buildDemo: {
        debug: false,
        entry: './demo/app.js',
        output: {
          filename: 'bundle.js',
          path: path.resolve(__dirname, 'dist', 'demo'),
          sourceMapFilename: '[file].map'
        },
        progress: false,
        devtool: 'source-map',
        plugins: webpackConfig.plugins.concat(
          new webpack.DefinePlugin({
            'process.env': {
              NODE_ENV: JSON.stringify("production")
            }
          }),
          new webpack.optimize.OccurenceOrderPlugin(),
          new webpack.optimize.UglifyJsPlugin({
            sourceMap: true,
            compress: {
              warnings: false
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
          devtool: 'eval-source-map',
          debug: true
        }
      },
      demo: {
        keepAlive: true,
          webpack: {
            devtool: 'eval-source-map',
            debug: true,
            entry: './demo/app.js'
          }
      }
    });

  grunt.registerTask('build', [
    'clean:dist',
    'webpack:build'
  ]);

  grunt.registerTask('build-demo', [
    'clean:dist',
    'webpack:buildDemo'
  ]);

  grunt.registerTask('test', ['jest']);
  grunt.registerTask('test-clean', ['clean:snapshots', 'jest']);
  grunt.registerTask('start', ['webpack-dev-server:start']);
  grunt.registerTask('start-demo', ['webpack-dev-server:demo']);
  grunt.registerTask('default', ['start']);
};
