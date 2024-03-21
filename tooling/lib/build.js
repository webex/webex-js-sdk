/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const path = require('path');
const {spawn} = require('child_process');

const debug = require('debug')('tooling:build');
const capitalize = require('lodash');
const humanize = require('humanize-string');
const {writeFile} = require('fs-extra');

const {mkdirp, rimraf, transformFile} = require('../lib/async');
const g = require('../lib/async').glob;
const {glob} = require('../util/package');

exports.buildFile = async function buildFile({src, dest}) {
  debug(`transforming ${src}`);
  /**
   * babel's transformFile returns an object
   * with code string and it's map file string
   */
  const {code, map} = await transformFile(src);

  debug(`transformFileed ${src}`);
  await mkdirp(path.dirname(dest));
  debug(`writing ${dest}`);
  await writeFile(dest, `${code}\n//# sourceMappingURL=${path.basename(dest)}.map\n`);
  await writeFile(`${dest}.map`, JSON.stringify(map));
  debug(`wrote ${dest}`);
};

exports.buildPackage = async function buildPackage(packageName) {
  debug(`building package ${packageName}`);
  /**
   * glob method is to fetch absolute file path for a said pattern
   * Lookup method for more info
   */
  const filesJS = await glob('src/**/*.js', {packageName});
  const filesTS = await glob('src/**/*.ts', {packageName});
  const files = [...filesJS, ...filesTS];

  debug('building files ', files);
  /**
   * In the consolidated mapped object below, absolute path for src & dest added
   */
  const mapped = files
    .map((filename) => path.join('packages', packageName, filename))
    .map((filename) => ({
      src: filename,
      dest: filename.replace('src', 'dist').replace('.ts', '.js'),
    }));

  for (const file of mapped) {
    // buildFile method transforms the file using babel-core transform method
    await exports.buildFile(file);
  }
};

exports.buildSamples = async function buildSamples() {
  let data = '';

  await rimraf('docs/samples/webex.min.*');

  // reminder: samples:build calls this script, not webpack
  // hence we must call webpack here
  const [cmd, ...args] = `webpack --color ${
    process.env.NODE_ENV === 'development' ? '--mode development' : '--mode production'
  }`.split(' ');
  const webpack = spawn(cmd, args, {
    stdio: 'pipe',
    // Spawn fix for Windows
    shell: process.platform === 'win32',
  });

  webpack.stdout.on('data', (d) => {
    console.log(`webpack log:\n${d}`);
  });

  webpack.stderr.on('data', (d) => {
    data += d;
    console.log(`webpack log:\n${d}`);
  });

  webpack.on('close', (code) => {
    debug('child has completed');
    if (code) {
      const e = new Error(code);

      e.data = data;

      debug(e);
    }
  });

  const samples = await g('browser-*', {
    cwd: path.resolve(process.cwd(), 'docs/samples'),
  });

  const out = `<!DOCTYPE html>
<html>
<head>
  <title>Samples</title>
</head><body>
<h1>Hosted Samples</h1>
<ul>
${samples.map((s) => `<li><a href="${s}">${capitalize(humanize(s))}</a></li>`).join('\n')}
</ul>
</body>
</html>`;

  await writeFile('docs/samples/index.html', out);
};

exports.buildUMDScript = async function buildUMDScript() {
  let data = '';

  await rimraf('packages/webex/umd/webex*');

  // reminder: samples:build calls this script, not webpack
  // hence we must call webpack here
  const [cmd, ...args] = `webpack --color ${
    process.env.NODE_ENV === 'development' ? '--mode development' : '--mode production'
  } --env umd`.split(' ');
  const webpack = spawn(cmd, args, {
    stdio: 'pipe',
    // Spawn fix for Windows
    shell: process.platform === 'win32',
  });

  webpack.stdout.on('data', (d) => {
    console.log(`webpack log:\n${d}`);
  });

  webpack.stderr.on('data', (d) => {
    data += d;
    console.log(`webpack log:\n${d}`);
  });

  webpack.on('close', (code) => {
    debug('child has completed');
    if (code) {
      const e = new Error(code);

      e.data = data;

      debug(e);
    }
  });
};
