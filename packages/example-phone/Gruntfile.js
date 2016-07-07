/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable */

'use strict';

var path = require('path');

module.exports = function configGrunt(grunt) {
  grunt.config('copy', {
    assets: {
      expand: true,
      cwd: './packages/<%= package %>/src',
      src: [
        '**/*',
        '!scripts/**'
      ],
      dest: 'docs/app'
    }
  });

  grunt.config('webpack', {
    options: Object.assign({}, require('./webpack.config'), {
      hot: false,
      inline: false,
      keepalive: false,
      progress: true,
      watch: false
    }),
    build: {}
  });

  grunt.config('webpack-dev-server', {
    options: {
      compress: true,
      historyApiFallback: true,
      host: '127.0.0.1',
      contentBase: __dirname + '/src',
      hot: true,
      inline: true,
      keepalive: true,
      progress: true,
      watch: true,
      port: parseInt(process.env.PORT || 8000)
    },
    serve: {
      webpack: require('./webpack.config')
    },
    test: {
      keepalive: false,
      watch: false,
      webpack: require('./webpack.config')
    }
  });

  var mochaTest = grunt.config('mochaTest');
  mochaTest.options.timeout = 60000;
  grunt.config('mochaTest', mochaTest);

  grunt.registerTask('build', [
    'copy:assets',
    'webpack:build'
  ]);

  grunt.registerTask('test', [
    'clean:coverage',
    'webpack-dev-server:test',
    'test:automation',
  ]);

  grunt.registerTask('serve', [
    'webpack-dev-server:serve'
  ]);
};
