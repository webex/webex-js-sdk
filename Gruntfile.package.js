/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('assert');
var isparta = require('isparta');
var path = require('path');

module.exports = function(grunt) {
  assert(process.env.PACKAGE, 'process.env.PACKAGE must be defined');
  var pkg = require('./packages/' + process.env.PACKAGE + '/package');

  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);
  grunt.loadTasks('tasks');

  grunt.loadNpmTasks('dependency-check');

  grunt.initConfig({
    babel: {
      dist: {
        files: [{
          cwd: './packages/<%= package %>/src',
          dest: './packages/<%= package %>/dist',
          expand: true,
          filter: 'isFile',
          src: '**/*.js'
        }]
      }
    },

    clean: {
      coverage: {
        src: [
          './packages/<%= package %>/.coverage'
        ]
      },
      dist: {
        src: [
          './packages/<%= package %>/dist'
        ]
      }
    },

    concurrent: {
      test: {
        tasks: (function() {
          if (process.env.UNIT_ONLY) {
            return ['test:node'];
          }

          return [
            'test:automation',
            'test:browser',
            'test:doc',
            'test:node'
          ];
        }()),
        options: {
          logConcurrentOutput: true
        }
      }
    },

    copy: {
      coverage: {
        // There ought to be a better way to get karma coverage to spit out
        // absolute paths, but so far I can't find it.
        files: [{
          cwd: './reports/coverage/<%= package %>',
          expand: true,
          src: '**/*.json',
          dest: './reports/coverage-final/<%= package %>'
        }],
        options: {
          process: function(content) {
            var next = content;
            var current;
            while(next !== current) {
              current = next;
              next = next.replace(process.cwd() + '/', '');
            }

            var c1 = JSON.parse(next);
            var c2 = Object.keys(c1).reduce(function(content, key) {
              if (key.indexOf('test-helper-') !== -1 || key.indexOf('bin-') !== -1 || key.indexOf('xunit-with-logs') !== -1) {
                delete content[key];
              }
              return content;
            }, c1);
            return JSON.stringify(c2);
          }
        }
      }
    },

    'dependency-check': {
      files: '.',
      options: {
        excludeUnusedDev: true,
        package: './packages/<%= package %>'
      }
    },

    documentation: {
      options: {
        destination: './packages/<%= package %>',
        externals: {
          cwd: './packages/<%= package %>/test/documentation/spec',
          dest: '.',
          expand: true,
          src: '**/*.js'
        },
        private: false
      },
      json: {
        src: './packages/<%= package %>/src/index.js',
        options: {
          format: 'json'
        }
      },
      html: {
        src: './packages/<%= package %>/src/index.js',
        options: {
          destination: './packages/<%= package %>/doc',
          format: 'html'
        }
      }
    },

    env: {
      default: {
        src: '.env.default.json'
      },
      defaults: {
        BUILD_NUMBER: process.env.BUILD_NUMBER || 'local-' + process.env.USER + '-' + pkg.name + '-' + Date.now()
      },
      secrets: {
        src: '.env'
      },
      test: {
        NODE_ENV: 'test'
      }
    },

    eslint: {
      options: {
        format: process.env.XUNIT ? 'junit' : 'stylish',
        outputFile: process.env.XUNIT && '<%= xunitDir %>/eslint-<%= package %>.xml'
      },
      all: [
        './packages/<%= package %>/src/**/*.js',
        './packages/<%= package %>/test/**/*.js',
        '!./packages/<%= package %>/test/**/*.es6.js',
        './packages/<%= package %>/*.js'
      ]
    },

    express: {
      test: {
        options: {
          script: './packages/test-helper-server'
        }
      }
    },

    fileExists: {
      karmaxml: [
        './reports/junit/*/karma-<%= package %>.xml'
      ]
    },

    instrument2: {
      src: {
        files: [{
          cwd: './packages/<%= package %>',
          dest: './packages/<%= package %>/.coverage',
          expand: true,
          src: './src/**/*.js'
        }]
      },
      options: {
        instrumenter: isparta.Instrumenter
      }
    },

    karma: {
      test: {
        options: {
          configFile: 'karma-ng.conf.js',
          // need to put client config here because grunt-mocha clobbers config
          // in karma.conf.js
          client: {
            mocha: {
              retries: (process.env.JENKINS || process.env.CI) ? 1 : 0
            }
          }
        }
      }
    },

    makeReport2: {
      test: {
        files: [{
          cwd: '.',
          expand: true,
          src: './reports/coverage/<%= package %>/mocha-final.json'
        }, {
          cwd: '.',
          expand: true,
          src: './reports/coverage/<%= package %>*/coverage-final.json'
        }],
        options: {
          reporters: {
            'text-summary': {}
          }
        }
      }
    },

    mochaTest: {
      options: {
        reporter: process.env.XUNIT ? path.join(__dirname, './packages/xunit-with-logs') : 'spec',
        // TODO figure out how to detect retried tests
        retries: (process.env.JENKINS || process.env.CI) ? 1 : 0,
        timeout: 30000,
        noFail: Boolean(process.env.XUNIT)
      },
      automation: {
        options: {
          require: makeMochaRequires(['babel-register']),
          reporterOptions: {
            output: '<%= xunitDir %>/mocha-<%= package %>-automation.xml'
          }
        },
        src: [
          './packages/<%= package %>/test/automation/spec/**/*.js'
        ]
      },
      node: {
        options: {
          require: makeMochaRequires(['babel-register']),
          reporterOptions: {
            output: '<%= xunitDir %>/mocha-<%= package %>.xml'
          }
        },
        src: (function() {
          if ( process.env.UNIT_ONLY) {
            return ['./packages/<%= package %>/test/unit/spec/**/*.js'];
          }

          var src = [
            './packages/<%= package %>/test/*/spec/**/*.js',
            '!./packages/<%= package %>/test/automation/spec/**/*.js',
            '!./packages/<%= package %>/test/documentation/spec/**/*.js'
          ];
          if (process.env.PIPELINE) {
            src.push('!./packages/<%= package %>/test/unit/spec/**/*.js');
          }
          return src;
        }())
      },
      doc: {
        options: {
          require: makeMochaRequires(['./packages/jsdoctrinetest']),
          reporterOptions: {
            output: '<%= xunitDir %>/mocha-<%= package %>-doc.xml'
          }
        },
        src: [
          './packages/<%= package %>/dist/**/*.js',
          // Exclude browser implementations; this is only running in node
          '!./packages/<%= package %>/dist/**/*.shim.js'
        ]
      }
    },

    package: process.env.PACKAGE,

    xunitDir: process.env.XUNIT_DIR || './reports/junit',

    shell: {
      'move-babelrc': {
        command: 'mv .babelrc babelrc'
      },
      'restore-bablrc': {
        command: 'mv babelrc .babelrc'
      }
    },

    storeCoverage2: {
      test: {
        options: {
          dest: './reports/coverage/<%= package %>/mocha-final.json'
        }
      }
    },

    watch: {
      serve: {
        files: [
          'Gruntfile.package.js',
          'packages/test-helper-server/*',
          'packages/test-helper-server/src/**'
        ],
        options: {
          spawn: false
        },
        tasks: ['express:test']
      }
    }
  });

  grunt.task.run([
    'env:default',
    'env:secrets'
  ]);

  registerTask('static-analysis', [
    'eslint',
    'dependency-check'
  ]);

  registerTask('build', [
    'clean:dist',
    'babel'
  ]);

  registerTask('test:automation', [
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && 'continue:on',
    !process.env.SC_TUNNEL_IDENTIFIER && 'selenium_start',
    'mochaTest:automation',
    !process.env.SC_TUNNEL_IDENTIFIER && 'selenium_stop',
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && 'continue:off',
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && 'continue:fail-on-warning'
  ]);

  registerTask('test:browser', [
    p(process.env.XUNIT) && 'continue:on',
    'karma',
    p(process.env.XUNIT) && 'continue:off',
    p(process.env.XUNIT) && 'fileExists:karmaxml'
  ]);

  registerTask('test:node', [
    p(process.env.COVERAGE) && 'instrument2',
    'mochaTest:node',
    p(process.env.COVERAGE) && 'storeCoverage2'
  ]);

  registerTask('test:doc', [
    'mochaTest:doc'
  ]);

  registerTask('test', [
    'env',
    'clean:coverage',
    'serve:test',
    'concurrent:test',
    p(process.env.COVERAGE) && 'copy:coverage',
    p(process.env.COVERAGE) && 'makeReport2'
  ]);

  function filterNulls(tasks) {
    return tasks.filter(function(key) { return typeof key === 'string';});
  }

  function registerTask(name, tasks) {
    grunt.registerTask(name, filterNulls(tasks));
  }

  registerTask('test:doc', [
    'env',
    'mochaTest:doc'
  ]);

  registerTask('default', []);

  try {
    require('./packages/' + process.env.PACKAGE +  '/Gruntfile.js')(grunt, p, makeMochaRequires);
  }
  catch(error) {
    // ignore
  }

  registerTask('serve:test', [
    'express:test'
  ]);

  registerTask('serve', [
    'express:test',
    'watch:serve'
  ]);

  /**
   * Helper function which converts environment strings into
   * undefined/true/false
   * @param {string} env
   * @returns {boolean|undefined}
   * @private
   */
  function p(env) {
    if (typeof env === 'undefined' || env === 'undefined' || env === '') {
      return undefined;
    }
    if (env.toLowerCase() === 'true') {
      return true;
    }
    if (env.toLowerCase() === 'false') {
      return false;
    }
    throw new Error('p(): `env`"' + env + '" is not a recognized string');
  }

  function makeMochaRequires(requires) {
    requires = requires || [];
    // Don't include trace and clarify in environments that can't use them
    if (parseInt(process.versions.node.split('.')[0]) < 4) {
      return requires.concat([
        function() {
          Error.stackTraceLimit = Infinity;
        }
      ]);
    }

    if (parseInt(process.versions.node.split('.')[0]) <= 5) {
      return requires.concat([
        'clarify',
        function() {
          Error.stackTraceLimit = Infinity;
        }
      ]);
    }

    return requires.concat([
      'trace',
      'clarify',
      function() {
        Error.stackTraceLimit = Infinity;
      }
    ]);
  }
};
