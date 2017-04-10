/* eslint-disable func-names */
/* eslint-disable max-nested-callback*/
/* eslint-disable no-invalid-this */
/* eslint-disable no-sync */

/* eslint new-cap: [0] */

const fs = require(`fs`);
const istanbul = require(`istanbul`);

module.exports = function(grunt) {
  grunt.registerMultiTask(`instrument2`, `instrument files or directory trees`, function() {
    const options = this.options({
      coverageVariable: `__coverage__`
    });
    const instrumenter = options.instrumenter ? new options.instrumenter(options) : new istanbul.Instrumenter(options);

    this.files.forEach((file) => {
      if (fs.statSync(file.src[0]).isDirectory()) {
        return;
      }

      const instrumented = instrumenter.instrumentSync(grunt.file.read(file.src[0]), file.src[0]);
      grunt.file.write(file.dest, instrumented);
    });
  });

  grunt.registerMultiTask(`storeCoverage2`, function() {
    const options = this.options({
      coverageVariable: `__coverage__`,
      dest: `coverage/intermediate.json`
    });
    const coverage = global[options.coverageVariable];
    if (coverage) {
      grunt.file.write(options.dest, JSON.stringify(coverage));
    }
  });

  grunt.registerMultiTask(`makeReport2`, function() {
    const options = this.options({
      reporters: {
        'text-summary': {}
      }
    });

    const collector = new istanbul.Collector();
    this.files.forEach((file) => {
      collector.add(grunt.file.readJSON(file.src[0]));
    });

    Object.keys(options.reporters).forEach((reporterName) => {
      const reporter = istanbul.Report.create(reporterName, options.reporters[reporterName]);
      reporter.writeReport(collector, true);
    });
  });
};
