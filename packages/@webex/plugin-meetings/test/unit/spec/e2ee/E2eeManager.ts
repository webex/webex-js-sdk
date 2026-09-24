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
    const makeWebex = (enableE2ee?: boolean) => ({
      internal: {device: {}},
      config: {meetings: {enableE2ee}},
    });
    let preloadStub;

    beforeEach(() => {
      preloadStub = sinon.stub(WasmLoader.prototype, 'preload').resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('isEnabled', () => {
      it('reflects webex.config.meetings.enableE2ee', () => {
        assert.isTrue(new E2eeManager({webex: makeWebex(true)}).isEnabled);
        assert.isFalse(new E2eeManager({webex: makeWebex(false)}).isEnabled);
        assert.isFalse(new E2eeManager({webex: makeWebex()}).isEnabled);
      });
    });

    describe('preload', () => {
      it('warms the WASM module when enabled', async () => {
        const manager = new E2eeManager({webex: makeWebex(true)});

        await manager.preload();

        assert.calledOnce(preloadStub);
      });

      it('does nothing when disabled', async () => {
        const manager = new E2eeManager({webex: makeWebex(false)});

        await manager.preload();

        assert.notCalled(preloadStub);
      });
    });

    describe('createE2eeMeeting', () => {
      it('returns a per-meeting E2EE facade', () => {
        const manager = new E2eeManager({webex: makeWebex(true)});
        const meeting = {};

        const e2eeMeeting = manager.createE2eeMeeting(meeting);

        assert.isDefined(e2eeMeeting);
        assert.equal(e2eeMeeting.state, 'disabled');
        assert.isTrue(e2eeMeeting.isEnabled);
      });
    });
  });
});
