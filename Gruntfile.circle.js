/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint quotes: [2, "backtick"] */

'use strict';

module.exports = function gruntConfig(grunt) {
  require(`load-grunt-tasks`)(grunt);
  require(`time-grunt`)(grunt);
  grunt.loadTasks(`tasks`);

  grunt.registerTask(`coverage`, [
    `makeReport2:all`,
    `coveralls:all`
  ]);

  const ALL_NODE_TASKS = [
    `build`
  ];

  const SINGLE_NODE_TASKS = [
    `static-analysis`,
    `test`
  ];

  const ALL_NODE_PACKAGES = grunt.file.expand({
    cwd: `packages`
  }, [
      // note: packages are ordered on approximate flakiness of their respective
      // test suites
      `example-phone`,
      `ciscospark`,
      `plugin-phone`,
      `http-core`,
      `spark-core`,
      `plugin-wdm`,
      `plugin-mercury`,
      `plugin-locus`,
      `generator-ciscospark`,
      `common`,
      `helper-html`,
      `jsdoctrinetest`,
      `*`,
      `!test-helper*`,
      `!bin*`,
      `!xunit-with-logs`
  ]);

  const CIRCLE_NODE_TOTAL = parseInt(process.env.CIRCLE_NODE_TOTAL || 1, 10);
  const CIRCLE_NODE_INDEX = parseInt(process.env.CIRCLE_NODE_INDEX || 0, 10);
  const SINGLE_NODE_PACKAGES = ALL_NODE_PACKAGES.filter((packageName, index) => index % CIRCLE_NODE_TOTAL === CIRCLE_NODE_INDEX);

  const config = {
    concurrent: {
      options: {
        // Let circle take care of concurrency via multiple containers; each
        // container should be limited to one test run at a time
        limit: 1,
        logConcurrentOutput: true
      }
    },

    coveralls: {
      all: {
        src: [
          `./reports-ng/lcov.info`
        ]
      }
    },

    env: {
      default: {
        src: `.env.default.json`
      },
      'default-overrides': {
        XUNIT: true,
        XUNIT_DIR: `<%= xunitDir %>`
      }
    },

    makeReport2: {
      all: {
        files: [{
          cwd: `./reports-ng/coverage-final/`,
          expand: true,
          src: `**/*.json`
        }],
        options: {
          reporters: {
            'text-summary': {},
            lcovonly: {
              file: `./reports-ng/lcov.info`
            }
          }
        }
      }
    },

    shell: {},

    xunitDir: process.env.CIRCLE_TEST_REPORTS ? `${process.env.CIRCLE_TEST_REPORTS}/junit` : `./reports-ng/style`
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

};
