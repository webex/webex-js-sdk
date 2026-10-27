import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm/src/llm';

describe('plugin-llm', () => {
  const locusUrl = 'locusUrl';
  const datachannelUrl = 'datachannelUrl';

  describe('LLMChannel', () => {
    let webex, llmChannel;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMChannel,
        },
      });

      webex.internal.feature = {
        setFeature: sinon.stub().resolves({value: true}),
        getFeature: sinon.stub().resolves(true),
      };

      llmChannel = webex.internal.llm;
      // Stub Mercury's prototype disconnect so super.disconnect() works in tests.
      // The real Mercury emits 'disconnected' after disconnect completes, so we simulate that.
      sinon
        .stub(Object.getPrototypeOf(Object.getPrototypeOf(llmChannel)), 'disconnect')
        .callsFake(function () {
          this.connected = false;
          this._emit('disconnected');

          return Promise.resolve();
        });
      llmChannel.request = sinon.stub().resolves({
        headers: {},
        body: {
          binding: 'binding',
          webSocketUrl: 'wss://example.com/socket',
        },
      });
      llmChannel.connect = sinon.stub().callsFake(() => {
        llmChannel.connected = true;
      });
    });

    afterEach(() => sinon.restore());

    describe('#registerAndConnect', () => {
      it('registers and connects', async () => {
        assert.equal(llmChannel.isConnected(), false);
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmChannel.isConnected(), true);
        assert.equal(llmChannel.getLocusUrl(), locusUrl);
        assert.equal(llmChannel.getDatachannelUrl(), datachannelUrl);
      });

      it('connects with subscriptionAwareSubchannels when token enabled', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        const buildSpy = sinon.spy(LLMChannel, 'buildUrlWithAwareSubchannels');

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl, 'abc123');

        sinon.assert.calledOnce(buildSpy);
        sinon.assert.calledOnce(llmChannel.connect);

        const calledUrl = llmChannel.connect.getCall(0).args[0];
        assert.include(calledUrl, 'subscriptionAwareSubchannels=');
      });

      it('connects without subscriptionAwareSubchannels when token disabled', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(false);

        const buildSpy = sinon.spy(LLMChannel, 'buildUrlWithAwareSubchannels');

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        sinon.assert.notCalled(buildSpy);
        sinon.assert.calledOnce(llmChannel.connect);

        const calledUrl = llmChannel.connect.getCall(0).args[0];
        assert.equal(calledUrl, 'wss://example.com/socket');
      });

      it('connects with subscriptionAwareSubchannels when token enabled but token missing', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        const buildSpy = sinon.spy(LLMChannel, 'buildUrlWithAwareSubchannels');

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl, undefined);

        sinon.assert.calledOnce(buildSpy);
        sinon.assert.calledOnce(llmChannel.connect);

        const calledUrl = llmChannel.connect.getCall(0).args[0];
        assert.include(calledUrl, 'subscriptionAwareSubchannels=');

        buildSpy.restore();
      });

      it('deduplicates concurrent calls', async () => {
        const promise1 = llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        const promise2 = llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.strictEqual(promise1, promise2);
        await promise1;
      });

      it('avoids reconnect if already connected to same URLs', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        sinon.assert.calledOnce(llmChannel.connect);

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        sinon.assert.calledOnce(llmChannel.connect);
      });

      it('propagates error when registration request fails', async () => {
        const error = new Error('Network failure');
        llmChannel.request = sinon.stub().rejects(error);

        try {
          await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
          assert.fail('should have thrown');
        } catch (e) {
          assert.equal(e.message, 'Network failure');
        }

        sinon.assert.notCalled(llmChannel.connect);
      });

      it('returns timing data on successful connection', async () => {
        const clock = sinon.useFakeTimers();

        llmChannel.request = sinon.stub().callsFake(async () => {
          clock.tick(37);

          return {
            headers: {},
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });
        llmChannel.connect = sinon.stub().callsFake(async () => {
          clock.tick(23);
          llmChannel.connected = true;
        });

        const result = await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.deepEqual(result, {
          clientLLMDatachannelResponseTime: 37,
          clientLLMWebSocketConnectTime: 23,
        });

        clock.restore();
      });

      it('attaches timing to error when connect fails', async () => {
        const clock = sinon.useFakeTimers();

        llmChannel.request = sinon.stub().callsFake(async () => {
          clock.tick(37);

          return {
            headers: {},
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        const connectError = new Error('websocket connect failed');
        llmChannel.connect = sinon.stub().rejects(connectError);

        let caughtError;
        try {
          await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        } catch (error) {
          caughtError = error;
        }

        assert.equal(caughtError, connectError);
        assert.deepEqual(caughtError.timing, {clientLLMDatachannelResponseTime: 37});

        clock.restore();
      });

      it('clears connectingPromise after successful connection', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        // After completion, a new call should create a fresh promise (not deduplicated)
        llmChannel.connect.resetHistory();
        llmChannel.request.resetHistory();

        // Simulate different URLs to force new connection
        await llmChannel.registerAndConnect('newLocusUrl', 'newDatachannelUrl');

        // Should have called request again since connectingPromise was cleared
        sinon.assert.calledOnce(llmChannel.request);
      });

      it('clears connectingPromise after failed connection', async () => {
        llmChannel.connect = sinon.stub().rejects(new Error('connect failed'));

        try {
          await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        } catch (e) {
          // expected
        }

        // Reset and try again - should not deduplicate since promise was cleared
        llmChannel.connect = sinon.stub().callsFake(() => {
          llmChannel.connected = true;
        });
        llmChannel.request.resetHistory();

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        // Should have called request again
        sinon.assert.calledOnce(llmChannel.request);
      });

      it('returns undefined when already connected to same URLs', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        const result = await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.equal(result, undefined);
      });
    });

    describe('#register (via registerAndConnect)', () => {
      it('sends request with token header when token enabled and provided', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl, 'abc123');

        sinon.assert.calledOnceWithExactly(
          llmChannel.request,
          sinon.match({
            method: 'POST',
            url: datachannelUrl,
            body: {deviceUrl: webex.internal.device.url},
            headers: {'Data-Channel-Auth-Token': 'abc123'},
          })
        );
      });

      it('sends request without token header when none provided', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        sinon.assert.calledOnceWithExactly(
          llmChannel.request,
          sinon.match({
            method: 'POST',
            url: datachannelUrl,
            body: {deviceUrl: webex.internal.device.url},
            headers: {},
          })
        );
      });

      it('sends request without token header when toggle disabled', async () => {
        llmChannel.isDataChannelTokenEnabled = sinon.stub().resolves(false);

        await llmChannel.registerAndConnect(locusUrl, datachannelUrl, 'abc123');

        sinon.assert.calledOnceWithExactly(
          llmChannel.request,
          sinon.match({
            method: 'POST',
            url: datachannelUrl,
            body: {deviceUrl: webex.internal.device.url},
            headers: {},
          })
        );
      });
    });

    describe('#getLocusUrl', () => {
      it('gets LocusUrl', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmChannel.getLocusUrl(), locusUrl);
      });

      it('returns undefined before connection', () => {
        assert.equal(llmChannel.getLocusUrl(), undefined);
      });
    });

    describe('#getDatachannelUrl', () => {
      it('gets dataChannel Url', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmChannel.getDatachannelUrl(), datachannelUrl);
      });

      it('returns undefined before connection', () => {
        assert.equal(llmChannel.getDatachannelUrl(), undefined);
      });
    });

    describe('#getBinding', () => {
      it('gets binding after connection', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmChannel.getBinding(), 'binding');
      });

      it('returns undefined before connection', () => {
        assert.equal(llmChannel.getBinding(), undefined);
      });
    });

    describe('#isConnecting', () => {
      it('returns true while connection is in progress', () => {
        // Start connection but don't await
        llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.equal(llmChannel.isConnecting(), true);
      });

      it('returns false after connection completes', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.equal(llmChannel.isConnecting(), false);
      });

      it('returns false before any connection attempt', () => {
        assert.equal(llmChannel.isConnecting(), false);
      });
    });

    describe('#disconnect', () => {
      it('calls super.disconnect and clears all connection state', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        llmChannel.setDatachannelToken('token123');

        assert.equal(llmChannel.isConnected(), true);
        assert.equal(llmChannel.getLocusUrl(), locusUrl);
        assert.equal(llmChannel.getDatachannelUrl(), datachannelUrl);
        assert.equal(llmChannel.getBinding(), 'binding');
        assert.equal(llmChannel.getDatachannelToken(), 'token123');

        await llmChannel.disconnect({code: 1000, reason: 'test'});

        assert.equal(llmChannel.getLocusUrl(), undefined);
        assert.equal(llmChannel.getDatachannelUrl(), undefined);
        assert.equal(llmChannel.getBinding(), undefined);
        assert.equal(llmChannel.getDatachannelToken(), undefined);
        assert.equal(llmChannel.isConnecting(), false);
      });

      it('works without options', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        await llmChannel.disconnect();

        assert.equal(llmChannel.getLocusUrl(), undefined);
      });

      it('propagates disconnect errors', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        // Change the existing stub to reject
        Object.getPrototypeOf(Object.getPrototypeOf(llmChannel)).disconnect.rejects(
          new Error('disconnect failed')
        );

        try {
          await llmChannel.disconnect({code: 1000, reason: 'test'});
          assert.fail('should have thrown');
        } catch (error) {
          assert.equal(error.message, 'disconnect failed');
        }
      });

      it('emits disconnected event', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        const disconnectedSpy = sinon.spy();

        llmChannel.on('disconnected', disconnectedSpy);

        await llmChannel.disconnect({code: 1000, reason: 'test'});

        sinon.assert.calledOnce(disconnectedSpy);
      });

      it('clears state before disconnected event fires', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        llmChannel.setDatachannelToken('token123');

        let stateAtEventTime;

        llmChannel.on('disconnected', () => {
          // Capture state when event fires - should already be cleared
          stateAtEventTime = {
            locusUrl: llmChannel.getLocusUrl(),
            datachannelUrl: llmChannel.getDatachannelUrl(),
            binding: llmChannel.getBinding(),
            datachannelToken: llmChannel.getDatachannelToken(),
            isConnecting: llmChannel.isConnecting(),
          };
        });

        await llmChannel.disconnect({code: 1000, reason: 'test'});

        // State should have been undefined when the event fired
        assert.deepEqual(stateAtEventTime, {
          locusUrl: undefined,
          datachannelUrl: undefined,
          binding: undefined,
          datachannelToken: undefined,
          isConnecting: false,
        });
      });

      it('invalidates in-flight connection via promise identity', async () => {
        let resolveRequest;
        llmChannel.request = sinon.stub().returns(
          new Promise((resolve) => {
            resolveRequest = resolve;
          })
        );

        // Start connection but don't await - request is pending
        const connectPromise = llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        assert.equal(llmChannel.isConnecting(), true);

        // Disconnect while connection is in-flight - should complete immediately
        await llmChannel.disconnect({code: 1000, reason: 'test'});

        // State should be cleared immediately, not waiting for connection
        assert.equal(llmChannel.getLocusUrl(), undefined);
        assert.equal(llmChannel.isConnecting(), false);

        // Now resolve the pending request - stale operation should not overwrite state
        resolveRequest({
          headers: {},
          body: {binding: 'stale-binding', webSocketUrl: 'wss://example.com/stale'},
        });

        // Wait for the stale promise to settle
        await connectPromise;

        // State should still be undefined - stale operation detected invalidation
        assert.equal(llmChannel.getBinding(), undefined);
        assert.equal(llmChannel.isConnecting(), false);
      });

      it('stale operation does not clear new connectingPromise', async () => {
        let resolveFirstRequest;
        let resolveSecondRequest;
        llmChannel.request = sinon.stub().returns(
          new Promise((resolve) => {
            resolveFirstRequest = resolve;
          })
        );

        // Start first connection
        const firstConnectPromise = llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        // Disconnect invalidates the first connection
        await llmChannel.disconnect({code: 1000, reason: 'test'});

        // Start second connection before first resolves
        llmChannel.request = sinon.stub().returns(
          new Promise((resolve) => {
            resolveSecondRequest = resolve;
          })
        );
        const secondConnectPromise = llmChannel.registerAndConnect(
          'newLocusUrl',
          'newDatachannelUrl'
        );

        assert.equal(llmChannel.isConnecting(), true);

        // Resolve the first (stale) request
        resolveFirstRequest({
          headers: {},
          body: {binding: 'stale-binding', webSocketUrl: 'wss://example.com/stale'},
        });

        await firstConnectPromise;

        // isConnecting should still be true because second connection is in progress
        assert.equal(llmChannel.isConnecting(), true);

        // State should not have been overwritten by stale operation
        assert.equal(llmChannel.getBinding(), undefined);

        // Complete second connection
        resolveSecondRequest({
          headers: {},
          body: {binding: 'new-binding', webSocketUrl: 'wss://example.com/new'},
        });
        await secondConnectPromise;

        // Now isConnecting should be false and state should reflect second connection
        assert.equal(llmChannel.isConnecting(), false);
        assert.equal(llmChannel.getBinding(), 'new-binding');
      });

      it('does not call connect() if disconnect runs during isDataChannelTokenEnabled await', async () => {
        let resolveFeatureToggle;
        const featureTogglePromise = new Promise((resolve) => {
          resolveFeatureToggle = resolve;
        });

        // Request resolves immediately
        llmChannel.request = sinon.stub().resolves({
          headers: {},
          body: {binding: 'binding', webSocketUrl: 'wss://example.com/socket'},
        });

        // Feature toggle will block
        webex.internal.feature.getFeature = sinon
          .stub()
          .onFirstCall()
          .resolves(true) // First call in register()
          .onSecondCall()
          .returns(featureTogglePromise); // Second call blocks

        // Start connection
        const connectPromise = llmChannel.registerAndConnect(locusUrl, datachannelUrl);

        // Wait for register() to complete and state to be set
        await new Promise((resolve) => setImmediate(resolve));

        // Binding should be set after register() completes
        assert.equal(llmChannel.getBinding(), 'binding');

        // Disconnect while isDataChannelTokenEnabled() is pending
        await llmChannel.disconnect({code: 1000, reason: 'test'});

        // State should be cleared
        assert.equal(llmChannel.getBinding(), undefined);

        // Now resolve the feature toggle - stale operation should NOT call connect()
        resolveFeatureToggle(true);

        await connectPromise;

        // connect() should NOT have been called - identity check after await should have aborted
        sinon.assert.notCalled(llmChannel.connect);
      });
    });

    describe('#setRefreshHandler', () => {
      it('stores the provided handler', async () => {
        const handler = sinon.stub().resolves({body: {datachannelToken: 'newToken'}});
        llmChannel.setRefreshHandler(handler);

        const result = await llmChannel.refreshDataChannelToken();

        assert.equal(result.body.datachannelToken, 'newToken');
        sinon.assert.calledOnce(handler);
      });
    });

    describe('#isDataChannelTokenEnabled', () => {
      it('returns value from feature toggle', async () => {
        webex.internal.feature.getFeature.resolves(true);

        const result = await llmChannel.isDataChannelTokenEnabled();

        sinon.assert.calledOnceWithExactly(
          webex.internal.feature.getFeature,
          'developer',
          'data-channel-with-jwt-token'
        );

        assert.equal(result, true);
      });
    });

    describe('#refreshDataChannelToken', () => {
      it('returns null and logs warn if no handler is set', async () => {
        const warnSpy = llmChannel.logger.warn;

        const result = await llmChannel.refreshDataChannelToken();

        assert.equal(result, null);

        sinon.assert.calledOnce(warnSpy);
        sinon.assert.calledWithMatch(warnSpy, sinon.match('LLM refreshHandler is not set'));
      });

      it('returns token when handler resolves', async () => {
        const mockToken = {body: {datachannelToken: 'newToken', datachannelTokenType: 'default'}};
        const handler = sinon.stub().resolves(mockToken);

        llmChannel.setRefreshHandler(handler);

        const token = await llmChannel.refreshDataChannelToken();

        assert.equal(token, mockToken);
        sinon.assert.calledOnce(handler);
      });

      it('logs warn and returns null when handler rejects', async () => {
        const handler = sinon.stub().rejects(new Error('throw error'));
        llmChannel.setRefreshHandler(handler);

        const warnSpy = llmChannel.logger.warn;

        const result = await llmChannel.refreshDataChannelToken();

        assert.equal(result, null);

        sinon.assert.calledOnce(warnSpy);
        sinon.assert.calledWithMatch(warnSpy, sinon.match('DataChannel token refresh failed'));
      });
    });

    describe('#getDatachannelToken / #setDatachannelToken / #clearDatachannelToken', () => {
      it('sets and gets datachannel token', () => {
        llmChannel.setDatachannelToken('abc123');
        assert.equal(llmChannel.getDatachannelToken(), 'abc123');
      });

      it('returns undefined when no token is set', () => {
        assert.equal(llmChannel.getDatachannelToken(), undefined);
      });

      it('clears datachannel token', () => {
        llmChannel.setDatachannelToken('abc123');
        assert.equal(llmChannel.getDatachannelToken(), 'abc123');

        llmChannel.clearDatachannelToken();
        assert.equal(llmChannel.getDatachannelToken(), undefined);
      });
    });

    describe('.matchesDatachannelRequestUrl', () => {
      it('returns true when request URL starts with registration URL', () => {
        const registrationUrl =
          'https://board.wbx2.com/datachannel/api/v1/locus/ps-encoded/registrations';
        const requestUrl = registrationUrl + '/some-path';

        const result = LLMChannel.matchesDatachannelRequestUrl(requestUrl, registrationUrl);

        assert.equal(result, true);
      });

      it('returns false when URLs do not match', () => {
        const registrationUrl =
          'https://board.wbx2.com/datachannel/api/v1/locus/ps-encoded/registrations';
        const requestUrl = 'https://unknown.example.com/path';

        const result = LLMChannel.matchesDatachannelRequestUrl(requestUrl, registrationUrl);

        assert.equal(result, false);
      });

      it('returns true when request host is rewritten but pathname matches', () => {
        const registrationUrl =
          'https://board-b.wbx2.com/datachannel/api/v1/locus/ps-encoded/registrations';
        const requestUrl =
          'https://hostmap-rewritten.example.com/datachannel/api/v1/locus/ps-encoded/registrations/events';

        const result = LLMChannel.matchesDatachannelRequestUrl(requestUrl, registrationUrl);

        assert.equal(result, true);
      });

      it('returns false for empty or null URLs', () => {
        assert.equal(LLMChannel.matchesDatachannelRequestUrl('', 'https://example.com'), false);
        assert.equal(LLMChannel.matchesDatachannelRequestUrl('https://example.com', ''), false);
        assert.equal(LLMChannel.matchesDatachannelRequestUrl(null, 'https://example.com'), false);
        assert.equal(LLMChannel.matchesDatachannelRequestUrl('https://example.com', null), false);
      });

      it('returns false for invalid URLs', () => {
        const result = LLMChannel.matchesDatachannelRequestUrl('not-a-url', 'also-not-a-url');

        assert.equal(result, false);
      });
    });

    describe('.buildUrlWithAwareSubchannels', () => {
      it('adds subscriptionAwareSubchannels query param', () => {
        const baseUrl = 'wss://example.com/socket';
        const subchannels = ['channel1', 'channel2'];

        const result = LLMChannel.buildUrlWithAwareSubchannels(baseUrl, subchannels);

        assert.include(result, 'subscriptionAwareSubchannels=channel1%2Cchannel2');
      });

      it('preserves existing query params', () => {
        const baseUrl = 'wss://example.com/socket?existing=param';
        const subchannels = ['channel1'];

        const result = LLMChannel.buildUrlWithAwareSubchannels(baseUrl, subchannels);

        assert.include(result, 'existing=param');
        assert.include(result, 'subscriptionAwareSubchannels=channel1');
      });
    });

  });
});
