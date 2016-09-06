'use strict';

/* eslint new-cap: [0] */

var fs = require('fs');
var istanbul = require('istanbul');

module.exports = function(grunt) {
  grunt.registerMultiTask('instrument2', 'instrument files or directory trees', function() {
    var options = this.options({
      coverageVariable: '__coverage__'
    });
    var instrumenter = options.instrumenter ? new options.instrumenter(options) : new istanbul.Instrumenter(options);

    this.files.forEach(function(file) {
      if (fs.statSync(file.src[0]).isDirectory()) {
        return;
      }

      var instrumented = instrumenter.instrumentSync(grunt.file.read(file.src[0]), file.src[0]);
      grunt.file.write(file.dest, instrumented);
    }.bind(this));
  });

  grunt.registerMultiTask('storeCoverage2', function() {
    var options = this.options({
      coverageVariable: '__coverage__',
      dest: 'coverage/intermediate.json'
    });
    var coverage = global[options.coverageVariable];
    if (coverage) {
      grunt.file.write(options.dest, JSON.stringify(coverage));
    }
  });

  grunt.registerMultiTask('makeReport2', function() {
    var options = this.options({
      reporters: {
        'text-summary': {}
      }
    });

    var collector = new istanbul.Collector();
    this.files.forEach(function(file) {
      collector.add(grunt.file.readJSON(file.src[0]));
    });

    Object.keys(options.reporters).forEach(function(reporterName) {
      var reporter = istanbul.Report.create(reporterName, options.reporters[reporterName]);
      reporter.writeReport(collector, true);
    });
  });
};
