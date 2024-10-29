import MockWebex from '@webex/test-helper-mock-webex';
import Mercury from '@webex/internal-plugin-mercury';
import WebSocket from '../../../../src/services/WebSocket';

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
        logger: {
          log: jest.fn(),
          error: jest.fn(),
          info: jest.fn(),
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
          subscriptionId,
        });

        expect(webSocket.webSocketUrl).toBe(webSocketUrl);
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        connectSpy.mockRestore();
      });

      it('should return undefined if webSocketUrl is not provided', async () => {
        const result = await webSocket.connectWebSocket({
          webSocketUrl: undefined,
          subscriptionId: undefined,
        });

        expect(result).toBeUndefined();
        expect(webSocket.webSocketUrl).toBeUndefined();
      });
    });

    describe('#isConnected', () => {
      it('should return the connected status', () => {
        webSocket.connected = true;
        expect(webSocket.isConnected()).toBe(true);

        webSocket.connected = false;
        expect(webSocket.isConnected()).toBe(false);
      });
    });

    describe('#getSubscriptionId', () => {
      it('should return the subscriptionId', () => {
        webSocket.subscriptionId = 'subscriptionId';
        expect(webSocket.getSubscriptionId()).toBe('subscriptionId');
      });

      it('should return undefined if subscriptionId is not set', () => {
        webSocket.subscriptionId = undefined;
        expect(webSocket.getSubscriptionId()).toBeUndefined();
      });
    });

    describe('#getwebSocketUrl', () => {
      it('should return the webSocketUrl', async () => {
        webSocket.connect = jest.fn();
        const connectSpy = jest.spyOn(webSocket, 'connect');
        await webSocket.connectWebSocket({
          webSocketUrl,
          subscriptionId,
        });
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        expect(webSocket.getWebSocketUrl()).toBe(webSocketUrl);
      });

      it('should return undefined if webSocketUrl is not set', async () => {
        await webSocket.connectWebSocket({
          undefined,
          subscriptionId,
        });
        expect(webSocket.getWebSocketUrl()).toBeUndefined();
      });
    });

    describe('#disconnectWebSocket', () => {
      it('should disconnect the websocket and clear related properties', async () => {
        webSocket.disconnect = jest.fn();

        webSocket.disconnect.mockResolvedValue();
        await webSocket.disconnectWebSocket();

        expect(webSocket.subscriptionId).toBeUndefined();
        expect(webSocket.webSocketUrl).toBeUndefined();
      });

      it('should throw an error if disconnect fails', async () => {
        const error = new Error('Disconnect failed');
        webSocket.disconnect = jest.fn().mockRejectedValue(error);

        try {
          await webSocket.disconnectWebSocket();
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
