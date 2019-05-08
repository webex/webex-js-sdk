/** !
 *
 * Copyright (c) 2015-2019 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable global-require */
/* eslint-disable no-console */
/* eslint-disable no-shadow */

module.exports = function gruntConfig(grunt) {
  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);
  grunt.loadTasks('tasks');

  const config = {
    env: {
      default: {
        src: '.env.default'
      },
      secrets: {
        src: '.env'
      }
    },

    'gh-pages': {
      options: {
        base: 'docs'
      },
      docs: {
        src: ['**']
      },
      ghc: {
        src: ['**'],
        options: {
          push: false,
          repo: 'https://github.com/webex/spark-js-sdk.git',
          user: {
            name: 'Jenkins',
            email: 'spark-js-sdk.gen@cisco.com'
          }
        }
      }
    }
  };

  grunt.registerTask('publish:docs', ['gh-pages:ghc']);

  grunt.initConfig(config);
  grunt.task.run(['env:default', 'env:secrets']);

  grunt.registerTask('default', []);
};
