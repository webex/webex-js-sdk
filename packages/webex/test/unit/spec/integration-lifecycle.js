/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
import {spawnSync} from 'child_process';
import path from 'path';
import {assert} from '@webex/test-helper-chai';

describe('Node integration fixture lifecycle', () => {
  it('exits naturally instead of looping on failed client metrics', () => {
    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../../integration/fixtures/metrics-exit.cjs')],
      {cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 5000}
    );

    assert.isUndefined(result.error, result.stdout + result.stderr);
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  }, 10000);
});
