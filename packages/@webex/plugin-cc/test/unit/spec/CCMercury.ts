import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import CCMercury, {mercuryConfig} from '../../../src/CCMercury';
import {CC_EVENTS} from '../../../src/constants';

describe('plugin-cc CCMercury tests', () => {
  const locusUrl = 'locusUrl';
  const datachannelUrl = 'datachannelUrl';

  describe('CCMercury', () => {
    let webex, ccMercury;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          cc: CCMercury,
        },
      });

      ccMercury = new CCMercury(
        {},
        {
          parent: webex,
        }
      );
      ccMercury.connect = sinon.stub().callsFake(() => {
        ccMercury.connected = true;
      });
      ccMercury.disconnect = sinon.stub().resolves(true);
      ccMercury.request = sinon.stub().resolves({
        headers: {},
        body: {
          binding: 'binding',
          webSocketUrl: 'url',
        },
      });

      // Mock event handling
      ccMercury.on = sinon.stub((event, callback) => {
        if (event === 'event') {
          ccMercury._eventCallback = callback;
        }
      });
    });

    describe('#registerAndConnect', () => {
      it('registers connection', async () => {
        ccMercury.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        assert.equal(ccMercury.isConnected(), false);
        await ccMercury.registerAndConnect(datachannelUrl, {deviceUrl: webex.internal.device.url});
        assert.equal(ccMercury.isConnected(), true);
      });

      it("doesn't register connection for invalid input", async () => {
        ccMercury.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        await ccMercury.registerAndConnect();
        assert.equal(ccMercury.isConnected(), false);
      });
    });

    describe('#register', () => {
      it('registers connection', async () => {
        await ccMercury.register(datachannelUrl, {deviceUrl: webex.internal.device.url});

        sinon.assert.calledOnceWithExactly(
          ccMercury.request,
          sinon.match({
            method: 'POST',
            url: datachannelUrl,
            body: {deviceUrl: webex.internal.device.url},
          })
        );
      });

      it('throws error if registration fails', async () => {
        const mockError = new Error('Connection error');
        ccMercury.request.rejects(mockError);

        try {
          await ccMercury.register(datachannelUrl, {deviceUrl: webex.internal.device.url});
          assert.fail('Expected error was not thrown');
        } catch (error) {
          assert.equal(error, mockError);
        }
      });
    });

    describe('#getDatachannelUrl', () => {
      it('gets dataChannel Url', async () => {
        ccMercury.register = sinon.stub().resolves({
          body: {
            binding: 'binding',
            webSocketUrl: 'url',
          },
        });
        await ccMercury.registerAndConnect(datachannelUrl, {deviceUrl: webex.internal.device.url});
        assert.equal(ccMercury.getDatachannelUrl(), datachannelUrl);
      });
    });

    describe('#disconnect', () => {
      it('disconnects mercury', async () => {
        await ccMercury.disconnect();
        sinon.assert.calledOnce(ccMercury.disconnect);
        assert.equal(ccMercury.isConnected(), false);
        assert.equal(ccMercury.getDatachannelUrl(), undefined);
        assert.equal(ccMercury.getBinding(), undefined);
      });
    });
  });
});
