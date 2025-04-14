import HttpRequest from '../../../../../src/services/core/HttpRequest';
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

describe('HttpRequest', () => {
  let httpRequest;
  beforeEach(() => {
    httpRequest = HttpRequest.getInstance({webex: mockWebex});
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

      const result = await httpRequest.request({
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
        httpRequest.request({
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

      const result = await httpRequest.uploadLogs(mockMetaData);

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

      await expect(httpRequest.uploadLogs(mockMetaData)).rejects.toThrow('Upload failed');
    });
  }
  );
});