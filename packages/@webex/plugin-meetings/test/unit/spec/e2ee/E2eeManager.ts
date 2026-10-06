/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeManager from '@webex/plugin-meetings/src/e2ee/E2eeManager';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';
import {E2EE_WASM_URL} from '@webex/plugin-meetings/src/e2ee/constants';
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
      config: {meetings: {enableE2ee}},
      request: sinon.stub().resolves({body: ''}),
    });
    const makeWasmLoader = () => {
      const wasmLoader = sinon.createStubInstance(WasmLoader);
      wasmLoader.preload.resolves();
      wasmLoader.get.resolves({});
      wasmLoader.isLoaded.returns(false);

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

    describe('isEnabled', () => {
      it('reflects webex.config.meetings.enableE2ee', () => {
        assert.isTrue(new E2eeManager({webex: makeWebex(true), wasmLoader: makeWasmLoader()}).isEnabled);
        assert.isFalse(new E2eeManager({webex: makeWebex(false), wasmLoader: makeWasmLoader()}).isEnabled);
        assert.isFalse(new E2eeManager({webex: makeWebex(), wasmLoader: makeWasmLoader()}).isEnabled);
      });

      it('disables E2EE when the browser cannot run WebAssembly', () => {
        supportsWasmStub.returns(CapabilityState.NOT_CAPABLE);

        assert.isFalse(new E2eeManager({webex: makeWebex(true), wasmLoader: makeWasmLoader()}).isEnabled);
      });
    });

    describe('preload', () => {
      it('warms the WASM module when enabled', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = new E2eeManager({webex: makeWebex(true), wasmLoader});

        await manager.preload();

        assert.calledOnceWithExactly(wasmLoader.preload, E2EE_WASM_URL);
      });

      it('does nothing when disabled', async () => {
        const wasmLoader = makeWasmLoader();
        const manager = new E2eeManager({webex: makeWebex(false), wasmLoader});

        await manager.preload();

        assert.notCalled(wasmLoader.preload);
      });
    });

    describe('createE2eeMeeting', () => {
      it('returns a per-meeting E2EE facade', () => {
        const manager = new E2eeManager({webex: makeWebex(true), wasmLoader: makeWasmLoader()});
        const meeting = {
          members: {
            membersCollection: {get: () => undefined},
            setMembersUpdateProcessor: () => {},
            reportMembersUpdated: () => {},
          },
        };

        const e2eeMeeting = manager.createE2eeMeeting(meeting);

        assert.isDefined(e2eeMeeting);
        assert.equal(e2eeMeeting.state, 'disabled');
        assert.isTrue(e2eeMeeting.isEnabled);
      });
    });
  });
});
