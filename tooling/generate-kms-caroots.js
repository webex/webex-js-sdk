#!/usr/bin/env node
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-console */

/**
 * Downloads, verifies, and decodes the Cisco Trusted Root Store "Union" bundle
 * into the format expected by the `encryption.caroots` SDK config option: an
 * array of raw base64-encoded (DER) certificates.
 *
 * The bundle is intentionally NOT committed to the package. Consuming apps (and
 * this repo's CI) run this tool to produce a fresh list so certificate updates
 * don't require an SDK upgrade. See the Cisco Trusted Root Store for details:
 * https://www.cisco.com/security/pki/trs/readme.html
 *
 * Usage:
 *   node tooling/generate-kms-caroots.js                # writes ./.kms-caroots.json
 *   node tooling/generate-kms-caroots.js --stdout       # prints JSON to stdout
 *   node tooling/generate-kms-caroots.js --out roots.json
 *   node tooling/generate-kms-caroots.js --url <bundle> # override bundle URL
 *
 * Requires the `openssl` binary on PATH (used to verify the signed PKCS#7
 * bundle and extract its certificates, as documented by Cisco).
 */

const crypto = require('crypto');
const {execFileSync} = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {URL} = require('url');

const DEFAULT_BUNDLE_URL =
  'https://www.cisco.com/security/pki/trs/current/ios_union/ios_union.p7b';

// Trust anchors used to verify the signed bundle. Pinned by SHA-256 of the DER
// certificate so a compromised or swapped anchor is rejected. New-style bundles
// chain to the TRS Bundle Root CA; older bundles chain to Cisco Root CA M1.
const TRUST_ANCHORS = [
  {
    name: 'Cisco TRS Bundle Root CA',
    url: 'https://www.cisco.com/security/pki/certs/tbrca.pem',
    fingerprint:
      'DE:C6:69:E3:22:E0:7C:D7:C6:0A:56:90:4B:F5:0C:29:FA:1E:75:07:17:23:FC:10:35:77:E2:7B:22:69:68:D5',
  },
  {
    name: 'Cisco Root CA M1',
    url: 'https://www.cisco.com/security/pki/certs/crcam1.pem',
    fingerprint:
      '70:5E:AA:FC:3F:F4:88:03:00:17:D5:98:32:60:3E:EF:AD:51:41:71:B5:83:80:86:75:F4:5C:19:0E:63:78:F8',
  },
];

const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;

function parseArgs(argv) {
  const options = {bundleUrl: DEFAULT_BUNDLE_URL, out: '.kms-caroots.json', stdout: false, verbose: false};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--stdout':
        options.stdout = true;
        break;
      case '--out':
        options.out = argv[(i += 1)];
        break;
      case '--url':
        options.bundleUrl = argv[(i += 1)];
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

// Log to stderr so `--stdout` emits only the JSON payload.
function log(verbose, ...args) {
  if (verbose) {
    console.error(...args);
  }
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers: {'user-agent': 'webex-js-sdk-kms-caroots'}}, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(download(new URL(res.headers.location, url).toString()));

          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));

          return;
        }

        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function pemToDer(pem) {
  return Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
}

function fingerprintOf(der) {
  return crypto
    .createHash('sha256')
    .update(der)
    .digest('hex')
    .toUpperCase()
    .match(/../g)
    .join(':');
}

function ensureOpenssl() {
  try {
    execFileSync('openssl', ['version'], {stdio: 'ignore'});
  } catch (error) {
    throw new Error(
      "The 'openssl' binary is required to verify and decode the Cisco bundle but was not found on PATH."
    );
  }
}

async function fetchVerifiedAnchors(verbose) {
  const pems = [];

  for (const anchor of TRUST_ANCHORS) {
    const pem = (await download(anchor.url)).toString('utf8');
    const actual = fingerprintOf(pemToDer(pem));

    if (actual !== anchor.fingerprint) {
      throw new Error(
        `Trust anchor fingerprint mismatch for ${anchor.name}.\n  expected: ${anchor.fingerprint}\n  actual:   ${actual}`
      );
    }

    log(verbose, `Verified trust anchor: ${anchor.name}`);
    pems.push(pem.trim());
  }

  return pems.join('\n');
}

// Verifies the signed bundle against the pinned anchors and returns the
// contained certificates as PEM using the openssl pipeline documented by Cisco.
function verifyAndExtract(workDir, bundle, anchorsPem) {
  const bundlePath = path.join(workDir, 'bundle.p7b');
  const anchorsPath = path.join(workDir, 'anchors.pem');
  const contentPath = path.join(workDir, 'content.der');

  fs.writeFileSync(bundlePath, bundle);
  fs.writeFileSync(anchorsPath, anchorsPem);

  execFileSync('openssl', [
    'cms',
    '-verify',
    '-inform',
    'DER',
    '-purpose',
    'any',
    '-in',
    bundlePath,
    '-CAfile',
    anchorsPath,
    '-out',
    contentPath,
  ]);

  return execFileSync('openssl', [
    'pkcs7',
    '-inform',
    'DER',
    '-print_certs',
    '-outform',
    'PEM',
    '-in',
    contentPath,
  ]).toString('utf8');
}

function decodeCertificates(certsPem) {
  const seen = new Set();
  const caroots = [];
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = PEM_CERT_RE.exec(certsPem))) {
    const base64 = match[1].replace(/\s+/g, '');

    if (!base64 || seen.has(base64)) {
      continue;
    }

    const der = Buffer.from(base64, 'base64');

    // A valid X.509 certificate is a DER SEQUENCE (tag 0x30).
    if (der.length === 0 || der[0] !== 0x30) {
      throw new Error('Extracted a certificate that is not valid DER');
    }

    seen.add(base64);
    caroots.push(base64);
  }

  if (caroots.length === 0) {
    throw new Error('No certificates were extracted from the bundle');
  }

  return caroots;
}

async function generate(options) {
  ensureOpenssl();

  log(options.verbose, `Downloading bundle: ${options.bundleUrl}`);
  const bundle = await download(options.bundleUrl);

  const anchorsPem = await fetchVerifiedAnchors(options.verbose);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kms-caroots-'));

  try {
    const certsPem = verifyAndExtract(workDir, bundle, anchorsPem);
    const caroots = decodeCertificates(certsPem);

    log(options.verbose, `Verified bundle and extracted ${caroots.length} certificates`);

    return caroots;
  } finally {
    fs.rmSync(workDir, {recursive: true, force: true});
  }
}

const HELP = `Generate the KMS CA roots (Cisco Trusted Root Store Union bundle).

Usage:
  node tooling/generate-kms-caroots.js [options]

Options:
  --stdout        Print the JSON array to stdout instead of writing a file
  --out <path>    Output file path (default: .kms-caroots.json)
  --url <url>     Override the bundle URL
  -v, --verbose   Log progress to stderr
  -h, --help      Show this help
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(HELP);

    return;
  }

  const caroots = await generate(options);
  const json = JSON.stringify(caroots);

  if (options.stdout) {
    process.stdout.write(json);
  } else {
    fs.writeFileSync(options.out, json);
    console.error(`Wrote ${caroots.length} CA roots to ${options.out}`);
  }
}

main().catch((error) => {
  console.error(`generate-kms-caroots: ${error.message}`);
  process.exit(1);
});
