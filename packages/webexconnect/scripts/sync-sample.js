/* eslint-disable no-console */
// Copies the built SDK bundles from this package's `dist/` into the Webex Connect
// sample app so the sample consumes the single canonical build instead of keeping
// its own vendored copy of the SDK source. Run automatically after `build:src`.
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const sampleDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'samples',
  'webexconnect'
);

const ARTIFACTS = [
  'webex-connect-sdk.min.js',
  'webex-connect-sdk.min.js.map',
  'sw.min.js',
  'sw.min.js.map',
];

if (!fs.existsSync(sampleDir)) {
  console.warn(
    `[sync-sample] sample dir not found (${sampleDir}); skipping SDK copy.`
  );
  process.exit(0);
}

ARTIFACTS.forEach((name) => {
  const from = path.join(distDir, name);
  const to = path.join(sampleDir, name);
  if (!fs.existsSync(from)) {
    console.error(`[sync-sample] missing build artifact: ${from}`);
    process.exit(1);
  }
  fs.copyFileSync(from, to);
  console.log(`[sync-sample] ${name} -> docs/samples/webexconnect/`);
});
