#!/usr/bin/env node
/*!
 * Bundles the SDK for the two samples under `docs/samples/`.
 *
 * Only the SDK is bundled: the sample scripts themselves stay plain, readable classic
 * scripts, exactly as the other samples in this repo load `../<name>.min.js` and then
 * `app.js`. Four IIFE bundles are produced because the four contexts (page, content
 * script, service worker, popup) each get their own least-privilege slice of the SDK.
 *
 * esbuild rather than the root webpack build: the root build is slow, produces UMD
 * bundles for the whole SDK, and none of that is needed to hand a browser one global.
 */

import {mkdir, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import esbuild from 'esbuild';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const samplesRoot = resolve(packageRoot, '../../../docs/samples');
const webVendor = resolve(samplesRoot, 'web-extension-bridge/vendor');
const extensionVendor = resolve(samplesRoot, 'web-extension-bridge-extension/vendor');

/**
 * `globalName` is omitted for the content script: loading that bundle starts the relay
 * as its side effect, so there is no entry point for anyone to call.
 *
 * The page bundle is built from the package root, which is the page API. The two
 * privileged bundles are built from their individual source modules rather than the
 * `extension` facade, so each context still ships only its own slice — a popup bundle
 * that also contained the service-worker bridge would be a larger attack surface than
 * the popup needs, whatever tree-shaking might have done.
 */
const bundles = [
  {
    entry: resolve(packageRoot, 'src/index.ts'),
    outfile: resolve(webVendor, 'web-extension-bridge-web.js'),
    globalName: 'WebExtensionBridge',
  },
  {
    entry: resolve(packageRoot, 'src/content-script.ts'),
    outfile: resolve(extensionVendor, 'web-extension-bridge-content.js'),
  },
  {
    entry: resolve(packageRoot, 'src/extension/background.ts'),
    outfile: resolve(extensionVendor, 'web-extension-bridge-background.js'),
    globalName: 'WebExtensionBridgeBackground',
  },
  {
    entry: resolve(packageRoot, 'src/extension/client.ts'),
    outfile: resolve(extensionVendor, 'web-extension-bridge-client.js'),
    globalName: 'WebExtensionBridgeClient',
  },
];

/**
 * Builds one bundle.
 *
 * Left unminified on purpose: a sample that demonstrates a trust boundary should be
 * readable by whoever is auditing the trust boundary.
 *
 * @param {{entry: string, outfile: string, globalName?: string}} bundle - Bundle spec.
 * @returns {Promise<void>} Resolves once written.
 */
async function build(bundle) {
  await esbuild.build({
    entryPoints: [bundle.entry],
    outfile: bundle.outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome116'],
    legalComments: 'none',
    logLevel: 'warning',
    ...(bundle.globalName ? {globalName: bundle.globalName} : {}),
  });

  process.stdout.write(`built ${bundle.outfile.replace(`${samplesRoot}/`, '')}\n`);
}

await Promise.all([rm(webVendor, {recursive: true, force: true}), rm(extensionVendor, {recursive: true, force: true})]);
await Promise.all([mkdir(webVendor, {recursive: true}), mkdir(extensionVendor, {recursive: true})]);
await Promise.all(bundles.map(build));
