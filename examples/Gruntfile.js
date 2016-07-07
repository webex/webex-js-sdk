/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);

  grunt.initConfig({
    config: {
      src: 'src',
      app: 'src/app',
      server: 'src/server'
    },

    env: {
      dev: {
        src: '.env'
      }
    },

    nodemon: {
      dev: {
        script: '<%= config.server %>/index.js',
        options: {
          watch: '<%= config.server %>',
          env: {
            PORT: 8000
          }
        }
      }
    },

    pkg: grunt.file.readJSON('package.json')
  });

  // Aliases
  // -------

  grunt.registerTask('start', [
    'serve'
  ]);

  // Public Tasks
  // ------------

  grunt.registerTask('serve', 'Start a local development server', [
    'env:dev',
    'nodemon:dev'
  ]);

  grunt.registerTask('subgrunt', 'Called by subgrunt parent Gruntfile to install example dependencies', []);

  grunt.registerTask('default', 'subgrunt');
};
