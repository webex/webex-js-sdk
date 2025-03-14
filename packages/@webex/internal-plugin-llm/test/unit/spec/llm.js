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
    });

    describe('#register', () => {
      it('registers connection', async () => {
        await llmService.register(datachannelUrl);

        sinon.assert.calledOnceWithExactly(
          llmService.request,
          sinon.match({
            method: 'POST',
            url: `${datachannelUrl}`,
            body: {deviceUrl: webex.internal.device.url},
          })
        );

        assert.equal(llmService.getBinding(), 'binding');
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
  });
});
