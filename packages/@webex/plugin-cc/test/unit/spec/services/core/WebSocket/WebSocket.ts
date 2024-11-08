import MockWebex from '@webex/test-helper-mock-webex';
import Mercury from '@webex/internal-plugin-mercury';
import WebSocket from '../../../../../../src/services/core/WebSocket';

describe('plugin-cc WebSocket tests', () => {
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
          warn: jest.fn(),
        },
      });

      webSocket = new WebSocket({
        parent: webex, // Ensure the parent is set correctly
      });
      webSocket.connect = jest.fn();
      webSocket.disconnect = jest.fn();
    });

    afterEach(async () => {
      if (webSocket.isConnected()) {
        await webSocket.disconnectWebSocket();
      }
      jest.clearAllMocks();
    });

    describe('#connectWebSocket', () => {
      it('should connect to the websocket', async () => {
        const connectSpy = jest.spyOn(webSocket, 'connect');
        await webSocket.connectWebSocket({
          webSocketUrl,
        });

        expect(webSocket.webSocketUrl).toBe(webSocketUrl);
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        connectSpy.mockRestore();
      });

      it('should return undefined if webSocketUrl is not provided', async () => {
        const result = await webSocket.connectWebSocket({
          webSocketUrl: undefined,
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

    describe('#getWebSocketUrl', () => {
      it('should return the webSocketUrl', async () => {
        webSocket.connect = jest.fn();
        const connectSpy = jest.spyOn(webSocket, 'connect');
        await webSocket.connectWebSocket({
          webSocketUrl,
        });
        expect(connectSpy).toHaveBeenCalledWith('wss://websocket.example.com');
        expect(webSocket.getWebSocketUrl()).toBe(webSocketUrl);
      });

      it('should return undefined if webSocketUrl is not set', async () => {
        await webSocket.connectWebSocket({
          undefined,
        });
        expect(webSocket.getWebSocketUrl()).toBeUndefined();
      });
    });

    describe('#disconnectWebSocket', () => {
      it('should disconnect the websocket and clear related properties', async () => {
        webSocket.disconnect = jest.fn();

        webSocket.disconnect.mockResolvedValue();
        await webSocket.disconnectWebSocket();

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
