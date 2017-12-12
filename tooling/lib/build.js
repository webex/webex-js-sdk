/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

const debug = require('debug')('tooling:build');
const {
  exec,
  mkdirp,
  rimraf,
  transformFile
} = require('../lib/async');
const g = require('../lib/async').glob;
const path = require('path');
const {rename, writeFile} = require('fs-promise');
const {glob} = require('../util/package');
const S = require('string');

exports.buildFile = async function buildFile({src, dest}) {
  debug(`transforming ${src}`);
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
  const files = await glob('src/**/*.js', {packageName});
  debug('building files ', files);
  const mapped = files
    .map((filename) => path.join('packages', 'node_modules', packageName, filename))
    .map((filename) => ({
      src: filename,
      dest: filename.replace('src', 'dist')
    }));

  for (const file of mapped) {
    await exports.buildFile(file);
  }
};

exports.buildSamples = async function buildSamples() {
  await rimraf('packages/node_modules/samples/bundle*');
  // reminder: samples:build calls this script, not webpack, hence we must call
  // webpack here
  await exec('webpack');
  await rename('bundle.js', 'packages/node_modules/samples/bundle.js');
  await rename('bundle.js.map', 'packages/node_modules/samples/bundle.js.map');

  const samples = await g('browser-*', {cwd: path.resolve(process.cwd(), 'packages/node_modules/samples')});

  const out = `<!DOCTYPE html>
<html>
<head>
  <title>Samples</title>
</head><body>
<h1>Hosted Samples</h1>
<ul>
${samples.map((s) => `<li><a href="${s}">${S(s).humanize().capitalize().s}</a></li>`).join('\n')}
</ul>
</body>
</html>`;

  await writeFile('packages/node_modules/samples/index.html', out);
};
