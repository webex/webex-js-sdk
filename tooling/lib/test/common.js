/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:test:common');
const {readFile, stat} = require('fs-extra');

const {glob} = require('../../util/package');

exports.gatherFiles = async function gatherFiles(env, packageName) {
  let files = [];

  debug(`looking for ${env} tests for ${packageName}`);
  files = files.concat(await glob(`test/${env}/spec/**/*.[tj]s`, {packageName}));

  return files.map((f) => `packages/${packageName}/${f}`);
};

exports.expectReports = async function expectReports(reports) {
  for (const reportFile of reports) {
    try {
      debug(`checking for ${reportFile}`);
      await stat(reportFile);
      debug(`found ${reportFile}`);
    }
    catch (err) {
      throw new Error(`Could not find report ${reportFile}`);
    }
  }
};

exports.expectNonEmptyReports = async function expectNonEmptyReports(reports) {
  for (const reportFile of reports) {
    debug(`verifying ${reportFile} is not empty`);
    const report = await readFile(reportFile);

    if (report.length === 0) {
      debug(`${reportFile} is empty`);
      throw new Error(`Expected ${reportFile} to not be empty`);
    }
    debug(`${reportFile} is not empty`);
  }
};

exports.expectNoKmsErrors = async function expectNoKmsErrors(reports) {
  for (const reportFile of reports) {
    debug(`checking ${reportFile} for kms errors`);
    const report = await readFile(reportFile);

    if (report.includes('Failed to resolve authorization token in KmsMessage request for user')) {
      debug(`${reportFile} contains kms errors`);
      throw new Error(`Expected ${reportFile} to not contain kms errors`);
    }
    debug(`${reportFile} does not contain kms errors`);
  }
};
