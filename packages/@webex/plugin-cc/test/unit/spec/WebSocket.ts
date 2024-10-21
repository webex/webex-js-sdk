import MockWebex from '@webex/test-helper-mock-webex';
import { assert } from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import WebSocket from '../../../src/WebSocket/WebSocket';

describe('plugin-cc WebSocket tests', () => {
const datachannelUrl = 'datachannelUrl';

describe('WebSocket', () => {
let webex, webSocket;

beforeEach(() => {
  webex = new MockWebex({
    children: {
      mercury: Mercury,
    },
  });

  webSocket = new WebSocket({
    parent: webex, // Ensure the parent is set correctly
  });

  webSocket.connect = sinon.stub().callsFake(() => {
    webSocket.connected = true;
  });
  webSocket.disconnect = sinon.stub().resolves(true);
  webSocket.request = sinon.stub().resolves({
    headers: {},
    body: {
      subscriptionId: 'subscriptionId',
      webSocketUrl: 'url',
    },
  });

  // Mock event handling
  webSocket.on = sinon.stub((event, callback) => {
    if (event === 'event') {
      webSocket._eventCallback = callback;
    }
  });

  // Mock updateConfig if necessary
  webSocket.updateConfig = sinon.stub();
});

describe('#establishConnection', () => {
  it('registers connection', async () => {
    webSocket.subscribeNotifications = sinon.stub().resolves({
      body: {
        subscriptionId: 'subscriptionId',
        webSocketUrl: 'url',
      },
    });
    assert.equal(webSocket.isConnected(), false);
    await webSocket.subscribeAndConnect({
      datachannelUrl,
      body: { deviceUrl: webex.internal.device.url },
    });
    assert.equal(webSocket.isConnected(), true);
  });

  it("doesn't register connection for invalid input", async () => {
    webSocket.subscribeNotifications = sinon.stub().resolves({
      body: {
        subscriptionId: 'subscriptionId',
        webSocketUrl: 'url',
      },
    });
    await webSocket.subscribeAndConnect({} as any);
    assert.equal(webSocket.isConnected(), false);
  });
});

describe('#subscribeNotifications', () => {
  it('registers connection', async () => {
    await webSocket.subscribeNotifications({
      datachannelUrl,
      body: { deviceUrl: webex.internal.device.url },
    });

    sinon.assert.calledOnceWithExactly(
      webSocket.request,
      sinon.match({
        method: 'POST',
        url: datachannelUrl,
        body: { deviceUrl: webex.internal.device.url },
      })
    );
  });

  it('throws error if registration fails', async () => {
    const mockError = new Error('Connection error');
    webSocket.request.rejects(mockError);

    try {
      await webSocket.subscribeNotifications({
        datachannelUrl,
        body: { deviceUrl: webex.internal.device.url },
      });
      assert.fail('Expected error was not thrown');
    } catch (error) {
      assert.equal(error, mockError);
    }
  });
});

describe('#getDatachannelUrl', () => {
  it('gets dataChannel Url', async () => {
    webSocket.subscribeNotifications = sinon.stub().resolves({
      body: {
        subscriptionId: 'subscriptionId',
        webSocketUrl: 'url',
      },
    });
    await webSocket.subscribeAndConnect({
      datachannelUrl,
      body: { deviceUrl: webex.internal.device.url },
    });
    assert.equal(webSocket.getDatachannelUrl(), datachannelUrl);
  });
});

describe('#disconnectWebSocket', () => {
  it('disconnects webSocket', async () => {
    await webSocket.disconnectWebSocket();
    sinon.assert.calledOnce(webSocket.disconnect);
    assert.equal(webSocket.isConnected(), false);
    assert.equal(webSocket.getDatachannelUrl(), undefined);
    assert.equal(webSocket.getSubscriptionId(), undefined);
  });
});

});
});