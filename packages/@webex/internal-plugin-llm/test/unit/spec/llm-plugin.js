import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import {LLMPlugin} from '@webex/internal-plugin-llm/src/llm-plugin';
import LLMChannel from '@webex/internal-plugin-llm/src/llm';

describe('plugin-llm', () => {
  describe('LLMPlugin (Factory Pattern)', () => {
    let webex;
    let plugin;

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
    });

    afterEach(() => sinon.restore());

    describe('#createConnection', () => {
      it('creates a new LLMChannel instance', () => {
        const channel = plugin.createConnection();

        assert.instanceOf(channel, LLMChannel);
      });

      it('adds the channel to the connections registry', () => {
        const channel = plugin.createConnection();

        const connections = plugin.getAllConnections();

        assert.equal(connections.size, 1);
        assert.isTrue(connections.has(channel));
      });

      it('creates independent channels for multiple calls', () => {
        const channel1 = plugin.createConnection();
        const channel2 = plugin.createConnection();

        assert.notStrictEqual(channel1, channel2);
        assert.equal(plugin.getAllConnections().size, 2);
      });

      it('auto-unregisters channel when offline event fires', () => {
        const channel = plugin.createConnection();

        assert.equal(plugin.getAllConnections().size, 1);

        // Simulate offline event
        channel.trigger('offline');

        assert.equal(plugin.getAllConnections().size, 0);
      });
    });

    describe('#getAllConnections', () => {
      it('returns an empty set when no connections exist', () => {
        const connections = plugin.getAllConnections();

        assert.equal(connections.size, 0);
      });

      it('returns a copy of the connections set', () => {
        const channel = plugin.createConnection();
        const connections = plugin.getAllConnections();

        // Verify it's a copy, not the same reference
        connections.delete(channel);
        assert.equal(plugin.getAllConnections().size, 1);
      });
    });

    describe('#disconnectAll', () => {
      it('disconnects all active connections', async () => {
        const channel1 = plugin.createConnection();
        const channel2 = plugin.createConnection();

        sinon.stub(channel1, 'disconnect').resolves();
        sinon.stub(channel2, 'disconnect').resolves();

        await plugin.disconnectAll({code: 1000, reason: 'cleanup'});

        sinon.assert.calledOnceWithExactly(channel1.disconnect, {code: 1000, reason: 'cleanup'});
        sinon.assert.calledOnceWithExactly(channel2.disconnect, {code: 1000, reason: 'cleanup'});
      });

      it('works with no active connections', async () => {
        await plugin.disconnectAll({code: 1000, reason: 'cleanup'});

        assert.equal(plugin.getAllConnections().size, 0);
      });
    });

    describe('#getConnectionByDatachannelUrl', () => {
      it('returns channel matching datachannel URL', () => {
        const channel = plugin.createConnection();

        sinon
          .stub(channel, 'getDatachannelUrl')
          .returns('https://board.wbx2.com/datachannel/api/v1/locus/123/registrations');

        const result = plugin.getConnectionByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, channel);
      });

      it('returns undefined when no match', () => {
        const channel = plugin.createConnection();

        sinon.stub(channel, 'getDatachannelUrl').returns('https://board.wbx2.com/datachannel/123');

        const result = plugin.getConnectionByDatachannelUrl('https://unknown.example.com');

        assert.equal(result, undefined);
      });

      it('returns undefined when no connections exist', () => {
        const result = plugin.getConnectionByDatachannelUrl('https://example.com');

        assert.equal(result, undefined);
      });
    });

    describe('#getLocusUrlByDatachannelUrl', () => {
      it('returns locus URL for matching datachannel URL', () => {
        const channel = plugin.createConnection();

        sinon
          .stub(channel, 'getDatachannelUrl')
          .returns('https://board.wbx2.com/datachannel/api/v1/locus/123/registrations');
        sinon.stub(channel, 'getLocusUrl').returns('https://locus.example.com/123');

        const result = plugin.getLocusUrlByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, 'https://locus.example.com/123');
      });

      it('returns undefined when no match', () => {
        const result = plugin.getLocusUrlByDatachannelUrl('https://unknown.example.com');

        assert.equal(result, undefined);
      });
    });

    describe('#isDataChannelTokenEnabled', () => {
      it('returns true when feature flag is enabled', async () => {
        webex.internal.feature.getFeature.resolves(true);

        const result = await plugin.isDataChannelTokenEnabled();

        assert.equal(result, true);
        sinon.assert.calledOnceWithExactly(
          webex.internal.feature.getFeature,
          'developer',
          'data-channel-with-jwt-token'
        );
      });

      it('returns false when feature flag is disabled', async () => {
        webex.internal.feature.getFeature.resolves(false);

        const result = await plugin.isDataChannelTokenEnabled();

        assert.equal(result, false);
      });
    });

    describe('connection lifecycle', () => {
      it('channel remains in registry until offline', () => {
        const channel = plugin.createConnection();

        // Simulate connection then disconnection
        channel.trigger('online');
        assert.equal(plugin.getAllConnections().size, 1);

        channel.trigger('offline');
        assert.equal(plugin.getAllConnections().size, 0);
      });

      it('multiple channels can be managed independently', () => {
        const channel1 = plugin.createConnection();
        const channel2 = plugin.createConnection();

        assert.equal(plugin.getAllConnections().size, 2);

        // Disconnect only channel1
        channel1.trigger('offline');

        assert.equal(plugin.getAllConnections().size, 1);
        assert.isTrue(plugin.getAllConnections().has(channel2));
        assert.isFalse(plugin.getAllConnections().has(channel1));
      });
    });
  });
});
