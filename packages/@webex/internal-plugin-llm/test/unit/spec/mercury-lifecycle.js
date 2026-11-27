import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {MercuryPlugin, Socket} from '@webex/internal-plugin-mercury';
import {config} from '@webex/internal-plugin-llm/src/llm';
import LLMPlugin from '@webex/internal-plugin-llm/src/llm-plugin';
import {DATA_CHANNEL_WITH_JWT_TOKEN} from '@webex/internal-plugin-llm/src/constants';
import sinon from 'sinon';

// Assertions describe the desired behavior and intentionally fail for the current inheritance bugs.
// The online-hook case proves a missing client notification, not server-side subscription loss.
describe('LLMChannel inherited Mercury lifecycle', () => {
  const deviceSocketUrl = 'wss://mercury.example.com/registrations/device';
  const llmSocketUrl = 'wss://llm.example.com/registrations/meeting';
  const locusUrl = 'https://locus.example.com/meetings/meeting';
  const datachannelUrl = 'https://llm.example.com/datachannels/meeting';
  const permanentClose = {code: 3050, reason: 'done (permanent)'};
  let webex;
  let channel;
  let clock;
  let socketOpen;
  let mercuryStatus;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webex = new MockWebex({children: {mercury: MercuryPlugin, llm: LLMPlugin}});
    webex.config.llm = {
      ...config.llm,
      backoffTimeReset: 1,
      backoffTimeMax: 4,
      maxRetries: 1,
    };
    webex.config.mercury = {...webex.config.llm};
    webex.internal.device.webSocketUrl = deviceSocketUrl;
    webex.internal.feature.getFeature.resolves(false);
    webex.internal.feature.getFeature
      .withArgs('developer', DATA_CHANNEL_WITH_JWT_TOKEN)
      .resolves(true);
    mercuryStatus = sinon.stub();
    webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus = mercuryStatus;

    // Keep registration, URL preparation, backoff, and event handling real. Only socket I/O is fake.
    socketOpen = sinon.stub(Socket.prototype, 'open').callsFake(function open(socketUrl) {
      Object.defineProperty(this, 'url', {value: socketUrl, configurable: true});

      return Promise.resolve();
    });
    sinon.stub(Socket.prototype, 'close').callsFake(function close(options = permanentClose) {
      this.emit('close', options);

      return Promise.resolve();
    });

    channel = webex.internal.llm.createChannel();
    sinon.stub(channel, 'request').resolves({
      body: {webSocketUrl: llmSocketUrl, binding: 'meeting-binding'},
    });
  });

  afterEach(async () => {
    try {
      await webex.internal.llm.disconnectAllChannels(permanentClose);
      await webex.internal.mercury.disconnect(permanentClose);
      await clock.tickAsync(0);
    } finally {
      sinon.restore();
    }
  });

  async function connectLLM() {
    await channel.registerAndConnect(locusUrl, datachannelUrl);

    return channel.getSocket();
  }

  async function receiveShutdown() {
    await channel._onmessage({data: {type: 'shutdown'}});
    // _onmessage resolves before the switchover; drain its connection callbacks too.
    await clock.tickAsync(0);
  }

  function assertLLMUrl(socketUrl) {
    const actual = new URL(socketUrl);
    const expected = new URL(llmSocketUrl);

    assert.equal(actual.origin, expected.origin, 'the LLM channel must stay on the LLM service');
    assert.equal(actual.pathname, expected.pathname, 'the meeting registration must be preserved');
    assert.equal(actual.searchParams.get('subscriptionAwareSubchannels'), 'transcription');
  }

  describe('choosing a replacement URL', () => {
    it('uses the registration response for the initial LLM socket, not the device Mercury URL', async () => {
      const socket = await connectLLM();

      assertLLMUrl(socket.url);
      assert.notStrictEqual(channel, webex.internal.mercury);
    });

    it('preserves the LLM registration and subscription parameters after a network disconnect', async () => {
      const oldSocket = await connectLLM();

      oldSocket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);

      assert.isTrue(channel.isConnected());
      assert.notStrictEqual(channel.getSocket(), oldSocket);
      assertLLMUrl(channel.getSocket().url);
    });

    it('preserves the LLM registration and subscription parameters during graceful shutdown', async () => {
      const oldSocket = await connectLLM();
      const switched = sinon.spy();

      channel.once('event:mercury_shutdown_switchover_complete', switched);
      await receiveShutdown();

      assert.calledOnce(switched);
      assert.notStrictEqual(channel.getSocket(), oldSocket);
      assertLLMUrl(socketOpen.lastCall.args[0]);
    });
  });

  describe('reporting connection progress', () => {
    it('reports an automatic Mercury reconnect as an LLM connection in progress', async () => {
      const oldSocket = await connectLLM();
      let finishOpen;
      const pendingOpen = new Promise((resolve) => {
        finishOpen = resolve;
      });

      socketOpen.onSecondCall().returns(pendingOpen);
      oldSocket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);

      try {
        assert.isTrue(channel.connecting, 'Mercury is attempting to open a replacement socket');
        assert.isTrue(
          channel.isConnecting(),
          'Meeting.updateLLMConnection must be able to recognize and preserve the recovering channel'
        );
      } finally {
        finishOpen();
        await clock.tickAsync(0);
      }
    });
  });

  describe('registering an already connected channel', () => {
    it('keeps the existing socket when the registration URLs have not changed', async () => {
      const oldSocket = await connectLLM();

      await channel.registerAndConnect(locusUrl, datachannelUrl);

      assert.calledOnce(channel.request);
      assert.calledOnce(socketOpen);
      assert.strictEqual(channel.getSocket(), oldSocket);
    });

    it('opens the new registration socket before reporting success for changed URLs', async () => {
      const oldSocket = await connectLLM();
      const nextSocketUrl = 'wss://llm.example.com/registrations/another-meeting';

      channel.request.resolves({
        body: {webSocketUrl: nextSocketUrl, binding: 'another-meeting-binding'},
      });

      await channel.registerAndConnect(
        'https://locus.example.com/meetings/another-meeting',
        'https://llm.example.com/datachannels/another-meeting'
      );

      assert.equal(channel.getBinding(), 'another-meeting-binding');
      assert.notStrictEqual(
        channel.getSocket(),
        oldSocket,
        'a new binding must not be paired with the previous registration socket'
      );
      assert.equal(new URL(channel.getSocket().url).pathname, new URL(nextSocketUrl).pathname);
    });
  });

  describe('keeping main Mercury diagnostics independent', () => {
    it('does not report main Mercury connected just because an LLM channel connects', async () => {
      assert.isFalse(webex.internal.mercury.connected);

      await connectLLM();

      assert.isTrue(channel.isConnected());
      assert.isFalse(webex.internal.mercury.connected);
      assert.notCalled(mercuryStatus);
    });

    it('does not report main Mercury disconnected when only the LLM channel closes', async () => {
      await webex.internal.mercury.connect();
      assert.calledOnceWithExactly(mercuryStatus, true);
      await connectLLM();
      mercuryStatus.resetHistory();

      await channel.disconnect(permanentClose);

      assert.isTrue(webex.internal.mercury.connected);
      assert.isFalse(channel.isConnected());
      assert.notCalled(mercuryStatus);
    });
  });

  describe('notifying consumers after socket replacement', () => {
    it('runs the online recovery hook after a normal LLM reconnect', async () => {
      const oldSocket = await connectLLM();
      const restoreSubscriptions = sinon.spy();

      channel.on('online', restoreSubscriptions);
      oldSocket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);

      assert.calledOnce(restoreSubscriptions);
    });

    it('runs the online recovery hook after a graceful LLM socket replacement', async () => {
      await connectLLM();
      const restoreSubscriptions = sinon.spy();
      const switched = sinon.spy();

      // Meeting.handleLLMOnline restores subscriptions and syncs LLM datasets through this event.
      channel.on('online', restoreSubscriptions);
      channel.once('event:mercury_shutdown_switchover_complete', switched);
      await receiveShutdown();

      assert.calledOnce(switched);
      assert.calledOnce(restoreSubscriptions);
    });
  });
});
