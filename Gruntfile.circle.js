/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint quotes: [2, "backtick"] */

'use strict';

module.exports = function gruntConfig(grunt) {
  require(`load-grunt-tasks`)(grunt);
  require(`time-grunt`)(grunt);

  grunt.registerTask(`static-analysis`, [
    `concurrent:static-analysis`
  ]);

  var PACKAGES = grunt.file.expand({
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
      `!example*`,
      `!test-helper*`,
      `!bin*`,
      `!xunit-with-logs`
  ]);

  var config = {
    concurrent: {
      options: {
        logConcurrentOutput: true
      },
      build: {},
      test: {}
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

    shell: {},

    xunitDir: `${process.env.CIRCLE_TEST_REPORTS}/junit`
  };

  grunt.task.run([
    `env:default`,
    `env:default-overrides`
  ]);

  // Reminder: will need to build all packages even when running tests in
  // concurrent containers
  PACKAGES.forEach((packageName) => {
    generateConcurrentCommand(config, `build`, packageName);
    generateConcurrentCommand(config, `static-analysis`, packageName);
    generateConcurrentCommand(config, `test`, packageName);
  });

  grunt.initConfig(config);

  function generateConcurrentCommand(config, task, packageName) {
    config.shell[`${task}_${packageName}`] = {
      command: `PACKAGE=${packageName} grunt --gruntfile Gruntfile.package.js --no-color ${task}`
    };

    config.concurrent[task] = config.concurrent[task] || {tasks:[]};
    config.concurrent[task].tasks.push(`shell:${task}_${packageName}`);
  }

};
