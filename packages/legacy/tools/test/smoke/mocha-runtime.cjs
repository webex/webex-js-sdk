const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

// This checks process startup, separately from Jasmine's instrumented tests.
// Running it beneath NYC mixes differently Babel-transformed copies of the
// tooling into one coverage map and discards counters from the real tests.
const fixture = resolve(__dirname, '../integration/mocha/fixtures/runtime.js');
const result = spawnSync(
  process.execPath,
  ['-e', 'require("@webex/legacy-tools").Mocha.test({files: [process.argv[1]]});', fixture],
  {
    cwd: resolve(__dirname, '../../../../webex'),
    encoding: 'utf8',
    timeout: 30000,
  },
);

assert.ifError(result.error);
assert.equal(result.status, 0, result.stdout + result.stderr);
assert.match(result.stdout, /1 passing/);
console.log('Mocha startup smoke check passed with hoisted runtime dependencies.');
