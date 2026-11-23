/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

/*
 * TEMPORARY WORKAROUND — NODE INTEGRATION TESTS ONLY
 *
 * @webex/web-capabilities@1.13.1 reads window during module initialization
 * (BrowserInfo and SystemInfo), so importing webex crashes in plain Node.
 * Meetings also loads internal-media-core, which reads window during import.
 * Contact Center imports the same media dependency. Stub those browser plugins'
 * registrations as well; only the Meetings namespace is needed by this suite's
 * CommonJS smoke test. NO MEETINGS, CONTACT CENTER OR MEDIA BEHAVIOR IS TESTED.
 * Install the stubs BEFORE loading the runner or SDK. Do not add browser globals:
 * these tests must continue exercising the Node authentication and HTTP paths.
 *
 * This bypasses real capability detection; it does NOT demonstrate that the
 * published Meetings plugin works in Node. Browser tests use the real library.
 * Remove this wrapper and stub, and restore the direct test:integration command,
 * once the real dependency chain supports import in Node without browser globals.
 */
const Module = require('node:module');

const toolsRequire = Module.createRequire(require.resolve('@webex/legacy-tools'));

toolsRequire('@webex/env-config-legacy');
require('./web-capabilities-stub.cjs');
const {registerPlugin, WebexPlugin} = require('@webex/webex-core');

for (const [name, plugin] of [
  ['meetings', '@webex/plugin-meetings'],
  ['cc', '@webex/contact-center'],
]) {
  const stub = new Module(require.resolve(plugin));
  stub.loaded = true;
  stub.exports = {temporaryNodeIntegrationStub: true};
  require.cache[stub.id] = stub;
  registerPlugin(name, WebexPlugin.extend({namespace: name}));
}

console.warn(
  'TEMPORARY NODE INTEGRATION WORKAROUND: web-capabilities, Meetings and Contact Center are stubbed. ' +
    'These tests do not validate real Meetings/Contact Center/media behavior or Node compatibility.'
);
toolsRequire('@webex/legacy-tools/cli');
