import 'jsdom-global/register';
import {
  BuddyAgents,
  BuddyAgentsResponse,
  LoginOption,
  StationLogoutResponse,
  WebexSDK,
} from '../../../src/types';
import ContactCenter from '../../../src/cc';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess} from '../../../src/services/agent/types';
import {SetStateResponse} from '../../../src/types';
import {AGENT, WEB_RTC_PREFIX} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import LoggerProxy from '../../../src/logger-proxy';
import {CC_FILE} from '../../../src/constants';

// Mock the Worker API
import '../../../__mocks__/workerMock';
import {Profile} from '../../../src/services/config/types';

jest.mock('../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../../src/services/config');
jest.mock('../../../src/services/core/WebSocket/WebSocketManager');
jest.mock('../../../src/services/core/WebSocket/connection-service');
jest.mock('../../../src/services/WebCallingService');
jest.mock('../../../src/services');

global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');

describe('webex.cc', () => {
  let webex;
  let mockWebSocketManager;
  let mockAgentConfig;

  beforeEach(() => {
    webex = MockWebex({
      children: {
        cc: ContactCenter,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      credentials: {
        getOrgId: jest.fn(() => 'mockOrgId'),
      },
      config: config,
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    // Instantiate ContactCenter to ensure it's fully initialized
    webex.cc = new ContactCenter({parent: webex});

    mockWebSocketManager = {
      initWebSocket: jest.fn(),
    };

    // Mock Services instance
    const mockServicesInstance = {
      agent: {
        stationLogin: jest.fn(),
        logout: jest.fn(),
        reload: jest.fn(),
        stateChange: jest.fn(),
        buddyAgents: jest.fn(),
      },
      config: {
        getAgentConfig: jest.fn(),
      },
      webSocketManager: mockWebSocketManager,
      connectionService: {
        on: jest.fn(),
      },
    };
    (Services.getInstance as jest.Mock).mockReturnValue(mockServicesInstance);
    webex.cc.services = mockServicesInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize services and logger proxy on READY event', () => {
    webex.once('READY', () => {
      expect(Services.getInstance).toHaveBeenCalled();
      expect(LoggerProxy.initialize).toHaveBeenCalledWith(webex.logger);
    });

    webex.emit('READY');
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

    it('should return prefix + agentId for other loginOptions', () => {
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
      const mockAgentProfile: Profile = {
        agentId: 'agent123',
        agentMailId: '',
        agentName: 'John',
        teams: [],
        agentProfileID: '',
        loginVoiceOptions: [],
        idleCodes: [],
        wrapupCodes: [],
        defaultDn: '',
        forceDefaultDn: false,
        forceDefaultDnForAgent: false,
        regexUS: '',
        regexOther: '',
        dialPlan: {
          type: '',
          dialPlanEntity: [],
        },
        skillProfileId: '',
        siteId: '',
        enterpriseId: '',
        privacyShieldVisible: true,
        defaultWrapupCode: '',
        wrapUpData: {
          wrapUpProps: {
            autoWrapup: undefined,
            autoWrapupInterval: undefined,
            lastAgentRoute: undefined,
            wrapUpReasonList: [],
            wrapUpCodesList: undefined,
            idleCodesAccess: undefined,
            interactionId: undefined,
            allowCancelAutoWrapup: undefined,
          },
        },
        isOutboundEnabledForTenant: false,
        isOutboundEnabledForAgent: false,
        isAdhocDialingEnabled: false,
        isAgentAvailableAfterOutdial: false,
        isCampaignManagementEnabled: false,
        outDialEp: '',
        isEndCallEnabled: false,
        isEndConsultEnabled: false,
        agentDbId: '',
        allowConsultToQueue: false,
        agentPersonalStatsEnabled: false,
        isTimeoutDesktopInactivityEnabled: false,
        webRtcEnabled: false,
        lostConnectionRecoveryTimeout: 0,
      };
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
        },
      });
      const configSpy = jest
        .spyOn(webex.cc.services.config, 'getAgentConfig')
        .mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });
      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith('agent config is fetched successfully', {
        module: CC_FILE,
        method: 'mockConstructor',
      });
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });

    it('should not register when config is undefined', async () => {
      webex.cc.$config = undefined;
      const mockAgentProfile: Profile = {
        agentId: 'agent123',
        agentMailId: '',
        agentName: 'John',
        teams: [],
        loginVoiceOptions: [],
        idleCodes: [],
        wrapupCodes: [],
        defaultDn: '',
        forceDefaultDn: false,
        forceDefaultDnForAgent: false,
        regexUS: '',
        regexOther: '',
        agentProfileID: '',
        dialPlan: {
          type: '',
          dialPlanEntity: [],
        },
        skillProfileId: '',
        siteId: '',
        enterpriseId: '',
        privacyShieldVisible: false,
        defaultWrapupCode: '',
        wrapUpData: {
          wrapUpProps: {
            autoWrapup: undefined,
            autoWrapupInterval: undefined,
            lastAgentRoute: undefined,
            wrapUpReasonList: [],
            wrapUpCodesList: undefined,
            idleCodesAccess: undefined,
            interactionId: undefined,
            allowCancelAutoWrapup: undefined,
          },
        },
        isOutboundEnabledForTenant: false,
        isOutboundEnabledForAgent: false,
        isAdhocDialingEnabled: false,
        isAgentAvailableAfterOutdial: false,
        isCampaignManagementEnabled: false,
        outDialEp: '',
        isEndCallEnabled: false,
        isEndConsultEnabled: false,
        agentDbId: '',
        allowConsultToQueue: false,
        agentPersonalStatsEnabled: false,
        isTimeoutDesktopInactivityEnabled: false,
        webRtcEnabled: false,
        lostConnectionRecoveryTimeout: 0,
      };
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
        },
      });

      const configSpy = jest
        .spyOn(webex.cc.services.config, 'getAgentConfig')
        .mockResolvedValue(mockAgentProfile);

      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: true,
        },
      });
      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'agent config is fetched successfully',
        {module: CC_FILE, method: 'mockConstructor'}
      );
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });

    it('should log error and reject if registration fails', async () => {
      const mockError = new Error('Error while performing register');
      mockWebSocketManager.initWebSocket.mockRejectedValue(mockError);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register');

      expect(LoggerProxy.error).toHaveBeenCalledWith(`Error during register: ${mockError}`, {
        module: CC_FILE,
        method: 'register',
      });
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

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing station login',
          },
        },
      };
      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error.details.data.reason);

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationLogin failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'stationLogin'}
      );
    });
  });

  describe('stationLogout', () => {
    it('should logout successfully', async () => {
      const data = {logoutReason: 'Logout reason'};
      const response = {};

      const stationLogoutMock = jest
        .spyOn(webex.cc.services.agent, 'logout')
        .mockResolvedValue({} as StationLogoutResponse);

      const result = await webex.cc.stationLogout(data);

      expect(stationLogoutMock).toHaveBeenCalledWith({data: data});
      expect(result).toEqual(response);
    });

    it('should handle error during stationLogout', async () => {
      const data = {logoutReason: 'Logout reason'};
      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing station logout',
          },
        },
      };

      jest.spyOn(webex.cc.services.agent, 'logout').mockRejectedValue(error);

      await expect(webex.cc.stationLogout(data)).rejects.toThrow(error.details.data.reason);

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationLogout failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'stationLogout'}
      );
    });
  });

  describe('stationRelogin', () => {
    it('should relogin successfully', async () => {
      const response = {};

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'reload')
        .mockResolvedValue({} as StationLoginSuccess);

      const result = await webex.cc.stationReLogin();

      expect(stationLoginMock).toHaveBeenCalled();
      expect(result).toEqual(response);
    });

    it('should handle error during relogin', async () => {
      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing station relogin',
          },
        },
      };

      jest.spyOn(webex.cc.services.agent, 'reload').mockRejectedValue(error);

      await expect(webex.cc.stationReLogin()).rejects.toThrow(error.details.data.reason);

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationReLogin failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'stationReLogin'}
      );
    });
  });

  describe('setAgentStatus', () => {
    it('should set agent status successfully when status is Available', async () => {
      const expectedPayload = {
        state: 'Available',
        auxCodeId: '0',
        agentId: '123',
        lastStateChangeReason: 'Agent is available',
      };

      const setAgentStatusMock = jest
        .spyOn(webex.cc.services.agent, 'stateChange')
        .mockResolvedValue(expectedPayload);

      const result = await webex.cc.setAgentState(expectedPayload);

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual(expectedPayload);
      expect(LoggerProxy.log).toHaveBeenCalledWith('SET AGENT STATUS API SUCCESS', {
        module: CC_FILE,
        method: 'setAgentState',
      });
    });

    it('should set agent status successfully when status is Meeting', async () => {
      const expectedPayload = {
        state: 'Meeting',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is in meeting',
      };

      const setAgentStatusMock = jest
        .spyOn(webex.cc.services.agent, 'stateChange')
        .mockResolvedValue(expectedPayload);

      const result = await webex.cc.setAgentState(expectedPayload);

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual(expectedPayload);
      expect(LoggerProxy.log).toHaveBeenCalledWith('SET AGENT STATUS API SUCCESS', {
        module: CC_FILE,
        method: 'setAgentState',
      });
    });

    it('should handle error during setAgentStatus when status is Meeting', async () => {
      const expectedPayload = {
        state: 'Meeting',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Agent is in meeting',
      };

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'missing status',
          },
        },
      };
      jest.spyOn(webex.cc.services.agent, 'stateChange').mockRejectedValue(error);

      await expect(webex.cc.setAgentState(expectedPayload)).rejects.toThrow(
        error.details.data.reason
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `setAgentState failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'setAgentState'}
      );
    });

    it('should handle invalid status', async () => {
      const invalidPayload = {
        state: 'invalid',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'invalid',
      };
      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Invalid status',
          },
        },
      };
      jest.spyOn(webex.cc.services.agent, 'stateChange').mockRejectedValue(error);

      await expect(webex.cc.setAgentState(invalidPayload)).rejects.toThrow(
        error.details.data.reason
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `setAgentState failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'setAgentState'}
      );
    });
  });

  describe('getBuddyAgents', () => {
    it('should return buddy agents response when successful', async () => {
      const data: BuddyAgents = {state: 'Available', mediaType: 'telephony'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
      };

      const buddyAgentsResponse: BuddyAgentsResponse = {
        type: 'BuddyAgentsSuccess',
        orgId: '',
        trackingId: '1234',
        data: {
          eventType: 'BuddyAgents',
          agentId: 'agentId',
          trackingId: '1234',
          orgId: '',
          type: '',
          agentSessionId: 'session123',
          agentList: [
            {
              agentId: 'agentId',
              state: 'Available',
              teamId: 'teamId',
              dn: '1234567890',
              agentName: 'John',
              siteId: 'siteId',
            },
          ],
        },
      };

      const buddyAgentsSpy = jest
        .spyOn(webex.cc.services.agent, 'buddyAgents')
        .mockResolvedValue(buddyAgentsResponse);

      const result = await webex.cc.getBuddyAgents(data);

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {agentProfileId: 'test-agent-profile-id', ...data},
      });

      expect(result).toEqual(buddyAgentsResponse);
    });

    it('should handle error', async () => {
      const data: BuddyAgents = {state: 'Available', mediaType: 'telephony'};
      webex.cc.agentConfig = {
        agentId: 'f520d6b5-28ad-4f2f-b83e-781bb64af617',
        agentProfileID: 'test-agent-profile-id',
      };

      const error = {
        details: {
          data: {
            agentId: 'f520d6b5-28ad-4f2f-b83e-781bb64af617',
            eventTime: 1731402794534,
            eventType: 'AgentDesktopMessage',
            orgId: 'e7924666-777d-40d4-a504-01aa1e62dd2f',
            reason: 'AGENT_NOT_FOUND',
            reasonCode: 1038,
            trackingId: '5d2ddfaf-9b8a-491f-9c3f-3bb8ba60d595',
            type: 'BuddyAgentsRetrieveFailed',
          },
          orgId: 'e7924666-777d-40d4-a504-01aa1e62dd2f',
          trackingId: 'notifs_a7727d9e-7651-4c60-90a7-ff3de47b784d',
          type: 'BuddyAgents',
        },
      };

      jest.spyOn(webex.cc.services.agent, 'buddyAgents').mockRejectedValue(error);

      await expect(webex.cc.getBuddyAgents(data)).rejects.toThrow(error.details.data.reason);
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `getBuddyAgents failed with trackingId: ${error.details.trackingId}`,
        {module: CC_FILE, method: 'getBuddyAgents'}
      );
    });
  });

  describe('silentRelogin', () => {
    it('should perform silent relogin and set agent state to available', async () => {
      const mockReLoginResponse = {
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          lastStateChangeReason: 'agent-wss-disconnect',
        },
      };

      // Mock the agentConfig
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      const setAgentStateSpy = jest
        .spyOn(webex.cc, 'setAgentState')
        .mockResolvedValue({} as SetStateResponse);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue(mockReLoginResponse);

      await webex.cc['silentRelogin']();

      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
        {module: CC_FILE, method: 'silentRelogin'}
      );
      expect(setAgentStateSpy).toHaveBeenCalledWith({
        state: 'Available',
        auxCodeId: 'auxCodeId',
        lastStateChangeReason: 'agent-wss-disconnect',
        agentId: 'agentId',
      });
      expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(true);
    });

    it('should handle AGENT_NOT_FOUND error silently', async () => {
      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'AGENT_NOT_FOUND',
          },
        },
      };

      jest.spyOn(webex.cc.services.agent, 'reload').mockRejectedValue(error);
      await webex.cc['silentRelogin']();
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Agent not found during re-login, handling silently',
        {module: CC_FILE, method: 'silentRelogin'}
      );
    });
  });
});
