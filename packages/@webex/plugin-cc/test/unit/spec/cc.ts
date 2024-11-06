import 'jsdom-global/register';
import {LoginOption, WebexSDK} from '../../../src/types';
import HttpRequest from '../../../src/services/HttpRequest';
import Agent from '../../../src/features/Agent';
import WebCallingService from '../../../src/WebCallingService';
import ContactCenter from '../../../src/cc';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess} from '../../../src/services/types';
import {IAgentProfile} from '../../../src/features/types';
import config from '../../../src/config';

jest.mock('../../../src/services/AgentConfigService');
jest.mock('../../../src/services/HttpRequest');
jest.mock('../../../src/WebCallingService');

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
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    mockHttpRequest = {
      subscribeNotifications: jest.fn(),
    };
    webex.cc.httpRequest = mockHttpRequest;
    webex.cc.agent = new Agent(webex, mockHttpRequest);
    webex.cc.$config = config;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('stationLogin', () => {
    let spyStationLogin;
    let spyRegisterWebCallingLine;
    let mockAgentLoginResponse;

    beforeEach(() => {
      spyStationLogin = jest
        .spyOn(webex.cc.agent, 'stationLogin')
        .mockImplementation(async () => mockAgentLoginResponse);
      spyRegisterWebCallingLine = jest
        .spyOn(WebCallingService.prototype, 'registerWebCallingLine')
        .mockImplementation(async () => {});
    });

    it('should login successfully without browser login option', async () => {
      const data = {
        dialNumber: '12345',
        loginOption: LoginOption.EXTENSION,
      };
      const response = {
        eventType: 'AgentDesktopMessage',
        agentId: 'agent123',
        trackingId: 'tracking123',
        auxCodeId: 'aux123',
        teamId: 'team123',
        agentSessionId: 'session123',
        orgId: 'org123',
        interactionIds: ['interaction1', 'interaction2'],
        status: 'active',
        subStatus: 'Available',
        siteId: 'site123',
        lastIdleCodeChangeTimestamp: Date.now(),
        lastStateChangeTimestamp: Date.now(),
        profileType: 'profile123',
        channelsMap: {voice: ['channel1', 'channel2']},
        dialNumber: '1234567890',
        roles: ['role1', 'role2'],
        supervisorSessionId: 'supervisor123',
        type: 'AgentStationLoginSuccess',
      };
      mockAgentLoginResponse = Promise.resolve(response);

      const result = await webex.cc.stationLogin(data);

      expect(spyStationLogin).toHaveBeenCalledWith({
        ...data,
        dialNumber: data.dialNumber,
      });
      expect(spyRegisterWebCallingLine).not.toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('should login successfully with browser login option', async () => {
      const data = {
        dialNumber: '12345',
        loginOption: LoginOption.BROWSER,
      };
      const response = {
        eventType: 'AgentDesktopMessage',
        agentId: 'agent123',
        trackingId: 'tracking123',
        auxCodeId: 'aux123',
        teamId: 'team123',
        agentSessionId: 'session123',
        orgId: 'org123',
        interactionIds: ['interaction1', 'interaction2'],
        status: 'active',
        subStatus: 'Available',
        siteId: 'site123',
        lastIdleCodeChangeTimestamp: Date.now(),
        lastStateChangeTimestamp: Date.now(),
        profileType: 'profile123',
        channelsMap: {voice: ['channel1', 'channel2']},
        dialNumber: '1234567890',
        roles: ['role1', 'role2'],
        supervisorSessionId: 'supervisor123',
        type: 'AgentStationLoginSuccess',
      };
      mockAgentLoginResponse = Promise.resolve(response);

      const result = await webex.cc.stationLogin(data);

      expect(spyStationLogin).toHaveBeenCalledWith({
        ...data,
        dialNumber: data.dialNumber,
      });
      expect(spyRegisterWebCallingLine).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('should use agentConfig.agentId if dialNumber is not provided', async () => {
      const data = {
        loginOption: LoginOption.BROWSER,
      };
      const agentId = 'agent123';
      webex.cc.agentConfig = {agentId: agentId};
      const response = {
        eventType: 'AgentDesktopMessage',
        agentId: 'agent123',
        trackingId: 'tracking123',
        auxCodeId: 'aux123',
        teamId: 'team123',
        agentSessionId: 'session123',
        orgId: 'org123',
        interactionIds: ['interaction1', 'interaction2'],
        status: 'active',
        subStatus: 'Available',
        siteId: 'site123',
        lastIdleCodeChangeTimestamp: Date.now(),
        lastStateChangeTimestamp: Date.now(),
        profileType: 'profile123',
        channelsMap: {voice: ['channel1', 'channel2']},
        dialNumber: '1234567890',
        roles: ['role1', 'role2'],
        supervisorSessionId: 'supervisor123',
        type: 'AgentStationLoginSuccess',
      };
      mockAgentLoginResponse = Promise.resolve(response);

      const result = await webex.cc.stationLogin(data);

      expect(spyStationLogin).toHaveBeenCalledWith({
        ...data,
        dialNumber: agentId,
      });
      expect(spyRegisterWebCallingLine).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('should handle login failure', async () => {
      const data = {
        dialNumber: '12345',
        loginOption: LoginOption.EXTENSION,
      };
      const mockError = new Error('Login failed');
      spyStationLogin.mockImplementationOnce(async () => {
        throw mockError;
      });

      await expect(webex.cc.stationLogin(data)).rejects.toThrow('Login failed');

      expect(spyStationLogin).toHaveBeenCalledWith({
        ...data,
        dialNumber: data.dialNumber,
      });
      expect(spyRegisterWebCallingLine).not.toHaveBeenCalled();
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

      mockHttpRequest.subscribeNotifications.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

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
});
