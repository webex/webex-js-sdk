import * as Utils from '../../../../../src/services/core/Utils';
import LoggerProxy from '../../../../../src/logger-proxy';
import WebexRequest from '../../../../../src/services/core/WebexRequest';
import { WebexRequestPayload } from '../../../../../src/types';

// Mock dependencies
jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      uploadLogs: jest.fn(),
    }),
  },
}));

// Mock Err module
jest.mock('../../../../../src/services/core/Err', () => {
  return {
    __esModule: true,
    Details: class Details {
      code: string;
      data: any;
      constructor(code: string, data: any) {
        this.code = code;
        this.data = data;
      }
    }
  };
});

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Skip getCommonErrorDetails tests as it's a private function
  // and we'll test its behavior through createErrDetailsObject instead

  describe('getErrorDetails', () => {
    const methodName = 'testMethod';
    const moduleName = 'testModule';

    it('should extract reason from error details', () => {
      const error = {
        details: {
          data: {
            reason: 'Test reason',
          },
          trackingId: 'test-tracking-id',
        },
      };

      const result = Utils.getErrorDetails(error, methodName, moduleName);

      expect(result).toEqual({
        error: new Error('Test reason'),
        reason: 'Test reason',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `${methodName} failed with trackingId: test-tracking-id`,
        { module: moduleName, method: methodName }
      );
    });

    it('should use default reason when reason is not provided', () => {
      const error = {
        details: {
          data: {},
          trackingId: 'test-tracking-id',
        },
      };

      const result = Utils.getErrorDetails(error, methodName, moduleName);

      expect(result).toEqual({
        error: new Error(`Error while performing ${methodName}`),
        reason: `Error while performing ${methodName}`,
      });
    });

    it('should not upload logs when reason is AGENT_NOT_FOUND and method is silentReLogin', () => {
      const error = {
        details: {
          data: {
            reason: 'AGENT_NOT_FOUND',
            trackingId: 'test-tracking-id',
          },
        },
      };

      Utils.getErrorDetails(error, 'silentReLogin', moduleName);

      expect(LoggerProxy.error).not.toHaveBeenCalled();
      expect(WebexRequest.getInstance().uploadLogs).not.toHaveBeenCalled();
    });

    it('should upload logs for normal error scenarios', () => {
      const trackingId = 'normal-error-tracking-id';
      const error = {
        details: {
          data: {
            reason: 'SOME_OTHER_ERROR',
            trackingId: trackingId,
          },
          trackingId: trackingId,
        },
      };

      Utils.getErrorDetails(error, 'someMethod', moduleName);

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'someMethod failed with trackingId: normal-error-tracking-id',
        { module: moduleName, method: 'someMethod' }
      );
      expect(WebexRequest.getInstance().uploadLogs).toHaveBeenCalledWith({
        correlationId: trackingId,
      });
    });

    it('should handle null or undefined error object gracefully', () => {
      // This should throw an error because the function tries to access error.details
      expect(() => {
        Utils.getErrorDetails(null, methodName, moduleName);
      }).toThrow(TypeError);
      
      expect(() => {
        Utils.getErrorDetails(undefined, methodName, moduleName);
      }).toThrow(TypeError);
    });

    it('should handle error objects with unexpected structure', () => {
      const unexpectedError = {
        // No details property
        message: 'Unexpected error structure',
        code: 500
      };

      const result = Utils.getErrorDetails(unexpectedError, methodName, moduleName);

      // Should use default error message when structure is unexpected
      expect(result).toEqual({
        error: new Error(`Error while performing ${methodName}`),
        reason: `Error while performing ${methodName}`,
      });
      
      // Should not throw when accessing properties with optional chaining
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `${methodName} failed with trackingId: undefined`,
        { module: moduleName, method: methodName }
      );
    });

    it('should prioritize trackingId from the correct location when present in multiple places', () => {
      const detailsTrackingId = 'details-level-tracking-id';
      const dataTrackingId = 'data-level-tracking-id';
      
      const error = {
        details: {
          data: {
            reason: 'TEST_REASON',
            trackingId: dataTrackingId, // This should be used for uploadLogs
          },
          trackingId: detailsTrackingId, // This should be used for error logging
        },
      };

      Utils.getErrorDetails(error, methodName, moduleName);

      // Check if error logging uses the trackingId from the details level
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `${methodName} failed with trackingId: ${detailsTrackingId}`,
        { module: moduleName, method: methodName }
      );
      
      // Check if uploadLogs uses the trackingId from the details level
      expect(WebexRequest.getInstance().uploadLogs).toHaveBeenCalledWith({
        correlationId: detailsTrackingId,
      });
    });
  });

  describe('createErrDetailsObject', () => {
    it('should create error details object with correct parameters', () => {
      const errObj: WebexRequestPayload = {
        headers: { trackingid: 'test-tracking-id' },
        body: { message: 'Error message' },
      };

      const result = Utils.createErrDetailsObject(errObj);

      expect(result.code).toBe('Service.reqs.generic.failure');
      expect(result.data).toEqual({
        trackingId: 'test-tracking-id',
        msg: { message: 'Error message' },
      });
    });

    it('should handle missing data in error payload', () => {
      const errObj: WebexRequestPayload = {};

      const result = Utils.createErrDetailsObject(errObj);

      expect(result.code).toBe('Service.reqs.generic.failure');
      expect(result.data).toEqual({
        trackingId: undefined,
        msg: undefined,
      });
    });
  });
});