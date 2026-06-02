import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMService from '@webex/internal-plugin-llm';
import LLMChannel from '@webex/internal-plugin-llm/src/llm';

describe('plugin-llm', () => {
  const locusUrl = 'locusUrl';
  const datachannelUrl = 'datachannelUrl';

  describe('llm', () => {
    let webex, llmService;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMService,
        },
      });

      webex.internal.feature = {
        setFeature: sinon.stub().resolves({value: true}),
        getFeature: sinon.stub().resolves(true),
      };

      llmService = webex.internal.llm;
      llmService.webSocketUrl = 'wss://example.com/socket';
      llmService.disconnect = sinon.stub().resolves(true);
      llmService.request = sinon.stub().resolves({
        headers: {},
        body: {
          binding: 'binding',
          webSocketUrl: 'wss://example.com/socket',
        },
      });
      const sockets = new Map();

      llmService.connect = sinon.stub().callsFake((url, sessionId) => {
        sockets.set(sessionId, {connected: true});
        llmService.getSocket = sinon.stub().callsFake((sid) => sockets.get(sid));
      });
            llmService.connections.set('llm-default-session',{
            webSocketUrl: 'wss://example.com/socket',
        })
    });

    afterEach(() => sinon.restore());

    describe('#registerAndConnect', () => {
      it('registers connection', async () => {
        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        assert.equal(llmService.isConnected('llm-default-session'), false);
        await llmService.registerAndConnect(locusUrl, datachannelUrl,undefined);
        assert.equal(llmService.isConnected('llm-default-session'), true);
      });

      it("doesn't register connection for invalid input", async () => {
        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        await llmService.registerAndConnect();
        assert.equal(llmService.isConnected(), false);
      });

      it('registers connection with token', async () => {
        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        assert.equal(llmService.isConnected(), false);

        await llmService.registerAndConnect(locusUrl, datachannelUrl,'abc123');

        sinon.assert.calledOnceWithExactly(
          llmService.register,
          datachannelUrl,
          'abc123',
          'llm-default-session'
        );

        assert.equal(llmService.isConnected(), true);
      });

      it('connects with subscriptionAwareSubchannels when token enabled', async () => {
        llmService.isDataChannelTokenEnabled = sinon.stub().returns(true);

        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        const buildSpy = sinon.spy(LLMService, 'buildUrlWithAwareSubchannels');

        await llmService.registerAndConnect(locusUrl, datachannelUrl,'abc123');

        sinon.assert.calledOnce(buildSpy);
        sinon.assert.calledOnce(llmService.connect);

        const calledUrl = llmService.connect.getCall(0).args[0];
        assert.include(calledUrl, 'subscriptionAwareSubchannels=');
      });

      it('connects without subscriptionAwareSubchannels when token disabled', async () => {
        llmService.isDataChannelTokenEnabled = sinon.stub().returns(false);

        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        const buildSpy = sinon.spy(LLMService, 'buildUrlWithAwareSubchannels');

        await llmService.registerAndConnect(locusUrl, datachannelUrl);

        sinon.assert.notCalled(buildSpy);
        sinon.assert.calledOnce(llmService.connect);

        const calledUrl = llmService.connect.getCall(0).args[0];
        assert.equal(calledUrl, llmService.webSocketUrl);
      });

      it('connects without subscriptionAwareSubchannels when token enabled BUT token missing', async () => {
        llmService.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        const buildSpy = sinon.spy(LLMService, 'buildUrlWithAwareSubchannels');

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined);

        sinon.assert.calledOnce(buildSpy);
        sinon.assert.calledOnce(llmService.connect);

        const calledUrl = llmService.connect.getCall(0).args[0];
        assert.include(calledUrl, 'subscriptionAwareSubchannels=');

        buildSpy.restore();
      });
    });

    describe('#register', () => {
      beforeEach(() => {
        llmService.isDataChannelTokenEnabled = sinon.stub();
      });

      it('registers connection with token header', async () => {
        llmService.isDataChannelTokenEnabled.resolves(true);
        await llmService.register(datachannelUrl, 'abc123');

        sinon.assert.calledOnceWithExactly(
          llmService.request,
          sinon.match({
            method: 'POST',
            url: `${datachannelUrl}`,
            body: {deviceUrl: webex.internal.device.url},
            headers: {'Data-Channel-Auth-Token': 'abc123'},
          })
        );
      });

      it('registers connection without token header when none provided', async () => {
        await llmService.register(datachannelUrl);

        sinon.assert.calledOnceWithExactly(
          llmService.request,
          sinon.match({
            method: 'POST',
            url: `${datachannelUrl}`,
            body: {deviceUrl: webex.internal.device.url},
            headers: {},
          })
        );
      });

      it('registers connection without token header when toggle disabled', async () => {
        llmService.isDataChannelTokenEnabled.resolves(false);

        await llmService.register(datachannelUrl,'abc123');
        sinon.assert.calledOnceWithExactly(
          llmService.request,
          sinon.match({
            method: 'POST',
            url: `${datachannelUrl}`,
            body: {deviceUrl: webex.internal.device.url},
            headers: {},
          })
        );
      });
    });

    describe('#getLocusUrl', () => {
      it('gets LocusUrl', async () => {
        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });

        await llmService.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmService.getLocusUrl(), locusUrl);
      });
    });

    describe('#getDatachannelUrl', () => {
      it('gets dataChannel Url', async () => {
        llmService.register = sinon.stub().callsFake(async () => {
          llmService.binding = 'binding';
          llmService.webSocketUrl = 'wss://example.com/socket';
          return {
            body: {
              binding: 'binding',
              webSocketUrl: 'wss://example.com/socket',
            },
          };
        });
        await llmService.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmService.getDatachannelUrl(), datachannelUrl);
      });
    });

    describe('#disconnect', () => {
      it('disconnects mercury', async () => {
        await llmService.disconnect();
        sinon.assert.calledOnce(llmService.disconnect);
        assert.equal(llmService.isConnected(), false);
        assert.equal(llmService.getLocusUrl(), undefined);
        assert.equal(llmService.getDatachannelUrl(), undefined);
        assert.equal(llmService.getBinding(), undefined);
      });
    });

    describe('#disconnectLLM', () => {
      let instance;

      beforeEach(() => {
        instance = {
          disconnect: jest.fn(() => Promise.resolve()),
          connections: new Map([
            ['llm-default-session', { foo: 'bar', datachannelToken: 'session-token' }],
          ]),

          disconnectLLM: function (
            options,
            sessionId = 'llm-default-session',
            ownerMeetingId = 'meeting-1'
          ) {
            if (!ownerMeetingId) {
              return Promise.reject(new Error('ownerMeetingId is required'));
            }

            return this.disconnect(options, sessionId).then(() => {
              this.connections.delete(sessionId);
            });
          },
        };
      });

      it('calls disconnect and clears session connection (including token stored in session)', async () => {
        await instance.disconnectLLM({ code: 3000, reason: 'bye' }, 'llm-default-session', 'meeting-1');

        expect(instance.disconnect).toHaveBeenCalledWith(
          { code: 3000, reason: 'bye' },
          'llm-default-session'
        );

        expect(instance.connections.has('llm-default-session')).toBe(false);
      });

      it('disconnectLLM supports legacy call with options only', async () => {
        llmService.disconnect = sinon.stub().resolves(true);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 'llm-default-session');

        const options = {code: 1000, reason: 'legacy'};
        const disconnected = await llmService.disconnectLLM(options);

        assert.equal(disconnected, true);
        sinon.assert.calledOnceWithExactly(llmService.disconnect, options, 'llm-default-session');
        assert.equal(llmService.getAllConnections().has('llm-default-session'), false);
      });

      it('disconnectLLM supports legacy call with options and sessionId', async () => {
        llmService.disconnect = sinon.stub().resolves(true);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');

        const options = {code: 1000, reason: 'legacy'};
        const disconnected = await llmService.disconnectLLM(options, 's1');

        assert.equal(disconnected, true);
        sinon.assert.calledOnceWithExactly(llmService.disconnect, options, 's1');
        assert.equal(llmService.getAllConnections().has('s1'), false);
      });

      it('disconnectLLM treats null sessionId as default session', async () => {
        llmService.disconnect = sinon.stub().resolves(true);

        await llmService.registerAndConnect(
          locusUrl,
          datachannelUrl,
          undefined,
          'llm-default-session'
        );

        const options = {code: 1000, reason: 'legacy-null-session'};
        const disconnected = await llmService.disconnectLLM(options, null);

        assert.equal(disconnected, true);
        sinon.assert.calledOnceWithExactly(llmService.disconnect, options, 'llm-default-session');
        assert.equal(llmService.getAllConnections().has('llm-default-session'), false);
      });

      it('propagates disconnect errors', async () => {
        instance.disconnect.mockRejectedValue(new Error('disconnect failed'));

        await expect(
          instance.disconnectLLM({ code: 3000, reason: 'bye' }, 'llm-default-session', 'meeting-1')
        ).rejects.toThrow('disconnect failed');
      });
    });

    describe('#setRefreshHandler', () => {
      beforeEach(() => {
        llmService.setRefreshHandler = LLMChannel.prototype.setRefreshHandler.bind(llmService);
        llmService.refreshDataChannelToken = LLMChannel.prototype.refreshDataChannelToken.bind(llmService);
      });

      it('defaults to llm-default-session when sessionId is omitted', () => {
        const handler = sinon.stub().resolves({ body: { datachannelToken: 'legacyToken' } });

        llmService.setRefreshHandler(handler);

        return llmService.refreshDataChannelToken().then((result) => {
          assert.equal(result.body.datachannelToken, 'legacyToken');
          sinon.assert.calledOnce(handler);
        });
      });

      it('stores the provided handler', () => {
        const handler = sinon.stub().resolves({ body: { datachannelToken: 'newToken' } });
        llmService.setRefreshHandler(handler, 'llm-default-session');

        return llmService.refreshDataChannelToken().then((result) => {
          assert.equal(result.body.datachannelToken, 'newToken');
          sinon.assert.calledOnce(handler);
        });
      });

      it('stores handlers per session id', () => {
        const handlerS1 = sinon.stub().resolves({ body: { datachannelToken: 'token-s1' } });
        const handlerS2 = sinon.stub().resolves({ body: { datachannelToken: 'token-s2' } });

        llmService.setRefreshHandler(handlerS1, 's1');
        llmService.setRefreshHandler(handlerS2, 's2');

        return Promise.all([
          llmService.refreshDataChannelToken('s1'),
          llmService.refreshDataChannelToken('s2'),
        ]).then(([resultS1, resultS2]) => {
          assert.equal(resultS1.body.datachannelToken, 'token-s1');
          assert.equal(resultS2.body.datachannelToken, 'token-s2');
        });
      });
    });

    describe('#isDataChannelTokenEnabled', () => {
      it('works correctly', async () => {
        webex.internal.feature.getFeature.returns(true);

        const result = await llmService.isDataChannelTokenEnabled();

        sinon.assert.calledOnceWithExactly(
          webex.internal.feature.getFeature,
          'developer',
          'data-channel-with-jwt-token'
        );

        assert.equal(result, true);
      });
    });

    describe('#refreshDataChannelToken', () => {
      beforeEach(() => {
        llmService.setRefreshHandler = LLMChannel.prototype.setRefreshHandler.bind(llmService);
        llmService.refreshDataChannelToken = LLMChannel.prototype.refreshDataChannelToken.bind(llmService);
      });

      it('returns null and logs warn if no handler is set', async () => {
        const warnSpy = llmService.logger.warn

        const result = await llmService.refreshDataChannelToken();

        assert.equal(result, null);

        sinon.assert.calledOnce(warnSpy);
        sinon.assert.calledWithMatch(
          warnSpy,
          sinon.match('LLM refreshHandler is not set for session')
        );
      });

      it('returns token when handler resolves', async () => {
        const mockToken = { body: { datachannelToken: 'newToken', isPracticeSession: false } };
        const handler = sinon.stub().resolves(mockToken);

        llmService.setRefreshHandler(handler, 'llm-default-session');

        const token = await llmService.refreshDataChannelToken();

        assert.equal(token, mockToken);
        sinon.assert.calledOnce(handler);
      });

      it('uses the handler for the provided session id', async () => {
        const mockToken = { body: { datachannelToken: 'session-token', isPracticeSession: true } };
        const handler = sinon.stub().resolves(mockToken);

        llmService.setRefreshHandler(handler, 's2');

        const token = await llmService.refreshDataChannelToken('s2');

        assert.equal(token, mockToken);
        sinon.assert.calledOnce(handler);
      });

      it('logs warn and returns null when handler rejects', async () => {
        const handler = sinon.stub().rejects(new Error('throw error'));
        llmService.setRefreshHandler(handler, 'llm-default-session');

        const warnSpy = llmService.logger.warn

        const result = await llmService.refreshDataChannelToken();

        assert.equal(result, null);

        sinon.assert.calledOnce(warnSpy);
        sinon.assert.calledWithMatch(
          warnSpy,
          sinon.match('DataChannel token refresh failed'),
        );
      });
    });

    describe('#getDatachannelToken / #setDatachannelToken', () => {
      it('sets and gets datachannel token', () => {
        llmService.setDatachannelToken('abc123','llm-default-session');
        assert.equal(llmService.getDatachannelToken('llm-default-session'), 'abc123');
        llmService.setDatachannelToken('123abc','llm-practice-session');
        assert.equal(llmService.getDatachannelToken('llm-practice-session'), '123abc');
      });

      it('supports arbitrary session id token keys', () => {
        llmService.setDatachannelToken('token-s1', 'session-custom-1');

        assert.equal(llmService.getDatachannelToken('session-custom-1'), 'token-s1');
      });

    });

    describe('#setOwnerMeetingId / #getOwnerMeetingId', () => {
      it('stores and returns the owner meeting id for the default session', () => {
        // beforeEach seeds connections with the default session entry
        llmService.setOwnerMeetingId('meeting-1');

        assert.equal(llmService.getOwnerMeetingId(), 'meeting-1');
      });

      it('returns undefined when no owner has been set yet', () => {
        assert.equal(llmService.getOwnerMeetingId(), undefined);
      });

      it('is a no-op when there is no session data for the given sessionId', () => {
        // Default session exists (seeded in beforeEach), but an arbitrary
        // session id does not — setOwnerMeetingId must not create entries.
        llmService.setOwnerMeetingId('meeting-1', 'unknown-session');

        assert.equal(llmService.getOwnerMeetingId('unknown-session'), undefined);
      });

      it('allows clearing ownership by passing undefined', () => {
        llmService.setOwnerMeetingId('meeting-1');
        assert.equal(llmService.getOwnerMeetingId(), 'meeting-1');

        llmService.setOwnerMeetingId(undefined);

        assert.equal(llmService.getOwnerMeetingId(), undefined);
      });

      it('tracks ownership per session id', () => {
        llmService.connections.set('session-A', {webSocketUrl: 'wss://a'});
        llmService.connections.set('session-B', {webSocketUrl: 'wss://b'});

        llmService.setOwnerMeetingId('meeting-A', 'session-A');
        llmService.setOwnerMeetingId('meeting-B', 'session-B');

        assert.equal(llmService.getOwnerMeetingId('session-A'), 'meeting-A');
        assert.equal(llmService.getOwnerMeetingId('session-B'), 'meeting-B');
      });

      it('clears ownerMeetingId naturally when disconnectLLM deletes the session entry', async () => {
        llmService.register = sinon.stub().callsFake(async () => ({
          body: {binding: 'binding', webSocketUrl: 'wss://example.com/socket'},
        }));

        await llmService.registerAndConnect(locusUrl, datachannelUrl);
        llmService.setOwnerMeetingId('meeting-1');
        assert.equal(llmService.getOwnerMeetingId(), 'meeting-1');

        await llmService.disconnectLLM(
          {code: 3050, reason: 'done (permanent)'},
          'llm-default-session',
          'meeting-1'
        );

        // Session entry was deleted, so ownerMeetingId is gone.
        assert.equal(llmService.getOwnerMeetingId(), undefined);
      });
    });

    describe('multi-connection logic', () => {
      const locusUrl2 = 'locusUrl2';
      const datachannelUrl2 = 'datachannelUrl2';

      it('tracks multiple sessions independently', async () => {
        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        await llmService.registerAndConnect(locusUrl2, datachannelUrl2, undefined, 's2');

        assert.equal(llmService.isConnected('s1'), true);
        assert.equal(llmService.isConnected('s2'), true);
        assert.equal(llmService.getLocusUrl('s1'), locusUrl);
        assert.equal(llmService.getLocusUrl('s2'), locusUrl2);
        assert.equal(llmService.getDatachannelUrl('s1'), datachannelUrl);
        assert.equal(llmService.getDatachannelUrl('s2'), datachannelUrl2);

        const all = llmService.getAllConnections();
        assert.equal(all.has('s1'), true);
        assert.equal(all.has('s2'), true);
      });

      it('disconnectLLM clears only the targeted session', async () => {
        llmService.disconnect = sinon.stub().resolves(true);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        await llmService.registerAndConnect(locusUrl2, datachannelUrl2, undefined, 's2');

        const options = {code: 1000, reason: 'test'};
        const disconnected = await llmService.disconnectLLM(options, 's1', 'meeting-1');

        assert.equal(disconnected, true);
        sinon.assert.calledOnceWithExactly(llmService.disconnect, options, 's1');

        const all = llmService.getAllConnections();
        assert.equal(all.has('s1'), false);
        assert.equal(all.has('s2'), true);
        assert.equal(llmService.getDatachannelToken('s1'), undefined);
      });

      it('disconnectLLM skips disconnect when ownerMeetingId does not match', async () => {
        llmService.disconnect = sinon.stub().resolves(true);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        llmService.setOwnerMeetingId('meeting-1', 's1');

        const options = {code: 1000, reason: 'test'};
        const disconnected = await llmService.disconnectLLM(options, 's1', 'meeting-2');

        assert.equal(disconnected, false);
        sinon.assert.notCalled(llmService.disconnect);
        assert.equal(llmService.getAllConnections().has('s1'), true);
      });

      it('disconnectAllLLM clears all sessions', async () => {
        llmService.disconnectAll = sinon.stub().resolves(true);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        await llmService.registerAndConnect(locusUrl2, datachannelUrl2, undefined, 's2');

        await llmService.disconnectAllLLM({code: 1000, reason: 'all'});

        sinon.assert.calledOnce(llmService.disconnectAll);
        assert.equal(llmService.getAllConnections().size, 0);
      });
    });

    describe('#getLocusUrlByDatachannelUrl', () => {
      const locusUrl2 = 'https://locus-b.wbx2.com/locus/api/v1/loci/456';
      const datachannelUrl2 = 'https://board-b.wbx2.com/datachannel/api/v1/locus/ps-encoded/registrations';

      // Ampersand State.extend() does not always propagate prototype methods
      // added to child classes, so we bind the method from the class prototype
      // directly onto the test instance.
      beforeEach(() => {
        llmService.getLocusUrlByDatachannelUrl = LLMChannel.prototype.getLocusUrlByDatachannelUrl.bind(llmService);
      });

      it('returns locusUrl when request URL matches a session datachannelUrl', async () => {
        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        await llmService.registerAndConnect(locusUrl2, datachannelUrl2, undefined, 's2');

        const result = llmService.getLocusUrlByDatachannelUrl(datachannelUrl2 + '/some-path');

        assert.equal(result, locusUrl2);
      });

      it('returns undefined when no session matches the request URL', async () => {
        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');

        const result = llmService.getLocusUrlByDatachannelUrl('https://unknown.example.com/path');

        assert.equal(result, undefined);
      });

      it('matches locusUrl when request host is rewritten but pathname matches', async () => {
        await llmService.registerAndConnect(locusUrl2, datachannelUrl2, undefined, 's2');

        const rewrittenHostRequestUrl =
          'https://hostmap-rewritten.example.com/datachannel/api/v1/locus/ps-encoded/registrations/events';
        const result = llmService.getLocusUrlByDatachannelUrl(rewrittenHostRequestUrl);

        assert.equal(result, locusUrl2);
      });

      it('returns undefined when no connections exist', () => {
        const result = llmService.getLocusUrlByDatachannelUrl(datachannelUrl);

        assert.equal(result, undefined);
      });
    });

    describe('#getSessionIdByDatachannelUrl', () => {
      const datachannelUrl2 = 'https://board-b.wbx2.com/datachannel/api/v1/locus/ps-encoded/registrations';

      beforeEach(() => {
        llmService.getSessionIdByDatachannelUrl = LLMChannel.prototype.getSessionIdByDatachannelUrl.bind(llmService);
      });

      it('returns sessionId when request URL matches a session datachannelUrl', async () => {
        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');
        await llmService.registerAndConnect('https://locus-b.wbx2.com/locus/api/v1/loci/456', datachannelUrl2, undefined, 's2');

        const result = llmService.getSessionIdByDatachannelUrl(datachannelUrl2 + '/some-path');

        assert.equal(result, 's2');
      });

      it('returns undefined when no session matches the request URL', async () => {
        await llmService.registerAndConnect(locusUrl, datachannelUrl, undefined, 's1');

        const result = llmService.getSessionIdByDatachannelUrl('https://unknown.example.com/path');

        assert.equal(result, undefined);
      });

      it('matches sessionId when request host is rewritten but pathname matches', async () => {
        await llmService.registerAndConnect(
          'https://locus-b.wbx2.com/locus/api/v1/loci/456',
          datachannelUrl2,
          undefined,
          's2'
        );

        const rewrittenHostRequestUrl =
          'https://hostmap-rewritten.example.com/datachannel/api/v1/locus/ps-encoded/registrations/messages';
        const result = llmService.getSessionIdByDatachannelUrl(rewrittenHostRequestUrl);

        assert.equal(result, 's2');
      });
    });

  });
});
