import 'jsdom-global/register';
import {LoginOption, WebexSDK} from '../../../src/types';
import HttpRequest from '../../../src/services/HttpRequest';
import Agent from '../../../src/features/Agent';
import WebRTCCalling from '../../../src/WebRTCCalling';
import ContactCenter from '../../../src/cc';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess} from '../../../src/services/types';
import {IAgentProfile} from '../../../src/features/types';
import AgentConfig from '../../../src/features/Agentconfig';
import {WEB_RTC_PREFIX} from '../../../src/services/constants';

jest.mock('../../../src/services/AgentConfigService');
jest.mock('../../../src/services/HttpRequest');
jest.mock('../../../src/WebRTCCalling');

// Mock AgentConfig
const mockAgentConfig = {
  getAgentProfile: jest.fn(),
};
jest.mock('../../../src/features/Agentconfig', () => {
  return jest.fn().mockImplementation(() => mockAgentConfig);
});

describe('webex.cc', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    const httpRequest = new HttpRequest({webex});
    webex.cc.httpRequest = httpRequest;
    webex.cc.agent = new Agent(webex, httpRequest);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AgentService.getDeviceId', () => {
    it('should return dialNumber when loginOption is EXTENSION', () => {
      const loginOption = LoginOption.EXTENSION;
      const dialNumber = '12345';
      const result = webex.cc['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(dialNumber);
    });

    it('should return dialNumber when loginOption is AGENT_DN', () => {
      const loginOption = LoginOption.AGENT_DN;
      const dialNumber = '12345';
      const result = webex.cc['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(dialNumber);
    });

    it('should return WEB_RTC_PREFIX + dialNumber for other loginOptions', () => {
      const loginOption = 'OTHER_OPTION';
      const dialNumber = '12345';
      const result = webex.cc['getDeviceId'](loginOption, dialNumber);
      expect(result).toBe(WEB_RTC_PREFIX + dialNumber);
    });
  });

  describe('stationLogin', () => {
    it('should login successfully with LoginOption.BROWSER', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
      };

      // Mock the method inside the instance that will be created
      const registerWebCallingLineMock = jest.fn().mockResolvedValue({});
      WebRTCCalling.prototype.registerWebCallingLine = registerWebCallingLineMock;

      const stationLoginMock = jest
        .spyOn(webex.cc.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(registerWebCallingLineMock).toHaveBeenCalled();
      expect(stationLoginMock).toHaveBeenCalledWith({
        ...options,
        dialNumber: 'agentId',
      });
      expect(result).toEqual({});
      expect(webex.logger.log).toHaveBeenCalledWith('file: cc: Station Login Success');
    });

    it('should login successfully with other LoginOption', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '1234567890',
      };

      const stationLoginMock = jest
        .spyOn(webex.cc.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(stationLoginMock).toHaveBeenCalledWith(options);
      expect(result).toEqual({});
      expect(webex.logger.log).toHaveBeenCalledWith('file: cc: Station Login Success');
    });

    it('should handle error during stationLogin', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1234567890',
      };

      const error = new Error('Login failed');
      jest.spyOn(webex.cc.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error);
    });

    it('should handle error during stationLogin with BROWSER login option', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
      };

      const error = new Error('Login failed');
      const registerWebCallingLineMock = jest.fn().mockRejectedValue(error);
      WebRTCCalling.prototype.registerWebCallingLine = registerWebCallingLineMock;
      jest.spyOn(webex.cc.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error);
    });
  });

  describe('register', () => {
    it('should register successfully and return agent profile', async () => {
      const mockAgentProfile: IAgentProfile = {
        agentId: 'agent123',
        agentMailId: '',
        agentName: 'John',
        teams: [],
        agentProfileId: '',
        loginVoiceOptions: [],
        idleCodes: [],
        wrapUpCodes: [],
      };

      mockAgentConfig.getAgentProfile.mockResolvedValue(mockAgentProfile);

      webex.cc.httpRequest.subscribeNotifications.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(webex.cc.httpRequest.subscribeNotifications).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });
      expect(mockAgentConfig.getAgentProfile).toHaveBeenCalled();
      expect(webex.logger.log).toHaveBeenCalledWith(
        'file: cc: agent config is fetched successfully'
      );
      expect(result).toEqual(mockAgentProfile);
    });

    it('should log error and reject if registration fails', async () => {
      const mockError = new Error('Registration failed');
      webex.cc.httpRequest.subscribeNotifications.mockRejectedValue(mockError);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register');

      expect(webex.logger.error).toHaveBeenCalledWith(
        `file: cc: Error during register: ${mockError}`
      );
    });
  });
});
