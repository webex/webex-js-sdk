import 'jsdom-global/register';
import {LoginOption, WebexSDK} from '../../../src/types';
import HttpRequest from '../../../src/services/core/HttpRequest';
import WebCallingService from '../../../src/WebCallingService';
import ContactCenter from '../../../src/cc';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess} from '../../../src/services/agent/types';
import {IAgentProfile} from '../../../src/features/types';
import {AGENT, WEB_RTC_PREFIX} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import {web} from 'webpack';

jest.mock('../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    logger: {
      log: jest.fn(),
      error: jest.fn(),
    },
    initialize: jest.fn(),
  },
}));

jest.mock('../../../src/services/config');
jest.mock('../../../src/services/core/HttpRequest');
jest.mock('../../../src/WebCallingService');
jest.mock('../../../src/services');

// Mock AgentConfig
const mockAgentConfig = {
  getAgentProfile: jest.fn(),
};
jest.mock('../../../src/features/Agentconfig', () => {
  return jest.fn().mockImplementation(() => mockAgentConfig);
});

describe('webex.cc', () => {
  let webex;
  let mockHttpRequest;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
      },
      config: config,
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    mockHttpRequest = {
      subscribeNotifications: jest.fn(),
    };
    webex.cc.httpRequest = mockHttpRequest;

    // Mock Services instance
    const mockServicesInstance = {
      agent: {
        stationLogin: jest.fn(),
      },
    };
    (Services.getInstance as jest.Mock).mockReturnValue(mockServicesInstance);
    webex.cc.services = mockServicesInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cc.getDeviceId', () => {
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
      webex.cc.agentConfig = {
        agentId: 'agentId',
      };
      const result = webex.cc['getDeviceId'](loginOption, '');
      expect(result).toBe(WEB_RTC_PREFIX + 'agentId');
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
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');

      mockAgentConfig.getAgentProfile.mockResolvedValue(mockAgentProfile);
      mockHttpRequest.subscribeNotifications.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(mockHttpRequest.subscribeNotifications).toHaveBeenCalledWith({
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
      mockHttpRequest.subscribeNotifications.mockRejectedValue(mockError);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register');

      expect(webex.logger.error).toHaveBeenCalledWith(
        `file: cc: Error during register: ${mockError}`
      );
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

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(registerWebCallingLineSpy).toHaveBeenCalled();
      expect(stationLoginMock).toHaveBeenCalledWith({
        data: {
          dialNumber: 'agentId',
          teamId: 'teamId',
          deviceType: LoginOption.BROWSER,
          isExtension: false,
          deviceId: `${WEB_RTC_PREFIX}agentId`,
          roles: [AGENT],
          teamName: '',
          siteId: '',
          usesOtherDN: false,
          auxCodeId: '',
        },
      });
      expect(result).toEqual({});
    });

    it('should login successfully with other LoginOption', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '1234567890',
      };

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      expect(stationLoginMock).toHaveBeenCalledWith({
        data: {
          dialNumber: '1234567890',
          teamId: 'teamId',
          deviceType: LoginOption.AGENT_DN,
          isExtension: false,
          deviceId: '1234567890',
          roles: [AGENT],
          teamName: '',
          siteId: '',
          usesOtherDN: false,
          auxCodeId: '',
        },
      });
      expect(result).toEqual({});
    });

    it('should handle error during stationLogin', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1234567890',
      };

      const error = new Error('Error while performing station login');
      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(
        'Error while performing station login'
      );
    });
  });
});
