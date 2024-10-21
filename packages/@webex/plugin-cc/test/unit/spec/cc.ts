import { assert } from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import WebSocket from '../../../src/WebSocket/WebSocket';
import { EVENT, READY, WCC_API_GATEWAY } from '../../../src/constants';
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
        get: sinon.stub().returns('https://api.example.com/'),
      },
    };

    webSocketMock = sinon.createStubInstance(WebSocket);
    webex.cc.webSocket = webSocketMock;

    // Mock event emitter
    eventEmitter = new (require('events')).EventEmitter();
    webSocketMock.on.callsFake((event, callback) => {
      eventEmitter.on(event, callback);
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#register', () => {
    it('should resolve with success message on successful registration', async () => {
      const promise = webex.cc.register();

      // Emit the welcome event to simulate the WebSocket message
      eventEmitter.emit(EVENT, {
        type: CC_EVENTS.WELCOME,
        data: { agentId: 'mockAgentId' },
      });

      const result = await promise;

      sinon.assert.calledOnce(webSocketMock.subscribeAndConnect);
      sinon.assert.calledWith(webSocketMock.subscribeAndConnect, {
        datachannelUrl: 'https://api.example.com/v1/notification/subscribe',
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WxCCSDK',
          allowMultiLogin: true,
        },
      });

      assert.equal(result, 'Success: CI User ID is mockAgentId');
    });

    it('should reject with error on registration failure', async () => {
      const error = new Error('Connection error');
      webSocketMock.subscribeAndConnect.rejects(error);
      webex.cc.listenForWebSocketEvents = sinon.stub();
      webex.cc.addEventHandler = sinon.stub();

      try {
        await webex.cc.register();
        assert.fail('Expected error was not thrown');
      } catch (err) {
        assert.equal(err, error);
      }
    });
  });

  describe('#unRegister', () => {
    it('should disconnect the WebSocket and remove event listeners', async () => {
      webSocketMock.disconnectWebSocket.resolves();
      webSocketMock.off = sinon.stub();

      await webex.cc.unRegister();

      sinon.assert.calledOnce(webSocketMock.disconnectWebSocket);
      sinon.assert.calledOnce(webSocketMock.off);
      sinon.assert.calledWith(webSocketMock.off, EVENT, webex.cc.processEvent);
    });
  });

  describe('#listenForWebSocketEvents', () => {
    it('should set up event listener for WebSocket events', () => {
      webSocketMock.on = sinon.stub();

      webex.cc.listenForWebSocketEvents();

      sinon.assert.calledOnce(webSocketMock.on);
      sinon.assert.calledWith(webSocketMock.on, EVENT, webex.cc.processEvent);
    });
  });

  describe('#processEvent', () => {
    it('should handle WELCOME event and resolve the register promise', () => {
      const resolveStub = sinon.stub();
      const rejectStub = sinon.stub();
      webex.cc.addEventHandler('register', resolveStub, rejectStub);

      webex.cc.processEvent({
        type: CC_EVENTS.WELCOME,
        data: { agentId: 'mockAgentId' },
      });

      assert.equal(webex.cc.ciUserId, 'mockAgentId');
      sinon.assert.calledOnce(resolveStub);
      sinon.assert.calledWith(resolveStub, 'Success: CI User ID is mockAgentId');
    });
  });

  describe('#handleEvent', () => {
    it('should resolve the event handler promise and clear timeout', () => {
      const resolveStub = sinon.stub();
      const rejectStub = sinon.stub();
      const timeoutId = setTimeout(() => {}, 1000);
      webex.cc.eventHandlers.set('register', { resolve: resolveStub, reject: rejectStub, timeoutId });

      webex.cc.handleEvent('register', 'Success message');

      sinon.assert.calledOnce(resolveStub);
      sinon.assert.calledWith(resolveStub, 'Success message');
      assert.isFalse(webex.cc.eventHandlers.has('register'));
    });
  });

  describe('#addEventHandler', () => {
    it('should add an event handler with timeout', () => {
      const resolveStub = sinon.stub();
      const rejectStub = sinon.stub();

      webex.cc.addEventHandler('register', resolveStub, rejectStub);

      const eventHandler = webex.cc.eventHandlers.get('register');
      assert.isDefined(eventHandler);
      assert.equal(eventHandler.resolve, resolveStub);
      assert.equal(eventHandler.reject, rejectStub);
      assert.isDefined(eventHandler.timeoutId);

      // Trigger timeout
      sinon.assert.notCalled(rejectStub);
      clearTimeout(eventHandler.timeoutId);
    });
  });
});