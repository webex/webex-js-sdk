import { SUBSCRIBE_API, WCC_API_GATEWAY, WEBSOCKET_EVENT_TIMEOUT } from '../../../../src/services/constants';
import { WebexSDK, HTTP_METHODS, SubscribeRequest, WelcomeEvent, IHttpResponse } from '../../../../src/types';
import WebSocket from '../../../../src/services/WebSocket';
import { CC_EVENTS } from '../../../../src/services/types';
import HttpRequest from '../../../../src/services/HttpRequest';

jest.mock('../../../../src/services/WebSocket');

describe('HttpRequest', () => {
  let webex: WebexSDK;
  let httpRequest: HttpRequest;
  let webSocketMock: jest.Mocked<WebSocket>;

  beforeEach(() => {
    webex = {
      request: jest.fn(),
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
    } as unknown as WebexSDK;

    webSocketMock = new WebSocket({ parent: webex }) as jest.Mocked<WebSocket>;
    httpRequest = new HttpRequest({ webex });
    httpRequest['webSocket'] = webSocketMock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('subscribeNotifications', () => {
    it('should subscribe to notifications and receive Welcome event', async () => {
      const subscribeResponse = {
        statusCode: 200,
        body: {
          webSocketUrl: 'ws://example.com',
          subscriptionId: '12345',
        },
        message: null,
      };

      (webex.request as jest.Mock).mockResolvedValue(subscribeResponse);

      const welcomeEvent = { type: CC_EVENTS.WELCOME, data: {} };
      (webSocketMock.on as jest.Mock).mockImplementation((event, handler) => {
        handler(welcomeEvent);
      });

      const subscribeRequest = { body: {} } as { body: SubscribeRequest };
      const result = await httpRequest.subscribeNotifications(subscribeRequest);

      expect(result).toEqual(welcomeEvent.data);
      expect(webex.request).toHaveBeenCalledWith({
        service: WCC_API_GATEWAY,
        resource: SUBSCRIBE_API,
        method: HTTP_METHODS.POST,
        body: subscribeRequest.body,
      });
    });

    it('should timeout if Welcome event is not received', async () => {
      jest.useFakeTimers();
      const subscribeResponse = {
        statusCode: 200,
        body: {
          webSocketUrl: 'ws://example.com',
          subscriptionId: '12345',
        },
        message: null,
      };

      (webex.request as jest.Mock).mockResolvedValue(subscribeResponse);

      const subscribeRequest = { body: {} } as { body: SubscribeRequest };
      const promise = httpRequest.subscribeNotifications(subscribeRequest);

      jest.advanceTimersByTime(WEBSOCKET_EVENT_TIMEOUT);

      await expect(promise).rejects.toThrow('Timeout waiting for event');
      jest.useRealTimers();
    });
  });

  describe('sendRequestWithEvent', () => {
    it('should send request and receive success event', async () => {
      const response = { data: 'response data' };
      (webex.request as jest.Mock).mockResolvedValue(response);

      const eventData = { type: 'SUCCESS_EVENT', data: {} };
      (webSocketMock.on as jest.Mock).mockImplementation((event, handler) => {
        handler(eventData);
      });

      const options = {
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        payload: {},
        eventType: 'SUCCESS_EVENT',
        success: ['SUCCESS_EVENT'],
        failure: ['FAILURE_EVENT'],
      };

      const result = await httpRequest.sendRequestWithEvent(options);

      expect(result).toEqual(eventData.data);
      expect(webex.request).toHaveBeenCalledWith({
        service: options.service,
        resource: options.resource,
        method: options.method,
        body: options.payload,
      });
    });

    it('should send request and receive failure event', async () => {
      const response = { data: 'response data' };
      (webex.request as jest.Mock).mockResolvedValue(response);

      const eventData = { type: 'FAILURE_EVENT', reason: 'Some error' };
      (webSocketMock.on as jest.Mock).mockImplementation((event, handler) => {
        handler(eventData);
      });

      const options = {
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        payload: {},
        eventType: 'FAILURE_EVENT',
        success: ['SUCCESS_EVENT'],
        failure: ['FAILURE_EVENT'],
      };

      await expect(httpRequest.sendRequestWithEvent(options)).rejects.toThrow('Some error');
      expect(webex.request).toHaveBeenCalledWith({
        service: options.service,
        resource: options.resource,
        method: options.method,
        body: options.payload,
      });
    });

    it('should timeout if event is not received', async () => {
      jest.useFakeTimers();
      const response = { data: 'response data' };
      (webex.request as jest.Mock).mockResolvedValue(response);

      const options = {
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        payload: {},
        eventType: 'EVENT',
        success: ['SUCCESS_EVENT'],
        failure: ['FAILURE_EVENT'],
      };

      const promise = httpRequest.sendRequestWithEvent(options);

      jest.advanceTimersByTime(WEBSOCKET_EVENT_TIMEOUT);

      await expect(promise).rejects.toThrow('Timeout waiting for event');
      jest.useRealTimers();
    });
  });

  describe('request', () => {
    it('should send a request and return the response', async () => {
      const response = { data: 'response data' } as IHttpResponse;
      (webex.request as jest.Mock).mockResolvedValue(response);

      const options = {
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        body: {},
      };

      const result = await httpRequest.request(options);

      expect(result).toEqual(response);
      expect(webex.request).toHaveBeenCalledWith(options);
    });
  });
});