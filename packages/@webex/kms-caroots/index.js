/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

const crypto = require('crypto');
const {execFileSync, spawnSync} = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const {URL} = require('url');

const DEFAULT_BUNDLE_URL =
  'https://www.cisco.com/security/pki/trs/current/ios_union/ios_union.p7b';
const DEFAULT_MOZILLA_BUNDLE_URL =
  'https://hg.mozilla.org/projects/nss/raw-file/tip/lib/ckfw/builtins/certdata.txt';
const DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;

// Trust anchors used to verify the signed bundle, pinned by the SHA-256 of the
// DER certificate so a compromised or swapped anchor is rejected. New-style
// bundles chain to the TRS Bundle Root CA; older bundles chain to Cisco Root CA M1.
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

/**
 * Download a URL, following redirects.
 * @param {string} url
 * @param {number} [redirects]
 * @returns {Promise<Buffer>}
 */
function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);

    if (target.protocol !== 'https:') {
      reject(new Error(`Cannot download CA roots from a non-HTTPS URL: ${url}`));

      return;
    }

    let timeout;
    const resolveDownload = (value) => {
      clearTimeout(timeout);
      resolve(value);
    };
    const rejectDownload = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
    const request = https.get(target, {headers: {'user-agent': 'webex-kms-caroots'}}, (res) => {
      res.on('error', rejectDownload);
      res.on('close', () => {
        if (!res.complete) {
          rejectDownload(new Error(`Download from ${url} ended before the response was complete`));
        }
      });

      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();

        if (redirects >= MAX_REDIRECTS) {
          rejectDownload(new Error(`Too many redirects downloading ${url}`));

          return;
        }

        try {
          resolveDownload(download(new URL(res.headers.location, target).toString(), redirects + 1));
        } catch (error) {
          rejectDownload(error);
        }

        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        rejectDownload(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));

        return;
      }

      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolveDownload(Buffer.concat(chunks)));
    });

    request.on('error', rejectDownload);
    timeout = setTimeout(() => {
      const error = new Error(`Timed out downloading ${url} after ${DOWNLOAD_TIMEOUT_MS} ms`);

      rejectDownload(error);
      request.destroy(error);
    }, DOWNLOAD_TIMEOUT_MS);
  });
}

/**
 * Download a URL with retries to tolerate transient network errors.
 * @param {string} url
 * @param {number} [attempts]
 * @returns {Promise<Buffer>}
 */
async function downloadWithRetry(url, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await download(url);
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Convert a PEM certificate to its DER Buffer.
 * @param {string} pem
 * @returns {Buffer}
 */
function pemToDer(pem) {
  return Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
}

/**
 * Compute the colon-delimited SHA-256 fingerprint of a DER certificate.
 * @param {Buffer} der
 * @returns {string}
 */
function fingerprintOf(der) {
  return crypto
    .createHash('sha256')
    .update(der)
    .digest('hex')
    .toUpperCase()
    .match(/../g)
    .join(':');
}

/**
 * Ensure the `openssl` binary is available.
 * @returns {void}
 */
function ensureOpenssl() {
  try {
    execFileSync('openssl', ['version'], {stdio: 'ignore'});
  } catch (error) {
    throw new Error(
      "The 'openssl' binary is required to verify and decode the Cisco bundle but was not found on PATH."
    );
  }
}

/**
 * Disable OpenSSL's default trust locations while keeping the pinned CA file.
 * OpenSSL 1.1.1 has no CA store option, so include it only when supported.
 * @param {string} workDir
 * @returns {string[]}
 */
function cmsTrustOptions(workDir) {
  const {error, stdout, stderr} = spawnSync('openssl', ['cms', '-help'], {encoding: 'utf8'});

  if (error) {
    throw error;
  }

  const help = `${stdout || ''}${stderr || ''}`;

  if (!help.includes('-no-CAfile') || !help.includes('-no-CApath')) {
    const {stdout: version} = spawnSync('openssl', ['version'], {encoding: 'utf8'});

    if (!version.startsWith('LibreSSL ')) {
      throw new Error('OpenSSL cms cannot disable its default CA file and directory');
    }

    const emptyCaPath = path.join(workDir, 'empty-ca-path');

    fs.mkdirSync(emptyCaPath);

    return ['-CApath', emptyCaPath];
  }

  return ['-no-CAfile', '-no-CApath', ...(help.includes('-no-CAstore') ? ['-no-CAstore'] : [])];
}

/**
 * Download the pinned trust anchors and verify their fingerprints.
 * @returns {Promise<string>} concatenated anchor PEMs
 */
async function fetchVerifiedAnchors() {
  const pems = [];

  for (const anchor of TRUST_ANCHORS) {
    // eslint-disable-next-line no-await-in-loop
    const pem = (await downloadWithRetry(anchor.url)).toString('utf8');
    const actual = fingerprintOf(pemToDer(pem));

    if (actual !== anchor.fingerprint) {
      throw new Error(
        `Trust anchor fingerprint mismatch for ${anchor.name}.\n  expected: ${anchor.fingerprint}\n  actual:   ${actual}`
      );
    }

    pems.push(pem.trim());
  }

  return pems.join('\n');
}

/**
 * Verify the signed bundle against the anchors and return the contained
 * certificates as PEM, using the openssl pipeline documented by Cisco.
 * @param {string} workDir
 * @param {Buffer} bundle
 * @param {string} anchorsPem
 * @returns {string}
 */
function verifyAndExtract(workDir, bundle, anchorsPem) {
  const bundlePath = path.join(workDir, 'bundle.p7b');
  const anchorsPath = path.join(workDir, 'anchors.pem');
  const contentPath = path.join(workDir, 'content.der');

  fs.writeFileSync(bundlePath, bundle);
  fs.writeFileSync(anchorsPath, anchorsPem);

  execFileSync(
    'openssl',
    [
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
      ...cmsTrustOptions(workDir),
      '-out',
      contentPath,
    ],
    {stdio: ['ignore', 'ignore', 'ignore']}
  );

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

/**
 * Decode extracted PEM certificates into an array of raw base64 (DER) strings.
 * @param {string} certsPem
 * @returns {string[]}
 */
function decodeCertificates(certsPem) {
  const seen = new Set();
  const caroots = [];
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = PEM_CERT_RE.exec(certsPem))) {
    const base64 = match[1].replace(/\s+/g, '');

    // eslint-disable-next-line no-continue
    if (!base64 || seen.has(base64)) continue;

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

/**
 * Decode an NSS MULTILINE_OCTAL value into raw base64 (DER).
 * @param {string} value
 * @returns {string}
 */
function decodeMozillaOctal(value) {
  const bytes = [];
  const unexpected = value.replace(/\\([0-7]{3})/g, (match, octal) => {
    bytes.push(parseInt(octal, 8));

    return '';
  });

  if (unexpected.trim()) {
    throw new Error('Mozilla certdata contains an invalid MULTILINE_OCTAL value');
  }

  return Buffer.from(bytes).toString('base64');
}

/**
 * Extract certificates trusted by Mozilla for TLS server authentication.
 * @param {string} certdata
 * @returns {string[]}
 */
function decodeMozillaCertificates(certdata) {
  const certificates = new Map();
  const trustedLabels = new Set();
  const objects = certdata.split(/(?=^CKA_CLASS )/m);

  objects.forEach((object) => {
    const label = object.match(/^CKA_LABEL UTF8 (.+)$/m)?.[1];

    if (!label) {
      return;
    }

    if (object.startsWith('CKA_CLASS CK_OBJECT_CLASS CKO_CERTIFICATE')) {
      const value = object.match(/^CKA_VALUE MULTILINE_OCTAL\n([\s\S]*?)^END$/m)?.[1];

      if (value) {
        certificates.set(label, decodeMozillaOctal(value));
      }
    } else if (
      object.startsWith('CKA_CLASS CK_OBJECT_CLASS CKO_NSS_TRUST') &&
      /^CKA_TRUST_SERVER_AUTH CK_TRUST CKT_NSS_TRUSTED_DELEGATOR$/m.test(object)
    ) {
      trustedLabels.add(label);
    }
  });

  const trustedCertificates = [...trustedLabels]
    .map((label) => certificates.get(label))
    .filter(Boolean);

  if (trustedCertificates.length === 0) {
    throw new Error('No TLS server CA certificates were extracted from Mozilla certdata');
  }

  return trustedCertificates;
}

/**
 * Keep only Cisco Union roots that Mozilla also trusts for TLS servers.
 * @param {string[]} unionCertificates
 * @param {string[]} mozillaCertificates
 * @returns {string[]}
 */
function filterToMozillaRoots(unionCertificates, mozillaCertificates) {
  const mozillaRoots = new Set(mozillaCertificates);
  const filtered = unionCertificates.filter((certificate) => mozillaRoots.has(certificate));

  if (filtered.length === 0) {
    throw new Error('Cisco Union and Mozilla trust stores contain no matching CA roots');
  }

  return filtered;
}

/**
 * Download, verify, and decode the Cisco Trusted Root Store "Union" bundle into
 * the format expected by the `encryption.caroots` Webex SDK config option: an
 * array of raw base64-encoded (DER) certificates.
 *
 * Requires the `openssl` binary on PATH.
 *
 * @param {{bundleUrl?: string, mozillaBundleUrl?: string}} [options]
 * @returns {Promise<string[]>}
 */
async function generateKmsCaroots(options = {}) {
  const bundleUrl = options.bundleUrl || DEFAULT_BUNDLE_URL;
  const mozillaBundleUrl = options.mozillaBundleUrl || DEFAULT_MOZILLA_BUNDLE_URL;

  ensureOpenssl();

  const [bundle, mozillaBundle, anchorsPem] = await Promise.all([
    downloadWithRetry(bundleUrl),
    downloadWithRetry(mozillaBundleUrl),
    fetchVerifiedAnchors(),
  ]);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kms-caroots-'));

  try {
    const certsPem = verifyAndExtract(workDir, bundle, anchorsPem);
    const unionCertificates = decodeCertificates(certsPem);
    const mozillaCertificates = decodeMozillaCertificates(mozillaBundle.toString('utf8'));

    return filterToMozillaRoots(unionCertificates, mozillaCertificates);
  } finally {
    fs.rmSync(workDir, {recursive: true, force: true});
  }
}

module.exports = {
  __esModule: true,
  default: require('./caroots'),
  generateKmsCaroots,
  DEFAULT_BUNDLE_URL,
  DEFAULT_MOZILLA_BUNDLE_URL,
};
