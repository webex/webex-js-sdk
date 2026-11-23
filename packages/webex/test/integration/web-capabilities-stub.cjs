/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

// TEMPORARY: see run-node.cjs. Never use this stub in runtime or browser code.
const Module = require('node:module');

const filename = require.resolve('@webex/web-capabilities', {
  paths: [require.resolve('@webex/plugin-meetings')],
});
const CapabilityState = {
  CAPABLE: 'capable',
  NOT_CAPABLE: 'not capable',
  UNKNOWN: 'unknown',
};
const unknown = () => CapabilityState.UNKNOWN;
const notBrowser = () => false;
const stub = new Module(filename);

stub.filename = filename;
stub.loaded = true;
stub.exports = {
  CapabilityState,
  WebCapabilities: {
    isCapableOfBackgroundNoiseRemoval: unknown,
    isCapableOfVirtualBackground: unknown,
    isCapableOfReceiving1080pVideo: unknown,
    isCapableOfSending1080pVideo: unknown,
    isCapableOfReceivingVideoCodec: unknown,
    supportsEncodedStreamTransforms: unknown,
    supportsEncodingCodec: unknown,
    supportsWasm: unknown,
    supportsWorker: () => CapabilityState.NOT_CAPABLE,
    supportsRTCPeerConnection: () => CapabilityState.NOT_CAPABLE,
  },
  BrowserInfo: {
    isChrome: notBrowser,
    isEdge: notBrowser,
    isFirefox: notBrowser,
    isSafari: notBrowser,
  },
  WasmRuntimeProbe: {
    check: async () => ({
      status: 'unknown',
      capability: CapabilityState.UNKNOWN,
      reason: 'worker_unavailable',
      measurements: null,
    }),
  },
};

require.cache[filename] = stub;
