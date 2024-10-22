import MockWebex from '@webex/test-helper-mock-webex';
import { assert } from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import WebSocket from '../../../src/WebSocket/WebSocket';
import { HTTP_METHODS, SubscribeRequest } from '../../../src/types';

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
    });

    describe('#initialize', () => {
      it('should update the config with webSocketConfig', () => {
        const updateConfigSpy = sinon.spy(webSocket, 'updateConfig');
        webSocket.initialize();
        assert(updateConfigSpy.calledOnce);
        updateConfigSpy.restore();
      });
    });

    describe('#subscribeNotifications', () => {
      it('should register to the websocket and update webSocketUrl and subscriptionId', async () => {
        const response = {
          body: {
            webSocketUrl: 'wss://websocket.example.com',
            subscriptionId: 'subscriptionId',
          },
        };
        sinon.stub(webSocket, 'request').resolves(response);

        await webSocket.subscribeNotifications({
          datachannelUrl,
          body: {} as SubscribeRequest,
        });

        assert.equal(webSocket.webSocketUrl, 'wss://websocket.example.com');
        assert.equal(webSocket.subscriptionId, 'subscriptionId');
      });

      it('should throw an error if the request fails', async () => {
        const error = new Error('Request failed');
        sinon.stub(webSocket, 'request').rejects(error);

        try {
          await webSocket.subscribeNotifications({
            datachannelUrl,
            body: {} as SubscribeRequest,
          });
          assert.fail('Expected error was not thrown');
        } catch (err) {
          assert.equal(err, error);
        }
      });
    });

    describe('#subscribeAndConnect', () => {
      it('should subscribe and connect to the websocket', async () => {
        const connectSpy = sinon.spy(webSocket, 'connect');
        const response = {
          body: {
            webSocketUrl: 'wss://websocket.example.com',
            subscriptionId: 'subscriptionId',
          },
        };
        sinon.stub(webSocket, 'request').resolves(response);

        await webSocket.subscribeAndConnect({
          datachannelUrl,
          body: {} as SubscribeRequest,
        });

        assert.equal(webSocket.datachannelUrl, datachannelUrl);
        assert.calledWith(connectSpy, 'wss://websocket.example.com');
        connectSpy.restore();
      });

      it('should throw an error if subscribeNotifications fails', async () => {
        const error = new Error('Subscription failed');
        sinon.stub(webSocket, 'subscribeNotifications').rejects(error);

        try {
          await webSocket.subscribeAndConnect({
            datachannelUrl,
            body: {} as SubscribeRequest,
          });
          assert.fail('Expected error was not thrown');
        } catch (err) {
          assert.equal(err, error);
        }
      });
    });

    describe('#isConnected', () => {
      it('should return the connected status', () => {
        webSocket.connected = true;
        assert.isTrue(webSocket.isConnected());

        webSocket.connected = false;
        assert.isFalse(webSocket.isConnected());
      });
    });

    describe('#getSubscriptionId', () => {
      it('should return the subscriptionId', () => {
        webSocket.subscriptionId = 'subscriptionId';
        assert.equal(webSocket.getSubscriptionId(), 'subscriptionId');
      });

      it('should return undefined if subscriptionId is not set', () => {
        webSocket.subscriptionId = undefined;
        assert.isUndefined(webSocket.getSubscriptionId());
      });
    });

    describe('#getDatachannelUrl', () => {
      it('should return the datachannelUrl', () => {
        webSocket.datachannelUrl = 'datachannelUrl';
        assert.equal(webSocket.getDatachannelUrl(), 'datachannelUrl');
      });

      it('should return undefined if datachannelUrl is not set', () => {
        webSocket.datachannelUrl = undefined;
        assert.isUndefined(webSocket.getDatachannelUrl());
      });
    });

    describe('#disconnectWebSocket', () => {
      it('should disconnect the websocket and clear related properties', async () => {
        sinon.stub(webSocket, 'disconnect').resolves();

        await webSocket.disconnectWebSocket();

        assert.isUndefined(webSocket.datachannelUrl);
        assert.isUndefined(webSocket.subscriptionId);
        assert.isUndefined(webSocket.webSocketUrl);
      });
    });
  });
});