import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import {LLMPlugin} from '@webex/internal-plugin-llm/src/llm-plugin';
import {LLM_DEFAULT_SESSION} from '@webex/internal-plugin-llm/src/constants';

describe('plugin-llm', () => {
  describe('LLMPlugin', () => {
    let webex;
    let plugin;
    let mockChannel;

    const createMockChannel = () => ({
      registerAndConnect: sinon.stub().resolves(),
      disconnectLLM: sinon.stub().resolves(),
      isConnected: sinon.stub().returns(false),
      getBinding: sinon.stub().returns('binding'),
      getLocusUrl: sinon.stub().returns('locusUrl'),
      getDatachannelUrl: sinon.stub().returns('datachannelUrl'),
      getDatachannelToken: sinon.stub().returns('token'),
      setDatachannelToken: sinon.stub(),
      clearDatachannelToken: sinon.stub(),
      setRefreshHandler: sinon.stub(),
      refreshDataChannelToken: sinon.stub().resolves({body: {datachannelToken: 'newToken'}}),
      socket: {send: sinon.stub()},
      ownerMeetingId: undefined,
      hasEverConnected: false,
      on: sinon.stub(),
    });

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
        },
      });

      webex.internal.feature = {
        getFeature: sinon.stub().resolves(true),
      };

      plugin = new LLMPlugin({}, {parent: webex});

      mockChannel = createMockChannel();
    });

    afterEach(() => sinon.restore());

    describe('#disconnectLLM', () => {
      it('calls disconnect and removes session from map', async () => {
        // Create a session first
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = await plugin.disconnectLLM(
          {code: 3000, reason: 'bye'},
          LLM_DEFAULT_SESSION,
          'meeting-1'
        );

        sinon.assert.calledOnceWithExactly(mockChannel.disconnectLLM, {code: 3000, reason: 'bye'});
        assert.equal(plugin.sessions.has(LLM_DEFAULT_SESSION), false);
        assert.equal(result, true);
      });

      it('resolves without error when session does not exist', async () => {
        const result = await plugin.disconnectLLM(
          {code: 1000, reason: 'test'},
          'non-existent-session'
        );

        assert.equal(result, undefined);
      });

      it('skips disconnect if not the owner', async () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = await plugin.disconnectLLM(
          {code: 1000, reason: 'test'},
          LLM_DEFAULT_SESSION,
          'meeting-2'
        );

        sinon.assert.notCalled(mockChannel.disconnectLLM);
        assert.equal(plugin.sessions.has(LLM_DEFAULT_SESSION), true);
        assert.equal(result, false);
      });

      it('disconnects if owner matches', async () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = await plugin.disconnectLLM(
          {code: 1000, reason: 'test'},
          LLM_DEFAULT_SESSION,
          'meeting-1'
        );

        sinon.assert.calledOnce(mockChannel.disconnectLLM);
        assert.equal(plugin.sessions.has(LLM_DEFAULT_SESSION), false);
        assert.equal(result, true);
      });

      it('disconnects if no owner is set', async () => {
        mockChannel.ownerMeetingId = undefined;
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = await plugin.disconnectLLM(
          {code: 1000, reason: 'test'},
          LLM_DEFAULT_SESSION,
          'meeting-1'
        );

        sinon.assert.calledOnce(mockChannel.disconnectLLM);
        assert.equal(result, true);
      });

      it('supports legacy call with options only', async () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        await plugin.disconnectLLM({code: 1000, reason: 'test'});

        sinon.assert.calledOnce(mockChannel.disconnectLLM);
        assert.equal(plugin.sessions.has(LLM_DEFAULT_SESSION), false);
      });

      it('supports legacy call with options and sessionId', async () => {
        plugin.sessions.set('custom-session', mockChannel);

        await plugin.disconnectLLM({code: 1000, reason: 'test'}, 'custom-session');

        sinon.assert.calledOnceWithExactly(mockChannel.disconnectLLM, {code: 1000, reason: 'test'});
        assert.equal(plugin.sessions.has('custom-session'), false);
      });
    });

    describe('#disconnectAllLLM', () => {
      it('disconnects and removes all sessions', async () => {
        const channel1 = createMockChannel();
        const channel2 = createMockChannel();

        plugin.sessions.set('session-1', channel1);
        plugin.sessions.set('session-2', channel2);

        await plugin.disconnectAllLLM({code: 1000, reason: 'cleanup'});

        sinon.assert.calledOnceWithExactly(channel1.disconnectLLM, {code: 1000, reason: 'cleanup'});
        sinon.assert.calledOnceWithExactly(channel2.disconnectLLM, {code: 1000, reason: 'cleanup'});
        assert.equal(plugin.sessions.size, 0);
      });

      it('works with no active sessions', async () => {
        await plugin.disconnectAllLLM({code: 1000, reason: 'cleanup'});

        assert.equal(plugin.sessions.size, 0);
      });
    });

    describe('#resolveSessionOwnership', () => {
      it('returns isOwner true when no current owner', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);
        mockChannel.ownerMeetingId = undefined;

        const result = plugin.resolveSessionOwnership('meeting-1', LLM_DEFAULT_SESSION);

        assert.deepEqual(result, {currentOwner: undefined, isOwner: true});
      });

      it('returns isOwner true when no ownerMeetingId provided', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);
        mockChannel.ownerMeetingId = 'meeting-1';

        const result = plugin.resolveSessionOwnership(undefined, LLM_DEFAULT_SESSION);

        assert.deepEqual(result, {currentOwner: 'meeting-1', isOwner: true});
      });

      it('returns isOwner true when owner matches', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);
        mockChannel.ownerMeetingId = 'meeting-1';

        const result = plugin.resolveSessionOwnership('meeting-1', LLM_DEFAULT_SESSION);

        assert.deepEqual(result, {currentOwner: 'meeting-1', isOwner: true});
      });

      it('returns isOwner false when owner does not match', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);
        mockChannel.ownerMeetingId = 'meeting-1';

        const result = plugin.resolveSessionOwnership('meeting-2', LLM_DEFAULT_SESSION);

        assert.deepEqual(result, {currentOwner: 'meeting-1', isOwner: false});
      });
    });

    describe('#registerAndConnect', () => {
      it('creates session and calls registerAndConnect on channel', async () => {
        // Stub the internal getOrCreateSession to return our mock
        sinon.stub(plugin, 'getOrCreateSession').returns(mockChannel);

        await plugin.registerAndConnect('locusUrl', 'datachannelUrl', 'token', 'session-1');

        sinon.assert.calledOnceWithExactly(
          mockChannel.registerAndConnect,
          'locusUrl',
          'datachannelUrl',
          'token'
        );
      });

      it('uses default session when sessionId not provided', async () => {
        sinon.stub(plugin, 'getOrCreateSession').returns(mockChannel);

        await plugin.registerAndConnect('locusUrl', 'datachannelUrl', 'token');

        sinon.assert.calledOnceWithExactly(plugin.getOrCreateSession, LLM_DEFAULT_SESSION);
      });
    });

    describe('#isConnected', () => {
      it('returns false when session does not exist', () => {
        assert.equal(plugin.isConnected('non-existent'), false);
      });

      it('returns channel isConnected value', () => {
        mockChannel.isConnected.returns(true);
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.isConnected(LLM_DEFAULT_SESSION), true);
      });
    });

    describe('#getBinding', () => {
      it('returns undefined when session does not exist', () => {
        assert.equal(plugin.getBinding('non-existent'), undefined);
      });

      it('returns channel binding', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.getBinding(LLM_DEFAULT_SESSION), 'binding');
      });
    });

    describe('#getSocket', () => {
      it('returns undefined when session does not exist', () => {
        assert.equal(plugin.getSocket('non-existent'), undefined);
      });

      it('returns channel socket', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.getSocket(LLM_DEFAULT_SESSION), mockChannel.socket);
      });
    });

    describe('#socket (getter)', () => {
      it('returns default session socket for backwards compatibility', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.socket, mockChannel.socket);
      });
    });

    describe('#setDatachannelToken', () => {
      it('sets token when owner matches', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.setDatachannelToken('newToken', 'meeting-1', LLM_DEFAULT_SESSION);

        sinon.assert.calledOnceWithExactly(mockChannel.setDatachannelToken, 'newToken');
      });

      it('skips setting token when not owner', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.setDatachannelToken('newToken', 'meeting-2', LLM_DEFAULT_SESSION);

        sinon.assert.notCalled(mockChannel.setDatachannelToken);
      });
    });

    describe('#getDatachannelToken', () => {
      it('returns token when owner matches', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const token = plugin.getDatachannelToken(LLM_DEFAULT_SESSION, 'meeting-1');

        assert.equal(token, 'token');
      });

      it('returns undefined when not owner', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const token = plugin.getDatachannelToken(LLM_DEFAULT_SESSION, 'meeting-2');

        assert.equal(token, undefined);
      });

      it('returns undefined when session does not exist', () => {
        const token = plugin.getDatachannelToken('non-existent');

        assert.equal(token, undefined);
      });
    });

    describe('#clearDatachannelToken', () => {
      it('clears token when owner matches', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.clearDatachannelToken(LLM_DEFAULT_SESSION, 'meeting-1');

        sinon.assert.calledOnce(mockChannel.clearDatachannelToken);
      });

      it('skips clearing when not owner', () => {
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.clearDatachannelToken(LLM_DEFAULT_SESSION, 'meeting-2');

        sinon.assert.notCalled(mockChannel.clearDatachannelToken);
      });
    });

    describe('#setOwnerMeetingId / #getOwnerMeetingId', () => {
      it('sets and gets owner meeting id', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.setOwnerMeetingId('meeting-1', LLM_DEFAULT_SESSION);

        assert.equal(mockChannel.ownerMeetingId, 'meeting-1');
        assert.equal(plugin.getOwnerMeetingId(LLM_DEFAULT_SESSION), 'meeting-1');
      });

      it('returns undefined when session does not exist', () => {
        assert.equal(plugin.getOwnerMeetingId('non-existent'), undefined);
      });
    });

    describe('#hasEverConnected', () => {
      it('returns false when no sessions exist', () => {
        assert.equal(plugin.hasEverConnected, false);
      });

      it('returns true when any session has connected', () => {
        mockChannel.hasEverConnected = true;
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.hasEverConnected, true);
      });

      it('returns false when no session has connected', () => {
        mockChannel.hasEverConnected = false;
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        assert.equal(plugin.hasEverConnected, false);
      });
    });

    describe('#getConnectionByDatachannelUrl', () => {
      it('returns channel matching datachannel URL', () => {
        mockChannel.getDatachannelUrl.returns(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations'
        );
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = plugin.getConnectionByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, mockChannel);
      });

      it('returns undefined when no match', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = plugin.getConnectionByDatachannelUrl('https://unknown.example.com');

        assert.equal(result, undefined);
      });
    });

    describe('#getLocusUrlByDatachannelUrl', () => {
      it('returns locus URL for matching datachannel URL', () => {
        mockChannel.getDatachannelUrl.returns(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations'
        );
        mockChannel.getLocusUrl.returns('https://locus.example.com/123');
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = plugin.getLocusUrlByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, 'https://locus.example.com/123');
      });
    });

    describe('#getSessionIdByDatachannelUrl', () => {
      it('returns sessionId for matching datachannel URL', () => {
        mockChannel.getDatachannelUrl.returns(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations'
        );
        plugin.sessions.set('my-session', mockChannel);

        const result = plugin.getSessionIdByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, 'my-session');
      });
    });

    describe('#getAllConnections', () => {
      it('returns copy of sessions map', () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = plugin.getAllConnections();

        assert.equal(result.size, 1);
        assert.equal(result.get(LLM_DEFAULT_SESSION), mockChannel);
        assert.notStrictEqual(result, plugin.sessions);
      });
    });

    describe('#refreshDataChannelToken', () => {
      it('calls channel refreshDataChannelToken', async () => {
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        const result = await plugin.refreshDataChannelToken(LLM_DEFAULT_SESSION);

        sinon.assert.calledOnce(mockChannel.refreshDataChannelToken);
        assert.deepEqual(result, {body: {datachannelToken: 'newToken'}});
      });

      it('returns null when session does not exist', async () => {
        const result = await plugin.refreshDataChannelToken('non-existent');

        assert.equal(result, null);
      });
    });

    describe('#setRefreshHandler', () => {
      it('sets handler when owner matches', () => {
        const handler = sinon.stub();
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.setRefreshHandler(handler, 'meeting-1', LLM_DEFAULT_SESSION);

        sinon.assert.calledOnceWithExactly(mockChannel.setRefreshHandler, handler);
      });

      it('skips setting handler when not owner', () => {
        const handler = sinon.stub();
        mockChannel.ownerMeetingId = 'meeting-1';
        plugin.sessions.set(LLM_DEFAULT_SESSION, mockChannel);

        plugin.setRefreshHandler(handler, 'meeting-2', LLM_DEFAULT_SESSION);

        sinon.assert.notCalled(mockChannel.setRefreshHandler);
      });
    });

    describe('event forwarding', () => {
      let triggerSpy;

      beforeEach(() => {
        triggerSpy = sinon.spy(plugin, 'trigger');
      });

      it('forwards default session events without suffix', () => {
        // Create a session via getOrCreateSession (creates real LLMChannel with event handler)
        const channel = plugin.getOrCreateSession(LLM_DEFAULT_SESSION);

        // Trigger an event on the channel - the 'all' handler should forward it
        channel.trigger('event:relay.event', {data: 'test'});

        sinon.assert.calledOnceWithExactly(triggerSpy, 'event:relay.event', {data: 'test'});
      });

      it('forwards non-default session events with sessionId suffix', () => {
        const practiceSession = 'llm-practice-session';

        // Create a session via getOrCreateSession (creates real LLMChannel with event handler)
        const channel = plugin.getOrCreateSession(practiceSession);

        // Trigger an event on the channel - the 'all' handler should forward it with suffix
        channel.trigger('event:relay.event', {data: 'test'});

        sinon.assert.calledOnceWithExactly(triggerSpy, `event:relay.event:${practiceSession}`, {
          data: 'test',
        });
      });

      it('forwards locus events with sessionId suffix for practice session', () => {
        const practiceSession = 'llm-practice-session';

        const channel = plugin.getOrCreateSession(practiceSession);

        channel.trigger('event:locus.state_message', {locusData: 'test'});

        sinon.assert.calledOnceWithExactly(
          triggerSpy,
          `event:locus.state_message:${practiceSession}`,
          {locusData: 'test'}
        );
      });
    });
  });
});
