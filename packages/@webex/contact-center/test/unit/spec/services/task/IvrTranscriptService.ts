import 'jsdom-global/register';
import {WebexSDK} from '../../../../../src/types';
import IvrTranscriptService from '../../../../../src/services/task/IvrTranscriptService';
import LoggerProxy from '../../../../../src/logger-proxy';
import MockWebex from '@webex/test-helper-mock-webex';
import {
  IvrTranscriptMetaDataResponse,
  IvrTranscriptResponse,
  IvrTranscriptMetaData,
  IvrConversationTurn,
} from '../../../../../src/services/task/types';

jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('IvrTranscriptService', () => {
  let service: IvrTranscriptService;
  let webex: WebexSDK;

  // Mock data constants following config test pattern
  const mockOrgId = 'org123';
  const mockInteractionId = 'interaction456';
  const mockTimeOutMins = 5;
  const mockTranscriptPath = 'https://mediastorage.produs1.ciscoccservice.com/transcript.json';
  const mockNonS3TranscriptPath = 'https://example.com/transcript.json';

  // Mock response data following config test patterns
  const mockTranscriptMetadata: IvrTranscriptMetaData = {
    transcriptId: 'trans1',
    transcriptPath: mockTranscriptPath,
    cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
    startTime: 123,
    stopTime: 456,
    botName: 'TestBot',
  };

  const mockMetadataResponse: IvrTranscriptMetaDataResponse = {
    orgId: mockOrgId,
    interactionId: mockInteractionId,
    timeOutMins: mockTimeOutMins,
    transcripts: [mockTranscriptMetadata],
  };

  const mockConversationTurn: IvrConversationTurn = {
    bot: {
      reply: 'Hello',
      timestamp: 123,
      confidence: 0.9,
      parameters: { foo: 'bar' },
    },
    customer: {
      query: 'Hi',
      sentiment: 1,
      timestamp: 123,
    },
  };

  const mockConversationResponse: IvrTranscriptResponse = [mockConversationTurn];

  beforeEach(() => {
    webex = new MockWebex({
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    });

    // Mock webex credentials and request
    webex.credentials = {
      getUserToken: jest.fn().mockResolvedValue('Bearer mocktoken'),
    } as any;
    webex.request = jest.fn();

    service = new IvrTranscriptService(webex);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('fetchIVRTranscript', () => {
    it('should fetch metadata and conversation successfully', async () => {
      const mockResponse = {
        body: mockMetadataResponse,
      };
      const mockConversationResponse = {
        body: {
          conversation: [mockConversationTurn],
        },
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockConversationResponse);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(webex.request).toHaveBeenCalledTimes(2);
      expect(webex.request).toHaveBeenCalledWith({
        uri: `https://mediastorage.produs1.ciscoccservice.com/media/organization/${mockOrgId}/interaction/${mockInteractionId}/ivrtranscript?timeOutMins=${mockTimeOutMins}`,
        method: 'GET',
        headers: {
          Authorization: 'Bearer mocktoken',
          'cisco-no-http-redirect': null,
          'spark-user-agent': null,
        },
      });
      
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching complete IVR transcript with metadata and conversations', {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId: mockInteractionId,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].bot?.reply).toBe('Hello');
      expect(result[0].bot?.botName).toBe('TestBot');
    });

    it('should return empty array if no transcripts found', async () => {
      const mockResponse = {
        body: {
          ...mockMetadataResponse,
          transcripts: [],
        },
      };

      (webex.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(LoggerProxy.warn).toHaveBeenCalledWith('No IVR transcripts found for interaction', {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId: mockInteractionId,
      });

      expect(result).toEqual([]);
    });

    it('should handle different conversation response formats', async () => {
      // Test direct array response
      const mockResponse = {
        body: mockMetadataResponse,
      };
      const mockDirectArrayResponse = {
        body: [mockConversationTurn],
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockDirectArrayResponse);

      let result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].bot?.reply).toBe('Hello');

      // Test empty conversation response
      const mockEmptyResponse = {
        body: undefined,
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockEmptyResponse);

      result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result).toEqual([]);
    });

    it('should continue processing other transcripts if one fails', async () => {
      const multipleTranscriptsMetadata = {
        ...mockMetadataResponse,
        transcripts: [
          mockTranscriptMetadata,
          {
            ...mockTranscriptMetadata,
            transcriptId: 'trans2',
            transcriptPath: 'https://example.com/transcript2.json',
            botName: 'Bot2',
          },
        ],
      };

      const mockResponse = {
        body: multipleTranscriptsMetadata,
      };
      const mockSuccessConversation = {
        body: { conversation: [mockConversationTurn] },
      };
      const error = new Error('Failed to fetch transcript');
      (error as any).statusCode = 500;

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockSuccessConversation);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(LoggerProxy.warn).toHaveBeenCalledWith(
        `Failed to process transcript trans1: ${error}`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId: mockInteractionId,
        }
      );

      expect(result.length).toBe(1);
    });

    it('should handle 400 Bad Request error and throw original error', async () => {
      const error = new Error('Bad Request - Invalid parameters');
      (error as any).statusCode = 400;

      (webex.request as jest.Mock).mockRejectedValue(error);

      try {
        await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId: mockInteractionId,
          }
        );
      }
    });

    it('should handle authentication errors (401, 403) and throw original error', async () => {
      const authErrors = [
        { statusCode: 401, message: 'Unauthorized - Invalid token' },
        { statusCode: 403, message: 'Forbidden - Access denied' },
      ];

      for (const errorConfig of authErrors) {
        const error = new Error(errorConfig.message);
        (error as any).statusCode = errorConfig.statusCode;

        (webex.request as jest.Mock).mockRejectedValue(error);

        try {
          await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);
        } catch (thrownError) {
          expect(thrownError).toBe(error);
        }
      }
    });

    it('should handle server errors (404, 500, 502, 503) and throw original error', async () => {
      const serverErrors = [
        { statusCode: 404, message: 'Not Found - Interaction not found' },
        { statusCode: 500, message: 'Internal Server Error - Service unavailable' },
        { statusCode: 502, message: 'Bad Gateway - Upstream server error' },
        { statusCode: 503, message: 'Service Unavailable - Temporarily unavailable' },
      ];

      for (const errorConfig of serverErrors) {
        const error = new Error(errorConfig.message);
        (error as any).statusCode = errorConfig.statusCode;

        (webex.request as jest.Mock).mockRejectedValue(error);

        try {
          await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);
        } catch (thrownError) {
          expect(thrownError).toBe(error);
        }
      }
    });

    it('should handle network errors and throw original error', async () => {
      const networkErrors = [
        { code: 'TIMEOUT', message: 'Request timed out' },
        { code: 'ECONNREFUSED', message: 'Connection refused' },
      ];

      for (const errorConfig of networkErrors) {
        const error = new Error(errorConfig.message);
        (error as any).code = errorConfig.code;

        (webex.request as jest.Mock).mockRejectedValue(error);

        try {
          await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);
        } catch (thrownError) {
          expect(thrownError).toBe(error);
        }
      }
    });
  });

  describe('parameter flattening', () => {
    it('should flatten nested bot parameters', async () => {
      const conversationWithNestedParams: IvrConversationTurn = {
        bot: {
          reply: 'Hello',
          confidence: 0.9,
          timestamp: 123,
          parameters: {
            user: { name: 'John', age: 30 },
            session: { id: '123' },
          },
        },
        customer: { query: 'Hi', sentiment: 1, timestamp: 123 },
      };

      const mockResponse = {
        body: mockMetadataResponse,
      };
      const mockConversationResponse = {
        body: { conversation: [conversationWithNestedParams] },
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockConversationResponse);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result[0].bot?.parameters).toEqual({
        'user.name': 'John',
        'user.age': 30,
        'session.id': '123',
      });
    });

    it('should handle array parameters', async () => {
      const conversationWithArrayParams: IvrConversationTurn = {
        bot: {
          reply: 'Hello',
          confidence: 0.9,
          timestamp: 123,
          parameters: [
            { name: 'John', age: 30 },
            { name: 'Jane', age: 25 },
          ],
        },
        customer: { query: 'Hi', sentiment: 1, timestamp: 123 },
      };

      const mockResponse = {
        body: mockMetadataResponse,
      };
      const mockConversationResponse = {
        body: { conversation: [conversationWithArrayParams] },
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockConversationResponse);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      // Array parameters should flatten to the last item's properties
      expect(result[0].bot?.parameters).toEqual({
        name: 'Jane',
        age: 25,
      });
    });
  });
});