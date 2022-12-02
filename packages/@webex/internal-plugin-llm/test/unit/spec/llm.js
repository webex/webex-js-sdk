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
      llmService.connect = sinon.stub().resolves(true);
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

    describe('#disconnect', () => {
      it('disconnects mercury', async () => {
        await llmService.disconnect();
        sinon.assert.calledOnce(llmService.disconnect);
        assert.equal(llmService.isConnected(), false);
        assert.equal(llmService.getLocusUrl(), undefined);
        assert.equal(llmService.getBinding(), undefined);
      });
    });
  });
});
