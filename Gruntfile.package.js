/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

// eslint-disable-next-line strict
'use strict';

const assert = require(`assert`);
const isparta = require(`isparta`);
const path = require(`path`);

// eslint-disable-next-line complexity
module.exports = function configureGrunt(grunt) {
  assert(process.env.PACKAGE, `process.env.PACKAGE must be defined`);
  // eslint-disable-next-line global-require
  const pkg = require(`./packages/${process.env.PACKAGE}/package`);

  // eslint-disable-next-line global-require
  require(`load-grunt-tasks`)(grunt);
  // eslint-disable-next-line global-require
  require(`time-grunt`)(grunt);
  grunt.loadTasks(`tasks`);

  grunt.initConfig({
    babel: {
      dist: {
        files: [{
          cwd: `./packages/<%= package %>/src`,
          dest: `./packages/<%= package %>/dist`,
          expand: true,
          filter: `isFile`,
          src: `**/*.js`
        }]
      }
    },

    clean: {
      coverage: {
        src: [
          `./packages/<%= package %>/.coverage`
        ]
      },
      dist: {
        src: [
          `./packages/<%= package %>/dist`
        ]
      },
      snapshots: {
        src: [
          `./packages/<%= package %>/src/**/__snapshots__`,
          `./packages/<%= package %>/test/**/__snapshots__`
        ]
      }
    },

    concurrent: {
      test: {
        tasks: (function generateTasks() {
          if (process.env.UNIT_ONLY) {
            return [`test:node`];
          }

          if (process.env.SAUCE_IS_DOWN) {
            return [
              `test:doc`,
              `test:node`
            ];
          }

          return [
            `test:automation`,
            `test:browser`,
            `test:doc`,
            `test:node`
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
          cwd: `./reports/coverage/<%= package %>`,
          expand: true,
          src: `**/*.json`,
          dest: `./reports/coverage-final/<%= package %>`
        }],
        options: {
          process(content) {
            let next = content;
            let current;
            while (next !== current) {
              current = next;
              next = next.replace(`${process.cwd()}/`, ``);
            }

            const c1 = JSON.parse(next);
            const c2 = Object.keys(c1).reduce((content, key) => {
              if (key.indexOf(`test-helper-`) !== -1 || key.indexOf(`bin-`) !== -1 || key.indexOf(`xunit-with-logs`) !== -1) {
                delete content[key];
              }
              return content;
            }, c1);
            return JSON.stringify(c2);
          }
        }
      }
    },

    documentation: {
      options: {
        destination: `./packages/<%= package %>`,
        externals: {
          cwd: `./packages/<%= package %>/test/documentation/spec`,
          dest: `.`,
          expand: true,
          src: `**/*.js`
        },
        private: false
      },
      json: {
        src: `./packages/<%= package %>/src/index.js`,
        options: {
          format: `json`
        }
      },
      html: {
        src: `./packages/<%= package %>/src/index.js`,
        options: {
          destination: `./packages/<%= package %>/doc`,
          format: `html`
        }
      }
    },

    env: {
      default: {
        src: `.env.default.json`
      },
      defaults: {
        BUILD_NUMBER: process.env.BUILD_NUMBER || `local-${process.env.USER}-${pkg.name}-${Date.now()}`
      },
      secrets: {
        src: `.env`
      },
      test: {
        NODE_ENV: `test`
      }
    },

    eslint: {
      options: {
        format: process.env.XUNIT ? `checkstyle` : `stylish`,
        outputFile: process.env.XUNIT && `<%= xunitDir %>/eslint-<%= package %>.xml`
      },
      all: [
        `./packages/<%= package %>/src/**/*.js`,
        `./packages/<%= package %>/test/**/*.js`,
        `!./packages/<%= package %>/test/**/*.es6.js`,
        `./packages/<%= package %>/*.js`
      ]
    },

    express: {
      test: {
        options: {
          script: `./packages/test-helper-server`
        }
      }
    },

    fileExists: {
      karmaxml: [
        `./reports/junit/*/karma-<%= package %>.xml`
      ]
    },

    instrument2: {
      src: {
        files: [{
          cwd: `./packages/<%= package %>`,
          dest: `./packages/<%= package %>/.coverage`,
          expand: true,
          src: `./src/**/*.js`
        }]
      },
      options: {
        instrumenter: isparta.Instrumenter
      }
    },

    jest: {
      options: require(`./jest.config`)
    },

    karma: {
      test: {
        options: {
          configFile: `karma-ng.conf.js`,
          // need to put client config here because grunt-mocha clobbers config
          // in karma.conf.js
          client: {
            mocha: {
              retries: process.env.JENKINS || process.env.CI ? 1 : 0
            }
          }
        }
      }
    },

    makeReport2: {
      test: {
        files: [{
          cwd: `.`,
          expand: true,
          src: `./reports/coverage/<%= package %>/mocha-final.json`
        }, {
          cwd: `.`,
          expand: true,
          src: `./reports/coverage/<%= package %>*/coverage-final.json`
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
        reporter: process.env.XUNIT ? path.join(__dirname, `./packages/xunit-with-logs`) : `spec`,
        // TODO figure out how to detect retried tests
        retries: process.env.JENKINS || process.env.CI ? 1 : 0,
        timeout: 30000,
        noFail: Boolean(process.env.XUNIT)
      },
      automation: {
        options: {
          // SAUCE TUNNEL FAILURES force an exit with non-zero in event of a
          // browser test failure; it probably means that selenium or the sauce
          // tunnel is flaking.
          noFail: false,
          require: makeMochaRequires([`babel-register`]),
          reporterOptions: {
            output: `<%= xunitDir %>/mocha-<%= package %>-automation.xml`
          }
        },
        src: [
          `./packages/<%= package %>/test/automation/spec/**/*.js`
        ]
      },
      node: {
        options: {
          require: makeMochaRequires([`babel-register`]),
          reporterOptions: {
            output: `<%= xunitDir %>/mocha-<%= package %>.xml`
          }
        },
        src: (function() {
          if (process.env.UNIT_ONLY) {
            return [`./packages/<%= package %>/test/unit/spec/**/*.js`];
          }

          const src = [
            `./packages/<%= package %>/test/*/spec/**/*.js`,
            `!./packages/<%= package %>/test/automation/spec/**/*.js`,
            `!./packages/<%= package %>/test/documentation/spec/**/*.js`
          ];
          if (process.env.PIPELINE) {
            src.push(`!./packages/<%= package %>/test/unit/spec/**/*.js`);
          }
          return src;
        }())
      },
      doc: {
        options: {
          require: makeMochaRequires([`./packages/jsdoctrinetest`]),
          reporterOptions: {
            output: `<%= xunitDir %>/mocha-<%= package %>-doc.xml`
          }
        },
        src: [
          `./packages/<%= package %>/dist/**/*.js`,
          // Exclude browser implementations; this is only running in node
          `!./packages/<%= package %>/dist/**/*.shim.js`
        ]
      }
    },

    package: process.env.PACKAGE,

    xunitDir: process.env.XUNIT_DIR || `./reports/junit`,

    shell: {
      'move-babelrc': {
        command: `mv .babelrc babelrc`
      },
      'restore-bablrc': {
        command: `mv babelrc .babelrc`
      }
    },

    storeCoverage2: {
      test: {
        options: {
          dest: `./reports/coverage/<%= package %>/mocha-final.json`
        }
      }
    },

    stylelint: {
      options: {
        configFile: `.stylelintrc`,
        format: `css`
      },
      src: [
        `./packages/<%= package %>/src/**/*.css`
      ]
    },

    watch: {
      serve: {
        files: [
          `Gruntfile.package.js`,
          `packages/test-helper-server/*`,
          `packages/test-helper-server/src/**`
        ],
        options: {
          spawn: false
        },
        tasks: [`express:test`]
      }
    }
  });

  grunt.task.run([
    `env:default`,
    `env:secrets`
  ]);

  registerTask(`static-analysis`, [
    `eslint`,
    `stylelint`
  ]);

  registerTask(`build`, [
    `clean:dist`,
    `babel`
  ]);

  registerTask(`test:automation`, [
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && `continue:on`,
    !process.env.SC_TUNNEL_IDENTIFIER && `selenium_start`,
    `mochaTest:automation`,
    !process.env.SC_TUNNEL_IDENTIFIER && `selenium_stop`,
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && `continue:off`,
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && `continue:fail-on-warning`
  ]);

  registerTask(`test:browser`, [
    // SAUCE TUNNEL FAILURES ideally, we want to suppress failures and let xunit
    // collect them, but until we figure out why the sauce tunnel is flaking, we
    // need to try to rerun the suite
    // p(process.env.XUNIT) && 'continue:on',
    `karma`,
    // p(process.env.XUNIT) && 'continue:off'
    p(process.env.XUNIT) && `fileExists:karmaxml`
  ]);

  registerTask(`test:node`, [
    p(process.env.COVERAGE) && `instrument2`,
    `mochaTest:node`,
    p(process.env.COVERAGE) && `storeCoverage2`
  ]);

  registerTask(`test:doc`, [
    `mochaTest:doc`
  ]);

  registerTask(`test`, [
    `env`,
    `clean:coverage`,
    `serve:test`,
    `concurrent:test`,
    p(process.env.COVERAGE) && `copy:coverage`,
    p(process.env.COVERAGE) && `makeReport2`
  ]);

  function filterNulls(tasks) {
    return tasks.filter((key) => typeof key === `string`);
  }

  function registerTask(name, tasks) {
    grunt.registerTask(name, filterNulls(tasks));
  }

  registerTask(`test:doc`, [
    `env`,
    `mochaTest:doc`
  ]);

  registerTask(`default`, []);

  registerTask(`serve:test`, [
    `express:test`
  ]);

  registerTask(`serve`, [
    `express:test`,
    `watch:serve`
  ]);

  try {
    require(`./packages/${process.env.PACKAGE}/Gruntfile.js`)(grunt, p, makeMochaRequires);
  }
  catch (error) {
    // ignore
    console.info(`No custom gruntfile found at ./packages/${process.env.PACKAGE}/Gruntfile.js; assuming no override intended`);
  }

  /**
   * Helper function which converts environment strings into
   * undefined/true/false
   * @param {string} env
   * @returns {boolean|undefined}
   * @private
   */
  function p(env) {
    if (typeof env === `undefined` || env === `undefined` || env === ``) {
      return undefined;
    }
    if (env.toLowerCase() === `true`) {
      return true;
    }
    if (env.toLowerCase() === `false`) {
      return false;
    }
    throw new Error(`p(): \`env\`"${env}" is not a recognized string`);
  }

  function makeMochaRequires(requires) {
    requires = requires || [];
    // Don't include trace and clarify in environments that can't use them
    if (parseInt(process.versions.node.split(`.`)[0]) < 4) {
      return requires.concat([
        function() {
          Error.stackTraceLimit = Infinity;
        }
      ]);
    }

    if (parseInt(process.versions.node.split(`.`)[0]) <= 5) {
      return requires.concat([
        `clarify`,
        function() {
          Error.stackTraceLimit = Infinity;
        }
      ]);
    }

    return requires.concat([
      // Trace has started throwing a C stack trace locally and *may* be causing
      // unexplained errors in the pipeline
      // `trace`,
      `clarify`,
      function() {
        Error.stackTraceLimit = Infinity;
      }
    ]);
  }
};
