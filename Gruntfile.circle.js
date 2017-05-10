/* eslint-disable global-require */
/* eslint-disable no-console */
/* eslint-disable no-shadow */
/* eslint-disable require-jsdoc */

/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint quotes: [2, "backtick"] */


module.exports = function gruntConfig(grunt) {
  require(`load-grunt-tasks`)(grunt);
  require(`time-grunt`)(grunt);
  grunt.loadTasks(`tasks`);

  grunt.registerTask(`coverage`, [
    `makeReport2:all`
  ]);

  grunt.registerTask(`publish-docs`, [
    `documentation`,
    `gh-pages:ghc`
  ]);

  const ALL_NODE_TASKS = [
    `build`
  ];

  const SINGLE_NODE_TASKS = [
    `test`
  ];

  const ALL_NODE_PACKAGES = grunt.file.expand({
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

  const CIRCLE_NODE_TOTAL = parseInt(process.env.CIRCLE_NODE_TOTAL || 1, 10);
  const CIRCLE_NODE_INDEX = parseInt(process.env.CIRCLE_NODE_INDEX || 0, 10);

  let SINGLE_NODE_PACKAGES;
  if (CIRCLE_NODE_TOTAL === 1) {
    SINGLE_NODE_PACKAGES = ALL_NODE_PACKAGES;
  }
  else {
    SINGLE_NODE_PACKAGES = ALL_NODE_PACKAGES.filter((packageName, index) => index % CIRCLE_NODE_TOTAL === CIRCLE_NODE_INDEX);
  }


  const config = {
    concurrent: {
      options: {
        // Let circle take care of concurrency via multiple containers; each
        // container should be limited to one test run at a time
        limit: 1,
        logConcurrentOutput: true
      }
    },

    copy: {
      coverage: {
        files: [{
          cwd: `reports`,
          expand: true,
          src: [`**/cobertura.xml`],
          dest: process.env.CIRCLE_ARTIFACTS
        }]
      }
    },

    coveralls: {
      options: {
        // Don't fail the build if coveralls fails to receive reports for some
        // reason
        force: true
      },
      all: {
        src: [
          `./reports/lcov.info`
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
      'default-overrides': {
        BUILD_NUMBER: process.env.CIRCLE_BUILD_NUM,
        XUNIT: true
      }
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
          repo: `git@github.com:ciscospark/spark-js-sdk.git`
        }
      }
    },

    makeReport2: {
      all: {
        files: [{
          cwd: `./reports/coverage-final`,
          expand: true,
          src: `**/*.json`
        }],
        options: {
          reporters: {
            cobertura: {
              file: `./reports/cobertura.xml`
            },
            lcovonly: {
              file: `./reports/lcov.info`
            },
            'text-summary': {}
          }
        }
      }
    },

    shell: {}
  };

  grunt.task.run([
    `env:default`,
    `env:default-overrides`
  ]);

  // Set up tasks that run on all containers
  ALL_NODE_TASKS.forEach((taskName) => {
    ALL_NODE_PACKAGES.forEach((packageName) => {
      generateConcurrentCommand(config, taskName, packageName);
    });

    grunt.registerTask(taskName, `concurrent:${taskName}`);
  });

  // Set up tasks that run on *this* container
  SINGLE_NODE_TASKS.forEach((taskName) => {
    SINGLE_NODE_PACKAGES.forEach((packageName) => {
      generateConcurrentCommand(config, taskName, packageName);
    });

    grunt.registerTask(taskName, `concurrent:${taskName}`);
  });

  grunt.initConfig(config);

  function generateConcurrentCommand(config, task, packageName) {
    config.shell[`${task}_${packageName}`] = {
      command: `PACKAGE=${packageName} grunt --gruntfile Gruntfile.package.js --no-color ${task}`
    };

    config.concurrent[task] = config.concurrent[task] || {};
    config.concurrent[task].tasks = config.concurrent[task].tasks || [];
    config.concurrent[task].tasks.push(`shell:${task}_${packageName}`);
  }

  console.log(`Evaluating ${SINGLE_NODE_PACKAGES.join(`, `) || `legacy packages`} on this node`);
};
