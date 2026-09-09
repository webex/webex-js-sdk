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
    warn: jest.fn(),
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

    it('should return DUPLICATE_LOCATION message and fieldName for dial number', () => {
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
          'Enter a valid dial number. For help, reach out to your administrator or support team.',
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

  describe('getConsultedAgentId', () => {
    const currentAgentId = 'agent-123';

    it('should return consulted agent ID from consult media', () => {
      const media: any = {
        mainCall: {
          mType: 'mainCall',
          participants: [currentAgentId, 'customer-1'],
        },
        consultCall: {
          mType: 'consult',
          participants: [currentAgentId, 'agent-456'],
        },
      };

      const result = Utils.getConsultedAgentId(media, currentAgentId);
      expect(result).toBe('agent-456');
    });

    it('should return empty string when no consult media exists', () => {
      const media: any = {
        mainCall: {
          mType: 'mainCall',
          participants: [currentAgentId, 'customer-1'],
        },
      };

      const result = Utils.getConsultedAgentId(media, currentAgentId);
      expect(result).toBe('');
    });

    it('should return empty string when current agent is not in consult participants', () => {
      const media: any = {
        consultCall: {
          mType: 'consult',
          participants: ['other-agent-1', 'other-agent-2'],
        },
      };

      const result = Utils.getConsultedAgentId(media, currentAgentId);
      expect(result).toBe('');
    });

    it('should handle empty media object', () => {
      const result = Utils.getConsultedAgentId({}, currentAgentId);
      expect(result).toBe('');
    });

    it('should handle multiple media entries and find consult', () => {
      const media: any = {
        media1: {mType: 'mainCall', participants: [currentAgentId]},
        media2: {mType: 'hold', participants: []},
        media3: {mType: 'consult', participants: [currentAgentId, 'consulted-agent']},
      };

      const result = Utils.getConsultedAgentId(media, currentAgentId);
      expect(result).toBe('consulted-agent');
    });
  });

  describe('getDestAgentIdForCBT', () => {
    it('should return destination agent ID for CBT scenario', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'agent-uuid-123',
          },
          'customer-1': {
            type: 'Customer',
            pType: 'Customer',
            id: 'customer-1',
          },
        },
      };
      const consultingAgent = '5551234567'; // Phone number, not in participants as key

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('agent-uuid-123');
    });

    it('should return empty string when consultingAgent is in participants (non-CBT)', () => {
      const interaction: any = {
        participants: {
          'agent-123': {
            type: 'Agent',
            pType: 'Agent',
            id: 'agent-123',
          },
        },
      };
      const consultingAgent = 'agent-123'; // Exists as key in participants

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('');
    });

    it('should return empty string when no matching dial number found', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5559999999',
            id: 'agent-uuid-123',
          },
        },
      };
      const consultingAgent = '5551234567'; // Different number

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('');
    });

    it('should return empty string when consultingAgent is empty', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '');
      expect(result).toBe('');
    });

    it('should match only when participant type is dial number and type is Agent', () => {
      const interaction: any = {
        participants: {
          'participant-1': {
            type: 'Customer',
            pType: 'dn',
            dn: '5551234567',
          },
          'participant-2': {
            type: 'Agent',
            pType: 'Agent',
            dn: '5551234567',
          },
          'participant-3': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'correct-agent',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '5551234567');
      expect(result).toBe('participant-3');
    });

    it('should handle case-insensitive participant type comparison', () => {
      const interaction: any = {
        participants: {
          'agent-uuid': {
            type: 'Agent',
            pType: 'DN', // Uppercase (dial number)
            dn: '5551234567',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '5551234567');
      expect(result).toBe('agent-uuid');
    });
  });

  describe('calculateDestAgentId', () => {
    const currentAgentId = 'agent-123';

    it('should return destAgentIdCBT when found', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, '5551234567'],
          },
        },
        participants: {
          'agent-uuid-456': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'agent-uuid-456',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('agent-uuid-456');
    });

    it('should return participant id for regular agent when not CBT', () => {
      const consultedAgentId = 'agent-456';
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, consultedAgentId],
          },
        },
        participants: {
          [consultedAgentId]: {
            type: 'Agent',
            id: consultedAgentId,
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe(consultedAgentId);
    });

    it('should return epId for EpDn type participants', () => {
      const consultedAgentId = 'epdn-456';
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, consultedAgentId],
          },
        },
        participants: {
          [consultedAgentId]: {
            type: 'EpDn',
            id: consultedAgentId,
            epId: 'entry-point-id-789',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('entry-point-id-789');
    });

    it('should return undefined when no consulting agent found', () => {
      const interaction: any = {
        media: {
          mainCall: {
            mType: 'mainCall',
            participants: [currentAgentId],
          },
        },
        participants: {},
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('');
    });

    it('should handle CBT scenario when phone number is not a direct participant key', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, '5551234567'], // Phone number in media
          },
        },
        participants: {
          // Note: '5551234567' is NOT a key - this is CBT
          'agent-uuid-cbt': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567', // Found by matching DN
            id: 'agent-uuid-cbt',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('agent-uuid-cbt'); // Returns the CBT agent
    });
  });

  describe('calculateDestType', () => {
    const currentAgentId = 'current-agent-123';

    it('should return DIALNUMBER when pType is DN', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, 'dest-agent-456'],
          },
        },
        participants: {
          [currentAgentId]: {type: 'Agent', pType: 'Agent'},
          'dest-agent-456': {type: 'Agent', pType: 'DN', id: 'dest-agent-456'},
        },
      };

      const result = Utils.calculateDestType(interaction, currentAgentId);
      expect(result).toBe('dialNumber');
    });

    it('should return ENTRYPOINT when pType is EP-DN', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, 'dest-agent-456'],
          },
        },
        participants: {
          [currentAgentId]: {type: 'Agent', pType: 'Agent'},
          'dest-agent-456': {type: 'Agent', pType: 'EP-DN', id: 'dest-agent-456'},
        },
      };

      const result = Utils.calculateDestType(interaction, currentAgentId);
      expect(result).toBe('entryPoint');
    });

    it('should return lowercase pType for other types', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, 'dest-agent-456'],
          },
        },
        participants: {
          [currentAgentId]: {type: 'Agent', pType: 'Agent'},
          'dest-agent-456': {type: 'Agent', pType: 'Agent', id: 'dest-agent-456'},
        },
      };

      const result = Utils.calculateDestType(interaction, currentAgentId);
      expect(result).toBe('agent');
    });

    it('should return agent when no destination agent found', () => {
      const interaction: any = {
        media: {},
        participants: {
          [currentAgentId]: {type: 'Agent', pType: 'Agent'},
        },
      };

      const result = Utils.calculateDestType(interaction, currentAgentId);
      expect(result).toBe('agent');
    });
  });

  describe('buildConsultConferenceParamData', () => {
    it('maps entryPoint destinationType correctly', () => {
      const result = Utils.buildConsultConferenceParamData(
        {
          agentId: 'agent1',
          destinationType: 'entryPoint',
          destAgentId: 'ep123',
        },
        'interaction123'
      );

      expect(result).toEqual({
        interactionId: 'interaction123',
        data: {
          agentId: 'agent1',
          to: 'ep123',
          destinationType: 'entryPoint',
        },
      });
    });

    it('maps EP-DN/EP_DN destinationType variants to entryPoint', () => {
      const hyphenResult = Utils.buildConsultConferenceParamData(
        {
          agentId: 'agent1',
          destinationType: 'EP-DN',
          destAgentId: 'ep123',
        },
        'interaction123'
      );
      const underscoreResult = Utils.buildConsultConferenceParamData(
        {
          agentId: 'agent1',
          destinationType: 'EP_DN',
          destAgentId: 'ep123',
        },
        'interaction123'
      );

      expect(hyphenResult.data.destinationType).toBe('entryPoint');
      expect(underscoreResult.data.destinationType).toBe('entryPoint');
    });
  });

  describe('getDestAgentIdForCBT', () => {
    it('should return destination agent ID for CBT scenario', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'agent-uuid-123',
          },
          'customer-1': {
            type: 'Customer',
            pType: 'Customer',
            id: 'customer-1',
          },
        },
      };
      const consultingAgent = '5551234567'; // Phone number, not in participants as key

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('agent-uuid-123');
    });

    it('should return empty string when consultingAgent is in participants (non-CBT)', () => {
      const interaction: any = {
        participants: {
          'agent-123': {
            type: 'Agent',
            pType: 'Agent',
            id: 'agent-123',
          },
        },
      };
      const consultingAgent = 'agent-123'; // Exists as key in participants

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('');
    });

    it('should return empty string when no matching dial number found', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5559999999',
            id: 'agent-uuid-123',
          },
        },
      };
      const consultingAgent = '5551234567'; // Different number

      const result = Utils.getDestAgentIdForCBT(interaction, consultingAgent);
      expect(result).toBe('');
    });

    it('should return empty string when consultingAgent is empty', () => {
      const interaction: any = {
        participants: {
          'agent-uuid-123': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '');
      expect(result).toBe('');
    });

    it('should match only when participant type is dial number and type is Agent', () => {
      const interaction: any = {
        participants: {
          'participant-1': {
            type: 'Customer',
            pType: 'dn',
            dn: '5551234567',
          },
          'participant-2': {
            type: 'Agent',
            pType: 'Agent',
            dn: '5551234567',
          },
          'participant-3': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'correct-agent',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '5551234567');
      expect(result).toBe('participant-3');
    });

    it('should handle case-insensitive participant type comparison', () => {
      const interaction: any = {
        participants: {
          'agent-uuid': {
            type: 'Agent',
            pType: 'DN', // Uppercase (dial number)
            dn: '5551234567',
          },
        },
      };

      const result = Utils.getDestAgentIdForCBT(interaction, '5551234567');
      expect(result).toBe('agent-uuid');
    });
  });

  describe('calculateDestAgentId', () => {
    const currentAgentId = 'agent-123';

    it('should return destAgentIdCBT when found', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, '5551234567'],
          },
        },
        participants: {
          'agent-uuid-456': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567',
            id: 'agent-uuid-456',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('agent-uuid-456');
    });

    it('should return participant id for regular agent when not CBT', () => {
      const consultedAgentId = 'agent-456';
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, consultedAgentId],
          },
        },
        participants: {
          [consultedAgentId]: {
            type: 'Agent',
            id: consultedAgentId,
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe(consultedAgentId);
    });

    it('should return epId for EpDn type participants', () => {
      const consultedAgentId = 'epdn-456';
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, consultedAgentId],
          },
        },
        participants: {
          [consultedAgentId]: {
            type: 'EpDn',
            id: consultedAgentId,
            epId: 'entry-point-id-789',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('entry-point-id-789');
    });

    it('should return undefined when no consulting agent found', () => {
      const interaction: any = {
        media: {
          mainCall: {
            mType: 'mainCall',
            participants: [currentAgentId],
          },
        },
        participants: {},
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('');
    });

    it('should handle CBT scenario when phone number is not a direct participant key', () => {
      const interaction: any = {
        media: {
          consult: {
            mType: 'consult',
            participants: [currentAgentId, '5551234567'], // Phone number in media
          },
        },
        participants: {
          // Note: '5551234567' is NOT a key - this is CBT
          'agent-uuid-cbt': {
            type: 'Agent',
            pType: 'dn',
            dn: '5551234567', // Found by matching DN
            id: 'agent-uuid-cbt',
          },
        },
      };

      const result = Utils.calculateDestAgentId(interaction, currentAgentId);
      expect(result).toBe('agent-uuid-cbt'); // Returns the CBT agent
    });
  });

  describe('isValidDialNumber', () => {
    const anyFormatEntry = {
      name: 'Any Format',
      prefix: '',
      regex: '([0-9a-zA-Z]+[-._])*[0-9a-zA-Z]+',
      strippedChars: '( )-',
    };

    const usOnlyEntry = {
      name: 'US',
      prefix: '1',
      regex: '1[0-9]{3}[2-9][0-9]{6}([,]{1,10}[0-9]+){0,1}',
      strippedChars: '( )-',
    };

    describe('with multiple dial plan entries (Any Format + US)', () => {
      const dialPlanEntries = [anyFormatEntry, usOnlyEntry];

      it('should return true for a valid US phone number', () => {
        const result = Utils.isValidDialNumber('12223334567', dialPlanEntries);
        expect(result).toBe(true);
      });

      it('should return true for a UK phone number', () => {
        const result = Utils.isValidDialNumber('+442030484377', dialPlanEntries);
        expect(result).toBe(true);
      });

      it('should return true for a European number', () => {
        const result = Utils.isValidDialNumber('6955577166', dialPlanEntries);
        expect(result).toBe(true);
      });
    });

    describe('with US-only dial plan entry', () => {
      const dialPlanEntries = [usOnlyEntry];

      it('should return true for a valid US phone number', () => {
        const result = Utils.isValidDialNumber('12223334567', dialPlanEntries);
        expect(result).toBe(true);
      });

      it('should return false for a UK phone number', () => {
        const result = Utils.isValidDialNumber('+442030484377', dialPlanEntries);
        expect(result).toBe(false);
      });

      it('should return false for an invalid US number format', () => {
        const result = Utils.isValidDialNumber('1234567890', dialPlanEntries);
        expect(result).toBe(false);
      });
    });

    describe('with empty dial plan entries (defers to server)', () => {
      it('should return true for any dial number', () => {
        expect(Utils.isValidDialNumber('12223334567', [])).toBe(true);
      });

      it('should return true for a UK phone number', () => {
        expect(Utils.isValidDialNumber('+442030484377', [])).toBe(true);
      });

      it('should return true for a European number', () => {
        expect(Utils.isValidDialNumber('6955577166', [])).toBe(true);
      });
    });

    describe('strippedChars handling', () => {
      it('should strip characters before regex matching', () => {
        const strictEntry = {
          name: 'Digits Only',
          prefix: '',
          regex: '^[0-9]{10,15}$',
          strippedChars: '( )-+',
        };
        const result = Utils.isValidDialNumber('+44 (203) 048-4377', [strictEntry]);
        expect(result).toBe(true);
      });

      it('should handle entries with no strippedChars', () => {
        const noStripEntry = {
          name: 'No Strip',
          prefix: '',
          regex: '^[0-9]+$',
          strippedChars: '',
        };
        expect(Utils.isValidDialNumber('12345', [noStripEntry])).toBe(true);
        expect(Utils.isValidDialNumber('+12345', [noStripEntry])).toBe(false);
      });
    });

    describe('empty or undefined dial number', () => {
      it('should return false and log warning for undefined dial number', () => {
        const result = Utils.isValidDialNumber(undefined as any, [anyFormatEntry]);
        expect(result).toBe(false);
        expect(LoggerProxy.warn).toHaveBeenCalledWith(
          'Dial number is empty or undefined.',
          expect.objectContaining({module: 'Utils', method: 'isValidDialNumber'})
        );
      });

      it('should return false and log warning for empty string dial number', () => {
        const result = Utils.isValidDialNumber('', [anyFormatEntry]);
        expect(result).toBe(false);
        expect(LoggerProxy.warn).toHaveBeenCalledWith(
          'Dial number is empty or undefined.',
          expect.objectContaining({module: 'Utils', method: 'isValidDialNumber'})
        );
      });
    });

    describe('invalid regex handling', () => {
      it('should return false and log warning for invalid regex pattern', () => {
        const badEntry = {
          name: 'Bad Regex',
          prefix: '',
          regex: '[invalid(',
          strippedChars: '',
        };
        const result = Utils.isValidDialNumber('12345', [badEntry]);
        expect(result).toBe(false);
        expect(LoggerProxy.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to validate dial number against entry "Bad Regex"'),
          expect.objectContaining({module: 'Utils', method: 'isValidDialNumber'})
        );
      });
    });
  });

  describe('stripDialPlanChars', () => {
    it('should remove specified characters from input', () => {
      expect(Utils.stripDialPlanChars('+44 (203) 048-4377', '( )-+')).toBe('442030484377');
    });

    it('should return input unchanged when strippedChars is empty', () => {
      expect(Utils.stripDialPlanChars('+442030484377', '')).toBe('+442030484377');
    });

    it('should return input unchanged when strippedChars is null/undefined', () => {
      expect(Utils.stripDialPlanChars('12345', null as any)).toBe('12345');
      expect(Utils.stripDialPlanChars('12345', undefined as any)).toBe('12345');
    });
  });

});
