import 'jsdom-global/register';
import EventEmitter from 'events';
import {
  AIAssistantEventName,
  BuddyAgents,
  BuddyAgentsResponse,
  LoginOption,
  StationLogoutResponse,
  WebexSDK,
} from '../../../src/types';
import ContactCenter from '../../../src/cc';
import EntryPoint from '../../../src/services/EntryPoint';
import type {EntryPointListResponse} from '../../../src/types';
import AddressBook from '../../../src/services/AddressBook';
import Queue from '../../../src/services/Queue';
import type {ContactServiceQueuesResponse} from '../../../src/types';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess, AGENT_EVENTS} from '../../../src/services/agent/types';
import {SetStateResponse} from '../../../src/types';
import {AGENT, SUBSCRIBE_API, WEB_RTC_PREFIX} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import {CC_AI_SUMMARY_EVENTS, CC_EVENTS} from '../../../src/services/config/types';
import LoggerProxy from '../../../src/logger-proxy';
import * as Utils from '../../../src/services/core/Utils';
import {
  CC_FILE,
  OUTDIAL_DIRECTION,
  OUTBOUND_TYPE,
  ATTRIBUTES,
  OUTDIAL_MEDIA_TYPE,
  UNKNOWN_ERROR,
} from '../../../src/constants';

// Mock the Worker API
import '../../../__mocks__/workerMock';
import {Profile} from '../../../src/services/config/types';
import TaskManager from '../../../src/services/task/TaskManager';
import AISummaryCoordinator from '../../../src/services/task/AISummaryCoordinator';
import Task from '../../../src/services/task/Task';
import {
  AgentContact,
  PostCallSummaryResponsePayload,
  TASK_CHANNEL_TYPE,
  TASK_EVENTS,
  TaskData,
} from '../../../src/services/task/types';
import {AI_SUMMARY_REQUEST_CANCELLED} from '../../../src/services/task/constants';
import MetricsManager from '../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../src/metrics/constants';
import Mercury from '@webex/internal-plugin-mercury';
import WebexRequest from '../../../src/services/core/WebexRequest';
import type {ConnectionLostDetails} from '../../../src/services/core/websocket/types';
import {
  createDeferred,
  flushEventLoopTurn,
  flushMicrotasks,
} from '../fixtures/aiSummaryTestUtils';

jest.mock('../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../../src/services', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      agent: {
        stationLogin: jest.fn(),
        logout: jest.fn(),
        reload: jest.fn(),
        stateChange: jest.fn(),
        buddyAgents: jest.fn(),
      },
      config: {
        getAgentConfig: jest.fn(),
        getOutdialAniEntries: jest.fn(),
      },
      webSocketManager: {
        initWebSocket: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        isSocketClosed: false,
      },
      rtdWebSocketManager: {
        initWebSocket: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        isSocketClosed: false,
      },
      connectionService: {
        on: jest.fn(),
        off: jest.fn(),
      },
      contact: {},
      dialer: {
        startOutdial: jest.fn(),
        acceptPreviewContact: jest.fn(),
        skipPreviewContact: jest.fn(),
        removePreviewContact: jest.fn(),
      },
    })),
  },
}));

jest.mock('../../../src/services/task/TaskManager', () => ({
  __esModule: true,
  default: {
    getTaskManager: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      setConfigFlags: jest.fn(),
      setWrapupData: jest.fn(),
      setAgentId: jest.fn(),
      setAgentName: jest.fn(),
      setWebRtcEnabled: jest.fn(),
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      clearAISummaryState: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/metrics/MetricsManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
    getCommonTrackingFieldForAQMResponse: jest.fn(() => ({})),
    getCommonTrackingFieldForAQMResponseFailed: jest.fn(() => ({})),
  },
}));

jest.mock('../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      request: jest.fn(),
      uploadLogs: jest.fn(),
    })),
  },
}));

jest.mock('../../../src/services/ApiAiAssistant', () => {
  class MockApiAIAssistant {
    public sendEvent = jest.fn();
    public getSuggestedResponse = jest.fn();
    public fetchHistoricTranscripts = jest.fn();
    public setAIFeatureFlags = jest.fn();
    public setAgentId = jest.fn();
    public sendSummaryGetEvent = jest.fn();
    public sendSummaryResponseEvent = jest.fn();
  }

  return {
    __esModule: true,
    default: MockApiAIAssistant,
    ApiAIAssistant: MockApiAIAssistant,
  };
});

jest.mock('../../../src/services/WebCallingService', () => {
  class MockWebCallingService {
    public loginOption = 'AGENT_DN';
    public registerWebCallingLine = jest.fn().mockResolvedValue(undefined);
    public deregisterWebCallingLine = jest.fn().mockResolvedValue(undefined);
    public setLoginOption = jest.fn((loginOption: string) => {
      this.loginOption = loginOption;
    });
  }

  return {
    __esModule: true,
    default: MockWebCallingService,
  };
});

jest.mock('../../../src/services/task/TaskFactory', () => ({
  __esModule: true,
  default: {
    createTask: jest.fn(),
  },
}));

jest.mock('../../../src/services/task/voice/WebRTC', () => ({
  __esModule: true,
  default: class MockWebRTC {},
}));

jest.mock('../../../src/services/task/taskDataNormalizer', () => ({
  normalizeTaskData: jest.fn((data) => data),
}));

jest.mock('../../../src/services/task/state-machine', () => ({
  ...jest.requireActual('../../../src/services/task/state-machine'),
  createTaskStateMachine: jest.fn(
    jest.requireActual('../../../src/services/task/state-machine').createTaskStateMachine
  ),
}));

jest.mock('../../../src/services/task/state-machine/uiControlsComputer', () => ({
  computeUIControls: jest.fn(() => ({})),
  getDefaultUIControls: jest.fn(() => ({})),
  haveUIControlsChanged: jest.fn(() => false),
}));

jest.mock('../../../src/services/task/AutoWrapup', () => ({
  __esModule: true,
  default: class MockAutoWrapup {},
}));

jest.mock('../../../src/services/EntryPoint', () => {
  class MockEntryPoint {
    public getEntryPoints() {
      return Promise.resolve({});
    }
  }

  return {
    __esModule: true,
    default: MockEntryPoint,
    EntryPoint: MockEntryPoint,
  };
});

jest.mock('../../../src/services/AddressBook', () => {
  class MockAddressBook {
    public getEntries() {
      return Promise.resolve({});
    }
  }

  return {
    __esModule: true,
    default: MockAddressBook,
    AddressBook: MockAddressBook,
  };
});

jest.mock('../../../src/services/Queue', () => {
  class MockQueue {
    public getQueues() {
      return Promise.resolve({});
    }
  }

  return {
    __esModule: true,
    default: MockQueue,
    Queue: MockQueue,
  };
});

jest.mock('../../../src/services/config');
jest.mock('../../../src/services/core/websocket/WebSocketManager');
jest.mock('../../../src/services/core/websocket/connection-service');
jest.mock('uuid', () => ({v4: () => 'mock-tracking-uuid'}));

global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');

class EventEmitterDouble extends EventEmitter {
  public isSocketClosed = false;
  public initWebSocket = jest.fn().mockResolvedValue({});
  public close = jest.fn(() => {
    this.isSocketClosed = true;
  });
  public mapCallToTask = jest.fn();

  public on = jest.fn((eventName: string | symbol, listener: (...args: unknown[]) => void) => {
    super.on(eventName, listener);

    return this;
  });

  public off = jest.fn((eventName: string | symbol, listener: (...args: unknown[]) => void) => {
    super.off(eventName, listener);

    return this;
  });
}

class AISummaryLifecycleTask extends Task {
  public constructor(data: TaskData, agentId = 'agent-1') {
    super(
      {} as any,
      data,
      {
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      },
      undefined,
      agentId
    );
  }

  public accept() {
    return Promise.resolve({} as any);
  }
}

const createAISummaryLifecycleTask = (
  data: TaskData = createAISummaryLifecycleTaskData()
): AISummaryLifecycleTask => new AISummaryLifecycleTask(data);

const createAISummaryLifecycleTaskData = (
  overrides: Partial<TaskData> & {conversationId?: string} = {}
): TaskData => {
  const {
    conversationId = 'conversation-1',
    interaction: interactionOverrides,
    ...taskOverrides
  } = overrides;
  const interactionId = taskOverrides.interactionId ?? 'interaction-1';

  return {
    mediaResourceId: 'media-resource-1',
    eventType: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
    agentId: 'agent-1',
    destAgentId: '',
    trackingId: 'tracking-1',
    consultMediaResourceId: '',
    interactionId,
    orgId: 'org-1',
    owner: 'agent-1',
    queueMgr: 'queue-manager-1',
    type: 'telephony',
    isConferencing: false,
    taskId: 'task-owner-1',
    ...taskOverrides,
    interaction: {
      interactionId,
      mainInteractionId: conversationId,
      mediaType: 'telephony',
      media: {
        [interactionId]: {
          mediaResourceId: 'media-resource-1',
        },
      },
      callProcessingDetails: {},
      ...(interactionOverrides as Record<string, unknown> | undefined),
    },
  } as TaskData;
};

describe('webex.cc', () => {
  let webex;
  let mockApiAIAssistant;
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
      close: jest.fn(),
      isSocketClosed: false,
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

    mockApiAIAssistant = {
      sendEvent: jest.fn(),
      getRealTimeAssistance: jest.fn(),
      fetchHistoricTranscripts: jest.fn(),
      setAIFeatureFlags: jest.fn(),
      setAgentId: jest.fn(),
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
        getOutdialAniEntries: jest.fn(),
      },
      webSocketManager: mockWebSocketManager,
      rtdWebSocketManager: {
        initWebSocket: jest.fn().mockResolvedValue({}),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        isSocketClosed: false,
      },
      connectionService: {
        on: jest.fn(),
        off: jest.fn(),
      },
      contact: mockContact,

      dialer: {
        startOutdial: jest.fn(),
        acceptPreviewContact: jest.fn(),
        skipPreviewContact: jest.fn(),
        removePreviewContact: jest.fn(),
      },
      apiAIAssistant: {
        sendEvent: jest.fn(),
        fetchHistoricTranscripts: jest.fn(),
      },
    };

    mockTaskManager = {
      apiAIAssistant: mockApiAIAssistant,
      contact: mockContact,
      call: undefined,
      taskCollection: {},
      webCallingService: undefined,
      webSocketManager: mockWebSocketManager,
      task: undefined,
      setConfigFlags: jest.fn(),
      setWrapupData: jest.fn(),
      setAgentId: jest.fn(),
      setAgentName: jest.fn(),
      setWebRtcEnabled: jest.fn(),
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      clearAISummaryState: jest.fn(),
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
    jest.spyOn(Services, 'getInstance').mockReturnValue(mockServicesInstance as any);
    jest.spyOn(TaskManager, 'getTaskManager').mockReturnValue(mockTaskManager);
    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue(mockWebexRequest);
    // Instantiate ContactCenter to ensure it's fully initialized
    webex.cc = new ContactCenter({parent: webex});
    getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should initialize services and logger proxy on ready event', () => {
    webex.once('ready', () => {
      expect(Services.getInstance).toHaveBeenCalled();
      expect(LoggerProxy.initialize).toHaveBeenCalledWith(webex.logger);
    });

    webex.emit('ready');
  });

  it('should throw when WebRTC registration is disabled without multi-login', () => {
    const invalidWebex = MockWebex({
      children: {
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
      config: {
        ...config,
        cc: {
          ...config.cc,
          allowMultiLogin: false,
          disableWebRTCRegistration: true,
        },
      },
      once: jest.fn((event, callback) => callback()),
    }) as unknown as WebexSDK;

    expect(() => new ContactCenter({parent: invalidWebex})).toThrow(
      'Invalid Contact Center configuration: disableWebRTCRegistration cannot be true when allowMultiLogin is false. Enable allowMultiLogin or allow WebRTC registration so an SDK instance can receive Mobius/WebRTC task events.'
    );
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
    const createFreshAgentProfile = (overrides: Partial<Profile> = {}): Profile => ({
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
      isEndTaskEnabled: false,
      isEndConsultEnabled: false,
      agentDbId: '',
      allowConsultToQueue: false,
      agentPersonalStatsEnabled: false,
      isTimeoutDesktopInactivityEnabled: false,
      webRtcEnabled: true,
      lostConnectionRecoveryTimeout: 0,
      ...overrides,
    });

    const mockAgentProfile: Profile = createFreshAgentProfile();

    it('should register successfully and return agent profile', async () => {
      mockAgentProfile.aiFeature = {realtimeTranscripts: {enable: true}} as any;
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
      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting CC SDK registration', {
        module: CC_FILE,
        method: 'register',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `CC SDK registration completed successfully with agentId: ${result.agentId}`,
        {
          module: CC_FILE,
          method: 'register',
        }
      );

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
        resource: SUBSCRIBE_API,
      });

      // SPARK-626777 tracks moving listener cleanup into the future de-register API.
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        AGENT_EVENTS.FEATURE_ENABLEMENT,
        webex.cc['handleFeatureEnablement']
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        AGENT_EVENTS.FEATURE_ENABLEMENT,
        webex.cc['handleFeatureEnablement']
      );
      expect(mockWebSocketManager.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
        resource: 'v1/realtime/subscribe',
      });
      expect(webex.cc.services.rtdWebSocketManager.off).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(webex.cc.services.rtdWebSocketManager.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(
        webex.cc.services.rtdWebSocketManager.off.mock.invocationCallOrder[0]
      ).toBeLessThan(webex.cc.services.rtdWebSocketManager.on.mock.invocationCallOrder[0]);

      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent config is fetched successfully', {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(mockTaskManager.setConfigFlags).toHaveBeenCalledWith({
        isEndTaskEnabled: mockAgentProfile.isEndTaskEnabled,
        isEndConsultEnabled: mockAgentProfile.isEndConsultEnabled,
        webRtcEnabled: mockAgentProfile.webRtcEnabled,
        autoWrapup: mockAgentProfile.wrapUpData.wrapUpProps.autoWrapup ?? false,
        aiFeature: mockAgentProfile.aiFeature,
      });
      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
      expect(mockTaskManager.clearAISummaryState.mock.invocationCallOrder[0]).toBeLessThan(
        mockTaskManager.setConfigFlags.mock.invocationCallOrder[0]
      );
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
    });

    it('restores public feature enablement forwarding after deregistration cleanup and register', async () => {
      const profile = createFreshAgentProfile({
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
      });
      const featurePayload = {
        interactionId: 're-registered-interaction',
        postCallEnabled: true,
        midCallEnabled: false,
      };
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');

      webex.cc['runDeregisterCleanup']();
      mockTaskManager.on.mockClear();
      jest.spyOn(webex.cc, 'connectWebsocket').mockResolvedValue(profile);

      await webex.cc.register();

      const featureRegistrations = mockTaskManager.on.mock.calls.filter(
        ([eventName]) => eventName === AGENT_EVENTS.FEATURE_ENABLEMENT
      );
      expect(featureRegistrations).toEqual([
        [AGENT_EVENTS.FEATURE_ENABLEMENT, webex.cc['handleFeatureEnablement']],
      ]);

      featureRegistrations[0][1](featurePayload);
      expect(triggerSpy).toHaveBeenCalledWith(AGENT_EVENTS.FEATURE_ENABLEMENT, featurePayload);
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
        resource: SUBSCRIBE_API,
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
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
    });

    it('should log error and reject if registration fails', async () => {
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const mockError = new Error('Error while performing register');
      mockWebSocketManager.initWebSocket.mockRejectedValue(mockError);

      await expect(webex.cc.register()).rejects.toThrow('Error while performing register');

      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting CC SDK registration', {
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

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Error occurred during mercury.connect() ${mockError}`,
        {
          module: CC_FILE,
          method: 'connectWebsocket',
        }
      );
      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
        resource: SUBSCRIBE_API,
      });

      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.on).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
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

    it('should skip mercury connection when disableWebRTCRegistration is enabled', async () => {
      webex.cc.$config = {
        ...webex.cc.$config,
        allowAutomatedRelogin: false,
        disableWebRTCRegistration: true,
      };
      mockAgentProfile.webRtcEnabled = true;
      const mercurySpy = jest.spyOn(webex.internal.mercury, 'connect');
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      const result = await webex.cc.register();

      expect(connectWebsocketSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
      expect(mercurySpy).not.toHaveBeenCalled();
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Skipping Mobius registration because disableWebRTCRegistration is enabled',
        {
          module: CC_FILE,
          method: 'connectWebsocket',
        }
      );
      expect(result).toEqual(mockAgentProfile);
    });

    it('should not attempt for mercury connection when webrtc is disabled', async () => {
      mockAgentProfile.webRtcEnabled = false;
      mockAgentProfile.aiFeature = {realtimeTranscripts: {enable: false}} as any;
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
        resource: SUBSCRIBE_API,
      });

      expect(configSpy).toHaveBeenCalled();
      expect(mercurySpy).not.toHaveBeenCalled();
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).not.toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });

    it('should not connect RTD websocket when realtime transcripts feature is disabled', async () => {
      mockAgentProfile.aiFeature = {realtimeTranscripts: {enable: false}} as any;
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({
        agentId: 'agent123',
      });

      await webex.cc.register();

      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).not.toHaveBeenCalled();
      expect(webex.cc.services.rtdWebSocketManager.on).not.toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should connect RTD websocket when either generated summary organization flag is enabled', async () => {
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});

      for (const generatedSummaries of [
        {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: false},
        {wrapUpSummariesEnabled: false, consultTransferSummariesEnabled: true},
      ]) {
        jest.clearAllMocks();
        jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue({
          ...mockAgentProfile,
          aiFeature: {generatedSummaries} as any,
        });

        await webex.cc.register();

        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
          body: {
            force: true,
            isKeepAliveEnabled: false,
            clientType: 'WebexCCSDK',
            allowMultiLogin: false,
          },
          resource: 'v1/realtime/subscribe',
        });
      }
    });

    it.each([
      {
        title: 'aiFeature is absent',
        profileAgentId: 'profile-agent-without-ai-feature',
        defaultDn: 'normalized-dn-without-ai-feature',
        aiFeature: undefined,
      },
      {
        title: 'aiFeature has no optional feature objects',
        profileAgentId: 'profile-agent-with-empty-ai-feature',
        defaultDn: 'normalized-dn-with-empty-ai-feature',
        aiFeature: {} as any,
      },
    ])(
      'should tolerate absent AI feature shapes without summary-driven RTD setup when $title',
      async ({profileAgentId, defaultDn, aiFeature}) => {
        const welcomeAgentId = 'welcome-agent-for-absent-ai-feature';
        const configuredProfile = createFreshAgentProfile({
          agentId: profileAgentId,
          defaultDn,
          dn: 'pre-register-dn',
          webRtcEnabled: true,
          aiFeature,
        });
        const expectedProfile = {...configuredProfile, dn: defaultDn};
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
        const configSpy = jest
          .spyOn(webex.cc.services.config, 'getAgentConfig')
          .mockResolvedValue(configuredProfile);
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: welcomeAgentId});

        await expect(webex.cc.register()).resolves.toEqual(expectedProfile);

        expect(configSpy).toHaveBeenCalledWith('mockOrgId', welcomeAgentId);
        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).not.toHaveBeenCalled();
      }
    );

    it.each([
      {
        title: 'all generated summary organization flags are disabled',
        aiFeature: {
          realtimeTranscripts: {enable: false},
          suggestedResponses: {enable: false},
          generatedSummaries: {
            wrapUpSummariesEnabled: false,
            consultTransferSummariesEnabled: false,
          },
        } as any,
      },
    ])(
      'should keep registration operational without summary-driven RTD setup when $title',
      async ({aiFeature}) => {
        const welcomeAgentId = 'welcome-agent-with-disabled-summaries';
        const configuredProfile = createFreshAgentProfile({
          agentId: 'profile-agent-with-disabled-summaries',
          defaultDn: 'normalized-dn-with-disabled-summaries',
          dn: 'pre-register-dn',
          webRtcEnabled: true,
          aiFeature,
        });
        const expectedProfile = {...configuredProfile, dn: configuredProfile.defaultDn};
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        const mercuryConnect = jest
          .spyOn(webex.internal.mercury, 'connect')
          .mockResolvedValue(true);
        const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
        const configSpy = jest
          .spyOn(webex.cc.services.config, 'getAgentConfig')
          .mockResolvedValue(configuredProfile);
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: welcomeAgentId});

        const result = await webex.cc.register();

        expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
          body: {
            force: true,
            isKeepAliveEnabled: false,
            clientType: 'WebexCCSDK',
            allowMultiLogin: false,
          },
          resource: SUBSCRIBE_API,
        });
        expect(configSpy).toHaveBeenCalledWith('mockOrgId', welcomeAgentId);
        expect(setupEventListenersSpy).toHaveBeenCalled();
        expect(mockTaskManager.on).toHaveBeenCalledWith(
          TASK_EVENTS.TASK_INCOMING,
          expect.any(Function)
        );
        expect(mockTaskManager.on).toHaveBeenCalledWith(
          TASK_EVENTS.TASK_HYDRATE,
          expect.any(Function)
        );
        expect(mockTaskManager.on).toHaveBeenCalledWith(
          TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
          expect.any(Function)
        );
        expect(mockWebSocketManager.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockTaskManager.setConfigFlags).toHaveBeenCalledWith({
          isEndTaskEnabled: configuredProfile.isEndTaskEnabled,
          isEndConsultEnabled: configuredProfile.isEndConsultEnabled,
          webRtcEnabled: configuredProfile.webRtcEnabled,
          autoWrapup: configuredProfile.wrapUpData.wrapUpProps.autoWrapup ?? false,
          aiFeature,
        });
        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).not.toHaveBeenCalled();
        expect(webex.cc.services.rtdWebSocketManager.on).not.toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        );
        expect(mercuryConnect).toHaveBeenCalled();
        expect(result).toEqual(expectedProfile);
      }
    );
  });

  describe('AI summary lifecycle wiring', () => {
    const sentinels = [
      'summary-sentinel-cc-lifecycle',
      'section-key-sentinel-cc-lifecycle',
      'section-value-sentinel-cc-lifecycle',
      'adaptive-card-sentinel-cc-lifecycle',
      'agent-name-sentinel-cc-lifecycle',
    ];

    const createSummaryHarness = () => {
      const ActualTaskManager = jest.requireActual('../../../src/services/task/TaskManager')
        .default as typeof TaskManager;
      const webSocketManager = new EventEmitterDouble();
      const rtdWebSocketManager = new EventEmitterDouble();
      const connectionService = new EventEmitterDouble();
      const webCallingService = new EventEmitterDouble();
      const transportDeferreds: Deferred<void>[] = [];
      const apiAIAssistant = {
        sendEvent: jest.fn(),
        getSuggestedResponse: jest.fn(),
        fetchHistoricTranscripts: jest.fn(),
        setAIFeatureFlags: jest.fn(),
        setAgentId: jest.fn(),
        sendSummaryGetEvent: jest.fn(() => {
          const deferred = createDeferred<void>();

          transportDeferreds.push(deferred);

          return deferred.promise;
        }),
        sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
      };
      const taskManager = new ActualTaskManager(
        apiAIAssistant as any,
        mockContact,
        webCallingService as any,
        webSocketManager as any,
        rtdWebSocketManager as any
      );
      const taskFactory = jest.requireMock('../../../src/services/task/TaskFactory')
        .default as {createTask: jest.Mock};

      taskFactory.createTask.mockImplementation(
        (_contact, _webCallingService, taskData: TaskData) =>
          createAISummaryLifecycleTask(taskData)
      );
      const task = createAISummaryLifecycleTask();

      taskManager.setConfigFlags({
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        webRtcEnabled: false,
        autoWrapup: false,
        aiFeature: {
          generatedSummaries: {
            wrapUpSummariesEnabled: true,
            consultTransferSummariesEnabled: true,
          },
        },
      } as any);
      taskManager.setAgentId('agent-1');
      taskManager.setWebRtcEnabled(false);
      (taskManager as any).taskCollection[task.data.interactionId] = task;
      (taskManager as any).configureTaskAISummary(task);

      (webex.cc as any).taskManager = taskManager;
      webex.cc.apiAIAssistant = apiAIAssistant as any;
      webex.cc.services.webSocketManager = webSocketManager as any;
      webex.cc.services.rtdWebSocketManager = rtdWebSocketManager as any;
      webex.cc.services.connectionService = connectionService as any;

      const emitRtdFrame = (type: string, data: Record<string, unknown>) => {
        rtdWebSocketManager.emit('message', JSON.stringify({type, data: {data}}));
      };
      const dispatchRtdFrame = (type: string, data: Record<string, unknown>) => {
        webex.cc['handleRTDWebsocketMessage'](JSON.stringify({type, data: {data}}));
      };
      const getCoordinator = () =>
        (taskManager as any).aiSummaryCoordinator as AISummaryCoordinator;
      const getSummaryMapCounts = () => {
        const coordinator = getCoordinator() as any;

        return {
          pendingPostCall: coordinator.pendingAISummaryRequests.POST_CALL_SUMMARY.size,
          pendingMidCall: coordinator.pendingAISummaryRequests.MID_CALL_SUMMARY.size,
          receiving: coordinator.receivingSummaryBuffer.size,
          featureEnablement: coordinator.interactionFeatureEnablement.size,
        };
      };
      const expectSummaryStateCleared = () => {
        expect(getSummaryMapCounts()).toEqual({
          pendingPostCall: 0,
          pendingMidCall: 0,
          receiving: 0,
          featureEnablement: 0,
        });
      };

      return {
        apiAIAssistant,
        connectionService,
        dispatchRtdFrame,
        emitRtdFrame,
        expectSummaryStateCleared,
        getCoordinator,
        getSummaryMapCounts,
        rtdWebSocketManager,
        task,
        taskManager,
        transportDeferreds,
        webSocketManager,
      };
    };

    const attachRtdMessageListener = (rtdWebSocketManager: EventEmitterDouble) => {
      rtdWebSocketManager.on('message', webex.cc['handleRTDWebsocketMessage']);
    };

    const countAISummaryRequestFinalMetrics = () =>
      mockMetricsManager.trackEvent.mock.calls.filter(([eventName]) =>
        [
          METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
          METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
          METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
          METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
        ].includes(eventName)
      ).length;

    const expectSentinelsNotObserved = () => {
      const observedArguments = JSON.stringify([
        LoggerProxy.log.mock.calls,
        LoggerProxy.info.mock.calls,
        LoggerProxy.warn.mock.calls,
        LoggerProxy.error.mock.calls,
        mockMetricsManager.trackEvent.mock.calls,
        mockMetricsManager.timeEvent.mock.calls,
      ]);

      sentinels.forEach((sentinel) => {
        expect(observedArguments).not.toContain(sentinel);
      });
    };

    const emitFeatureEnablement = (
      harness: ReturnType<typeof createSummaryHarness>,
      payload = {
        interactionId: 'interaction-1',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 1,
      }
    ) => {
      harness.emitRtdFrame(CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT, payload);
    };

    const dispatchFeatureEnablement = (
      harness: ReturnType<typeof createSummaryHarness>,
      payload = {
        interactionId: 'interaction-1',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 1,
      }
    ) => {
      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT, payload);
    };

    const emitTaskLifecycleEvent = (
      harness: ReturnType<typeof createSummaryHarness>,
      eventType: CC_EVENTS,
      overrides: Partial<TaskData> & {conversationId?: string}
    ) => {
      const interactionId = overrides.interactionId ?? 'interaction-1';

      harness.webSocketManager.emit(
        'message',
        JSON.stringify({
          data: {
            ...createAISummaryLifecycleTaskData({
              mediaResourceId: interactionId,
              taskId: `task-owner-${interactionId}`,
              ...overrides,
            }),
            type: eventType,
          },
        })
      );
    };

    const emitSentinelPostCallSummary = (
      harness: ReturnType<typeof createSummaryHarness>,
      conversationId = 'conversation-1'
    ) => {
      harness.emitRtdFrame(CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, {
        conversationId,
        summaryText: sentinels[0],
        sections: {
          [sentinels[1]]: sentinels[2],
          initialContactReason: sentinels[2],
        },
        adaptiveCard: {
          body: [{text: sentinels[3]}],
        },
      });
    };

    const dispatchSentinelPostCallSummary = (
      harness: ReturnType<typeof createSummaryHarness>,
      conversationId = 'conversation-1'
    ) => {
      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, {
        conversationId,
        summaryText: sentinels[0],
        sections: {
          [sentinels[1]]: sentinels[2],
          initialContactReason: sentinels[2],
        },
        adaptiveCard: {
          body: [{text: sentinels[3]}],
        },
      });
    };

    const emitSentinelMidCallSummary = (
      harness: ReturnType<typeof createSummaryHarness>,
      conversationId = 'conversation-1'
    ) => {
      harness.emitRtdFrame(CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY, {
        conversationId,
        summaryText: sentinels[0],
        agentName: sentinels[4],
        sections: {
          [sentinels[1]]: sentinels[2],
          reasonForTransferOrConsult: sentinels[2],
        },
        adaptiveCard: {
          body: [{text: sentinels[3]}],
        },
      });
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('forwards real FEATURE_ENABLEMENT frames through one surviving named listener', () => {
      const harness = createSummaryHarness();
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');
      const taskManagerOffSpy = jest.spyOn(harness.taskManager, 'off');
      const taskManagerOnSpy = jest.spyOn(harness.taskManager, 'on');
      const featurePayloads = [
        {
          interactionId: 'interaction-1',
          postCallEnabled: true,
          midCallEnabled: false,
          actionTimeStamp: 1,
        },
        {
          interactionId: 'interaction-2',
          postCallEnabled: false,
          midCallEnabled: true,
          actionTimeStamp: 2,
        },
        {
          interactionId: 'interaction-2',
          postCallEnabled: false,
          midCallEnabled: true,
          actionTimeStamp: 2,
        },
      ];

      attachRtdMessageListener(harness.rtdWebSocketManager);
      webex.cc['refreshTaskManagerEventForwarders']();
      webex.cc['refreshTaskManagerEventForwarders']();

      const featureOffOrders = taskManagerOffSpy.mock.calls
        .map(([eventName], index) =>
          eventName === AGENT_EVENTS.FEATURE_ENABLEMENT
            ? taskManagerOffSpy.mock.invocationCallOrder[index]
            : undefined
        )
        .filter(Boolean);
      const featureOnOrders = taskManagerOnSpy.mock.calls
        .map(([eventName], index) =>
          eventName === AGENT_EVENTS.FEATURE_ENABLEMENT
            ? taskManagerOnSpy.mock.invocationCallOrder[index]
            : undefined
        )
        .filter(Boolean);

      expect(featureOffOrders).toHaveLength(2);
      expect(featureOnOrders).toHaveLength(2);
      featureOffOrders.forEach((offOrder, index) => {
        expect(offOrder).toBeLessThan(featureOnOrders[index]);
      });
      expect(harness.taskManager.listenerCount(AGENT_EVENTS.FEATURE_ENABLEMENT)).toBe(1);

      featurePayloads.forEach((payload) => emitFeatureEnablement(harness, payload));

      expect(
        triggerSpy.mock.calls.filter(([eventName]) => eventName === AGENT_EVENTS.FEATURE_ENABLEMENT)
      ).toEqual(featurePayloads.map((payload) => [AGENT_EVENTS.FEATURE_ENABLEMENT, payload]));

      triggerSpy.mockClear();

      emitSentinelPostCallSummary(harness, 'unmatched-post-conversation');
      emitSentinelMidCallSummary(harness, 'unmatched-mid-conversation');

      expect(
        triggerSpy.mock.calls.some(
          ([eventName]) =>
            eventName === AGENT_EVENTS.FEATURE_ENABLEMENT ||
            eventName === CC_EVENTS.POST_CALL_SUMMARY ||
            eventName === CC_EVENTS.MID_CALL_SUMMARY
        )
      ).toBe(false);
      expectSentinelsNotObserved();
      harness.taskManager.clearAISummaryState();
      harness.expectSummaryStateCleared();
    });

    it('keeps connection and RTD listeners single-subscribed across repeated register calls', async () => {
      const harness = createSummaryHarness();
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');
      const profile = {
        agentId: 'agent-1',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        wrapUpData: {wrapUpProps: {autoWrapup: false}},
        aiFeature: {
          generatedSummaries: {
            wrapUpSummariesEnabled: true,
            consultTransferSummariesEnabled: true,
          },
        },
      } as any;
      const featurePayload = {
        interactionId: 'interaction-1',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 7,
      };

      webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
      webex.cc['refreshTaskManagerEventForwarders']();
      harness.webSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent-1'});
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(profile);

      await webex.cc.register();
      await flushMicrotasks();
      await webex.cc.register();
      await flushMicrotasks();

      expect(harness.connectionService.listenerCount('connectionLost')).toBe(1);
      expect(harness.connectionService.listeners('connectionLost')[0]).toBe(
        webex.cc['handleConnectionLost']
      );
      expect(harness.rtdWebSocketManager.listenerCount('message')).toBe(1);
      expect(harness.rtdWebSocketManager.listeners('message')[0]).toBe(
        webex.cc['handleRTDWebsocketMessage']
      );

      mockMetricsManager.trackEvent.mockClear();
      LoggerProxy.warn.mockClear();
      triggerSpy.mockClear();

      harness.emitRtdFrame('UNKNOWN_SUMMARY_EVENT', {
        conversationId: 'unknown-conversation',
      });
      emitFeatureEnablement(harness, featurePayload);

      const dropMetricCalls = mockMetricsManager.trackEvent.mock.calls.filter(
        ([eventName]) => eventName === METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED
      );
      const featureMetricCalls = mockMetricsManager.trackEvent.mock.calls.filter(
        ([eventName]) => eventName === METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED
      );
      const featureEventCalls = triggerSpy.mock.calls.filter(
        ([eventName]) => eventName === AGENT_EVENTS.FEATURE_ENABLEMENT
      );

      expect(dropMetricCalls).toHaveLength(1);
      expect(dropMetricCalls[0]).toEqual([
        METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
        {
          eventType: 'UNKNOWN_SUMMARY_EVENT',
          dropReason: 'unknown-event',
        },
        ['operational'],
      ]);
      expect(LoggerProxy.warn).toHaveBeenCalledTimes(1);
      expect(featureMetricCalls).toHaveLength(1);
      expect(featureMetricCalls[0]).toEqual([
        METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
        {
          validationOutcome: 'valid',
          postCallEnabled: true,
          midCallEnabled: true,
        },
        ['operational'],
      ]);
      expect(featureEventCalls).toEqual([[AGENT_EVENTS.FEATURE_ENABLEMENT, featurePayload]]);
    });

    it('forwards task-manager handlers through ContactCenter trigger and delegates RTD messages', () => {
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');
      const task = {data: {interactionId: 'interaction-1'}} as any;

      webex.cc['handleTaskHydrate'](task);
      webex.cc['handleTaskMultiLoginHydrate'](task);
      webex.cc['handleTaskMerged'](task);
      webex.cc['handleCampaignPreviewReservation'](task);
      webex.cc['handleRTDWebsocketMessage']('summary-frame');

      expect(triggerSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, task);
      expect(triggerSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, task);
      expect(triggerSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MERGED, task);
      expect(triggerSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION, task);
      expect(mockTaskManager.handleRealtimeWebsocketEvent).toHaveBeenCalledWith('summary-frame');
    });

    it('resets real summary state across register, reconnect, and deregister boundaries', async () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');
      const profile = {
        agentId: 'agent-1',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        wrapUpData: {wrapUpProps: {autoWrapup: false}},
        aiFeature: {
          generatedSummaries: {
            wrapUpSummariesEnabled: true,
            consultTransferSummariesEnabled: true,
          },
        },
      } as any;

      webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
      webex.cc['refreshTaskManagerEventForwarders']();
      harness.webSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent-1'});
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(profile);

      dispatchFeatureEnablement(harness, {
        interactionId: 'orphan-before-register',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 3,
      });
      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT, {
        conversationId: 'queued-before-register',
        summaryText: sentinels[0],
      });
      expect(jest.getTimerCount()).toBe(2);

      await webex.cc.register();
      await flushMicrotasks();

      harness.expectSummaryStateCleared();
      expect(jest.getTimerCount()).toBe(0);
      expect(harness.rtdWebSocketManager.listenerCount('message')).toBe(1);

      dispatchFeatureEnablement(harness);
      expect(triggerSpy).toHaveBeenLastCalledWith(AGENT_EVENTS.FEATURE_ENABLEMENT, {
        interactionId: 'interaction-1',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 1,
      });

      dispatchFeatureEnablement(harness, {
        interactionId: 'orphan-before-reconnect',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 4,
      });
      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT, {
        conversationId: 'queued-before-reconnect',
        summaryText: sentinels[0],
      });
      expect(jest.getTimerCount()).toBe(2);

      await webex.cc['handleConnectionLost']({
        isConnectionLost: false,
        isSocketReconnected: true,
      } as ConnectionLostDetails);

      harness.expectSummaryStateCleared();
      expect(jest.getTimerCount()).toBe(0);

      dispatchFeatureEnablement(harness, {
        interactionId: 'interaction-1',
        postCallEnabled: false,
        midCallEnabled: true,
        actionTimeStamp: 5,
      });
      expect(triggerSpy).toHaveBeenLastCalledWith(AGENT_EVENTS.FEATURE_ENABLEMENT, {
        interactionId: 'interaction-1',
        postCallEnabled: false,
        midCallEnabled: true,
        actionTimeStamp: 5,
      });

      await webex.cc.deregister();

      harness.expectSummaryStateCleared();
      expect(jest.getTimerCount()).toBe(0);
      expect(harness.taskManager.listenerCount(AGENT_EVENTS.FEATURE_ENABLEMENT)).toBe(0);
      expect(harness.rtdWebSocketManager.listenerCount('message')).toBe(0);
      triggerSpy.mockClear();

      dispatchSentinelPostCallSummary(harness, 'queued-after-deregister');

      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 0,
        featureEnablement: 0,
      });
      expect(triggerSpy).not.toHaveBeenCalled();
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
        {
          eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
          dropReason: 'sdk-deregistered',
        },
        ['operational']
      );
      expectSentinelsNotObserved();
    });

    it('flushes a buffered receiving summary through real TaskManager task publication', () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();
      const interactionId = 'receiver-arrival-interaction';
      const conversationId = 'receiver-arrival-conversation';
      const receivingPayload = {
        conversationId,
        summaryText: sentinels[0],
        adaptiveCard: {body: [{text: sentinels[3]}]},
      };
      const receiverHandler = jest.fn();
      let publishedTask: Task | undefined;
      let receiverEmitSpy: jest.SpyInstance | undefined;

      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT, {
        ...receivingPayload,
      });

      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 1,
        featureEnablement: 0,
      });
      expect(jest.getTimerCount()).toBe(1);

      harness.taskManager.on(TASK_EVENTS.TASK_INCOMING, (task: Task) => {
        publishedTask = task;
        receiverEmitSpy = jest.spyOn(task, 'emit');
        task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, receiverHandler);
      });

      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_CONTACT_RESERVED, {
        interactionId,
        conversationId,
      });

      expect(publishedTask).toBe(harness.taskManager.getTask(interactionId));
      expect(publishedTask).toBeInstanceOf(Task);
      expect(receiverHandler).toHaveBeenCalledTimes(1);
      expect(receiverHandler).toHaveBeenCalledWith(receivingPayload);
      expect(
        receiverEmitSpy?.mock.calls.filter(
          ([eventName]) => eventName === TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT
        )
      ).toHaveLength(1);
      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 0,
        featureEnablement: 0,
      });
      expect(jest.getTimerCount()).toBe(0);
      expectSentinelsNotObserved();
    });

    it('resolves a real post-call request through RTD and keeps summary sentinels out of metrics', async () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();

      attachRtdMessageListener(harness.rtdWebSocketManager);
      webex.cc['refreshTaskManagerEventForwarders']();
      emitFeatureEnablement(harness);
      jest.clearAllMocks();

      const postCallRequest = harness.task.requestPostCallSummary();

      await flushMicrotasks();
      expect(harness.apiAIAssistant.sendSummaryGetEvent).toHaveBeenCalledWith(
        'agent-1',
        'interaction-1',
        'conversation-1',
        AIAssistantEventName.GET_POST_CALL_SUMMARY
      );
      emitSentinelPostCallSummary(harness);
      harness.transportDeferreds[0].resolve(undefined);

      await expect(postCallRequest).resolves.toMatchObject({
        conversationId: 'conversation-1',
        summaryText: sentinels[0],
      });
      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 0,
        featureEnablement: 1,
      });
      expect(jest.getTimerCount()).toBe(0);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
        expect.objectContaining({
          conversationId: 'conversation-1',
          interactionId: 'interaction-1',
        }),
        ['operational']
      );
      harness.taskManager.clearAISummaryState();
      harness.expectSummaryStateCleared();
      expectSentinelsNotObserved();
    });

    it('keeps post-call response context after real Task cleanup removes manager state', async () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();
      const interactionId = 'post-call-cleanup-interaction';
      const conversationId = 'post-call-cleanup-conversation';
      const coordinator = harness.getCoordinator();
      const getFeatureEnablementSpy = jest.spyOn(coordinator, 'getFeatureEnablement');
      const registerPendingAISummaryRequestSpy = jest.spyOn(
        coordinator,
        'registerPendingAISummaryRequest'
      );
      let applicationTask: Task | undefined;

      harness.taskManager.on(TASK_EVENTS.TASK_INCOMING, (task: Task) => {
        if (task.data.interactionId === interactionId) {
          applicationTask = task;
        }
      });
      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_CONTACT_RESERVED, {
        interactionId,
        conversationId,
      });
      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_CONTACT_ASSIGNED, {
        interactionId,
        conversationId,
      });

      expect(applicationTask).toBe(harness.taskManager.getTask(interactionId));
      const retainedTask = applicationTask as Task;

      dispatchFeatureEnablement(harness, {
        interactionId,
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimeStamp: 9,
      });

      const postCallRequest = retainedTask.requestPostCallSummary();

      await flushMicrotasks();
      expect(postCallRequest).toBeDefined();
      expect(harness.apiAIAssistant.sendSummaryGetEvent).toHaveBeenCalledWith(
        'agent-1',
        interactionId,
        conversationId,
        AIAssistantEventName.GET_POST_CALL_SUMMARY
      );
      harness.dispatchRtdFrame(CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, {
        conversationId,
        summaryText: sentinels[0],
      });
      harness.transportDeferreds[0].resolve(undefined);

      await expect(postCallRequest).resolves.toMatchObject({
        conversationId,
        summaryText: sentinels[0],
      });
      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 0,
        featureEnablement: 1,
      });

      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_WRAPUP, {
        interactionId,
        conversationId,
      });
      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_WRAPPEDUP, {
        interactionId,
        conversationId,
      });

      expect(harness.taskManager.getTask(interactionId)).toBeUndefined();
      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 0,
        featureEnablement: 0,
      });
      expect(jest.getTimerCount()).toBe(0);

      const featureGateCallsAfterRemoval = getFeatureEnablementSpy.mock.calls.length;
      const registrationCallsAfterRemoval = registerPendingAISummaryRequestSpy.mock.calls.length;

      retainedTask.updateTaskData(
        createAISummaryLifecycleTaskData({
          interactionId: 'post-call-response-current-interaction',
          conversationId: 'post-call-response-current-conversation',
        }),
        true
      );

      const responsePayload: PostCallSummaryResponsePayload = {
        summary: {initialContactReason: 'resolved'},
        feedback: 'thumbs_up',
        state: 'DEFAULT',
        wrapUpCode: 'resolved',
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        actionTimeStamp: 11,
        publishTimestamp: 12,
      };

      await expect(
        retainedTask.sendPostCallSummaryResponse(responsePayload)
      ).resolves.toBeUndefined();

      expect(getFeatureEnablementSpy).toHaveBeenCalledTimes(featureGateCallsAfterRemoval);
      expect(registerPendingAISummaryRequestSpy).toHaveBeenCalledTimes(
        registrationCallsAfterRemoval
      );
      expect(harness.apiAIAssistant.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
      expect(harness.apiAIAssistant.sendSummaryResponseEvent).toHaveBeenCalledWith('agent-1', {
        agentId: 'agent-1',
        interactionId,
        conversationId,
        eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        summary: {initialContactReason: 'resolved'},
        feedback: 'thumbs_up',
        wrapUpCode: 'resolved',
        actionTimeStamp: 11,
        publishTimestamp: 12,
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        state: 'DEFAULT',
      });
    });

    it('cancels initially unhandled real public requests on deregister and ignores late HTTP settlement', async () => {
      const harness = createSummaryHarness();
      const unhandledRejections: unknown[] = [];
      const unhandledRejectionListener = jest.fn((reason) => {
        unhandledRejections.push(reason);
      });

      attachRtdMessageListener(harness.rtdWebSocketManager);
      webex.cc['refreshTaskManagerEventForwarders']();
      emitFeatureEnablement(harness);
      jest.clearAllMocks();

      webex.cc.agentConfig = {
        agentId: 'agent-1',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
      };

      process.on('unhandledRejection', unhandledRejectionListener);
      try {
        const postCallRequest = harness.task.requestPostCallSummary();
        const midCallRequest = harness.task.requestMidCallSummary('CONSULT');

        await flushMicrotasks();
        expect(harness.transportDeferreds).toHaveLength(2);

        await webex.cc.deregister();
        await flushEventLoopTurn();

        expect(unhandledRejectionListener).not.toHaveBeenCalled();
        expect(unhandledRejections).toHaveLength(0);
        await expect(postCallRequest).rejects.toMatchObject({
          message: AI_SUMMARY_REQUEST_CANCELLED,
          data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
        });
        await expect(midCallRequest).rejects.toMatchObject({
          message: AI_SUMMARY_REQUEST_CANCELLED,
          data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
        });
        harness.expectSummaryStateCleared();

        const finalMetricCountAfterCancellation = countAISummaryRequestFinalMetrics();

        dispatchSentinelPostCallSummary(harness, 'queued-after-deregister');
        harness.transportDeferreds[0].resolve(undefined);
        harness.transportDeferreds[1].reject(new Error('late-http-rejected-after-deregister'));
        await flushEventLoopTurn();

        expect(unhandledRejectionListener).not.toHaveBeenCalled();
        expect(unhandledRejections).toHaveLength(0);
        expect(countAISummaryRequestFinalMetrics()).toBe(finalMetricCountAfterCancellation);
        harness.expectSummaryStateCleared();
        expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
          {
            eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
            dropReason: 'sdk-deregistered',
          },
          ['operational']
        );
        expectSentinelsNotObserved();
      } finally {
        process.off('unhandledRejection', unhandledRejectionListener);
        harness.taskManager.clearAISummaryState();
      }
    });

    it('clears and reapplies AI summary config before reconnection relogin', async () => {
      const silentReloginSpy = jest
        .spyOn(webex.cc as any, 'silentRelogin')
        .mockResolvedValue(undefined);
      const aiFeature = {
        generatedSummaries: {
          wrapUpSummariesEnabled: true,
          consultTransferSummariesEnabled: true,
        },
      };

      webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
      webex.cc.agentConfig = {
        isEndTaskEnabled: true,
        isEndConsultEnabled: false,
        webRtcEnabled: true,
        wrapUpData: {wrapUpProps: {autoWrapup: true}},
        aiFeature,
      } as any;

      await webex.cc['handleConnectionLost']({
        isConnectionLost: false,
        isSocketReconnected: true,
      } as ConnectionLostDetails);

      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
      expect(mockTaskManager.setConfigFlags).toHaveBeenCalledWith({
        isEndTaskEnabled: true,
        isEndConsultEnabled: false,
        webRtcEnabled: true,
        autoWrapup: true,
        aiFeature,
      });
      expect(mockTaskManager.clearAISummaryState.mock.invocationCallOrder[0]).toBeLessThan(
        mockTaskManager.setConfigFlags.mock.invocationCallOrder[0]
      );
      expect(mockTaskManager.setConfigFlags.mock.invocationCallOrder[0]).toBeLessThan(
        silentReloginSpy.mock.invocationCallOrder[0]
      );
    });

    it('clears and reapplies AI summary config when automated relogin is disabled', async () => {
      const silentReloginSpy = jest
        .spyOn(webex.cc as any, 'silentRelogin')
        .mockResolvedValue(undefined);
      const aiFeature = {
        generatedSummaries: {
          wrapUpSummariesEnabled: false,
          consultTransferSummariesEnabled: true,
        },
      };

      webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
      webex.cc.agentConfig = {
        isEndTaskEnabled: false,
        isEndConsultEnabled: true,
        webRtcEnabled: false,
        wrapUpData: {},
        aiFeature,
      } as any;

      await webex.cc['handleConnectionLost']({
        isConnectionLost: false,
        isSocketReconnected: true,
      } as ConnectionLostDetails);

      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
      expect(mockTaskManager.setConfigFlags).toHaveBeenCalledWith({
        isEndTaskEnabled: false,
        isEndConsultEnabled: true,
        webRtcEnabled: false,
        autoWrapup: false,
        aiFeature,
      });
      expect(mockTaskManager.clearAISummaryState.mock.invocationCallOrder[0]).toBeLessThan(
        mockTaskManager.setConfigFlags.mock.invocationCallOrder[0]
      );
      expect(silentReloginSpy).not.toHaveBeenCalled();
    });

    it.each([null, undefined])(
      'clears reconnect state without config reapply when agentConfig is %s',
      async (agentConfig) => {
        const silentReloginSpy = jest
          .spyOn(webex.cc as any, 'silentRelogin')
          .mockResolvedValue(undefined);
        const unhandledRejections: unknown[] = [];
        const unhandledRejectionListener = jest.fn((reason) => {
          unhandledRejections.push(reason);
        });

        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
        webex.cc.agentConfig = agentConfig as any;

        process.on('unhandledRejection', unhandledRejectionListener);
        try {
          await expect(
            webex.cc['handleConnectionLost']({
              isConnectionLost: false,
              isSocketReconnected: true,
            } as ConnectionLostDetails)
          ).resolves.toBeUndefined();
          await flushEventLoopTurn();

          expect(mockTaskManager.clearAISummaryState).toHaveBeenCalledTimes(1);
          expect(mockTaskManager.setConfigFlags).not.toHaveBeenCalled();
          expect(silentReloginSpy).toHaveBeenCalledTimes(1);
          expect(unhandledRejectionListener).not.toHaveBeenCalled();
          expect(unhandledRejections).toHaveLength(0);
        } finally {
          process.off('unhandledRejection', unhandledRejectionListener);
        }
      }
    );
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
        loginVoiceOptions: ['BROWSER', 'EXTENSION', 'AGENT_DN'],
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
            chat: ['25d8ggg7-4821-7de7-b626-36437adec509', '14e7fff7-7de7-4821-a919-36437adec509'],
            email: [
              '14e7fff7-7de7-4821-a919-36437adec509',
              '14e7fff7-7de7-4821-a919-36437adec509',
              '14e7fff7-7de7-4821-a919-36437adec509',
            ],
            social: [],
            telephony: ['14e7fff7-7de7-4821-a919-36437adec509'],
          },
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
          telephony: 1,
        },
        notifsTrackingId: 'notifs_52628',
      };

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

      expect(mockMetricsManager.timeEvent).toBeCalledWith([
        METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS,
        METRIC_EVENT_NAMES.STATION_LOGIN_FAILED,
      ]);
      expect(result).toEqual(responseMock);

      const onSpy = jest.spyOn(mockTaskManager, 'on');
      const emitSpy = jest.spyOn(webex.cc, 'trigger');
      const ccEmitSpy = jest.spyOn(webex.cc, 'emit');
      const incomingCallCb = onSpy.mock.calls[0][1];

      expect(onSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, incomingCallCb);

      incomingCallCb(mockTask);

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, mockTask);
      // Verify websocket message handling
      const messageCallback = webex.cc['handleWebsocketMessage'];
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

      expect(ccEmitSpy).toHaveBeenCalledWith(
        AGENT_EVENTS.AGENT_STATE_CHANGE,
        agentStateChangeEventData.data
      );

      // Simulate receiving a message event
      messageCallback(JSON.stringify(agentMultiLoginEventData));

      expect(ccEmitSpy).toHaveBeenCalledWith(
        AGENT_EVENTS.AGENT_MULTI_LOGIN,
        agentMultiLoginEventData.data
      );
    });

    it('should skip web calling line registration when disableWebRTCRegistration is enabled', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.$config = {
        ...webex.cc.$config,
        disableWebRTCRegistration: true,
      };
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: true,
        loginVoiceOptions: ['BROWSER', 'EXTENSION', 'AGENT_DN'],
      };

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          loginOption: LoginOption.BROWSER,
          agentId: 'agentId',
          teamId: 'teamId',
          siteId: 'siteId',
          roles: [AGENT],
          channelsMap: {
            chat: [],
            email: [],
            social: [],
            telephony: [],
          },
        },
        trackingId: 'notifs_52628',
        orgId: 'orgId',
        type: 'StationLoginSuccess',
        eventType: 'STATION_LOGIN',
      } as unknown as StationLoginSuccess);

      await webex.cc.stationLogin(options);

      expect(registerWebCallingLineSpy).not.toHaveBeenCalled();
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Skipping web calling line registration because disableWebRTCRegistration is enabled',
        {
          module: CC_FILE,
          method: 'stationLogin',
        }
      );
    });

    it('should not attempt mobius registration for LoginOption.BROWSER if webrtc is disabled', async () => {
      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      };

      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
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
            chat: ['25d8ggg7-4821-7de7-b626-36437adec509', '14e7fff7-7de7-4821-a919-36437adec509'],
            email: [],
            social: [],
            telephony: ['14e7fff7-7de7-4821-a919-36437adec509'],
          },
        },
        trackingId: '1234',
        orgId: 'orgId',
        type: 'StationLoginSuccess',
        eventType: 'STATION_LOGIN',
      };

      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );

      const stationLoginSpy = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue(mockData as unknown as StationLoginSuccess);

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
        webRtcEnabled: true,
      };

      const options = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '12345678901',
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
            chat: ['25d8ggg7-4821-7de7-b626-36437adec509', '14e7fff7-7de7-4821-a919-36437adec509'],
            email: [
              '14e7fff7-7de7-4821-a919-36437adec509',
              '14e7fff7-7de7-4821-a919-36437adec509',
              '14e7fff7-7de7-4821-a919-36437adec509',
            ],
            social: [],
            telephony: ['14e7fff7-7de7-4821-a919-36437adec509'],
          },
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
          telephony: 1,
        },
        notifsTrackingId: 'notifs_52628',
      };

      const stationLoginMock = jest
        .spyOn(webex.cc.services.agent, 'stationLogin')
        .mockResolvedValue(mockData as unknown as StationLoginSuccess);

      const result = await webex.cc.stationLogin(options);

      // Verify logging calls
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Starting agent station login | loginOption: ${options.loginOption} teamId: ${options.teamId}`,
        {
          module: CC_FILE,
          method: 'stationLogin',
        }
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Agent station login completed successfully agentId: ${mockData.data.agentId} loginOption: ${mockData.data.loginOption} teamId: ${mockData.data.teamId}`,
        {
          module: CC_FILE,
          method: 'stationLogin',
          trackingId: mockData.trackingId,
        }
      );

      expect(stationLoginMock).toHaveBeenCalledWith({
        data: {
          dialNumber: '12345678901',
          teamId: 'teamId',
          deviceType: LoginOption.AGENT_DN,
          isExtension: false,
          deviceId: '12345678901',
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
        webRtcEnabled: true,
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

      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Starting agent station login | loginOption: ${options.loginOption} teamId: ${options.teamId}`,
        {
          module: CC_FILE,
          method: 'stationLogin',
        }
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `stationLogin failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'stationLogin', trackingId: error.details.trackingId}
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
      // SPARK-626777 tracks moving listener cleanup into the future de-register API.
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
        METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
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
        {module: CC_FILE, method: 'stationLogout', trackingId: error.details.trackingId}
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
        .mockResolvedValue({data: expectedPayload});

      const result = await webex.cc.setAgentState(expectedPayload);

      // Verify logging calls
      expect(LoggerProxy.info).toHaveBeenCalledWith('Setting agent state', {
        module: CC_FILE,
        method: 'setAgentState',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Agent state changed successfully to auxCodeId: ${expectedPayload.auxCodeId}`,
        {
          module: CC_FILE,
          method: 'setAgentState',
        }
      );

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual({data: expectedPayload});
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
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
      expect(result).toEqual({data: expectedPayload});
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Agent state changed successfully to auxCodeId: ${expectedPayload.auxCodeId}`,
        {
          module: CC_FILE,
          method: 'setAgentState',
        }
      );
      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload});
      expect(result).toEqual({data: expectedPayload});
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
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
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Successfully retrieved ${buddyAgentsResponse.data.agentList.length} buddy agents`,
        {
          module: CC_FILE,
          method: 'getBuddyAgents',
          trackingId: buddyAgentsResponse.trackingId,
        }
      );

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {agentProfileId: 'test-agent-profile-id', ...data},
      });

      expect(result).toEqual(buddyAgentsResponse);
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS,
        METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED,
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

      const setLoginOptionSpy = jest.spyOn(webex.cc.webCallingService, 'setLoginOption');
      const eventForwarderRefreshSpy = jest.spyOn(
        webex.cc,
        'refreshTaskManagerEventForwarders'
      );
      const webSocketManagerOnSpy = jest.spyOn(webex.cc.services.webSocketManager, 'on');
      await webex.cc['silentRelogin']();

      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'event=requestAutoStateChange | Requesting state change to available on socket reconnect',
        {module: CC_FILE, method: 'silentRelogin'}
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Silent relogin process completed successfully with login Option: ${mockReLoginResponse.data.deviceType} teamId: ${mockReLoginResponse.data.teamId}`,
        {
          module: CC_FILE,
          method: 'silentRelogin',
        }
      );
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
      // SPARK-626777 tracks moving listener cleanup into the future de-register API.
      // expect(eventForwarderRefreshSpy).toHaveBeenCalled();
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
      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting silent relogin process', {
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
      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `silentRelogin failed with reason: Error while performing silentRelogin`,
        {
          module: CC_FILE,
          method: 'silentRelogin',
          trackingId: undefined,
        }
      );
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

      expect(LoggerProxy.log).toHaveBeenCalledWith('Starting silent relogin process', {
        module: CC_FILE,
        method: 'silentRelogin',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Silent relogin process completed successfully with login Option: ${mockReLoginResponse.data.deviceType} teamId: ${mockReLoginResponse.data.teamId}`,
        {
          module: CC_FILE,
          method: 'silentRelogin',
        }
      );

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

      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith(
        'connectionLost',
        webex.cc['handleConnectionLost']
      );
      expect(connectionServiceOnSpy).toHaveBeenCalledWith(
        'connectionLost',
        webex.cc['handleConnectionLost']
      );
      expect(
        webex.cc.services.connectionService.off.mock.invocationCallOrder[0]
      ).toBeLessThan(connectionServiceOnSpy.mock.invocationCallOrder[0]);
    });

    it('uses one detachable connectionLost listener across repeated setup and deregister', async () => {
      const connectionService = new EventEmitterDouble();

      webex.cc.services.connectionService = connectionService as any;
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
      };

      webex.cc.setupEventListeners();
      webex.cc.setupEventListeners();

      expect(connectionService.listenerCount('connectionLost')).toBe(1);
      expect(connectionService.listeners('connectionLost')[0]).toBe(
        webex.cc['handleConnectionLost']
      );

      await webex.cc.deregister();

      expect(connectionService.listenerCount('connectionLost')).toBe(0);
      expect(connectionService.off).toHaveBeenCalledWith(
        'connectionLost',
        webex.cc['handleConnectionLost']
      );
    });
  });

  describe('startOutdial', () => {
    it('should make outdial call successfully without origin.', async () => {
      // Setup outDialEp.
      webex.cc.agentConfig = {
        outDialEp: 'test-entry-point',
      };

      // destination number required for making outdial call.
      const destination = '1234567890';

      // Construct Payload for startOutdial without origin.
      const newPayload = {
        destination,
        origin: undefined,
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

    it('should make outdial call successfully with origin.', async () => {
      // Setup outDialEp.
      webex.cc.agentConfig = {
        outDialEp: 'test-entry-point',
      };

      // destination number and origin for making outdial call.
      const destination = '1234567890';
      const origin = '+19403016307';

      // Construct Payload for startOutdial with origin.
      const newPayload = {
        destination,
        origin,
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

      const result = await webex.cc.startOutdial(destination, origin);

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
      expect(mockWebexRequest.uploadLogs).toHaveBeenCalledWith({
        correlationId: error.details.trackingId,
      });
    });
  });

  describe('getQueues', () => {
    it('delegates to the queue service when successful', async () => {
      const mockQueuesResponse = [{queueId: 'queue1', queueName: 'Queue 1'}];
      const queueSpy = jest
        .spyOn(webex.cc.queue, 'getQueues')
        .mockResolvedValue(mockQueuesResponse as any);

      const result = await webex.cc.getQueues({page: 1});

      expect(queueSpy).toHaveBeenCalledWith({page: 1});
      expect(result).toBe(mockQueuesResponse);
    });

    it('propagates queue service errors', async () => {
      const error = new Error('Test error.');
      jest.spyOn(webex.cc.queue, 'getQueues').mockRejectedValue(error);

      await expect(webex.cc.getQueues()).rejects.toThrow('Test error.');
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
    let mockRTDWebSocketManager;
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
      mockRTDWebSocketManager = {
        isSocketClosed: false,
        close: jest.fn(),
        off: jest.fn(),
        on: jest.fn(),
      };

      webex.cc.services.webSocketManager = mockWebSocketManager;
      webex.cc.services.rtdWebSocketManager = mockRTDWebSocketManager;

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

    afterEach(() => {
      mockTaskManager.off.mockImplementation(() => undefined);
      mockTaskManager.clearAISummaryState.mockImplementation(() => undefined);
      mockRTDWebSocketManager.off.mockImplementation(() => undefined);
      mockRTDWebSocketManager.close.mockImplementation(() => undefined);
    });

    it('should unregister successfully and clean up all resources when webrtc is enabled', async () => {
      webex.cc.services.rtdWebSocketManager = {
        isSocketClosed: false,
        close: jest.fn(),
        off: jest.fn(),
        on: jest.fn(),
      } as any;

      await webex.cc.deregister();

      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        AGENT_EVENTS.FEATURE_ENABLEMENT,
        webex.cc['handleFeatureEnablement']
      );
      expect(mockWebSocketManager.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.rtdWebSocketManager.off).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith(
        'connectionLost',
        expect.any(Function)
      );

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledWith(
        false,
        'Unregistering the SDK'
      );
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledTimes(1);
      expect(webex.cc.agentConfig).toBeNull();

      expect(webex.internal.mercury.off).toHaveBeenCalledWith('online');
      expect(webex.internal.mercury.off).toHaveBeenCalledWith('offline');
      expect(mercuryDisconnectSpy).toHaveBeenCalled();
      expect(deviceUnregisterSpy).toHaveBeenCalled();

      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
      ]);
      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
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
      expect(incomingCalls.length).toBeGreaterThanOrEqual(1);
      const [, incomingCallback] = incomingCalls[incomingCalls.length - 1];
      expect(incomingCallback).toBe(webex.cc['handleIncomingTask']);

      const hydrateCalls = mockTaskManager.off.mock.calls.filter(
        ([evt]) => evt === TASK_EVENTS.TASK_HYDRATE
      );
      expect(hydrateCalls.length).toBeGreaterThanOrEqual(1);
      const [, hydrateCallback] = hydrateCalls[hydrateCalls.length - 1];
      expect(hydrateCallback).toBe(webex.cc['handleTaskHydrate']);

      const multiLoginHydrateCalls = mockTaskManager.off.mock.calls.filter(
        ([evt]) => evt === TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE
      );
      expect(multiLoginHydrateCalls.length).toBeGreaterThanOrEqual(1);
      const [, multiLoginHydrateCallback] =
        multiLoginHydrateCalls[multiLoginHydrateCalls.length - 1];
      expect(multiLoginHydrateCallback).toBe(webex.cc['handleTaskMultiLoginHydrate']);

      const messageCalls = mockWebSocketManager.off.mock.calls.filter(([evt]) => evt === 'message');
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

      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
        expect.any(Function)
      );
      expect(mockWebSocketManager.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith(
        'connectionLost',
        expect.any(Function)
      );

      expect(webex.internal.mercury.off).not.toHaveBeenCalled();
      expect(mercuryDisconnectSpy).not.toHaveBeenCalled();
      expect(deviceUnregisterSpy).not.toHaveBeenCalled();
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledTimes(1);
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
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledTimes(1);
      expect(webex.cc.agentConfig).toBeNull();
    });

    it('removes feature enablement handler after earlier teardown rejection', async () => {
      const mockError = new Error('Failed to remove task listener');

      mockTaskManager.off.mockImplementation((eventName) => {
        if (eventName === TASK_EVENTS.TASK_HYDRATE) {
          throw mockError;
        }
      });

      await expect(webex.cc.deregister()).rejects.toThrow('Failed to remove task listener');

      expect(mockTaskManager.off).toHaveBeenCalledWith(
        AGENT_EVENTS.FEATURE_ENABLEMENT,
        webex.cc['handleFeatureEnablement']
      );
      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
      expect(webex.cc.services.rtdWebSocketManager.off).toHaveBeenCalledWith(
        'message',
        webex.cc['handleRTDWebsocketMessage']
      );
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledWith(
        false,
        'Unregistering the SDK'
      );
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: 'AI summary state clear',
        message: 'Failed to clear AI summary state',
        fail: (error: Error) => {
          mockTaskManager.clearAISummaryState.mockImplementation(() => {
            throw error;
          });
        },
      },
      {
        name: 'feature enablement listener removal',
        message: 'Failed to remove feature listener',
        fail: (error: Error) => {
          mockTaskManager.off.mockImplementation((eventName) => {
            if (eventName === AGENT_EVENTS.FEATURE_ENABLEMENT) {
              throw error;
            }
          });
        },
      },
      {
        name: 'RTD message listener removal',
        message: 'Failed to remove RTD message listener',
        fail: (error: Error) => {
          mockRTDWebSocketManager.off.mockImplementation(() => {
            throw error;
          });
        },
      },
      {
        name: 'RTD websocket close',
        message: 'Failed to close RTD websocket',
        fail: (error: Error) => {
          mockRTDWebSocketManager.close.mockImplementation(() => {
            throw error;
          });
        },
      },
    ])('runs every cleanup step and surfaces the first cleanup error from $name', async (testCase) => {
      const cleanupError = new Error(testCase.message);

      testCase.fail(cleanupError);

      try {
        await expect(webex.cc.deregister()).rejects.toThrow(testCase.message);

        expect(mockTaskManager.clearAISummaryState).toHaveBeenCalledTimes(1);
        expect(mockTaskManager.off).toHaveBeenCalledWith(
          AGENT_EVENTS.FEATURE_ENABLEMENT,
          webex.cc['handleFeatureEnablement']
        );
        expect(mockRTDWebSocketManager.off).toHaveBeenCalledWith(
          'message',
          webex.cc['handleRTDWebsocketMessage']
        );
        expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');

        const failureMetrics = mockMetricsManager.trackEvent.mock.calls.filter(
          ([eventName]) => eventName === METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL
        );
        const successMetrics = mockMetricsManager.trackEvent.mock.calls.filter(
          ([eventName]) => eventName === METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS
        );

        expect(failureMetrics).toEqual([
          [
            METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
            {error: testCase.message},
            ['operational'],
          ],
        ]);
        expect(successMetrics).toHaveLength(0);
      } finally {
        mockTaskManager.clearAISummaryState.mockImplementation(() => undefined);
        mockTaskManager.off.mockImplementation(() => undefined);
        mockRTDWebSocketManager.off.mockImplementation(() => undefined);
        mockRTDWebSocketManager.close.mockImplementation(() => undefined);
      }
    });

    it('preserves the primary deregistration error when cleanup steps also fail', async () => {
      const primaryError = new Error('Failed to remove task listener');
      const cleanupErrors = {
        clear: new Error('Cleanup clear failed'),
        featureOff: new Error('Cleanup feature off failed'),
        rtdOff: new Error('Cleanup RTD off failed'),
        rtdClose: new Error('Cleanup RTD close failed'),
      };

      mockTaskManager.clearAISummaryState.mockImplementation(() => {
        throw cleanupErrors.clear;
      });
      mockTaskManager.off.mockImplementation((eventName) => {
        if (eventName === TASK_EVENTS.TASK_HYDRATE) {
          throw primaryError;
        }
        if (eventName === AGENT_EVENTS.FEATURE_ENABLEMENT) {
          throw cleanupErrors.featureOff;
        }
      });
      mockRTDWebSocketManager.off.mockImplementation(() => {
        throw cleanupErrors.rtdOff;
      });
      mockRTDWebSocketManager.close.mockImplementation(() => {
        throw cleanupErrors.rtdClose;
      });

      try {
        await expect(webex.cc.deregister()).rejects.toThrow(primaryError.message);

        expect(mockTaskManager.clearAISummaryState).toHaveBeenCalledTimes(1);
        expect(mockTaskManager.off).toHaveBeenCalledWith(
          AGENT_EVENTS.FEATURE_ENABLEMENT,
          webex.cc['handleFeatureEnablement']
        );
        expect(mockRTDWebSocketManager.off).toHaveBeenCalledWith(
          'message',
          webex.cc['handleRTDWebsocketMessage']
        );
        expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, 'Unregistering the SDK');

        const failureMetrics = mockMetricsManager.trackEvent.mock.calls.filter(
          ([eventName]) => eventName === METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL
        );

        expect(failureMetrics).toEqual([
          [
            METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
            {error: primaryError.message},
            ['operational'],
          ],
        ]);
      } finally {
        mockTaskManager.clearAISummaryState.mockImplementation(() => undefined);
        mockTaskManager.off.mockImplementation(() => undefined);
        mockRTDWebSocketManager.off.mockImplementation(() => undefined);
        mockRTDWebSocketManager.close.mockImplementation(() => undefined);
      }
    });

    it.each([undefined, null, 0, ''])(
      'preserves a falsy primary deregistration failure value %p',
      async (thrownValue) => {
        mockTaskManager.off.mockImplementation((eventName) => {
          if (eventName === TASK_EVENTS.TASK_INCOMING) {
            throw thrownValue;
          }
        });

        const rejectedValue = await webex.cc.deregister().then(
          () => Symbol('unexpected-success'),
          (error) => error
        );

        expect(rejectedValue).toBe(thrownValue);
        expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
          {error: UNKNOWN_ERROR},
          ['operational']
        );
        expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
          expect.anything(),
          expect.anything()
        );
      }
    );

    it.each([undefined, null, 0, ''])(
      'preserves a falsy cleanup failure value %p',
      async (thrownValue) => {
        mockTaskManager.clearAISummaryState.mockImplementation(() => {
          throw thrownValue;
        });

        const rejectedValue = await webex.cc.deregister().then(
          () => Symbol('unexpected-success'),
          (error) => error
        );

        expect(rejectedValue).toBe(thrownValue);
        expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
          {error: UNKNOWN_ERROR},
          ['operational']
        );
        expect(mockMetricsManager.trackEvent).not.toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS,
          expect.anything(),
          expect.anything()
        );
      }
    );

    it('uses the bounded unknown-error message for an empty Error message', async () => {
      mockTaskManager.off.mockImplementation((eventName) => {
        if (eventName === TASK_EVENTS.TASK_INCOMING) {
          throw new Error('');
        }
      });

      await expect(webex.cc.deregister()).rejects.toThrow('');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_FAIL,
        {error: UNKNOWN_ERROR},
        ['operational']
      );
    });

    it('should handle errors during unregister and track metrics', async () => {
      const mockError = new Error('Failed to deregister device');
      webex.internal.device.unregister.mockRejectedValue(mockError);

      await expect(webex.cc.deregister()).rejects.toThrow('Failed to deregister device');

      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_INCOMING,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_HYDRATE,
        expect.any(Function)
      );
      expect(mockTaskManager.off).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
        expect.any(Function)
      );

      expect(LoggerProxy.error).toHaveBeenCalledWith(`Error during deregister: ${mockError}`, {
        module: CC_FILE,
        method: 'deregister',
      });
      expect(mockTaskManager.clearAISummaryState).toHaveBeenCalled();
      expect(webex.cc.services.rtdWebSocketManager.off).toHaveBeenCalledWith(
        'message',
        webex.cc['handleRTDWebsocketMessage']
      );

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
      messageCallback = webex.cc['handleWebsocketMessage'];
    });

    it('should emit AGENT_STATION_LOGIN_SUCCESS on CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS with mapped payload', () => {
      const channelsMap = {chat: ['c1', 'c2'], email: [], social: ['s1'], telephony: []};
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

      expect(emitSpy).toHaveBeenNthCalledWith(2, AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, {
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
      });
    });

    it('should emit AGENT_RELOGIN_SUCCESS on CC_EVENTS.AGENT_RELOGIN_SUCCESS with mapped payload', () => {
      const channelsMap = {chat: ['a', 'b'], email: [], social: ['x'], telephony: ['y', 'z']};
      const payload = {
        trackingId: 'trk-relogin',
        data: {
          agentId: 'agent-re',
          teamId: 'team-re',
          siteId: 'site-re',
          roles: ['r1', 'r2'],
          channelsMap,
          type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
        },
        type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
      };

      messageCallback(JSON.stringify(payload));

      expect(emitSpy).toHaveBeenNthCalledWith(2, AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, {
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
      });
    });

    [
      {
        ccEvent: CC_EVENTS.AGENT_STATION_LOGIN_FAILED,
        constant: AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED,
      },
      {ccEvent: CC_EVENTS.AGENT_LOGOUT_SUCCESS, constant: AGENT_EVENTS.AGENT_LOGOUT_SUCCESS},
      {ccEvent: CC_EVENTS.AGENT_LOGOUT_FAILED, constant: AGENT_EVENTS.AGENT_LOGOUT_FAILED},
      {ccEvent: CC_EVENTS.AGENT_DN_REGISTERED, constant: AGENT_EVENTS.AGENT_DN_REGISTERED},
      {
        ccEvent: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
        constant: AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
      },
      {
        ccEvent: CC_EVENTS.AGENT_STATE_CHANGE_FAILED,
        constant: AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED,
      },
    ].forEach(({ccEvent, constant}) => {
      it(`should emit ${constant} on ${ccEvent}`, () => {
        const sample = {foo: 'bar', type: ccEvent};
        messageCallback(JSON.stringify({type: ccEvent, data: sample}));
        expect(emitSpy).toHaveBeenCalledWith(constant, sample);
      });
    });

    it('should call webCallingService.setLoginOption with correct deviceType on AGENT_STATION_LOGIN_SUCCESS', () => {
      const setLoginOptionSpy = jest.spyOn(webex.cc.webCallingService, 'setLoginOption');
      const deviceType = LoginOption.EXTENSION;
      const payload = {
        trackingId: 'track-123',
        data: {
          agentId: 'agent-id',
          teamId: 'team-id',
          siteId: 'site-id',
          roles: ['role1', 'role2'],
          channelsMap: {chat: [], email: [], social: [], telephony: []},
          deviceType,
          type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
        },
        type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
      };

      messageCallback(JSON.stringify(payload));

      expect(setLoginOptionSpy).toHaveBeenCalledWith(deviceType);
    });
  });

  describe('API property exposure', () => {
    it('should provide getEntryPoints wrapper that delegates to EntryPoint', async () => {
      const spy = jest
        .spyOn(EntryPoint.prototype, 'getEntryPoints')
        .mockResolvedValue({} as EntryPointListResponse);
      await webex.cc.getEntryPoints();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should expose addressBook API', () => {
      expect(webex.cc.addressBook).toBeDefined();
      expect(webex.cc.addressBook).toBeInstanceOf(AddressBook);
    });

    it('should provide getQueues wrapper that delegates to Queue', async () => {
      const spy = jest
        .spyOn(Queue.prototype, 'getQueues')
        .mockResolvedValue({} as ContactServiceQueuesResponse);
      await webex.cc.getQueues();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
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
      expect(LoggerProxy.info).toHaveBeenCalledWith(`starting profile update`, {
        module: CC_FILE,
        method: 'updateAgentProfile',
        trackingId: 'WX_CC_SDK_mock-tracking-uuid',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `profile updated successfully with ${data.loginOption} teamId: ${data.teamId}`,
        {
          module: CC_FILE,
          method: 'updateAgentProfile',
          trackingId: 'WX_CC_SDK_mock-tracking-uuid',
        }
      );

      expect(webex.cc.stationLogout).toHaveBeenCalledWith({
        logoutReason: 'User requested agent profile update',
      });
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
        ...({} as any),
        type: 'AgentDeviceTypeUpdateSuccess',
      };
      jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      const loginSpy = jest.spyOn(webex.cc, 'stationLogin').mockResolvedValue(mockResp);

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
      expect(logSpy).toHaveBeenCalledWith(`error updating profile: ${err}`, {
        module: CC_FILE,
        method: 'updateAgentProfile',
        trackingId: 'WX_CC_SDK_mock-tracking-uuid',
      });
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
      expect(logSpy).toHaveBeenCalledWith(`error updating profile: ${loginErr}`, {
        module: CC_FILE,
        method: 'updateAgentProfile',
        trackingId: 'WX_CC_SDK_mock-tracking-uuid',
      });
    });

    it('should allow update when loginOption and teamId are unchanged (e.g. dialNumber or profile refresh)', async () => {
      webex.cc.webCallingService.loginOption = LoginOption.AGENT_DN;
      const data = {
        teamId: 'teamId',
        loginOption: LoginOption.AGENT_DN,
        dialNumber: '1234',
      };
      const logoutSpy = jest.spyOn(webex.cc, 'stationLogout').mockResolvedValue({});
      const loginSpy = jest.spyOn(webex.cc, 'stationLogin').mockResolvedValue({
        type: 'AgentDeviceTypeUpdateSuccess',
      } as any);

      await expect(webex.cc.updateAgentProfile(data)).resolves.toBeDefined();
      expect(logoutSpy).toHaveBeenCalledWith({
        logoutReason: 'User requested agent profile update',
      });
      expect(loginSpy).toHaveBeenCalledWith({
        teamId: data.teamId,
        loginOption: data.loginOption,
        dialNumber: data.dialNumber,
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

  describe('getOutdialAniEntries', () => {
    const mockOutdialANI = 'ani-123-456';
    const mockParams = {
      outdialANI: mockOutdialANI,
      page: 0,
      pageSize: 10,
      search: 'test',
      filter: 'active=true',
      attributes: 'id,name,number',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Reset orgId mock to return valid value
      webex.credentials.getOrgId.mockReturnValue('mockOrgId');
    });

    it('should successfully fetch outdial ANI entries and track success metrics', async () => {
      const mockResult = [
        {
          id: '142fba3c-8502-4446-bf6e-584fd657553a',
          name: 'Test Entry',
          number: '+19403016307',
        },
        {
          id: '6f53000b-e04a-4418-9de9-ba511d2367cb',
          name: 'Another Entry',
          number: '+19403016308',
        },
      ];

      // Mock the service call to return successful result
      webex.cc.services.config.getOutdialAniEntries.mockResolvedValue(mockResult);

      const result = await webex.cc.getOutdialAniEntries(mockParams);

      // Verify the service was called with correct parameters
      expect(webex.cc.services.config.getOutdialAniEntries).toHaveBeenCalledWith('mockOrgId', {
        outdialANI: mockOutdialANI,
        page: 0,
        pageSize: 10,
        search: 'test',
        filter: 'active=true',
        attributes: 'id,name,number',
      });

      // Verify the result is returned correctly
      expect(result).toEqual(mockResult);

      // Verify success metrics are tracked
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_SUCCESS,
        {
          outdialANI: mockOutdialANI,
          resultCount: 2,
        },
        ['behavioral', 'business', 'operational']
      );

      // Verify success logging
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Successfully retrieved outdial ANI entries for ANI ID ${mockOutdialANI}`,
        {
          module: CC_FILE,
          method: 'getOutdialAniEntries',
        }
      );
    });

    it('should handle empty results and track success metrics with zero count', async () => {
      const mockResult = [];

      // Mock the service call to return empty result
      webex.cc.services.config.getOutdialAniEntries.mockResolvedValue(mockResult);

      const result = await webex.cc.getOutdialAniEntries({outdialANI: mockOutdialANI});

      // Verify the result is returned correctly
      expect(result).toEqual(mockResult);

      // Verify success metrics are tracked with zero count
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_SUCCESS,
        {
          outdialANI: mockOutdialANI,
          resultCount: 0,
        },
        ['behavioral', 'business', 'operational']
      );
    });

    it('should handle undefined results and track success metrics with zero count', async () => {
      // Mock the service call to return undefined
      webex.cc.services.config.getOutdialAniEntries.mockResolvedValue(undefined);

      const result = await webex.cc.getOutdialAniEntries({outdialANI: mockOutdialANI});

      // Verify the result is returned correctly
      expect(result).toBeUndefined();

      // Verify success metrics are tracked with zero count
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_SUCCESS,
        {
          outdialANI: mockOutdialANI,
          resultCount: 0,
        },
        ['behavioral', 'business', 'operational']
      );
    });

    it('should handle service failure and track failure metrics', async () => {
      const mockError = new Error('Service unavailable') as any;
      mockError.details = {
        trackingId: 'test-tracking-id',
        orgId: 'mockOrgId',
        type: 'OutdialAniEntriesFailed',
        data: {
          reason: 'Detailed service error',
        },
      };

      // Mock the service call to throw an error
      webex.cc.services.config.getOutdialAniEntries.mockRejectedValue(mockError);

      await expect(webex.cc.getOutdialAniEntries(mockParams)).rejects.toThrow(
        'Detailed service error'
      );

      // Verify failure metrics are tracked
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_FAILED,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(mockError.details),
          outdialANI: mockOutdialANI,
          error: mockError,
        },
        ['behavioral', 'business', 'operational']
      );

      // Verify error logging
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `Failed to fetch outdial ANI entries for ANI ID ${mockOutdialANI} due to: ${mockError}`,
        {
          module: CC_FILE,
          method: 'getOutdialAniEntries',
          trackingId: 'test-tracking-id',
        }
      );
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'getOutdialAniEntries failed with reason: Detailed service error',
        {
          module: CC_FILE,
          method: 'getOutdialAniEntries',
          trackingId: 'test-tracking-id',
        }
      );

      // Verify getErrorDetails was called
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(mockError, 'getOutdialAniEntries', CC_FILE);
      expect(mockWebexRequest.uploadLogs).toHaveBeenCalledWith({
        correlationId: 'test-tracking-id',
      });
    });

    it('should throw error when orgId is not found', async () => {
      // Mock getOrgId to return null
      webex.credentials.getOrgId.mockReturnValue(null);

      await expect(webex.cc.getOutdialAniEntries(mockParams)).rejects.toThrow('Org ID not found.');

      // Verify error logging
      expect(LoggerProxy.error).toHaveBeenCalledWith('Org ID not found.', {
        module: CC_FILE,
        method: 'getOutdialAniEntries',
      });

      // Verify service was not called
      expect(webex.cc.services.config.getOutdialAniEntries).not.toHaveBeenCalled();

      // Verify no metrics were tracked
      expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });

    it('should handle minimal parameters correctly', async () => {
      const minimalParams = {outdialANI: mockOutdialANI};
      const mockResult = [{id: 'test', name: 'Test', number: '+1234567890'}];

      webex.cc.services.config.getOutdialAniEntries.mockResolvedValue(mockResult);

      const result = await webex.cc.getOutdialAniEntries(minimalParams);

      // Verify the service was called with minimal parameters
      expect(webex.cc.services.config.getOutdialAniEntries).toHaveBeenCalledWith('mockOrgId', {
        outdialANI: mockOutdialANI,
      });

      expect(result).toEqual(mockResult);

      // Verify success metrics are tracked
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OUTDIAL_ANI_EP_FETCH_SUCCESS,
        {
          outdialANI: mockOutdialANI,
          resultCount: 1,
        },
        ['behavioral', 'business', 'operational']
      );
    });
  });

  describe('acceptPreviewContact', () => {
    const previewPayload = {
      interactionId: 'interaction-123',
      campaignId: 'campaign-456',
    };

    it('should accept preview contact successfully', async () => {
      const mockResponse = {trackingId: 'track-123'} as AgentContact;

      const acceptPreviewContactMock = jest
        .spyOn(webex.cc.services.dialer, 'acceptPreviewContact')
        .mockResolvedValue(mockResponse);

      const result = await webex.cc.acceptPreviewContact(previewPayload);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Accepting campaign preview contact', {
        module: CC_FILE,
        method: 'acceptPreviewContact',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Campaign preview contact accepted successfully',
        {
          module: CC_FILE,
          method: 'acceptPreviewContact',
          trackingId: 'track-123',
          interactionId: previewPayload.interactionId,
        }
      );

      expect(acceptPreviewContactMock).toHaveBeenCalledWith({data: previewPayload});
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during acceptPreviewContact', async () => {
      getErrorDetailsSpy.mockClear();

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing acceptPreviewContact',
          },
        },
      };

      jest.spyOn(webex.cc.services.dialer, 'acceptPreviewContact').mockRejectedValue(error);

      await expect(webex.cc.acceptPreviewContact(previewPayload)).rejects.toThrow(
        error.details.data.reason
      );

      expect(LoggerProxy.info).toHaveBeenCalledWith('Accepting campaign preview contact', {
        module: CC_FILE,
        method: 'acceptPreviewContact',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `acceptPreviewContact failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'acceptPreviewContact', trackingId: error.details.trackingId}
      );
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'acceptPreviewContact', CC_FILE);
      expect(mockWebexRequest.uploadLogs).toHaveBeenCalledWith({
        correlationId: error.details.trackingId,
      });
    });
  });

  describe('skipPreviewContact', () => {
    const previewPayload = {
      interactionId: 'interaction-123',
      campaignId: 'campaign-456',
    };

    it('should skip preview contact successfully', async () => {
      const mockResponse = {trackingId: 'track-123'} as AgentContact;

      const skipPreviewContactMock = jest
        .spyOn(webex.cc.services.dialer, 'skipPreviewContact')
        .mockResolvedValue(mockResponse);

      const result = await webex.cc.skipPreviewContact(previewPayload);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Skipping campaign preview contact', {
        module: CC_FILE,
        method: 'skipPreviewContact',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Campaign preview contact skipped successfully',
        {
          module: CC_FILE,
          method: 'skipPreviewContact',
          trackingId: 'track-123',
          interactionId: previewPayload.interactionId,
        }
      );

      expect(skipPreviewContactMock).toHaveBeenCalledWith({data: previewPayload});
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during skipPreviewContact', async () => {
      getErrorDetailsSpy.mockClear();

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing skipPreviewContact',
          },
        },
      };

      jest.spyOn(webex.cc.services.dialer, 'skipPreviewContact').mockRejectedValue(error);

      await expect(webex.cc.skipPreviewContact(previewPayload)).rejects.toThrow(
        error.details.data.reason
      );

      expect(LoggerProxy.info).toHaveBeenCalledWith('Skipping campaign preview contact', {
        module: CC_FILE,
        method: 'skipPreviewContact',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `skipPreviewContact failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'skipPreviewContact', trackingId: error.details.trackingId}
      );
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'skipPreviewContact', CC_FILE);
      expect(mockWebexRequest.uploadLogs).toHaveBeenCalledWith({
        correlationId: error.details.trackingId,
      });
    });
  });

  describe('removePreviewContact', () => {
    const previewPayload = {
      interactionId: 'interaction-123',
      campaignId: 'campaign-456',
    };

    it('should remove preview contact successfully', async () => {
      const mockResponse = {trackingId: 'track-123'} as AgentContact;

      const removePreviewContactMock = jest
        .spyOn(webex.cc.services.dialer, 'removePreviewContact')
        .mockResolvedValue(mockResponse);

      const result = await webex.cc.removePreviewContact(previewPayload);

      expect(LoggerProxy.info).toHaveBeenCalledWith('Removing campaign preview contact', {
        module: CC_FILE,
        method: 'removePreviewContact',
      });
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Campaign preview contact removed successfully',
        {
          module: CC_FILE,
          method: 'removePreviewContact',
          trackingId: 'track-123',
          interactionId: previewPayload.interactionId,
        }
      );

      expect(removePreviewContactMock).toHaveBeenCalledWith({data: previewPayload});
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during removePreviewContact', async () => {
      getErrorDetailsSpy.mockClear();

      const error = {
        details: {
          trackingId: '1234',
          data: {
            reason: 'Error while performing removePreviewContact',
          },
        },
      };

      jest.spyOn(webex.cc.services.dialer, 'removePreviewContact').mockRejectedValue(error);

      await expect(webex.cc.removePreviewContact(previewPayload)).rejects.toThrow(
        error.details.data.reason
      );

      expect(LoggerProxy.info).toHaveBeenCalledWith('Removing campaign preview contact', {
        module: CC_FILE,
        method: 'removePreviewContact',
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        `removePreviewContact failed with reason: ${error.details.data.reason}`,
        {module: CC_FILE, method: 'removePreviewContact', trackingId: error.details.trackingId}
      );
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'removePreviewContact', CC_FILE);
      expect(mockWebexRequest.uploadLogs).toHaveBeenCalledWith({
        correlationId: error.details.trackingId,
      });
    });
  });
});
