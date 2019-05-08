/*!
 * Copyright (c) 2015-2019 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable require-jsdoc */

const debug = require('debug')('monorepo:test');

const denodeify = require('denodeify');
const {Instrumenter} = require('isparta');
const mkdirp = denodeify(require('mkdirp'));
const rimraf = denodeify(require('rimraf'));
const {glob} = require('./package');
const g = denodeify(require('glob'));
const path = require('path');
const fs = require('fs-promise');
const {Collector, Report} = require('istanbul');

function makeCoverageVariable(packageName) {
  return `__coverage${packageName.replace(/@/g, '_').replace(/./g, '_').replace(/\//g, '_')}__`;
}

async function instrument(packageName) {
  const instrumenter = new Instrumenter({
    coverageVariable: makeCoverageVariable(packageName)
  });
  const filenames = await glob('src/**/*.js', {packageName});

  for (const f of filenames) {
    debug(`instrumenting ${f}`);
    const fullPath = path.join('./packages/node_modules', packageName, f);
    const coveragePath = fullPath.replace('src', '.coverage/src');
    const input = await fs.readFile(fullPath);
    // eslint-disable-next-line no-sync
    const output = instrumenter.instrumentSync(input, fullPath);

    await mkdirp(path.dirname(coveragePath));
    await fs.writeFile(coveragePath, output);
    debug(`instrumented ${f}`);
  }
}

async function deinstrument(packageName) {
  await rimraf(path.join('packages/node_modules', packageName, '.coverage'));
}

async function collect(packageName) {
  debug(`collecting coverage for ${packageName}`);
  const coverage = global[makeCoverageVariable(packageName)];

  if (!coverage) {
    debug(`no coverage found for ${packageName}`);

    return;
  }

  const intermediatePath = `${process.cwd()}/reports/coverage/intermediate/${packageName}.json`;

  await mkdirp(path.dirname(intermediatePath));
  await fs.writeFile(intermediatePath, JSON.stringify(coverage, null, 2));
  debug(`stored intermediate coverage for ${packageName}`);
}

async function combine(packageName) {
  const collector = new Collector();
  const pattern = `reports/coverage/intermediate/${packageName}{.json,/**/*.json}`;
  const files = await g(pattern);

  for (const f of files) {
    collector.add(JSON.parse(await fs.readFile(f)));
  }

  // Summarize the coverage for just this package
  Report.create('text-summary').writeReport(collector, true);

  // Combine the mocha and karma reports into a single JSON file. We'll use this
  // file for generating the cobertura, lcov, and html reports later.
  Report.create('json', {
    file: `reports/coverage/${packageName}.json`
  }).writeReport(collector, true);

  debug(`removing intermediate report "reports/coverage/intermediate/${packageName}"`);
  await rimraf(`reports/coverage/intermediate/${packageName}{.json,/**/*.json}`);
}

async function report() {
  const collector = new Collector();
  const pattern = 'reports/coverage/**/*.json';

  const files = await g(pattern);

  for (const f of files) {
    collector.add(JSON.parse(await fs.readFile(f)));
  }

  Report.create('text-summary').writeReport(collector, true);

  Report.create('lcovonly', {
    file: 'reports/coverage/lcov.info'
  }).writeReport(collector, true);

  Report.create('cobertura', {
    file: 'reports/cobertura.xml'
  }).writeReport(collector, true);

  // The html report struggles with (I think) source maps, so let's make sure we
  // don't fail the build as a result
  try {
    Report.create('html').writeReport(collector, true);
  }
  catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to generate HTML report');
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

module.exports = {
  collect,
  combine,
  deinstrument,
  makeCoverageVariable,
  instrument,
  report
};
