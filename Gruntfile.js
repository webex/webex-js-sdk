/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var path = require('path');
var mkdirp = require('mkdirp');

module.exports = function(grunt) {
  /* eslint max-statements: [0] */

  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);
  grunt.loadTasks('tasks');

  var AUTOMATION_PORT = process.env.AUTOMATION_PORT || 8000;
  var FIXTURE_PORT = process.env.FIXTURE_PORT || 9000;
  var KARMA_PORT = process.env.KARMA_PORT || 9001;

  var COVERAGE = grunt.option('coverage') || process.env.COVERAGE;
  var DEBUG = grunt.option('debug') || process.env.DEBUG;
  var PIPELINE = grunt.option('pipeline') || process.env.PIPELINE;
  var SAUCE = grunt.option('sauce') || process.env.SAUCE;
  var XUNIT = grunt.option('xunit') || process.env.XUNIT;

  grunt.initConfig({
    bump: {
      options: {
        files: [
          'package.json',
          '<%= config.src %>/version.js'
        ],
        commitFiles: [
          'package.json',
          '<%= config.src %>/version.js',
          // 'CHANGELOG.md',
          'README.md',
          'packages/*/README.md'
        ],
        globalReplace: true,
        tagName: '%VERSION%',
        updateConfigs: ['pkg'],
        pushTo: 'origin',
        push: false
      }
    },

    clean: {
      tmp: {
        src: ['<%= config.tmp %>']
      },
      tmpUploads: {
        src: ['<%= config.tmpUploads %>/**']
      }
    },

    config: {
      dist: 'dist',
      reports: 'reports',
      src: 'src',
      test: 'test',
      tmp: '.tmp',
      tmpUploads: '.tmp_uploads/' + process.env.UPLOAD_DIR
    },

    connect: {
      test: {
        options: {
          // Make sure the jenkins jobs don't collide by trying to use the same
          // port
          port: FIXTURE_PORT,
          base: [
            'node_modules/anonymous-squared-datasets',
            '<%= config.test %>/integration/fixtures',
            '<%= config.test %>/unit/fixtures'
          ],
          middleware: function(connect, options) {
            var pathName = path.join(__dirname, grunt.config('config').tmpUploads);
            mkdirp.sync(pathName);

            var middlewares = [
              connect().use(connect.bodyParser({uploadDir: grunt.config('config').tmpUploads})),
              connect().use('/upload', function(req, res) {
                res.setHeader('Content-Type', 'application/json');

                // response with basic file stats
                res.end();
              })
            ];

            // add the static paths in options.base
            options.base.forEach(function(base) {
              middlewares.push(connect.static(base));
            });

            return middlewares;
          }
        }
      }
    },

    copy: {
      test: {
        files: [{
          expand: true,
          cwd: '.',
          src: 'test/**',
          dest: '<%= config.tmp %>'
        }]
      }
    },

    env: {
      automation: {
        // Set scopes here because they're not the secrets file on Jenkins
        COMMON_IDENTITY_SCOPE: 'webexsquare:get_conversation Identity:SCIM'
      },
      default: {
        src: '.env.default.json'
      },
      secrets: {
        src: '.env'
      },
      test: {
        AUTOMATION_PORT: AUTOMATION_PORT,
        ENABLE_NETWORK_LOGGING: process.env.ENABLE_NETWORK_LOGGING || XUNIT || '',
        ENABLE_VERBOSE_NETWORK_LOGGING: process.env.ENABLE_VERBOSE_NETWORK_LOGGING || XUNIT || '',
        FIXTURE_PORT: FIXTURE_PORT,
        KARMA_PORT: KARMA_PORT,
        NODE_ENV: 'test',
        SDK_TEST_SUITE: true
      },
      grunt: {
        COVERAGE: COVERAGE,
        DEBUG: DEBUG,
        PIPELINE: PIPELINE,
        SAUCE: SAUCE,
        XUNIT: XUNIT
      }
    },

    eslint: {
      all: [
        '<%= config.src %>/**/*.js',
        '<%= config.test %>/**/*.js',
        'Gruntfile.js'
      ]
    },

    fileExists: {
      karmaxml: [
        './reports/junit/*/karma-legacy.xml'
      ]
    },

    'gh-pages': {
      options: {
        add: true,
        base: 'doc'
      },
      'sqbu-github': {
        options: {
          repo: 'git@sqbu-github.cisco.com:WebExSquared/squared-js-sdk.git'
        },
        src: ['**/*']
      }
    },

    instrument2: {
      src: {
        files: [{
          cwd: '.',
          dest: '<%= config.tmp %>',
          expand: true,
          src: '<%= config.src %>/**/*.js'
        }]
      }
    },

    jscs: {
      options: {
        config: '.jscsrc'
      },
      all: [
        '<%= config.src %>/**/*.js',
        '<%= config.test %>/**/*.js',
        '!<%= config.test %>/xunit-with-logs.js'
      ]
    },

    karma: {
      options: {
        configFile: 'karma.conf.js',
        port: KARMA_PORT,
        client: {
          mocha: {
            retries: (process.env.JENKINS || process.env.CI) ? 1 : 0
          }
        }
      },
      test: {},
      debug: {
        options: {
          singleRun: false,
          browsers: ['ChromeCanary']
        }
      }
    },

    makeReport: {
      src: [
        'reports/coverage/*/coverage*.json',
        'reports/coverage-final/**/*.json'
      ],
      options: {
        type: [
          'cobertura',
          'text-summary'
        ],
        dir: 'reports/coverage/all',
        print: 'none',
        reporters: {
          cobertura: {
            file: 'reports/coverage/all/cobertura-coverage.xml'
          },
          'text-summary': {}
        }
      }
    },

    mochaTest: {
      options: {
        reporter: 'spec',
        // TODO figure out how to detect retried tests
        retries: (process.env.JENKINS || process.env.CI) ? 1 : 0,
        noFail: process.env.XUNIT
      },
      automation: {
        options: {
          reporterOptions: {
            output: '<%= xunitDir %>/xunit-automation.xml'
          }
        },
        src: ['<%= config.test %>/automation/spec/**/*.js']
      },
      integration: {
        options: {
          reporterOptions: {
            output: '<%= xunitDir %>/xunit-integration.xml'
          }
        },
        src: ['<%= config.test %>/integration/spec/**/*.js']
      },
      unit: {
        options: {
          reporterOptions: {
            output: '<%= xunitDir %>/xunit-unit.xml'
          }
        },
        src: ['<%= config.test %>/unit/spec/**/*.js']
      }
    },

    pkg: grunt.file.readJSON('package.json'),

    shell: {
      'check-ulimit': {
        command: 'if [ `ulimit -n` -lt 4096 ]; then  echo "Please increase ulimit to at least 4096"; exit 1; fi'
      },
      jsdoc: {
        command: './node_modules/.bin/jsdoc -c .jsdoc.json -r <%= config.src %>'
      }
    },

    storeCoverage2: {
      test: {
        options: {
          dest: './reports/coverage/legacy/mocha-final.json'
        }
      }
    },

    xmlstrip: {
      karma: {
        files: [{
          cwd: './reports/junit',
          dest: '.',
          expand: true,
          src: '**/karma-legacy.xml'
        }],
        options: {
          nodes: [
            'testsuite.system-err',
            'testsuite.system-out'
          ]
        }
      }
    },

    xunitDir: process.env.XUNIT_DIR || './reports/junit'
  });

  // Private task for removing SQUARED_JS_SDK from the beginning of env
  // variables set by Jenkins
  grunt.registerTask('private-unprefix', function() {
    var pkg = require('./package');
    for (var key in process.env) {
      if (Object.hasOwnProperty.call(process.env, key)) {
        if (key.indexOf(pkg.name.toUpperCase().replace(/-/g, '_')) === 0) {
          // Add 1 to account for the underscore
          process.env[key.substr(pkg.name.length + 1)] = process.env[key];
        }
        if (key.indexOf('SQUARED_JS_SDK') === 0) {
          // Add 1 to account for the underscore
          process.env[key.substr('SQUARED_JS_SDK'.length + 1)] = process.env[key];
        }
      }
    }
  });

  grunt.registerTask('private-update-version-strings', function() {
    ['README.md'].forEach(function(filename) {
      var pattern = /\d+\.\d+\.\d+(?:-\d+)?/;
      var text = grunt.file.read(filename);
      text = text.replace(pattern, grunt.config('pkg').version);
      grunt.file.write(filename, text);
    });
  });

  // Load local environment variables (will not fail if no file found)
  grunt.task.run([
    'env:test',
    'shell:check-ulimit',
    'env:grunt',
    'env:default',
    'env:secrets',
    'private-unprefix'
  ]);

  // Needed to ensure grunt completes properly.
  grunt.event.on('coverage', function(content, done) {
    done();
  });

  var mochaTest;
  if (COVERAGE) {
    mochaTest = grunt.config('mochaTest');
    mochaTest.unit.src[0] = grunt.config('config').tmp + '/' + mochaTest.unit.src[0];
    mochaTest.integration.src[0] = grunt.config('config').tmp + '/' + mochaTest.integration.src[0];
    grunt.config('mochaTest', mochaTest);
  }

  if (XUNIT) {
    var eslint = grunt.config('eslint');
    eslint.options = eslint.options || {};
    eslint.options.format = 'junit';
    eslint.options.outputFile = 'reports/eslint.xml';
    grunt.config('eslint', eslint);

    var jscs = grunt.config('jscs');
    jscs.options.reporter = 'junit';
    jscs.options.reporterOutput = 'reports/jscs.xml';
    grunt.config('jscs', jscs);

    mochaTest = grunt.config('mochaTest');
    mochaTest.options.reporter = path.join(__dirname, 'test/xunit-with-logs');
    grunt.config('mochaTest', mochaTest);
  }

  var env = grunt.config('env');
  var browsers = require('./browsers');
  if (SAUCE) {
    browsers = browsers.sauce;
    env.test.BROWSER_ENVIRONMENT = 'sauce';
  }
  else {
    browsers = browsers.local;
    env.test.BROWSER_ENVIRONMENT = 'local';
  }
  grunt.config('env', env);

  browsers = Object.keys(browsers);
  if (PIPELINE) {
    browsers = [browsers[0]];
  }

  var karma = grunt.config('karma');
  karma.test.options = karma.test.options || {};
  karma.test.options.browsers = browsers;
  grunt.config('karma', karma);

  // Public Tasks
  // ------------

  grunt.registerTask('static-analysis', [
    'eslint',
    'jscs'
  ]);

  grunt.registerTask('test', function(target) {
    /* eslint complexity:[0] */
    var tasks = [
      'env:test',
      'clean'
    ];

    if (!target) {
      tasks.push('static-analysis');
    }

    if (COVERAGE) {
      tasks.push('copy:test');
      tasks.push('instrument2');
    }

    if (!target || target === 'unit') {
      tasks.push('mochaTest:unit');
    }

    if (!target || target === 'integration' || target === 'karma') {
      tasks.push('connect:test');
    }

    if (!target || target === 'integration') {
      tasks.push('mochaTest:integration');
    }

    if (process.env.SKIP_BROWSER_TESTS !== 'true' && (!target || target === 'karma')) {
      if (process.env.XUNIT) {
        tasks.push('continue:on');
        tasks.push('karma:test');
        tasks.push('continue:off');
        tasks.push('fileExists:karmaxml');
      }
      else {
        tasks.push(DEBUG ? 'karma:debug' : 'karma:test');
      }
    }

    if (target !== 'karma' && COVERAGE) {
      tasks.push('storeCoverage2');
    }

    tasks.push('clean:tmpUploads');
    tasks.push('clean:tmp');
    grunt.task.run(tasks);
  });

  grunt.registerTask('release', [
    'bump-only',
    // 'changelog',
    // 'shell:jsdoc',
    'private-update-version-strings',
    // 'gh-pages',
    // 'clean:gh-pages',
    'bump-commit'
  ]);

  grunt.registerTask('default', ['test']);
};
