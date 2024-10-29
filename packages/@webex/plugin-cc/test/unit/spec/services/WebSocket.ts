import MockWebex from '@webex/test-helper-mock-webex';
import { assert } from '@webex/test-helper-chai';
import Mercury from '@webex/internal-plugin-mercury';
import WebSocket from '../../../../src/services/WebSocket';
import { web } from 'webpack';

describe('plugin-cc WebSocket tests', () => {
  const subscriptionId = 'webSocketUrl';
  const webSocketUrl = 'wss://websocket.example.com';
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

    describe('#connectWebSocket', () => {
      it('should connect to the websocket', async () => {
        const connectSpy = jest.spyOn(webSocket, 'connect');
        await webSocket.connectWebSocket({
          webSocketUrl,
          subscriptionId
        });

        expect(webSocket.webSocketUrl).toBe(webSocketUrl);
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        connectSpy.mockRestore();
      });

      it('should return undefined if webSocketUrl is not provided', async () => {

        const result = await webSocket.connectWebSocket({
          webSocketUrl: undefined,
          subscriptionId: undefined
        });

        expect(result).toBeUndefined();
        expect(webSocket.webSocketUrl).toBeUndefined();
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

    describe('#getwebSocketUrl', () => {
      it('should return the webSocketUrl', async () => {
        webSocket.connect = jest.fn();
        const connectSpy = jest.spyOn(webSocket, 'connect');
        await webSocket.connectWebSocket({
          webSocketUrl,
          subscriptionId
        });
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        assert.equal(webSocket.getWebSocketUrl(), webSocketUrl);
      });

      it('should return undefined if webSocketUrl is not set', async () => {
        await webSocket.connectWebSocket({
          undefined,
          subscriptionId
        });
        assert.isUndefined(webSocket.getWebSocketUrl());
      });
    });

    describe('#disconnectWebSocket', () => {
      it('should disconnect the websocket and clear related properties', async () => {
        webSocket.disconnect = jest.fn();

        webSocket.disconnect.mockResolvedValue();
        await webSocket.disconnectWebSocket();

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