/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeManager from '@webex/plugin-meetings/src/e2ee/E2eeManager';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';
import {E2EE_WASM_ASSET} from '@webex/plugin-meetings/src/e2ee/constants';
import {CapabilityState, WebCapabilities} from '@webex/web-capabilities';

describe('plugin-meetings', () => {
  describe('E2eeManager', () => {
    let supportsWasmStub;

    const makeWebex = (enableE2ee?: boolean) => ({
      internal: {
        device: {},
        identity: {
          getCredentials: sinon.stub(),
          getTrustAnchors: sinon.stub(),
        },
      },
      config: {meetings: {enableE2ee, assetsBaseUrl: '/assets/plugin-meetings/'}},
      request: sinon.stub().resolves({body: ''}),
    });
    const makeWasmLoader = () => {
      const wasmLoader = sinon.createStubInstance(WasmLoader);
      wasmLoader.preload.resolves();
      wasmLoader.get.resolves({});
      wasmLoader.isLoaded.returns(false);

      return wasmLoader;
    };
    const wasmUrl = `/assets/plugin-meetings/${E2EE_WASM_ASSET}`;
    const makeManager = (enableE2ee?: boolean, wasmLoader = makeWasmLoader()) =>
      new E2eeManager({webex: makeWebex(enableE2ee), wasmLoader, wasmUrl});

    beforeEach(() => {
      supportsWasmStub = sinon
        .stub(WebCapabilities, 'supportsWasm')
        .returns(CapabilityState.CAPABLE);
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('isEnabled', () => {
      it('reflects webex.config.meetings.enableE2ee', () => {
        assert.isTrue(makeManager(true).isEnabled);
        assert.isFalse(makeManager(false).isEnabled);
        assert.isFalse(makeManager().isEnabled);
      });

      it('disables E2EE when the browser cannot run WebAssembly', () => {
        supportsWasmStub.returns(CapabilityState.NOT_CAPABLE);

        assert.isFalse(makeManager(true).isEnabled);
      });
    });

    describe('preload', () => {
      it('warms the WASM module when enabled', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = makeManager(true, wasmLoader);

        await manager.preload();

        assert.calledOnceWithExactly(wasmLoader.preload, wasmUrl);
      });

      it('does nothing when disabled', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = makeManager(false, wasmLoader);

        await manager.preload();

        assert.notCalled(wasmLoader.preload);
      });
    });

    describe('createE2eeController', () => {
      it('returns a per-meeting E2EE controller', () => {
        const manager = makeManager(true);
        const context = {
          correlationId: 'correlation-id',
          getLocusInfo: () => undefined,
          getLlmChannel: () => undefined,
          members: {
            selfId: 'self-id',
            membersCollection: {get: () => undefined},
            setMembersUpdateProcessor: () => {},
            reportMembersUpdated: () => {},
          },
        } as any;

        const e2eeController = manager.createE2eeController(context);

        assert.isDefined(e2eeController);
        assert.equal(e2eeController.state, 'disabled');
        assert.isTrue(e2eeController.isEnabled);
      });
    });
  });
});
