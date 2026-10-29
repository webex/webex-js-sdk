#!/usr/bin/env node
/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-console */

const fs = require('fs');

const {generateKmsCaroots} = require('./index');

const HELP = `Generate the Webex KMS CA roots (Cisco Trusted Root Store Union bundle).

Usage:
  webex-kms-caroots [--in <path>] [--out <path>]

Options:
  --in <path>    Verify a local ios_union.p7b instead of downloading it from Cisco
  --out <path>   Write the JSON array to a file instead of stdout
  -h, --help     Show this help

The bundle signature is verified against the pinned Cisco TRS Bundle Root CA.
The output is an array of raw base64-encoded certificates suitable for the
SDK's encryption.caroots config.
`;

/**
 * Read the value of a `--name <value>` option.
 * @param {string[]} args
 * @param {string} name
 * @returns {string|undefined}
 */
function getOption(args, name) {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith('-')) {
    throw new Error(`${name} requires a file path`);
  }

  return value;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP);

    return;
  }

  const out = getOption(args, '--out');
  const input = getOption(args, '--in');

  const caroots = await generateKmsCaroots({input});
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
