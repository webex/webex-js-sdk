import HttpRequest from '../../../../src/services/HttpRequest';
import {CC_EVENTS, SubscribeResponse} from '../../../../src/services/types';
import {WEBSOCKET_EVENT_TIMEOUT} from '../../../../src/services/constants';
import MockWebex from '@webex/test-helper-mock-webex';
import WebSocket from '../../../../src/services/WebSocket';
import {EventEmitter} from 'events';

jest.mock('../../../../src/services/WebSocket');

describe('HttpRequest', () => {
  let httpRequest;
  let webex;
  let mockWebSocket;
  let eventEmitter;

  beforeEach(() => {
    webex = new MockWebex({
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    });
    eventEmitter = new EventEmitter();
    mockWebSocket = {
      on: jest.fn((event, handler) => {
        eventEmitter.on(event, handler);
      }),
      connectWebSocket: jest.fn(),
    };
    WebSocket.mockImplementation(() => mockWebSocket);
    httpRequest = new HttpRequest({webex});
    webex.request = jest.fn();
  });

  it('subscribeNotifications resolves on Welcome event', async () => {
    const mockSubscribeRequest = {body: {}};
    const mockSubscribeResponse = {
      body: {
        webSocketUrl: 'wss://example.com',
        subscriptionId: '123',
      },
    };
    const mockWelcomeEvent = {type: CC_EVENTS.WELCOME, data: {}};

    webex.request.mockResolvedValue(mockSubscribeResponse);
    httpRequest.webSocket.connectWebSocket.mockResolvedValue();

    const promise = httpRequest.subscribeNotifications(mockSubscribeRequest);

    // Simulate WebSocket event
    eventEmitter.emit(CC_EVENTS.WELCOME, mockWelcomeEvent);

    await expect(promise).resolves.toEqual(mockWelcomeEvent.data);
    expect(mockWebSocket.connectWebSocket).toHaveBeenCalledWith({
      webSocketUrl: 'wss://example.com',
      subscriptionId: '123',
    });
  });

  it('subscribeNotifications rejects on timeout', async () => {
    jest.useFakeTimers();
    const mockSubscribeRequest = {body: {}};
    const mockSubscribeResponse = {
      body: {
        webSocketUrl: 'wss://example.com',
        subscriptionId: '123',
      },
    };

    webex.request.mockResolvedValue(mockSubscribeResponse);

    const promise = httpRequest.subscribeNotifications(mockSubscribeRequest);

    jest.advanceTimersByTime(WEBSOCKET_EVENT_TIMEOUT);

    await expect(promise).rejects.toThrow('Timeout waiting for event');
    jest.useRealTimers();
  });

  it('sendRequestWithEvent resolves on success event', async () => {
    const mockOptions = {
      service: 'service',
      resource: 'resource',
      method: 'POST',
      payload: {},
      eventType: 'event',
      success: ['successEvent'],
      failure: ['failureEvent'],
    };
    const mockResponse = {body: {}};
    const mockSuccessEvent = {type: 'successEvent', data: {}};

    webex.request.mockResolvedValue(mockResponse);

    const promise = httpRequest.sendRequestWithEvent(mockOptions);

    // Simulate WebSocket event
    eventEmitter.emit('event', mockSuccessEvent);

    await expect(promise).resolves.toEqual(mockSuccessEvent);
  });

  it('sendRequestWithEvent rejects on failure event', async () => {
    const mockOptions = {
      service: 'service',
      resource: 'resource',
      method: 'POST',
      payload: {},
      eventType: 'event',
      success: ['successEvent'],
      failure: ['failureEvent'],
    };
    const mockResponse = {body: {}};
    const mockFailureEvent = {type: 'failureEvent', reason: 'failureReason'};

    webex.request.mockResolvedValue(mockResponse);

    const promise = httpRequest.sendRequestWithEvent(mockOptions);

    // Simulate WebSocket event
    eventEmitter.emit('event', mockFailureEvent);

    await expect(promise).rejects.toThrow('failureReason');
  });

  it('sendRequestWithEvent rejects on timeout', () => {
    jest.useFakeTimers();
    const mockOptions = {
      service: 'service',
      resource: 'resource',
      method: 'POST',
      payload: {},
      eventType: 'event',
      success: ['successEvent'],
      failure: ['failureEvent'],
    };
    const mockResponse = {body: {}};

    webex.request.mockResolvedValue(mockResponse);

    const promise = httpRequest.sendRequestWithEvent(mockOptions);

    jest.advanceTimersByTime(WEBSOCKET_EVENT_TIMEOUT);

    return expect(promise).rejects.toThrow('Timeout waiting for event');
  });

  it('request sends request correctly', async () => {
    const mockOptions = {
      service: 'service',
      resource: 'resource',
      method: 'POST',
      body: {},
    };
    const mockResponse = {body: {}};

    webex.request.mockResolvedValue(mockResponse);

    await expect(httpRequest.request(mockOptions)).resolves.toEqual(mockResponse);
    expect(webex.request).toHaveBeenCalledWith(mockOptions);
  });
});
