/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable global-require */
/* eslint-disable no-console */
/* eslint-disable no-shadow */

module.exports = function gruntConfig(grunt) {
  require(`load-grunt-tasks`)(grunt);
  require(`time-grunt`)(grunt);
  grunt.loadTasks(`tasks`);

  const PACKAGES = grunt.file.expand({
    cwd: `packages/node_modules`,
    filter: `isDirectory`
  }, [
    `*`,
    `!*/*`,
    `@ciscospark/*`,
    `!@ciscospark`,
    `!@ciscospark/example*`,
    `!@ciscospark/test-helper*`,
    `!@ciscospark/bin*`,
    `!@ciscospark/xunit-with-logs`,
    `@ciscospark/test-helper-mock-web-socket`,
    `@ciscospark/test-helper-mock-socket`
  ]);

  const config = {
    concurrent: {
      test: {
        tasks: [],
        options: {
          // Run sequentially for now - port management is hard
          limit: 1,
          logConcurrentOutput: true
        }
      }
    },

    clean: {
      reports: {
        src: [
          `./reports`
        ]
      }
    },

    documentation: {
      options: {
        private: false
      },
      html: {
        src: [
          `./packages/node_modules/ciscospark/src/index.js`,
          `./packages/node_modules/@ciscospark/plugin-phone/src/index.js`
        ],
        options: {
          destination: `./docs/api/`,
          format: `html`,
          github: true,
          theme: `./docs/_theme`
        }
      }
    },

    env: {
      default: {
        src: `.env.default`
      },
      secrets: {
        src: `.env`
      }
    },

    fileExists: {
      checkstylexml: [
        `./reports/style/eslint-concurrent.xml`,
        `./reports/style/eslint-legacy.xml`
      ]
    },

    'gh-pages': {
      options: {
        base: `docs`
      },
      docs: {
        src: [`**`]
      },
      ghc: {
        src: [`**`],
        options: {
          push: false,
          repo: `https://github.com/ciscospark/spark-js-sdk.git`,
          user: {
            name: `Jenkins`,
            email: `spark-js-sdk.gen@cisco.com`
          }
        }
      }
    },

    makeReport2: {
      all: {
        files: [{
          cwd: `./reports/coverage-final/`,
          expand: true,
          src: `**/*.json`
        }],
        options: {
          reporters: {
            cobertura: {
              file: `./reports/cobertura-coverage.xml`
            },
            json: {
              file: `./reports/coverage.json`
            },
            html: {},
            'text-summary': {}
          }
        }
      }
    },

    'package-json': {
      package: {
        options: {
          overrides(packageName) {
            return {
              license: `MIT`,
              repository: `https://github.com/ciscospark/spark-js-sdk/tree/master/packages/node_modules${packageName}`,
              engines: {
                node: `>=4`
              }
            };
          }
        }
      }
    },

    shell: {}
  };

  PACKAGES.forEach((packageName) => {
    const shellTestKey = `test_${packageName}`;
    const testKey = `test:${packageName}`;

    config.shell[shellTestKey] = {
      command: `PACKAGE=${packageName} grunt --gruntfile Gruntfile.package.js --no-color test`
    };
    grunt.registerTask(testKey, `shell:${shellTestKey}`);
    config.concurrent.test.tasks.push(testKey);
  });

  grunt.registerTask(`test`, [
    `clean:reports`,
    `concurrent:test`,
    p(process.env.COVERAGE) && `makeReport2`
  ].filter((key) => typeof key === `string`));

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

  grunt.registerTask(`build:docs`, [
    `documentation`
  ]);

  grunt.registerTask(`publish:docs`, [
    `gh-pages:ghc`
  ]);

  grunt.initConfig(config);
  grunt.task.run([
    `env:default`,
    `env:secrets`
  ]);

  grunt.registerTask(`default`, []);
};
