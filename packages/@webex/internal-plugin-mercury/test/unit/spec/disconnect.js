import {assert} from '@webex/test-helper-chai';
import Mercury, {Socket, config} from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import sinon from 'sinon';
import FakeTimers from '@sinonjs/fake-timers';

describe('plugin-mercury disconnect lifecycle', () => {
  let clock;
  let webex;
  let mercury;
  let socket;
  let nativeSocket;
  let spies;
  const options = {code: 3050, reason: 'meetings unregister'};

  beforeEach(() => {
    clock = FakeTimers.install();
    webex = new MockWebex({children: {mercury: Mercury}});
    webex.config.mercury = config.mercury;
    webex.internal.device = {
      registered: true,
      webSocketUrl: 'ws://example.com',
    };
    webex.internal.services = {
      convertUrlToPriorityHostUrl: sinon.stub().resolves('ws://example.com'),
      isValidHost: sinon.stub().returns(true),
    };
    webex.internal.feature = {getFeature: sinon.stub().resolves(false)};
    webex.credentials = {
      getUserToken: sinon.stub().resolves({toString: () => 'test-token'}),
    };
    mercury = webex.internal.mercury;
    socket = new Socket();
    mercury.socket = socket;
    mercury._attachSocketEventListeners(socket);
    nativeSocket = new MockWebSocket('ws://example.com');
    nativeSocket.close.restore();
    sinon.stub(nativeSocket, 'close').callsFake(() => {
      nativeSocket.readyState = 2;
    });
    sinon.stub(Socket, 'getWebSocketConstructor').returns(function MockSocketConstructor() {
      return nativeSocket;
    });
    spies = {
      disconnected: sinon.spy(),
      offline: sinon.spy(),
      online: sinon.spy(),
      deviceUnregister: sinon.stub().resolves(),
      guestLogin: sinon.stub().resolves(),
      reconnect: sinon.stub(mercury, '_reconnect'),
      status: sinon.stub(),
    };
    webex.internal.newMetrics.callDiagnosticMetrics.setMercuryConnectedStatus = spies.status;
    mercury.on('disconnected', spies.disconnected);
    mercury.on('offline', spies.offline);
    mercury.on('online', spies.online);
  });

  afterEach(() => {
    socket.removeAllListeners();
    mercury.removeAllListeners();
    sinon.restore();
    clock.uninstall();
  });

  const openSocket = async () => {
    const promise = socket.open('ws://example.com', {
      ...config.mercury,
      logger: webex.logger,
      token: 'test-token',
      trackingId: 'test-tracking-id',
    });
    nativeSocket.open();
    await promise;
    mercury.connected = true;
  };

  ['missing', 'never opened', 'failed before opening', 'already closed'].forEach((state) => {
    it(`settles downstream continuations when the socket is ${state}`, async () => {
      if (state === 'missing') {
        mercury.unset('socket');
        socket.removeAllListeners();
      } else if (state === 'failed before opening') {
        const opening = socket.open('ws://example.com', {
          ...config.mercury,
          logger: webex.logger,
          token: 'test-token',
          trackingId: 'test-tracking-id',
        });
        nativeSocket.readyState = 3;
        nativeSocket.onclose({code: 1006, reason: ''});
        await assert.isRejected(opening, /Failed to connect to socket/);
      } else if (state === 'already closed') {
        await openSocket();
        nativeSocket.readyState = 3;
      }

      await mercury.disconnect(options).then(spies.deviceUnregister).then(spies.guestLogin);

      assert.isUndefined(mercury.socket);
      assert.isFalse(mercury.connected);
      assert.isFalse(mercury.connecting);
      assert.calledOnceWithExactly(spies.disconnected);
      assert.calledOnce(spies.deviceUnregister);
      assert.calledOnce(spies.guestLogin);
      assert.callOrder(spies.disconnected, spies.deviceUnregister, spies.guestLogin);
      assert.notCalled(spies.reconnect);
      assert.equal(socket.listenerCount('close'), 0);
      if (state === 'missing') {
        assert.notCalled(spies.status);
      }
    });
  });

  ['open', 'already closing'].forEach((state) => {
    it(`waits for closure and deduplicates disconnect when the socket is ${state}`, async () => {
      await openSocket();
      if (state === 'already closing') nativeSocket.readyState = 2;
      const first = mercury.disconnect(options);
      const second = mercury.disconnect(options);
      let completed = false;
      first.then(() => {
        completed = true;
      });

      await Promise.resolve();
      assert.isFalse(completed);
      assert.notCalled(spies.disconnected);
      assert.strictEqual(first, second);

      nativeSocket.readyState = 3;
      nativeSocket.onclose(options);
      await first;

      assert.isUndefined(mercury.socket);
      assert.isFalse(mercury.connected);
      assert.calledOnce(spies.offline);
      assert.calledOnce(spies.disconnected);
      assert.callOrder(spies.offline, spies.disconnected);
      assert.equal(nativeSocket.close.callCount, state === 'open' ? 1 : 0);
      assert.notCalled(spies.reconnect);
      assert.isNull(mercury._disconnectPromise);
      await clock.tickAsync(config.mercury.forceCloseDelay);
      assert.calledOnce(spies.disconnected);
      assert.calledOnce(spies.offline);
    });
  });

  it('uses the existing forced-close deadline for a socket already closing', async () => {
    await openSocket();
    nativeSocket.readyState = 2;
    const promise = mercury.disconnect(options);
    await clock.tickAsync(config.mercury.forceCloseDelay - 1);
    assert.notCalled(spies.disconnected);
    await clock.tickAsync(1);
    await promise;
    assert.calledOnce(spies.disconnected);
    assert.calledOnce(spies.offline);
    assert.notCalled(spies.reconnect);
  });

  it('propagates close errors without reporting disconnect success and allows retry', async () => {
    await openSocket();
    const error = new Error('native close failed');
    nativeSocket.close.throws(error);
    await assert.isRejected(mercury.disconnect(options), /native close failed/);
    assert.notCalled(spies.disconnected);
    assert.strictEqual(mercury.socket, socket);
    assert.isNull(mercury._disconnectPromise);
    assert.equal(clock.countTimers(), 1);

    nativeSocket.close.resetBehavior();
    nativeSocket.close.callsFake(() => {
      nativeSocket.readyState = 3;
      nativeSocket.onclose(options);
    });
    await mercury.disconnect(options);
    assert.calledOnce(spies.disconnected);
  });

  [
    {failedSocket: 'active', synchronous: false},
    {failedSocket: 'active', synchronous: true},
    {failedSocket: 'switchover', synchronous: false},
    {failedSocket: 'switchover', synchronous: true},
  ].forEach(({failedSocket, synchronous}) => {
    it(`waits for both sockets and permits retry when ${failedSocket} close fails (synchronous=${synchronous})`, async () => {
      let finishOtherClose;
      const otherClose = new Promise((resolve) => {
        finishOtherClose = resolve;
      });
      const pendingSocket = new Socket();
      mercury._shutdownSwitchoverSocket = pendingSocket;
      const activeClose = sinon.stub(socket, 'close');
      const pendingClose = sinon.stub(pendingSocket, 'close');
      const failedClose = failedSocket === 'active' ? activeClose : pendingClose;
      const delayedClose = failedSocket === 'active' ? pendingClose : activeClose;
      const error = new Error(`${failedSocket} close failed`);
      if (synchronous) failedClose.throws(error);
      else failedClose.rejects(error);
      delayedClose.returns(otherClose);

      const disconnecting = mercury.disconnect(options);
      const rejected = assert.isRejected(disconnecting, /close failed/);
      const settled = sinon.spy();
      disconnecting.then(settled, settled);
      await clock.tickAsync(0);
      assert.calledOnceWithExactly(activeClose, options);
      assert.calledOnceWithExactly(pendingClose, options);
      assert.notCalled(settled);
      assert.notCalled(spies.disconnected);
      assert.strictEqual(mercury._shutdownSwitchoverSocket, pendingSocket);

      finishOtherClose();
      await rejected;
      assert.isNull(mercury._disconnectPromise);
      assert.strictEqual(mercury.socket, socket);
      assert.strictEqual(mercury._shutdownSwitchoverSocket, pendingSocket);
      assert.notCalled(spies.disconnected);

      activeClose.resetBehavior();
      pendingClose.resetBehavior();
      activeClose.resolves();
      pendingClose.resolves();
      await mercury.disconnect(options);
      assert.isUndefined(mercury.socket);
      assert.isNull(mercury._shutdownSwitchoverSocket);
      assert.calledOnce(spies.disconnected);
    });
  });

  it('ignores switchover messages while its socket is closing', async () => {
    let finishClose;
    const pendingSocket = new Socket();
    mercury._shutdownSwitchoverSocket = pendingSocket;
    mercury._attachSocketEventListeners(pendingSocket);
    const onmessage = sinon.stub(mercury, '_onmessage');
    sinon.stub(pendingSocket, 'close').returns(
      new Promise((resolve) => {
        finishClose = resolve;
      })
    );
    const disconnecting = mercury.disconnect(options);
    pendingSocket.emit('message', {data: 'late message'});
    assert.notCalled(onmessage);
    finishClose();
    await disconnecting;
    assert.calledOnce(spies.disconnected);
  });

  it('closes a socket only once if it is also tracked as the switchover socket', async () => {
    mercury._shutdownSwitchoverSocket = socket;
    const close = sinon.spy(socket, 'close');
    await mercury.disconnect(options);
    assert.calledOnceWithExactly(close, options);
    assert.isUndefined(mercury.socket);
    assert.isNull(mercury._shutdownSwitchoverSocket);
    assert.calledOnce(spies.disconnected);
  });

  it('does not open a cancelled socket when URL preparation completes late', async () => {
    let resolveUrl;
    sinon.stub(mercury, '_prepareUrl').returns(
      new Promise((resolve) => {
        resolveUrl = resolve;
      })
    );
    const opening = mercury._prepareAndOpenSocket(socket);
    const rejected = assert.isRejected(opening, /closed/);
    await mercury.disconnect(options);
    const replacement = new Socket();
    mercury.socket = replacement;
    mercury.resolvedWebSocketUrl = 'ws://replacement.example.com';
    resolveUrl('ws://old.example.com');
    await clock.tickAsync(0);
    assert.notCalled(Socket.getWebSocketConstructor);
    await rejected;
    assert.strictEqual(mercury.socket, replacement);
    assert.equal(mercury.resolvedWebSocketUrl, 'ws://replacement.example.com');
    assert.notCalled(spies.online);
    assert.notCalled(spies.reconnect);
    replacement.removeAllListeners();
  });

  it('waits for disconnect before starting a replacement connection', async () => {
    await openSocket();
    const connect = sinon.stub(mercury, '_connectWithBackoff').resolves();
    const disconnecting = mercury.disconnect(options);
    const connecting = mercury.connect('ws://replacement.example.com');
    await Promise.resolve();
    assert.notCalled(connect);

    nativeSocket.readyState = 3;
    nativeSocket.onclose(options);
    await disconnecting;
    await connecting;
    assert.calledOnceWithExactly(connect, 'ws://replacement.example.com');
  });

  it('does not start a replacement connection when disconnect fails', async () => {
    await openSocket();
    nativeSocket.close.throws(new Error('native close failed'));
    const connect = sinon.stub(mercury, '_connectWithBackoff').resolves();
    const disconnecting = assert.isRejected(mercury.disconnect(options), /native close failed/);
    const connecting = assert.isRejected(
      mercury.connect('ws://replacement.example.com'),
      /native close failed/
    );
    await Promise.all([disconnecting, connecting]);
    assert.notCalled(connect);
    assert.strictEqual(mercury.socket, socket);
    assert.notCalled(spies.disconnected);
  });

  it('does not clear a replacement socket when the old close completes', async () => {
    await openSocket();
    const disconnecting = mercury.disconnect(options);
    const replacement = new Socket();
    mercury.socket = replacement;
    mercury.connected = true;
    nativeSocket.readyState = 3;
    nativeSocket.onclose(options);
    await disconnecting;
    assert.strictEqual(mercury.socket, replacement);
    assert.isTrue(mercury.connected);
    assert.notCalled(spies.status);
    assert.calledOnce(spies.disconnected);
    replacement.removeAllListeners();
  });

  it('cancels a connection still waiting for device registration', async () => {
    let resolveRegistration;
    webex.internal.device.registered = false;
    webex.internal.device.register = sinon.stub().returns(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      })
    );
    const connect = sinon.stub(mercury, '_connectWithBackoff').resolves();
    const connecting = mercury.connect();
    const rejected = assert.isRejected(connecting, /Aborted/);
    await mercury.disconnect(options);
    resolveRegistration();
    await rejected;
    assert.notCalled(connect);
    assert.isFalse(mercury.connecting);
    assert.isNull(mercury._connectPromise);
  });

  it('preserves a replacement connection when cancelled registration completes late', async () => {
    let resolveRegistration;
    let resolveConnection;
    webex.internal.device.registered = false;
    webex.internal.device.register = sinon.stub().returns(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      })
    );
    const connect = sinon.stub(mercury, '_connectWithBackoff').returns(
      new Promise((resolve) => {
        resolveConnection = resolve;
      })
    );
    const old = mercury.connect();
    const rejected = assert.isRejected(old, /Aborted/);
    await mercury.disconnect(options);
    webex.internal.device.registered = true;
    const replacement = mercury.connect();
    resolveRegistration();
    await clock.tickAsync(0);
    assert.calledOnce(connect);
    await rejected;
    assert.strictEqual(mercury._connectPromise, replacement);
    assert.isTrue(mercury.connecting);
    resolveConnection();
    await replacement;
    assert.isNull(mercury._connectPromise);
    assert.isFalse(mercury.connecting);
  });

  it('shares socket-close completion and does not issue duplicate native closes', async () => {
    await openSocket();
    const first = socket.close(options);
    const second = socket.close(options);
    assert.strictEqual(first, second);
    assert.calledOnceWithExactly(nativeSocket.close, 3050, 'meetings unregister');
    nativeSocket.readyState = 3;
    nativeSocket.onclose(options);
    assert.deepEqual(await first, options);
    assert.strictEqual(socket.close(options), first);
  });

  it('shares socket-close completion when a close listener calls close again', async () => {
    const opening = socket.open('ws://example.com', {
      ...config.mercury,
      logger: webex.logger,
      token: 'test-token',
      trackingId: 'test-tracking-id',
    });
    const rejected = assert.isRejected(opening, /closed/);
    nativeSocket.readyState = 0;
    let reentrantClose;
    socket.on('close', () => {
      reentrantClose = socket.close(options);
    });
    const first = socket.close(options);
    await rejected;
    await first;
    assert.strictEqual(reentrantClose, first);
    assert.calledOnce(nativeSocket.close);
  });

  it('rejects unfinished open and ignores a late native open after cancellation', async () => {
    const authorize = sinon.spy(socket, '_authorize');
    const opening = socket.open('ws://example.com', {
      ...config.mercury,
      logger: webex.logger,
      token: 'test-token',
      trackingId: 'test-tracking-id',
    });
    const cancelled = sinon.spy();
    opening.catch(cancelled);
    const rejected = assert.isRejected(opening, /closed/);
    nativeSocket.readyState = 0;
    await mercury.disconnect(options);
    await clock.tickAsync(0);
    assert.calledOnce(cancelled);
    await rejected;
    nativeSocket.onopen();
    assert.notCalled(authorize);
    assert.notCalled(nativeSocket.send);
    assert.calledOnceWithExactly(nativeSocket.close, 3050, 'meetings unregister');
    assert.calledOnce(spies.offline);
    assert.calledOnce(spies.disconnected);
    assert.notCalled(spies.online);
    assert.notCalled(spies.reconnect);
  });

  it('cancels the original open after a duplicate open is rejected', async () => {
    const openOptions = {
      ...config.mercury,
      logger: webex.logger,
      token: 'test-token',
      trackingId: 'test-tracking-id',
    };
    const outcome = sinon.spy();
    const opening = socket.open('ws://example.com', openOptions).then(outcome, outcome);
    await assert.isRejected(socket.open('ws://example.com', openOptions), /only be called once/);
    nativeSocket.readyState = 0;
    await mercury.disconnect(options);
    await clock.tickAsync(0);
    assert.calledOnce(outcome);
    assert.match(outcome.firstCall.args[0].message, /closed/);
    await opening;
  });

  it('does not restore open handlers after cancelled authorization finishes', async () => {
    let finishAuthorization;
    sinon.stub(socket, '_authorize').returns(
      new Promise((resolve) => {
        finishAuthorization = resolve;
      })
    );
    const opening = socket.open('ws://example.com', {
      ...config.mercury,
      logger: webex.logger,
      token: 'test-token',
      trackingId: 'test-tracking-id',
    });
    const rejected = assert.isRejected(opening, /closed/);
    nativeSocket.readyState = 1;
    nativeSocket.onopen();
    const closing = mercury.disconnect(options);
    const closeHandler = nativeSocket.onclose;
    finishAuthorization();
    await rejected;
    assert.strictEqual(nativeSocket.onclose, closeHandler);
    nativeSocket.readyState = 3;
    nativeSocket.onclose(options);
    await closing;
    assert.calledOnce(spies.disconnected);
    assert.notCalled(spies.online);
  });

  it('rejects forced-close handler errors instead of leaving disconnect pending', async () => {
    await openSocket();
    sinon.stub(socket, 'onclose').throws(new Error('close handler failed'));
    const rejected = assert.isRejected(mercury.disconnect(options), /close handler failed/);
    await clock.tickAsync(config.mercury.forceCloseDelay);
    await rejected;
    assert.notCalled(spies.disconnected);
    assert.isNull(mercury._disconnectPromise);
  });

  it('propagates a native close-handler error and permits retry', async () => {
    await openSocket();
    const handler = sinon.stub(socket, 'onclose').throws(new Error('close handler failed'));
    const rejected = assert.isRejected(mercury.disconnect(options), /close handler failed/);
    nativeSocket.readyState = 3;
    nativeSocket.onclose(options);
    await rejected;
    assert.notCalled(spies.disconnected);
    assert.strictEqual(mercury.socket, socket);
    handler.restore();
    await mercury.disconnect(options);
    assert.isUndefined(mercury.socket);
    assert.calledOnce(spies.disconnected);
  });

  [false, true].forEach((fails) => {
    it(`clears the pending switchover socket after an attempt ${
      fails ? 'fails' : 'succeeds'
    }`, async () => {
      mercury.connected = true;
      mercury._shutdownSwitchoverBackoffCall = {abort: sinon.stub()};
      const error = new Error('switchover failed');
      const opening = sinon.stub(mercury, '_prepareAndOpenSocket');
      if (fails) opening.rejects(error);
      else opening.resolves('ws://replacement.example.com');
      const callback = sinon.spy();
      const onSuccess = sinon.spy((newSocket) => {
        mercury.socket = newSocket;
      });
      const attempt = mercury._attemptConnection(undefined, callback, {
        isShutdownSwitchover: true,
        onSuccess,
      });
      const pendingSocket = opening.firstCall.args[0];
      assert.strictEqual(mercury._shutdownSwitchoverSocket, pendingSocket);
      assert.strictEqual(mercury.socket, socket);
      await attempt;
      assert.isNull(mercury._shutdownSwitchoverSocket);
      assert.isTrue(mercury.connected);
      if (fails) {
        assert.calledOnceWithExactly(callback, error);
        assert.notCalled(onSuccess);
        assert.strictEqual(mercury.socket, socket);
      } else {
        assert.calledOnceWithExactly(callback);
        assert.calledOnceWithExactly(onSuccess, pendingSocket, 'ws://replacement.example.com');
        assert.strictEqual(mercury.socket, pendingSocket);
      }
      pendingSocket.removeAllListeners();
    });
  });

  [
    {isShutdownSwitchover: false, fails: false},
    {isShutdownSwitchover: false, fails: true},
    {isShutdownSwitchover: true, fails: false},
    {isShutdownSwitchover: true, fails: true},
  ].forEach(({isShutdownSwitchover, fails}) => {
    it(`ignores a late ${
      fails ? 'failure' : 'success'
    } after cancellation (switchover=${isShutdownSwitchover})`, async () => {
      let finishOpen;
      let failOpen;
      const controller = {abort: sinon.stub()};
      const controllerKey = isShutdownSwitchover ? '_shutdownSwitchoverBackoffCall' : 'backoffCall';
      mercury[controllerKey] = controller;
      const opening = sinon.stub(mercury, '_prepareAndOpenSocket').returns(
        new Promise((resolve, reject) => {
          finishOpen = resolve;
          failOpen = reject;
        })
      );
      const onSuccess = sinon.spy();
      const callback = sinon.spy();
      const attempt = mercury._attemptConnection(undefined, callback, {
        isShutdownSwitchover,
        onSuccess,
      });
      const pendingSocket = opening.firstCall.args[0];
      const close = sinon.stub(pendingSocket, 'close').resolves();

      await mercury.disconnect(options);
      assert.calledOnce(controller.abort);
      assert.calledOnceWithExactly(close, options);
      close.resetHistory();
      mercury[controllerKey] = {abort: sinon.stub()};
      const replacement = new Socket();
      mercury.socket = replacement;
      if (fails) failOpen(new Error('cancelled attempt failed'));
      else finishOpen('ws://example.com');
      await attempt;
      assert.strictEqual(mercury.socket, replacement);
      if (fails) {
        assert.notCalled(close);
      } else {
        assert.calledOnceWithExactly(close, {code: 3050, reason: 'Connection attempt cancelled'});
      }
      assert.notCalled(onSuccess);
      assert.notCalled(callback);
      assert.notCalled(spies.online);
      assert.isUndefined(mercury.lastError);
      replacement.removeAllListeners();
      pendingSocket.removeAllListeners();
    });
  });
});
