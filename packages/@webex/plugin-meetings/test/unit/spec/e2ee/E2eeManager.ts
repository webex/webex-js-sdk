/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeManager from '@webex/plugin-meetings/src/e2ee/E2eeManager';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';
import {CapabilityState, WebCapabilities} from '@webex/web-capabilities';

describe('plugin-meetings', () => {
  describe('E2eeManager', () => {
    let supportsWasmStub;

    const makeWebex = (enableE2ee?: boolean, assetsBaseUrl = '/assets/plugin-meetings/') => ({
      config: {meetings: {enableE2ee, assetsBaseUrl}},
    });

    const makeWasmLoader = () => {
      const wasmLoader = sinon.createStubInstance(WasmLoader);
      wasmLoader.preload.resolves();

      return wasmLoader;
    };

    beforeEach(() => {
      supportsWasmStub = sinon
        .stub(WebCapabilities, 'supportsWasm')
        .returns(CapabilityState.CAPABLE);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('preload', () => {
      it('preloads the module from the configured assets directory when enabled and supported', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = new E2eeManager({
          webex: makeWebex(true, 'https://cdn.example.com/sdk/meetings/'),
          wasmLoader,
        });

        await manager.preload();

        assert.calledOnceWithExactly(
          wasmLoader.preload,
          'https://cdn.example.com/sdk/meetings/e2ee.wasm'
        );
      });

      it('does not preload when the feature is disabled', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = new E2eeManager({webex: makeWebex(false), wasmLoader});

        await manager.preload();

        assert.notCalled(wasmLoader.preload);
        assert.calledOnce(supportsWasmStub);
      });

      it('does not preload when WebAssembly is unsupported', async () => {
        supportsWasmStub.returns(CapabilityState.NOT_CAPABLE);
        const wasmLoader = makeWasmLoader();
        const manager = new E2eeManager({webex: makeWebex(true), wasmLoader});

        await manager.preload();

        assert.notCalled(wasmLoader.preload);
      });

      it('propagates preload errors for the registration caller to handle', async () => {
        const error = new Error('asset load failed');
        const wasmLoader = makeWasmLoader();
        wasmLoader.preload.rejects(error);
        const manager = new E2eeManager({webex: makeWebex(true), wasmLoader});

        await assert.isRejected(manager.preload(), /asset load failed/);
      });
    });
  });
});
