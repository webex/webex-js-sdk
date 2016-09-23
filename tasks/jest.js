'use strict';

// Copied from grunt-jest, which seems mostly abandoned and complains about peer
// dependencies
// https://raw.githubusercontent.com/leebyron/grunt-jest/master/tasks/jest.js

module.exports = function(grunt) {

  grunt.registerTask('jest', 'Run tests with Jest.', function() {
    require('jest-cli').runCLI(this.options(), process.cwd(), this.async());
  });

};
