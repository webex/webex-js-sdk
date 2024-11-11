import HttpRequest from '../../../../../src/services/core/HttpRequest';
import {CC_EVENTS, SubscribeResponse} from '../../../../../src/services/config/types';
import {WEBSOCKET_EVENT_TIMEOUT} from '../../../../../src/services/constants';
import {WebexSDK} from '../../../../../src/types';

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
    httpRequest = HttpRequest.getInstance({webex: mockWebex});
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
});
