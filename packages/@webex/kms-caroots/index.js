/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

const {webcrypto} = require('crypto');
const fs = require('fs');
const https = require('https');
const {URL} = require('url');

const {verifyUnionBundle, UnionBundleVerificationError, TRS_BUNDLE_ROOT_CA} = require('./verify');

const DEFAULT_BUNDLE_URL = 'https://www.cisco.com/security/pki/trs/current/ios_union/ios_union.p7b';
const DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;

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
          resolveDownload(
            download(new URL(res.headers.location, target).toString(), redirects + 1)
          );
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
 * Load the Cisco Union bundle, from a local file when `input` is set, otherwise
 * by downloading `bundleUrl`.
 * @param {{bundleUrl?: string, input?: string}} [options]
 * @returns {Promise<Uint8Array>}
 */
async function loadUnionBundle(options = {}) {
  if (options.input) {
    return new Uint8Array(fs.readFileSync(options.input));
  }

  return new Uint8Array(await downloadWithRetry(options.bundleUrl || DEFAULT_BUNDLE_URL));
}

/**
 * Load and verify the Cisco Trusted Root Store "Union" bundle and decode it
 * into the format expected by the `encryption.caroots` Webex SDK config
 * option: an array of raw base64-encoded (DER) certificates.
 *
 * @param {{bundleUrl?: string, input?: string, minBundleVersion?: number}} [options]
 * @returns {Promise<string[]>}
 */
async function generateKmsCaroots(options = {}) {
  const bundle = await loadUnionBundle(options);
  const {caroots} = await verifyUnionBundle(bundle, {
    crypto: webcrypto,
    minBundleVersion: options.minBundleVersion,
  });

  return caroots;
}

module.exports = {
  generateKmsCaroots,
  loadUnionBundle,
  verifyUnionBundle,
  UnionBundleVerificationError,
  TRS_BUNDLE_ROOT_CA,
  DEFAULT_BUNDLE_URL,
};
