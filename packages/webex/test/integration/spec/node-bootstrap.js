/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import {nodeOnly} from '@webex/test-helper-mocha';

// TEMPORARY: validates the Node-only workaround, not real media capabilities.
nodeOnly(describe)('temporary Node integration bootstrap', () => {
  it('keeps browser globals absent and marks browser plugins as stubbed', () => {
    assert.isUndefined(global.window);
    assert.isUndefined(global.document);
    // eslint-disable-next-line global-require
    assert.isTrue(require('@webex/plugin-meetings').temporaryNodeIntegrationStub);
    // eslint-disable-next-line global-require
    assert.isTrue(require('@webex/contact-center').temporaryNodeIntegrationStub);
  });

  it('reports unavailable browser workers without loading the real capability library', async () => {
    // eslint-disable-next-line global-require
    const filename = require.resolve('@webex/web-capabilities', {
      paths: [require.resolve('@webex/plugin-meetings')],
    });
    const {CapabilityState, WebCapabilities, WasmRuntimeProbe} = require.cache[filename].exports;

    assert.equal(WebCapabilities.supportsRTCPeerConnection(), CapabilityState.NOT_CAPABLE);
    assert.equal(
      WebCapabilities.isCapableOfReceivingVideoCodec('video/H264'),
      CapabilityState.UNKNOWN
    );
    assert.deepEqual(await WasmRuntimeProbe.check(), {
      status: 'unknown',
      capability: CapabilityState.UNKNOWN,
      reason: 'worker_unavailable',
      measurements: null,
    });
  });
});
