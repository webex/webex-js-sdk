import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Mercury, {ConnectionError, MercuryPlugin, Socket} from '@webex/internal-plugin-mercury';
import {config} from '@webex/internal-plugin-llm/src/llm';
import LLMPlugin from '@webex/internal-plugin-llm/src/llm-plugin';
import {DATA_CHANNEL_WITH_JWT_TOKEN} from '@webex/internal-plugin-llm/src/constants';
import sinon from 'sinon';

// The online-hook case proves a missing client notification, not server-side subscription loss.
describe('LLMChannel inherited Mercury lifecycle', () => {
  const deviceSocketUrl = 'wss://mercury.example.com/registrations/device';
  const llmSocketUrl = 'wss://llm.example.com/registrations/meeting';
  const locusUrl = 'https://locus.example.com/meetings/meeting';
  const datachannelUrl = 'https://llm.example.com/datachannels/meeting';
  const permanentClose = {code: 3050, reason: 'done (permanent)'};
  const nextLocusUrl = 'https://locus.example.com/meetings/another-meeting';
  const nextDatachannelUrl = 'https://llm.example.com/datachannels/another-meeting';
  const nextSocketUrl = 'wss://llm.example.com/registrations/another-meeting';
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

  function registerNext() {
    channel.request.resolves({
      body: {webSocketUrl: nextSocketUrl, binding: 'another-meeting-binding'},
    });

    return channel.registerAndConnect(nextLocusUrl, nextDatachannelUrl);
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

  function assertOriginalRegistrationRemainsActive(oldSocket) {
    assert.isTrue(channel.isConnected());
    assert.isFalse(channel.isConnecting());
    assert.strictEqual(channel.getSocket(), oldSocket);
    assert.equal(channel.getBinding(), 'meeting-binding');
    assert.equal(channel.getLocusUrl(), locusUrl);
    assert.equal(channel.getDatachannelUrl(), datachannelUrl);
    assert.notCalled(Socket.prototype.close);
    assert.calledOnce(socketOpen);
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

    it('keeps the latest pre-proxy URL through repeated switchovers and a network disconnect', async () => {
      socketOpen.callsFake(function open(socketUrl) {
        Object.defineProperty(this, 'url', {value: 'wss://proxy.example.com/socket'});

        return Promise.resolve();
      });
      await connectLLM();

      for (let replacement = 0; replacement < 2; replacement += 1) {
        await clock.tickAsync(1);
        const oldSocket = channel.getSocket();

        await receiveShutdown();
        assertLLMUrl(socketOpen.lastCall.args[0]);
        assert.equal(channel.resolvedWebSocketUrl, socketOpen.lastCall.args[0]);
        oldSocket.emit('close', {code: 4001, reason: 'replaced during shutdown'});
        assert.isTrue(channel.isConnected());
      }

      channel.getSocket().emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);
      assertLLMUrl(socketOpen.lastCall.args[0]);
    });

    it('discovers an updated primary device URL after reconnect and before shutdown', async () => {
      const primary = webex.internal.mercury;

      await primary.connect();
      primary.socket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);
      const updatedUrl = 'wss://mercury.example.com/registrations/updated-device';

      webex.internal.device.webSocketUrl = updatedUrl;
      await primary._mercury._onmessage({data: {type: 'shutdown'}});
      await clock.tickAsync(0);

      assert.equal(new URL(socketOpen.lastCall.args[0]).pathname, new URL(updatedUrl).pathname);
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
      assert.isFalse(channel.isConnecting());
    });

    it('clears connection progress when device registration fails', async () => {
      webex.internal.device.registered = false;
      webex.internal.device.register.rejects(new Error('device registration failed'));

      await assert.isRejected(channel.registerAndConnect(locusUrl, datachannelUrl));

      assert.isFalse(channel.isConnecting());
      assert.isFalse(channel.connecting);
    });

    it('does not let stale device registration open or clear a newer connection', async () => {
      let finishRegistration;

      webex.internal.device.registered = false;
      webex.internal.device.register.returns(
        new Promise((resolve) => {
          finishRegistration = resolve;
        })
      );
      const staleConnection = channel.registerAndConnect(locusUrl, datachannelUrl);
      const rejected = assert.isRejected(staleConnection, 'Mercury Connection Aborted');

      await clock.tickAsync(0);
      await channel.disconnect(permanentClose);
      webex.internal.device.registered = true;
      await registerNext();
      const newSocket = channel.getSocket();

      finishRegistration();
      await rejected;

      assert.calledOnce(socketOpen);
      assert.strictEqual(channel.getSocket(), newSocket);
      assert.isTrue(channel.isConnected());
      assert.isFalse(channel.isConnecting());
    });
  });

  describe('registering an already connected channel', () => {
    it('reuses the registration while the same channel is automatically reconnecting', async () => {
      const oldSocket = await connectLLM();
      let finishOpen;

      socketOpen.onSecondCall().returns(
        new Promise((resolve) => {
          finishOpen = resolve;
        })
      );
      oldSocket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);
      channel.request.resolves({
        body: {webSocketUrl: nextSocketUrl, binding: 'unexpected-binding'},
      });
      const recovery = channel.registerAndConnect(locusUrl, datachannelUrl);

      finishOpen();
      await recovery;

      assert.calledOnce(channel.request);
      assert.equal(channel.getBinding(), 'meeting-binding');
      assertLLMUrl(socketOpen.lastCall.args[0]);
    });

    it('keeps the existing socket when the registration URLs have not changed', async () => {
      const oldSocket = await connectLLM();

      await channel.registerAndConnect(locusUrl, datachannelUrl);

      assert.calledOnce(channel.request);
      assert.calledOnce(socketOpen);
      assert.strictEqual(channel.getSocket(), oldSocket);
    });

    it('opens the new registration socket before reporting success for changed URLs', async () => {
      const oldSocket = await connectLLM();
      await registerNext();

      assert.equal(channel.getBinding(), 'another-meeting-binding');
      assert.notStrictEqual(
        channel.getSocket(),
        oldSocket,
        'a new binding must not be paired with the previous registration socket'
      );
      assert.equal(new URL(channel.getSocket().url).pathname, new URL(nextSocketUrl).pathname);
    });

    it('uses the prepared replacement route first and selects a new route after an open failure', async () => {
      const oldSocket = await connectLLM();
      const convertUrlToPriorityHostUrl = sinon.stub();
      const markFailedUrl = sinon.stub().resolves();

      convertUrlToPriorityHostUrl
        .onFirstCall()
        .returns('wss://priority-one.example.com/registrations/another-meeting');
      convertUrlToPriorityHostUrl
        .onSecondCall()
        .returns('wss://priority-two.example.com/registrations/another-meeting');
      webex.internal.services = {convertUrlToPriorityHostUrl, markFailedUrl};
      webex.internal.device.refresh = sinon.stub().resolves();
      webex.internal.feature.getFeature
        .withArgs('developer', 'web-high-availability')
        .resolves(true);
      webex.internal.feature.getFeature
        .withArgs('developer', DATA_CHANNEL_WITH_JWT_TOKEN)
        .resolves(false);
      socketOpen.onSecondCall().rejects(new ConnectionError({code: 1006, reason: 'route failed'}));

      await Promise.all([registerNext(), clock.tickAsync(10)]);

      assert.deepEqual(convertUrlToPriorityHostUrl.args, [[nextSocketUrl], [nextSocketUrl]]);
      const firstClose = Socket.prototype.close.firstCall;
      assert.strictEqual(firstClose.thisValue, oldSocket);
      assert.isTrue(convertUrlToPriorityHostUrl.firstCall.calledBefore(firstClose));

      assert.calledThrice(socketOpen);
      const failedSocketUrl = socketOpen.secondCall.args[0];
      assert.equal(new URL(failedSocketUrl).host, 'priority-one.example.com');
      assert.calledOnceWithExactly(markFailedUrl, failedSocketUrl);
      assert.isTrue(convertUrlToPriorityHostUrl.secondCall.calledAfter(markFailedUrl.firstCall));

      assert.equal(new URL(channel.getSocket().url).host, 'priority-two.example.com');
      assert.equal(channel.getBinding(), 'another-meeting-binding');
      assert.isTrue(channel.isConnected());
    });

    it('preserves ownership and refresh state while changing registrations', async () => {
      await connectLLM();
      const disconnected = sinon.spy();
      const refresh = sinon.stub().resolves({body: {datachannelToken: 'synthetic-token'}});

      channel.on('disconnected', disconnected);
      channel.setDatachannelToken('synthetic-token');
      channel.setRefreshHandler(refresh);
      await registerNext();

      assert.notCalled(disconnected);
      assert.isTrue(webex.internal.llm.getAllChannels().has(channel));
      assert.strictEqual(
        webex.internal.llm.getChannelByDatachannelUrl(nextDatachannelUrl),
        channel
      );
      assert.equal(channel.getDatachannelToken(), 'synthetic-token');
      await channel.refreshDataChannelToken();
      assert.calledOnce(refresh);
      channel.getSocket().emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);
      assert.equal(new URL(channel.getSocket().url).pathname, new URL(nextSocketUrl).pathname);
    });

    it('keeps the old registration usable after a failed replacement POST', async () => {
      const oldSocket = await connectLLM();

      channel.request.rejects(new Error('registration failed'));
      await assert.isRejected(channel.registerAndConnect(nextLocusUrl, nextDatachannelUrl));

      assert.strictEqual(channel.getSocket(), oldSocket);
      assert.equal(channel.getBinding(), 'meeting-binding');
      assert.equal(channel.getLocusUrl(), locusUrl);
      assert.equal(channel.getDatachannelUrl(), datachannelUrl);
      await registerNext();
      assert.notStrictEqual(channel.getSocket(), oldSocket);
    });

    it('rejects a missing registration socket URL before closing the old socket', async () => {
      const oldSocket = await connectLLM();

      channel.request.resolves({body: {binding: 'invalid-binding'}});
      await assert.isRejected(channel.registerAndConnect(nextLocusUrl, nextDatachannelUrl));

      assertOriginalRegistrationRemainsActive(oldSocket);
    });

    [
      ['is malformed', 'not-a-url'],
      ['uses an unsupported protocol', 'ftp://llm.example.com/socket'],
      ['contains a fragment', `${nextSocketUrl}#fragment`],
    ].forEach(([condition, webSocketUrl]) => {
      it(`keeps the old registration when the replacement URL ${condition} with tokens off`, async () => {
        webex.internal.feature.getFeature
          .withArgs('developer', DATA_CHANNEL_WITH_JWT_TOKEN)
          .resolves(false);
        const oldSocket = await connectLLM();

        channel.request.resolves({body: {webSocketUrl, binding: 'invalid-binding'}});
        await assert.isRejected(channel.registerAndConnect(nextLocusUrl, nextDatachannelUrl));

        assertOriginalRegistrationRemainsActive(oldSocket);
      });
    });

    it('keeps the old registration when the service catalog rejects the replacement socket host', async () => {
      const oldSocket = await connectLLM();
      const unavailableHost = 'unavailable.example.com';
      const isValidHost = sinon.stub().returns(false);

      webex.internal.services = {
        convertUrlToPriorityHostUrl: sinon.stub().returns(undefined),
        isValidHost,
      };
      webex.internal.feature.getFeature
        .withArgs('developer', 'web-high-availability')
        .resolves(true);
      channel.request.resolves({
        body: {
          webSocketUrl: `wss://${unavailableHost}/registrations/another-meeting`,
          binding: 'invalid-binding',
        },
      });
      await assert.isRejected(channel.registerAndConnect(nextLocusUrl, nextDatachannelUrl));

      assert.calledOnceWithExactly(isValidHost, unavailableHost);
      assertOriginalRegistrationRemainsActive(oldSocket);
    });

    it('honors explicit disconnect during replacement URL preparation', async () => {
      await connectLLM();
      const highAvailability = webex.internal.feature.getFeature.withArgs(
        'developer',
        'web-high-availability'
      );
      highAvailability.resetHistory();
      let finishPreparation;
      highAvailability.returns(
        new Promise((resolve) => {
          finishPreparation = resolve;
        })
      );

      const replacement = registerNext();
      await clock.tickAsync(0);
      assert.calledOnce(highAvailability);
      assert.notCalled(Socket.prototype.close);

      await channel.disconnect(permanentClose);
      finishPreparation(false);
      await replacement;

      assert.calledOnce(Socket.prototype.close);
      assert.calledOnce(socketOpen);
      assert.isFalse(channel.isConnected());
      assert.isUndefined(channel.getBinding());
    });

    it('honors explicit disconnect while the old registration socket is closing', async () => {
      const oldSocket = await connectLLM();
      let finishClose;
      const closing = new Promise((resolve) => {
        finishClose = () => {
          oldSocket.emit('close', permanentClose);
          resolve();
        };
      });

      Socket.prototype.close.callsFake(function close(options) {
        if (this !== oldSocket) {
          this.emit('close', options);

          return Promise.resolve();
        }

        return closing;
      });
      const replacement = registerNext();

      await clock.tickAsync(0);
      const disconnected = channel.disconnect(permanentClose);

      finishClose();
      await Promise.all([replacement, disconnected]);
      assert.calledOnce(socketOpen);
      assert.isFalse(channel.isConnected());
      assert.isFalse(channel.isConnecting());
      assert.isUndefined(channel.getBinding());
    });

    it('cancels old reconnect URL preparation before opening the new registration', async () => {
      const oldSocket = await connectLLM();
      let finishToken;

      webex.credentials.getUserToken.onSecondCall().returns(
        new Promise((resolve) => {
          finishToken = resolve;
        })
      );
      oldSocket.emit('close', {code: 1006, reason: ''});
      await clock.tickAsync(0);
      await registerNext();
      const newSocket = channel.getSocket();

      finishToken('synthetic-token');
      await clock.tickAsync(0);
      assert.calledTwice(socketOpen);
      assert.strictEqual(channel.getSocket(), newSocket);
      assert.equal(new URL(newSocket.url).pathname, new URL(nextSocketUrl).pathname);
    });

    ['replacement', 'disconnect'].forEach((operation) => {
      it(`does not reopen the old registration when local ${operation} receives a network close`, async () => {
        await connectLLM();
        Socket.prototype.close.callsFake(function close() {
          this.emit('close', {code: 1006, reason: ''});

          return Promise.resolve();
        });

        if (operation === 'replacement') {
          await registerNext();
          assert.equal(new URL(channel.getSocket().url).pathname, new URL(nextSocketUrl).pathname);
        } else {
          await channel.disconnect(permanentClose);
          assert.isUndefined(channel.getSocket());
        }
        await clock.tickAsync(0);

        assert.callCount(socketOpen, operation === 'replacement' ? 2 : 1);
      });
    });

    it('clears an allocated socket when stopped before native open', async () => {
      let finishToken;

      webex.credentials.getUserToken.onFirstCall().returns(
        new Promise((resolve) => {
          finishToken = resolve;
        })
      );
      // Exercise Socket.close()'s no-native-socket path without emitting offline.
      Socket.prototype.close.resolves();
      const connecting = channel.registerAndConnect(locusUrl, datachannelUrl);
      const rejected = assert.isRejected(connecting, 'Mercury Connection Aborted');

      await clock.tickAsync(0);
      await channel.disconnect(permanentClose);
      finishToken('synthetic-token');
      await rejected;
      await clock.tickAsync(0);

      assert.isUndefined(channel.getSocket());
      assert.isFalse(channel.isConnected());
      assert.isFalse(channel.isConnecting());
      assert.notCalled(socketOpen);
    });

    it('does not report registration success after an online listener disconnects it', async () => {
      await connectLLM();
      let disconnected;

      channel.once('online', () => {
        disconnected = channel.disconnect(permanentClose);
      });
      const result = await registerNext();

      await disconnected;
      assert.isUndefined(result);
      assert.isUndefined(channel.getBinding());
      assert.isFalse(channel.isConnected());
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

    it('reports the primary wrapper disconnect', async () => {
      await webex.internal.mercury.connect();
      mercuryStatus.resetHistory();
      await webex.internal.mercury.disconnect(permanentClose);

      assert.calledOnceWithExactly(mercuryStatus, false);
    });

    it('does not report a separate transport even with the same Mercury namespace', async () => {
      const other = new Mercury({parent: webex});

      try {
        await other.connect();
        await other.disconnect(permanentClose);
        assert.notCalled(mercuryStatus);
      } finally {
        await other.disconnect(permanentClose);
      }
    });
  });

  describe('notifying consumers after socket replacement', () => {
    it('retains a successful primary connection when the following HA refresh rejects', async () => {
      const primary = webex.internal.mercury;

      sinon.stub(primary._mercury, '_prepareUrl').resolves(deviceSocketUrl);
      webex.internal.feature.getFeature
        .withArgs('developer', 'web-high-availability')
        .resolves(true);
      webex.internal.device.refresh = sinon.stub().rejects(new Error('device refresh failed'));
      await primary.connect();
      await clock.tickAsync(0);

      assert.isTrue(primary.connected);
      assert.notCalled(Socket.prototype.close);
    });

    it('finishes an in-flight primary replacement after the server closes the old socket with 4001', async () => {
      const primary = webex.internal.mercury;
      let finishOpen;

      await primary.connect();
      const oldSocket = primary.socket;

      socketOpen.onSecondCall().returns(
        new Promise((resolve) => {
          finishOpen = resolve;
        })
      );
      await primary._mercury._onmessage({data: {type: 'shutdown'}});
      await clock.tickAsync(0);
      oldSocket.emit('close', {code: 4001, reason: 'replaced during shutdown'});
      assert.isFalse(primary.connected);
      mercuryStatus.resetHistory();

      finishOpen();
      await clock.tickAsync(0);

      assert.isTrue(primary.connected);
      assert.notStrictEqual(primary.socket, oldSocket);
      assert.calledOnceWithExactly(mercuryStatus, true);
    });

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

    it('publishes the active replacement before online and completion notifications', async () => {
      const oldSocket = await connectLLM();
      const events = [];
      let onlineState;

      channel.on('online', () => {
        onlineState = {
          socket: channel.getSocket(),
          connected: channel.isConnected(),
          backoffCall: channel._shutdownSwitchoverBackoffCall,
        };
        events.push('online');
      });
      channel.on('event:mercury_shutdown_switchover_complete', () => events.push('complete'));
      await receiveShutdown();

      assert.deepEqual(events, ['online', 'complete']);
      assert.notStrictEqual(onlineState.socket, oldSocket);
      assert.isTrue(onlineState.connected);
      assertLLMUrl(onlineState.socket.url);
      assert.notExists(onlineState.backoffCall);
    });

    it('forwards online through the primary Mercury wrapper after replacement', async () => {
      const primary = webex.internal.mercury;

      await primary.connect();
      const oldSocket = primary.socket;
      const online = sinon.spy();

      primary.on('online', () => online(primary.socket));
      await primary._mercury._onmessage({data: {type: 'shutdown'}});
      await clock.tickAsync(0);

      assert.calledOnceWithExactly(online, primary.socket);
      assert.notStrictEqual(primary.socket, oldSocket);
      assert.isTrue(primary.connected);
    });

    it('keeps the old socket and resolved URL when replacement exhausts retries', async () => {
      const oldSocket = await connectLLM();
      const oldUrl = channel.resolvedWebSocketUrl;
      const online = sinon.spy();

      channel.on('online', online);
      socketOpen.rejects(new Error('replacement failed'));
      await receiveShutdown();
      await clock.tickAsync(10);

      assert.strictEqual(channel.getSocket(), oldSocket);
      assert.equal(channel.resolvedWebSocketUrl, oldUrl);
      assert.isTrue(channel.isConnected());
      assert.notCalled(online);
    });

    ['disconnect', 'network close'].forEach((cause) => {
      it(`discards a late shutdown replacement after ${cause}`, async () => {
        const oldSocket = await connectLLM();
        let finishOpen;

        socketOpen.onSecondCall().returns(
          new Promise((resolve) => {
            finishOpen = resolve;
          })
        );
        await receiveShutdown();
        const online = sinon.spy();

        channel.on('online', online);
        if (cause === 'disconnect') {
          await channel.disconnect(permanentClose);
        } else {
          oldSocket.emit('close', {code: 1006, reason: ''});
          await clock.tickAsync(0);
        }
        const activeSocket = channel.getSocket();
        const activeUrl = channel.resolvedWebSocketUrl;

        finishOpen();
        await clock.tickAsync(0);

        assert.strictEqual(channel.getSocket(), activeSocket);
        assert.equal(channel.resolvedWebSocketUrl, activeUrl);
        assert.callCount(online, cause === 'disconnect' ? 0 : 1);
      });
    });
  });
});
