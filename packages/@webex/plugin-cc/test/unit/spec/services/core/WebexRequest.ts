import WebexRequest from '../../../../../src/services/core/WebexRequest';
import {HTTP_METHODS, WebexSDK} from '../../../../../src/types';
import {IHttpResponse} from '../../../../../src/types';
import LoggerProxy from '../../../../../src/logger-proxy';
import {WEBEX_REQUEST_FILE} from '../../../../../src/constants';
import MetricsManager from '../../../../../src/metrics/MetricsManager';
const mockWebex = {
  request: jest.fn(),
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
} as unknown as WebexSDK;

// Cast the request function to a Jest mock function
const mockRequest = mockWebex.request as jest.Mock;

jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WebexRequest', () => {
  let webexRequest;
  beforeEach(() => {
    webexRequest = WebexRequest.getInstance({webex: mockWebex});
  });

  describe('request', () => {
    it('should send a request and return the response', async () => {
      const mockResponse: IHttpResponse = {
        statusCode: 200,
        body: { message: 'Success' },
        method: 'POST',
        url: 'https://example.com/resource',
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const result = await webexRequest.request({
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        body: { key: 'value' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledWith({
        service: 'service',
        resource: 'resource',
        method: HTTP_METHODS.POST,
        body: { key: 'value' },
      });
    });

    it('should log and throw an error if the request fails', async () => {
      const mockError = new Error('Request failed');
      mockRequest.mockRejectedValueOnce(mockError);

      await expect(
        webexRequest.request({
          service: 'service',
          resource: 'resource',
          method: HTTP_METHODS.POST,
          body: { key: 'value' },
        })
      ).rejects.toThrow('Request failed');
    });
  });

  describe('uploadLogs', () => {
    let mockMetricsManager;
    beforeEach(() => {
      // Mock the crypto.randomUUID function
      global.crypto = {
        randomUUID: jest.fn().mockReturnValue("mocked-uuid-12345")
      } as unknown as Crypto;

      mockMetricsManager = {
        trackEvent: jest.fn(),
        timeEvent: jest.fn(),
      };
      
      jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);
      
    });

    it('should upload logs and return the response', async () => {
      const mockMetaData = { key: 'value' };
      const mockResponse = { trackingid: '1234'};

      mockWebex.internal = {
        support: {
          submitLogs: jest.fn().mockResolvedValueOnce(mockResponse),
        },
      };

      const result = await webexRequest.uploadLogs(mockMetaData);

      expect(result).toEqual({...mockResponse, feedbackId: "mocked-uuid-12345"});
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        `Logs uploaded successfully with feedbackId: mocked-uuid-12345`,
        {module: WEBEX_REQUEST_FILE, method: 'uploadLogs'}
      );
      expect(mockMetricsManager.trackEvent).toBeCalledWith(
        "Upload Logs Success", 
        {feedbackId: "mocked-uuid-12345", trackingId: '1234'}, 
        ["behavioral"]
      );
      expect(mockWebex.internal.support.submitLogs).toHaveBeenCalledWith({... mockMetaData, feedbackId: "mocked-uuid-12345"}, undefined, {type: 'diff'});
    });

    it('should log and throw an error if the upload fails', async () => {
      const mockMetaData = { key: 'value' , correlationId: 'correlation-id' };
      const mockError = new Error('Upload failed');
      mockError.stack = "My stack"
      mockWebex.internal = {
        support: {
          submitLogs: jest.fn().mockRejectedValueOnce(mockError),
        },
      };

      await expect(webexRequest.uploadLogs(mockMetaData)).rejects.toThrow('Upload failed');
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Error uploading logs: ${mockError}`,
        {module: WEBEX_REQUEST_FILE, method: 'uploadLogs'}
      );
      expect(mockMetricsManager.trackEvent).toBeCalledWith(
        "Upload Logs Failed", 
        {stack: "My stack", feedbackId: "mocked-uuid-12345", correlationId: 'correlation-id'}, 
        ["behavioral"]
      );
    });
  });
});