/**
 * @jest-environment jsdom
 */

import MockWebex from '@webex/test-helper-mock-webex';
import ContactCenter from '../../../src/cc';
import { IAgentProfile } from 'packages/@webex/plugin-cc/src/features/types';

describe('webex.cc', () => {
  let webex;
  let asyncRequestHandlerMock;
  let webRTCCallingMock;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
    });

    // Ensure webex.internal.services is initialized correctly
    webex.internal = {
      ...webex.internal,
      services: {
        get: jest.fn().mockReturnValue('https://api.example.com/'),
      },
    };

    // Manually mock the necessary methods
    asyncRequestHandlerMock = {
      
    };

    webRTCCallingMock = {
    }

    webex.cc.asyncRequestHandler = asyncRequestHandlerMock;
    webex.cc.webRTCCallingMock = webRTCCallingMock

  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('#register', () => {
    it('should resolve with agent profile on successful registration', async () => {
      const agentProfile: IAgentProfile = {
        agentId: 'agentId',
        agentFirstName: 'John',
        agentLastName: 'Doe',
        agentProfileId: 'profileId',
        agentMailId: 'john.doe@example.com',
        loginVoiceOptions: [],
        teams: [],
        wrapUpCodes: [],
        idleCodes: [],
      };

      jest.spyOn(webex.cc, 'connectWebSocketAndFetchProfile').mockResolvedValue(agentProfile);

      const result = await webex.cc.register();

      expect(result).toBe(agentProfile);
      expect(webex.cc.connectWebSocketAndFetchProfile).toHaveBeenCalled();
    });

    it('should reject with an error message on registration failure', async () => {
      const error = new Error('Registration failed');
      jest.spyOn(webex.cc, 'connectWebSocketAndFetchProfile').mockRejectedValue(error);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register`');
      expect(webex.logger.error).toHaveBeenCalledWith(`Error during register: ${error}`);
    });
  });
});