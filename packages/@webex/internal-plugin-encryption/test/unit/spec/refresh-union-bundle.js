/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {spawnSync} from 'child_process';
import fs from 'fs';
import path from 'path';

import {assert} from '@webex/test-helper-chai';

const packageRoot = path.resolve(__dirname, '../../..');
const fixture = fs.readFileSync(
  path.join(packageRoot, '../test-helper-server/static/ios_union.p7b')
);
const FIXTURE_VERSION = 20261022;
const assetName = `ios_union-${FIXTURE_VERSION}.p7b`;

describe('refresh-union-bundle', () => {
  let directory;
  let constantsPath;
  let inputPath;
  let scriptPath;

  const refresh = () =>
    spawnSync(process.execPath, [scriptPath, '--in', inputPath], {encoding: 'utf8'});
  const seedBundle = (previousAsset, version) => {
    fs.writeFileSync(path.join(directory, 'assets', previousAsset), 'previous bundle');
    fs.writeFileSync(
      constantsPath,
      `export const UNION_BUNDLE_ASSET = '${previousAsset}';\n` +
        `export const UNION_BUNDLE_VERSION = ${version};\n`
    );
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(packageRoot, '.refresh-union-bundle-'));
    constantsPath = path.join(directory, 'src/union-bundle.js');
    inputPath = path.join(directory, 'download.p7b');
    scriptPath = path.join(directory, 'scripts/refresh-union-bundle.js');
    ['assets', 'src', 'scripts'].forEach((name) => {
      fs.mkdirSync(path.join(directory, name));
    });
    fs.copyFileSync(path.join(packageRoot, 'scripts/refresh-union-bundle.js'), scriptPath);
    fs.writeFileSync(inputPath, fixture);
  });

  afterEach(() => {
    fs.rmSync(directory, {recursive: true, force: true});
  });

  ['ios_union.p7b', 'ios_union-20261021.p7b'].forEach((previousAsset) => {
    it(`generates the signed version's filename and replaces ${previousAsset}`, () => {
      seedBundle(previousAsset, 20261021);
      fs.writeFileSync(path.join(directory, 'assets/other.p7b'), 'unrelated bundle');

      const result = refresh();

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readFileSync(path.join(directory, 'assets', assetName)), fixture);
      assert.include(fs.readFileSync(constantsPath, 'utf8'), `UNION_BUNDLE_ASSET = '${assetName}'`);
      assert.include(
        fs.readFileSync(constantsPath, 'utf8'),
        `UNION_BUNDLE_VERSION = ${FIXTURE_VERSION}`
      );
      assert.isFalse(fs.existsSync(path.join(directory, 'assets', previousAsset)));
      assert.equal(
        fs.readFileSync(path.join(directory, 'assets/other.p7b'), 'utf8'),
        'unrelated bundle'
      );
      assert.include(result.stdout, assetName);
    });
  });

  it('reproduces the same asset and constants when refreshed again', () => {
    const first = refresh();

    assert.equal(first.status, 0, first.stderr);
    const constants = fs.readFileSync(constantsPath, 'utf8');
    const second = refresh();

    assert.equal(second.status, 0, second.stderr);
    assert.equal(fs.readFileSync(constantsPath, 'utf8'), constants);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'assets', assetName)), fixture);
    assert.deepEqual(fs.readdirSync(path.join(directory, 'assets')), [assetName]);
  });

  [
    {title: 'a tampered signature', version: 20261021, tamper: true, reason: /signature/i},
    {title: 'a downgrade', version: 20261023, tamper: false, reason: /older than 20261023/},
  ].forEach(({title, version, tamper, reason}) => {
    it(`preserves the shipped asset and constants when rejecting ${title}`, () => {
      const previousAsset = `ios_union-${version}.p7b`;

      seedBundle(previousAsset, version);
      const constants = fs.readFileSync(constantsPath, 'utf8');

      if (tamper) {
        const bytes = Buffer.from(fixture);

        bytes[2000] = (bytes[2000] + 1) % 256;
        fs.writeFileSync(inputPath, bytes);
      }

      const result = refresh();

      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, reason);
      assert.equal(fs.readFileSync(constantsPath, 'utf8'), constants);
      assert.equal(
        fs.readFileSync(path.join(directory, 'assets', previousAsset), 'utf8'),
        'previous bundle'
      );
      assert.deepEqual(fs.readdirSync(path.join(directory, 'assets')), [previousAsset]);
    });
  });
});
