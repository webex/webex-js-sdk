/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import DSS from '@webex/internal-plugin-dss';

describe('plugin-dss (browser)', function () {
  this.timeout(10000);

  let webex;
  let mercury;

  beforeEach(() => {
    mercury = {
      connect: sinon.stub().resolves(),
      disconnect: sinon.stub().resolves(),
      on: sinon.stub(),
      off: sinon.stub(),
    };

    webex = MockWebex({
      canAuthorize: true,
      children: {
        dss: DSS,
      },
    });
    webex.config.dss = {};
    webex.internal.mercury = mercury;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('registers with mercury and emits DSS_REGISTERED', async () => {
    const triggerSpy = sinon.spy(webex.internal.dss, 'trigger');

    await webex.internal.dss.register();

    sinon.assert.calledOnce(mercury.connect);
    sinon.assert.calledWith(
      mercury.on.firstCall,
      'event:directory.lookup',
      sinon.match.func
    );
    sinon.assert.calledWith(
      mercury.on.secondCall,
      'event:directory.search',
      sinon.match.func
    );
    assert.isTrue(webex.internal.dss.registered);
    sinon.assert.calledWith(triggerSpy, 'dss:registered');
  });

  it('unregisters from mercury and emits DSS_UNREGISTERED', async () => {
    await webex.internal.dss.register();
    const triggerSpy = sinon.spy(webex.internal.dss, 'trigger');

    await webex.internal.dss.unregister();

    sinon.assert.calledOnce(mercury.disconnect);
    sinon.assert.calledWith(mercury.off.firstCall, 'event:directory.lookup');
    sinon.assert.calledWith(mercury.off.secondCall, 'event:directory.search');
    assert.isFalse(webex.internal.dss.registered);
    sinon.assert.calledWith(triggerSpy, 'dss:unregistered');
  });
});
