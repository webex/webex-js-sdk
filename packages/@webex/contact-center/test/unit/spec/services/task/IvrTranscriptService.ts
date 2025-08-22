import 'jsdom-global/register';
import IvrTranscriptService from '../../../../../src/services/task/IvrTranscriptService';
import LoggerProxy from '../../../../../src/logger-proxy';

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
  let mockWebex: any;

  beforeEach(() => {
    mockWebex = {
      credentials: {
        getUserToken: jest.fn().mockResolvedValue('Bearer mocktoken'),
      },
      request: jest.fn(),
    };

    service = new IvrTranscriptService(mockWebex);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getIvrTranscriptMetadata', () => {
    const orgId = 'org1';
    const interactionId = 'int1';
    const timeOutMins = 5;

    it('should call the correct media storage URL and return metadata successfully', async () => {
      const mockResponse = {
        body: {
          orgId,
          interactionId,
          timeOutMins,
          transcripts: [
            {
              orgId,
              transcriptId: 'trans1',
              transcriptPath: 'https://s3.com/file.json',
              cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
              startTime: 123,
              stopTime: 456,
              botName: 'TestBot',
            },
          ],
        },
      };

      mockWebex.request.mockResolvedValue(mockResponse);

      const result = await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);

      expect(mockWebex.request).toHaveBeenCalledWith({
        uri: `https://mediastorage.produs1.ciscoccservice.com/media/organization/${orgId}/interaction/${interactionId}/ivrtranscript?timeOutMins=${timeOutMins}`,
        method: 'GET',
        headers: {
          Authorization: 'Bearer mocktoken',
          'cisco-no-http-redirect': null,
          'spark-user-agent': null,
        },
      });
      
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching IVR transcript metadata', {
        module: 'IvrTranscriptService',
        method: 'getIvrTranscriptMetadata',
        interactionId,
      });
      
      expect(result).toEqual(mockResponse.body);
    });

    it('should handle 400 Bad Request error and throw original error', async () => {
      const error = new Error('Bad Request - Invalid parameters');
      (error as any).statusCode = 400;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 401 Unauthorized error and throw original error', async () => {
      const error = new Error('Unauthorized - Invalid token');
      (error as any).statusCode = 401;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 403 Forbidden error and throw original error', async () => {
      const error = new Error('Forbidden - Access denied');
      (error as any).statusCode = 403;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 404 Not Found error and throw original error', async () => {
      const error = new Error('Not Found - Interaction not found');
      (error as any).statusCode = 404;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 500 Internal Server Error and throw original error', async () => {
      const error = new Error('Internal Server Error - Service unavailable');
      (error as any).statusCode = 500;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 502 Bad Gateway error and throw original error', async () => {
      const error = new Error('Bad Gateway - Upstream server error');
      (error as any).statusCode = 502;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle 503 Service Unavailable error and throw original error', async () => {
      const error = new Error('Service Unavailable - Temporarily unavailable');
      (error as any).statusCode = 503;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });

    it('should handle network timeout error and throw original error', async () => {
      const error = new Error('Request timed out');
      (error as any).code = 'TIMEOUT';

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript metadata: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'getIvrTranscriptMetadata',
            interactionId,
          }
        );
      }
    });
  });

  describe('fetchIvrConversation', () => {
    const transcriptPath = 'https://mediastorage.produs1.ciscoccservice.com/transcript.json';
    const nonS3TranscriptPath = 'https://example.com/transcript.json';

    it('should call webex.request with S3 URL and return conversation successfully', async () => {
      const mockResponse = {
        body: {
          conversation: [
            {
              bot: { reply: 'Hello', timestamp: 123, confidence: 0.9 },
              customer: { query: 'Hi', sentiment: 1, timestamp: 124 },
            },
          ],
        },
      };

      mockWebex.request.mockResolvedValue(mockResponse);

      const result = await service.fetchIvrConversation(transcriptPath);

      expect(mockWebex.request).toHaveBeenCalledWith({
        uri: transcriptPath,
        method: 'GET',
      });

      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching IVR conversation content', {
        module: 'IvrTranscriptService',
        method: 'fetchIvrConversation',
      });

      expect(LoggerProxy.log).toHaveBeenCalledWith('IVR conversation content fetched successfully', {
        module: 'IvrTranscriptService',
        method: 'fetchIvrConversation',
      });

      expect(result).toEqual(mockResponse.body.conversation);
    });

    it('should handle response.body as direct conversation array', async () => {
      const mockResponse = {
        body: [
          { bot: { reply: 'Hello', confidence: 0.9, timestamp: 123 }, customer: { query: 'Hi', sentiment: 1, timestamp: 123 } },
        ],
      };

      mockWebex.request.mockResolvedValue(mockResponse);

      const result = await service.fetchIvrConversation(transcriptPath);

      expect(result).toEqual(mockResponse.body);
    });

    it('should return empty array if response.body is not an object', async () => {
      const mockResponse = { body: undefined };

      mockWebex.request.mockResolvedValue(mockResponse);

      const result = await service.fetchIvrConversation(transcriptPath);

      expect(result).toEqual([]);
    });

    it('should handle non-S3 URLs without special headers', async () => {
      const mockResponse = {
        body: { conversation: [{ bot: { reply: 'Test', confidence: 0.9, timestamp: 123 }, customer: { query: 'Hi', sentiment: 1, timestamp: 123 } }] },
      };

      mockWebex.request.mockResolvedValue(mockResponse);

      await service.fetchIvrConversation(nonS3TranscriptPath);

      expect(mockWebex.request).toHaveBeenCalledWith({
        uri: nonS3TranscriptPath,
        method: 'GET',
      });
    });

    it('should handle 400 Bad Request error and throw original error', async () => {
      const error = new Error('Bad Request - Invalid S3 path');
      (error as any).statusCode = 400;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should handle 401 Unauthorized error and throw original error', async () => {
      const error = new Error('Unauthorized - Authentication failed');
      (error as any).statusCode = 401;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should handle 403 Forbidden CORS error and throw original error', async () => {
      const error = new Error('Forbidden - CORS policy violation');
      (error as any).statusCode = 403;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should handle 404 Not Found error and throw original error', async () => {
      const error = new Error('Not Found - Transcript file not found');
      (error as any).statusCode = 404;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should handle 500 Internal Server Error and throw original error', async () => {
      const error = new Error('Internal Server Error - S3 service error');
      (error as any).statusCode = 500;

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should handle network connection error and throw original error', async () => {
      const error = new Error('Connection refused');
      (error as any).code = 'ECONNREFUSED';

      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR conversation content: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIvrConversation',
          }
        );
      }
    });

    it('should throw if webex.request fails', async () => {
      const error = new Error('Network failed');
      mockWebex.request.mockRejectedValue(error);

      try {
        await service.fetchIvrConversation(transcriptPath);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
      }
    });
  });

  describe('fetchIVRTranscript', () => {
    const orgId = 'org1';
    const interactionId = 'int1';
    const timeOutMins = 5;

    it('should fetch metadata, then fetch and parse all conversations successfully', async () => {
      const metaData = {
        orgId,
        interactionId,
        timeOutMins,
        transcripts: [
          {
            orgId,
            transcriptId: 'trans1',
            transcriptPath: 'https://s3.com/file1.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 123,
            stopTime: 456,
            botName: 'Bot1',
          },
          {
            orgId,
            transcriptId: 'trans2',
            transcriptPath: 'https://s3.com/file2.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 789,
            stopTime: 999,
            botName: 'Bot2',
          },
        ],
      };

      const conv1 = [
        { bot: { reply: 'Hi', parameters: { foo: 'bar' }, confidence: 0.9, timestamp: 123 }, customer: { query: 'Hello', sentiment: 1, timestamp: 123 } },
      ];
      const conv2 = [
        { bot: { reply: 'Hello', parameters: { bar: 'baz' }, confidence: 0.8, timestamp: 124 }, customer: { query: 'Hi', sentiment: 1, timestamp: 124 } },
      ];

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockResolvedValue(metaData as any);
      jest.spyOn(service as any, 'fetchIvrConversation')
        .mockResolvedValueOnce(conv1 as any)
        .mockResolvedValueOnce(conv2 as any);

      const result = await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching complete IVR transcript with metadata and conversations', {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId,
      });

      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Retrieved transcript metadata containing ${metaData.transcripts.length} transcript files`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
        }
      );

      expect(result.length).toBe(2);
      expect(result[0].bot!.reply).toBe('Hi');
      expect(result[1].bot!.reply).toBe('Hello');
    });

    it('should return empty array if no transcripts found', async () => {
      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockResolvedValue({ transcripts: [] } as any);

      const result = await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);

      expect(LoggerProxy.warn).toHaveBeenCalledWith('No IVR transcripts found for interaction', {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId,
      });

      expect(result).toEqual([]);
    });

    it('should continue processing other transcripts if one transcript fetch fails', async () => {
      const metaData = {
        transcripts: [
          { transcriptId: 't1', transcriptPath: 'url1', botName: 'Bot1' },
          { transcriptId: 't2', transcriptPath: 'url2', botName: 'Bot2' },
        ],
      };

      const error = new Error('Failed to fetch transcript');
      (error as any).statusCode = 500;

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockResolvedValue(metaData as any);
      jest.spyOn(service as any, 'fetchIvrConversation')
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce([{ bot: { reply: 'ok', confidence: 0.9, timestamp: 123 }, customer: { query: 'test', sentiment: 1, timestamp: 123 } }] as any);

      const result = await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);

      expect(LoggerProxy.warn).toHaveBeenCalledWith(
        `Failed to process transcript t1: ${error}`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId,
        }
      );

      expect(result.length).toBe(1);
      expect(result[0].bot!.reply).toBe('ok');
    });

    it('should handle metadata fetch failure with 401 error and throw original error', async () => {
      const error = new Error('Unauthorized - Token expired');
      (error as any).statusCode = 401;

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockRejectedValue(error);

      try {
        await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          }
        );
      }
    });

    it('should handle 400 Bad Request from metadata and throw original error', async () => {
      const error = new Error('Bad Request - Invalid organization ID');
      (error as any).statusCode = 400;

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockRejectedValue(error);

      try {
        await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          }
        );
      }
    });

    it('should handle 404 Not Found from metadata and throw original error', async () => {
      const error = new Error('Not Found - Interaction ID not found');
      (error as any).statusCode = 404;

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockRejectedValue(error);

      try {
        await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          }
        );
      }
    });

    it('should handle 500 Internal Server Error from metadata and throw original error', async () => {
      const error = new Error('Internal Server Error - Database connection failed');
      (error as any).statusCode = 500;

      jest.spyOn(service as any, 'getIvrTranscriptMetadata').mockRejectedValue(error);

      try {
        await service.fetchIVRTranscript(orgId, interactionId, timeOutMins);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
        expect(LoggerProxy.error).toHaveBeenCalledWith(
          `Failed to fetch IVR transcript: ${error}`,
          {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          }
        );
      }
    });
  });

  describe('parseConversations', () => {
    it('should parse conversations and flatten bot parameters', () => {
      const conversation = [
        {
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
        },
      ] as any;

      const result = (service as any).parseConversations(conversation, 'TestBot');

      expect(result[0].bot.botName).toBe('TestBot');
      expect(result[0].bot.parameters).toEqual({
        'user.name': 'John',
        'user.age': 30,
        'session.id': '123',
      });
    });
  });

  describe('getFlatParams', () => {
    it('should flatten nested object parameters', () => {
      const params = {
        user: { name: 'John', details: { age: 30, city: 'NYC' } },
        session: { id: '123' },
      };

      const result = (service as any).getFlatParams(params, '');

      expect(result).toEqual({
        'user.name': 'John',
        'user.details.age': 30,
        'user.details.city': 'NYC',
        'session.id': '123',
      });
    });

    it('should handle array parameters', () => {
      const params = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];

      const result = (service as any).getFlatParams(params, 'users');

      expect(result).toEqual({
        'users.name': 'Jane',
        'users.age': 25,
      });
    });
  });
});