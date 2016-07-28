'use strict';

const _ = require(`lodash`);
const fs = require(`fs`);
const mkdirp = require(`mkdirp`);
const path = require(`path`);

module.exports = _.curry((argv, ci, result) => {
  const filename = `reports/junit/suite.xml`;
  return new Promise((resolve, reject) => {
    let errorCount, failureCount, testCase;
    switch (result.status) {
    case `success`:
    case `fixed`:
      failureCount = errorCount = 0;
      testCase = `<testcase name="suite" classname=suite" time="0.1"/>`;
      break;
    case `timedout`:
      failureCount = 0;
      errorCount = 1;
      testCase = `<testcase name="suite" classname=suite" time="0.1"><failure type="">Timed out</failure><testcase>`;
      break;
    case `failed`:
      failureCount = 1;
      errorCount = 0;
      testCase = `<testcase name="suite" classname=suite" time="0.1"><failure type="">failed</failure><testcase>`;
      break;
    default:
      failureCount = errorCount = 1;
      testCase = `<testcase name="suite" classname=suite" time="0.1"><failure type="">${result.status}</failure><testcase>`;
    }
    const out = `<?xml version="1.0"?>
    <testsuite
      name="spark-js-sdk"
      package="suite"
      timestamp="${(new Date()).toISOString()}"
      tests="1"
      errors="${errorCount}"
      failures="${failureCount}"
    >
    ${testCase}
    </testsuite>`;
    console.log(`writing xunit summary to ${filename}`);
    console.log(out.toString());
    mkdirp.sync(path.dirname(filename));
    fs.writeFile(filename, out, (err) => {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      console.log(`wrote xunit summary to ${filename}`);
      resolve();
    });
  });
});
