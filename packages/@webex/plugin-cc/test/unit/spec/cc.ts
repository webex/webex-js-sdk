import { assert } from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import WebSocket from '../../../src/WebSocket/WebSocket';
import { EVENT, READY, WCC_API_GATEWAY, WEBSOCKET_EVENT_TIMEOUT } from '../../../src/constants';
import { CC_EVENTS } from '../../../src/types';
import ContactCenter from '../../../src/cc';

describe('webex.cc', () => {
  let webex;
  let webSocketMock;
  let eventEmitter;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
    });

    // Ensure webex.internal.services is initialized correctly
    webex.internal = {
      ...webex.internal,
      services: {
        get: jest.fn().mockReturnValue('https://api.example.com/'),
      },
    };

    // Manually mock the necessary methods
    webSocketMock = {
      on: jest.fn(),
      subscribeAndConnect: jest.fn(),
      disconnectWebSocket: jest.fn(),
      off: jest.fn(),
    };
    webex.cc.webSocket = webSocketMock;
    
    // Mock event emitter
    eventEmitter = new (require('events')).EventEmitter();
    webSocketMock.on.mockImplementation((event, callback) => {
      eventEmitter.on(event, callback);
    });

    global.WEBSOCKET_EVENT_TIMEOUT = 100; // Set to a smaller value for tests

  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('#register', () => {

    it('should resolve with success message on successful registration even if $config is undefined', async () => {
      webex.$config = undefined;
      const promise = webex.cc.register();

      // Emit the welcome event to simulate the WebSocket message
      eventEmitter.emit(EVENT, {
        type: CC_EVENTS.WELCOME,
        data: { agentId: 'mockAgentId' },
      });

      const result = await promise;
      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalled();
      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalledWith({
        datachannelUrl: 'https://api.example.com/v1/notification/subscribe',
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });

      assert.equal(result, 'Success: CI User ID is mockAgentId');
    });

    it('should resolve with success message on successful registration with $config has values', async () => {
      webex.cc.$config = {
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: true,
      };
      const promise = webex.cc.register();

      // Emit the welcome event to simulate the WebSocket message
      eventEmitter.emit(EVENT, {
        type: CC_EVENTS.WELCOME,
        data: { agentId: 'mockAgentId' },
      });

      const result = await promise;
      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalled();
      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalledWith({
        datachannelUrl: 'https://api.example.com/v1/notification/subscribe',
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });

      assert.equal(result, 'Success: CI User ID is mockAgentId');
    });

    it('should reject with error on registration failure', async () => {
      const error = new Error('Connection error');
      webSocketMock.subscribeAndConnect.mockRejectedValue(error);

      try {
        await webex.cc.register();
        assert.fail('Expected error was not thrown');
      } catch (err) {
        assert.equal(err, error);
      }
    });
  });

  describe('#unregister', () => {
    it('should disconnect the WebSocket and remove event listeners', async () => {
      webSocketMock.disconnectWebSocket.mockResolvedValue();
      webSocketMock.off = jest.fn();

      await webex.cc.unregister();

      expect(webSocketMock.disconnectWebSocket).toHaveBeenCalled();
      expect(webSocketMock.off).toHaveBeenCalled();
      expect(webSocketMock.off).toHaveBeenCalledWith(EVENT, webex.cc.processEvent);
    });
  });

  describe('#listenForWebSocketEvents', () => {
    it('should set up event listener for WebSocket events', () => {
      webSocketMock.on = jest.fn();

      webex.cc.listenForWebSocketEvents();
      
      expect(webSocketMock.on).toHaveBeenCalled();
      expect(webSocketMock.on).toHaveBeenCalledWith(EVENT, webex.cc.processEvent);
    });
  });

  describe('#processEvent', () => {
    it('should handle WELCOME event and resolve the register promise', () => {
      const resolveMock = jest.fn();
      const rejectMock = jest.fn();
      webex.cc.addEventHandler('register', resolveMock, rejectMock);

      webex.cc.processEvent({
        type: CC_EVENTS.WELCOME,
        data: { agentId: 'mockAgentId' },
      });

      assert.equal(webex.cc.ciUserId, 'mockAgentId');

      expect(resolveMock).toHaveBeenCalled();
      expect(resolveMock).toHaveBeenCalledWith('Success: CI User ID is mockAgentId');
    });

    it('should handle unknown event type gracefully and log info statement', () => {
      const resolveMock = jest.fn();
      const rejectMock = jest.fn();
      webex.logger.info = jest.fn();
    
      webex.cc.addEventHandler('register', resolveMock, rejectMock);
    
      webex.cc.processEvent({
        type: 'UNKNOWN_EVENT',
        data: {},
      });
    
      expect(resolveMock).not.toHaveBeenCalled();
      expect(rejectMock).not.toHaveBeenCalled();
      expect(webex.logger.info).toHaveBeenCalled();
      expect(webex.logger.info).toHaveBeenCalledWith('Unknown event: UNKNOWN_EVENT');
    });
  });

  describe('#handleEvent', () => {
    it('should resolve the event handler promise and clear timeout', () => {
      const resolveMock = jest.fn();
      const rejectMock = jest.fn();
      const timeoutId = setTimeout(() => {}, 1000);
      webex.cc.eventHandlers.set('register', { resolve: resolveMock, reject: rejectMock, timeoutId });

      webex.cc.handleEvent('register', 'Success message');

      expect(resolveMock).toHaveBeenCalled();
      expect(resolveMock).toHaveBeenCalledWith('Success message');
      assert.isFalse(webex.cc.eventHandlers.has('register'));
    });

    it('should do nothing if event handler is not found', () => {
      const resolveMock = jest.fn();
      const rejectMock = jest.fn();

      webex.cc.handleEvent('nonexistent', 'Success message');

      expect(resolveMock).not.toHaveBeenCalled();
      expect(rejectMock).not.toHaveBeenCalled();
    });
  });

  describe('#addEventHandler', () => {
    it('should add an event handler with timeout', () => {
      jest.useFakeTimers();
    
      const resolveMock = jest.fn();
      const rejectMock = jest.fn();
    
      webex.cc.addEventHandler('register', resolveMock, rejectMock);
    
      const eventHandler = webex.cc.eventHandlers.get('register');
      expect(eventHandler).toBeDefined();
      expect(eventHandler.resolve).toBe(resolveMock);
      expect(eventHandler.reject).toBe(rejectMock);
      expect(eventHandler.timeoutId).toBeDefined();
    
      expect(resolveMock).not.toHaveBeenCalled();
    
      // Fast-forward until all timers have been executed
      jest.runAllTimers();
    
      expect(rejectMock).toHaveBeenCalled();
      clearTimeout(eventHandler.timeoutId);
    
      jest.useRealTimers();
    });
  
    it('should reject the promise if the event times out', (done) => {
      const resolveMock = jest.fn();
      const rejectMock = jest.fn().mockImplementation((error) => {
        expect(error.message).toBe('Time out waiting for event: register');
        done();
      });
  
      webex.cc.addEventHandler('register', resolveMock, rejectMock);
  
      const eventHandler = webex.cc.eventHandlers.get('register');
      expect(eventHandler).toBeDefined();
  
      // Simulate timeout
      setTimeout(() => {
        expect(rejectMock).toHaveBeenCalled();
      }, WEBSOCKET_EVENT_TIMEOUT + 100);
    }, WEBSOCKET_EVENT_TIMEOUT + 200);
  });

  describe('#establishConnection', () => {
    it('should establish WebSocket connection with correct parameters', async () => {
      webSocketMock.subscribeAndConnect.mockResolvedValue();

      webex.cc.register();

      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalled();
      expect(webSocketMock.subscribeAndConnect).toHaveBeenCalledWith({
        datachannelUrl: 'https://api.example.com/v1/notification/subscribe',
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });
    }, 1000);

    it('should log error and throw if connection fails', async () => {
      const error = new Error('Connection error');
      webSocketMock.subscribeAndConnect.mockRejectedValue(error);
      webex.logger.info = jest.fn();

      try {
        await webex.cc.establishConnection((err) => {
          throw err;
        });
        assert.fail('Expected error was not thrown');
      } catch (err) {
        assert.equal(err, error);
        expect(webex.logger.info).toHaveBeenCalled();
        expect(webex.logger.info).toHaveBeenCalledWith(`Error connecting and subscribing: ${error}`);
      }
    }, 1000);
  });
});