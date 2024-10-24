import MockWebex from '@webex/test-helper-mock-webex';
import { assert } from '@webex/test-helper-chai';
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

    describe('#subscribeNotifications', () => {
      it('should register to the websocket and update webSocketUrl and subscriptionId', async () => {
        const response = {
          body: {
            webSocketUrl: 'wss://websocket.example.com',
            subscriptionId: 'subscriptionId',
          },
        };

        jest.spyOn(webSocket, 'request').mockResolvedValue(response);

        await webSocket.subscribeNotifications({
          datachannelUrl,
          body: {} as SubscribeRequest,
        });

        assert.equal(webSocket.webSocketUrl, 'wss://websocket.example.com');
        assert.equal(webSocket.subscriptionId, 'subscriptionId');
      });

      it('should throw an error if the request fails', async () => {
        const error = new Error('Request failed');
        jest.spyOn(webSocket, 'request').mockRejectedValue(error);
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
        const connectSpy = jest.spyOn(webSocket, 'connect');
        const response = {
          body: {
            webSocketUrl: 'wss://websocket.example.com',
            subscriptionId: 'subscriptionId',
          },
        };
        jest.spyOn(webSocket, 'request').mockResolvedValue(response);
        await webSocket.subscribeAndConnect({
          datachannelUrl,
          body: {} as SubscribeRequest,
        });

        expect(webSocket.datachannelUrl).toBe(datachannelUrl);
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        connectSpy.mockRestore();
      });

      it('should throw an error if subscribeNotifications fails', async () => {
        const error = new Error('Subscription failed');
        jest.spyOn(webSocket, 'subscribeNotifications').mockRejectedValue(error);

        try {
          await webSocket.subscribeAndConnect({
            datachannelUrl,
            body: {} as SubscribeRequest,
          });
          assert.fail('Expected error was not thrown');
        } catch (err) {
          expect(err).toBe(error);
        }
      });

      it('should return undefined if datachannelUrl is not provided', async () => {
        const response = {
          body: {
            webSocketUrl: 'wss://websocket.example.com',
            subscriptionId: 'subscriptionId',
          },
        };
        jest.spyOn(webSocket, 'request').mockResolvedValue(response);

        const result = await webSocket.subscribeAndConnect({
          datachannelUrl: undefined,
          body: {} as SubscribeRequest,
        });

        expect(result).toBeUndefined();
        expect(webSocket.datachannelUrl).toBeUndefined();
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
        webSocket.disconnect = jest.fn();

        webSocket.disconnect.mockResolvedValue();
        await webSocket.disconnectWebSocket();

        assert.isUndefined(webSocket.datachannelUrl);
        assert.isUndefined(webSocket.subscriptionId);
        assert.isUndefined(webSocket.webSocketUrl);
      });

      it('should throw an error if disconnect fails', async () => {
        const error = new Error('Disconnect failed');
        webSocket.disconnect = jest.fn().mockRejectedValue(error);

        try {
          await webSocket.disconnectWebSocket();
          assert.fail('Expected error was not thrown');
        } catch (err) {
          expect(err).toBe(error);
        }
      });
    });

    describe('#on and #off', () => {
      it('should add and remove event listeners', () => {
        const event = 'message';
        const callback = jest.fn();
      
        // Add the event listener
        webSocket.on(event, callback);
      
        // Emit the event and check if the callback is called
        webSocket.emit(event, 'test data');
        expect(callback).toHaveBeenCalledWith('test data');
      
        // Remove the event listener
        webSocket.off(event, callback);
      
        // Emit the event again and check if the callback is not called
        callback.mockClear(); // Clear the mock call history
        webSocket.emit(event, 'test data');
        expect(callback).not.toHaveBeenCalled();
      });
    });
  });
});