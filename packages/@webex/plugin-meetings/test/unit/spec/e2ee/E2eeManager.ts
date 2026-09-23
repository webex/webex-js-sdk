/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeManager from '@webex/plugin-meetings/src/e2ee/E2eeManager';
import WasmLoader from '@webex/plugin-meetings/src/e2ee/WasmLoader';

describe('plugin-meetings', () => {
  describe('E2eeManager', () => {
    let preloadStub;

    beforeEach(() => {
      preloadStub = sinon.stub(WasmLoader.prototype, 'preload').resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('isEnabled', () => {
      it('reflects config.enableE2ee', () => {
        assert.isTrue(new E2eeManager({config: {enableE2ee: true}}).isEnabled);
        assert.isFalse(new E2eeManager({config: {enableE2ee: false}}).isEnabled);
        assert.isFalse(new E2eeManager({config: {}}).isEnabled);
      });
    });

    describe('preload', () => {
      it('warms the WASM module when enabled', async () => {
        const manager = new E2eeManager({config: {enableE2ee: true}});

        await manager.preload();

        assert.calledOnce(preloadStub);
      });

      it('does nothing when disabled', async () => {
        const manager = new E2eeManager({config: {enableE2ee: false}});

        await manager.preload();

        assert.notCalled(preloadStub);
      });
    });
  });
});
