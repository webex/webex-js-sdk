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

    describe('#createChannel', () => {
      it('creates a new LLMChannel instance', () => {
        const channel = plugin.createChannel();

        assert.instanceOf(channel, LLMChannel);
      });

      it('adds the channel to the channels registry', () => {
        const channel = plugin.createChannel();

        const channels = plugin.getAllChannels();

        assert.equal(channels.size, 1);
        assert.isTrue(channels.has(channel));
      });

      it('creates independent channels for multiple calls', () => {
        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();

        assert.notStrictEqual(channel1, channel2);
        assert.equal(plugin.getAllChannels().size, 2);
      });
    });

    describe('#getAllChannels', () => {
      it('returns an empty set when no channels exist', () => {
        const channels = plugin.getAllChannels();

        assert.equal(channels.size, 0);
      });

      it('returns a copy of the channels set', () => {
        const channel = plugin.createChannel();
        const channels = plugin.getAllChannels();

        // Verify it's a copy, not the same reference
        channels.delete(channel);
        assert.equal(plugin.getAllChannels().size, 1);
      });
    });

    describe('#disconnectAllChannels', () => {
      it('disconnects all active channels', async () => {
        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();

        sinon.stub(channel1, 'disconnect').resolves();
        sinon.stub(channel2, 'disconnect').resolves();

        await plugin.disconnectAllChannels({code: 1000, reason: 'cleanup'});

        sinon.assert.calledOnceWithExactly(channel1.disconnect, {code: 1000, reason: 'cleanup'});
        sinon.assert.calledOnceWithExactly(channel2.disconnect, {code: 1000, reason: 'cleanup'});
      });

      it('works with no active channels', async () => {
        await plugin.disconnectAllChannels({code: 1000, reason: 'cleanup'});

        assert.equal(plugin.getAllChannels().size, 0);
      });
    });

    describe('#getChannelByDatachannelUrl', () => {
      it('returns channel matching datachannel URL', () => {
        const channel = plugin.createChannel();

        sinon
          .stub(channel, 'getDatachannelUrl')
          .returns('https://board.wbx2.com/datachannel/api/v1/locus/123/registrations');

        const result = plugin.getChannelByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/123/registrations/events'
        );

        assert.equal(result, channel);
      });

      it('returns undefined when no match', () => {
        const channel = plugin.createChannel();

        sinon.stub(channel, 'getDatachannelUrl').returns('https://board.wbx2.com/datachannel/123');

        const result = plugin.getChannelByDatachannelUrl('https://unknown.example.com');

        assert.equal(result, undefined);
      });

      it('returns undefined when no channels exist', () => {
        const result = plugin.getChannelByDatachannelUrl('https://example.com');

        assert.equal(result, undefined);
      });

      it('skips channels with no datachannel URL set', () => {
        const channel = plugin.createChannel();

        sinon.stub(channel, 'getDatachannelUrl').returns(undefined);

        const result = plugin.getChannelByDatachannelUrl('https://example.com');

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

    describe('channel isolation multi-meeting scenarios', () => {
      it('disconnecting one channel does not affect another channel', async () => {
        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();

        // Stub disconnect on channel1 only - simulating the real behavior where
        // disconnect clears the connected state
        sinon.stub(channel1, 'disconnect').callsFake(async function () {
          this.connected = false;
        });

        // Simulate both channels being connected
        channel1.connected = true;
        channel2.connected = true;

        // Disconnect channel1 with permanent code (simulating meeting end)
        await channel1.disconnect({code: 3050, reason: 'done (permanent)'});

        // Channel2 should still be connected - its state is independent
        assert.equal(channel2.isConnected(), true);

        // Channel1 should be disconnected
        assert.equal(channel1.isConnected(), false);

        // Verify that disconnect was called on channel1
        sinon.assert.calledOnceWithExactly(channel1.disconnect, {
          code: 3050,
          reason: 'done (permanent)',
        });
      });

      it('channels for same locus URL are still independent instances', async () => {
        const sameLocus = 'https://locus.example.com/loci/shared-meeting';
        const sameDc = 'https://datachannel.example.com/dc/shared';

        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();

        // Both channels have the same locus URL (the scenario in the bug)
        sinon.stub(channel1, 'getLocusUrl').returns(sameLocus);
        sinon.stub(channel1, 'getDatachannelUrl').returns(sameDc);
        sinon.stub(channel2, 'getLocusUrl').returns(sameLocus);
        sinon.stub(channel2, 'getDatachannelUrl').returns(sameDc);

        // They are separate instances despite same URLs
        assert.notStrictEqual(channel1, channel2);

        // Both are tracked independently
        const channels = plugin.getAllChannels();

        assert.equal(channels.size, 2);
        assert.isTrue(channels.has(channel1));
        assert.isTrue(channels.has(channel2));
      });

      it('simulates overlapping meeting lifecycle without cross-channel impact', async () => {
        // Scenario: Meeting A is ending while Meeting B is starting for the same locus
        const sameLocus = 'https://locus.example.com/loci/abc123';
        const sameDc = 'https://datachannel.example.com/dc/abc123';

        // Meeting A has an active channel
        const channelA = plugin.createChannel();

        sinon.stub(channelA, 'getLocusUrl').returns(sameLocus);
        sinon.stub(channelA, 'getDatachannelUrl').returns(sameDc);
        sinon.stub(channelA, 'disconnect').resolves();
        channelA.connected = true;

        // Meeting B creates its own channel for the same locus
        const channelB = plugin.createChannel();

        sinon.stub(channelB, 'registerAndConnect').resolves();
        sinon.stub(channelB, 'isConnected').returns(false);

        // Meeting A ends and disconnects with permanent code
        await channelA.disconnect({code: 3050, reason: 'done (permanent)'});

        // Meeting B connects - this should work because it has its own channel
        await channelB.registerAndConnect(sameLocus, sameDc);

        // Assert: channelA's disconnect was called
        sinon.assert.calledOnceWithExactly(channelA.disconnect, {
          code: 3050,
          reason: 'done (permanent)',
        });

        // Assert: channelB's registerAndConnect was called (not blocked by A's disconnect)
        sinon.assert.calledOnceWithExactly(channelB.registerAndConnect, sameLocus, sameDc);
      });

      it('individual channel disconnect removes only that channel from registry', async () => {
        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();
        const channel3 = plugin.createChannel();

        assert.equal(plugin.getAllChannels().size, 3);

        // Disconnect channel2 - real disconnect triggers onDisconnect callback
        await channel2.disconnect({code: 3050, reason: 'meeting ended'});

        // Only channel2 should be removed from registry
        const channels = plugin.getAllChannels();

        assert.equal(channels.size, 2);
        assert.isTrue(channels.has(channel1));
        assert.isFalse(channels.has(channel2));
        assert.isTrue(channels.has(channel3));
      });

      it('getChannelByDatachannelUrl returns correct channel when multiple exist for similar URLs', () => {
        const channel1 = plugin.createChannel();
        const channel2 = plugin.createChannel();

        // Different locus IDs in the URL
        sinon
          .stub(channel1, 'getDatachannelUrl')
          .returns('https://board.wbx2.com/datachannel/api/v1/locus/meeting-111/registrations');
        sinon
          .stub(channel2, 'getDatachannelUrl')
          .returns('https://board.wbx2.com/datachannel/api/v1/locus/meeting-222/registrations');

        // Request for meeting-111 should return channel1
        const result1 = plugin.getChannelByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/meeting-111/registrations/events'
        );

        assert.equal(result1, channel1);

        // Request for meeting-222 should return channel2
        const result2 = plugin.getChannelByDatachannelUrl(
          'https://board.wbx2.com/datachannel/api/v1/locus/meeting-222/registrations/events'
        );

        assert.equal(result2, channel2);
      });

      it('multi-webinar PS token refresh routes to correct meeting (webinar A vs B coexistence)', async () => {
        // Scenario: User hosts webinar A and joins webinar B as promoted panelist.
        // Both webinars have practice session (PS) channels with different locus URLs.
        // When A's PS token expires, the refresh must use A's locus URL, not B's.
        //
        // This test verifies URL-based routing, not actual JWT expiry. The real flow is:
        //   1. Request to datachannel URL fails with 401/403 (expired token)
        //   2. Interceptor extracts the request URL from the error
        //   3. Interceptor calls getChannelByDatachannelUrl(requestUrl) to find the channel
        //   4. Interceptor calls channel.refreshDataChannelToken() to get new token
        //   5. Interceptor retries the original request
        //
        // We test steps 3-4: given a request URL, does the correct channel's refresh get called?

        const webinarALocusUrl = 'https://locus.wbx2.com/loci/webinar-aaa-111';
        const webinarBLocusUrl = 'https://locus.wbx2.com/loci/webinar-bbb-222';
        const webinarAPSDatachannelUrl =
          'https://board.wbx2.com/datachannel/api/v1/locus/webinar-aaa-111/practiceSession/registrations';
        const webinarBPSDatachannelUrl =
          'https://board.wbx2.com/datachannel/api/v1/locus/webinar-bbb-222/practiceSession/registrations';

        const psChannelA = plugin.createChannel();
        const psChannelB = plugin.createChannel();

        // Mock meeting refresh handlers that track which meeting's handler was invoked
        const refreshCallLog = [];
        const mockMeetingARefresh = () => {
          refreshCallLog.push({meeting: 'A', locusUrl: webinarALocusUrl});

          return Promise.resolve({body: {datachannelToken: 'new-token-for-A'}});
        };
        const mockMeetingBRefresh = () => {
          refreshCallLog.push({meeting: 'B', locusUrl: webinarBLocusUrl});

          return Promise.resolve({body: {datachannelToken: 'new-token-for-B'}});
        };

        sinon.stub(psChannelA, 'getDatachannelUrl').returns(webinarAPSDatachannelUrl);
        sinon.stub(psChannelB, 'getDatachannelUrl').returns(webinarBPSDatachannelUrl);
        psChannelA.setRefreshHandler(mockMeetingARefresh);
        psChannelB.setRefreshHandler(mockMeetingBRefresh);

        // --- Simulate interceptor handling a 401 on webinar A's request ---
        const failingRequestUrlA = webinarAPSDatachannelUrl + '/events';
        const channelForARequest = plugin.getChannelByDatachannelUrl(failingRequestUrlA);

        assert.equal(channelForARequest, psChannelA);

        await channelForARequest.refreshDataChannelToken();

        assert.equal(refreshCallLog.length, 1);
        assert.equal(refreshCallLog[0].meeting, 'A');
        assert.equal(refreshCallLog[0].locusUrl, webinarALocusUrl);

        // --- Simulate interceptor handling a 401 on webinar B's request ---
        refreshCallLog.length = 0;

        const failingRequestUrlB = webinarBPSDatachannelUrl + '/events';
        const channelForBRequest = plugin.getChannelByDatachannelUrl(failingRequestUrlB);

        assert.equal(channelForBRequest, psChannelB);

        await channelForBRequest.refreshDataChannelToken();

        assert.equal(refreshCallLog.length, 1);
        assert.equal(refreshCallLog[0].meeting, 'B');
        assert.equal(refreshCallLog[0].locusUrl, webinarBLocusUrl);
      });

      it('PS channel refresh handlers remain independent after subsequent channel creation', async () => {
        // Verify that creating channel B does not affect channel A's refresh handler

        const psChannelA = plugin.createChannel();
        const mockRefreshA = sinon.stub().resolves({body: {datachannelToken: 'token-A'}});

        psChannelA.setRefreshHandler(mockRefreshA);

        // Create channel B after A (simulating User 1 getting promoted in webinar B)
        const psChannelB = plugin.createChannel();
        const mockRefreshB = sinon.stub().resolves({body: {datachannelToken: 'token-B'}});

        psChannelB.setRefreshHandler(mockRefreshB);

        // Verify A's handler was not affected by B's setup
        const resultA = await psChannelA.refreshDataChannelToken();

        assert.equal(resultA.body.datachannelToken, 'token-A');
        sinon.assert.calledOnce(mockRefreshA);
        sinon.assert.notCalled(mockRefreshB);

        // Verify B has its own handler
        const resultB = await psChannelB.refreshDataChannelToken();

        assert.equal(resultB.body.datachannelToken, 'token-B');
        sinon.assert.calledOnce(mockRefreshB);
      });
    });
  });
});
