/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable func-names */
/* eslint-disable global-require */
/* eslint-disable no-console */
/* eslint-disable no-shadow */
/* eslint-disable prefer-reflect */
/* eslint-disable require-jsdoc */

// eslint-disable-next-line strict
'use strict';

const assert = require(`assert`);
const isparta = require(`isparta`);
const path = require(`path`);

// eslint-disable-next-line complexity
module.exports = function configureGrunt(grunt) {
  assert(process.env.PACKAGE, `process.env.PACKAGE must be defined`);
  // eslint-disable-next-line global-require
  const pkg = require(`./packages/node_modules/${process.env.PACKAGE}/package`);

  // eslint-disable-next-line global-require
  require(`load-grunt-tasks`)(grunt);
  // eslint-disable-next-line global-require
  require(`time-grunt`)(grunt);
  grunt.loadTasks(`tasks`);

  grunt.initConfig({
    clean: {
      coverage: {
        src: [
          `./packages/node_modules/<%= package %>/.coverage`
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
        destination: `./packages/node_modules/<%= package %>`,
        externals: {
          cwd: `./packages/node_modules/<%= package %>/test/documentation/spec`,
          dest: `.`,
          expand: true,
          src: `**/*.js`
        },
        private: false
      },
      json: {
        src: `./packages/node_modules/<%= package %>/src/index.js`,
        options: {
          format: `json`
        }
      },
      html: {
        src: `./packages/node_modules/<%= package %>/src/index.js`,
        options: {
          destination: `./packages/node_modules/<%= package %>/doc`,
          format: `html`
        }
      }
    },

    env: {
      default: {
        src: `.env.default`
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

    express: {
      test: {
        options: {
          script: `./packages/node_modules/@ciscospark/test-helper-server`
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
          cwd: `./packages/node_modules/<%= package %>`,
          dest: `./packages/node_modules/<%= package %>/.coverage`,
          expand: true,
          src: `./src/**/*.js`
        }]
      },
      options: {
        instrumenter: isparta.Instrumenter
      }
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
        reporter: process.env.XUNIT ? path.join(__dirname, `./packages/node_modules/@ciscospark/xunit-with-logs`) : `spec`,
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
          require: makeMochaRequires([
            () => {
              require(`babel-register`)({
                only: [
                  `./packages/node_modules/**/*`
                ]
              });
            }
          ]),
          reporterOptions: {
            output: `reports/junit/mocha-<%= package %>-automation.xml`
          }
        },
        src: [
          `./packages/node_modules/<%= package %>/test/automation/spec/**/*.js`
        ]
      },
      node: {
        options: {
          require: makeMochaRequires([
            () => {
              require(`babel-register`)({
                only: [
                  `./packages/node_modules/**/*`
                ]
              });
            }
          ]),
          // require: makeMochaRequires([`babelhook`]),
          reporterOptions: {
            output: `reports/junit/mocha-<%= package %>.xml`
          }
        },
        src: (function() {
          if (process.env.UNIT_ONLY) {
            return [`./packages/node_modules/<%= package %>/test/unit/spec/**/*.js`];
          }

          const src = [
            `./packages/node_modules/<%= package %>/test/*/spec/**/*.js`,
            `!./packages/node_modules/<%= package %>/test/automation/spec/**/*.js`,
            `!./packages/node_modules/<%= package %>/test/documentation/spec/**/*.js`
          ];
          if (process.env.PIPELINE) {
            src.push(`!./packages/node_modules/<%= package %>/test/unit/spec/**/*.js`);
          }
          return src;
        }())
      },
      doc: {
        options: {
          require: makeMochaRequires([`./packages/node_modules/@ciscospark/jsdoctrinetest`]),
          reporterOptions: {
            output: `reports/junit/mocha-<%= package %>-doc.xml`
          }
        },
        src: [
          `./packages/node_modules/<%= package %>/dist/**/*.js`,
          // Exclude browser implementations; this is only running in node
          `!./packages/node_modules/<%= package %>/dist/**/*.shim.js`
        ]
      }
    },

    package: process.env.PACKAGE,

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

    watch: {
      serve: {
        files: [
          `Gruntfile.package.js`,
          `packages/node_modules/test-helper-server/*`,
          `packages/node_modules/test-helper-server/src/**`
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

  registerTask(`test:automation`, [
    !process.env.SC_TUNNEL_IDENTIFIER && !process.env.XUNIT && `continue:on`,
    `mochaTest:automation`,
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
    require(`./packages/node_modules/${process.env.PACKAGE}/Gruntfile.js`)(grunt, p, makeMochaRequires);
  }
  catch (error) {
    if (error.code === `MODULE_NOT_FOUND` || error.code === `ENOENT`) {
      console.info(`No custom gruntfile found at ./packages/node_modules/${process.env.PACKAGE}/Gruntfile.js; assuming no override intended`);
    }
    else {
      throw error;
    }
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
    if (parseInt(process.versions.node.split(`.`)[0], 10) < 4) {
      return requires.concat([
        function() {
          Error.stackTraceLimit = Infinity;
        }
      ]);
    }

    if (parseInt(process.versions.node.split(`.`)[0], 10) <= 5) {
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
