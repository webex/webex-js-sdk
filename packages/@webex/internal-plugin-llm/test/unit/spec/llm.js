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
      // Stub Mercury's prototype disconnect so super.disconnect() works in tests
      sinon.stub(Object.getPrototypeOf(Object.getPrototypeOf(llmChannel)), 'disconnect').resolves();
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

    describe('#disconnect', () => {
      it('calls super.disconnect and clears all connection state', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        llmChannel.setDatachannelToken('token123');
        llmChannel.ownerMeetingId = 'meeting-1';

        assert.equal(llmChannel.isConnected(), true);
        assert.equal(llmChannel.getLocusUrl(), locusUrl);
        assert.equal(llmChannel.getDatachannelUrl(), datachannelUrl);
        assert.equal(llmChannel.getBinding(), 'binding');
        assert.equal(llmChannel.getDatachannelToken(), 'token123');
        assert.equal(llmChannel.ownerMeetingId, 'meeting-1');

        await llmChannel.disconnect({code: 1000, reason: 'test'});

        assert.equal(llmChannel.getLocusUrl(), undefined);
        assert.equal(llmChannel.getDatachannelUrl(), undefined);
        assert.equal(llmChannel.getBinding(), undefined);
        assert.equal(llmChannel.getDatachannelToken(), undefined);
        assert.equal(llmChannel.ownerMeetingId, undefined);
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

    describe('#ownerMeetingId', () => {
      it('stores and returns the owner meeting id', () => {
        llmChannel.ownerMeetingId = 'meeting-1';

        assert.equal(llmChannel.ownerMeetingId, 'meeting-1');
      });

      it('returns undefined when no owner has been set', () => {
        assert.equal(llmChannel.ownerMeetingId, undefined);
      });

      it('allows clearing ownership by setting undefined', () => {
        llmChannel.ownerMeetingId = 'meeting-1';
        assert.equal(llmChannel.ownerMeetingId, 'meeting-1');

        llmChannel.ownerMeetingId = undefined;

        assert.equal(llmChannel.ownerMeetingId, undefined);
      });

      it('is cleared by disconnect', async () => {
        await llmChannel.registerAndConnect(locusUrl, datachannelUrl);
        llmChannel.ownerMeetingId = 'meeting-1';
        assert.equal(llmChannel.ownerMeetingId, 'meeting-1');

        await llmChannel.disconnect({code: 1000, reason: 'test'});

        assert.equal(llmChannel.ownerMeetingId, undefined);
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
