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
import {StationLoginSuccess, AGENT_EVENTS} from '../../../src/services/agent/types';
import {SetStateResponse} from '../../../src/types';
import {AGENT, WEB_RTC_PREFIX} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import {CC_EVENTS} from '../../../src/services/config/types';
import LoggerProxy from '../../../src/logger-proxy';
import * as Utils from '../../../src/services/core/Utils';
import {
  CC_FILE,
  OUTDIAL_DIRECTION,
  OUTBOUND_TYPE,
  ATTRIBUTES,
  OUTDIAL_MEDIA_TYPE,
} from '../../../src/constants';

// Mock the Worker API
import '../../../__mocks__/workerMock';
import {Profile} from '../../../src/services/config/types';
import TaskManager from '../../../src/services/task/TaskManager';
import {AgentContact, TASK_EVENTS} from '../../../src/services/task/types';
import MetricsManager from '../../../src/metrics/MetricsManager';
import { METRIC_EVENT_NAMES } from '../../../src/metrics/constants';
import Mercury from '@webex/internal-plugin-mercury';
import WebexRequest from '../../../src/services/core/WebexRequest';

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
jest.mock('../../../src/services/core/websocket/WebSocketManager');
jest.mock('../../../src/services/core/websocket/connection-service');
jest.mock('../../../src/services/WebCallingService');
jest.mock('uuid', () => ({v4: () => 'mock-tracking-uuid'}));

global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');

describe('webex.cc', () => {
  let webex;
  let mockContact;
  let mockTaskManager;
  let mockMetricsManager;
  let mockWebSocketManager;
  let getErrorDetailsSpy;
  let mockWebexRequest;

  beforeEach(() => {
    webex = MockWebex({
      children: {
        cc: ContactCenter,
        mercury: Mercury,
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

    mockWebSocketManager = {
      initWebSocket: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    mockContact = {
      accept: jest.fn(),
      hold: jest.fn(),
      unHold: jest.fn(),
      pauseRecording: jest.fn(),
      resumeRecording: jest.fn(),
      consult: jest.fn(),
      consultAccept: jest.fn(),
      blindTransfer: jest.fn(),
      vteamTransfer: jest.fn(),
      consultTransfer: jest.fn(),
      end: jest.fn(),
      wrapup: jest.fn(),
      cancelTask: jest.fn(),
      cancelCtq: jest.fn(),
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
        off: jest.fn(),
      },
      contact: mockContact,

      dialer: {
        startOutdial: jest.fn(),
      },
    };

    mockTaskManager = {
      contact: mockContact,
      call: undefined,
      taskCollection: {},
      webCallingService: undefined,
      webSocketManager: mockWebSocketManager,
      task: undefined,
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
    };

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    };

    mockWebexRequest = {
      request: jest.fn(),
      uploadLogs: jest.fn(),
    };

    jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);
    jest.spyOn(Services, 'getInstance').mockReturnValue(mockServicesInstance);
    jest.spyOn(TaskManager, 'getTaskManager').mockReturnValue(mockTaskManager);
    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue(mockWebexRequest);
    // Instantiate ContactCenter to ensure it's fully initialized
    webex.cc = new ContactCenter({parent: webex});
    getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize services and logger proxy on ready event', () => {
    webex.once('ready', () => {
      expect(Services.getInstance).toHaveBeenCalled();
      expect(LoggerProxy.initialize).toHaveBeenCalledWith(webex.logger);
    });

    webex.emit('ready');
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
    const mockAgentProfile: Profile = {
      agentId: 'agent123',
      agentMailId: '',
      agentName: 'John',
      teams: [],
      agentProfileID: '',
      loginVoiceOptions: ['BROWSER', 'EXTENSION'],
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
      webRtcEnabled: true,
      lostConnectionRecoveryTimeout: 0,
    };

    it('should register successfully and return agent profile', async () => {
      const mercuryConnect = jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      const configSpy = jest
        .spyOn(webex.cc.services.config, 'getAgentConfig')
        .mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting CC SDK registration', {
        module: CC_FILE,
        method: 'register',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`CC SDK registration completed successfully with agentId: ${result.agentId}`, {
        module: CC_FILE,
        method: 'register',
      });
      
      expect(mercuryConnect).toHaveBeenCalled();
      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
      });

      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockWebSocketManager.on).toHaveBeenCalledWith('message', expect.any(Function));

      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent config is fetched successfully', {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED
      ]);
    });

    it('should not register when config is undefined', async () => {
      webex.cc.$config = undefined;
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
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
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent config is fetched successfully', {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED
      ]);
    });

    it('should log error and reject if registration fails', async () => {
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const mockError = new Error('Error while performing register');
      mockWebSocketManager.initWebSocket.mockRejectedValue(mockError);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register');

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting CC SDK registration', {
        module: CC_FILE,
        method: 'register',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(`Error during register: ${mockError}`, {
        module: CC_FILE,
        method: 'register',
      });
      
      // Verify metrics tracking
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
        {
          orgId: undefined,
        },
        ['operational']
      );
    });

    it('should log error if mercury connect fails but cc.register() should not fail', async () => {
      const mockError = new Error('Error while performing mercury connect');
      jest.spyOn(webex.internal.mercury, 'connect').mockRejectedValue(mockError);

      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      const configSpy = jest
        .spyOn(webex.cc.services.config, 'getAgentConfig')
        .mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(LoggerProxy.error).toHaveBeenCalledWith(`Error occurred during mercury.connect() ${mockError}`, {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
      });


      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockWebSocketManager.on).toHaveBeenCalledWith('message', expect.any(Function));

      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent config is fetched successfully', {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });

    it('should not attempt for mercury connection when webrtc is disabled', async () => {
      mockAgentProfile.webRtcEnabled = false;
      const mercurySpy = jest.spyOn(webex.internal.mercury, 'connect');
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
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
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
      });

      expect(configSpy).toHaveBeenCalled();
      expect(mercurySpy).not.toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });
  });

  describe('stationLogin', () => {
    it('should login successfully with LoginOption.BROWSER and webrtc enabled', async () => {
      const mockTask = {};
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: true,
        loginVoiceOptions: ['BROWSER', 'EXTENSION', 'AGENT_DN']
      };

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      const mockData = {
        data: {
          loginOption: LoginOption.BROWSER,
          agentId: 'agentId',
          teamId: 'teamId',
          siteId: 'siteId',
          roles: [AGENT],
          trackingId: '1234',
          eventType: 'DESKTOP_MESSAGE',
          channelsMap: {
            chat: ["25d8ggg7-4821-7de7-b626-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509"],
            email: ["14e7fff7-7de7-4821-a919-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509"],
            social: [],
            telephony:["14e7fff7-7de7-4821-a919-36437adec509"],
          }
        },
        trackingId: 'notifs_52628',
        orgId: 'orgId',
        type: 'StationLoginSuccess',
        eventType: 'STATION_LOGIN',
      };

      const responseMock = {
        loginOption: LoginOption.BROWSER,
        agentId: 'agentId',
        teamId: 'teamId',
        siteId: 'siteId',
        roles: [AGENT],
        trackingId: '1234',
        eventType: 'DESKTOP_MESSAGE',
        mmProfile: {
          chat: 2,
          email: 3,
          social: 0,
          telephony: 1
        },
        notifsTrackingId: 'notifs_52628'
      }

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue(mockData as unknown as StationLoginSuccess);

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

      expect(mockMetricsManager.timeEvent).toBeCalledWith([METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, METRIC_EVENT_NAMES.STATION_LOGIN_FAILED]);
      expect(result).toEqual(responseMock);

      const onSpy = jest.spyOn(mockTaskManager, 'on');
      const emitSpy = jest.spyOn(webex.cc, 'trigger');
      const ccEmitSpy = jest.spyOn(webex.cc, 'emit');
      const incomingCallCb = onSpy.mock.calls[0][1];

      expect(onSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, incomingCallCb);

      incomingCallCb(mockTask);

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, mockTask);
      // Verify message event listener
      const messageCallback = mockWebSocketManager.on.mock.calls.find(
        (call) => call[0] === 'message'
      )[1];
      const agentStateChangeEventData = {
        type: CC_EVENTS.AGENT_STATE_CHANGE,
        data: {some: 'data'},
      };

      const agentMultiLoginEventData = {
        type: CC_EVENTS.AGENT_MULTI_LOGIN,
        data: {some: 'data'},
      };

      // Simulate receiving a message event
      messageCallback(JSON.stringify(agentStateChangeEventData));

      expect(ccEmitSpy).toHaveBeenCalledWith(AGENT_EVENTS.AGENT_STATE_CHANGE, agentStateChangeEventData.data);

      // Simulate receiving a message event
      messageCallback(JSON.stringify(agentMultiLoginEventData));

      expect(ccEmitSpy).toHaveBeenCalledWith(AGENT_EVENTS.AGENT_MULTI_LOGIN, agentMultiLoginEventData.data);
    });

    it('should not attempt mobius registration for LoginOption.BROWSER if webrtc is disabled', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false
      };

      const mockData = {
        data: {
          loginOption: LoginOption.BROWSER,
          agentId: 'agentId',
          teamId: 'teamId',
          siteId: 'siteId',
          roles: [AGENT],
          trackingId: '1234',
          eventType: 'DESKTOP_MESSAGE',
          channelsMap: {
            chat: ["25d8ggg7-4821-7de7-b626-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509"],
            email: [],
            social: [],
            telephony:["14e7fff7-7de7-4821-a919-36437adec509"],
          }
        },
        trackingId: '1234',
        orgId: 'orgId',
        type: 'StationLoginSuccess',
        eventType: 'STATION_LOGIN',
      }

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      const stationLoginSpy = jest
        .spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue(mockData as unknown as StationLoginSuccess);

      await webex.cc.stationLogin(options);

      expect(registerWebCallingLineSpy).not.toHaveBeenCalled();
      expect(stationLoginSpy).toHaveBeenCalledWith({
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
    });

    it('should login successfully with other LoginOption', async () => {
      webex.cc.agentConfig = {
        webRtcEnabled: true
      };

      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '1234567890',
      };

      const mockData = {
        data: {
          loginOption: LoginOption.AGENT_DN,
          agentId: 'agentId',
          teamId: 'teamId',
          siteId: 'siteId',
          roles: [AGENT],
          trackingId: '1234',
          eventType: 'DESKTOP_MESSAGE',
          channelsMap: {
            chat: ["25d8ggg7-4821-7de7-b626-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509"],
            email: ["14e7fff7-7de7-4821-a919-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509", "14e7fff7-7de7-4821-a919-36437adec509"],
            social: [],
            telephony:["14e7fff7-7de7-4821-a919-36437adec509"],
          }
        },
        trackingId: 'notifs_52628',
        orgId: 'orgId',
        type: 'StationLoginSuccess',
        eventType: 'STATION_LOGIN',
      };

      const responseMock = {
        loginOption: LoginOption.AGENT_DN,
        agentId: 'agentId',
        teamId: 'teamId',
        siteId: 'siteId',
        roles: [AGENT],
        trackingId: '1234',
        eventType: 'DESKTOP_MESSAGE',
        mmProfile: {
          chat: 2,
          email: 3,
          social: 0,
          telephony: 1
        },
        notifsTrackingId: 'notifs_52628'
      }

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue(mockData as unknown as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station login', {
        module: CC_FILE,
        method: 'stationLogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Agent station login completed successfully agentId: ${mockData.data.agentId} loginOption: ${mockData.data.loginOption} teamId: ${mockData.data.teamId}`, {
        module: CC_FILE,
        method: 'stationLogin',
        trackingId: mockData.trackingId,
      });
      
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
      expect(result).toEqual(responseMock);
    });

    it('should handle error during stationLogin', async () => {
      webex.cc.agentConfig = {
        webRtcEnabled: true
      };

      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1234567890',
      };

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing stationLogin',
          },
        },
      };
      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockRejectedValue(error);

      await expect(webex.cc.stationLogin(options)).rejects.toThrow(error.details.data.reason);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station login', {
        module: CC_FILE,
        method: 'stationLogin',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationLogin failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'stationLogin', trackingId: error.details.trackingId},
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

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station logout', {
        module: CC_FILE,
        method: 'stationLogout',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent station logout completed successfully', {
        module: CC_FILE,
        method: 'stationLogout',
      });

      expect(stationLogoutMock).toHaveBeenCalledWith({data: data});
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      // expect(mockTaskManager.unregisterIncomingCallEvent).toHaveBeenCalledWith();
      // expect(mockTaskManager.off).toHaveBeenCalledWith(
      //   TASK_EVENTS.TASK_INCOMING,
      //   expect.any(Function)
      // );
      // expect(mockTaskManager.off).toHaveBeenCalledWith(
      //   TASK_EVENTS.TASK_HYDRATE,
      //   expect.any(Function)
      // );
      // expect(mockWebSocketManager.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(result).toEqual(response);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
        METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED
      ]);
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

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station logout', {
        module: CC_FILE,
        method: 'stationLogout',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationLogout failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'stationLogout', trackingId: error.details.trackingId},
      );
    });
  });

  describe('stationRelogin', () => {
    it('should relogin successfully', async () => {
      const response = {
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
        }
      };

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'reload')
        .mockResolvedValue(response as StationLoginSuccess);

      const result = await webex.cc.stationReLogin();

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station relogin', {
        module: CC_FILE,
        method: 'stationReLogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Agent station relogin completed successfully agentID: ${response.data.agentId} teamId: ${response.data.teamId}`, {
        module: CC_FILE,
        method: 'stationReLogin',
      });

      expect(stationLoginMock).toHaveBeenCalled();
      expect(result).toEqual(response);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS,
        METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED
      ]);
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

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting agent station relogin', {
        module: CC_FILE,
        method: 'stationReLogin',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationReLogin failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'stationReLogin', trackingId: error.details.trackingId}
      );
    });

    it('should trigger TASK_HYDRATE event with the task', () => {
      const task = {id: 'task1'};
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');

      webex.cc['handleTaskHydrate'](task);

      expect(triggerSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, task);
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
        .mockResolvedValue({data:expectedPayload});

      const result = await webex.cc.setAgentState(expectedPayload);

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Setting agent state', {
        module: CC_FILE,
        method: 'setAgentState',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Agent state changed successfully to auxCodeId: ${expectedPayload.auxCodeId}`, {
        module: CC_FILE,
        method: 'setAgentState',
      });

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual({data:expectedPayload});
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED
      ]);
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
        .mockResolvedValue({data: expectedPayload});

      const result = await webex.cc.setAgentState(expectedPayload);

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual({data:expectedPayload});
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Agent state changed successfully to auxCodeId: ${expectedPayload.auxCodeId}`, {
        module: CC_FILE,
        method: 'setAgentState',
      });
      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual({data:expectedPayload});
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED
      ]);
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
      
      expect(LoggerProxy.info).toHaveBeenCalledWith('Setting agent state', {
        module: CC_FILE,
        method: 'setAgentState',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `setAgentState failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'setAgentState', trackingId: error.details.trackingId}
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
        `setAgentState failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'setAgentState', trackingId: error.details.trackingId}
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

      const buddyAgentsResponse = {
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

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching buddy agents', {
        module: CC_FILE,
        method: 'getBuddyAgents',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Successfully retrieved ${buddyAgentsResponse.data.agentList.length} buddy agents`, {
        module: CC_FILE,
        method: 'getBuddyAgents',
        trackingId: buddyAgentsResponse.trackingId,
      });

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {agentProfileId: 'test-agent-profile-id', ...data},
      });

      expect(result).toEqual(buddyAgentsResponse);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED
      ]);
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
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching buddy agents', {
        module: CC_FILE,
        method: 'getBuddyAgents',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `getBuddyAgents failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'getBuddyAgents', trackingId: error.details.trackingId}
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
          lastStateChangeTimestamp: 1738575135188,
          lastIdleCodeChangeTimestamp: 1738575135189,
          deviceType: LoginOption.BROWSER,
          dn: '12345',
        },
      };

      // Mock the agentConfig
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      const date = new Date();
      const setAgentStateSpy = jest.spyOn(webex.cc, 'setAgentState').mockResolvedValue({
        data: {lastStateChangeTimestamp: 1234, lastIdleCodeChangeTimestamp: 12345},
      } as unknown as SetStateResponse);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue(mockReLoginResponse);

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      const setLoginOptionSpy = jest.spyOn(
        webex.cc.webCallingService,
        'setLoginOption'
      );
      const incomingTaskListenerSpy = jest.spyOn(webex.cc, 'incomingTaskListener');
      const webSocketManagerOnSpy = jest.spyOn(webex.cc.services.webSocketManager, 'on');
      await webex.cc['silentRelogin']();

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
        {module: CC_FILE, method: 'silentRelogin'}
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Silent relogin process completed successfully with login Option: ${mockReLoginResponse.data.deviceType} teamId: ${mockReLoginResponse.data.teamId}`, {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(setAgentStateSpy).toHaveBeenCalledWith({
        state: 'Available',
        auxCodeId: '0', // even if get auxcodeId from relogin response, it should be 0 for available state
        lastStateChangeReason: 'agent-wss-disconnect',
        agentId: 'agentId',
      });
      expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(true);
      expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('0');
      expect(webex.cc.agentConfig.lastStateChangeTimestamp).toStrictEqual(1234); // it should be updated with the new timestamp of setAgentState response
      expect(webex.cc.agentConfig.lastIdleCodeChangeTimestamp).toStrictEqual(12345);
      expect(webex.cc.agentConfig.deviceType).toBe(LoginOption.BROWSER);
      expect(registerWebCallingLineSpy).toHaveBeenCalled();
      expect(setLoginOptionSpy).toHaveBeenCalledWith(LoginOption.BROWSER);
      // TODO: https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-626777 Implement the de-register method and close the listener there
      // expect(incomingTaskListenerSpy).toHaveBeenCalled();
      // expect(webSocketManagerOnSpy).toHaveBeenCalledWith('message', expect.any(Function));
      // expect(mockTaskManager.on).toHaveBeenCalledWith(
      //   TASK_EVENTS.TASK_HYDRATE,
      //   expect.any(Function)
      // );
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
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Agent not found during relogin, handling silently',
        {module: CC_FILE, method: 'silentRelogin'}
      );
    });

    it('should handle errors during silent relogin', async () => {
      const error = new Error('Error while performing silentRelogin');
      jest.spyOn(webex.cc.services.agent, 'reload').mockRejectedValue(error);

      await expect(webex.cc['silentRelogin']()).rejects.toThrow(error);
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(`silentRelogin failed with reason: Error while performing silentRelogin`, {
        module: CC_FILE,
        method: 'silentRelogin',
        trackingId: undefined,
      });
    });

    it('should update agentConfig with deviceType during silent relogin for EXTENSION', async () => {
      const mockReLoginResponse = {
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
          lastStateChangeTimestamp: 1738575135188,
          lastIdleCodeChangeTimestamp: 1738575135189,
          teamId: 'teamId',
        },
      };

      // Mock the agentConfig
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue(mockReLoginResponse);

      await webex.cc['silentRelogin']();

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Silent relogin process completed successfully with login Option: ${mockReLoginResponse.data.deviceType} teamId: ${mockReLoginResponse.data.teamId}`, {
        module: CC_FILE,
        method: 'silentRelogin',
      });


      expect(webex.cc.agentConfig.deviceType).toBe(LoginOption.EXTENSION);
      expect(webex.cc.agentConfig.dn).toBe('12345');
      expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('auxCodeId');
      expect(webex.cc.agentConfig.lastStateChangeTimestamp).toStrictEqual(1738575135188);
      expect(webex.cc.agentConfig.lastIdleCodeChangeTimestamp).toStrictEqual(1738575135189);
    });

    it('should update agentConfig with deviceType during silent relogin for AGENT_DN', async () => {
      const mockReLoginResponse = {
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          lastStateChangeReason: 'agent-wss-disconnect',
          deviceType: LoginOption.AGENT_DN,
          dn: '67890',
          subStatus: 'subStatusValue',
        },
      };

      // Mock the agentConfig
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue(mockReLoginResponse);

      await webex.cc['silentRelogin']();

      expect(webex.cc.agentConfig.deviceType).toBe(LoginOption.AGENT_DN);
      expect(webex.cc.agentConfig.dn).toBe('67890');
    });
  });

  describe('setupEventListeners()', () => {
    let connectionServiceOnSpy, cCEmitSpy;

    beforeEach(() => {
      connectionServiceOnSpy = jest.spyOn(webex.cc.services.connectionService, 'on');
      cCEmitSpy = jest.spyOn(webex.cc, 'emit');
    });

    it('should set up connectionLost and message event listener', () => {
      webex.cc.setupEventListeners();

      expect(connectionServiceOnSpy).toHaveBeenCalledWith('connectionLost', expect.any(Function));
    });
  });

  describe('startOutdial', () => {
    it('should make outdial call successfully.', async () => {
      // Setup outDialEp.
      webex.cc.agentConfig = {
        outDialEp: 'test-entry-point',
      };

      // destination number required for making outdial call.
      const destination = '1234567890';

      // Construct Payload for startOutdial.
      const newPayload = {
        destination,
        entryPointId: 'test-entry-point',
        direction: OUTDIAL_DIRECTION,
        attributes: ATTRIBUTES,
        mediaType: OUTDIAL_MEDIA_TYPE,
        outboundType: OUTBOUND_TYPE,
      } as const;

      const mockResponse = {} as AgentContact;

      const startOutdialMock = jest
        .spyOn(webex.cc.services.dialer, 'startOutdial')
        .mockResolvedValue(mockResponse);

      const result = await webex.cc.startOutdial(destination);

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting outbound dial', {
        module: CC_FILE,
        method: 'startOutdial',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('Outbound dial completed successfully', {
        module: CC_FILE,
        method: 'startOutdial',
      });

      expect(startOutdialMock).toHaveBeenCalledWith({data: newPayload});
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during startOutdial', async () => {
      // Setup outDialEp.
      webex.cc.agentConfig = {
        outDialEp: 'test-entry-point',
      };

      // destination number required for making outdial call.
      const invalidDestination = '12345';

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing startOutdial',
          },
        },
      };

      jest.spyOn(webex.cc.services.dialer, 'startOutdial').mockRejectedValue(error);

      await expect(webex.cc.startOutdial(invalidDestination)).rejects.toThrow(
        error.details.data.reason
      );

      expect(LoggerProxy.info).toHaveBeenCalledWith('Starting outbound dial', {
        module: CC_FILE,
        method: 'startOutdial',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `startOutdial failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: `startOutdial`, trackingId: error.details.trackingId}
      );
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'startOutdial', CC_FILE);
    });
  });

  describe('getQueues', () => {
    it('should return queues response when successful', async () => {
      const mockQueuesResponse = [
        {
          queueId: 'queue1',
          queueName: 'Queue 1',
        },
        {
          queueId: 'queue2',
          queueName: 'Queue 2',
        },
      ];

      webex.cc.services.config.getQueues = jest.fn().mockResolvedValue(mockQueuesResponse);

      const result = await webex.cc.getQueues();

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching queues', {
        module: CC_FILE,
        method: 'getQueues',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(`Successfully retrieved ${result.length} queues`, {
        module: CC_FILE,
        method: 'getQueues',
      });

      expect(webex.cc.services.config.getQueues).toHaveBeenCalledWith(
        'mockOrgId',
        0,
        100,
        undefined,
        undefined
      );
      expect(result).toEqual(mockQueuesResponse);
    });

    it('should throw an error if orgId is not present', async () => {
      jest.spyOn(webex.credentials, 'getOrgId').mockResolvedValue(undefined);
      webex.cc.services.config.getQueues = jest.fn();

      try {
        await webex.cc.getQueues();
      } catch (error) {
        expect(error).toEqual(new Error('Org ID not found.'));
        expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching queues', {
          module: CC_FILE,
          method: 'getQueues',
        });
        expect(LoggerProxy.error).toHaveBeenCalledWith('Org ID not found.', {
          module: CC_FILE,
          method: 'getQueues',
        });
        expect(webex.cc.services.config.getQueues).not.toHaveBeenCalled();
      }
    });

    it('should throw an error if config getQueues throws an error', async () => {
      webex.cc.services.config.getQueues = jest.fn().mockRejectedValue(new Error('Test error.'));

      try {
        await webex.cc.getQueues();
      } catch (error) {
        expect(error).toEqual(new Error('Test error.'));
        expect(LoggerProxy.info).toHaveBeenCalledWith('Fetching queues', {
          module: CC_FILE,
          method: 'getQueues',
        });
        expect(webex.cc.services.config.getQueues).toHaveBeenCalledWith(
          'mockOrgId',
          0,
          100,
          undefined,
          undefined
        );
      }
    });
  });

  describe('uploadLogs', () => {
    it('should upload logs successfully', async () => {
      const uploadLogsMock = jest.spyOn(webex.cc.webexRequest, 'uploadLogs').mockResolvedValue({
        trackingId: '1234',
        feedbackId: '12345',
      });

      const result = await webex.cc.uploadLogs('12345');

      expect(uploadLogsMock).toHaveBeenCalled();

      expect(result).toEqual({
        trackingId: '1234',
        feedbackId: '12345',
      });
    });

    it('should handle error during uploadLogs', async () => {
      const error = new Error('Error while performing uploadLogs');
      error.stack = 'My stack';

      jest.spyOn(webex.cc.webexRequest, 'uploadLogs').mockRejectedValue(error);

      await expect(webex.cc.uploadLogs('12345')).rejects.toThrow(error);
    });
  });

  describe('unregister', () => {
    let mockWebSocketManager;
    let mercuryDisconnectSpy;
    let deviceUnregisterSpy;
    
    beforeEach(() => {
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: true,
        loginVoiceOptions: [LoginOption.BROWSER],
      };

      mockWebSocketManager = {
        isSocketClosed: false,
        close: jest.fn(),
        off: jest.fn(),
        on: jest.fn(),
      };

      webex.cc.services.webSocketManager = mockWebSocketManager;
      
      webex.internal = webex.internal || {};
      webex.internal.mercury = {
        connected: true,
        disconnect: jest.fn().mockResolvedValue(),
        off: jest.fn(),
      };
      webex.internal.device = {
        unregister: jest.fn().mockResolvedValue(),
      };
      
      mercuryDisconnectSpy = jest.spyOn(webex.internal.mercury, 'disconnect');
      deviceUnregisterSpy = jest.spyOn(webex.internal.device, 'unregister');
    });

    it('should unregister successfully and clean up all resources when webrtc is enabled', async () => {
      await webex.cc.deregister();

      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, expect.any(Function));
      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, expect.any(Function));
      expect(mockWebSocketManager.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith('connectionLost', expect.any(Function));

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');
      expect(webex.cc.agentConfig).toBeNull();

      expect(webex.internal.mercury.off).toHaveBeenCalledWith('online');
      expect(webex.internal.mercury.off).toHaveBeenCalledWith('offline');
      expect(mercuryDisconnectSpy).toHaveBeenCalled();
      expect(deviceUnregisterSpy).toHaveBeenCalled();
      
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL
      ]);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS, 
        {}, 
        ['operational']
      );

      expect(LoggerProxy.log).toHaveBeenCalledWith('Mercury disconnected successfully', {
        module: CC_FILE,
        method: 'deregister',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith('Deregistered successfully', {
        module: CC_FILE,
        method: 'deregister',
      });

      // verify listeners removed with correct callbacks
      const incomingCalls = mockTaskManager.off.mock.calls.filter(
        ([evt]) => evt === TASK_EVENTS.TASK_INCOMING
      );
      expect(incomingCalls).toHaveLength(1);
      const [, incomingCallback] = incomingCalls[0];
      expect(incomingCallback).toBe(webex.cc['handleIncomingTask']);

      const hydrateCalls = mockTaskManager.off.mock.calls.filter(
        ([evt]) => evt === TASK_EVENTS.TASK_HYDRATE
      );
      expect(hydrateCalls).toHaveLength(1);
      const [, hydrateCallback] = hydrateCalls[0];
      expect(hydrateCallback).toBe(webex.cc['handleTaskHydrate']);

      const messageCalls = mockWebSocketManager.off.mock.calls.filter(
        ([evt]) => evt === 'message'
      );
      expect(messageCalls).toHaveLength(1);
      const [, messageCallback] = messageCalls[0];
      expect(messageCallback).toBe(webex.cc['handleWebsocketMessage']);

      const connectionCalls = webex.cc.services.connectionService.off.mock.calls.filter(
        ([evt]) => evt === 'connectionLost'
      );
      expect(connectionCalls).toHaveLength(1);
      const [, connectionCallback] = connectionCalls[0];
      expect(connectionCallback).toBe(webex.cc['handleConnectionLost']);
    });

    it('should skip webCallingService and internal cleanup when webrtc is disabled', async () => {
      webex.cc.agentConfig.webRtcEnabled = false;
      await webex.cc.deregister();
  
      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, expect.any(Function));
      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, expect.any(Function));
      expect(mockWebSocketManager.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith('connectionLost', expect.any(Function));
  
      expect(webex.internal.mercury.off).not.toHaveBeenCalled();
      expect(mercuryDisconnectSpy).not.toHaveBeenCalled();
      expect(deviceUnregisterSpy).not.toHaveBeenCalled();
    });

    it('should skip internal mercury cleanup when loginVoiceOptions does not include BROWSER', async () => {
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: true,
        loginVoiceOptions: ['EXTENSION'],
      };

      await webex.cc.deregister();

      // mercury listeners & disconnect should not run
      expect(webex.internal.mercury.off).not.toHaveBeenCalled();
      expect(mercuryDisconnectSpy).not.toHaveBeenCalled();
      expect(deviceUnregisterSpy).not.toHaveBeenCalled();

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');
      expect(webex.cc.agentConfig).toBeNull();
    });

    it('should handle errors during unregister and track metrics', async () => {
      const mockError = new Error('Failed to deregister device');
      webex.internal.device.unregister.mockRejectedValue(mockError);

      await expect(webex.cc.deregister()).rejects.toThrow('Failed to deregister device');

      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, expect.any(Function));
      expect(mockTaskManager.off).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, expect.any(Function));

      expect(LoggerProxy.error).toHaveBeenCalledWith(`Error during deregister: ${mockError}`, {
        module: CC_FILE,
        method: 'deregister',
      });
      
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL, 
        {
          error: 'Failed to deregister device',
        }, 
        ['operational']
      );
    });
  });

  describe('handleWebsocketMessage events', () => {
    let messageCallback;
    let emitSpy;

    beforeEach(() => {
      emitSpy = jest.spyOn(webex.cc, 'emit');
      messageCallback = mockWebSocketManager.on.mock.calls.find((c) => c[0] === 'message')[1];
    });

    it('should emit AGENT_STATION_LOGIN_SUCCESS on CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS with mapped payload', () => {
      const channelsMap = {chat: ['c1','c2'], email: [], social: ['s1'], telephony: []};
      const payload = {
        trackingId: 'track-123',
        data: {
          agentId: 'agent-id',
          teamId: 'team-id',
          siteId: 'site-id',
          roles: ['role1', 'role2'],
          channelsMap,
          type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
        },
        type: CC_EVENTS.AGENT_STATION_LOGIN,
      };

      messageCallback(JSON.stringify(payload));

      expect(emitSpy).toHaveBeenNthCalledWith(
        2,
        AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
        {
          agentId: 'agent-id',
          teamId: 'team-id',
          siteId: 'site-id',
          roles: ['role1', 'role2'],
          mmProfile: {
            chat: 2,
            email: 0,
            social: 1,
            telephony: 0,
          },
          notifsTrackingId: 'track-123',
          type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
        }
      );
    });

    it('should emit AGENT_RELOGIN_SUCCESS on CC_EVENTS.AGENT_RELOGIN_SUCCESS with mapped payload', () => {
      const channelsMap = {chat: ['a','b'], email: [], social: ['x'], telephony: ['y','z']};
      const payload = {
        trackingId: 'trk-relogin',
        data: {
          agentId: 'agent-re',
          teamId: 'team-re',
          siteId: 'site-re',
          roles: ['r1','r2'],
          channelsMap,
          type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
        },
        type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
      };

      messageCallback(JSON.stringify(payload));

      expect(emitSpy).toHaveBeenNthCalledWith(
        2,
        AGENT_EVENTS.AGENT_RELOGIN_SUCCESS,
        {
          agentId: 'agent-re',
          teamId: 'team-re',
          siteId: 'site-re',
          roles: ['r1', 'r2'],
          mmProfile: {
            chat: 2,
            email: 0,
            social: 1,
            telephony: 2,
          },
          notifsTrackingId: 'trk-relogin',
          type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
        }
      );
    });

    [
      { ccEvent: CC_EVENTS.AGENT_STATION_LOGIN_FAILED, constant: AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED },
      { ccEvent: CC_EVENTS.AGENT_LOGOUT_SUCCESS, constant: AGENT_EVENTS.AGENT_LOGOUT_SUCCESS },
      { ccEvent: CC_EVENTS.AGENT_LOGOUT_FAILED, constant: AGENT_EVENTS.AGENT_LOGOUT_FAILED },
      { ccEvent: CC_EVENTS.AGENT_DN_REGISTERED, constant: AGENT_EVENTS.AGENT_DN_REGISTERED },
      { ccEvent: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, constant: AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS },
      { ccEvent: CC_EVENTS.AGENT_STATE_CHANGE_FAILED, constant: AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED },
    ].forEach(({ ccEvent, constant }) => {
      it(`should emit ${constant} on ${ccEvent}`, () => {
        const sample = { foo: 'bar', type: ccEvent };
        messageCallback(JSON.stringify({type: ccEvent, data: sample}));
        expect(emitSpy).toHaveBeenCalledWith(constant, sample);
      });
    });
  });

  describe('updateAgentProfile', () => {
    beforeEach(() => {
      webex.cc.agentConfig = {
        ...webex.cc.agentConfig,
        currentTeamId: 'teamId',
        agentId: 'agent123',
      } as any;
    });

    it('should logout then login and return AgentDeviceTypeUpdateSuccess type', async () => {
      const data = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '98765',
      };
      const mockResp = {
        eventType: 'AgentDesktopMessage',
        agentId: 'agentId',
        trackingId: 'track-1',
        auxCodeId: 'aux-1',
        teamId: 'teamId',
        agentSessionId: 'sessId',
        orgId: 'org-1',
        interactionIds: ['i1'],
        status: 'LoggedIn',
        subStatus: 'Available',
        siteId: 'site-1',
        lastIdleCodeChangeTimestamp: 1,
        lastStateChangeTimestamp: 2,
        profileType: 'type',
        mmProfile: {chat: 0, email: 0, social: 0, telephony: 0},
        dialNumber: '98765',
        roles: ['role'],
        supervisorSessionId: undefined,
        notifsTrackingId: 'notif-1',
        type: 'AgentDeviceTypeUpdateSuccess',
      };

      jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      jest.spyOn(webex.cc, 'stationLogin').mockResolvedValue(mockResp as any);

      const result = await webex.cc.updateAgentProfile(data);

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        `starting profile update`,
        {
          module: CC_FILE,
          method: 'updateAgentProfile',
          trackingId: 'WX_CC_SDK_mock-tracking-uuid',
        }
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `profile updated successfully with ${data.loginOption} teamId: ${data.teamId}`,
        {
          module: CC_FILE,
          method: 'updateAgentProfile',
          trackingId: 'WX_CC_SDK_mock-tracking-uuid',
        }
      );

      expect(webex.cc.stationLogout).toHaveBeenCalledWith({logoutReason: 'User requested agent device change'});
      expect(webex.cc.stationLogin).toHaveBeenCalledWith({
        teamId: 'teamId',
        loginOption: data.loginOption,
        dialNumber: data.dialNumber,
      });
      expect(result).toEqual(mockResp);
    });

    it('should use provided teamId if passed in payload', async () => {
      const dataWithTeam = {
        teamId: 'newTeam',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '0000',
      };
      const mockResp = {
        ...{} as any,
        type: 'AgentDeviceTypeUpdateSuccess',
      };
      jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      const loginSpy = jest
        .spyOn(webex.cc, 'stationLogin')
        .mockResolvedValue(mockResp);

      const result = await webex.cc.updateAgentProfile(dataWithTeam);

      expect(loginSpy).toHaveBeenCalledWith({
        teamId: 'newTeam',
        loginOption: dataWithTeam.loginOption,
        dialNumber: dataWithTeam.dialNumber,
      });
      expect(result).toEqual(mockResp);
    });

    it('should track failure and throw when stationLogout fails', async () => {
      const data = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '98765',
      };
      const err = new Error('logout failure');
      jest.spyOn(webex.cc, 'stationLogout').mockRejectedValue(err);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');
      const logSpy = jest.spyOn(LoggerProxy, 'error');

      await expect(webex.cc.updateAgentProfile(data)).rejects.toThrow(err);

      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_FAILED,
        expect.objectContaining({loginType: data.loginOption}),
        ['behavioral', 'business', 'operational']
      );
      expect(logSpy).toHaveBeenCalledWith(
        `error updating profile: ${err}`,
        {module: CC_FILE, method: 'updateAgentProfile', trackingId: 'WX_CC_SDK_mock-tracking-uuid'}
      );
    });

    it('should track failure and throw when stationLogin fails', async () => {
      const data = {
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '98765',
      };
      jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      const loginErr = new Error('login failure');
      jest.spyOn(webex.cc, 'stationLogin').mockRejectedValue(loginErr);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');
      const logSpy = jest.spyOn(LoggerProxy, 'error');

      await expect(webex.cc.updateAgentProfile(data)).rejects.toThrow(loginErr);

      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AGENT_DEVICE_TYPE_UPDATE_FAILED,
        expect.objectContaining({loginType: data.loginOption}),
        ['behavioral', 'business', 'operational']
      );
      expect(logSpy).toHaveBeenCalledWith(
        `error updating profile: ${loginErr}`,
        {module: CC_FILE, method: 'updateAgentProfile', trackingId: 'WX_CC_SDK_mock-tracking-uuid'}
      );
    });

    it('should throw with detailed error when loginOption equals current device type', async () => {
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;
      const data = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
        dialNumber: '',
      };
      const expectedMessage =
        'Will not proceed with device update as new Device type is same as current device type and teamId is same as current teamId';

      await expect(webex.cc.updateAgentProfile(data)).rejects.toMatchObject({
        message: expectedMessage,
        details: expect.objectContaining({
          data: expect.objectContaining({
            agentId: webex.cc.agentConfig.agentId,
            reason: expectedMessage,
          }),
        }),
      });
    });

    it('should allow update when same device type but different teamId', async () => {
      webex.cc.agentConfig.currentTeamId = 'team1';
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;

      const data = {
        teamId: 'team2',
        loginOption: LoginOption.BROWSER,
        dialNumber: '1234',
      };
      jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      const loginSpy = jest.spyOn(webex.cc, 'stationLogin').mockResolvedValue({
        type: 'AgentDeviceTypeUpdateSuccess',
      } as any);

      await expect(webex.cc.updateAgentProfile(data)).resolves.toBeDefined();
      expect(loginSpy).toHaveBeenCalledWith({
        teamId: 'team2',
        loginOption: data.loginOption,
        dialNumber: data.dialNumber,
      });
    });
  });
});
