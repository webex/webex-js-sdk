import 'jsdom-global/register';
import EventEmitter from 'events';
import {
  AIAssistantEventName,
  AIAssistantEventType,
  BuddyAgents,
  BuddyAgentsResponse,
  LoginOption,
  StationLogoutResponse,
  WebexSDK,
  VOICE_CONNECTION_STATUS,
  VOICE_CONNECTION_ERROR,
} from '../../../src/types';
import {VOICE_CONNECTION_EVENTS} from '../../../src/services/config/types';
import ContactCenter from '../../../src/cc';
import EntryPoint from '../../../src/services/EntryPoint';
import type {EntryPointListResponse} from '../../../src/types';
import AddressBook from '../../../src/services/AddressBook';
import Queue from '../../../src/services/Queue';
import type {ContactServiceQueuesResponse} from '../../../src/types';
import MockWebex from '@webex/test-helper-mock-webex';
import {StationLoginSuccess, AGENT_EVENTS} from '../../../src/services/agent/types';
import {SetStateResponse} from '../../../src/types';
import {
  AGENT,
  SUBSCRIBE_API,
  WCC_API_GATEWAY,
  WEB_RTC_PREFIX,
} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import {CC_TASK_EVENTS, CC_EVENTS} from '../../../src/services/config/types';
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
import Task from '../../../src/services/task/Task';
import {
  AgentContact,
  AISummaryResponse,
  TASK_CHANNEL_TYPE,
  TASK_EVENTS,
  TaskData,
} from '../../../src/services/task/types';
import {AI_SUMMARY_REQUEST_CANCELLED} from '../../../src/services/task/constants';
import type {ApiAIAssistant} from '../../../src/services/ApiAiAssistant';
import type {AIFeatureFlags} from '../../../src/types';
import MetricsManager from '../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../src/metrics/constants';
import Mercury from '@webex/internal-plugin-mercury';
import WebexRequest from '../../../src/services/core/WebexRequest';
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
      subscribe: jest.fn().mockResolvedValue('wss://routing.produs1.cisco.com'),
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
        reset: jest.fn(),
        stop: jest.fn(),
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
      setAnswerCallOnWebexService: jest.fn(),
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      clearAISummaryState: jest.fn(),
      invalidateRegionalTasks: jest.fn(),
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
    public requestAndWaitForRtd = jest.fn();
    public resolveFromRtdEvent = jest.fn();
    public clearAllRtdRequests = jest.fn();
    public getSuggestedResponse = jest.fn();
    public fetchHistoricTranscripts = jest.fn();
    public requestWellnessBreak = jest.fn();
    public respondToWellnessBreak = jest.fn();
    public setAIFeatureFlags = jest.fn();
    public setAgentId = jest.fn();
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
    public on = jest.fn();
    public getVoiceConnectionState = jest.fn(() => ({
      status: 'unavailable',
      lineStatus: 'unregistered',
      mobiusSocketStatus: 'disconnected',
    }));
    public isBrowserVoiceRequired = jest.fn(() => false);
    public isVoiceReady = jest.fn(() => false);
    public ensureWebCallingLine = jest.fn();
    public registerWebCallingLine = jest.fn().mockResolvedValue(undefined);
    public deregisterWebCallingLine = jest.fn().mockResolvedValue(undefined);
    public setLoginOption = jest.fn((loginOption: string) => {
      this.loginOption = loginOption;
    });
    public setBrowserVoiceRequired = jest.fn();
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
  public cleanUpCall = jest.fn();
  public hasUsableSocket = jest.fn(() => true);
  public reset = jest.fn();
  public stop = jest.fn();

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
  public constructor(data: TaskData, apiAIAssistant?: ApiAIAssistant, agentId = 'agent-1') {
    super(
      {} as any,
      data,
      {
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      },
      undefined,
      agentId,
      undefined,
      apiAIAssistant
    );
  }

  public accept() {
    return Promise.resolve({} as any);
  }
}

const createAISummaryLifecycleTask = (
  data: TaskData = createAISummaryLifecycleTaskData(),
  apiAIAssistant?: ApiAIAssistant
): AISummaryLifecycleTask => new AISummaryLifecycleTask(data, apiAIAssistant);

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
      hasUsableSocket: jest.fn(() => true),
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
      subscribe: jest.fn().mockResolvedValue('wss://routing.produs1.cisco.com'),
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
        getWellbeingBreakIdleCode: jest.fn(),
      },
      webSocketManager: mockWebSocketManager,
      rtdWebSocketManager: {
        initWebSocket: jest.fn().mockResolvedValue({}),
        hasUsableSocket: jest.fn(() => true),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        isSocketClosed: false,
      },
      connectionService: {
        on: jest.fn(),
        off: jest.fn(),
        reset: jest.fn(),
        stop: jest.fn(),
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
      setAnswerCallOnWebexService: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      applyEnableWxBetterTogether: jest.fn(),
      syncWxAppMuteFromCallDetailsForAllTasks: jest.fn(),
      refreshWxAppOfferObservabilityForAllTasks: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      clearAISummaryState: jest.fn(),
      invalidateRegionalTasks: jest.fn(),
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
      accessQueue: 'SPECIFIC',
      accessEntryPoint: 'ALL',
      accessBuddyTeam: 'ALL',
      agentPersonalStatsEnabled: false,
      isTimeoutDesktopInactivityEnabled: false,
      webRtcEnabled: true,
      lostConnectionRecoveryTimeout: 0,
      isWellnessBreakEnabled: false,
      ...overrides,
    });

    let mockAgentProfile: Profile;

    beforeEach(() => {
      mockAgentProfile = createFreshAgentProfile();
    });

    it('should register successfully and return agent profile', async () => {
      mockAgentProfile.aiFeature = {realtimeTranscripts: {enable: true}} as any;
      const mercuryConnect = jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: mockAgentProfile.agentId,
          agentSessionId: 'session-after-refresh',
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
      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: false,
      }, SUBSCRIBE_API);
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
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
      expect(mockWebSocketManager.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: false,
      }, 'v1/realtime/subscribe');
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
      });
      expect(webex.cc.services.rtdWebSocketManager.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      expect(configSpy).toHaveBeenCalled();
      expect(LoggerProxy.log).toHaveBeenCalledWith('Agent config is fetched successfully', {
        module: CC_FILE,
        method: 'connectWebsocket',
      });
      expect(mockTaskManager.setConfigFlags).toHaveBeenCalledWith(
        expect.objectContaining({
          isEndTaskEnabled: mockAgentProfile.isEndTaskEnabled,
          isEndConsultEnabled: mockAgentProfile.isEndConsultEnabled,
          webRtcEnabled: mockAgentProfile.webRtcEnabled,
          autoWrapup: mockAgentProfile.wrapUpData.wrapUpProps.autoWrapup ?? false,
          aiFeature: mockAgentProfile.aiFeature,
          consultTransfer: {
            allowConsultToQueue: mockAgentProfile.allowConsultToQueue,
            accessQueue: mockAgentProfile.accessQueue,
            accessEntryPoint: mockAgentProfile.accessEntryPoint,
            accessBuddyTeam: mockAgentProfile.accessBuddyTeam,
          },
          enableWxBetterTogether: false,
          getWxAppUsersubPublished: expect.any(Function),
        })
      );
      expect(mockTaskManager.clearAISummaryState).not.toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalled();
      expect(result).toEqual({...mockAgentProfile, agentSessionId: 'session-after-refresh'});
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS,
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
      ]);
    });

    it('should not register when config is undefined', async () => {
      webex.cc.$config = undefined;
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: mockAgentProfile.agentId,
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
      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: true,
      }, SUBSCRIBE_API);
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
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
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        'Error during register',
        expect.objectContaining({module: CC_FILE, method: 'register'})
      );

      // Verify metrics tracking
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED,
        {
          orgId: undefined,
        },
        ['operational']
      );
    });

    it('clears wellness session context when registration fails after relogin', async () => {
      const mockError = new Error('Error after silent relogin');
      webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue({
        ...mockAgentProfile,
        webRtcEnabled: false,
        aiFeature: undefined,
      } as Profile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
      jest.spyOn(webex.cc as any, 'silentRelogin').mockImplementation(async () => {
        webex.cc['updateWellnessSession']('partial-session');
        throw mockError;
      });

      await expect(webex.cc.register()).rejects.toThrow(mockError);

      expect(webex.cc['currentAgentSessionId']).toBeUndefined();
    });

    it('should log error if mercury connect fails but cc.register() should not fail', async () => {
      const mockError = new Error('Error while performing mercury connect');
      jest.spyOn(webex.internal.mercury, 'connect').mockRejectedValue(mockError);

      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: mockAgentProfile.agentId,
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
      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: false,
      }, SUBSCRIBE_API);
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
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
          agentId: mockAgentProfile.agentId,
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
      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: false,
      }, SUBSCRIBE_API);
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
      });

      expect(configSpy).toHaveBeenCalled();
      expect(mercurySpy).not.toHaveBeenCalled();
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).not.toHaveBeenCalled();
      expect(result).toEqual(mockAgentProfile);
    });

    it('should connect RTD websocket when only wellness breaks are enabled', async () => {
      mockAgentProfile.aiFeature = {
        realtimeTranscripts: {enable: false},
        suggestedResponses: {enable: false},
      } as any;
      mockAgentProfile.isWellnessBreakEnabled = true;
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: mockAgentProfile.agentId,
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});

      await webex.cc.register();

      expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
        force: true,
        isKeepAliveEnabled: false,
        clientType: 'WebexCCSDK',
        allowMultiLogin: false,
      }, 'v1/realtime/subscribe');
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        url: 'wss://routing.produs1.cisco.com',
        signal: expect.any(AbortSignal),
      });
      expect(webex.cc.services.rtdWebSocketManager.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should not connect RTD websocket when transcripts, suggestions, and wellness are disabled', async () => {
      mockAgentProfile.aiFeature = {
        realtimeTranscripts: {enable: false},
        suggestedResponses: {enable: false},
      } as any;
      mockAgentProfile.isWellnessBreakEnabled = false;
      jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: mockAgentProfile.agentId,
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
          agentId: mockAgentProfile.agentId,
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

        expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        }, 'v1/realtime/subscribe');
        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
          url: 'wss://routing.produs1.cisco.com',
          signal: expect.any(AbortSignal),
        });
      }
    });

    it.each([
      {
        title: 'aiFeature is absent',
        defaultDn: 'normalized-dn-without-ai-feature',
        aiFeature: undefined,
      },
      {
        title: 'aiFeature has no optional feature objects',
        defaultDn: 'normalized-dn-with-empty-ai-feature',
        aiFeature: {} as any,
      },
    ])(
      'should tolerate absent AI feature shapes without summary-driven RTD setup when $title',
      async ({defaultDn, aiFeature}) => {
        const welcomeAgentId = 'welcome-agent-for-absent-ai-feature';
        const configuredProfile = createFreshAgentProfile({
          agentId: welcomeAgentId,
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
          agentId: welcomeAgentId,
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

        expect(webex.cc.services.subscribe).toHaveBeenCalledWith({
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        }, SUBSCRIBE_API);
        expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
          url: 'wss://routing.produs1.cisco.com',
          signal: expect.any(AbortSignal),
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
          getWxAppUsersubPublished: expect.any(Function),
          consultTransfer: {
            allowConsultToQueue: configuredProfile.allowConsultToQueue,
            accessQueue: configuredProfile.accessQueue,
            accessEntryPoint: configuredProfile.accessEntryPoint,
            accessBuddyTeam: configuredProfile.accessBuddyTeam,
          },
          enableWxBetterTogether: false,
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
      const pendingRequests = new Map<string, any>();
      const apiAIAssistant: any = {
        aiFeature: {
          id: 'test-ai-feature',
          generatedSummaries: {
            wrapUpSummariesEnabled: true,
            consultTransferSummariesEnabled: true,
          },
        },
        getSuggestedResponse: jest.fn(),
        fetchHistoricTranscripts: jest.fn(),
        setAIFeatureFlags: jest.fn((flags: AIFeatureFlags) => {
          apiAIAssistant.aiFeature = flags;
        }),
        setAgentId: jest.fn(),
        pendingRequests,
        sendEvent: jest.fn((_agentId: string, _interactionId: string, _eventType: string, eventName: string) => {
          if (eventName.includes('SUMMARY_RESPONSE')) {
            return Promise.resolve(undefined);
          }

          const deferred = createDeferred<void>();

          transportDeferreds.push(deferred);

          return deferred.promise;
        }),
      };
      apiAIAssistant.requestAndWaitForRtd = jest.fn(async (options: any) => {
        const publishTimestamp = Date.now();
        let resolveResult: (payload: any) => void = () => undefined;
        let rejectResult: (error: Error) => void = () => undefined;
        const result = new Promise((resolve, reject) => {
          resolveResult = resolve;
          rejectResult = reject;
        });
        const key = JSON.stringify([options.rtdEventType, options.correlationId]);
        pendingRequests.set(key, {
          eventType: options.rtdEventType,
          correlationId: options.correlationId,
          resolve: resolveResult,
          reject: rejectResult,
          result,
        });
        try {
          const acknowledgement = apiAIAssistant.sendEvent(
            options.agentId,
            options.interactionId,
            options.eventType,
            options.eventName,
            options.eventMetaData,
            undefined,
            undefined,
            publishTimestamp,
            options.timeout
          );
          const [payload] = await Promise.all([result, acknowledgement]);
          pendingRequests.delete(key);
          return payload;
        } catch (error) {
          pendingRequests.delete(key);
          throw error;
        }
      });
      apiAIAssistant.resolveFromRtdEvent = jest.fn(
        (eventType: string, correlationId: string, payload: any) => {
          const key = JSON.stringify([eventType, correlationId]);
          const request = pendingRequests.get(key);
          if (!request) return 'not-found';
          pendingRequests.delete(key);
          request.resolve(payload);
          return 'resolved';
        }
      );
      apiAIAssistant.clearAllRtdRequests = jest.fn(() => {
        pendingRequests.forEach((request) => {
          const error = new Error(AI_SUMMARY_REQUEST_CANCELLED) as Error & {
            data?: Record<string, unknown>;
          };
          error.data = {errorCode: AI_SUMMARY_REQUEST_CANCELLED};
          request.reject(error);
        });
        pendingRequests.clear();
      });
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
        (
          _contact,
          _webCallingService,
          taskData: TaskData,
          _configFlags,
          _wrapupData,
          _agentId,
          _agentName,
          _answerCallService,
          taskApiAIAssistant: ApiAIAssistant
        ) => createAISummaryLifecycleTask(taskData, taskApiAIAssistant)
      );
      const task = createAISummaryLifecycleTask(undefined, apiAIAssistant);

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
      const getApiAIAssistant = () => apiAIAssistant as any;
      const getSummaryMapCounts = () => {
        const api = getApiAIAssistant() as any;
        const manager = taskManager as any;
        const pendingRequests = Array.from(api.pendingRequests.values());

        return {
          pendingPostCall: pendingRequests.filter(
            (request: any) => request.eventType === 'POST_CALL_SUMMARY'
          ).length,
          pendingMidCall: pendingRequests.filter(
            (request: any) => request.eventType === 'MID_CALL_SUMMARY'
          ).length,
          receiving: manager.receivingSummaryBuffer.size,
          featureEnablement: manager.pendingFeatureEnablement.size,
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
        getApiAIAssistant,
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
        actionTimestamp: 1,
      }
    ) => {
      harness.emitRtdFrame(CC_TASK_EVENTS.FEATURE_ENABLEMENT, payload);
    };

    const dispatchFeatureEnablement = (
      harness: ReturnType<typeof createSummaryHarness>,
      payload = {
        interactionId: 'interaction-1',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimestamp: 1,
      }
    ) => {
      harness.dispatchRtdFrame(CC_TASK_EVENTS.FEATURE_ENABLEMENT, payload);
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
      harness.emitRtdFrame(CC_TASK_EVENTS.POST_CALL_SUMMARY, {
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
      harness.dispatchRtdFrame(CC_TASK_EVENTS.POST_CALL_SUMMARY, {
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
      harness.emitRtdFrame(CC_TASK_EVENTS.MID_CALL_SUMMARY, {
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

    it('clears active summary state on deregister', async () => {
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
      harness.webSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent-1'});
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(profile);

      await webex.cc.register();
      await flushMicrotasks();

      expect(harness.rtdWebSocketManager.listenerCount('message')).toBe(1);

      dispatchFeatureEnablement(harness);
      expect(harness.task.aiSummaryCapabilities).toEqual({
        midCallEnabled: true,
        postCallEnabled: true,
      });

      dispatchFeatureEnablement(harness, {
        interactionId: 'orphan-before-deregister',
        postCallEnabled: true,
        midCallEnabled: true,
        actionTimestamp: 4,
      });
      harness.dispatchRtdFrame(CC_TASK_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT, {
        conversationId: 'queued-before-deregister',
        summaryText: sentinels[0],
      });
      expect(jest.getTimerCount()).toBe(0);
      expect(harness.task.aiSummaryCapabilities).toEqual({
        midCallEnabled: true,
        postCallEnabled: true,
      });
      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 1,
        featureEnablement: 1,
      });
      expect(jest.getTimerCount()).toBe(0);

      await webex.cc.deregister();

      harness.expectSummaryStateCleared();
      expect(harness.task.aiSummaryCapabilities).toEqual({
        midCallEnabled: false,
        postCallEnabled: false,
      });
      expect(jest.getTimerCount()).toBe(0);
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
      expectSentinelsNotObserved();
    });

    it('flushes a buffered receiving summary through real TaskManager task publication once the task is answered', () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();
      const interactionId = 'receiver-arrival-interaction';
      const conversationId = interactionId;
      const receivingPayload = {
        conversationId,
        summaryText: sentinels[0],
        adaptiveCard: {body: [{text: sentinels[3]}]},
      };
      const receiverHandler = jest.fn();
      const observedOrder: string[] = [];
      let publishedTask: Task | undefined;
      let receiverEmitSpy: jest.SpyInstance | undefined;

      harness.dispatchRtdFrame(CC_TASK_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT, {
        ...receivingPayload,
      });

      expect(harness.getSummaryMapCounts()).toEqual({
        pendingPostCall: 0,
        pendingMidCall: 0,
        receiving: 1,
        featureEnablement: 0,
      });
      expect(jest.getTimerCount()).toBe(0);

      harness.taskManager.on(TASK_EVENTS.TASK_INCOMING, (task: Task) => {
        publishedTask = task;
        receiverEmitSpy = jest.spyOn(task, 'emit');
        task.on(TASK_EVENTS.TASK_ASSIGNED, () => observedOrder.push('answered'));
        task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_RECEIVED, (payload) => {
          observedOrder.push('receiver-summary');
          receiverHandler(payload);
        });
      });

      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_CONTACT_RESERVED, {
        interactionId,
        conversationId,
      });

      expect(publishedTask).toBe(harness.taskManager.getTask(interactionId));
      expect(publishedTask).toBeInstanceOf(Task);
      expect(receiverHandler).not.toHaveBeenCalled();
      expect(harness.getSummaryMapCounts().receiving).toBe(1);

      emitTaskLifecycleEvent(harness, CC_EVENTS.AGENT_CONTACT_ASSIGNED, {
        interactionId,
        conversationId,
      });

      expect(observedOrder).toEqual(['answered', 'receiver-summary']);
      expect(receiverHandler).toHaveBeenCalledTimes(1);
      expect(receiverHandler).toHaveBeenCalledWith(receivingPayload);
      expect(
        receiverEmitSpy?.mock.calls.filter(
          ([eventName]) => eventName === TASK_EVENTS.TASK_MID_CALL_SUMMARY_RECEIVED
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
      emitFeatureEnablement(harness);
      jest.clearAllMocks();

      const postCallRequest = harness.task.requestPostCallSummary();

      await flushMicrotasks();
      expect(harness.apiAIAssistant.sendEvent).toHaveBeenCalledWith(
        'agent-1',
        'interaction-1',
        AIAssistantEventType.CTI_EVENT,
        AIAssistantEventName.GET_POST_CALL_SUMMARY,
        expect.objectContaining({conversationId: 'conversation-1'}),
        undefined,
        undefined,
        expect.any(Number),
        15000
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
        featureEnablement: 0,
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

    it('sends post-call responses using current task data after manager cleanup', async () => {
      jest.useFakeTimers();

      const harness = createSummaryHarness();
      const interactionId = 'post-call-cleanup-interaction';
      const conversationId = 'post-call-cleanup-conversation';
      const apiAIAssistant = harness.getApiAIAssistant();
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
        actionTimestamp: 9,
      });

      const postCallRequest = retainedTask.requestPostCallSummary();

      await flushMicrotasks();
      expect(postCallRequest).toBeDefined();
      expect(harness.apiAIAssistant.sendEvent).toHaveBeenCalledWith(
        'agent-1',
        interactionId,
        AIAssistantEventType.CTI_EVENT,
        AIAssistantEventName.GET_POST_CALL_SUMMARY,
        expect.objectContaining({conversationId}),
        undefined,
        undefined,
        expect.any(Number),
        15000
      );
      harness.dispatchRtdFrame(CC_TASK_EVENTS.POST_CALL_SUMMARY, {
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
        featureEnablement: 0,
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

      const requestCallsAfterRemoval = (apiAIAssistant as any).pendingRequests.size;
      const responseInteractionId = 'post-call-response-current-interaction';
      const responseConversationId = 'post-call-response-current-conversation';

      retainedTask.updateTaskData(
        createAISummaryLifecycleTaskData({
          interactionId: responseInteractionId,
          conversationId: responseConversationId,
        }),
        true
      );

      const responsePayload: AISummaryResponse = {
        summary: {initialContactReason: 'resolved'},
        feedback: 'thumbs_up',
        state: 'DEFAULT',
        wrapUpCode: 'resolved',
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
      };

      await expect(
        retainedTask.sendPostCallSummaryResponse(responsePayload)
      ).resolves.toBeUndefined();

      expect((apiAIAssistant as any).pendingRequests.size).toBe(requestCallsAfterRemoval);
      expect(harness.apiAIAssistant.sendEvent).toHaveBeenCalledTimes(2);
      expect(harness.apiAIAssistant.sendEvent).toHaveBeenNthCalledWith(
        2,
        'agent-1',
        responseInteractionId,
        AIAssistantEventType.CTI_EVENT,
        AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        {
          conversationId: responseConversationId,
          clientType: 'WxCC',
          action: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
          summary: {initialContactReason: 'resolved'},
          feedback: 'thumbs_up',
          wrapUpCode: 'resolved',
          numberOfTimesViewed: 1,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
          state: 'DEFAULT',
        },
        undefined,
        undefined,
        expect.any(Number),
        15000
      );
    });

    it('cancels pending real public requests on deregister and ignores late HTTP settlement', async () => {
      const harness = createSummaryHarness();
      const unhandledRejections: unknown[] = [];
      const unhandledRejectionListener = jest.fn((reason) => {
        unhandledRejections.push(reason);
      });

      attachRtdMessageListener(harness.rtdWebSocketManager);
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
        postCallRequest.catch(() => undefined);
        midCallRequest.catch(() => undefined);

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
        expectSentinelsNotObserved();
      } finally {
        process.off('unhandledRejection', unhandledRejectionListener);
        harness.taskManager.clearAISummaryState();
      }
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
          dialNumber: `${WEB_RTC_PREFIX}agentId`,
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
      expect(webex.cc.agentConfig.deviceType).toBe(LoginOption.BROWSER);

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

    it('does not register a browser line during station login when WebRTC is disabled', async () => {
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
      expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenCalledWith(false);
      expect(stationLoginSpy).toHaveBeenCalledWith({
        data: {
          dialNumber: `${WEB_RTC_PREFIX}agentId`,
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

    it('should publish usersub and subscribe Mercury on station login when enableWxBetterTogether is true at init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury.connected = true;
      webex.internal.mercury.connect = jest.fn().mockResolvedValue(undefined);
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const subscribeSpy = jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
      expect(subscribeSpy).toHaveBeenCalledWith('agentId', expect.any(Function));
      expect(mockTaskManager.refreshWxAppOfferObservabilityForAllTasks).toHaveBeenCalled();
    });

    it('should rollback wxApp config when post-station-login init fails', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      jest
        .spyOn(webex.cc as never, 'publishAnswerOnWebexCrossClientState' as never)
        .mockRejectedValue(new Error('usersub publish failed'));
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(false);
    });

    it('should reset wxApp config when Mercury fails before usersub publish on station login', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc as any, 'ensureWxAppMercuryConnected')
        .mockRejectedValue(new Error('mercury connect failed'));
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');
      jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).not.toHaveBeenCalled();
      expect(teardownSpy).not.toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.objectContaining({skipReason: 'mercury_subscribe_failed'}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(false);
    });

    it('should record publish_failed when usersub publish fails after Mercury init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      jest.spyOn(webex.cc as any, 'ensureWxAppMercuryConnected').mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockRejectedValue(new Error('publish failed'));
      jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.objectContaining({skipReason: 'publish_failed', usersubPublished: false}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
    });

    it('should report retained usersub state when publish fails during re-init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      jest.spyOn(webex.cc as any, 'ensureWxAppMercuryConnected').mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'isAnswerCallsStateActive')
        .mockReturnValue(true);
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockRejectedValue(new Error('publish failed'));
      jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.objectContaining({skipReason: 'publish_failed', usersubPublished: true}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
    });

    it('should register device before publishing usersub true on extension station login', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        userId: 'user-123',
        registered: false,
        register: jest.fn().mockImplementation(async function (this: {
          url?: string;
          registered?: boolean;
        }) {
          this.url = 'https://wdm.example.com/devices/dev-1';
          this.registered = true;
        }),
      };
      webex.internal.mercury = {
        connected: false,
        connect: jest.fn().mockResolvedValue(undefined),
      };
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe').mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      const callOrder: string[] = [];
      jest.spyOn(webex.internal.device, 'register').mockImplementation(async function (this: {
        url?: string;
        registered?: boolean;
      }) {
        callOrder.push('device.register');
        this.url = 'https://wdm.example.com/devices/dev-1';
        this.registered = true;
      });
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockImplementation(async (enable: boolean) => {
          if (enable === true && !webex.internal.device.url) {
            throw new Error('Device URL is unavailable for cross-client publish');
          }
          callOrder.push(enable ? 'publish:true' : 'publish:false');
        });

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(callOrder).toEqual(['device.register', 'publish:true']);
    });

    it('should register device before publishing forced usersub false when wxApp is disabled at station login', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      webex.internal.device = {
        userId: 'user-123',
        registered: false,
        register: jest.fn().mockImplementation(async function (this: {
          url?: string;
          registered?: boolean;
        }) {
          this.url = 'https://wdm.example.com/devices/dev-1';
          this.registered = true;
        }),
      };
      webex.internal.mercury = {
        connected: false,
        connect: jest.fn().mockResolvedValue(undefined),
      };
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);

      const callOrder: string[] = [];
      jest.spyOn(webex.internal.device, 'register').mockImplementation(async function (this: {
        url?: string;
        registered?: boolean;
      }) {
        callOrder.push('device.register');
        this.url = 'https://wdm.example.com/devices/dev-1';
        this.registered = true;
      });
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockImplementation(async (enable: boolean) => {
          if (!webex.internal.device.url) {
            throw new Error('Device URL is unavailable for cross-client publish');
          }
          callOrder.push(enable ? 'publish:true' : 'publish:false');
        });

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(callOrder).toEqual(['device.register', 'publish:false']);
    });

    it('should retry forced false publish when wxApp is disabled at station login', async () => {
      jest.useFakeTimers();
      try {
        webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
        webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
        webex.cc.agentConfig = {
          agentId: 'agentId',
          webRtcEnabled: false,
          loginVoiceOptions: ['EXTENSION'],
        };
        webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

        const publishSpy = jest
          .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
          .mockRejectedValueOnce(new Error('usersub publish failed'))
          .mockResolvedValue(undefined);
        const scheduleRetrySpy = jest.spyOn(
          webex.cc as any,
          'scheduleForcedFalsePublishRetry'
        );
        const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
        jest
          .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
          .mockResolvedValue(undefined);

        jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
          data: {
            agentId: 'agentId',
            teamId: 'teamId',
            channelsMap: {chat: [], email: [], social: [], telephony: []},
          },
          trackingId: 'track-1',
        } as StationLoginSuccess);

        await webex.cc.stationLogin({
          teamId: 'teamId',
          loginOption: LoginOption.EXTENSION,
          dialNumber: '1001',
        });

        expect(publishSpy).toHaveBeenCalledTimes(1);
        expect(scheduleRetrySpy).toHaveBeenCalled();
        expect(teardownSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(30_000);
        await publishSpy.mock.results[1]?.value;

        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(publishSpy).toHaveBeenLastCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      } finally {
        jest.useRealTimers();
      }
    });

    it('should not publish usersub on BROWSER station login even when enableWxBetterTogether is true at init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: true,
        loginVoiceOptions: ['BROWSER'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;

      const publishSpy = jest.spyOn(
        webex.cc['webexCrossClientService'],
        'setManageWebexCallingInWxcc'
      );

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.BROWSER,
      });

      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should force-publish usersub false on station login when enableWxBetterTogether is false at init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
        expect.objectContaining({
          enableWxBetterTogether: false,
          skipReason: 'flag_disabled',
        }),
        ['operational', 'behavioral']
      );
    });

    it('should not emit WXAPP_SESSION_INIT_FAILED when flag-disabled cleanup fails', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockRejectedValue(new Error('forced false publish failed'));
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(metricSpy).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.anything(),
        expect.anything()
      );
    });

    it('should still publish usersub but record session init failed when Mercury is unavailable', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      delete webex.internal.mercury;
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'isAnswerCallsStateActive')
        .mockReturnValue(true);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED,
        expect.objectContaining({error: 'Mercury is unavailable for wxApp mute sync'}),
        ['operational', 'behavioral']
      );
      expect(metricSpy).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_SUCCESS,
        expect.anything(),
        expect.anything()
      );
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.objectContaining({skipReason: 'mercury_not_subscribed'}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
    });

    it('should record session init failed when userId is missing but not emit success', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        url: 'https://wdm.example.com/devices/dev-1',
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury = {
        connected: true,
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn(),
      };
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).not.toHaveBeenCalledWith(true, expect.anything());
      expect(metricSpy).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_SUCCESS,
        expect.anything(),
        expect.anything()
      );
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_SESSION_INIT_FAILED,
        expect.objectContaining({skipReason: 'usersub_not_published'}),
        ['operational', 'behavioral']
      );
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
        expect.objectContaining({skipReason: 'user_id_unavailable', usersubPublished: false}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
    });

    it('should report retained usersub state when userId is missing during re-init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        url: 'https://wdm.example.com/devices/dev-1',
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury = {
        connected: true,
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn(),
      };
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      mockTaskManager.applyEnableWxBetterTogether(true);

      jest
        .spyOn(webex.cc['webexCrossClientService'], 'isAnswerCallsStateActive')
        .mockReturnValue(true);
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      const metricSpy = jest.spyOn(mockMetricsManager, 'trackEvent');

      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).not.toHaveBeenCalledWith(true, expect.anything());
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
        expect.objectContaining({skipReason: 'user_id_unavailable', usersubPublished: true}),
        ['operational', 'behavioral']
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
    });

    it('should clear stale usersub on login after prior session enabled wxApp then hard refresh', async () => {
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['EXTENSION'],
      };
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      webex.request = jest.fn().mockResolvedValue({body: {}});

      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-1',
      } as StationLoginSuccess);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      webex.cc['webexCrossClientService'].teardown();
      webex.cc['wxAppTelephonyMercurySync'].unsubscribe();
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await webex.cc.stationLogin({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
    });
  });

  describe('stationLogout', () => {
    it('should wait for browser voice deregistration to finish', async () => {
      let resolveDeregister: (() => void) | undefined;
      let signalDeregisterStarted: (() => void) | undefined;
      const deregisterStarted = new Promise<void>((resolve) => {
        signalDeregisterStarted = resolve;
      });
      jest
        .spyOn(webex.cc.webCallingService, 'deregisterWebCallingLine')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveDeregister = resolve;
              signalDeregisterStarted?.();
            })
        );
      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({} as StationLogoutResponse);

      let logoutResolved = false;
      const logout = webex.cc.stationLogout({logoutReason: 'Logout reason'}).then((result) => {
        logoutResolved = true;
        return result;
      });

      await deregisterStarted;
      expect(logoutResolved).toBe(false);

      resolveDeregister?.();
      await logout;
      expect(logoutResolved).toBe(true);
    });

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

    it('logout reason is sanitized before metrics', async () => {
      const data = {logoutReason: 'Logout\r\ninjected: evil'};

      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({} as StationLogoutResponse);

      await webex.cc.stationLogout(data);

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS,
        expect.objectContaining({logoutReason: 'Logoutinjected: evil'}),
        ['behavioral', 'business', 'operational']
      );
    });

    it('should not publish usersub false on logout when wxApp was never enabled', async () => {
      webex.internal.device = {userId: 'user-123'};
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
        trackingId: 'track-1',
      } as StationLogoutResponse);

      await webex.cc.stationLogout({logoutReason: 'Logout reason'});

      expect(publishSpy).not.toHaveBeenCalled();
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should publish usersub false and teardown wxApp sync on logout when wxApp was enabled', async () => {
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
        registered: false,
        register: jest.fn().mockResolvedValue(undefined),
        unregister: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury = {
        connected: false,
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe').mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      webex.request = jest.fn().mockResolvedValue({body: {}});
      webex.cc['agentConfig'] = {
        agentId: 'agent-123',
        deviceType: LoginOption.EXTENSION,
      } as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
        trackingId: 'track-1',
      } as StationLogoutResponse);

      await webex.cc.stationLogout({logoutReason: 'Logout reason'});

      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should teardown wxApp state on logout even when usersub publish fails', async () => {
      webex.internal.device = {userId: 'user-123'};
      webex.cc['agentConfig'] = {
        agentId: 'agent-123',
        deviceType: LoginOption.EXTENSION,
      } as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      mockTaskManager.applyEnableWxBetterTogether(true);

      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
        trackingId: 'track-1',
      } as StationLogoutResponse);
      jest
        .spyOn(webex.cc as never, 'publishAnswerOnWebexCrossClientState' as never)
        .mockRejectedValue(new Error('usersub publish failed'));
      const scheduleRetrySpy = jest.spyOn(
        webex.cc as any,
        'scheduleCompensatingFalsePublishRetry'
      );
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      const result = await webex.cc.stationLogout({logoutReason: 'Logout reason'});

      expect(result).toEqual({trackingId: 'track-1'});
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(scheduleRetrySpy).toHaveBeenCalled();
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
    });

    it('should retry compensating false publish when teardown usersub publish fails on logout', async () => {
      jest.useFakeTimers();
      try {
        webex.internal.device = {
          userId: 'user-123',
          url: 'https://wdm.example.com/devices/dev-1',
        };
        webex.cc['agentConfig'] = {
          agentId: 'agent-123',
          deviceType: LoginOption.EXTENSION,
        } as Profile;
        webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
        webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
        mockTaskManager.applyEnableWxBetterTogether(true);
        webex.cc['webexCrossClientService'].answerCallsState = true;

        jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
          trackingId: 'track-1',
        } as StationLogoutResponse);

        const publishSpy = jest
          .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
          .mockRejectedValueOnce(new Error('usersub publish failed'))
          .mockResolvedValue(undefined);
        const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
        const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');
        jest
          .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
          .mockResolvedValue(undefined);

        const result = await webex.cc.stationLogout({logoutReason: 'Logout reason'});

        expect(result).toEqual({trackingId: 'track-1'});
        expect(publishSpy).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
        expect(teardownSpy).toHaveBeenCalled();
        expect(unsubscribeSpy).toHaveBeenCalled();

        jest.advanceTimersByTime(30_000);
        await publishSpy.mock.results[1]?.value;

        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(publishSpy).toHaveBeenLastCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      } finally {
        jest.useRealTimers();
      }
    });

    it('should cancel compensating retry when station login succeeds before retry fires', async () => {
      jest.useFakeTimers();
      try {
        webex.internal.device = {
          userId: 'user-123',
          url: 'https://wdm.example.com/devices/dev-1',
          registered: false,
          register: jest.fn().mockResolvedValue(undefined),
          unregister: jest.fn().mockResolvedValue(undefined),
        };
        webex.internal.mercury = {
          connected: false,
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
        };
        jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe').mockImplementation(() => {});
        jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
        webex.cc['agentConfig'] = {
          agentId: 'agent-123',
          deviceType: LoginOption.EXTENSION,
          webRtcEnabled: false,
          loginVoiceOptions: ['EXTENSION'],
        } as Profile;
        webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
        webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
        mockTaskManager.applyEnableWxBetterTogether(true);
        webex.cc['webexCrossClientService'].answerCallsState = true;

        jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
          trackingId: 'track-1',
        } as StationLogoutResponse);
        jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
          data: {
            agentId: 'agent-123',
            teamId: 'team-123',
            channelsMap: {chat: [], email: [], social: [], telephony: []},
          },
          trackingId: 'track-2',
        } as StationLoginSuccess);

        const publishSpy = jest
          .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
          .mockRejectedValueOnce(new Error('usersub publish failed'))
          .mockResolvedValue(undefined);
        const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
        jest
          .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
          .mockResolvedValue(undefined);

        await webex.cc.stationLogout({logoutReason: 'Logout reason'});
        await webex.cc.stationLogin({
          teamId: 'team-123',
          loginOption: LoginOption.EXTENSION,
          dialNumber: '1001',
        });

        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(publishSpy).toHaveBeenNthCalledWith(1, false, {userId: 'user-123', trackPublishMetrics: true});
        expect(publishSpy).toHaveBeenNthCalledWith(2, true, {userId: 'user-123', trackPublishMetrics: true});
        expect(teardownSpy).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(30_000);

        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(teardownSpy).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
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

    it('logout reason is sanitized before metrics in error path', async () => {
      const data = {logoutReason: 'Logout\r\ninjected: evil'};
      const error = {
        details: {
          trackingId: '1234',
          data: {reason: 'station logout failed'},
        },
      };

      jest.spyOn(webex.cc.services.agent, 'logout').mockRejectedValue(error);

      await expect(webex.cc.stationLogout(data)).rejects.toThrow();

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED,
        expect.objectContaining({logoutReason: 'Logoutinjected: evil'}),
        ['behavioral', 'business', 'operational']
      );
    });
  });

  describe('setAgentStatus', () => {
    it('should reject browser voice state changes while WebRTC registration is unavailable', async () => {
      const webCallingService = webex.cc.webCallingService;
      jest.spyOn(webCallingService, 'isBrowserVoiceRequired').mockReturnValue(true);
      jest.spyOn(webCallingService, 'isVoiceReady').mockReturnValue(false);
      const stateChangeSpy = jest.spyOn(webex.cc.services.agent, 'stateChange');

      await expect(
        webex.cc.setAgentState({state: 'Available', auxCodeId: '0'})
      ).rejects.toThrow(VOICE_CONNECTION_ERROR.NOT_READY);

      expect(stateChangeSpy).not.toHaveBeenCalled();
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: VOICE_CONNECTION_ERROR.NOT_READY,
          details: expect.objectContaining({
            type: 'SDK_VALIDATION_ERROR',
            data: {reason: VOICE_CONNECTION_ERROR.NOT_READY},
          }),
        }),
        'setAgentState',
        CC_FILE
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
        expect.objectContaining({state: 'Available', auxCodeId: '0'}),
        ['behavioral', 'business', 'operational']
      );
    });

    it('should allow an Idle transition while browser voice is unavailable', async () => {
      const webCallingService = webex.cc.webCallingService;
      jest.spyOn(webCallingService, 'isBrowserVoiceRequired').mockReturnValue(true);
      jest.spyOn(webCallingService, 'isVoiceReady').mockReturnValue(false);
      const payload = {state: 'Idle', auxCodeId: 'idle-code', agentId: 'agent-id'};
      const stateChangeSpy = jest
        .spyOn(webex.cc.services.agent, 'stateChange')
        .mockResolvedValue({data: payload});

      await webex.cc.setAgentState(payload);

      expect(stateChangeSpy).toHaveBeenCalledWith({data: payload});
    });

    it('should preserve state changes when browser voice registration is not required', async () => {
      const webCallingService = webex.cc.webCallingService;
      jest.spyOn(webCallingService, 'isBrowserVoiceRequired').mockReturnValue(false);
      jest.spyOn(webCallingService, 'isVoiceReady').mockReturnValue(false);
      const expectedPayload = {state: 'Meeting', auxCodeId: '12345', agentId: '123'};
      const stateChangeSpy = jest
        .spyOn(webex.cc.services.agent, 'stateChange')
        .mockResolvedValue({data: expectedPayload});

      await webex.cc.setAgentState(expectedPayload);

      expect(stateChangeSpy).toHaveBeenCalledWith({data: expectedPayload});
    });

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

    it('state change reason is sanitized before metrics on success', async () => {
      const expectedPayload = {
        state: 'Available',
        auxCodeId: '0',
        agentId: '123',
        lastStateChangeReason: 'Available\r\ninjected: evil',
      };

      jest
        .spyOn(webex.cc.services.agent, 'stateChange')
        .mockResolvedValue({data: expectedPayload});

      await webex.cc.setAgentState(expectedPayload);

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS,
        expect.objectContaining({lastStateChangeReason: 'Availableinjected: evil'}),
        ['behavioral', 'business', 'operational']
      );
    });

    it('state change reason is sanitized before metrics on failure', async () => {
      const expectedPayload = {
        state: 'Meeting',
        auxCodeId: '12345',
        agentId: '123',
        lastStateChangeReason: 'Meeting\r\ninjected: evil',
      };
      const error = {
        details: {
          trackingId: '1234',
          data: {reason: 'missing status'},
        },
      };
      jest.spyOn(webex.cc.services.agent, 'stateChange').mockRejectedValue(error);

      await expect(webex.cc.setAgentState(expectedPayload)).rejects.toThrow(
        error.details.data.reason
      );

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
        expect.objectContaining({lastStateChangeReason: 'Meetinginjected: evil'}),
        ['behavioral', 'business', 'operational']
      );
    });
  });

  describe('Agent Wellness Break SDK contracts', () => {
    const wellbeingCode = {
      id: 'wellbeing-code',
      name: 'WellbeingBreak',
      isSystem: true,
      isDefault: false,
    };

    beforeEach(() => {
      webex.cc.agentConfig = {
        agentId: 'agent-1',
        isWellnessBreakEnabled: true,
      } as Profile;
      webex.cc['updateWellnessSession']('session-1');
    });

    it('fetches the system idle code once per registration', async () => {
      const lookup = jest
        .spyOn(webex.cc.services.config, 'getWellbeingBreakIdleCode')
        .mockResolvedValue(wellbeingCode);

      await expect(webex.cc.getWellbeingBreakIdleCode()).resolves.toEqual(wellbeingCode);
      await expect(webex.cc.getWellbeingBreakIdleCode()).resolves.toEqual(wellbeingCode);

      expect(lookup).toHaveBeenCalledTimes(1);
      expect(lookup).toHaveBeenCalledWith('mockOrgId');
    });

    it('does not cache an idle-code lookup that completes after a new registration starts', async () => {
      let resolveLookup: (idleCode: typeof wellbeingCode) => void = () => undefined;
      jest
        .spyOn(webex.cc.services.config, 'getWellbeingBreakIdleCode')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveLookup = resolve;
            })
        );

      const lookupPromise = webex.cc.getWellbeingBreakIdleCode();
      const staleLookup = expect(lookupPromise).rejects.toThrow(
        'WELLNESS_BREAK_REGISTRATION_CHANGED'
      );
      jest
        .spyOn(webex.cc, 'connectWebsocket')
        .mockRejectedValue(new Error('replacement registration failed'));

      await expect(webex.cc.register()).rejects.toThrow('replacement registration failed');
      resolveLookup(wellbeingCode);

      await staleLookup;
      expect(webex.cc['wellbeingBreakIdleCode']).toBeUndefined();
    });

    it('rejects the system idle-code lookup when wellness is disabled', async () => {
      webex.cc.agentConfig.isWellnessBreakEnabled = false;

      await expect(webex.cc.getWellbeingBreakIdleCode()).rejects.toThrow(
        'WELLNESS_BREAK_NOT_ENABLED'
      );
      expect(webex.cc.services.config.getWellbeingBreakIdleCode).not.toHaveBeenCalled();
    });

    it('invalidates the wellness session only for a current-session multi-login close', () => {
      webex.cc['handleWebsocketMessage'](
        JSON.stringify({
          type: CC_EVENTS.AGENT_MULTI_LOGIN,
          data: {
            type: 'AgentMultiLoginCloseSession',
            agentSessionId: 'another-session',
          },
        })
      );
      expect(webex.cc['currentAgentSessionId']).toBe('session-1');

      webex.cc['handleWebsocketMessage'](
        JSON.stringify({
          type: CC_EVENTS.AGENT_MULTI_LOGIN,
          data: {
            type: 'AgentMultiLoginCloseSession',
            agentSessionId: 'session-1',
          },
        })
      );
      expect(webex.cc['currentAgentSessionId']).toBeUndefined();
    });

    it('emits primary wellness notifications regardless of notification session metadata', () => {
      const emitSpy = jest.spyOn(webex.cc, 'emit');
      const payload = {
        type: 'Wellness_Break_Handler',
        orgId: 'mockOrgId',
        trackingId: 'data-notification-tracking',
        data: {
          agentId: 'agent-1',
          orgId: 'mockOrgId',
          notifType: 'Wellness_Break_Handler',
          notifDetails: {
            actionEvent: 'SUGGEST_WELLNESS_BREAK',
            actionText: 'How about a break?',
          },
          data: {
            orgId: 'mockOrgId',
            agentSessionId: 'notification-session',
            interactionId: 'interaction-1',
          },
        },
      };

      webex.cc['handleWebsocketMessage'](JSON.stringify(payload));

      expect(emitSpy).toHaveBeenCalledWith(CC_EVENTS.WELLNESS_BREAK, {
        agentId: 'agent-1',
        orgId: 'mockOrgId',
        agentSessionId: 'notification-session',
        actionEvent: 'SUGGEST_WELLNESS_BREAK',
        actionText: 'How about a break?',
        interactionId: 'interaction-1',
        trackingId: 'data-notification-tracking',
      });
    });

    it('routes data-socket wellness notifications without sending them to TaskManager', () => {
      const emitSpy = jest.spyOn(webex.cc, 'emit');
      const taskEventSpy = mockTaskManager.handleRealtimeWebsocketEvent;
      const wellnessMessage = JSON.stringify({
        type: 'Wellness_Break_Handler',
        orgId: 'mockOrgId',
        data: {
          agentId: 'agent-1',
          orgId: 'mockOrgId',
          notifType: 'Wellness_Break_Handler',
          notifDetails: {actionEvent: 'PROVIDE_WELLNESS_BREAK'},
          data: {orgId: 'mockOrgId', agentSessionId: 'notification-session'},
        },
      });

      webex.cc['handleRTDWebsocketMessage'](wellnessMessage);

      expect(emitSpy).toHaveBeenCalledWith(CC_EVENTS.WELLNESS_BREAK, {
        agentId: 'agent-1',
        orgId: 'mockOrgId',
        agentSessionId: 'notification-session',
        actionEvent: 'PROVIDE_WELLNESS_BREAK',
      });
      expect(taskEventSpy).not.toHaveBeenCalled();

      const transcriptMessage = JSON.stringify({type: CC_EVENTS.REAL_TIME_TRANSCRIPTION});
      webex.cc['handleRTDWebsocketMessage'](transcriptMessage);
      expect(taskEventSpy).toHaveBeenCalledWith(transcriptMessage);
    });

    it.each([
      ['SUGGEST_WELLNESS_BREAK', 'interactionId'],
      ['WELLNESS_BREAK_NOT_ALLOWED', 'InteractionId'],
    ])('normalizes the %s action and either interaction-id spelling', (actionEvent, key) => {
      const emitSpy = jest.spyOn(webex.cc, 'emit');
      webex.cc['handleWebsocketMessage'](
        JSON.stringify({
          type: 'Wellness_Break_Handler',
          orgId: 'mockOrgId',
          data: {
            agentId: 'agent-1',
            orgId: 'mockOrgId',
            notifType: 'Wellness_Break_Handler',
            notifDetails: {actionEvent},
            data: {
              orgId: 'mockOrgId',
              agentSessionId: 'session-1',
              [key]: 'interaction-2',
            },
          },
        })
      );

      expect(emitSpy).toHaveBeenCalledWith(
        CC_EVENTS.WELLNESS_BREAK,
        expect.objectContaining({actionEvent, interactionId: 'interaction-2'})
      );
    });

    it('does not promote uncontracted notification text fields', () => {
      const emitSpy = jest.spyOn(webex.cc, 'emit');
      webex.cc['handleWebsocketMessage'](
        JSON.stringify({
          type: 'Wellness_Break_Handler',
          orgId: 'mockOrgId',
          trackingId: 'notification-tracking',
          data: {
            agentId: 'agent-1',
            orgId: 'mockOrgId',
            notifType: 'Wellness_Break_Handler',
            notifDetails: {
              actionEvent: 'SUGGEST_WELLNESS_BREAK',
              actionText2: 'Uncontracted text',
            },
            data: {
              orgId: 'mockOrgId',
              agentSessionId: 'session-1',
              InteractionId: 'interaction-qa',
            },
          },
        })
      );

      expect(emitSpy).toHaveBeenCalledWith(CC_EVENTS.WELLNESS_BREAK, {
        agentId: 'agent-1',
        orgId: 'mockOrgId',
        agentSessionId: 'session-1',
        actionEvent: 'SUGGEST_WELLNESS_BREAK',
        interactionId: 'interaction-qa',
        trackingId: 'notification-tracking',
      });
    });

    it('ignores wellness events when the effective flag is disabled or identity is missing', () => {
      const emitSpy = jest.spyOn(webex.cc, 'emit');
      const payload = {
        type: 'Wellness_Break_Handler',
        orgId: 'mockOrgId',
        data: {
          agentId: 'agent-1',
          orgId: 'mockOrgId',
          notifType: 'Wellness_Break_Handler',
          notifDetails: {actionEvent: 'SUGGEST_WELLNESS_BREAK'},
          data: {orgId: 'mockOrgId', agentSessionId: 'session-1'},
        },
      };

      webex.cc.agentConfig.isWellnessBreakEnabled = false;
      webex.cc['handleWebsocketMessage'](JSON.stringify(payload));
      webex.cc.agentConfig.isWellnessBreakEnabled = true;
      const {orgId: omittedOrgId, ...payloadWithoutEnvelopeOrg} = payload;
      expect(omittedOrgId).toBe('mockOrgId');
      webex.cc['handleWebsocketMessage'](JSON.stringify(payloadWithoutEnvelopeOrg));

      expect(emitSpy).not.toHaveBeenCalledWith(CC_EVENTS.WELLNESS_BREAK, expect.anything());
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_EVENT_INVALID,
        {reason: 'wellness_disabled'},
        ['operational']
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_EVENT_INVALID,
        {reason: 'missing_wellness_identity'},
        ['operational']
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

    it('should map Transfer action to an Available backend state filter', async () => {
      webex.cc.agentConfig = {agentProfileID: 'test-agent-profile-id'};
      const buddyAgentsResponse = {data: {agentList: []}};
      const buddyAgentsSpy = jest
        .spyOn(webex.cc.services.agent, 'buddyAgents')
        .mockResolvedValue(buddyAgentsResponse);

      await webex.cc.getBuddyAgents({action: 'Transfer', mediaType: 'chat'});

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {
          agentProfileId: 'test-agent-profile-id',
          mediaType: 'chat',
          state: 'Available',
        },
      });
    });

    it('should omit the backend state filter for Consult and default media type to telephony', async () => {
      webex.cc.agentConfig = {agentProfileID: 'test-agent-profile-id'};
      const buddyAgentsResponse = {data: {agentList: []}};
      const buddyAgentsSpy = jest
        .spyOn(webex.cc.services.agent, 'buddyAgents')
        .mockResolvedValue(buddyAgentsResponse);

      await webex.cc.getBuddyAgents({action: 'Consult'});

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {
          agentProfileId: 'test-agent-profile-id',
          mediaType: 'telephony',
        },
      });
    });

    it('uses config agentProfileId and ignores override', async () => {
      webex.cc.agentConfig = {agentProfileID: 'test-agent-profile-id'};
      const buddyAgentsResponse = {data: {agentList: []}};
      const buddyAgentsSpy = jest
        .spyOn(webex.cc.services.agent, 'buddyAgents')
        .mockResolvedValue(buddyAgentsResponse);

      await webex.cc.getBuddyAgents({
        mediaType: 'telephony',
        agentProfileId: 'malicious-override-id',
      } as BuddyAgents);

      expect(buddyAgentsSpy).toHaveBeenCalledWith({
        data: {
          agentProfileId: 'test-agent-profile-id',
          mediaType: 'telephony',
        },
      });
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
    it('preserves browser line registration when WebRTC is not required', async () => {
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
      } as Profile;
      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.BROWSER,
          dn: '12345',
        },
      } as any);
      const registerWebCallingLineSpy = jest.spyOn(
        webex.cc.webCallingService,
        'registerWebCallingLine'
      );
      const setBrowserVoiceRequiredSpy = jest.spyOn(
        webex.cc.webCallingService,
        'setBrowserVoiceRequired'
      );

      await webex.cc['silentRelogin']();

      expect(registerWebCallingLineSpy).toHaveBeenCalled();
      expect(setBrowserVoiceRequiredSpy).toHaveBeenCalledWith(false);
    });

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
        webRtcEnabled: true,
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
      expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenCalledWith(true);
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

    it('should publish usersub true on silent relogin when enableWxBetterTogether is true at init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury.connected = true;
      webex.internal.mercury.connect = jest.fn().mockResolvedValue(undefined);
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '1001',
          teamId: 'teamId',
          lastStateChangeTimestamp: 1738575135188,
          lastIdleCodeChangeTimestamp: 1738575135189,
        },
      });

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const subscribeSpy = jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      await webex.cc['silentRelogin']();

      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
      expect(subscribeSpy).toHaveBeenCalledWith('agentId', expect.any(Function));
      expect(mockTaskManager.refreshWxAppOfferObservabilityForAllTasks).toHaveBeenCalled();
    });

    it('should force-publish usersub false on silent relogin when enableWxBetterTogether is false at init', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        agentId: 'agentId',
        agentProfileID: 'test-agent-profile-id',
        isAgentLoggedIn: false,
      } as Profile;

      jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agentId',
          deviceType: LoginOption.EXTENSION,
          dn: '1001',
          teamId: 'teamId',
          lastStateChangeTimestamp: 1738575135188,
          lastIdleCodeChangeTimestamp: 1738575135189,
        },
      });

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      await webex.cc['silentRelogin']();

      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
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

    it('invalidates wellness context before deregistration cleanup can fail', async () => {
      const cleanupError = new Error('cleanup failed');
      let rejectCleanup: (error: Error) => void = () => undefined;
      const cleanup = new Promise((resolve, reject) => {
        rejectCleanup = reject;
      });
      webex.cc.agentConfig = {
        ...webex.cc.agentConfig,
        isWellnessBreakEnabled: true,
      };
      webex.cc['updateWellnessSession']('session-1');
      jest.spyOn(webex.cc as any, 'teardownWxAppLocalState').mockReturnValue(cleanup);
      webex.cc.apiAIAssistant.requestWellnessBreak.mockRejectedValue(
        new Error('WELLNESS_BREAK_AGENT_SESSION_REQUIRED')
      );

      const deregistration = webex.cc.deregister();
      const rejection = expect(deregistration).rejects.toThrow(cleanupError);

      expect(webex.cc['currentAgentSessionId']).toBeUndefined();
      await expect(webex.cc.apiAIAssistant.requestWellnessBreak()).rejects.toThrow(
        'WELLNESS_BREAK_AGENT_SESSION_REQUIRED'
      );

      rejectCleanup(cleanupError);
      await rejection;
      expect(webex.cc['currentAgentSessionId']).toBeUndefined();
    });

    it('should unregister successfully and clean up all resources when webrtc is enabled', async () => {
      webex.cc.services.rtdWebSocketManager = {
        isSocketClosed: false,
        close: jest.fn(),
        off: jest.fn(),
        on: jest.fn(),
      } as any;

      webex.internal.device = {
        ...webex.internal.device,
        userId: 'user-123',
        unregister: jest.fn().mockResolvedValue(undefined),
      };
      deviceUnregisterSpy = jest.spyOn(webex.internal.device, 'unregister');
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

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
      expect(webex.cc.services.rtdWebSocketManager.off).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(webex.cc.services.connectionService.off).toHaveBeenCalledWith(
        'connectionLost',
        expect.any(Function)
      );

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, expect.any(String));
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledWith(
        false,
        expect.any(String)
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

      expect(publishSpy).not.toHaveBeenCalled();
      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should publish usersub false before device unregister when wxApp is active on deregister', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.cc['webexCrossClientService'].answerCallsState = true;
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
        unregister: jest.fn().mockResolvedValue(undefined),
      };
      deviceUnregisterSpy = jest.spyOn(webex.internal.device, 'unregister');

      const callOrder: string[] = [];
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockImplementation(async (enable: boolean) => {
          if (enable === false && !webex.internal.device.url) {
            throw new Error('Device URL is unavailable for cross-client publish');
          }
          callOrder.push(enable ? 'publish:true' : 'publish:false');
        });
      deviceUnregisterSpy.mockImplementation(async () => {
        callOrder.push('device.unregister');
        webex.internal.device.url = undefined;
      });

      await webex.cc.deregister();

      expect(callOrder).toEqual(['publish:false', 'device.unregister']);
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
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, expect.any(String));
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

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, expect.any(String));
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledWith(false, expect.any(String));
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledTimes(1);
      expect(webex.cc.agentConfig).toBeNull();
    });

    it('should teardown wxApp state on deregister even when usersub publish fails', async () => {
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
      };
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.cc['webexCrossClientService'].answerCallsState = true;
      webex.internal.device = {
        userId: 'user-123',
        unregister: jest.fn().mockResolvedValue(undefined),
      };

      jest
        .spyOn(webex.cc as never, 'publishAnswerOnWebexCrossClientState' as never)
        .mockRejectedValue(new Error('usersub publish failed'));
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');

      await expect(webex.cc.deregister()).rejects.toThrow('usersub publish failed');

      expect(teardownSpy).toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, expect.any(String));
      expect(webex.cc.agentConfig).toBeNull();
    });

    it('should publish forced false during teardown when enable publish is still in flight', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
      };

      let resolveEnable: () => void = () => {};
      const enableGate = new Promise<void>((resolve) => {
        resolveEnable = resolve;
      });

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockImplementation(async (enable: boolean) => {
          if (enable) {
            await enableGate;
          }
        });
      jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);

      expect(webex.cc['webexCrossClientService'].answerCallsState).toBe(false);

      const enableInFlight = (webex.cc as any).publishAnswerOnWebexCrossClientState(true);

      await (webex.cc as any).teardownWxAppLocalState();

      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});

      resolveEnable();
      await enableInFlight;
    });

    it('should release wxApp-owned Mercury and device on deregister', async () => {
      webex.cc.agentConfig = {
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: [LoginOption.EXTENSION],
      };
      webex.cc['wxAppMercuryConnectedByCc'] = true;
      webex.cc['wxAppDeviceRegisteredByCc'] = true;
      webex.internal.mercury.connected = true;
      webex.internal.device.registered = true;

      const mercuryDisconnectSpy = jest
        .spyOn(webex.internal.mercury, 'disconnect')
        .mockResolvedValue(undefined);
      const deviceUnregisterSpy = jest
        .spyOn(webex.internal.device, 'unregister')
        .mockResolvedValue(undefined);

      await webex.cc.deregister();

      expect(mercuryDisconnectSpy).toHaveBeenCalled();
      expect(deviceUnregisterSpy).toHaveBeenCalled();
      expect(webex.cc['wxAppMercuryConnectedByCc']).toBe(false);
      expect(webex.cc['wxAppDeviceRegisteredByCc']).toBe(false);
    });

    it('should retain wxApp Mercury ownership when disconnect fails and retry cleanup', async () => {
      webex.cc['wxAppMercuryConnectedByCc'] = true;
      webex.internal.mercury.connected = true;

      const mercuryDisconnectSpy = jest
        .spyOn(webex.internal.mercury, 'disconnect')
        .mockRejectedValueOnce(new Error('disconnect failed'))
        .mockResolvedValueOnce(undefined);

      await webex.cc['releaseWxAppMercuryResources']();

      expect(mercuryDisconnectSpy).toHaveBeenCalledTimes(1);
      expect(webex.cc['wxAppMercuryConnectedByCc']).toBe(true);

      await webex.cc['releaseWxAppMercuryResources']();

      expect(mercuryDisconnectSpy).toHaveBeenCalledTimes(2);
      expect(webex.cc['wxAppMercuryConnectedByCc']).toBe(false);
    });

    it('should retain wxApp device ownership when unregister fails and retry cleanup', async () => {
      webex.cc['wxAppDeviceRegisteredByCc'] = true;
      webex.internal.device.registered = true;

      const deviceUnregisterSpy = jest
        .spyOn(webex.internal.device, 'unregister')
        .mockRejectedValueOnce(new Error('unregister failed'))
        .mockResolvedValueOnce(undefined);

      await webex.cc['releaseWxAppMercuryResources']();

      expect(deviceUnregisterSpy).toHaveBeenCalledTimes(1);
      expect(webex.cc['wxAppDeviceRegisteredByCc']).toBe(true);

      await webex.cc['releaseWxAppMercuryResources']();

      expect(deviceUnregisterSpy).toHaveBeenCalledTimes(2);
      expect(webex.cc['wxAppDeviceRegisteredByCc']).toBe(false);
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

    it('does not emit an unknown server-controlled event type', () => {
      const payload = {
        type: 'UnhandledMessage',
        data: {foo: 'bar', type: 'MaliciousInjectedType'},
      };

      messageCallback(JSON.stringify(payload));

      expect(emitSpy).not.toHaveBeenCalledWith('MaliciousInjectedType', expect.anything());
    });

    it('emits a known agent event type verbatim from data.type', () => {
      const sample = {foo: 'bar', type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS};

      messageCallback(
        JSON.stringify({type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, data: sample})
      );

      expect(emitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, sample);
    });

    it('websocket event type is sanitized before logging and metrics', () => {
      const maliciousType = 'ContactUpdated\r\ninjected: evil';
      const payload = {
        type: maliciousType,
        data: {foo: 'bar'},
      };

      messageCallback(JSON.stringify(payload));

      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Received event: ContactUpdatedinjected: evil',
        {module: CC_FILE, method: 'handleWebsocketMessage'}
      );
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED,
        expect.objectContaining({
          ws_event_type: 'ContactUpdatedinjected: evil',
          top_level_type: 'ContactUpdatedinjected: evil',
        }),
        ['operational']
      );
    });

    it('should call webCallingService.setLoginOption with correct deviceType on AGENT_STATION_LOGIN_SUCCESS', () => {
      const setLoginOptionSpy = jest.spyOn(webex.cc.webCallingService, 'setLoginOption');
      const deviceType = LoginOption.BROWSER;
      webex.cc.agentConfig = {webRtcEnabled: true} as Profile;
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
      expect(webex.cc.webCallingService.setBrowserVoiceRequired).not.toHaveBeenCalled();
    });

    it('clears the local browser voice requirement after a multi-login on another device type', () => {
      const setBrowserVoiceRequiredSpy = jest.spyOn(
        webex.cc.webCallingService,
        'setBrowserVoiceRequired'
      );
      const payload = {
        trackingId: 'track-123',
        data: {
          agentId: 'agent-id',
          teamId: 'team-id',
          siteId: 'site-id',
          roles: ['role1'],
          channelsMap: {chat: [], email: [], social: [], telephony: []},
          deviceType: LoginOption.EXTENSION,
          type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
        },
        type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
      };

      messageCallback(JSON.stringify(payload));

      expect(setBrowserVoiceRequiredSpy).toHaveBeenCalledWith(false);
    });

    it.each([
      [LoginOption.BROWSER, true, false, true],
      [LoginOption.BROWSER, true, true, false],
      [LoginOption.BROWSER, false, false, false],
      [LoginOption.EXTENSION, true, false, false],
    ])(
      'should configure browser voice for loginOption=%s, webRtcEnabled=%s, disabled=%s',
      async (loginOption, webRtcEnabled, disableWebRTCRegistration, expected) => {
        webex.cc.agentConfig = {...webex.cc.agentConfig, webRtcEnabled} as Profile;
        webex.cc['$config'] = {...webex.cc['$config'], disableWebRTCRegistration};
        jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
          data: {
            loginOption,
            agentId: 'agent-id',
            teamId: 'team-id',
            siteId: 'site-id',
            roles: [AGENT],
            channelsMap: {chat: [], email: [], social: [], telephony: []},
          },
          trackingId: 'track-id',
        } as unknown as StationLoginSuccess);
        const setBrowserVoiceRequiredSpy = jest.spyOn(
          webex.cc.webCallingService,
          'setBrowserVoiceRequired'
        );
        const registerWebCallingLineSpy = jest.spyOn(
          webex.cc.webCallingService,
          'registerWebCallingLine'
        );

        await webex.cc.stationLogin({teamId: 'team-id', loginOption});

        expect(setBrowserVoiceRequiredSpy).toHaveBeenCalledWith(expected);
        if (expected) {
          expect(registerWebCallingLineSpy).toHaveBeenCalled();
        } else {
          expect(registerWebCallingLineSpy).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe('API property exposure', () => {
    it('should expose the current voice connection snapshot and state change event', () => {
      const state = {
        status: VOICE_CONNECTION_STATUS.READY,
        lineStatus: 'registered',
        mobiusSocketStatus: 'connected',
      } as const;
      jest.spyOn(webex.cc.webCallingService, 'getVoiceConnectionState').mockReturnValue(state);
      const triggerSpy = jest.spyOn(webex.cc, 'trigger');
      expect(webex.cc.webCallingService.on).toHaveBeenCalledWith(
        VOICE_CONNECTION_EVENTS.STATE_CHANGE,
        expect.any(Function)
      );

      expect(webex.cc.getVoiceConnectionState()).toEqual(state);
      const stateChangeHandler = webex.cc.webCallingService.on.mock.calls.find(
        ([event]) => event === VOICE_CONNECTION_EVENTS.STATE_CHANGE
      )[1];
      stateChangeHandler(state);
      expect(triggerSpy).toHaveBeenCalledWith(VOICE_CONNECTION_EVENTS.STATE_CHANGE, state);
    });

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

    it('should preserve enableWxBetterTogether init flag across profile update logout/login', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
      webex.cc.agentConfig = {
        ...webex.cc.agentConfig,
        agentId: 'agentId',
        webRtcEnabled: false,
        loginVoiceOptions: ['BROWSER', 'EXTENSION'],
      } as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;
      webex.cc.webCallingService.setLoginOption = jest.fn((loginOption: LoginOption) => {
        webex.cc.webCallingService.loginOption = loginOption;
      });
      webex.cc['webexCrossClientService'].answerCallsState = true;

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      jest.spyOn(webex.cc as any, 'releaseWxAppMercuryResources').mockResolvedValue(undefined);

      jest.spyOn(webex.cc.services.agent, 'logout').mockResolvedValue({
        trackingId: 'track-logout',
      } as StationLogoutResponse);
      jest.spyOn(webex.cc.services.agent, 'stationLogin').mockResolvedValue({
        data: {
          agentId: 'agentId',
          teamId: 'teamId',
          channelsMap: {chat: [], email: [], social: [], telephony: []},
        },
        trackingId: 'track-login',
      } as StationLoginSuccess);

      webex.internal.mercury.connected = true;

      await webex.cc.updateAgentProfile({
        teamId: 'teamId',
        loginOption: LoginOption.EXTENSION,
        dialNumber: '1001',
      });

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
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

  describe('private setManageWebexCallingInWxcc (runtime toggle impl)', () => {
    beforeEach(() => {
      webex.internal.device = {
        userId: 'user-123',
        registered: false,
        register: jest.fn().mockResolvedValue(undefined),
        unregister: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury = {
        connected: false,
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe').mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      webex.cc['agentConfig'] = {
        agentId: 'agent-123',
        deviceType: LoginOption.EXTENSION,
      } as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;
      webex.cc.webCallingService.setLoginOption = jest.fn((loginOption: LoginOption) => {
        webex.cc.webCallingService.loginOption = loginOption;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should update config, task manager, and publish usersub when enabled', async () => {
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(true);
      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
      expect(mockTaskManager.refreshWxAppOfferObservabilityForAllTasks).toHaveBeenCalled();
    });

    it('should publish false and update config when disabled after wxApp was enabled', async () => {
      webex.internal.device = {
        userId: 'user-123',
        url: 'https://wdm.example.com/devices/dev-1',
      };
      webex.request = jest.fn().mockResolvedValue({body: {}});

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await (webex.cc as any).setManageWebexCallingInWxcc(false);

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(false);
      expect(publishSpy).toHaveBeenCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
    });

    it('should skip usersub publish when disabling without prior wxApp publish', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await (webex.cc as any).setManageWebexCallingInWxcc(false);

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(false);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should throw when enabling before login', async () => {
      webex.internal.device = undefined;

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
        'Cannot publish answer-calls-on-wxcc: user is not logged in'
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).not.toHaveBeenCalled();
    });

    it('should throw when enabling on BROWSER (Desktop) login', async () => {
      webex.cc['agentConfig'] = {deviceType: LoginOption.BROWSER} as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
        'setManageWebexCallingInWxcc requires EXTENSION or AGENT_DN station login'
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should throw when enabling before station login', async () => {
      webex.cc['agentConfig'] = undefined as unknown as Profile;
      webex.cc.webCallingService.loginOption = undefined as unknown as LoginOption;
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
        'setManageWebexCallingInWxcc requires EXTENSION or AGENT_DN station login'
      );
      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).not.toHaveBeenCalled();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should throw when webCallingService is BROWSER even if agentConfig deviceType is stale', async () => {
      webex.cc['agentConfig'] = {deviceType: LoginOption.EXTENSION} as Profile;
      webex.cc.webCallingService.loginOption = LoginOption.BROWSER;
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
        'setManageWebexCallingInWxcc requires EXTENSION or AGENT_DN station login'
      );
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should publish usersub when enabling on AGENT_DN login', async () => {
      webex.cc['agentConfig'] = {
        agentId: 'agent-123',
        deviceType: LoginOption.AGENT_DN,
      } as Profile;
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(true, {userId: 'user-123', trackPublishMetrics: true});
    });

    it('should no-op usersub publish when disabling before login', async () => {
      webex.internal.device = undefined;
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);

      await (webex.cc as any).setManageWebexCallingInWxcc(false);

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(false);
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should subscribe to wxApp Mercury mute sync when enabled', async () => {
      webex.cc['agentConfig'] = {agentId: 'agent-123'} as Profile;
      webex.internal.device = {
        ...webex.internal.device,
        registered: true,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury.connected = true;
      webex.internal.mercury.connect = jest.fn().mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const subscribeSpy = jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      expect(subscribeSpy).toHaveBeenCalledWith('agent-123', expect.any(Function));
    });

    it('should unsubscribe from wxApp Mercury mute sync when disabled', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const unsubscribeSpy = jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      await (webex.cc as any).setManageWebexCallingInWxcc(false);

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should register device and connect mercury when enabling wxApp sync', async () => {
      webex.cc['agentConfig'] = {agentId: 'agent-123'} as Profile;
      webex.internal.device = {
        userId: 'user-123',
        registered: false,
        register: jest.fn().mockResolvedValue(undefined),
      };
      webex.internal.mercury = {
        connected: false,
        connect: jest.fn().mockResolvedValue(undefined),
      };
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      const subscribeSpy = jest
        .spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
        .mockImplementation(() => {});
      jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);

      await (webex.cc as any).setManageWebexCallingInWxcc(true);

      expect(webex.internal.device.register).toHaveBeenCalled();
      expect(webex.internal.mercury.connect).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledWith('agent-123', expect.any(Function));
    });

    it('should rollback config and task manager when usersub publish fails', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockRejectedValue(new Error('usersub failed'));

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow('usersub failed');

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenCalledWith(true);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenLastCalledWith(false);
    });

    it('should rollback config and release Mercury resources when Mercury connect fails', async () => {
      webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: false};
      const publishSpy = jest
        .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
        .mockResolvedValue(undefined);
      jest
        .spyOn(webex.cc as any, 'ensureWxAppMercuryConnected')
        .mockRejectedValue(new Error('mercury connect failed'));
      const releaseSpy = jest
        .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
        .mockResolvedValue(undefined);
      const unsubscribeSpy = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'unsubscribe');
      const teardownSpy = jest.spyOn(webex.cc['webexCrossClientService'], 'teardown');

      await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
        'mercury connect failed'
      );

      expect(webex.cc.isWxBetterTogetherEnabled()).toBe(false);
      expect(mockTaskManager.applyEnableWxBetterTogether).toHaveBeenLastCalledWith(false);
      expect(publishSpy).not.toHaveBeenCalled();
      expect(teardownSpy).not.toHaveBeenCalled();
      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(releaseSpy).toHaveBeenCalled();
    });

    it('should schedule compensating false retry when rollback publish fails after enable error', async () => {
      jest.useFakeTimers();
      try {
        webex.cc.$config = {...webex.cc.$config, enableWxBetterTogether: true};
        webex.internal.device = {userId: 'user-123', url: 'https://wdm.example.com/devices/dev-1'};
        webex.cc.agentConfig = {
          agentId: 'agent-123',
          deviceType: LoginOption.EXTENSION,
        };
        webex.cc.webCallingService.loginOption = LoginOption.EXTENSION;

        const publishSpy = jest
          .spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('compensating false failed'))
          .mockResolvedValue(undefined);
        jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe').mockImplementation(() => {});
        jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
        jest
          .spyOn(webex.cc as any, 'ensureWxAppMercuryConnected')
          .mockResolvedValue(undefined);
        jest
          .spyOn(webex.cc as any, 'releaseWxAppMercuryResources')
          .mockResolvedValue(undefined);
        jest
          .spyOn(mockTaskManager, 'syncWxAppMuteFromCallDetailsForAllTasks')
          .mockImplementation(() => {
            throw new Error('sync failed');
          });
        const scheduleRetrySpy = jest.spyOn(
          webex.cc as any,
          'scheduleCompensatingFalsePublishRetry'
        );

        await expect((webex.cc as any).setManageWebexCallingInWxcc(true)).rejects.toThrow(
          'sync failed'
        );

        expect(scheduleRetrySpy).toHaveBeenCalled();
        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(publishSpy).toHaveBeenNthCalledWith(1, true, {userId: 'user-123', trackPublishMetrics: true});
        expect(publishSpy).toHaveBeenNthCalledWith(2, false, {userId: 'user-123', trackPublishMetrics: true});

        jest.advanceTimersByTime(30_000);
        await publishSpy.mock.results[2]?.value;

        expect(publishSpy).toHaveBeenCalledTimes(3);
        expect(publishSpy).toHaveBeenLastCalledWith(false, {userId: 'user-123', trackPublishMetrics: true});
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

// Exercise the real routing, socket and AQM request wiring at the HTTP and WebSocket boundaries.
describe('regional recovery wiring', () => {
  const sourceMocks = [
    '../../../src/logger-proxy',
    '../../../src/services',
    '../../../src/services/task/TaskManager',
    '../../../src/metrics/MetricsManager',
    '../../../src/services/core/WebexRequest',
    '../../../src/services/ApiAiAssistant',
    '../../../src/services/WebCallingService',
    '../../../src/services/task/TaskFactory',
    '../../../src/services/task/voice/WebRTC',
    '../../../src/services/task/taskDataNormalizer',
    '../../../src/services/task/state-machine',
    '../../../src/services/task/state-machine/uiControlsComputer',
    '../../../src/services/task/AutoWrapup',
    '../../../src/services/EntryPoint',
    '../../../src/services/AddressBook',
    '../../../src/services/Queue',
    '../../../src/services/config',
    '../../../src/services/core/websocket/WebSocketManager',
    '../../../src/services/core/websocket/connection-service',
    'uuid',
  ];

  class NativeSocket {
    static instances: NativeSocket[] = [];

    readyState = 0;

    onopen?: () => void;

    onclose?: () => void;

    onmessage?: (event: {data: string}) => void;

    send = jest.fn();

    close = jest.fn(() => {
      this.readyState = 3;
    });

    constructor(public url: string) {
      NativeSocket.instances.push(this);
    }

    welcome(agentId = 'agent') {
      this.readyState = 1;
      this.onopen?.();
      this.message({type: 'Welcome', data: {agentId}});
    }

    message(frame: unknown) {
      this.onmessage?.({data: JSON.stringify(frame)});
    }

    lose() {
      this.readyState = 3;
      this.onclose?.();
    }
  }

  const flush = async () => {
    for (let turn = 0; turn < 10; turn += 1) {
      await flushMicrotasks();
    }
  };

  const agentFrame = (type: string, extra: Record<string, unknown> = {}) => ({
    type,
    orgId: 'org',
    data: {
      type,
      trackingId: 'routing-tracking-id',
      orgId: 'org',
      agentId: 'agent',
      agentSessionId: 'session',
      teamId: 'team',
      deviceType: 'EXTENSION',
      dn: '1234',
      isExtension: true,
      channelsMap: {},
      auxCodeId: 'idle',
      status: 'LoggedIn',
      subStatus: 'Idle',
      lastStateChangeReason: 'initial',
      lastStateChangeTimestamp: 1,
      lastIdleCodeChangeTimestamp: 1,
      ...extra,
    },
  });

  let graph;

  type SubscribeFailure = {statusCode: number; headers?: Record<string, string>};

  const subscribeConflict = (reason: string): SubscribeFailure => ({
    statusCode: 409,
    headers: {'x-wxcc-region-reason': reason},
  });

  type RoutingOptions = {
    autoRegister?: boolean;
    initialSubscribeFailure?: SubscribeFailure;
    resolveSubscribeFailure?: boolean;
    multiRegionEnabled?: boolean | null;
    rtdEnabled?: boolean;
    rtdReconnectFailure?: number;
    browserVoice?: boolean;
  };

  const withRouting = async (
    test: (context: any) => Promise<void>,
    {
      autoRegister = true,
      initialSubscribeFailure,
      resolveSubscribeFailure = false,
      multiRegionEnabled = true,
      rtdEnabled = false,
      rtdReconnectFailure,
      browserVoice = false,
    }: RoutingOptions = {}
  ) => {
    const mocks = sourceMocks.map((name) => [name, jest.requireMock(name)] as const);
    const original = {
      socket: global.WebSocket,
      worker: global.Worker,
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
      crypto: Object.getOwnPropertyDescriptor(global, 'crypto'),
    };
    let cc;

    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    NativeSocket.instances = [];
    sourceMocks.forEach((name) => jest.dontMock(name));
    try {
      if (!graph)
        jest.isolateModules(() => {
          graph = {
            ContactCenter: jest.requireActual('../../../src/cc').default,
            Services: jest.requireActual('../../../src/services').default,
            TaskManager: jest.requireActual('../../../src/services/task/TaskManager').default,
            MetricsManager: jest.requireActual('../../../src/metrics/MetricsManager').default,
            WebexRequest: jest.requireActual('../../../src/services/core/WebexRequest').default,
            LoggerProxy: jest.requireActual('../../../src/logger-proxy').default,
          };
        });
      Object.defineProperty(global, 'crypto', {
        value: require('crypto').webcrypto,
        configurable: true,
      });
      global.WebSocket = NativeSocket as any;
      global.Worker = jest.fn(() => ({postMessage: jest.fn(), terminate: jest.fn()})) as any;
      URL.createObjectURL = jest.fn(() => 'blob:controlled-worker');
      URL.revokeObjectURL = jest.fn();

      const webex = MockWebex({
        children: {cc: graph.ContactCenter},
        config: {cc: {...config.cc, allowAutomatedRelogin: false}},
        credentials: {getOrgId: () => 'org'},
        logger: {
          log: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          trace: jest.fn(),
          debug: jest.fn(),
        },
        once: jest.fn((_event, callback) => callback()),
      });
      cc = webex.cc;
      webex.internal.newMetrics = {
        submitBehavioralEvent: jest.fn(),
        submitOperationalEvent: jest.fn(),
        submitBusinessEvent: jest.fn(),
      };
      webex.internal.services = {
        isIntegrationEnvironment: () => true,
        waitForCatalog: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
      };
      webex.internal.support = {submitLogs: jest.fn().mockResolvedValue({trackingid: 'logs'})};
      const requests = [];
      const routingHosts = [
        'routing.produs1.cisco.com',
        'routing.produs2.cisco.com',
        'routing.produs1.cisco.com',
      ];
      let routingSubscribes = 0;
      let rtdSubscribes = 0;
      let subscribeFailure = initialSubscribeFailure;
      let refreshedRoutingHost: string | undefined;
      const updateServices = jest.fn(async () => {
        subscribeFailure = undefined;
        refreshedRoutingHost = 'routing.produs2.cisco.com';
      });
      webex.internal.services.updateServices = updateServices;

      webex.request = jest.fn(async (request) => {
        requests.push(request);
        const {resource} = request;
        if (resource === SUBSCRIBE_API) {
          if (subscribeFailure) {
            if (resolveSubscribeFailure) return subscribeFailure;
            throw subscribeFailure;
          }
          const host = refreshedRoutingHost ?? routingHosts[routingSubscribes];
          routingSubscribes += 1;

          return {statusCode: 200, body: {webSocketUrl: `wss://${host}/?signature=private`}};
        }
        if (resource === 'v1/realtime/subscribe') {
          rtdSubscribes += 1;
          if (rtdSubscribes > 1 && rtdReconnectFailure) {
            throw {statusCode: rtdReconnectFailure};
          }

          return {
            statusCode: 200,
            body: {webSocketUrl: 'wss://rtd.produs2.cisco.com/?signature=private'},
          };
        }
        if (resource.endsWith('/v2/user/by-ci-user-id/agent/desktop-login')) {
          return {
            statusCode: 200,
            body: {
              user: {
                ciUserId: 'agent',
                dbId: 'db',
                siteId: 'site',
                firstName: 'Agent',
                lastName: 'Test',
              },
              agentProfile: {
                loginVoiceOptions: browserVoice ? ['BROWSER', 'EXTENSION'] : ['EXTENSION'],
                dialPlanEnabled: false,
              },
            },
          };
        }
        if (resource.endsWith('/desktop-login')) {
          return {
            statusCode: 200,
            body: {
              organization: {},
              organizationSetting: {
                webRtcEnabled: browserVoice,
                multiRegionEnabled,
                homeRegion: 'produs1',
              },
              tenantConfiguration: {},
              ...(rtdEnabled && {aiFeature: {realtimeTranscripts: {enable: true}}}),
            },
          };
        }
        if (resource.includes('/auxiliary-code') || resource.includes('/v2/team?')) {
          return {statusCode: 200, body: {data: [], meta: {totalPages: 1}}};
        }

        return {statusCode: 200, body: {}};
      });
      const sockets = NativeSocket.instances;
      const currentRouting = () =>
        sockets.filter((socket) => socket.url.includes('routing.')).at(-1);
      const startSwitch = (operation: 'FAILOVER' | 'FAILBACK', overrides = {}) => {
        currentRouting().message({
          type: 'SYSTEM_REGION_SWITCH',
          orgId: 'org',
          trackingId: operation,
          data: {operation, scope: operation === 'FAILOVER' ? 'ORG' : 'REGION'},
          ...overrides,
        });
      };
      const advanceSwitch = async () => {
        jest.advanceTimersByTime(105000);
        await flush();
      };
      const connectBackup = async () => {
        startSwitch('FAILOVER');
        await advanceSwitch();
        const socket = currentRouting();
        socket.welcome();
        await flush();

        return socket;
      };
      const login = async (loginOption = LoginOption.EXTENSION) => {
        const pending = cc.stationLogin({teamId: 'team', loginOption, dialNumber: '1234'});
        await flush();
        currentRouting().message({
          ...agentFrame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, {
            deviceType: loginOption,
            isExtension: loginOption === LoginOption.EXTENSION,
            dn: loginOption === LoginOption.BROWSER ? 'webrtc-agent' : '1234',
          }),
          type: CC_EVENTS.AGENT_STATION_LOGIN,
        });
        await pending;
        await flush();
        cc.$config.allowAutomatedRelogin = true;
      };

      if (autoRegister && !initialSubscribeFailure) {
        const registered = cc.register();
        await flush();
        currentRouting().welcome();
        await registered;
        await flush();
      }
      await test({
        cc,
        requests,
        sockets,
        currentRouting,
        startSwitch,
        advanceSwitch,
        connectBackup,
        login,
        updateServices,
        setSubscribeFailure: (failure?: SubscribeFailure) => {
          subscribeFailure = failure;
        },
      });
    } finally {
      cc?.['terminateRegistration']();
      cc?.services.webSocketManager.close(false);
      cc?.services.rtdWebSocketManager.close(false);
      if (graph) {
        graph.Services.instance = undefined;
        graph.TaskManager.taskManager = undefined;
        graph.WebexRequest.instance = undefined;
        graph.MetricsManager.resetInstance();
        graph.LoggerProxy.logger = undefined;
      }
      mocks.forEach(([name, value]) => jest.doMock(name, () => value));
      global.WebSocket = original.socket;
      global.Worker = original.worker;
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      if (original.crypto) Object.defineProperty(global, 'crypto', original.crypto);
      else Reflect.deleteProperty(global, 'crypto');
      jest.restoreAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  };

  it('uses newly subscribed routing sockets for failover, failback, and ordinary AQM requests', async () => {
    await withRouting(async ({cc, requests, currentRouting, startSwitch, advanceSwitch, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const home = currentRouting();
      const start = requests.length;

      startSwitch('FAILOVER');
      expect(home.close).toHaveBeenCalledTimes(1);
      await advanceSwitch();
      const backup = currentRouting();
      expect(new URL(backup.url).hostname).toBe('routing.produs2.cisco.com');
      backup.welcome();
      await flush();
      backup.message(
        agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, {
          agentSessionId: 'backup-session',
          teamId: 'backup-team',
          deviceType: undefined,
          dn: undefined,
          dialNumber: '5678',
          isExtension: false,
        })
      );
      await flush();
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'ready',
          operation: 'FAILOVER',
          scope: 'ORG',
          servingRegion: 'produs2',
        })
      );
      startSwitch('FAILOVER');
      expect(backup.close).not.toHaveBeenCalled();

      const request = cc.services.agent.stateChange({data: {state: 'Idle', auxCodeId: 'idle'}});
      await flush();
      backup.message({
        ...agentFrame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, {agentSessionId: 'backup-session'}),
        type: CC_EVENTS.AGENT_STATE_CHANGE,
      });
      await expect(request).resolves.toMatchObject({data: {auxCodeId: 'idle'}});

      startSwitch('FAILBACK');
      await advanceSwitch();
      const restored = currentRouting();
      expect(new URL(restored.url).hostname).toBe('routing.produs1.cisco.com');
      restored.welcome();
      await flush();
      restored.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038}));
      await flush();
      expect(requests.at(-1)).toMatchObject({
        resource: '/v1/agents/login',
        body: {teamId: 'backup-team', deviceType: 'AGENT_DN', dialNumber: '5678'},
      });
      restored.message({
        ...agentFrame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, {
          teamId: 'backup-team',
          deviceType: LoginOption.AGENT_DN,
          dn: '5678',
          isExtension: false,
        }),
        type: CC_EVENTS.AGENT_STATION_LOGIN,
      });
      await flush();
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'ready',
          operation: 'FAILBACK',
          scope: 'REGION',
          servingRegion: 'produs1',
        })
      );
      expect(requests.slice(start).map(({resource}) => resource)).toEqual([
        SUBSCRIBE_API,
        '/v1/agents/reload',
        '/v1/agents/session/state',
        SUBSCRIBE_API,
        '/v1/agents/reload',
        '/v1/agents/login',
      ]);
      for (const subscribe of requests.filter(({resource}) => resource === SUBSCRIBE_API)) {
        expect(subscribe).toMatchObject({
          method: 'POST',
          service: WCC_API_GATEWAY,
          headers: {'X-ORGANIZATION-ID': 'org'},
          timeout: 20000,
        });
      }
    });
  });

  it.each(['succeeded', 'failed', 'cancelled', 'socket-closed'])(
    'retains the browser line while automatic Available is %s',
    async (outcome) => {
      await withRouting(
        async ({cc, requests, connectBackup, login}) => {
          const calling = cc.webCallingService;
          const line = {mobiusDeviceId: 'browser-line', deregister: jest.fn()};
          const state = jest.fn();
          cc.on('region:stateChange', state);
          const register = jest
            .spyOn(calling, 'registerWebCallingLine')
            .mockImplementation(async () => {
              calling['line'] = line;
            });
          await login(LoginOption.BROWSER);
          expect(register).toHaveBeenCalledTimes(1);
          const backup = await connectBackup();
          backup.message(
            agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, {
              deviceType: LoginOption.BROWSER,
              lastStateChangeReason: 'agent-wss-disconnect',
            })
          );
          await flush();
          expect(register).toHaveBeenCalledTimes(1);
          expect(line.deregister).not.toHaveBeenCalled();
          expect(calling['line']).toBe(line);
          const stateRequests = () =>
            requests.filter(({resource}) => resource === '/v1/agents/session/state');
          expect(stateRequests()).toHaveLength(0);

          if (outcome === 'socket-closed') {
            backup.lose();
            calling['handleLineRegistered'](line);
            await flush();
            expect(stateRequests()).toHaveLength(0);
            expect(state).toHaveBeenLastCalledWith(
              expect.objectContaining({autoAvailable: 'cancelled'})
            );

            return;
          }
          const manual = outcome === 'cancelled';
          const stateChange = manual
            ? cc.setAgentState({state: 'Idle', auxCodeId: 'idle'})
            : undefined;
          calling['handleLineRegistered'](line);
          await flush();
          expect(stateRequests()).toHaveLength(1);
          expect(stateRequests()[0].body).toMatchObject({state: manual ? 'Idle' : 'Available'});
          backup.message({
            ...agentFrame(
              outcome === 'failed'
                ? CC_EVENTS.AGENT_STATE_CHANGE_FAILED
                : CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
              {
                subStatus: manual ? 'Idle' : 'Available',
                auxCodeId: manual ? 'idle' : '0',
                ...(outcome === 'failed' ? {reasonCode: 9999} : {}),
              }
            ),
            type: CC_EVENTS.AGENT_STATE_CHANGE,
          });
          await stateChange;
          await flush();
          expect(stateRequests()).toHaveLength(1);
          expect(state).toHaveBeenLastCalledWith(expect.objectContaining({autoAvailable: outcome}));
        },
        {browserVoice: true}
      );
    }
  );

  it('starts a missing browser line in the background when reload restores a browser station', async () => {
    await withRouting(
      async ({cc, connectBackup, login}) => {
        await login();
        const state = jest.fn();
        cc.on('region:stateChange', state);
        const line = createDeferred<void>();
        const register = jest
          .spyOn(cc.webCallingService, 'registerWebCallingLine')
          .mockReturnValue(line.promise);
        const backup = await connectBackup();
        backup.message(
          agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, {
            deviceType: undefined,
            dn: `${WEB_RTC_PREFIX}agent`,
            isExtension: false,
          })
        );
        await flush();

        expect(register).toHaveBeenCalledTimes(1);
        expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
        line.resolve();
        await flush();
      },
      {browserVoice: true}
    );
  });

  it('retries a transient regional subscribe failure before restoring the station', async () => {
    await withRouting(async ({
      cc, requests, currentRouting, startSwitch, advanceSwitch, setSubscribeFailure, login,
    }) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      setSubscribeFailure({statusCode: 503});
      startSwitch('FAILOVER');
      await advanceSwitch();

      const subscriptions = () => requests.filter(({resource}) => resource === SUBSCRIBE_API);
      expect(subscriptions()).toHaveLength(2);
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({status: 'recovering', retryAfterMs: 63000})
      );
      setSubscribeFailure();
      jest.advanceTimersByTime(62999);
      await flush();
      expect(subscriptions()).toHaveLength(2);
      jest.advanceTimersByTime(1);
      await flush();
      expect(subscriptions()).toHaveLength(3);
      const replacement = currentRouting();
      replacement.welcome();
      await flush();
      replacement.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
      await flush();
      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
    });
  });

  it('waits for the current reload to settle after socket loss before retrying the region', async () => {
    await withRouting(async ({cc, requests, currentRouting, connectBackup, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const backup = await connectBackup();
      const subscriptions = () => requests.filter(({resource}) => resource === SUBSCRIBE_API);
      const reloads = () => requests.filter(({resource}) => resource === '/v1/agents/reload');
      expect(subscriptions()).toHaveLength(2);
      expect(reloads()).toHaveLength(1);
      backup.lose();

      jest.advanceTimersByTime(19999);
      await flush();
      expect(subscriptions()).toHaveLength(2);
      expect(reloads()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      await flush();
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({status: 'recovering', retryAfterMs: 63000})
      );
      jest.advanceTimersByTime(63000);
      await flush();
      expect(subscriptions()).toHaveLength(3);
      const replacement = currentRouting();
      replacement.welcome();
      await flush();
      expect(reloads()).toHaveLength(2);
      replacement.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
      await flush();
      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
    });
  });

  it('refreshes U2C after a regional subscribe conflict and restores the accepted station', async () => {
    await withRouting(
      async ({
        cc, requests, currentRouting, startSwitch, advanceSwitch, setSubscribeFailure, login,
        updateServices,
      }) => {
        await login();
        const state = jest.fn();
        cc.on('region:stateChange', state);
        setSubscribeFailure(subscribeConflict('REGION_MISMATCH_NO_OVERRIDE'));
        startSwitch('FAILOVER');
        await advanceSwitch();

        expect(updateServices).toHaveBeenCalledTimes(1);
        expect(updateServices).toHaveBeenCalledWith({forceRefresh: true});
        const backup = currentRouting();
        expect(new URL(backup.url).hostname).toBe('routing.produs2.cisco.com');
        backup.welcome();
        await flush();
        backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038}));
        await flush();
        expect(requests.at(-1)).toMatchObject({
          resource: '/v1/agents/login',
          body: {teamId: 'team', deviceType: 'EXTENSION', dialNumber: '1234'},
        });
        backup.message({
          ...agentFrame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS),
          type: CC_EVENTS.AGENT_STATION_LOGIN,
        });
        await flush();

        expect(state).toHaveBeenLastCalledWith(
          expect.objectContaining({
            status: 'ready',
            operation: 'FAILOVER',
            servingRegion: 'produs2',
          })
        );
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(3);
      }
    );
  });

  it.each([false, true])(
    'completes the original registration after refreshing a subscribe conflict (resolved response=%s)',
    async (resolveSubscribeFailure) => {
      await withRouting(
        async ({cc, requests, currentRouting, updateServices}) => {
          const state = jest.fn();
          cc.on('region:stateChange', state);
          const registration = cc.register();
          await flush();
          expect(state).toHaveBeenLastCalledWith(
            expect.objectContaining({status: 'recovering', reason: 'region-mismatch'})
          );
          expect(updateServices).toHaveBeenCalledTimes(1);
          expect(updateServices).toHaveBeenCalledWith({forceRefresh: true});
          const socket = currentRouting();
          expect(new URL(socket.url).hostname).toBe('routing.produs2.cisco.com');
          socket.welcome();

          await expect(registration).resolves.toMatchObject({agentId: 'agent'});
          expect(state).toHaveBeenLastCalledWith(
            expect.objectContaining({status: 'stationLoginRequired'})
          );
          expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
          expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(2);
          expect(requests.filter(({resource}) => resource === '/v1/agents/login')).toHaveLength(0);
        },
        {
          initialSubscribeFailure: subscribeConflict('REGION_MISMATCH_REGION_FAILOVER'),
          resolveSubscribeFailure,
        }
      );
    }
  );

  it.each([
    {title: 'the refreshed subscribe still returns a regional conflict'},
    {title: 'refreshing U2C fails with expired credentials', refreshStatus: 401},
  ])('stops initial registration when $title', async ({refreshStatus}) => {
    await withRouting(
      async ({cc, requests, sockets, updateServices}) => {
        const state = jest.fn();
        cc.on('region:stateChange', state);
        if (refreshStatus) updateServices.mockRejectedValueOnce({statusCode: refreshStatus});
        else updateServices.mockImplementationOnce(async () => undefined);

        await expect(cc.register()).rejects.toMatchObject({
          statusCode: refreshStatus ?? 409,
        });
        expect(updateServices).toHaveBeenCalledTimes(1);
        expect(state).toHaveBeenLastCalledWith(
          expect.objectContaining({
            status: 'unavailable',
            reason: refreshStatus ? 'authentication-failed' : 'region-mismatch',
          })
        );
        jest.advanceTimersByTime(10 * 60 * 1000);
        await flush();
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API))
          .toHaveLength(refreshStatus ? 1 : 2);
        expect(sockets).toHaveLength(0);
      },
      {initialSubscribeFailure: subscribeConflict('REGION_MISMATCH_REGION_FAILOVER')}
    );
  });

  it('does not retry a region switch when multi-region is disabled for the org', async () => {
    await withRouting(
      async ({cc, requests, currentRouting, startSwitch, advanceSwitch}) => {
        const state = jest.fn();
        cc.on('region:stateChange', state);
        const primary = currentRouting();
        startSwitch('FAILOVER');
        await advanceSwitch();
        expect(state).toHaveBeenLastCalledWith(
          expect.objectContaining({
            status: 'unavailable',
            reason: 'not-eligible',
          })
        );
        expect(primary.close).toHaveBeenCalledTimes(1);
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(1);
      },
      {multiRegionEnabled: false}
    );
  });

  it.each([
    {title: 'the switch is for another org', overrides: {orgId: 'another-org'}},
    {title: 'the switch lacks tracking ID', overrides: {trackingId: undefined}},
    {title: 'the desktop profile has no entitlement', multiRegionEnabled: null},
  ])('keeps the routing socket when $title', async ({overrides, multiRegionEnabled}) => {
    await withRouting(
      async ({cc, requests, currentRouting, startSwitch, advanceSwitch}) => {
        const state = jest.fn();
        cc.on('region:stateChange', state);
        const primary = currentRouting();
        startSwitch('FAILOVER', overrides);
        await advanceSwitch();

        expect(primary.close).not.toHaveBeenCalled();
        expect(state).not.toHaveBeenCalled();
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(1);
      },
      {multiRegionEnabled}
    );
  });

  it('rejects regional Welcome for another agent before attempting station reload', async () => {
    await withRouting(async ({cc, requests, currentRouting, startSwitch, advanceSwitch, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      startSwitch('FAILOVER');
      await advanceSwitch();
      const backup = currentRouting();
      backup.welcome('another-agent');
      await flush();

      expect(backup.close).toHaveBeenCalledTimes(1);
      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'unavailable'}));
      expect(requests.some(({resource}) => resource === '/v1/agents/reload')).toBe(false);
    });
  });

  it('retries a transient 1037 reload on the adopted routing connection', async () => {
    await withRouting(async ({cc, requests, connectBackup, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const backup = await connectBackup();
      backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1037}));
      await flush();
      const reloads = () => requests.filter(({resource}) => resource === '/v1/agents/reload');

      jest.advanceTimersByTime(1999);
      await flush();
      expect(reloads()).toHaveLength(1);
      jest.advanceTimersByTime(1);
      await flush();
      expect(reloads()).toHaveLength(2);
      backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
      await flush();
      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
    });
  });

  it('reloads the existing station after fallback login returns 1035', async () => {
    await withRouting(async ({cc, requests, connectBackup, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const start = requests.length;
      const backup = await connectBackup();
      backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038}));
      await flush();
      backup.message({
        ...agentFrame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, {reasonCode: 1035}),
        type: CC_EVENTS.AGENT_STATION_LOGIN,
      });
      await flush();
      backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
      await flush();

      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
      expect(requests.slice(start).map(({resource}) => resource)).toEqual([
        SUBSCRIBE_API,
        '/v1/agents/reload',
        '/v1/agents/login',
        '/v1/agents/reload',
      ]);
    });
  });

  it('asks for station login after bounded 1037 retries and one unsuccessful fallback', async () => {
    await withRouting(async ({cc, requests, connectBackup, login}) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const start = requests.length;
      const backup = await connectBackup();
      for (const delay of [2000, 4000, 8000, 0]) {
        backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1037}));
        await flush();
        jest.advanceTimersByTime(delay);
        await flush();
      }
      backup.message({
        ...agentFrame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, {reasonCode: 9999}),
        type: CC_EVENTS.AGENT_STATION_LOGIN,
      });
      await flush();

      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'stationLoginRequired',
          reason: 'session-restore-failed',
        })
      );
      expect(requests.slice(start).map(({resource}) => resource)).toEqual([
        SUBSCRIBE_API,
        ...Array(4).fill('/v1/agents/reload'),
        '/v1/agents/login',
      ]);
    });
  });

  it.each([
    ['station was never logged in', false, 'region-switch'],
    ['automated relogin is disabled', true, 'automatic-relogin-disabled'],
  ])('uses the existing station login when %s', async (_scenario, hasStation, reason) => {
    await withRouting(
      async ({cc, requests, connectBackup, login}) => {
        if (hasStation) await login();
        cc.$config.allowAutomatedRelogin = false;
        const state = jest.fn();
        cc.on('region:stateChange', state);
        const start = requests.length;
        await connectBackup();

        expect(state).toHaveBeenLastCalledWith(
          expect.objectContaining({status: 'stationLoginRequired', reason})
        );
        expect(requests.slice(start).map(({resource}) => resource)).toEqual(
          hasStation ? [SUBSCRIBE_API] : [SUBSCRIBE_API, 'v1/realtime/subscribe']
        );
        await login();
        expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
        expect(requests.filter(({resource}) => resource === 'v1/realtime/subscribe')).toHaveLength(
          2
        );
      },
      {rtdEnabled: true}
    );
  });

  it.each([
    [subscribeConflict('REGION_MISMATCH_ORG_OVERRIDE'), 'unavailable', 'region-mismatch'],
    [{statusCode: 401}, 'unavailable', 'authentication-failed'],
  ])(
    'ends ordinary reconnect after terminal subscribe failure %j',
    async (failure, status, reason) => {
      await withRouting(async ({
        cc, requests, currentRouting, setSubscribeFailure, updateServices,
      }) => {
        const state = jest.fn();
        cc.on('region:stateChange', state);
        updateServices.mockImplementationOnce(async () => undefined);
        setSubscribeFailure(failure);
        currentRouting().lose();
        jest.advanceTimersByTime(5000);
        await flush();

        expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status, reason}));
        jest.advanceTimersByTime(60000);
        await flush();
        expect(updateServices).toHaveBeenCalledTimes(failure.statusCode === 409 ? 1 : 0);
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API))
          .toHaveLength(failure.statusCode === 409 ? 3 : 2);
      });
    }
  );

  it.each([
    {title: 'restores the accepted station'},
    {title: 'reloads a station that already exists', loginFailure: 1035},
    {title: 'hands an unsuccessful station restore to the app', loginFailure: 9999},
  ])('refreshes ordinary reconnect routing and $title', async ({loginFailure}) => {
    await withRouting(async ({
      cc, requests, currentRouting, setSubscribeFailure, login, updateServices,
    }) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const invalidateTasks = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      const start = requests.length;
      setSubscribeFailure(subscribeConflict('REGION_MISMATCH_ORG_OVERRIDE'));
      currentRouting().lose();
      jest.advanceTimersByTime(5000);
      await flush();

      expect(updateServices).toHaveBeenCalledTimes(1);
      expect(invalidateTasks).toHaveBeenCalledTimes(1);
      expect(invalidateTasks.mock.invocationCallOrder[0])
        .toBeLessThan(updateServices.mock.invocationCallOrder[0]);
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({status: 'recovering', reason: 'region-mismatch'})
      );
      expect(state.mock.calls.at(-1)[0].servingRegion).toBeUndefined();
      const replacement = currentRouting();
      expect(new URL(replacement.url).hostname).toBe('routing.produs2.cisco.com');
      replacement.welcome();
      await flush();
      replacement.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038}));
      await flush();
      expect(requests.at(-1)).toMatchObject({
        resource: '/v1/agents/login',
        body: {teamId: 'team', deviceType: 'EXTENSION', dialNumber: '1234'},
      });
      replacement.message({
        ...agentFrame(
          loginFailure ? CC_EVENTS.AGENT_STATION_LOGIN_FAILED : CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
          loginFailure ? {reasonCode: loginFailure} : {}
        ),
        type: CC_EVENTS.AGENT_STATION_LOGIN,
      });
      await flush();
      if (loginFailure === 1035) {
        expect(requests.at(-1)).toMatchObject({resource: '/v1/agents/reload'});
        replacement.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
        await flush();
      }

      expect(state).toHaveBeenLastCalledWith(expect.objectContaining({
        status: loginFailure === 9999 ? 'stationLoginRequired' : 'ready',
      }));
      expect(requests.slice(start).map(({resource}) => resource)).toEqual([
        SUBSCRIBE_API,
        SUBSCRIBE_API,
        '/v1/agents/reload',
        '/v1/agents/login',
        ...(loginFailure === 1035 ? ['/v1/agents/reload'] : []),
      ]);
    });
  });

  it('ends regional recovery if refreshing U2C rejects the credentials', async () => {
    await withRouting(async ({
      cc, requests, startSwitch, advanceSwitch, setSubscribeFailure, updateServices,
    }) => {
      const state = jest.fn();
      cc.on('region:stateChange', state);
      updateServices.mockRejectedValueOnce({statusCode: 401});
      setSubscribeFailure(subscribeConflict('REGION_MISMATCH_NO_OVERRIDE'));
      startSwitch('FAILOVER');
      await advanceSwitch();

      expect(updateServices).toHaveBeenCalledTimes(1);
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({status: 'unavailable', reason: 'authentication-failed'})
      );
      jest.advanceTimersByTime(10 * 60 * 1000);
      await flush();
      expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(2);
    });
  });

  it('uses ordinary reconnect after a subscribe 409 with an unrelated reason', async () => {
    await withRouting(async ({
      cc, requests, currentRouting, setSubscribeFailure, login, updateServices,
    }) => {
      await login();
      const state = jest.fn();
      cc.on('region:stateChange', state);
      const start = requests.length;
      setSubscribeFailure(subscribeConflict('UNRELATED_CONFLICT'));
      currentRouting().lose();
      jest.advanceTimersByTime(5000);
      await flush();
      setSubscribeFailure();
      jest.advanceTimersByTime(5000);
      await flush();

      const replacement = currentRouting();
      replacement.welcome();
      await flush();
      replacement.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
      await flush();
      expect(updateServices).not.toHaveBeenCalled();
      expect(requests.slice(start).map(({resource}) => resource)).toEqual([
        SUBSCRIBE_API,
        SUBSCRIBE_API,
        '/v1/agents/reload',
      ]);
    });
  });

  it('preserves the ordinary registration rejection on a subscribe authentication error', async () => {
    await withRouting(
      async ({cc, sockets}) => {
        await expect(cc.register()).rejects.toMatchObject({statusCode: 403});
        expect(sockets).toHaveLength(0);
      },
      {initialSubscribeFailure: {statusCode: 403}}
    );
  });

  it.each([
    {title: 'welcomes the replacement socket'},
    {
      title: 'refreshes U2C after a region mismatch',
      failure: subscribeConflict('REGION_MISMATCH_NO_OVERRIDE'),
    },
    {title: 'rejects expired credentials', failure: {statusCode: 401}},
  ])('registration uses ordinary reconnect and $title', async ({failure}) => {
    await withRouting(
      async ({cc, requests, currentRouting, setSubscribeFailure, updateServices}) => {
        const configService = cc.services.config;
        const getProfile = configService.getAgentConfig.bind(configService);
        const profileAvailable = createDeferred<void>();
        jest.spyOn(configService, 'getAgentConfig').mockImplementation(async (orgId, agentId) => {
          const profile = await getProfile(orgId, agentId);
          await profileAvailable.promise;

          return profile;
        });
        cc.$config.allowAutomatedRelogin = true;
        const registration = cc.register();
        registration.catch(() => undefined);
        await flush();
        currentRouting().welcome();
        await flush();
        currentRouting().lose();
        profileAvailable.resolve();
        await flush();

        setSubscribeFailure(failure);
        jest.advanceTimersByTime(5000);
        await flush();
        const authFailure = failure?.statusCode === 401;
        if (!authFailure) {
          currentRouting().welcome();
          await flush();
          currentRouting().message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
          await expect(registration).resolves.toMatchObject({isAgentLoggedIn: true});
        } else {
          await expect(registration).rejects.toMatchObject({
            statusCode: 401,
          });
        }
        expect(updateServices).toHaveBeenCalledTimes(failure?.statusCode === 409 ? 1 : 0);
        expect(requests.filter(({resource}) => resource === SUBSCRIBE_API))
          .toHaveLength(failure?.statusCode === 409 ? 3 : 2);
      },
      {autoRegister: false}
    );
  });

  it('does not resume a pending regional subscription after deregister', async () => {
    await withRouting(async ({cc, requests, startSwitch, advanceSwitch}) => {
      startSwitch('FAILOVER');
      await cc.deregister();
      await advanceSwitch();

      expect(requests.filter(({resource}) => resource === SUBSCRIBE_API)).toHaveLength(1);
    });
  });

  it.each([
    {title: 'local logout', local: true, sessionId: 'session', restores: false},
    {
      title: 'a remote logout for this session',
      local: false,
      sessionId: 'session',
      restores: false,
    },
    {
      title: 'a remote logout for another session',
      local: false,
      sessionId: 'other-session',
      restores: true,
    },
  ])('uses the active station after $title', async ({local, sessionId, restores}) => {
    await withRouting(async ({cc, requests, currentRouting, connectBackup, login}) => {
      await login();
      const logout = local ? cc.stationLogout({logoutReason: 'User requested'}) : undefined;
      await flush();
      currentRouting().message({
        ...agentFrame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, {agentSessionId: sessionId}),
        type: CC_EVENTS.AGENT_LOGOUT,
      });
      await logout;

      const state = jest.fn();
      cc.on('region:stateChange', state);
      const backup = await connectBackup();
      if (restores) {
        backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
        await flush();
      }
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({status: restores ? 'ready' : 'stationLoginRequired'})
      );
      expect(requests.some(({resource}) => resource === '/v1/agents/reload')).toBe(restores);
    });
  });

  it.each([undefined, 503])(
    'recovers routing independently of RTD subscription failure %s',
    async (rtdReconnectFailure) => {
      await withRouting(
        async ({cc, requests, sockets, currentRouting, startSwitch, advanceSwitch, login}) => {
          const oldRtd = sockets.find((socket) => socket.url.includes('rtd.'));
          oldRtd.welcome();
          await flush();
          await login();
          const state = jest.fn();
          cc.on('region:stateChange', state);
          startSwitch('FAILOVER');
          await advanceSwitch();
          const backup = currentRouting();
          backup.welcome();
          await flush();
          backup.message(agentFrame(CC_EVENTS.AGENT_RELOGIN_SUCCESS));
          await flush();
          expect(state).toHaveBeenLastCalledWith(expect.objectContaining({status: 'ready'}));
          expect(oldRtd.close).toHaveBeenCalledTimes(1);
          expect(
            requests.filter(({resource}) => resource === 'v1/realtime/subscribe')
          ).toHaveLength(2);
          expect(sockets.filter((socket) => socket.url.includes('rtd.'))).toHaveLength(
            rtdReconnectFailure ? 1 : 2
          );
        },
        {rtdEnabled: true, rtdReconnectFailure}
      );
    }
  );
});
