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
import ivrTranscriptFixture from '../../fixture/ivr-transcript';

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

  // Mock data constants from fixture
  const {
    mockOrgId,
    mockInteractionId,
    mockTimeOutMins,
    mockTranscriptPath,
    mockNonS3TranscriptPath,
    mockTranscriptMetadata,
    mockMetadataResponse,
    mockConversationTurn,
    mockConversationResponse,
    mockConversationWithNestedParams,
    mockConversationWithArrayParams,
    mockMultipleTranscriptsMetadata,
    mockThreeTranscriptsMetadata,
    mockApiResponses
  } = ivrTranscriptFixture;

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
      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataSuccess)
        .mockResolvedValueOnce(mockApiResponses.conversationSuccess);

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
      (webex.request as jest.Mock).mockResolvedValue(mockApiResponses.metadataEmpty);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(LoggerProxy.warn).toHaveBeenCalledWith('No IVR transcripts found for interaction', {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId: mockInteractionId,
      });

      expect(result).toEqual([]);
    });

    it('should handle different conversation response formats', async () => {
      // Test wrapped conversation response (standard format)
      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataSuccess)
        .mockResolvedValueOnce(mockApiResponses.conversationSuccess);

      let result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].bot?.reply).toBe('Hello');

      // Test empty conversation response
      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataSuccess)
        .mockResolvedValueOnce(mockApiResponses.conversationEmpty);

      result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result).toEqual([]);
    });

    it('should continue processing other transcripts when middle transcript fails (3 transcripts, 2nd fails)', async () => {
      const error = new Error('Failed to fetch transcript from S3');
      (error as any).statusCode = 500;

      // Mock: 1st succeeds, 2nd fails, 3rd succeeds
      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataThreeTranscripts) // metadata call
        .mockResolvedValueOnce(mockApiResponses.conversationSuccessBot1) // 1st transcript succeeds
        .mockRejectedValueOnce(error) // 2nd transcript fails
        .mockResolvedValueOnce(mockApiResponses.conversationSuccessBot3); // 3rd transcript succeeds

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      // Should have warned about the failed transcript
      expect(LoggerProxy.warn).toHaveBeenCalledWith(
        `Failed to process transcript trans2 (Status: 500): ${error}`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId: mockInteractionId,
        }
      );

      // Should return results from 1st and 3rd transcripts combined (4 conversation turns total)
      expect(result.length).toBe(4);
      
      // Validate we got the combination of 1st and 3rd transcripts
      // First transcript conversation turns (Bot1)
      expect(result[0].bot?.reply).toBe('Hello! I am your virtual assistant. I can help you with billing, account, and technical support. Please select: 1.Billing 2.Account 3.Technical Support');
      expect(result[0].bot?.botName).toBe('Bot1');
      expect(result[0].customer).toEqual({});

      expect(result[1].bot?.reply).toBe('I can help you with your billing questions. Let me transfer you to our billing specialist.');
      expect(result[1].bot?.botName).toBe('Bot1');
      expect(result[1].bot?.confidence).toBe(0.95);
      expect(result[1].bot?.parameters?.department).toBe('billing');
      expect(result[1].bot?.parameters?.priority).toBe('high');
      expect(result[1].customer?.query).toBe('I need help with billing');
      expect(result[1].customer?.confidence).toBe(0.8);

      // Third transcript conversation turns (Bot3) 
      expect(result[2].bot?.reply).toBe('Technical support is available. I can help you with device setup, troubleshooting, and more.');
      expect(result[2].bot?.botName).toBe('Bot3');
      expect(result[2].customer).toEqual({});
      
      expect(result[3].bot?.reply).toBe('I will transfer you to technical support now. Please hold while I connect you.');
      expect(result[3].bot?.botName).toBe('Bot3');
      expect(result[3].bot?.confidence).toBe(0.92);
      expect(result[3].bot?.parameters?.department).toBe('tech-support');
      expect(result[3].bot?.parameters?.action).toBe('transfer');
      expect(result[3].customer?.query).toBe('Can you transfer me to technical support?');
      expect(result[3].customer?.confidence).toBe(0.7);

      // Validate we do NOT have any data from Bot2 (the failed one)
      const allBotNames = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot?.botName);
      expect(allBotNames).toEqual(['Bot1', 'Bot1', 'Bot3', 'Bot3']);
      expect(allBotNames).not.toContain('Bot2');

      // Validate we do NOT have Bot2's specific content
      const allBotReplies = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot?.reply);
      expect(allBotReplies).not.toContain('I can help you with account-related queries. Please tell me what you need assistance with.');
      expect(allBotReplies).not.toContain('Let me check your account details and connect you with our account specialist.');

      const allCustomerQueries = result
        .filter(turn => turn.customer?.query) // Filter out empty customer objects
        .map(turn => turn.customer?.query);
      expect(allCustomerQueries).not.toContain('What about my account?');
    });

    it('should successfully process all 3 transcripts when no failures occur', async () => {
      // Mock: all 3 transcripts succeed
      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataThreeTranscripts) // metadata call
        .mockResolvedValueOnce(mockApiResponses.conversationSuccessBot1) // 1st transcript succeeds
        .mockResolvedValueOnce(mockApiResponses.conversationSuccessBot2) // 2nd transcript succeeds  
        .mockResolvedValueOnce(mockApiResponses.conversationSuccessBot3); // 3rd transcript succeeds

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      // Should return results from all 3 transcripts (6 conversation turns total)
      expect(result.length).toBe(6);
      
      // Validate we got all 3 transcripts in the correct order
      const allBotNames = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot?.botName);
      expect(allBotNames).toEqual(['Bot1', 'Bot1', 'Bot2', 'Bot2', 'Bot3', 'Bot3']);

      // Validate specific content from each transcript
      const allCustomerQueries = result
        .filter(turn => turn.customer?.query) // Filter out empty customer objects
        .map(turn => turn.customer?.query);
      expect(allCustomerQueries).toContain('I need help with billing'); // Bot1
      expect(allCustomerQueries).toContain('What about my account?'); // Bot2
      expect(allCustomerQueries).toContain('Can you transfer me to technical support?'); // Bot3

      const allBotReplies = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot?.reply);
      expect(allBotReplies).toContain('I can help you with your billing questions. Let me transfer you to our billing specialist.'); // Bot1
      expect(allBotReplies).toContain('Let me check your account details and connect you with our account specialist.'); // Bot2
      expect(allBotReplies).toContain('I will transfer you to technical support now. Please hold while I connect you.'); // Bot3
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
      const mockConversationResponseWithNested = {
        body: { conversation: [mockConversationWithNestedParams] },
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataSuccess)
        .mockResolvedValueOnce(mockConversationResponseWithNested);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      expect(result[0].bot?.parameters).toEqual({
        'user.name': 'John',
        'user.age': 30,
        'session.id': '123',
      });
    });

    it('should handle array parameters', async () => {
      const mockConversationResponseWithArray = {
        body: { conversation: [mockConversationWithArrayParams] },
      };

      (webex.request as jest.Mock)
        .mockResolvedValueOnce(mockApiResponses.metadataSuccess)
        .mockResolvedValueOnce(mockConversationResponseWithArray);

      const result = await service.fetchIVRTranscript(mockOrgId, mockInteractionId, mockTimeOutMins);

      // Array parameters should flatten with array indices preserved
      expect(result[0].bot?.parameters).toEqual({
        '[0].name': 'John',
        '[0].age': 30,
        '[1].name': 'Jane', 
        '[1].age': 25,
      });
    });
  });
});