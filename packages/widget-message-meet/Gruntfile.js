/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.config('shell',
    {
      options: {
        execOptions: {
          cwd: __dirname
        }
      },
      build: {
        command: 'npm run build'
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
      start: {},
      demo: {
        keepAlive: true,
          webpack: {
            entry: './demo/app.js'
          }
      }
    });

  grunt.registerTask('build', [
    'clean:dist',
    'shell:build'
  ]);

  grunt.registerTask('build-demo', [
    'clean:dist',
    'webpack:buildDemo'
  ]);

  grunt.registerTask('test', ['jest']);
  grunt.registerTask('test-clean', ['clean:snapshots', 'jest']);
  grunt.registerTask('serve', ['webpack-dev-server:start']);
  grunt.registerTask('serve-demo', ['webpack-dev-server:demo']);
  grunt.registerTask('default', ['serve']);
};
