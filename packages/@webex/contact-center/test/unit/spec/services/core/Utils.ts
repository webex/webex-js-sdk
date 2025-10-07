import * as Utils from '../../../../../src/services/core/Utils';
import LoggerProxy from '../../../../../src/logger-proxy';
import WebexRequest from '../../../../../src/services/core/WebexRequest';
import {LoginOption, WebexRequestPayload} from '../../../../../src/types';
import {Failure} from '../../../../../src/services/core/GlobalTypes';

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
    },
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
        `${methodName} failed with reason: ${error.details.data.reason}`,
        {module: moduleName, method: methodName, trackingId: 'test-tracking-id'}
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

      Utils.getErrorDetails(error, 'silentRelogin', moduleName);

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
        `someMethod failed with reason: ${error.details.data.reason}`,
        {module: moduleName, method: 'someMethod', trackingId: trackingId}
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
        code: 500,
      };

      const result = Utils.getErrorDetails(unexpectedError, methodName, moduleName);

      // Should use default error message when structure is unexpected
      expect(result).toEqual({
        error: new Error(`Error while performing ${methodName}`),
        reason: `Error while performing ${methodName}`,
      });

      // Should not throw when accessing properties with optional chaining
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `${methodName} failed with reason: Error while performing ${methodName}`,
        {module: moduleName, method: methodName, trackingId: undefined}
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
        `${methodName} failed with reason: ${error.details.data.reason}`,
        {module: moduleName, method: methodName, trackingId: detailsTrackingId}
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
        headers: {trackingid: 'test-tracking-id'},
        body: {message: 'Error message'},
      };

      const result = Utils.createErrDetailsObject(errObj);

      expect(result.code).toBe('Service.reqs.generic.failure');
      expect(result.data).toEqual({
        trackingId: 'test-tracking-id',
        msg: {message: 'Error message'},
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

  describe('getStationLoginErrorData', () => {
    it('should return DUPLICATE_LOCATION message and fieldName for extension', () => {
      const failure = {data: {reason: 'DUPLICATE_LOCATION'}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.EXTENSION);
      expect(result).toEqual({
        message: 'This extension is already in use',
        fieldName: LoginOption.EXTENSION,
      });
    });

    it('should return DUPLICATE_LOCATION message and fieldName for DN number', () => {
      const failure = {data: {reason: 'DUPLICATE_LOCATION'}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.AGENT_DN);
      expect(result).toEqual({
        message:
          'Dial number is in use. Try a different one. For help, reach out to your administrator or support team.',
        fieldName: LoginOption.AGENT_DN,
      });
    });

    it('should return INVALID_DIAL_NUMBER message and fieldName', () => {
      const failure = {data: {reason: 'INVALID_DIAL_NUMBER'}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.AGENT_DN);
      expect(result).toEqual({
        message:
          'Enter a valid US dial number. For help, reach out to your administrator or support team.',
        fieldName: LoginOption.AGENT_DN,
      });
    });

    it('should return default message and fieldName for empty reason', () => {
      const failure = {data: {reason: ''}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.EXTENSION);
      expect(result).toEqual({
        message: 'An error occurred while logging in to the station',
        fieldName: 'generic',
      });
    });

    it('should return default message and fieldName for missing reason', () => {
      const failure = {data: {}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.EXTENSION);
      expect(result).toEqual({
        message: 'An error occurred while logging in to the station',
        fieldName: 'generic',
      });
    });

    it('should return default message and fieldName for unknown reason', () => {
      const failure = {data: {reason: 'UNKNOWN_REASON'}} as Failure;
      const result = Utils.getStationLoginErrorData(failure, LoginOption.EXTENSION);
      expect(result).toEqual({
        message: 'An error occurred while logging in to the station',
        fieldName: 'generic',
      });
    });
  });

  describe('getDestinationAgentId', () => {
    const currentAgentId = 'agent-current-123';

    it('returns another Agent id when present and not in wrap-up', () => {
      const participants: any = {
        [currentAgentId]: {type: 'Agent', id: currentAgentId, isWrapUp: false},
        agent1: {type: 'Agent', id: 'agent-1', isWrapUp: false},
        customer1: {type: 'Customer', id: 'cust-1', isWrapUp: false},
      };

      const result = Utils.getDestinationAgentId(participants, currentAgentId);
      expect(result).toBe('agent-1');
    });

    it('ignores self and wrap-up participants', () => {
      const participants: any = {
        [currentAgentId]: {type: 'Agent', id: currentAgentId, isWrapUp: false},
        agentWrap: {type: 'Agent', id: 'agent-wrap', isWrapUp: true},
      };

      const result = Utils.getDestinationAgentId(participants, currentAgentId);
      expect(result).toBe('');
    });

    it('supports DN, EpDn and entryPoint types', () => {
      const participantsDN: any = {
        [currentAgentId]: {type: 'Agent', id: currentAgentId, isWrapUp: false},
        dn1: {type: 'DN', id: 'dn-1', isWrapUp: false},
      };
      expect(Utils.getDestinationAgentId(participantsDN, currentAgentId)).toBe('dn-1');

      const participantsEpDn: any = {
        [currentAgentId]: {type: 'Agent', id: currentAgentId, isWrapUp: false},
        epdn1: {type: 'EpDn', id: 'epdn-1', isWrapUp: false},
      };
      expect(Utils.getDestinationAgentId(participantsEpDn, currentAgentId)).toBe('epdn-1');

      const participantsEntry: any = {
        [currentAgentId]: {type: 'Agent', id: currentAgentId, isWrapUp: false},
        entry1: {type: 'entryPoint', id: 'entry-1', isWrapUp: false},
      };
      expect(Utils.getDestinationAgentId(participantsEntry, currentAgentId)).toBe('entry-1');
    });

    it('returns empty string when participants is missing or empty', () => {
      expect(Utils.getDestinationAgentId(undefined as any, currentAgentId)).toBe('');
      expect(Utils.getDestinationAgentId({} as any, currentAgentId)).toBe('');
    });
  });
});
