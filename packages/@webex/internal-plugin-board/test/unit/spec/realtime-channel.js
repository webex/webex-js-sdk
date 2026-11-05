import {assert} from '@webex/test-helper-chai';
import {MercuryPlugin, Socket, config as mercuryConfig} from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

import RealtimeChannel from '../../../src/realtime-channel';
import boardConfig from '../../../src/config';

describe('Board realtime channel diagnostics', () => {
  let webex;
  let primary;
  let channel;
  let status;

  beforeEach(() => {
    webex = new MockWebex({children: {mercury: MercuryPlugin}});
    webex.config.mercury = mercuryConfig.mercury;
    webex.config.board = boardConfig.board;
    webex.internal.device = {registered: true, webSocketUrl: 'wss://example.com/primary'};
    webex.internal.feature = {getFeature: sinon.stub().resolves(false)};
    status = sinon.stub();
    webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus = status;
    primary = webex.internal.mercury;
    channel = new RealtimeChannel({parent: webex, channelId: 'board-channel'});
    sinon.stub(primary._mercury, '_prepareAndOpenSocket').callsFake(function preparePrimary() {
      this.resolvedWebSocketUrl = 'wss://example.com/primary';

      return Promise.resolve('wss://example.com/primary');
    });
    sinon.stub(channel, '_prepareAndOpenSocket').callsFake(function prepareBoard() {
      this.resolvedWebSocketUrl = 'wss://example.com/board';

      return Promise.resolve('wss://example.com/board');
    });
  });

  afterEach(() => {
    if (primary.socket) primary.socket.removeAllListeners();
    if (channel.socket) channel.socket.removeAllListeners();
    channel.removeAllListeners();
    sinon.restore();
  });

  it('does not report an unopened board socket as a primary disconnect', async () => {
    await primary.connect();
    assert.deepEqual(status.args, [[true]]);
    channel.socket = new Socket();

    await channel.disconnect({code: 3050, reason: 'board cleanup'});
    assert.isTrue(primary.connected);
    assert.isFalse(channel.connected);
    assert.deepEqual(status.args, [[true]]);
    await primary.disconnect({code: 3050, reason: 'meeting cleanup'});
    assert.deepEqual(status.args, [[true], [false]]);
  });

  [false, true].forEach((primaryConnected) => {
    it(`does not report board connect or close with primary connected=${primaryConnected}`, async () => {
      if (primaryConnected) await primary.connect();
      const expectedStatus = primaryConnected ? [[true]] : [];

      await channel.connect('wss://example.com/board');
      assert.isTrue(channel.connected);
      assert.strictEqual(primary.connected, primaryConnected);
      assert.deepEqual(status.args, expectedStatus);

      channel.socket.emit('close', {code: 3050, reason: 'board cleanup'});
      assert.isFalse(channel.connected);
      assert.strictEqual(primary.connected, primaryConnected);
      assert.deepEqual(status.args, expectedStatus);
      await channel.disconnect({code: 3050, reason: 'board cleanup'});
      assert.deepEqual(status.args, expectedStatus);
      if (primaryConnected) {
        await primary.disconnect({code: 3050, reason: 'meeting cleanup'});
        assert.deepEqual(status.args, [[true], [false]]);
      }
    });
  });
});
