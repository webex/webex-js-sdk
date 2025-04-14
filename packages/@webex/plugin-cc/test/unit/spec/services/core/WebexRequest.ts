import WebexRequest from '../../../../../src/services/core/WebexRequest';
import {HTTP_METHODS, WebexSDK} from '../../../../../src/types';
import {IHttpResponse} from '../../../../../src/types';

const mockWebex = {
  request: jest.fn(),
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
} as unknown as WebexSDK;

// Cast the request function to a Jest mock function
const mockRequest = mockWebex.request as jest.Mock;

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
    it('should upload logs and return the response', async () => {
      const mockMetaData = { key: 'value' };
      const mockResponse = { statusCode: 200, body: { message: 'Logs uploaded' } };

      mockWebex.internal = {
        support: {
          submitLogs: jest.fn().mockResolvedValueOnce(mockResponse),
        },
      };

      const result = await webexRequest.uploadLogs(mockMetaData);

      expect(result).toEqual(mockResponse);
      expect(mockWebex.internal.support.submitLogs).toHaveBeenCalledWith(mockMetaData);
    });

    it('should log and throw an error if the upload fails', async () => {
      const mockMetaData = { key: 'value' };
      const mockError = new Error('Upload failed');

      mockWebex.internal = {
        support: {
          submitLogs: jest.fn().mockRejectedValueOnce(mockError),
        },
      };

      await expect(webexRequest.uploadLogs(mockMetaData)).rejects.toThrow('Upload failed');
    });
  });
});