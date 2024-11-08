import HttpRequest from '../../../../../src/services/core/HttpRequest';
import {WEBSOCKET_EVENT_TIMEOUT} from '../../../../../src/services/constants';
import MockWebex from '@webex/test-helper-mock-webex';
import WebSocket from '../../../../../src/services/core/WebSocket';
import {EventEmitter} from 'events';
import {HTTP_METHODS, WebexSDK} from '../../../../../src/types';
import {CC_EVENTS} from '../../../../../src/services/config/types';

jest.mock('../../../../../src/services/core/WebSocket');

const mockWebex = {
  request: jest.fn(),
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
} as unknown as WebexSDK;

// Cast the request function to a Jest mock function
const mockRequest = mockWebex.request as jest.Mock;

const mockWebSocket = {
  on: jest.fn(),
  connectWebSocket: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HttpRequest', () => {
  let httpRequest;
  beforeEach(() => {
    httpRequest = new HttpRequest({webex: mockWebex});
    httpRequest.webSocket = mockWebSocket;
  });

  describe('subscribeNotifications', () => {
    it('should resolve the promise when the Welcome event is received', async () => {
      const mockSubscribeResponse = {
        body: {
          webSocketUrl: 'ws://example.com',
        },
      };
      const mockWelcomeEvent = {
        type: CC_EVENTS.WELCOME,
        data: {message: 'Welcome'},
      };

      mockRequest.mockResolvedValueOnce(mockSubscribeResponse);

      setTimeout(() => {
        httpRequest.eventHandlers.get(CC_EVENTS.WELCOME)(mockWelcomeEvent.data);
      }, 100);

      const result = await httpRequest.subscribeNotifications({body: {}});
      expect(result).toEqual(mockWelcomeEvent.data);
    });

    it(
      'should reject the promise if the Welcome event is not received within timeout',
      async () => {
        const mockSubscribeResponse = {
          body: {
            webSocketUrl: 'ws://example.com',
          },
        };

        mockRequest.mockResolvedValueOnce(mockSubscribeResponse);

        await expect(httpRequest.subscribeNotifications({body: {}})).rejects.toThrow(
          'Timeout waiting for event'
        );
      },
      WEBSOCKET_EVENT_TIMEOUT + 1000
    ); // Increase timeout for this test
  });

  describe('sendRequestWithEvent', () => {
    it('should resolve the promise when the specified event type is received', async () => {
      const mockResponse = {
        status: 200,
        body: {},
      };
      const mockEvent = {
        type: 'SUCCESS_EVENT',
        data: {message: 'Success'},
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      setTimeout(() => {
        httpRequest.eventHandlers.get('EVENT_TYPE')(mockEvent);
      }, 100);

      const result = await httpRequest.sendRequestWithEvent({
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        payload: {},
        eventType: 'EVENT_TYPE',
        success: ['SUCCESS_EVENT'],
        failure: ['FAILURE_EVENT'],
      });
      expect(result).toEqual(mockEvent);
    });

    it('should reject the promise when a failure event type is received', async () => {
      const mockResponse = {
        status: 200,
        body: {},
      };
      const mockEvent = {
        type: 'FAILURE_EVENT',
        data: {reason: 'Failed'},
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      setTimeout(() => {
        httpRequest.eventHandlers.get('EVENT_TYPE')(mockEvent);
      }, 100);

      await expect(
        httpRequest.sendRequestWithEvent({
          service: 'service',
          resource: 'resource',
          method: HTTP_METHODS.POST,
          payload: {},
          eventType: 'EVENT_TYPE',
          success: ['SUCCESS_EVENT'],
          failure: ['FAILURE_EVENT'],
        })
      ).rejects.toThrow('FAILURE_EVENT');
    });

    it('should reject the promise when an unexpected event type is received', async () => {
      const mockResponse = {
        status: 200,
        body: {},
      };
      const mockEvent = {
        type: 'UNEXPECTED_EVENT',
        data: {message: 'Unexpected'},
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      setTimeout(() => {
        httpRequest.eventHandlers.get('EVENT_TYPE')(mockEvent);
      }, 100);

      await expect(
        httpRequest.sendRequestWithEvent({
          service: 'service',
          resource: 'resource',
          method: HTTP_METHODS.POST,
          payload: {},
          eventType: 'EVENT_TYPE',
          success: ['SUCCESS_EVENT'],
          failure: ['FAILURE_EVENT'],
        })
      ).rejects.toThrow('Unexpected event type received: UNEXPECTED_EVENT');
    });

    it('should log and throw an error if the service request fails', async () => {
      const mockError = new Error('Request failed');
      mockRequest.mockRejectedValueOnce(mockError);

      await expect(
        httpRequest.sendRequestWithEvent({
          service: 'service',
          resource: 'resource',
          method: HTTP_METHODS.POST,
          payload: {},
          eventType: 'EVENT_TYPE',
          success: ['SUCCESS_EVENT'],
          failure: ['FAILURE_EVENT'],
        })
      ).rejects.toThrow('Request failed');

      expect(mockWebex.logger.error).toHaveBeenCalledWith(
        'Error sending service request: Error: Request failed'
      );
    });
  });
});
