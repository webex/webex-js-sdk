import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMService from '@webex/internal-plugin-llm';

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
      llmService.connect = sinon.stub().callsFake(() => {
        llmService.connected = true;
      });
      llmService.disconnect = sinon.stub().resolves(true);
      llmService.request = sinon.stub().resolves({
        headers: {},
        body: {
          binding: 'binding',
          webSocketUrl: 'url',
        },
      });
    });

    describe('#registerAndConnect', () => {
      it('registers connection', async () => {
        llmService.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        assert.equal(llmService.isConnected(), false);
        await llmService.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmService.isConnected(), true);
      });

      it("doesn't registers connection for invalid input", async () => {
        llmService.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        await llmService.registerAndConnect();
        assert.equal(llmService.isConnected(), false);
      });

      it('registers connection with token', async () => {
        llmService.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });

        assert.equal(llmService.isConnected(), false);

        await llmService.registerAndConnect(locusUrl, datachannelUrl, 'abc123');

        sinon.assert.calledOnceWithExactly(
          llmService.register,
          datachannelUrl,
          'abc123'
        );

        assert.equal(llmService.isConnected(), true);
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
        llmService.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        await llmService.registerAndConnect(locusUrl, datachannelUrl);
        assert.equal(llmService.getLocusUrl(), locusUrl);
      });
    });

    describe('#getDatachannelUrl', () => {
      it('gets dataChannel Url', async () => {
        llmService.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
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

    describe('disconnectLLM', () => {
      let instance;

      beforeEach(() => {
        instance = {
          disconnect: jest.fn(() => Promise.resolve()),
          locusUrl: 'someUrl',
          datachannelUrl: 'someUrl',
          binding: {},
          webSocketUrl: 'someUrl',
          disconnectLLM: function (options) {
            return this.disconnect(options).then(() => {
              this.locusUrl = undefined;
              this.datachannelUrl = undefined;
              this.binding = undefined;
              this.webSocketUrl = undefined;
            });
          }
        };
      });

      it('should call disconnect and clear relevant properties', async () => {
        await instance.disconnectLLM({});

        expect(instance.disconnect).toHaveBeenCalledWith({});
        expect(instance.locusUrl).toBeUndefined();
        expect(instance.datachannelUrl).toBeUndefined();
        expect(instance.binding).toBeUndefined();
        expect(instance.webSocketUrl).toBeUndefined();
      });

      it('should handle errors from disconnect gracefully', async () => {
        instance.disconnect.mockRejectedValue(new Error('Disconnect failed'));

        await expect(instance.disconnectLLM({})).rejects.toThrow('Disconnect failed');
      });
    });

    describe('#setRefreshHandler', () => {
      it('stores the provided handler', () => {
        const handler = sinon.stub().resolves({ body: { datachannelToken: 'newToken' } });
        llmService.setRefreshHandler(handler);

        // @ts-ignore
        assert.equal(llmService.refreshHandler, handler);
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
      it('throws if no handler is set', async () => {
        try {
          await llmService.refreshDataChannelToken();
          assert.fail('Should have thrown');
        } catch (err) {
          assert.match(err.message, 'LLM refreshHandler is not set');
        }
      });

      it('returns token when handler resolves', async () => {
        const mockToken = { body: { datachannelToken: 'newToken' ,isPracticeSession: false} }
        const handler = sinon.stub().resolves(mockToken);
        llmService.setRefreshHandler(handler);

        const token = await llmService.refreshDataChannelToken();
        assert.equal(token, mockToken);
        sinon.assert.calledOnce(handler);
      });

      it('logs and rethrows when handler rejects', async () => {
        const handler = sinon.stub().rejects(new Error('throw error'));

        const loggerSpy = llmService.logger.error;

        llmService.setRefreshHandler(handler);

        try {
          await llmService.refreshDataChannelToken();
          assert.fail('Should have thrown');
        } catch (err) {
          assert.match(err.message, /throw error/);
        }

        sinon.assert.calledOnce(loggerSpy);
        sinon.assert.calledWithMatch(
          loggerSpy,
          sinon.match("Error refreshing DataChannel token: Error: throw error")
        );
      });
    });

    describe('#getDatachannelToken / #setDatachannelToken', () => {
      it('sets and gets datachannel token', () => {
        llmService.setDatachannelToken('abc123','default');
        assert.equal(llmService.getDatachannelToken('default'), 'abc123');
        llmService.setDatachannelToken('123abc','practiceSession');
        assert.equal(llmService.getDatachannelToken('practiceSession'), '123abc');
      });
    });
  });
});
