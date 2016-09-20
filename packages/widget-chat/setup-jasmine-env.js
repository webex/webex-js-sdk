var jasmineReporters = require('jasmine-reporters');
var path = require('path');

jasmine.VERBOSE = true;
if (process.env.XUNIT) {
  jasmine.getEnv().addReporter(
      new jasmineReporters.JUnitXmlReporter({
          consolidateAll: true,
          savePath: path.join(__dirname, '.coverage'),
          filePrefix: 'test-results'
      })
  );
}
