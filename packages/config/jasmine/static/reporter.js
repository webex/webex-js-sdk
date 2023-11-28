const { SpecReporter } = require('jasmine-spec-reporter');

const reporter = (jasmine) => {
  jasmine.clearReporters();

  jasmine.addReporter(
    new SpecReporter({
      spec: {
        displayPending: true,
      },
    }),
  );
};

module.exports = reporter;
