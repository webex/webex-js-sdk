/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.loadNpmTasks('grunt-webpack');
  grunt.initConfig({
    webpack: {
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
    },  
    "webpack-dev-server": {
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
					devtool: "eval",
					debug: true
				}
			}      
    }
  });

  grunt.registerTask('build', [
    'webpack:build'
  ]);

  grunt.registerTask("default", ["webpack-dev-server:start"]);

};
