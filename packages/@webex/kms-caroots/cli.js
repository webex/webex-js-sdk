#!/usr/bin/env node
/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-console */

const fs = require('fs');

const {generateKmsCaroots} = require('./index');

const HELP = `Generate the Webex KMS CA roots (Cisco Trusted Root Store Union bundle).

Usage:
  webex-kms-caroots [--out <path>]

Options:
  --out <path>   Write the JSON array to a file instead of stdout
  -h, --help     Show this help

Requires the 'openssl' binary on PATH. The output is an array of raw
base64-encoded certificates suitable for the SDK's encryption.caroots config.
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);

    return;
  }

  const outIndex = args.indexOf('--out');
  const out = outIndex === -1 ? undefined : args[outIndex + 1];

  const caroots = await generateKmsCaroots();
  const json = JSON.stringify(caroots);

  if (out) {
    fs.writeFileSync(out, json);
    console.error(`Wrote ${caroots.length} CA roots to ${out}`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error) => {
  console.error(`webex-kms-caroots: ${error.message}`);
  process.exit(1);
});
