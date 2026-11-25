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
  VoiceLineStatus,
  WELLNESS_BREAK_USER_ACTIONS,
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
  WEB_RTC_PREFIX,
} from '../../../src/services/constants';
import Services from '../../../src/services';
import config from '../../../src/config';
import {CC_TASK_EVENTS, CC_EVENTS} from '../../../src/services/config/types';
import LoggerProxy from '../../../src/logger-proxy';
import * as Utils from '../../../src/services/core/Utils';
import {
  CC_FILE,
  METHODS,
  OUTDIAL_DIRECTION,
  OUTBOUND_TYPE,
  ATTRIBUTES,
  OUTDIAL_MEDIA_TYPE,
  TIMEOUT_DURATION,
  AI_SUMMARY_ERROR_CODES,
  REGION_RECOVERY_ERROR_CODES,
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
      agent: {
        stationLogin: jest.fn(),
        logout: jest.fn(),
        reload: jest.fn(),
        stateChange: jest.fn(),
        buddyAgents: jest.fn(),
      },
      config: {
        getAgentConfig: jest.fn(),
        getMultiRegionSettings: jest.fn().mockResolvedValue({eligibility: 'disabled'}),
        getOutdialAniEntries: jest.fn(),
      },
      webSocketManager: {
        initWebSocket: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        cancelPending: jest.fn(),
        isSocketClosed: false,
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
      },
      rtdWebSocketManager: {
        initWebSocket: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        cancelPending: jest.fn(),
        isSocketClosed: false,
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
      },
      aqmReqs: {beginGeneration: jest.fn(), setRecoveryGate: jest.fn(), interruptPending: jest.fn(),
        isLocalSessionTrackingId: jest.fn(() => true)},
      connectionService: {
        reset: jest.fn(), stop: jest.fn(), pause: jest.fn(),
        recoverRegion: jest.fn(() => new Promise(() => {})),
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
      setAnswerCallOnWebexService: jest.fn(),
      registerIncomingCallEvent: jest.fn(),
      registerTaskListeners: jest.fn(),
      unregisterIncomingCallEvent: jest.fn(),
      getTask: jest.fn(),
      getActiveTasks: jest.fn(),
      handleRealtimeWebsocketEvent: jest.fn(),
      clearAISummaryState: jest.fn(),
      startSession: jest.fn(), stopSession: jest.fn(),
      interruptTaskOperations: jest.fn(), invalidateRegionalTasks: jest.fn(),
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
    public off = jest.fn();
    public getVoiceConnectionState = jest.fn(() => ({
      status: 'unavailable',
      lineStatus: 'unregistered',
      mobiusSocketStatus: 'disconnected',
    }));
    public isBrowserVoiceRequired = jest.fn(() => false);
    public isVoiceReady = jest.fn(() => false);
    public ensureWebCallingLine = jest.fn().mockResolvedValue(undefined);
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
jest.mock('uuid', () => ({v4: jest.fn(() => 'mock-tracking-uuid')}));

global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');

class EventEmitterDouble extends EventEmitter {
  public isSocketClosed = false;
  public cancelPending = jest.fn();
  public stop = jest.fn();
  public pause = jest.fn();
  public reset = jest.fn();
  public getServingRegion = jest.fn();
  public clearServingRegion = jest.fn();
  public hasUsableSocket = jest.fn(() => true);
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

  const bindRtdUnitOwner = () => {
    const epochController = new AbortController();
    webex.cc['rtdPaused'] = false;
    webex.cc['rtdEpoch'] = {active: true, controller: epochController,
      parent: epochController.signal, registration: 0, station: 0,
      orgId: 'mockOrgId', agentId: undefined, promise: Promise.resolve(), detach: () => undefined};
    jest.spyOn(webex.cc, 'isCurrentRtdEpoch').mockImplementation(epoch =>
      webex.cc['rtdEpoch'] === epoch && !epoch.controller.signal.aborted);
  };

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
      cancelPending: jest.fn(),
      isSocketClosed: false,
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
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
        getMultiRegionSettings: jest.fn().mockResolvedValue({eligibility: 'disabled'}),
        getOutdialAniEntries: jest.fn(),
        getWellbeingBreakIdleCode: jest.fn(),
      },
      webSocketManager: mockWebSocketManager,
      rtdWebSocketManager: {
        initWebSocket: jest.fn().mockResolvedValue({}),
        on: jest.fn(),
        off: jest.fn(),
        close: jest.fn(),
        cancelPending: jest.fn(),
        isSocketClosed: false,
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
      },
      aqmReqs: {beginGeneration: jest.fn(), setRecoveryGate: jest.fn(), interruptPending: jest.fn(),
        isLocalSessionTrackingId: jest.fn(() => true)},
      connectionService: {
        reset: jest.fn(), stop: jest.fn(), pause: jest.fn(),
        recoverRegion: jest.fn(() => new Promise(() => {})),
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
      startSession: jest.fn(), stopSession: jest.fn(),
      interruptTaskOperations: jest.fn(), invalidateRegionalTasks: jest.fn(),
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

  describe('MR-09 bounded diagnostics and observer delivery', () => {
    it.each(['region-switch', 'RECOVERY_INTERRUPTED', 'untrusted remote text'])('T-013 diagnosticPayloadAllowlist reason=%s', reason => {
      const failure = {status: 503, reasonCode: 1037, id: 'Timeout\n', trackingId: 'tracking\r', reason,
        response: {options: {headers: {authorization: 'BEARER_SECRET'}, body: {dialNumber: 'DN_SECRET'}}}, url: 'URL_SECRET'};
      const now = Date.now(); jest.spyOn(Date, 'now').mockReturnValue(now);
      webex.cc['recordRecoveryDiagnostic']('admission', 'retrying', 2, now - 25, failure);
      const expected = {stage: 'admission', outcome: 'retrying', attempt: 2, elapsedMs: 25,
        status: 503, reasonCode: 1037, id: 'Timeout', trackingId: 'tracking',
        ...(reason === 'untrusted remote text' ? {} : {reason})};
      expect(LoggerProxy.info).toHaveBeenCalledWith('Region recovery', {module: 'cc', method: 'recordRecoveryDiagnostic', data: expected});
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED, expected, ['operational']);
      expect(JSON.stringify([LoggerProxy.info.mock.calls, mockMetricsManager.trackEvent.mock.calls])).not.toMatch(/SECRET|response|options|duration_ms|untrusted remote text/);
      expect(mockMetricsManager.timeEvent).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
    it('T-012 throwing logger and metric are independent and cannot alter safe projection', () => {
      LoggerProxy.info.mockImplementationOnce((_message, context) => {context.data.status = 401; throw new Error('sink');});
      expect(() => webex.cc['recordRecoveryDiagnostic']('admission', 'terminal', 1, Date.now(), {status: 503})).not.toThrow();
      expect(mockMetricsManager.trackEvent.mock.calls[0][1].status).toBe(503);
      mockMetricsManager.trackEvent.mockImplementationOnce(() => {throw new Error('metric');});
      expect(() => webex.cc['recordRecoveryDiagnostic']('admission', 'succeeded', 1, Date.now())).not.toThrow();
    });
    it.each([[NaN, 1], [1, Infinity], [-1, 1]])('T-013 invalid diagnostic local inputs %s %s', (attempt, startedAt) => {
      webex.cc['recordRecoveryDiagnostic']('admission', 'failed', attempt, startedAt, {status: 401});
      expect(LoggerProxy.info).not.toHaveBeenCalled(); expect(mockMetricsManager.trackEvent).not.toHaveBeenCalled();
    });
    it('T-012 regionDiagnosticSupersessionOwnsElapsed rechecks before the second sink', () => {
      LoggerProxy.info.mockImplementationOnce(() => {webex.cc['terminateRegistration']();});
      webex.cc['recordRecoveryDiagnostic']('admission', 'succeeded', 1, Date.now());
      expect(mockMetricsManager.trackEvent.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS)).toHaveLength(0);
    });
    it.each([
      [CC_EVENTS.AGENT_STATE_CHANGE, CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS],
      [CC_EVENTS.AGENT_STATE_CHANGE, CC_EVENTS.AGENT_STATE_CHANGE_FAILED, AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED],
      [CC_EVENTS.AGENT_STATION_LOGIN, CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS],
      [CC_EVENTS.AGENT_STATION_LOGIN, CC_EVENTS.AGENT_STATION_LOGIN_FAILED, AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED],
      [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_RELOGIN_SUCCESS, AGENT_EVENTS.AGENT_RELOGIN_SUCCESS],
      [CC_EVENTS.AGENT_LOGOUT, CC_EVENTS.AGENT_LOGOUT_SUCCESS, AGENT_EVENTS.AGENT_LOGOUT_SUCCESS],
      [CC_EVENTS.AGENT_LOGOUT, CC_EVENTS.AGENT_LOGOUT_FAILED, AGENT_EVENTS.AGENT_LOGOUT_FAILED],
      [CC_EVENTS.AGENT_DN_REGISTERED, CC_EVENTS.AGENT_DN_REGISTERED, AGENT_EVENTS.AGENT_DN_REGISTERED],
    ])('T-012 affectedPublicForwardingContainsThrow %s %s', (type, nested, specialized) => {
      const first = () => {throw new Error('host');}; const later = jest.fn(); const all = jest.fn(); const specializedListener = jest.fn();
      webex.cc.on(nested, first); webex.cc.on(nested, later); webex.cc.on('all', all);
      webex.cc.on(specialized, specializedListener);
      const data = {type: nested, channelsMap: {}};
      expect(() => webex.cc['handleWebsocketMessage'](JSON.stringify({type, data}))).not.toThrow();
      expect(later).not.toHaveBeenCalled();
      expect(all.mock.calls.filter(([event]) => event === nested)).toHaveLength(0);
      expect(specializedListener).toHaveBeenCalledTimes(1);
    });
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

    const mockAgentProfile: Profile = createFreshAgentProfile();

    describe('MR-06 station recovery coordination', () => {
      const settle = async () => { for (let i = 0; i < 24; i += 1) await Promise.resolve(); };
      const result = (overrides = {}) => ({type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
        orgId: 'mockOrgId', trackingId: 'outer', data: {
          type: CC_EVENTS.AGENT_RELOGIN_SUCCESS, orgId: 'mockOrgId', agentId: 'agent123',
          agentSessionId: 'session', teamId: 'team', deviceType: LoginOption.EXTENSION,
          dn: '1234', isExtension: true, auxCodeId: 'idle', lastStateChangeTimestamp: 10,
          lastIdleCodeChangeTimestamp: 11, channelsMap: {}, trackingId: 'nested', ...overrides,
        }});
      const switchEvent = (trackingId = 'switch') => JSON.stringify({
        type: 'SYSTEM_REGION_SWITCH', orgId: 'mockOrgId', trackingId,
        data: {operation: 'FAILOVER', scope: 'ORG'},
      });
      const prepare = async (eligibility = 'enabled', restored = false, restoredResponse = result()) => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: restored};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION],
        }));
        webex.cc.services.config.getMultiRegionSettings.mockResolvedValue({eligibility, homeRegion: 'produs1'});
        webex.cc.services.agent.reload.mockResolvedValue(restoredResponse);
        webex.cc.services.agent.stationLogin.mockResolvedValue(result());
        webex.cc.services.agent.logout.mockResolvedValue({data: {}});
        await webex.cc.register(); await settle();
        webex.cc.services.agent.reload.mockClear();
      };
      const acceptedFields = () => ({
        sessionId: webex.cc['currentAgentSessionId'],
        priorStationActive: webex.cc['priorStationActive'],
        isAgentLoggedIn: webex.cc.agentConfig.isAgentLoggedIn,
        teamId: webex.cc.agentConfig.currentTeamId,
        deviceType: webex.cc.agentConfig.deviceType,
        dn: webex.cc.agentConfig.dn,
        defaultDn: webex.cc.agentConfig.defaultDn,
        auxCodeId: webex.cc.agentConfig.lastStateAuxCodeId,
        lastStateChangeTimestamp: webex.cc.agentConfig.lastStateChangeTimestamp,
        lastIdleCodeChangeTimestamp: webex.cc.agentConfig.lastIdleCodeChangeTimestamp,
        status: webex.cc['confirmedState']?.data.status,
        subStatus: webex.cc['confirmedState']?.data.subStatus,
        lastStateChangeReason: webex.cc['confirmedState']?.data.lastStateChangeReason,
      });
      const expectAcceptedStation = (payload, response) => {
        expect(webex.cc['acceptedStation']).toEqual({
          orgId: 'mockOrgId', agentId: 'agent123', sessionId: response.data.agentSessionId,
          revision: webex.cc['stationRevision'], payload,
        });
        expect(acceptedFields()).toEqual({
          sessionId: response.data.agentSessionId, priorStationActive: true, isAgentLoggedIn: true,
          teamId: payload.teamId, deviceType: payload.deviceType,
          dn: payload.dialNumber, defaultDn: payload.dialNumber,
          auxCodeId: response.data.auxCodeId,
          lastStateChangeTimestamp: response.data.lastStateChangeTimestamp,
          lastIdleCodeChangeTimestamp: response.data.lastIdleCodeChangeTimestamp,
          status: response.data.status, subStatus: response.data.subStatus,
          lastStateChangeReason: response.data.lastStateChangeReason,
        });
      };
      const accept = () => {
        webex.cc['handleWebsocketMessage'](switchEvent());
        return webex.cc.services.connectionService.recoverRegion.mock.calls.slice(-1)[0]?.[0];
      };
      const welcome = async (options, controller = new AbortController()) => {
        const publishOutcome = await options.afterWelcome({agentId: 'agent123'}, controller.signal);
        publishOutcome?.();
        await settle();
      };
      it.each(['stationLogin', 'silentRelogin', 'stationLogout', 'setAgentState', 'updateAgentProfile', 'startOutdial'])(
        'T-008 lifecycleCallerCatchPreservesIdentityAndReason cc.%s', async operation => {
          await prepare('enabled', true);
          const reason = REGION_RECOVERY_ERROR_CODES.RECOVERY_INTERRUPTED;
          const error = Utils.createRegionRecoveryError(reason, {trackingId: 'safe', status: 409});
          const data = error.data;
          const agent = webex.cc.services.agent;
          const backend = operation === 'silentRelogin' ? agent.reload
            : operation === 'stationLogin' ? agent.stationLogin
            : operation === 'stationLogout' || operation === 'updateAgentProfile' ? agent.logout
            : operation === 'setAgentState' ? agent.stateChange : webex.cc.services.dialer.startOutdial;
          backend.mockRejectedValueOnce(error);
          LoggerProxy.error.mockClear(); mockWebexRequest.uploadLogs.mockClear();
          const logins = agent.stationLogin.mock.calls.length;
          const runners = {
            stationLogin: () => webex.cc.stationLogin({teamId: 'other', loginOption: LoginOption.EXTENSION, dialNumber: '9999'}),
            silentRelogin: () => webex.cc['silentRelogin'](),
            stationLogout: () => webex.cc.stationLogout({logoutReason: 'user'}),
            setAgentState: () => webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'}),
            updateAgentProfile: () => webex.cc.updateAgentProfile({teamId: 'other', loginOption: LoginOption.EXTENSION, dialNumber: '9999'}),
            startOutdial: () => webex.cc.startOutdial({destination: '9999', entryPointId: 'entry'}),
          };
          await expect(runners[operation]()).rejects.toBe(error);
          expect(error.data).toBe(data);
          expect(error.data).toEqual({reason, trackingId: 'safe', status: 409});
          expect(getErrorDetailsSpy.mock.results.some(result => result.value?.error === error && result.value?.reason === reason)).toBe(true);
          expect(LoggerProxy.error.mock.calls).toEqual(operation === 'updateAgentProfile' ? [[
            `error updating profile: Error: ${reason}`, {module: CC_FILE, method: METHODS.UPDATE_AGENT_PROFILE,
              trackingId: 'WX_CC_SDK_mock-tracking-uuid'},
          ]] : []);
          expect(mockWebexRequest.uploadLogs).not.toHaveBeenCalled();
          if (operation === 'silentRelogin' || operation === 'updateAgentProfile')
            expect(agent.stationLogin).toHaveBeenCalledTimes(logins);
        }
      );

      const stationCases = [
        {prerequisite: 'dnStationPrerequisitesPreserved', deviceType: LoginOption.AGENT_DN,
          webRtcEnabled: true, disableWebRTCRegistration: false},
        {prerequisite: 'extensionStationPrerequisitesPreserved', deviceType: LoginOption.EXTENSION,
          webRtcEnabled: true, disableWebRTCRegistration: false},
        ...[true, false].flatMap(webRtcEnabled => [true, false].map(disableWebRTCRegistration => ({
          prerequisite: 'browserStationPrerequisitesPreserved', deviceType: LoginOption.BROWSER,
          webRtcEnabled, disableWebRTCRegistration,
        }))),
      ];
      const stationPayload = (deviceType, dialNumber, teamId) => ({
        deviceType, dialNumber, deviceId: dialNumber, isExtension: deviceType === LoginOption.EXTENSION,
        teamId, roles: [AGENT], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: '',
      });
      const observeStationEffects = ({webRtcEnabled, disableWebRTCRegistration}) => {
        webex.cc.agentConfig.webRtcEnabled = webRtcEnabled;
        webex.cc.$config = {...webex.cc.$config, disableWebRTCRegistration, enableWxBetterTogether: true};
        webex.internal.device = {userId: 'restored-user', registered: true};
        webex.internal.mercury.connected = false;
        const connect = jest.spyOn(webex.internal.mercury, 'connect').mockImplementation(async () => {
          webex.internal.mercury.connected = true;
        });
        const publish = jest.spyOn(webex.cc['webexCrossClientService'], 'setManageWebexCallingInWxcc')
          .mockResolvedValue(undefined);
        const subscribe = jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'subscribe')
          .mockImplementation(() => {});
        jest.spyOn(webex.cc['wxAppTelephonyMercurySync'], 'isSubscribed').mockReturnValue(true);
        jest.spyOn(webex.cc['webexCrossClientService'], 'isAnswerCallsStateActive').mockReturnValue(true);
        const postLogin = jest.spyOn(webex.cc, 'ensureWxAppPostStationLogin');
        const acceptStation = jest.spyOn(webex.cc, 'rememberAcceptedStation');
        const device = jest.spyOn(webex.cc, 'handleDeviceType');
        const calling = webex.cc.webCallingService;
        [calling.setLoginOption, calling.setBrowserVoiceRequired, calling.ensureWebCallingLine,
          calling.registerWebCallingLine, calling.deregisterWebCallingLine,
          mockTaskManager.syncWxAppMuteFromCallDetailsForAllTasks,
          mockTaskManager.refreshWxAppOfferObservabilityForAllTasks, mockMetricsManager.trackEvent]
          .forEach(mock => mock.mockClear());
        return {connect, publish, subscribe, postLogin, acceptStation, device};
      };
      const expectStationEffects = (stationCase, effects) => {
        const {deviceType, webRtcEnabled, disableWebRTCRegistration} = stationCase;
        const browser = deviceType === LoginOption.BROWSER;
        const voiceRequired = browser && webRtcEnabled && !disableWebRTCRegistration;
        const calling = webex.cc.webCallingService;
        expect(calling.setLoginOption).toHaveBeenLastCalledWith(deviceType);
        expect(calling.setBrowserVoiceRequired).toHaveBeenLastCalledWith(voiceRequired);
        expect(calling.ensureWebCallingLine).toHaveBeenCalledTimes(voiceRequired ? 1 : 0);
        if (voiceRequired) expect(calling.ensureWebCallingLine).toHaveBeenCalledWith(expect.any(AbortSignal));
        expect(calling.registerWebCallingLine).not.toHaveBeenCalled();
        expect(calling.deregisterWebCallingLine).not.toHaveBeenCalled();
        expect(effects.postLogin).toHaveBeenCalledTimes(1);
        expect(effects.postLogin).toHaveBeenCalledWith(expect.any(AbortSignal));
        expect(effects.acceptStation.mock.invocationCallOrder[0])
          .toBeLessThan(effects.postLogin.mock.invocationCallOrder[0]);
        expect(effects.connect).toHaveBeenCalledTimes(browser ? 0 : 1);
        expect(effects.subscribe.mock.calls).toEqual(browser ? [] : [['agent123', expect.any(Function)]]);
        expect(effects.publish.mock.calls).toEqual(browser ? [] : [[true, {
          userId: 'restored-user', trackPublishMetrics: true, signal: expect.any(AbortSignal),
        }]]);
        if (!browser) expect(effects.publish.mock.calls[0][1].signal).toBe(effects.postLogin.mock.calls[0][0]);
        for (const effect of [effects.subscribe, effects.publish]) {
          if (!browser) expect(effects.acceptStation.mock.invocationCallOrder[0])
            .toBeLessThan(effect.mock.invocationCallOrder[0]);
        }
        expect(mockTaskManager.syncWxAppMuteFromCallDetailsForAllTasks).toHaveBeenCalledTimes(browser ? 0 : 1);
        expect(mockTaskManager.refreshWxAppOfferObservabilityForAllTasks).toHaveBeenCalledTimes(browser ? 0 : 1);
        expect(mockMetricsManager.trackEvent.mock.calls.filter(([event]) =>
          event === METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED)).toEqual(browser ? [[
          METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED,
          {loginOption: deviceType, enableWxBetterTogether: true, skipReason: 'unsupported_browser_login'},
          ['operational', 'behavioral'],
        ]] : []);
      };
      const captureSwitchOwner = () => {
        const cc = webex.cc;
        return {
          registration: [cc['registrationGeneration'], cc['registrationOrgId'],
            cc['registrationAgentId'], cc['registrationAbortController'],
            cc['registrationAbortController']?.signal.aborted],
          station: [cc['stationRevision'], cc['currentAgentSessionId'], cc['priorStationActive'],
            cc['suppressAutomaticRelogin'], cc['logoutPending'], {...cc.agentConfig},
            cc['acceptedStation'] && {...cc['acceptedStation'], payload: {...cc['acceptedStation'].payload}}],
          recovery: [cc['recoveryGeneration'], cc['recoveryPhase'],
            cc['recovery'] && {...cc['recovery']}, cc['recovery']?.controller.signal.aborted,
            cc['commandController'], cc['commandController']?.signal.aborted,
            cc['sessionRequest'], cc['sessionRequest']?.controller.signal.aborted,
            cc['autoAvailable'] && {...cc['autoAvailable']}],
          rtd: [cc['rtdPaused'], cc['rtdEpoch'], cc['rtdEpoch']?.controller.signal.aborted],
          settings: {...cc['multiRegionSettings']},
          history: [...cc['acceptedSwitchIds']],
          publication: [cc['lastPublishedRegionState'] && {...cc['lastPublishedRegionState']},
            {...cc['regionStateContext']}],
          placement: [mockWebSocketManager.getServingRegion(),
            cc.services.rtdWebSocketManager.getServingRegion()],
        };
      };
      const switchActions = () => {
        const services = webex.cc.services;
        return [
          services.connectionService.reset, services.connectionService.stop,
          services.connectionService.pause, services.connectionService.recoverRegion,
          ...[services.webSocketManager, services.rtdWebSocketManager].flatMap(manager => [
            manager.initWebSocket, manager.close, manager.cancelPending, manager.clearServingRegion,
          ]),
          services.aqmReqs.beginGeneration, services.aqmReqs.setRecoveryGate,
          services.aqmReqs.interruptPending,
          mockTaskManager.startSession, mockTaskManager.stopSession,
          mockTaskManager.interruptTaskOperations,
          mockTaskManager.invalidateRegionalTasks, services.agent.reload, services.agent.stationLogin,
          services.agent.logout, services.agent.stateChange,
          webex.cc.webCallingService.registerWebCallingLine,
          webex.cc.webCallingService.deregisterWebCallingLine,
        ].map(action => action.mock.calls.length);
      };
      afterEach(() => {
        webex.cc['cancelRegionRecovery']();
        webex.cc['registrationAbortController']?.abort();
        jest.useRealTimers();
      });

      it.each(stationCases.flatMap(stationCase => ['reload', 'fallback'].map(route => ({...stationCase, route}))))(
        'T-007 $prerequisite / wxAppEffectsAfterStationRestore / backendSessionEffects / noEarlyReady: $route webRtcEnabled=$webRtcEnabled disabled=$disableWebRTCRegistration',
        async stationCase => {
          const {deviceType, route} = stationCase;
          const browser = deviceType === LoginOption.BROWSER;
          await prepare('enabled', true, result({deviceType, dn: '18005550111', teamId: 'saved-team',
            agentSessionId: 'saved-session'}));
          const saved = stationPayload(deviceType, browser ? 'webrtc-agent123' : '18005550111', 'saved-team');
          expect(webex.cc['acceptedStation'].payload).toEqual(saved);
          const effects = observeStationEffects(stationCase);
          const backend = createDeferred<any>();
          const response = result({type: route === 'reload' ? CC_EVENTS.AGENT_RELOGIN_SUCCESS : CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
            deviceType, dn: '18005550222', teamId: 'restored-team', agentSessionId: 'restored-session',
            auxCodeId: 'restored-idle', lastStateChangeTimestamp: 101, lastIdleCodeChangeTimestamp: 102});
          if (route === 'reload') webex.cc.services.agent.reload.mockReturnValueOnce(backend.promise);
          else {
            webex.cc.services.agent.reload.mockRejectedValueOnce({data: {reasonCode: 1038}});
            webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
          }
          const states = jest.fn();
          webex.cc.on('region:stateChange', states);
          const options = accept();
          // Entry-time RTD pause has its own summary cleanup; measure station cleanup after it.
          mockTaskManager.invalidateRegionalTasks.mockClear();
          mockTaskManager.clearAISummaryState.mockClear();
          const before = acceptedFields();
          const pending = welcome(options); await settle();
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stationLogin.mock.calls.map(([request]) => request))
            .toEqual(route === 'fallback' ? [{data: saved}] : []);
          expect(acceptedFields()).toEqual(before);
          expect(effects.postLogin).not.toHaveBeenCalled();
          expect(effects.device).not.toHaveBeenCalled();
          expect(effects.subscribe).not.toHaveBeenCalled();
          expect(effects.publish).not.toHaveBeenCalled();
          expect(webex.cc.webCallingService.ensureWebCallingLine).not.toHaveBeenCalled();
          expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([]);
          expect(mockTaskManager.invalidateRegionalTasks).toHaveBeenCalledTimes(1);
          expect(mockTaskManager.clearAISummaryState).toHaveBeenCalledTimes(1);
          const dispatch = route === 'reload' ? webex.cc.services.agent.reload : webex.cc.services.agent.stationLogin;
          expect(mockTaskManager.invalidateRegionalTasks.mock.invocationCallOrder[0])
            .toBeLessThan(dispatch.mock.invocationCallOrder[0]);

          backend.resolve(response); await pending;

          const number = browser ? 'webrtc-agent123' : route === 'reload' ? '18005550222' : '18005550111';
          expectAcceptedStation(stationPayload(deviceType, number, 'restored-team'), response);
          expect(effects.device.mock.calls).toEqual([[deviceType, number, 'preserve']]);
          expect(effects.acceptStation.mock.invocationCallOrder[0])
            .toBeLessThan(effects.device.mock.invocationCallOrder[0]);
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(route === 'fallback' ? 1 : 0);
          expect(mockTaskManager.invalidateRegionalTasks.mock.invocationCallOrder[0])
            .toBeLessThan(effects.acceptStation.mock.invocationCallOrder[0]);
          expectStationEffects(stationCase, effects);
          expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([[{
            status: 'ready', reason: 'region-switch', trackingId: 'switch', operation: 'FAILOVER',
            scope: 'ORG', homeRegion: 'produs1',
          }]]);
        }
      );

      describe('MR-07 conditional automatic state', () => {
        let sequence: number;
        const readySnapshot = (autoAvailable?: string) => ({status: 'ready', reason: 'region-switch',
          trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1',
          ...(autoAvailable ? {autoAvailable} : {})});
        const ack = (requestId, extra = {}) => ({type: CC_EVENTS.AGENT_STATE_CHANGE,
          data: {type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, orgId: 'mockOrgId', agentId: 'agent123',
            agentSessionId: 'session', trackingId: requestId, auxCodeId: '0', status: 'LoggedIn',
            subStatus: 'Available', lastStateChangeReason: 'agent-wss-disconnect',
            lastStateChangeTimestamp: 20, lastIdleCodeChangeTimestamp: 21, ...extra}});
        const startAuto = async (voiceReady = true, onPrepared = () => {}) => {
          await prepare('enabled', true);
          onPrepared();
          webex.cc.services.agent.reload.mockResolvedValue(result({lastStateChangeReason: 'agent-wss-disconnect',
            status: 'LoggedIn', subStatus: 'Idle'}));
          webex.cc.webCallingService.isBrowserVoiceRequired.mockReturnValue(!voiceReady);
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(voiceReady);
          await welcome(accept()); await settle();
        };
        beforeEach(() => {
          sequence = 0;
          require('uuid').v4.mockImplementation(() => `state-${sequence += 1}`);
          webex.cc.services.agent.stateChange.mockReturnValue(new Promise(() => {}));
        });
        afterEach(() => {
          require('uuid').v4.mockImplementation(() => 'mock-tracking-uuid');
          webex.cc['cancelAutoAvailable']();
        });

        it.each(['reload', 'post1035'].flatMap(stage =>
          ['agent-wss-disconnect', 'other-reason', undefined].map(reason => [stage, reason])))
        ('T-007 exactDisconnectAutoStateOnly / post1035ReloadArmsAutoAvailableFromOwnResult %s reason=%s', async (stage, reason) => {
          await prepare('enabled', true);
          const restored = result({lastStateChangeReason: reason, status: 'LoggedIn', subStatus: 'Idle'});
          webex.cc.services.agent.reload.mockResolvedValue(restored);
          if (stage === 'post1035') {
            webex.cc.services.agent.reload.mockRejectedValueOnce({data: {reasonCode: 1038,
              lastStateChangeReason: 'agent-wss-disconnect'}});
            webex.cc.services.agent.stationLogin.mockRejectedValueOnce({data: {reasonCode: 1035,
              lastStateChangeReason: 'agent-wss-disconnect'}});
          }
          const revision = webex.cc['stateIntentRevision'];
          await welcome(accept());
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(stage === 'post1035' ? 2 : 1);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(stage === 'post1035' ? 1 : 0);
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot(
            reason === 'agent-wss-disconnect' ? 'requesting' : undefined));
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(reason === 'agent-wss-disconnect' ? 1 : 0);
          expect(webex.cc['stateIntentRevision']).toBe(revision);
        });

        it.each(['fallback', 'manual'])('T-007 %s station login never arms auto-Available', async stage => {
          await prepare('enabled', true);
          const disconnected = result({lastStateChangeReason: 'agent-wss-disconnect', status: 'LoggedIn', subStatus: 'Idle'});
          webex.cc.services.agent.stationLogin.mockResolvedValue(disconnected);
          if (stage === 'fallback') webex.cc.services.agent.reload.mockRejectedValue({data: {reasonCode: 1038}});
          else webex.cc.$config.allowAutomatedRelogin = false;
          await welcome(accept());
          if (stage === 'manual') {
            expect(webex.cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
            await webex.cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
          }
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot());
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
          expect(webex.cc['autoAvailable']).toBeUndefined();
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
        });

        it.each(['before Welcome', 'during reload', 'during fallback', 'during post1035 reload'])('T-007 explicitIntentBeforeArmAndDuringFlight %s prevents later DR arming', async timing => {
          await prepare('enabled', true);
          const reload = createDeferred<any>();
          const fallback = createDeferred<any>();
          webex.cc.services.agent.reload.mockReturnValue(reload.promise);
          const usesFallback = ['during fallback', 'during post1035 reload'].includes(timing);
          if (usesFallback) {
            webex.cc.services.agent.reload.mockRejectedValueOnce({data: {reasonCode: 1038}});
            webex.cc.services.agent.stationLogin.mockReturnValueOnce(fallback.promise);
          }
          const options = accept();
          const revision = webex.cc['stateIntentRevision'];
          const restoring = timing !== 'before Welcome' ? welcome(options) : undefined;
          const restored = jest.fn(); restoring?.then(restored);
          await settle();
          if (timing === 'during post1035 reload') {
            fallback.reject({data: {reasonCode: 1035}}); await settle();
          }
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(
            timing === 'before Welcome' ? 0 : timing === 'during post1035 reload' ? 2 : 1);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(usesFallback ? 1 : 0);
          expect(restored).not.toHaveBeenCalled();
          expect(webex.cc['lastPublishedRegionState'].status).toBe('recovering');
          await expect(webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'}))
            .rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
          expect(webex.cc['stateIntentRevision']).toBe(revision + 1);
          expect(restored).not.toHaveBeenCalled();
          if (timing === 'during fallback') {
            fallback.reject({data: {reasonCode: 1035}}); await settle();
            expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(2);
          }
          reload.resolve(result({lastStateChangeReason: 'agent-wss-disconnect'}));
          await (restoring || welcome(options));
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot());
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
          expect(mockWebexRequest.request).not.toHaveBeenCalled();
          expect(webex.cc['stateIntentRevision']).toBe(revision + 1);
          expect(webex.cc['autoAvailable']).toBeUndefined();
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
        });

        it.each([LoginOption.AGENT_DN, LoginOption.EXTENSION])
        ('T-007 %s dispatches when browser voice is unready but not required', async deviceType => {
          await prepare('enabled', true);
          webex.cc.services.agent.reload.mockResolvedValue(result({deviceType,
            lastStateChangeReason: 'agent-wss-disconnect', status: 'LoggedIn', subStatus: 'Idle'}));
          webex.cc.webCallingService.isBrowserVoiceRequired.mockReturnValue(false);
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(false);
          await welcome(accept());
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot('requesting'));
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stateChange.mock.calls[0][0].data.state).toBe('Available');
        });

        const lifecycleBoundaries = ['ordinary relogin', 'superseding switch', 'logout', 'deregister',
          'register', 'organization replacement', 'primary identity replacement', 'primary multi-login',
          'remote logout', 'foreign session', 'terminal recovery', 'reload required'];
        const triggerLifecycle = (boundary: string) => {
          const cc = webex.cc;
          const terminal = cc.services.connectionService.reset.mock.calls.slice(-1)[0][0].onTerminalFailure;
          switch (boundary) {
            case 'ordinary relogin':
              return cc['handleConnectionLost']({isSocketReconnected: true});
            case 'superseding switch':
              return cc['handleWebsocketMessage'](switchEvent('replacement-switch'));
            case 'logout': return cc.stationLogout({logoutReason: 'user'});
            case 'deregister': return cc.deregister();
            case 'register':
              cc.$config.allowAutomatedRelogin = false;
              return cc.register();
            case 'organization replacement':
              cc.$webex.credentials.getOrgId.mockReturnValue('replacement-org');
              return cc['handleWebsocketMessage'](switchEvent('replacement-switch'));
            case 'primary identity replacement':
              return cc['handleWebsocketMessage'](JSON.stringify({type: 'Welcome', data: {agentId: 'replacement-agent'}}));
            case 'primary multi-login':
              return cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN}));
            case 'remote logout':
              return cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_LOGOUT,
                data: {type: CC_EVENTS.AGENT_LOGOUT_SUCCESS, orgId: 'mockOrgId', agentId: 'agent123',
                  agentSessionId: 'session', trackingId: 'remote-logout'}}));
            case 'foreign session':
              cc.services.aqmReqs.isLocalSessionTrackingId.mockReturnValue(false);
              return cc['handleWebsocketMessage'](JSON.stringify(result({agentSessionId: 'foreign', trackingId: 'remote-login'})));
            case 'terminal recovery': return terminal(new Error('terminal'));
            case 'reload required':
              return terminal({data: {kind: 'region-mismatch', status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
            default: throw new Error(`Unhandled lifecycle boundary: ${boundary}`);
          }
        };
        const lifecycleSnapshots = (boundary: string, cancelled = true) => {
          const expected: any[] = cancelled ? [readySnapshot('cancelled')] : [];
          if (['terminal recovery', 'organization replacement', 'primary identity replacement'].includes(boundary))
            expected.push({...readySnapshot(), status: 'unavailable', reason: 'recovery-failed'});
          if (boundary === 'reload required')
            expected.push({...readySnapshot(), status: 'reloadRequired', reason: 'region-mismatch'});
          if (boundary === 'superseding switch')
            expected.push({...readySnapshot(), status: 'recovering', trackingId: 'replacement-switch'});
          return expected;
        };

        it.each(lifecycleBoundaries.flatMap(boundary => [false, true].map(requesting => [boundary, requesting] as const)))
        ('T-012 %s consumes auto before superseding work requesting=%s', async (boundary, requesting) => {
          const automatic = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValue(automatic.promise);
          const history: any[] = [];
          await startAuto(requesting, () => webex.cc.on('region:stateChange', state => history.push(state)));
          const cc = webex.cc;
          const auto = cc['autoAvailable'];
          const dispatch = auto.requestId && cc['stateDispatches'].get(auto.requestId);
          const revision = cc['stateIntentRevision'];
          const barrier = cc['inFlightDrAutoState'];
          const removed = jest.spyOn(auto.signal, 'removeEventListener');
          const snapshots: any[] = [];
          cc.webCallingService.off.mockClear();
          cc.on('region:stateChange', state => {
            expect(cc['autoAvailable']).toBeUndefined();
            expect(cc.webCallingService.off).toHaveBeenCalledWith(VOICE_CONNECTION_EVENTS.STATE_CHANGE,
              cc['handleAutoAvailableVoiceChange']);
            snapshots.push(state);
          });
          // Disposal must see consumed work; new requests/recovery must also see its final publication.
          const disposals: unknown[] = [];
          mockWebSocketManager.close.mockImplementation(() => {
            disposals.push({auto: cc['autoAvailable'],
              abortDetached: removed.mock.calls.some(([event, listener]) =>
                event === 'abort' && listener === cc['handleAutoAvailableAbort'])});
          });
          const afterCancellation = () => {
            expect(snapshots[0]).toEqual(readySnapshot('cancelled'));
            expect(cc['autoAvailable']).toBeUndefined();
          };
          cc.services.agent.reload.mockImplementation(() => {afterCancellation(); return Promise.resolve(result());});
          cc.services.agent.logout.mockImplementation(() => {afterCancellation(); return Promise.resolve({data: {}});});
          mockWebSocketManager.initWebSocket.mockImplementation(() => {
            afterCancellation(); return Promise.resolve({agentId: 'agent123'});
          });
          cc.services.connectionService.recoverRegion.mockImplementation(() => {
            afterCancellation(); return new Promise(() => {});
          });

          await triggerLifecycle(boundary); await settle();

          expect(snapshots).toEqual(lifecycleSnapshots(boundary));
          expect(disposals).toEqual(disposals.map(() => ({auto: undefined, abortDetached: true})));
          expect(history).toEqual([{...readySnapshot(), status: 'recovering'},
            readySnapshot(requesting ? 'requesting' : 'waitingForVoice'), ...lifecycleSnapshots(boundary)]);
          expect(removed).toHaveBeenCalledWith('abort', cc['handleAutoAvailableAbort']);
          expect(cc['stateIntentRevision']).toBe(revision);
          expect(cc['autoAvailable']).toBeUndefined();
          expect(cc['inFlightDrAutoState']).toBe(barrier);
          if (dispatch) expect(dispatch.outcome).toBe('cancelled');
          const published = snapshots.slice();
          const acceptedState = [cc.agentConfig?.lastStateAuxCodeId, cc.agentConfig?.lastStateChangeTimestamp,
            cc.agentConfig?.lastIdleCodeChangeTimestamp];
          cc.webCallingService.isVoiceReady.mockReturnValue(true);
          cc['handleAutoAvailableVoiceChange'](); cc['handleAutoAvailableAbort']();
          if (requesting) {
            const frame = ack(auto.requestId);
            cc['handleWebsocketMessage'](JSON.stringify(frame)); automatic.resolve(frame);
          }
          await settle();
          expect(snapshots).toEqual(published);
          expect(cc.services.agent.stateChange).toHaveBeenCalledTimes(requesting ? 1 : 0);
          expect(cc['inFlightDrAutoState']).toBeUndefined();
          if (dispatch) expect(dispatch.outcome).toBe('cancelled');
          if (boundary !== 'ordinary relogin') expect([cc.agentConfig?.lastStateAuxCodeId,
            cc.agentConfig?.lastStateChangeTimestamp, cc.agentConfig?.lastIdleCodeChangeTimestamp]).toEqual(acceptedState);
        });

        it.each(['superseding switch', 'deregister', 'terminal recovery', 'reload required'])
        ('T-012 %s before any ready never invents a cancellation snapshot', async boundary => {
          await prepare('enabled', true);
          const reload = createDeferred<any>();
          webex.cc.services.agent.reload.mockReturnValue(reload.promise);
          const restoring = welcome(accept());
          const interrupted = expect(restoring).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          await settle();
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          const snapshots: any[] = []; webex.cc.on('region:stateChange', state => snapshots.push(state));
          await triggerLifecycle(boundary); await settle();
          expect(snapshots).toEqual(lifecycleSnapshots(boundary, false));
          reload.resolve(result({lastStateChangeReason: 'agent-wss-disconnect'}));
          await interrupted;
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(snapshots).toEqual(lifecycleSnapshots(boundary, false));
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
        });

        it('T-007 voiceDeferredReadyAndSingleDispatch waits without holding station ready', async () => {
          const snapshots: any[] = [];
          const backend = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValue(backend.promise);
          const revision = webex.cc['stateIntentRevision'];
          await startAuto(false, () => webex.cc.on('region:stateChange', state => snapshots.push(state)));
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot('waitingForVoice'));
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(true);
          webex.cc['handleAutoAvailableVoiceChange'](); webex.cc['handleAutoAvailableVoiceChange']();
          await settle(); expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(webex.cc.webCallingService.off).toHaveBeenCalledWith(VOICE_CONNECTION_EVENTS.STATE_CHANGE,
            webex.cc['handleAutoAvailableVoiceChange']);
          const id = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          const frame = ack(id);
          webex.cc['handleWebsocketMessage'](JSON.stringify(frame)); backend.resolve(frame); await settle();
          expect(snapshots).toEqual([
            {...readySnapshot(), status: 'recovering'},
            readySnapshot('waitingForVoice'), readySnapshot('requesting'), readySnapshot('succeeded'),
          ]);
          expect(webex.cc['stateIntentRevision']).toBe(revision);
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
        });

        it('T-008 acceptance fences commands and interrupts Tasks before cancellation and recovering observers', async () => {
          await startAuto(false);
          const controller = webex.cc['commandController'];
          const order: string[] = [];
          const observations: unknown[] = [];
          controller.signal.addEventListener('abort', () => order.push('abort'), {once: true});
          mockTaskManager.interruptTaskOperations.mockClear();
          mockTaskManager.invalidateRegionalTasks.mockClear();
          mockTaskManager.interruptTaskOperations.mockImplementationOnce(createError => {
            order.push('interrupt');
            observations.push(createError().data.reason);
          });
          webex.cc.on('region:stateChange', state => {
            const publication = state.autoAvailable === 'cancelled' ? 'cancelled' : state.status;
            order.push(publication);
            observations.push({publication, aborted: controller.signal.aborted,
              interruptions: mockTaskManager.interruptTaskOperations.mock.calls.length});
          });

          webex.cc['handleWebsocketMessage'](switchEvent('replacement-switch'));

          // No await: both fences must precede even synchronously reentrant host observers.
          expect(order).toEqual(['abort', 'interrupt', 'cancelled', 'recovering']);
          expect(observations).toEqual(['RECOVERY_INTERRUPTED',
            {publication: 'cancelled', aborted: true, interruptions: 1},
            {publication: 'recovering', aborted: true, interruptions: 1}]);
          expect(mockTaskManager.interruptTaskOperations).toHaveBeenCalledTimes(1);
          expect(mockTaskManager.invalidateRegionalTasks).not.toHaveBeenCalled();
        });

        it('T-007 explicitWaitsOnlyForDispatchedDrAuto and concurrentExplicitStateKeepsPending', async () => {
          const automatic = createDeferred<any>(); const explicit = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValueOnce(automatic.promise).mockReturnValueOnce(explicit.promise);
          await startAuto();
          const first = webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
          const observed = first.catch(() => undefined);
          await expect(webex.cc.setAgentState({state: 'Available', auxCodeId: '0'}))
            .rejects.toMatchObject({message: 'Error while performing setAgentState'});
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          automatic.reject(new Error('timeout')); await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(2);
          const id = webex.cc.services.agent.stateChange.mock.calls[1][2].correlationId;
          const frame = ack(id, {auxCodeId: 'manual', subStatus: 'Idle'});
          webex.cc['handleWebsocketMessage'](JSON.stringify(frame)); explicit.resolve(frame);
          await first; await observed;
          expect(webex.cc['stateIntentRevision']).toBe(2);
          expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('manual');
          expect(webex.cc['explicitStateWaiter']).toBeUndefined();
        });

        it('T-007 cancelled sent request own acknowledgment preserves outcome and public forwarding', async () => {
          const automatic = createDeferred<any>(); const explicit = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValueOnce(automatic.promise).mockReturnValueOnce(explicit.promise);
          const snapshots: any[] = [];
          await startAuto(true, () => webex.cc.on('region:stateChange', state => snapshots.push(state)));
          const id = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          const generic = jest.fn(); const success = jest.fn(); const raw = jest.fn();
          webex.cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE, generic);
          webex.cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, success);
          webex.cc.on(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, raw);
          const request = webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
          const frame = ack(id);
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          webex.cc['handleWebsocketMessage'](JSON.stringify(frame)); automatic.resolve(frame); await settle();
          expect(webex.cc['stateDispatches'].get(id).outcome).toBe('cancelled');
          expect(snapshots).toEqual([{...readySnapshot(), status: 'recovering'},
            readySnapshot('requesting'), readySnapshot('cancelled')]);
          expect(generic.mock.calls).toEqual([[frame.data]]);
          expect(success.mock.calls).toEqual([[frame.data]]);
          expect(raw.mock.calls).toEqual([[frame.data]]);
          const explicitId = webex.cc.services.agent.stateChange.mock.calls[1][2].correlationId;
          const accepted = ack(explicitId, {subStatus: 'Idle', auxCodeId: 'manual', lastStateChangeTimestamp: 30});
          webex.cc['handleWebsocketMessage'](JSON.stringify(accepted)); explicit.resolve(accepted); await request;
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot('cancelled'));
          expect(webex.cc['stateDispatches'].get(id).outcome).toBe('cancelled');
        });

        it('T-007 registerReloginUsesNonExplicitSource / distinctStateRequestIdsAcrossPaths uses separate IDs', async () => {
          const dispatch = jest.spyOn(webex.cc, 'performAgentStateChange');
          const revision = webex.cc['stateIntentRevision'];
          const disconnected = result({lastStateChangeReason: 'agent-wss-disconnect', status: 'LoggedIn', subStatus: 'Idle'});
          webex.cc.services.agent.stateChange.mockImplementation(({data}, _callback, {correlationId: requestId}) => {
            expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
            const frame = ack(requestId, {subStatus: data.state, auxCodeId: data.auxCodeId});
            webex.cc['handleWebsocketMessage'](JSON.stringify(frame));
            return Promise.resolve(frame);
          });
          await prepare('enabled', true, disconnected);
          expect(dispatch.mock.calls.map(([, context]) => context.source)).toEqual(['relogin-auto']);
          expect(webex.cc['stateIntentRevision']).toBe(revision);
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          webex.cc.services.agent.reload.mockResolvedValue(disconnected);
          await welcome(accept());
          expect(webex.cc['stateIntentRevision']).toBe(revision);
          await webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
          expect(webex.cc['stateIntentRevision']).toBe(revision + 1);
          await webex.cc['handleConnectionLost']({isSocketReconnected: true});
          expect(webex.cc['stateIntentRevision']).toBe(revision + 1);
          expect(dispatch.mock.calls.map(([, context]) => context.source))
            .toEqual(['relogin-auto', 'dr-auto', 'explicit', 'relogin-auto']);
          expect(webex.cc.services.agent.stateChange.mock.calls.map(([, , context]) => context.correlationId))
            .toEqual(['state-1', 'state-2', 'state-3', 'state-4']);
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
        });

        it.each(['register relogin-auto', 'ordinary relogin-auto', 'explicit'])
        ('T-007 ordinaryCorrelatedStateAndSilentReloginComplete pending %s never installs DR barrier', async source => {
          const pending = createDeferred<any>();
          const dispatch = jest.spyOn(webex.cc, 'performAgentStateChange');
          webex.cc.services.agent.stateChange.mockReturnValue(pending.promise);
          const disconnected = result({lastStateChangeReason: 'agent-wss-disconnect'});
          let operation: Promise<unknown>;
          const revision = webex.cc['stateIntentRevision'];
          if (source === 'register relogin-auto') operation = prepare('enabled', true, disconnected);
          else {
            await prepare('enabled', true);
            webex.cc.services.agent.reload.mockResolvedValue(disconnected);
            operation = source === 'explicit'
              ? webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'})
              : webex.cc['handleConnectionLost']({isSocketReconnected: true});
          }
          await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(dispatch.mock.calls[0][1].source).toBe(source === 'explicit' ? 'explicit' : 'relogin-auto');
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          expect(webex.cc['stateIntentRevision']).toBe(revision + (source === 'explicit' ? 1 : 0));
          const [{data}, , {correlationId: requestId}] = webex.cc.services.agent.stateChange.mock.calls[0];
          const frame = ack(requestId, {subStatus: data.state, auxCodeId: data.auxCodeId});
          webex.cc['handleWebsocketMessage'](JSON.stringify(frame)); pending.resolve(frame); await operation;
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          expect(webex.cc['stateDispatches'].get(requestId)).toEqual({
            source: source === 'explicit' ? 'explicit' : 'relogin-auto',
            registration: webex.cc['registrationGeneration'], sessionId: 'session',
            stationRevision: webex.cc['stationRevision'], generation: webex.cc['recoveryGeneration'],
            ordinal: expect.any(Number),
          });
        });

        it.each(['fulfilled', 'rejected'])('T-007 DR-only barrier survives cancellation until %s settlement', async outcome => {
          const automatic = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockImplementation(() => {
            expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
            return automatic.promise;
          });
          await startAuto(false);
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          const beforeDispatch: unknown[] = [];
          webex.cc.on('region:stateChange', state => {
            if (state.autoAvailable === 'requesting') beforeDispatch.push({
              calls: webex.cc.services.agent.stateChange.mock.calls.length,
              barrier: webex.cc['inFlightDrAutoState'],
            });
          });
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(true);
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(beforeDispatch).toEqual([{calls: 0, barrier: undefined}]);
          const barrier = webex.cc['inFlightDrAutoState'];
          expect(barrier).toBeInstanceOf(Promise);
          webex.cc.services.agent.reload.mockResolvedValue(result());
          await triggerLifecycle('ordinary relogin');
          expect(webex.cc['inFlightDrAutoState']).toBe(barrier);
          if (outcome === 'fulfilled') automatic.resolve(ack('state-1'));
          else automatic.reject(new Error('late rejection'));
          await settle();
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot('cancelled'));
        });

        it.each(['fulfilled', 'rejected'])('T-007 obsolete %s settlement cannot clear a newer DR barrier', async outcome => {
          const old = createDeferred<any>(); const current = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
          await startAuto();
          const oldBarrier = webex.cc['inFlightDrAutoState'];
          webex.cc['handleWebsocketMessage'](switchEvent('replacement-switch'));
          await welcome(webex.cc.services.connectionService.recoverRegion.mock.calls.slice(-1)[0][0]);
          const currentBarrier = webex.cc['inFlightDrAutoState'];
          expect(currentBarrier).toBeInstanceOf(Promise);
          expect(currentBarrier).not.toBe(oldBarrier);
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(2);
          if (outcome === 'fulfilled') old.resolve(ack('state-1'));
          else old.reject(new Error('obsolete rejection'));
          await settle();
          expect(webex.cc['inFlightDrAutoState']).toBe(currentBarrier);
          const id = webex.cc.services.agent.stateChange.mock.calls[1][2].correlationId;
          const frame = ack(id); webex.cc['handleWebsocketMessage'](JSON.stringify(frame));
          current.resolve(frame); await settle();
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
          expect(webex.cc['lastPublishedRegionState']).toEqual({...readySnapshot('succeeded'), trackingId: 'replacement-switch'});
        });

        it('T-007 timeoutLateReplyWithoutNewerStateRetainsFailed', async () => {
          const automatic = createDeferred<any>(); webex.cc.services.agent.stateChange.mockReturnValue(automatic.promise);
          const snapshots: any[] = [];
          await startAuto(true, () => webex.cc.on('region:stateChange', state => snapshots.push(state)));
          const id = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          automatic.reject(new Error('timeout')); await settle();
          const last = webex.cc['lastPublishedRegionState']; expect(last.autoAvailable).toBe('failed');
          webex.cc['handleWebsocketMessage'](JSON.stringify(ack(id))); await settle();
          expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('0');
          expect(webex.cc['lastPublishedRegionState']).toBe(last);
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(snapshots).toEqual([{...readySnapshot(), status: 'recovering'},
            readySnapshot('requesting'), readySnapshot('failed')]);
          expect(webex.cc['inFlightDrAutoState']).toBeUndefined();
        });

        it.each([
          [{lastStateChangeTimestamp: 9}, false],
          [{subStatus: 'Idle', auxCodeId: 'idle', lastStateChangeTimestamp: 10, lastIdleCodeChangeTimestamp: 11}, false],
          [{subStatus: 'Idle', auxCodeId: 'idle'}, false],
          [{lastStateChangeTimestamp: 10, lastIdleCodeChangeTimestamp: 11, auxCodeId: 'other'}, true],
          [{agentSessionId: 'foreign'}, false],
        ])('T-007 disconnectEchoAndAuthoritativeChangePredicate %j', async (fields, cancels) => {
          await startAuto(false);
          webex.cc['handleWebsocketMessage'](JSON.stringify(ack('independent', fields)));
          expect(webex.cc['lastPublishedRegionState'].autoAvailable).toBe(cancels ? 'cancelled' : 'waitingForVoice');
        });

        it('T-007 localVoiceRaceDiscriminatorPreventsHiddenRetry for backend same-reason rejection', async () => {
          webex.cc.services.agent.stateChange.mockRejectedValue({details: {data: {reason: VOICE_CONNECTION_ERROR.NOT_READY}}});
          await startAuto(); await settle();
          expect(webex.cc['lastPublishedRegionState'].autoAvailable).toBe('failed');
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
        });

        it.each([true, false])('T-007 authoritativeStateReconciliation independentAfterDispatch=%s', async (after) => {
          await prepare('enabled', true);
          const pending = createDeferred<any>(); webex.cc.services.agent.stateChange.mockReturnValue(pending.promise);
          const independent = ack('independent', {auxCodeId: 'independent', subStatus: 'Idle'});
          if (!after) webex.cc['handleWebsocketMessage'](JSON.stringify(independent));
          const explicit = webex.cc.setAgentState({state: 'Idle', auxCodeId: 'explicit'});
          const observed = explicit.catch(() => undefined);
          const id = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          if (after) webex.cc['handleWebsocketMessage'](JSON.stringify(independent));
          const local = ack(id, {auxCodeId: 'explicit', subStatus: 'Idle'});
          webex.cc['handleWebsocketMessage'](JSON.stringify(local)); pending.resolve(local);
          await explicit; await observed;
          expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe(after ? 'independent' : 'explicit');
          expect(webex.cc.agentConfig.lastStateChangeTimestamp).toBe(20);
          expect(webex.cc.agentConfig.lastIdleCodeChangeTimestamp).toBe(21);
        });

        it('T-007 timeoutLateReplyCannotCompleteExplicit or overwrite accepted explicit state', async () => {
          const automatic = createDeferred<any>(); const explicit = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValueOnce(automatic.promise).mockReturnValueOnce(explicit.promise);
          await startAuto(); const oldId = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          automatic.reject(new Error('timeout')); await settle();
          const request = webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
          const observed = request.catch(() => undefined); const settled = jest.fn(); request.then(settled, settled);
          const id = webex.cc.services.agent.stateChange.mock.calls[1][2].correlationId;
          webex.cc['handleWebsocketMessage'](JSON.stringify(ack(oldId))); await settle();
          expect(settled).not.toHaveBeenCalled();
          const accepted = ack(id, {auxCodeId: 'manual', subStatus: 'Idle', lastStateChangeTimestamp: 30});
          webex.cc['handleWebsocketMessage'](JSON.stringify(accepted)); explicit.resolve(accepted);
          await request; await observed;
          // Correlation survives settlements and arbitrary age/count; old automatic replies
          // must never be reclassified as independent authoritative notifications.
          webex.cc.services.agent.stateChange.mockImplementation((_request, _callback, {correlationId: requestId}) => {
            const frame = ack(requestId, {auxCodeId: 'manual', subStatus: 'Idle', lastStateChangeTimestamp: 30});
            webex.cc['handleWebsocketMessage'](JSON.stringify(frame));
            return Promise.resolve(frame);
          });
          for (let index = 0; index < 128; index += 1)
            await webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
          jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 30 * 24 * 60 * 60 * 1000);
          webex.cc['handleWebsocketMessage'](JSON.stringify(ack(oldId, {lastStateChangeTimestamp: 100})));
          expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('manual');
          expect(webex.cc['lastPublishedRegionState'].autoAvailable).toBe('failed');
          expect(webex.cc['stateDispatches'].get(oldId)).toEqual({
            source: 'dr-auto', registration: webex.cc['registrationGeneration'], sessionId: 'session',
            stationRevision: webex.cc['stationRevision'], generation: webex.cc['recoveryGeneration'],
            ordinal: expect.any(Number), outcome: 'failed',
          });
          for (const dispatch of webex.cc['stateDispatches'].values()) {
            expect(Object.values(dispatch).every(value => ['string', 'number'].includes(typeof value))).toBe(true);
            expect(dispatch).not.toHaveProperty('signal');
            expect(dispatch).not.toHaveProperty('intentRevision');
          }
          webex.cc['clearAcceptedStation']();
          expect(webex.cc['stateDispatches'].size).toBe(0);
        });

        it.each([false, true])('T-007 local-only voice race rereads readiness on rearm: ready=%s', async (ready) => {
          await prepare('enabled', true);
          const failure = jest.fn(); const specializedFailure = jest.fn();
          webex.cc.on(CC_EVENTS.AGENT_STATE_CHANGE_FAILED, failure);
          webex.cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE_FAILED, specializedFailure);
          webex.cc.services.agent.reload.mockResolvedValue(result({lastStateChangeReason: 'agent-wss-disconnect', status: 'LoggedIn', subStatus: 'Idle'}));
          webex.cc.webCallingService.isBrowserVoiceRequired.mockReturnValue(true);
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(ready).mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
          const dispatch = jest.spyOn(webex.cc, 'performAgentStateChange');
          mockMetricsManager.timeEvent.mockClear(); mockMetricsManager.trackEvent.mockClear();
          getErrorDetailsSpy.mockClear(); mockWebexRequest.uploadLogs.mockClear();
          await welcome(accept()); await settle();
          await expect(dispatch.mock.results[0].value).resolves.toEqual({
            kind: 'not-dispatched', cause: 'browser-voice-not-ready',
            error: expect.objectContaining({message: VOICE_CONNECTION_ERROR.NOT_READY}),
          });
          expect(mockMetricsManager.timeEvent.mock.calls.filter(([events]) =>
            events.includes(METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS))).toHaveLength(ready ? 1 : 0);
          expect(mockMetricsManager.trackEvent.mock.calls.filter(([event]) =>
            event === METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED)).toEqual([]);
          expect(getErrorDetailsSpy).not.toHaveBeenCalled();
          expect(mockWebexRequest.uploadLogs).not.toHaveBeenCalled();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(ready ? 1 : 0);
          expect(sequence).toBe(ready ? 1 : 0);
          expect(Boolean(webex.cc['inFlightDrAutoState'])).toBe(ready);
          expect(failure).not.toHaveBeenCalled();
          expect(specializedFailure).not.toHaveBeenCalled();
          expect(webex.cc['lastPublishedRegionState'].autoAvailable).toBe(ready ? 'requesting' : 'waitingForVoice');
          expect(webex.cc.webCallingService.on.mock.calls.filter(([event, listener]) =>
            event === VOICE_CONNECTION_EVENTS.STATE_CHANGE && listener === webex.cc['handleAutoAvailableVoiceChange']))
            .toHaveLength(2);
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(true);
          webex.cc['handleAutoAvailableVoiceChange']();
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId).toBe('state-1');
        });

        it.each(['explicit', 'relogin-auto'])('T-007 local voice rejection preserves %s failure diagnostics', async source => {
          await prepare('enabled', true);
          webex.cc.webCallingService.isBrowserVoiceRequired.mockReturnValue(true);
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(false);
          mockMetricsManager.timeEvent.mockClear(); mockMetricsManager.trackEvent.mockClear();
          getErrorDetailsSpy.mockClear(); mockWebexRequest.uploadLogs.mockClear();
          const data = {state: 'Available', auxCodeId: '0'};
          if (source === 'explicit')
            await expect(webex.cc.setAgentState(data)).rejects.toThrow(VOICE_CONNECTION_ERROR.NOT_READY);
          else
            await expect(webex.cc['performAgentStateChange'](data, {
              source, intentRevision: webex.cc['stateIntentRevision'],
              stationRevision: webex.cc['stationRevision'], generation: webex.cc['recoveryGeneration'],
              signal: webex.cc['commandController'].signal,
            })).resolves.toMatchObject({kind: 'not-dispatched', cause: 'browser-voice-not-ready'});
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
          expect(mockMetricsManager.timeEvent.mock.calls).toEqual([[[
            METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS, METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED,
          ]]]);
          expect(mockMetricsManager.trackEvent.mock.calls.map(([event]) => event))
            .toEqual([METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED]);
          expect(getErrorDetailsSpy).toHaveBeenCalledTimes(1);
          expect(getErrorDetailsSpy).toHaveBeenCalledWith(expect.objectContaining({
            message: VOICE_CONNECTION_ERROR.NOT_READY,
          }), METHODS.SET_AGENT_STATE, CC_FILE);
          expect(mockWebexRequest.uploadLogs).toHaveBeenCalledTimes(1);
        });

        it('T-007 duplicate voice callbacks during requesting publication cannot dispatch twice', async () => {
          await startAuto(false);
          webex.cc.on('region:stateChange', state => {
            if (state.autoAvailable === 'requesting') {
              webex.cc['handleAutoAvailableVoiceChange']();
              webex.cc['handleAutoAvailableVoiceChange']();
            }
          });
          webex.cc.webCallingService.isVoiceReady.mockReturnValue(true);
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(sequence).toBe(1);
        });

        it('T-007 cancelledBeforeDispatchSendsNoRequest explicit intent in ready observer', async () => {
          let first = true;
          webex.cc.on('region:stateChange', state => {
            if (state.autoAvailable === 'requesting' && first) {
              first = false;
              webex.cc.setAgentState({state: 'Idle', auxCodeId: 'manual'}).catch(() => undefined);
            }
          });
          await startAuto(); await settle();
          expect(webex.cc.services.agent.stateChange).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stateChange.mock.calls[0][0].data.state).toBe('Idle');
          expect(webex.cc['lastPublishedRegionState'].autoAvailable).toBe('cancelled');
        });

        it('T-011 teardownCancelsThenResetsSnapshot with installed logout fence', async () => {
          await startAuto(false);
          const controller = webex.cc['registrationAbortController'];
          const listener = jest.fn(state => {
            if (state.autoAvailable === 'cancelled') {
              expect(webex.cc['autoAvailable']).toBeUndefined();
              expect(webex.cc['recoveryPhase']).toBe('cancelled');
              expect(webex.cc.services.aqmReqs.setRecoveryGate).toHaveBeenLastCalledWith({state: 'unavailable', reason: 'RECOVERY_INTERRUPTED'});
            }
          });
          webex.cc.on('region:stateChange', listener);
          await webex.cc.stationLogout({logoutReason: 'user'});
          expect(listener).toHaveBeenCalledTimes(1);
          expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
          expect(controller.signal.aborted).toBe(false);
        });

        it.each([
          'terminal failure', 'deregister',
          'organization replacement', 'primary identity replacement', 'multi-login',
          'superseding switch',
        ])('T-011 unknownMetadataClearsPriorValues on %s', async (boundary) => {
          await startAuto(false);
          mockWebSocketManager.getServingRegion.mockReturnValue('produs2');
          webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
          const previous = webex.cc['lastPublishedRegionState'];
          expect(previous).toEqual({status: 'ready', reason: 'region-switch',
            trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1',
            servingRegion: 'produs2', limitedService: true, autoAvailable: 'waitingForVoice'});
          const clearPlacement = () => {
            mockWebSocketManager.getServingRegion.mockReturnValue(undefined);
            mockWebSocketManager.hasUsableSocket.mockReturnValue(false);
          };
          mockWebSocketManager.clearServingRegion.mockImplementation(clearPlacement);
          mockWebSocketManager.close.mockImplementation(clearPlacement);
          const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
          const terminal = webex.cc.services.connectionService.reset.mock.calls.slice(-1)[0][0].onTerminalFailure;

          if (boundary === 'terminal failure') terminal(new Error('terminal'));
          if (boundary === 'deregister') await webex.cc.deregister();
          if (boundary === 'organization replacement') {
            webex.cc.$webex.credentials.getOrgId.mockReturnValue('replacement-org');
            webex.cc['handleWebsocketMessage'](switchEvent('replacement-switch'));
          }
          if (boundary === 'primary identity replacement')
            webex.cc['handleWebsocketMessage'](JSON.stringify({type: 'Welcome', data: {agentId: 'replacement-agent'}}));
          if (boundary === 'multi-login')
            webex.cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN}));
          if (boundary === 'superseding switch')
            webex.cc['handleWebsocketMessage'](switchEvent('replacement-switch'));

          const cancelled = {status: 'ready', reason: 'region-switch', trackingId: 'switch',
            operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1', autoAvailable: 'cancelled'};
          const expected: unknown[] = [cancelled];
          if (['terminal failure', 'organization replacement', 'primary identity replacement'].includes(boundary))
            expected.push({status: 'unavailable', reason: 'recovery-failed', trackingId: 'switch',
              operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
          if (boundary === 'superseding switch') expected.push({status: 'recovering', reason: 'region-switch',
            trackingId: 'replacement-switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
          expect(listener.mock.calls.map(([state]) => state)).toEqual(expected);
          expect(previous).toEqual({...cancelled, servingRegion: 'produs2', limitedService: true,
            autoAvailable: 'waitingForVoice'});
          expect(webex.cc['autoAvailable']).toBeUndefined();
          expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
        });

        it.each(['organization replacement', 'primary identity replacement'].flatMap(boundary =>
          ['succeeded', 'failed'].map(outcome => [boundary, outcome])))
        ('T-011 identity termination clears retained auto outcome %s %s', async (boundary, outcome) => {
          const automatic = createDeferred<any>();
          webex.cc.services.agent.stateChange.mockReturnValue(automatic.promise);
          await startAuto();
          const id = webex.cc.services.agent.stateChange.mock.calls[0][2].correlationId;
          const frame = ack(id);
          if (outcome === 'succeeded') {
            webex.cc['handleWebsocketMessage'](JSON.stringify(frame));
            automatic.resolve(frame);
          } else automatic.reject(new Error('state request failed'));
          await settle();
          expect(webex.cc['lastPublishedRegionState']).toEqual(readySnapshot(outcome));
          expect(webex.cc['autoAvailable']).toBeUndefined();
          const states = jest.fn(); webex.cc.on('region:stateChange', states);

          triggerLifecycle(boundary);

          expect(states.mock.calls).toEqual([[{...readySnapshot(), status: 'unavailable', reason: 'recovery-failed'}]]);
          expect(webex.cc['regionStateContext']).toEqual({});
          webex.cc['handleWebsocketMessage'](JSON.stringify(frame));
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(states).toHaveBeenCalledTimes(1);
        });

        it.each(['organization replacement', 'primary identity replacement'])
        ('T-012 identity cancellation preserves a reentrant registration on %s', async boundary => {
          await startAuto(false);
          let replacement: Promise<Profile>;
          const context = {trackingId: 'replacement', autoAvailable: 'succeeded'};
          const states = jest.fn(state => {
            if (state.autoAvailable === 'cancelled') {
              webex.cc.$config.allowAutomatedRelogin = false;
              replacement = webex.cc.register();
              webex.cc['regionStateContext'] = {...context};
            }
          });
          webex.cc.on('region:stateChange', states);

          triggerLifecycle(boundary);
          await replacement; await settle();

          expect(states.mock.calls).toEqual([[readySnapshot('cancelled')]]);
          expect(webex.cc['regionStateContext']).toEqual(context);
          expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
          expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
          webex.cc['handleAutoAvailableVoiceChange'](); await settle();
          expect(webex.cc['regionStateContext']).toEqual(context);
          expect(states).toHaveBeenCalledTimes(1);
        });

        it.each([
          [{eligibility: 'enabled', homeRegion: 'produs1'}, undefined, {homeRegion: 'produs1'}],
          [{eligibility: 'enabled'}, 'produs2', {servingRegion: 'produs2'}],
          [{eligibility: 'unknown', homeRegion: 'produs1'}, undefined, {}],
          [{eligibility: 'unknown', homeRegion: 'produs1'}, 'produs2', {servingRegion: 'produs2'}],
          [{eligibility: 'enabled', homeRegion: 'produs2'}, 'produs2',
            {homeRegion: 'produs2', servingRegion: 'produs2', limitedService: false}],
          [{eligibility: 'enabled', homeRegion: 'prodanz1'}, 'produs2',
            {homeRegion: 'prodanz1', servingRegion: 'produs2', limitedService: true}],
          [{eligibility: 'disabled', homeRegion: 'produs1'}, 'produs2',
            {homeRegion: 'produs1', servingRegion: 'produs2'}],
        ])('T-011 cancellationProjectsCurrentMetadataAtPublication settings=%j serving=%s',
          async (settings, servingRegion, metadata) => {
            await startAuto(false);
            mockWebSocketManager.getServingRegion.mockReturnValue('produs2');
            webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
            const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
            mockWebSocketManager.getServingRegion.mockClear();

            const cancelled = webex.cc['cancelAutoAvailable']();

            expect(webex.cc['autoAvailable']).toBeUndefined();
            expect(listener).not.toHaveBeenCalled();
            expect(mockWebSocketManager.getServingRegion).not.toHaveBeenCalled();
            expect(cancelled).toEqual({status: 'ready', reason: 'region-switch',
              trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1',
              servingRegion: 'produs2', limitedService: true, autoAvailable: 'cancelled'});
            webex.cc['multiRegionSettings'] = settings;
            mockWebSocketManager.getServingRegion.mockReturnValue(servingRegion);
            webex.cc['regionStateContext'] = {trackingId: 'new-switch', operation: 'FAILBACK', scope: 'REGION'};
            webex.cc['publishRegionState'](cancelled);
            webex.cc['publishRegionState'](cancelled);

            expect(listener.mock.calls.map(([state]) => state)).toEqual([
              {status: 'ready', reason: 'region-switch', trackingId: 'switch', operation: 'FAILOVER',
                scope: 'ORG', autoAvailable: 'cancelled', ...metadata},
            ]);
          }
        );

        it.each([undefined, 'produs1', 'prodanz1'])(
          'T-011 ordinaryReloginProjectsReplacementPlacement %s', async (servingRegion) => {
            await startAuto(false);
            mockWebSocketManager.getServingRegion.mockReturnValue('produs2');
            webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
            const revision = webex.cc['stateIntentRevision'];
            const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
            mockWebSocketManager.getServingRegion.mockReturnValue(servingRegion);
            webex.cc.services.agent.reload.mockResolvedValue(result());

            await webex.cc['handleConnectionLost']({isSocketReconnected: true});

            expect(listener.mock.calls.map(([state]) => state)).toEqual([
              {status: 'ready', reason: 'region-switch', trackingId: 'switch', operation: 'FAILOVER',
                scope: 'ORG', autoAvailable: 'cancelled', homeRegion: 'produs1',
                ...(servingRegion ? {servingRegion, limitedService: servingRegion !== 'produs1'} : {})},
            ]);
            expect(webex.cc['stateIntentRevision']).toBe(revision);
          }
        );
      });

      it('T-002 enabledEligibilityEntersDrWithoutOptIn', async () => {
        await prepare();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        const options = accept();
        expect(options.signal).toBe(webex.cc['recovery'].controller.signal);
        expect(webex.cc.services.connectionService.pause).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({status: 'recovering', reason: 'region-switch',
          trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
        expect(webex.cc.$config.allowAutomatedRelogin).toBe(false);
        expect(mockTaskManager.invalidateRegionalTasks).not.toHaveBeenCalled();
      });

      const beginPendingRegistration = async (automation: boolean, stage: 'reload' | 'mercury') => {
        jest.useFakeTimers();
        const work = createDeferred<any>();
        const driver = createDeferred<void>();
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: automation};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          webRtcEnabled: stage === 'mercury',
          loginVoiceOptions: stage === 'mercury' ? [LoginOption.BROWSER] : [LoginOption.EXTENSION],
        }));
        webex.cc.services.config.getMultiRegionSettings.mockResolvedValue({eligibility: 'enabled', homeRegion: 'produs1'});
        if (stage === 'mercury') jest.spyOn(webex.internal.mercury, 'connect').mockReturnValue(work.promise);
        else webex.cc.services.agent.reload.mockReturnValueOnce(work.promise);
        webex.cc.services.connectionService.recoverRegion.mockReturnValueOnce(driver.promise);
        const registering = webex.cc.register();
        registering.catch(() => undefined);
        await settle();
        expect(webex.cc['pendingRegistration'].controller).toBe(webex.cc['registrationAbortController']);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
        if (stage === 'reload') expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        else expect(webex.internal.mercury.connect).toHaveBeenCalledTimes(1);
        return {work, driver, registering, controller: webex.cc['registrationAbortController']};
      };

      it.each([
        [true, 'reload', 'resolve'], [true, 'reload', 'reject'],
        [true, 'mercury', 'resolve'], [false, 'mercury', 'resolve'],
      ] as const)('T-002 switchDuringRegisterTimeRestore automation=%s stage=%s completion=%s',
        async (automation, stage, completion) => {
          const {work, driver, registering, controller} = await beginPendingRegistration(automation, stage);
          const states = jest.fn(); webex.cc.on('region:stateChange', states);
          const options = accept();
          const recovery = webex.cc['recovery'];
          const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
          expect(states.mock.calls).toEqual([[{status: 'recovering', reason: 'region-switch',
            trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'}]]);
          expect(recovery.controller.signal.aborted).toBe(false);
          const stops = webex.cc.services.connectionService.stop.mock.calls.length;
          if (completion === 'reject') work.reject(error);
          else work.resolve(result());

          if (automation) {
            if (completion === 'reject') await expect(registering).rejects.toBe(error);
            else await expect(registering).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
            expect(controller.signal.aborted).toBe(true);
            expect(recovery.controller.signal.aborted).toBe(true);
            expect(webex.cc['recovery']).toBeUndefined();
            expect(webex.cc['recoveryPhase']).toBe('unavailable');
            expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
            expect(webex.cc.services.connectionService.stop).toHaveBeenCalledTimes(stops + 1);
            expect(mockWebSocketManager.close).toHaveBeenLastCalledWith(false, 'recoveryFailed');
            expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenLastCalledWith(false, 'recoveryFailed');
            expect(states.mock.calls).toEqual([
              [{status: 'recovering', reason: 'region-switch', trackingId: 'switch',
                operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'}],
              [{status: 'unavailable', reason: 'recovery-failed', trackingId: 'switch',
                operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'}],
            ]);
            const owner = captureSwitchOwner(); const actions = switchActions();
            options.onScheduled(2, 100000);
            await expect(welcome(options)).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
            driver.reject(new Error('late admission failure')); await settle();
            expect(captureSwitchOwner()).toEqual(owner);
            expect(switchActions()).toEqual(actions);
            expect(states).toHaveBeenCalledTimes(2);
          } else {
            await expect(registering).resolves.toBe(webex.cc.agentConfig);
            expect(controller.signal.aborted).toBe(false);
            expect(webex.cc['recovery']).toBe(recovery);
            expect(webex.cc.services.connectionService.stop).toHaveBeenCalledTimes(stops);
            options.onScheduled(1, 100000);
            await welcome(options); driver.resolve(); await settle();
            expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired',
              reason: 'region-switch', trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
          }
          expect(webex.cc['pendingRegistration']).toBeUndefined();
        }
      );

      it('T-002 successful automated registration permits an admitted switch to progress', async () => {
        const {work, driver, registering, controller} = await beginPendingRegistration(true, 'reload');
        let options;
        mockMetricsManager.trackEvent.mockImplementation(name => {
          if (name === METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS) {
            expect(webex.cc['pendingRegistration'].controller).toBe(controller);
            options = accept();
          }
        });
        const states = jest.fn(); webex.cc.on('region:stateChange', states);
        work.resolve(result());
        await registering;
        expect(options).toBeDefined();
        expect(webex.cc['pendingRegistration']).toBeUndefined();
        expect(controller.signal.aborted).toBe(false);
        expect(webex.cc['recovery'].controller.signal.aborted).toBe(false);

        webex.cc.services.agent.reload.mockResolvedValue(result());
        await welcome(options); driver.resolve(); await settle();

        expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'region-switch',
          trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
        expect(states.mock.calls.map(([state]) => state.status)).toEqual(['ready', 'recovering', 'ready']);
        expect(controller.signal.aborted).toBe(false);
      });

      it.each(['before catch', 'cancellation diagnostic', 'unavailable observer'] as const)
      ('T-012 failed registration preserves replacement at %s and ignores late completions', async boundary => {
        const {work, driver, registering} = await beginPendingRegistration(true, 'reload');
        const options = accept(); options.onScheduled(1, 100000);
        let replacement: Promise<Profile>;
        const replace = () => {
          webex.cc.$config.allowAutomatedRelogin = false;
          replacement = webex.cc.register();
        };
        const states = jest.fn(state => {
          if (boundary === 'unavailable observer' && state.status === 'unavailable') replace();
        });
        webex.cc.on('region:stateChange', states);
        if (boundary === 'before catch') replace();
        if (boundary === 'cancellation diagnostic') {
          LoggerProxy.info.mockImplementationOnce((_message, context) => {
            expect(context.data).toEqual({stage: 'admission', outcome: 'cancelled', attempt: 1, elapsedMs: 0});
            replace();
            throw new Error('diagnostic sink');
          });
        }
        const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
        work.reject(error);
        await expect(registering).rejects.toBe(error);
        await replacement; await settle();
        expect(states.mock.calls).toEqual(boundary === 'unavailable observer' ? [[{
          status: 'unavailable', reason: 'recovery-failed', trackingId: 'switch',
          operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1',
        }]] : []);
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
        const current = accept();
        expect(current).not.toBe(options);
        const owner = captureSwitchOwner(); const actions = switchActions();
        options.onScheduled(2, 100000);
        driver.reject(new Error('late failure'));
        await expect(welcome(options)).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await settle();
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
      });

      describe.each(['enabled', 'disabled', 'unknown'])('T-002 envelope eligibility=%s', eligibility => {
        it.each([
          ['foreign org', {orgId: 'foreign-org'}],
          ['foreign duplicate', {orgId: 'foreign-org', trackingId: 'remembered'}],
          ['missing org', {orgId: undefined}],
          ['blank org', {orgId: ''}],
          ['whitespace org', {orgId: ' \n '}],
          ['non-string org', {orgId: 123}],
          ['null org', {orgId: null}],
          ['array org', {orgId: ['mockOrgId']}],
          ['missing tracking', {trackingId: undefined}],
          ['blank tracking', {trackingId: ''}],
          ['whitespace tracking', {trackingId: ' \t '}],
          ['non-string tracking', {trackingId: {id: 'switch'}}],
          ['null tracking', {trackingId: null}],
          ['boolean tracking', {trackingId: true}],
        ])('invalidEnvelopeNoSocketAction: %s', async (_name, overrides) => {
          await prepare(eligibility, true);
          webex.cc['acceptedSwitchIds'].add('remembered');
          mockWebSocketManager.getServingRegion.mockReturnValue('produs2');
          webex.cc.services.rtdWebSocketManager.getServingRegion.mockReturnValue('produs2');
          const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
          const raw = jest.fn(); webex.cc.on('SYSTEM_REGION_SWITCH', raw);
          const owner = captureSwitchOwner(); const actions = switchActions();
          const logs = LoggerProxy.info.mock.calls.length;

          webex.cc['handleWebsocketMessage'](JSON.stringify({
            type: 'SYSTEM_REGION_SWITCH', orgId: 'mockOrgId',
            trackingId: `invalid-envelope-${_name.replace(/ /g, '-')}`, ...overrides,
          }));

          expect(captureSwitchOwner()).toEqual(owner);
          expect(switchActions()).toEqual(actions);
          expect(listener).not.toHaveBeenCalled();
          expect(raw).not.toHaveBeenCalled();
          expect(LoggerProxy.info).toHaveBeenCalledTimes(logs + (overrides.orgId === 'foreign-org' ? 1 : 0));
        });

        it('preserves teardown for live credential replacement before rejecting a foreign envelope', async () => {
          await prepare(eligibility, true);
          webex.cc['acceptedSwitchIds'].add('remembered');
          const registration = webex.cc['registrationGeneration'];
          const controller = webex.cc['registrationAbortController'];
          const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
          const stops = webex.cc.services.connectionService.stop.mock.calls.length;
          const sessionStops = mockTaskManager.stopSession.mock.calls.length;
          webex.credentials.getOrgId.mockReturnValue('replacement-org');

          webex.cc['handleWebsocketMessage'](JSON.stringify({
            type: 'SYSTEM_REGION_SWITCH', orgId: 'foreign-org', trackingId: 'remembered',
          }));

          expect(webex.cc['registrationGeneration']).toBe(registration + 1);
          expect(controller.signal.aborted).toBe(true);
          expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
          expect(webex.cc['acceptedStation']).toBeUndefined();
          expect(webex.cc['priorStationActive']).toBe(false);
          expect(webex.cc.services.connectionService.stop).toHaveBeenCalledTimes(stops + 1);
          expect(mockTaskManager.stopSession).toHaveBeenCalledTimes(sessionStops + 1);
          expect(mockWebSocketManager.close).toHaveBeenLastCalledWith(false, 'registrationEnded');
          expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenLastCalledWith(false, 'registrationEnded');
          expect(listener.mock.calls).toEqual([[{status: 'unavailable', reason: 'recovery-failed',
            ...(eligibility !== 'unknown' ? {homeRegion: 'produs1'} : {})}]]);
        });
      });

      it('T-002 foreign envelope preserves an active recovery and its history', async () => {
        await prepare('enabled', true); accept();
        const owner = captureSwitchOwner(); const actions = switchActions();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        webex.cc['handleWebsocketMessage'](JSON.stringify({
          type: 'SYSTEM_REGION_SWITCH', orgId: 'foreign-org', trackingId: 'switch',
        }));
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
        expect(listener).not.toHaveBeenCalled();
      });

      it.each([false, true])('T-002 aborted registration ignores switches with replaced credentials=%s', async replaced => {
        await prepare('unknown', true);
        webex.cc['registrationAbortController'].abort();
        if (replaced) webex.credentials.getOrgId.mockReturnValue('replacement-org');
        const owner = captureSwitchOwner(); const actions = switchActions();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        LoggerProxy.info.mockClear();
        accept();
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
        expect(listener).not.toHaveBeenCalled();
        expect(LoggerProxy.info).not.toHaveBeenCalled();
      });

      it.each([
        ['tracking._:-123', 'tracking._:-123', false],
        ['safe\ntracking\r', 'safetracking', false],
        ['https://private.invalid/SECRET', undefined, false],
        ['a'.repeat(201), 'a'.repeat(200), false],
        ['tracking', 'tracking', true],
      ])('T-002 unknown eligibility diagnostic tracking=%s, safe tracking=%s, throws=%s', async (trackingId, safeTrackingId, throws) => {
        await prepare('unknown', true);
        const owner = captureSwitchOwner(); const actions = switchActions();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        LoggerProxy.info.mockClear();
        if (throws) LoggerProxy.info.mockImplementationOnce(() => {throw new Error('diagnostic sink');});
        const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
        try {
          expect(() => webex.cc['handleWebsocketMessage'](JSON.stringify({
            type: 'SYSTEM_REGION_SWITCH', orgId: 'mockOrgId', trackingId,
            data: {operation: 'FAILOVER', scope: 'ORG', token: 'SECRET'},
          }))).not.toThrow();
        } finally {
          clock.mockRestore();
        }
        expect(LoggerProxy.info.mock.calls).toEqual([[
          'Region recovery',
          {module: CC_FILE, method: 'recordRecoveryDiagnostic', data: {stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0, ...(safeTrackingId ? {trackingId: safeTrackingId} : {})}},
        ]]);
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
        expect(listener).not.toHaveBeenCalled();
      });

      it.each(['live', 'throwing diagnostic', 'aborted', 'failed', 'superseded', 'foreign organization'] as const)
      ('T-002 preProfileUnknownEligibility %s', async boundary => {
        jest.useFakeTimers();
        const profile = createDeferred<Profile>(); const settings = createDeferred<any>();
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockReturnValueOnce(profile.promise);
        webex.cc.services.config.getMultiRegionSettings.mockReturnValue(settings.promise);
        const registering = webex.cc.register(); registering.catch(() => undefined);
        await settle();
        expect(webex.cc.services.config.getAgentConfig.mock.calls).toEqual([['mockOrgId', 'agent123']]);
        expect(webex.cc['registrationAgentId']).toBeUndefined();
        expect(webex.cc.services.config.getMultiRegionSettings).not.toHaveBeenCalled();
        if (boundary === 'aborted') webex.cc['registrationAbortController'].abort();
        if (boundary === 'failed') {
          profile.reject(new Error('profile failed'));
          await expect(registering).rejects.toThrow('profile failed');
        }
        let replacement: Promise<Profile>;
        if (boundary === 'superseded') {
          // The abandoned Profile reader cannot lend ownership to a replacement before Welcome.
          mockWebSocketManager.initWebSocket.mockReturnValueOnce(new Promise(() => {}));
          replacement = webex.cc.register(); replacement.catch(() => undefined);
        }
        const owner = captureSwitchOwner(); const actions = switchActions();
        const states = jest.fn(); webex.cc.on('region:stateChange', states);
        LoggerProxy.info.mockClear();
        if (boundary === 'throwing diagnostic')
          LoggerProxy.info.mockImplementationOnce(() => {throw new Error('sink');});
        expect(() => webex.cc['handleWebsocketMessage'](JSON.stringify({
          type: 'SYSTEM_REGION_SWITCH', trackingId: 'safe\ntracking\r',
          orgId: boundary === 'foreign organization' ? 'foreign-org' : 'mockOrgId',
          data: {token: 'SECRET'},
        }))).not.toThrow();
        expect(LoggerProxy.info.mock.calls).toEqual(['aborted', 'failed'].includes(boundary) ? [] : [[
          'Region recovery', {module: CC_FILE, method: 'recordRecoveryDiagnostic', data: {
            stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0, trackingId: 'safetracking',
          }},
        ]]);
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
        expect(states).not.toHaveBeenCalled();

        profile.resolve(createFreshAgentProfile({webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION]}));
        settings.resolve({eligibility: 'enabled'});
        if (['aborted', 'superseded'].includes(boundary))
          await expect(registering).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        else if (boundary !== 'failed') await registering;
        if (replacement) {
          webex.cc['registrationAbortController'].abort();
          await expect(replacement).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        }
        await settle();
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
        expect(webex.cc.services.connectionService.recoverRegion).not.toHaveBeenCalled();
        expect(webex.cc.services.connectionService.pause).not.toHaveBeenCalled();
        expect(states).not.toHaveBeenCalled();
      });

      it('T-002 unknownHydrationNoReplayOrHistory', async () => {
        const reader = createDeferred<any>();
        webex.cc.services.config.getMultiRegionSettings.mockReturnValue(reader.promise);
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({webRtcEnabled: false}));
        await webex.cc.register();
        const owner = captureSwitchOwner(); const actions = switchActions();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        const effects = [
          webex.cc.services.connectionService.pause,
          mockWebSocketManager.clearServingRegion,
          mockWebSocketManager.close,
          webex.cc.services.rtdWebSocketManager.close,
          webex.cc.services.connectionService.recoverRegion,
        ];
        const baseline = effects.map(effect => effect.mock.calls.length);
        const recoveries = webex.cc.services.connectionService.recoverRegion.mock.calls.length;
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        LoggerProxy.info.mockClear();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
        try {
          accept();
        } finally {
          clock.mockRestore();
        }
        expect(captureSwitchOwner()).toEqual(owner);
        expect(switchActions()).toEqual(actions);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
        expect(effects.map(effect => effect.mock.calls.length)).toEqual(baseline);
        expect(listener.mock.calls).toEqual([]);
        expect(LoggerProxy.info.mock.calls).toEqual([[
          'Region recovery',
          {module: CC_FILE, method: 'recordRecoveryDiagnostic', data: {stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0, trackingId: 'switch'}},
        ]]);
        reader.resolve({eligibility: 'enabled'}); await settle();
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled'});
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
        expect(switchActions()).toEqual(actions);
        expect(effects.map(effect => effect.mock.calls.length)).toEqual(baseline);
        expect(listener.mock.calls).toEqual([]);
        accept();
        expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries + 1);
        expect(listener.mock.calls).toEqual([[{
          status: 'recovering', reason: 'region-switch', trackingId: 'switch',
          operation: 'FAILOVER', scope: 'ORG',
        }]]);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual(['switch']);
      });

      const registrationBoundaries = ['same-identity register', 'different-identity register',
        'deregister', 'org replacement', 'agent replacement', 'primary multi-login'];
      const beginRegistrationBoundary = (boundary: string) => {
        if (boundary === 'different-identity register') {
          mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'replacement-agent'});
          webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({agentId: 'replacement-agent'}));
        }
        if (boundary.endsWith('register') && boundary !== 'deregister') return webex.cc.register();
        if (boundary === 'deregister') return webex.cc.deregister();
        if (boundary === 'org replacement') {
          webex.credentials.getOrgId.mockReturnValue('replacement-org');
          webex.cc['handleWebsocketMessage'](switchEvent('identity-check'));
        }
        if (boundary === 'agent replacement')
          webex.cc['handleWebsocketMessage'](JSON.stringify({type: 'Welcome', data: {agentId: 'replacement-agent'}}));
        if (boundary === 'primary multi-login')
          webex.cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN,
            data: {type: 'AgentMultiLoginCloseSession', agentSessionId: 'session'}}));
        return Promise.resolve();
      };
      const expectHistoryAndStation = (ids: string[], station, active = Boolean(station)) => {
        expect([...webex.cc['acceptedSwitchIds']]).toEqual(ids);
        expect(webex.cc['acceptedStation']).toBe(station);
        expect(webex.cc['priorStationActive']).toBe(active);
      };

      it('T-002 acceptedHistoryABAAnd129 retains A across B and evicts only the oldest', async () => {
        await prepare('enabled', true);
        const driver = webex.cc.services.connectionService.recoverRegion;
        for (const id of ['A', 'B', 'A']) webex.cc['handleWebsocketMessage'](switchEvent(id));
        expect(driver).toHaveBeenCalledTimes(2);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual(['A', 'B']);
        for (let i = 0; i < 127; i += 1) webex.cc['handleWebsocketMessage'](switchEvent(`new-${i}`));
        expect([...webex.cc['acceptedSwitchIds']]).toEqual(['B', ...Array.from({length: 127}, (_, i) => `new-${i}`)]);
        const count = driver.mock.calls.length;
        webex.cc['handleWebsocketMessage'](switchEvent('B'));
        expect(driver).toHaveBeenCalledTimes(count);
        webex.cc['handleWebsocketMessage'](switchEvent('A'));
        expect(driver).toHaveBeenCalledTimes(count + 1);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([...Array.from({length: 127}, (_, i) => `new-${i}`), 'A']);
        expect(webex.cc['priorStationActive']).toBe(true);
      });

      it.each([...registrationBoundaries, 'pending station logout', 'successful station logout',
        'failed station logout', 'undispatchable station logout', 'authoritative backend logout',
        'RTD-only termination', 'distinct switch supersession'])(
        'T-002 switchHistoryAndStationSnapshotLifecycle: %s', async boundary => {
          await prepare('enabled', true);
          const options = accept();
          if (boundary === 'RTD-only termination') {
            await welcome(options);
            webex.cc.agentConfig.isWellnessBreakEnabled = true;
            await webex.cc['resumeRtd'](webex.cc['registrationAbortController'].signal);
            expect(webex.cc['rtdEpoch'].active).toBe(true);
          }
          const station = webex.cc['acceptedStation'];
          const registration = webex.cc['registrationGeneration'];
          const controller = webex.cc['registrationAbortController'];
          const generation = webex.cc['recoveryGeneration'];
          const revision = webex.cc['stationRevision'];
          const recovery = webex.cc['recovery'];
          const hydration = createDeferred<any>();
          const logout = createDeferred<any>();
          const terminating = registrationBoundaries.includes(boundary);
          let pending = Promise.resolve();
          webex.cc.services.config.getMultiRegionSettings.mockReturnValue(hydration.promise);
          webex.cc.$config.allowAutomatedRelogin = false;

          if (terminating) pending = beginRegistrationBoundary(boundary);
          else if (boundary === 'distinct switch supersession')
            webex.cc['handleWebsocketMessage'](switchEvent('B'));
          else if (boundary === 'RTD-only termination')
            webex.cc['handleRTDWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN}));
          else if (boundary === 'authoritative backend logout')
            webex.cc['handleWebsocketMessage'](JSON.stringify({...result({type: CC_EVENTS.AGENT_LOGOUT_SUCCESS}), type: CC_EVENTS.AGENT_LOGOUT}));
          else {
            if (boundary === 'pending station logout') webex.cc.services.agent.logout.mockReturnValue(logout.promise);
            if (boundary === 'failed station logout') webex.cc.services.agent.logout.mockRejectedValue(new Error('backend refused'));
            if (boundary === 'undispatchable station logout') mockWebSocketManager.hasUsableSocket.mockReturnValue(false);
            const operation = webex.cc.stationLogout({logoutReason: 'user'});
            pending = operation.catch(() => undefined);
            if (boundary !== 'pending station logout') await pending;
          }

          const ids = terminating ? [] : boundary === 'distinct switch supersession' ? ['switch', 'B'] : ['switch'];
          const cleared = terminating || ['successful station logout', 'authoritative backend logout'].includes(boundary);
          expectHistoryAndStation(ids, cleared ? undefined : station);
          expect(webex.cc['registrationGeneration']).toBe(registration + (terminating ? 1 : 0));
          expect(controller.signal.aborted).toBe(terminating);
          if (boundary === 'RTD-only termination') {
            expect(webex.cc['recovery']).toBe(recovery);
            expect(webex.cc['recoveryGeneration']).toBe(generation);
            expect(webex.cc['stationRevision']).toBe(revision);
            expect(webex.cc['rtdEpoch']).toBeUndefined();
          } else {
            expect(recovery.controller.signal.aborted).toBe(true);
            expect(webex.cc['recoveryGeneration']).toBeGreaterThan(generation);
            expect(webex.cc['stationRevision']).toBe(boundary === 'distinct switch supersession' ? revision : revision + 1);
          }
          const recoveries = webex.cc.services.connectionService.recoverRegion.mock.calls.length;
          const pauses = webex.cc.services.connectionService.pause.mock.calls.length;
          webex.cc['handleWebsocketMessage'](switchEvent());
          expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries);
          expect(webex.cc.services.connectionService.pause).toHaveBeenCalledTimes(pauses);
          expectHistoryAndStation(ids, cleared ? undefined : station);

          if (terminating) {
            await pending;
            webex.credentials.getOrgId.mockReturnValue('mockOrgId');
            if (!boundary.endsWith('register') || boundary === 'deregister') {
              mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
              webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile());
              await webex.cc.register();
            }
            expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
            webex.cc['handleWebsocketMessage'](switchEvent());
            expectHistoryAndStation([], undefined);
            expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries);
            hydration.resolve({eligibility: 'enabled', homeRegion: 'produs1'}); await settle();
            expectHistoryAndStation([], undefined); // Hydration itself never replays a switch.
            webex.cc['handleWebsocketMessage'](switchEvent());
            expectHistoryAndStation(['switch'], undefined);
            expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries + 1);
            expect(webex.cc['recovery'].registration).toBe(webex.cc['registrationGeneration']);
          }
          if (boundary === 'pending station logout') {
            logout.resolve({data: {}}); await pending;
            expectHistoryAndStation(['switch'], undefined);
            webex.cc['handleWebsocketMessage'](switchEvent());
            expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries);
          }
        }
      );

      it.each(registrationBoundaries.flatMap(boundary => ['before Welcome', 'reload success', 'reload failure']
        .map(work => [boundary, work])))(
        'T-012 registrationTerminationClearsHistoryAndSnapshot: %s with late %s', async (boundary, work) => {
          await prepare('enabled', true);
          const options = accept();
          const reload = createDeferred<any>();
          const registration = webex.cc['registrationAbortController'];
          let oldWork: Promise<void>;
          if (work !== 'before Welcome') {
            webex.cc.services.agent.reload.mockReturnValueOnce(reload.promise);
            oldWork = welcome(options);
            oldWork.catch(() => undefined);
            await settle();
            expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          }
          webex.cc.$config.allowAutomatedRelogin = false;
          const pending = beginRegistrationBoundary(boundary);
          expectHistoryAndStation([], undefined);
          expect(registration.signal.aborted).toBe(true);
          await pending; await settle();
          const owner = captureSwitchOwner();
          const actions = switchActions();
          const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
          const logins = webex.cc.services.agent.stationLogin.mock.calls.length;
          if (work === 'before Welcome') oldWork = welcome(options);
          const interrupted = expect(oldWork).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          if (work === 'reload success') reload.resolve(result({agentSessionId: 'obsolete'}));
          if (work === 'reload failure') reload.reject(new Error('obsolete reload failure'));
          await interrupted; await settle();
          expect(captureSwitchOwner()).toEqual(owner);
          expect(switchActions()).toEqual(actions);
          expectHistoryAndStation([], undefined);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(logins);
          expect(listener).not.toHaveBeenCalled();
          await expect(welcome(options)).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        }
      );

      it.each([
        [false, false, false, 'region-switch'], [false, true, false, 'region-switch'],
        [true, false, true, 'automatic-relogin-disabled'],
        [true, false, false, 'automatic-relogin-disabled'],
        [true, true, false, 'session-restore-failed'],
      ])('T-007 orderedPolicyCombinedCases / noPriorStationResume / manualPriorStationDefers active=%s automate=%s usable=%s', async (active, automate, usable, reason) => {
        await prepare('enabled', active);
        webex.cc.$config.allowAutomatedRelogin = automate;
        if (active && !usable) {
          webex.cc.services.aqmReqs.isLocalSessionTrackingId.mockReturnValue(false);
          webex.cc['handleWebsocketMessage'](JSON.stringify(result({teamId: '', trackingId: 'foreign'})));
        }
        expect(webex.cc['priorStationActive']).toBe(active);
        expect(Boolean(webex.cc['acceptedStation'])).toBe(usable);
        const profile = webex.cc.agentConfig;
        const preserved = JSON.parse(JSON.stringify(profile));
        const snapshot = webex.cc['acceptedStation'];
        const resume = jest.spyOn(webex.cc, 'resumeRtd');
        const options = accept();
        // Every switch pauses RTD first; only later station/task wipes are forbidden here.
        expect(webex.cc['rtdPaused']).toBe(true);
        mockTaskManager.invalidateRegionalTasks.mockClear();
        mockTaskManager.clearAISummaryState.mockClear();

        await welcome(options);

        expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired', reason,
          trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
        expect(webex.cc.agentConfig).toBe(profile);
        expect(webex.cc.agentConfig).toEqual(preserved);
        expect(webex.cc['acceptedStation']).toBe(snapshot);
        expect(mockTaskManager.invalidateRegionalTasks).not.toHaveBeenCalled();
        expect(mockTaskManager.clearAISummaryState).not.toHaveBeenCalled();
        expect(resume).toHaveBeenCalledTimes(active ? 0 : 1);
        if (!active) expect(resume).toHaveBeenCalledWith(webex.cc['registrationAbortController'].signal);
        expect(webex.cc.services.agent.reload).not.toHaveBeenCalled();
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
      });

      it.each([
        [{deviceType: LoginOption.BROWSER, dn: 'ignored'}, 'BROWSER', 'webrtc-agent123'],
        [{deviceType: LoginOption.EXTENSION, dn: '123', deviceId: null}, 'EXTENSION', '123'],
        [{deviceType: LoginOption.AGENT_DN, dn: '456', dialNumber: '789'}, 'AGENT_DN', '456'],
        [{deviceType: null, dn: 'webrtc-agent123', isExtension: false}, 'BROWSER', 'webrtc-agent123'],
        [{deviceType: '', dn: '123', isExtension: true}, 'EXTENSION', '123'],
        [{deviceType: undefined, dn: '', dialNumber: '789', isExtension: false}, 'AGENT_DN', '789'],
        [{deviceType: LoginOption.BROWSER, dn: undefined, dialNumber: undefined}, 'BROWSER', 'webrtc-agent123'],
        [{deviceType: undefined, dn: '123', isExtension: true, deviceId: null}, 'EXTENSION', '123'],
        ...[undefined, '', '   '].map(agentSessionId => [{agentSessionId}, 'EXTENSION', '1234']),
        [{deviceType: 'unsupported'}, undefined, undefined],
        [{deviceType: ' ', dn: undefined, dialNumber: undefined, isExtension: undefined}, undefined, undefined],
        [{deviceType: null, dn: null, dialNumber: null, isExtension: null}, undefined, undefined],
        [{deviceType: LoginOption.EXTENSION, dn: '', dialNumber: ''}, undefined, undefined],
        [{deviceType: LoginOption.AGENT_DN, dn: undefined, dialNumber: undefined}, undefined, undefined],
        ...[undefined, null, '', '   '].map(teamId => [{teamId}, undefined, undefined]),
      ])('T-007 reloadSnapshotMapping first-registration %j', async (fields, deviceType, number) => {
        expect(webex.cc['acceptedStation']).toBeUndefined();
        webex.cc.webCallingService.loginOption = undefined;
        await prepare('enabled', true, result({...fields, roles: ['supervisor'], siteId: 'backend-site',
          teamName: undefined, usesOtherDN: true, auxCodeId: 'backend-aux'}));
        expect(webex.cc['priorStationActive']).toBe(true);
        if (!deviceType) {
          expect(webex.cc['acceptedStation']).toBeUndefined();
          return;
        }
        expect(webex.cc['acceptedStation'].payload).toEqual({deviceType, dialNumber: number,
          deviceId: number, isExtension: deviceType === 'EXTENSION', teamId: 'team',
          roles: ['agent'], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: ''});
        if (Object.prototype.hasOwnProperty.call(fields, 'agentSessionId'))
          expect(webex.cc['acceptedStation'].sessionId).toBeUndefined();
      });

      it.each(['login', 'reload'].flatMap(source => [undefined, '', '   ']
        .map(agentSessionId => [source, agentSessionId])))(
        'T-007 optionalStationSessionId preserves %s snapshot with session=%j through DR fallback', async (source, agentSessionId) => {
          const response = result({agentSessionId, teamId: 'accepted-team', deviceType: LoginOption.AGENT_DN,
            dn: '18005550123', roles: ['supervisor'], siteId: 'backend-site', usesOtherDN: true,
            auxCodeId: 'backend-aux'});
          if (agentSessionId === undefined) delete response.data.agentSessionId;
          await prepare('enabled', source === 'reload', response);
          if (source === 'login') {
            webex.cc.services.agent.stationLogin.mockResolvedValueOnce(response);
            await webex.cc.stationLogin({teamId: 'requested-team', loginOption: LoginOption.AGENT_DN,
              dialNumber: '18005550123'});
            webex.cc.$config.allowAutomatedRelogin = true;
          }
          const payload = {teamId: 'accepted-team', deviceType: LoginOption.AGENT_DN,
            dialNumber: '18005550123', deviceId: '18005550123', isExtension: false,
            roles: [AGENT], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: ''};
          expect(webex.cc['acceptedStation']).toEqual({orgId: 'mockOrgId', agentId: 'agent123',
            sessionId: undefined, revision: webex.cc['stationRevision'], payload});
          expect(webex.cc['currentAgentSessionId']).toBeUndefined();
          expect(webex.cc['priorStationActive']).toBe(true);
          expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(true);
          const saved = webex.cc['acceptedStation'];
          // Optional snapshot identity cannot authorize uncorrelated station notifications.
          webex.cc.services.aqmReqs.isLocalSessionTrackingId.mockReturnValue(false);
          webex.cc['handleWebsocketMessage'](JSON.stringify(result({teamId: 'foreign-team', trackingId: 'remote'})));
          expect(webex.cc['acceptedStation']).toBe(saved);
          webex.cc.services.agent.stationLogin.mockClear();
          webex.cc.services.agent.reload.mockRejectedValueOnce({data: {reasonCode: 1038}});

          await welcome(accept());

          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
          expect(webex.cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: payload});
          expect(webex.cc['lastPublishedRegionState'].status).toBe('ready');
        }
      );

      it('T-007 acceptedSnapshotReconcilesLatestTeamDeviceDn / failedLoginDoesNotPromote accepted payloads', async () => {
        await prepare();
        const cc = webex.cc;
        const initialPayload = {
          deviceType: LoginOption.EXTENSION, dialNumber: '1001', deviceId: '1001', isExtension: true,
          teamId: 'requested-team', roles: [AGENT], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: '',
        };
        const login = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
          agentSessionId: 'login-session', teamId: 'login-team', auxCodeId: 'login-idle',
          status: 'LoggedIn', subStatus: 'Idle', lastStateChangeReason: 'login',
          lastStateChangeTimestamp: 20, lastIdleCodeChangeTimestamp: 21});
        cc.services.agent.stationLogin.mockResolvedValueOnce(login);

        await cc.stationLogin({teamId: 'requested-team', loginOption: LoginOption.EXTENSION, dialNumber: '1001'});

        expect(cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: initialPayload});
        expectAcceptedStation({...initialPayload, teamId: 'login-team'}, login);

        const replacement = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
          agentSessionId: 'profile-session', teamId: 'profile-team', auxCodeId: '0',
          status: 'LoggedIn', subStatus: 'Available', lastStateChangeReason: 'profile-update',
          lastStateChangeTimestamp: 30, lastIdleCodeChangeTimestamp: 31});
        const replacementPayload = {...initialPayload, teamId: 'profile-team',
          deviceType: LoginOption.BROWSER, dialNumber: 'webrtc-agent123', deviceId: 'webrtc-agent123', isExtension: false};
        cc.services.agent.stationLogin.mockResolvedValueOnce(replacement);

        await cc.updateAgentProfile({teamId: 'profile-team', loginOption: LoginOption.BROWSER});

        expect(cc.services.agent.logout).toHaveBeenCalledTimes(1);
        expect(cc.services.agent.stationLogin.mock.calls[1][0]).toEqual({data: replacementPayload});
        expectAcceptedStation(replacementPayload, replacement);

        const reload = result({agentSessionId: 'reload-session', teamId: 'reload-team',
          deviceType: LoginOption.AGENT_DN, dn: '18005550123', dialNumber: 'ignored-number',
          isExtension: false, deviceId: null, roles: ['supervisor'], siteId: 'backend-site',
          status: 'LoggedIn', subStatus: 'Idle', lastStateChangeReason: 'agent-request',
          auxCodeId: 'reload-idle', lastStateChangeTimestamp: 40, lastIdleCodeChangeTimestamp: 41});
        const latestPayload = {...initialPayload, teamId: 'reload-team', deviceType: LoginOption.AGENT_DN,
          dialNumber: '18005550123', deviceId: '18005550123', isExtension: false};
        cc.services.agent.reload.mockResolvedValueOnce(reload);

        await cc['silentRelogin']();

        expect(cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expectAcceptedStation(latestPayload, reload);
        const accepted = cc['acceptedStation'];
        const saved = {...accepted, payload: {...accepted.payload, roles: [...accepted.payload.roles]}};
        const fields = acceptedFields();
        const failure = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
        cc.services.agent.stationLogin.mockRejectedValueOnce(failure);

        await expect(cc.stationLogin({teamId: 'failed-team', loginOption: LoginOption.EXTENSION,
          dialNumber: '9999'})).rejects.toBe(failure);

        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc['acceptedStation']).toEqual(saved);
        expect(acceptedFields()).toEqual(fields);
        cc.services.agent.reload.mockRejectedValueOnce(failure);

        await expect(cc['silentRelogin']()).rejects.toBe(failure);

        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc['acceptedStation']).toEqual(saved);
        expect(acceptedFields()).toEqual(fields);
        cc.$config.allowAutomatedRelogin = true;
        cc.services.agent.reload.mockRejectedValueOnce({data: {reasonCode: 1038}});
        const fallback = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
          agentSessionId: 'fallback-session', teamId: 'reload-team', auxCodeId: 'fallback-idle',
          lastStateChangeTimestamp: 50, lastIdleCodeChangeTimestamp: 51});
        cc.services.agent.stationLogin.mockResolvedValueOnce(fallback);
        cc.services.agent.stationLogin.mockClear();
        cc.services.agent.reload.mockClear();

        await welcome(accept());

        expect(cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expect(cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
        expect(cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: saved.payload});
        expectAcceptedStation(latestPayload, fallback);
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        await cc.deregister();
        expect(cc['acceptedStation']).toBeUndefined();
        expect(cc['priorStationActive']).toBe(false);
        expect([...cc['acceptedSwitchIds']]).toEqual([]);
      });

      it.each(['calling line', 'wxApp'])(
        'T-007 stationLoginSettlementBeforeAncillaryAwait records backend acceptance while %s is pending', async stage => {
          await prepare();
          webex.cc.agentConfig.webRtcEnabled = true;
          const backend = createDeferred<any>();
          const ancillary = createDeferred<void>();
          const response = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
            agentSessionId: 'accepted-session', teamId: 'accepted-team', auxCodeId: 'backend-idle'});
          const payload = {deviceType: LoginOption.BROWSER, dialNumber: 'webrtc-agent123',
            deviceId: 'webrtc-agent123', isExtension: false, teamId: 'requested-team',
            roles: [AGENT], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: ''};
          webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
          const setup = stage === 'calling line' ? webex.cc.webCallingService.registerWebCallingLine
            : jest.spyOn(webex.cc, 'ensureWxAppPostStationLogin');
          setup.mockReturnValueOnce(ancillary.promise);
          const settled = jest.fn();
          const pending = webex.cc.stationLogin({teamId: 'requested-team', loginOption: LoginOption.BROWSER});
          void pending.then(settled, settled);
          await settle();
          expect(webex.cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: payload});
          expect(webex.cc['acceptedStation']).toBeUndefined();
          expect(webex.cc['priorStationActive']).toBe(false);

          backend.resolve(response); await settle();

          expectAcceptedStation({...payload, teamId: 'accepted-team'}, response);
          expect(webex.cc['lastPublishedRegionState'].status).toBe('ready');
          expect(setup).toHaveBeenCalledTimes(1);
          expect(settled).not.toHaveBeenCalled();
          ancillary.resolve(); await pending;
          expect(settled).toHaveBeenCalledTimes(1);
          expectAcceptedStation({...payload, teamId: 'accepted-team'}, response);
        }
      );

      it('T-007 registerRestoredCountsActive, registerRestoredSnapshotEnablesFallback and defaultAuxNotReplayed', async () => {
        await prepare('enabled', true);
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
        expectAcceptedStation({deviceType: LoginOption.EXTENSION, dialNumber: '1234', deviceId: '1234',
          isExtension: true, teamId: 'team', roles: [AGENT], teamName: '', siteId: '',
          usesOtherDN: false, auxCodeId: ''}, result());
        webex.cc.services.agent.reload.mockRejectedValue({data: {reasonCode: 1038}});
        await welcome(accept());
        expect(webex.cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: {
          deviceType: 'EXTENSION', dialNumber: '1234', deviceId: '1234', isExtension: true,
          teamId: 'team', roles: ['agent'], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: '',
        }});
        expect(webex.cc['lastPublishedRegionState'].status).toBe('ready');
        expect(mockTaskManager.invalidateRegionalTasks).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.config.getMultiRegionSettings).toHaveBeenCalledTimes(1);
      });

      it.each([false, true])('T-007 priorActiveWithoutUsableSnapshot takes the manual branch with automation=%s', async automate => {
        await prepare('enabled', true, result({teamId: ''}));
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
        expect(webex.cc['priorStationActive']).toBe(true);
        expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(true);
        expect(webex.cc['acceptedStation']).toBeUndefined();
        webex.cc.$config.allowAutomatedRelogin = automate;

        await welcome(accept());

        expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired',
          reason: automate ? 'session-restore-failed' : 'automatic-relogin-disabled',
          trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
        expect(webex.cc.services.agent.reload).not.toHaveBeenCalled();
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
        expect(mockTaskManager.invalidateRegionalTasks).not.toHaveBeenCalled();
      });

      it.each([
        [{reasonCode: 9999, status: 429}, 'transient'], [{reasonCode: 9999, status: 502}, 'transient'],
        [{reasonCode: 9999, status: 503}, 'transient'], [{reasonCode: 9999, reason: 'AGENT_NOT_FOUND'}, 'fallback'],
        [{reasonCode: 9999, reason: 'AGENT_DN_NOT_REGISTERED'}, 'fallback'],
        [{reasonCode: 9999, reason: 'AGENT_SESSION_ALREADY_EXISTS'}, 'exists'],
        [{reasonCode: 9999, reason: 'INTERNAL_ERROR'}, 'transient'],
        [{id: 'Service.aqm.reqs.Timeout'}, 'transient'],
        [{id: 'Service.aqm.reqs.TimeoutEvent'}, 'transient'],
        [{reasonCode: 9999, id: 'Timeout'}, 'transient'], [{reasonCode: 9999, id: 'TimeoutEvent'}, 'transient'],
        [{reasonCode: 1038, reason: 'INTERNAL_ERROR', status: 503}, 'fallback'],
        [{reasonCode: 1041}, 'fallback'], [{reasonCode: 9999, status: 400}, 'other'],
        [{reasonCode: 1037, reason: 'AGENT_NOT_FOUND'}, 'transient'],
        [{reasonCode: 1035, reason: 'AGENT_NOT_FOUND'}, 'exists'],
        [{reasonCode: 1037, status: 401}, 'auth'], [{reasonCode: 1035, status: 403}, 'auth'],
        [{reasonCode: 1037, reason: 'RECOVERY_INTERRUPTED', status: 403}, 'cancelled'],
      ])('T-007 recoveryFailureCategoryPrecedence %j', (failure, category) => {
        expect(ContactCenter['recoveryFailureCategory'](failure)).toBe(category);
      });

      it.each([
        {data: {reasonCode: 1038}}, {data: {reasonCode: 1041}},
        {details: {data: {reasonCode: '1041'}}},
        {data: {reason: 'AGENT_NOT_FOUND'}}, {data: {reason: 'AGENT_DN_NOT_REGISTERED'}},
        {data: {reasonCode: 9999}, statusCode: 400},
      ])('T-007 nonTransientReloadFailureDirectFallback %j', async failure => {
        jest.useFakeTimers(); await prepare('enabled', true);
        const saved = stationPayload(LoginOption.EXTENSION, '1234', 'team');
        const backend = createDeferred<any>();
        webex.cc.services.agent.reload.mockRejectedValueOnce(failure);
        webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
        const states = jest.fn();
        webex.cc.on('region:stateChange', states);
        const startedAt = Date.now();
        const pending = welcome(accept()); await settle();

        // No timer advancement: these failures must dispatch the saved payload immediately.
        expect(Date.now()).toBe(startedAt);
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: saved});
        expect(webex.cc['lastPublishedRegionState'].status).toBe('recovering');
        expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([]);

        const response = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
          teamId: 'fallback-team', agentSessionId: 'fallback-session'});
        backend.resolve(response); await pending;

        expect(Date.now()).toBe(startedAt);
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
        expectAcceptedStation({...saved, teamId: 'fallback-team'}, response);
        expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([[{
          status: 'ready', reason: 'region-switch', trackingId: 'switch', operation: 'FAILOVER',
          scope: 'ORG', homeRegion: 'produs1',
        }]]);
      });

      it('T-007 allReloadAllowlistAnd1035Paths / recoveryFailureCategoryPrecedence reload pacing and fallback/post1035 budgets', async () => {
        jest.useFakeTimers(); await prepare('enabled', true);
        webex.cc.services.agent.reload.mockRejectedValue({data: {reasonCode: 9999}, statusCode: 503});
        webex.cc.services.agent.stationLogin.mockRejectedValue({data: {reasonCode: 1035}});
        const options = accept(); const pending = welcome(options); await settle();
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        for (const [count, wait] of [[2, 2000], [3, 4000], [5, 8000]]) {
          jest.advanceTimersByTime(wait - 1); await settle();
          expect(webex.cc.services.agent.reload.mock.calls.length).toBeLessThan(count);
          jest.advanceTimersByTime(1); await settle();
        }
        await pending;
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(5);
        expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
        expect(webex.cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
      });

      it.each(['waiting', 'subscribing', 'awaitingWelcome', 'restoringSession', 'manualLoginRequired',
        'unavailable', 'reloadRequired', 'cancelled'])('T-008 setAgentStateAdmissionAdvancesIntent %s', async (phase) => {
        await prepare(); webex.cc['setRecoveryPhase'](phase);
        const revision = webex.cc['stateIntentRevision'];
        const reason = phase === 'reloadRequired' ? 'REGION_RELOAD_REQUIRED' :
          ['unavailable', 'cancelled'].includes(phase) ? 'RECOVERY_INTERRUPTED' : 'RECOVERY_IN_PROGRESS';
        await expect(webex.cc.setAgentState({state: 'Available', auxCodeId: '0'}))
          .rejects.toMatchObject({data: {reason}});
        expect(webex.cc['stateIntentRevision']).toBe(revision + 1);
        expect(webex.cc.services.agent.stateChange).not.toHaveBeenCalled();
      });

      it.each(['waiting', 'subscribing', 'awaitingWelcome', 'restoringSession'])('T-008 publicSessionAdmissionByRecoveryPhase / publicStationLoginRejectedDuringAutomaticRestore %s', async (phase) => {
        await prepare(); webex.cc['setRecoveryPhase'](phase);
        await expect(webex.cc.stationLogin({teamId: 'team', loginOption: 'BROWSER'}))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
        expect(webex.cc.webCallingService.registerWebCallingLine).not.toHaveBeenCalled();
      });

      it.each(['success', 'failure', 'undispatchable'].flatMap(outcome =>
        ['before Welcome', 'reload success', 'reload failure'].map(work => [outcome, work])))(
        'T-012 stationLogoutKeepsHistoryClearsSnapshot outcome=%s late=%s', async (outcome, work) => {
          await prepare('enabled', true);
          const options = accept();
          const accepted = webex.cc['acceptedStation'];
          const reload = createDeferred<any>();
          let oldWork: Promise<void>;
          if (work !== 'before Welcome') {
            webex.cc.services.agent.reload.mockReturnValueOnce(reload.promise);
            oldWork = welcome(options); oldWork.catch(() => undefined); await settle();
            expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          }
          if (outcome === 'failure')
            webex.cc.services.agent.logout.mockRejectedValue(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          if (outcome === 'undispatchable') mockWebSocketManager.hasUsableSocket.mockReturnValue(false);
          const promise = webex.cc.stationLogout({logoutReason: 'user'});
          if (outcome === 'success') await promise;
          else await expect(promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          expectHistoryAndStation(['switch'], outcome === 'success' ? undefined : accepted);
          expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
          expect(webex.cc.services.connectionService.reset).toHaveBeenLastCalledWith(expect.objectContaining({recoverIfDisconnected: true}));
          expect(webex.cc['suppressAutomaticRelogin']).toBe(outcome === 'success');
          const owner = captureSwitchOwner(); const actions = switchActions();
          const states = jest.fn(); webex.cc.on('region:stateChange', states);
          const reloads = webex.cc.services.agent.reload.mock.calls.length;
          const logins = webex.cc.services.agent.stationLogin.mock.calls.length;

          if (work === 'before Welcome') oldWork = welcome(options);
          const interrupted = expect(oldWork).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          if (work === 'reload success') reload.resolve(result({agentSessionId: 'obsolete-session'}));
          if (work === 'reload failure') reload.reject(new Error('obsolete reload'));
          await interrupted; await settle();
          await expect(welcome(options)).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          webex.cc['handleWebsocketMessage'](switchEvent());
          expect(captureSwitchOwner()).toEqual(owner);
          expect(switchActions()).toEqual(actions);
          expect(states).not.toHaveBeenCalled();
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(reloads);
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(logins);

          mockWebSocketManager.hasUsableSocket.mockReturnValue(true);
          webex.cc.services.agent.stationLogin.mockResolvedValueOnce(result({teamId: 'later-team', agentSessionId: 'later-session'}));
          await webex.cc.stationLogin({teamId: 'later-team', loginOption: LoginOption.EXTENSION, dialNumber: '5678'});
          expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(logins + 1);
          expect(webex.cc['acceptedStation'].payload.teamId).toBe('later-team');
          expect(webex.cc['priorStationActive']).toBe(true);
          expect(webex.cc['suppressAutomaticRelogin']).toBe(false);
          expect(states.mock.calls).toEqual([[{status: 'ready', reason: 'initial-login', homeRegion: 'produs1'}]]);
          const replacement = captureSwitchOwner();
          webex.cc['handleWebsocketMessage'](switchEvent());
          expect(captureSwitchOwner()).toEqual(replacement);
          expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(1);
          expect(states).toHaveBeenCalledTimes(1);
        }
      );

      it('T-012 stationLogoutDuringDrWithoutPrimaryRejectsImmediately', async () => {
        await prepare('enabled', true); accept();
        mockWebSocketManager.hasUsableSocket.mockReturnValue(false);
        await expect(webex.cc.stationLogout({logoutReason: 'user'})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(webex.cc.services.agent.logout).not.toHaveBeenCalled();
        expect(webex.cc['acceptedStation']).toBeDefined();
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(webex.cc['recoveryPhase']).toBe('idle');
        expect(webex.cc.services.connectionService.reset).toHaveBeenLastCalledWith(expect.objectContaining({recoverIfDisconnected: true}));
        mockWebSocketManager.hasUsableSocket.mockReturnValue(true);
        await webex.cc['handleConnectionLost']({isSocketReconnected: true});
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        await webex.cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
        expectHistoryAndStation(['switch'], webex.cc['acceptedStation']);
        expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'initial-login', homeRegion: 'produs1'});
      });

      it('T-012 stationLogoutCancellationSnapshotPolicy with no pending auto-state emits no event', async () => {
        await prepare('enabled', true);
        const listener = jest.fn(() => { void webex.cc.stationLogout({logoutReason: 'observer'}); });
        webex.cc.on('region:stateChange', listener); accept(); await settle();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.connectionService.recoverRegion).not.toHaveBeenCalled();
        expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
      });

      it.each([undefined, 'AgentMultiLoginCloseSession', 'unknown'])('T-012 primaryMultiLoginCancelsBeforeForwarding %s', async (type) => {
        await prepare('enabled', true); accept();
        const registration = webex.cc['registrationGeneration'];
        const listener = jest.fn(() => {
          expect(webex.cc['registrationAbortController'].signal.aborted).toBe(true);
          expect(webex.cc.services.connectionService.stop).toHaveBeenCalled();
          expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledWith(false, 'registrationEnded');
          expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
          expect(webex.cc['acceptedStation']).toBeUndefined();
        });
        webex.cc.on(AGENT_EVENTS.AGENT_MULTI_LOGIN, listener);
        webex.cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN,
          data: {type, agentSessionId: 'other'}}));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(webex.cc['registrationGeneration']).toBe(registration + 1);
      });

      it.each(stationCases.flatMap(stationCase =>
        ['region-switch', 'automatic-relogin-disabled', 'session-restore-failed'].map(reason => ({...stationCase, reason}))))(
        'T-007/T-011 manualDrLoginReadyMetadata and manualLoginFailureStaysManualAndSuccessReady %j', async stationCase => {
          const {reason, deviceType} = stationCase;
          await prepare('enabled', reason !== 'region-switch');
          if (reason === 'session-restore-failed') {
            webex.cc.services.aqmReqs.isLocalSessionTrackingId.mockReturnValue(false);
            webex.cc['handleWebsocketMessage'](JSON.stringify(result({teamId: '', trackingId: 'foreign'})));
          } else webex.cc.$config.allowAutomatedRelogin = false;
          await welcome(accept());
          expect(webex.cc['lastPublishedRegionState'].reason).toBe(reason);
          const failure = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
          webex.cc.services.agent.stationLogin.mockRejectedValueOnce(failure);
          const input = {teamId: 'requested-team', loginOption: deviceType, dialNumber: '18005550333'};
          await expect(webex.cc.stationLogin(input)).rejects.toBe(failure);
          expect(webex.cc['recoveryPhase']).toBe('manualLoginRequired');
          expect(webex.cc['lastPublishedRegionState'].reason).toBe(reason);
          const effects = observeStationEffects(stationCase);
          const backend = createDeferred<any>();
          const response = result({type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
            teamId: 'manual-team', agentSessionId: 'manual-session', auxCodeId: 'manual-idle',
            lastStateChangeTimestamp: 201, lastIdleCodeChangeTimestamp: 202});
          webex.cc.services.agent.stationLogin.mockClear();
          webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
          mockTaskManager.invalidateRegionalTasks.mockClear();
          const before = acceptedFields();
          const states = jest.fn();
          webex.cc.on('region:stateChange', states);
          const pending = webex.cc.stationLogin(input); await settle();

          expect(mockTaskManager.invalidateRegionalTasks).toHaveBeenCalledTimes(1);
          expect(mockTaskManager.invalidateRegionalTasks.mock.invocationCallOrder[0])
            .toBeLessThan(webex.cc.services.agent.stationLogin.mock.invocationCallOrder[0]);
          const number = deviceType === LoginOption.BROWSER ? 'webrtc-agent123' : input.dialNumber;
          expect(webex.cc.services.agent.stationLogin.mock.calls.map(([request]) => request))
            .toEqual([{data: stationPayload(deviceType, number, 'requested-team')}]);
          expect(acceptedFields()).toEqual(before);
          expect(effects.acceptStation).not.toHaveBeenCalled();
          expect(effects.postLogin).not.toHaveBeenCalled();
          expect(effects.subscribe).not.toHaveBeenCalled();
          expect(effects.publish).not.toHaveBeenCalled();
          expect(states).not.toHaveBeenCalled();

          backend.resolve(response); await pending;

          expect(mockTaskManager.invalidateRegionalTasks.mock.invocationCallOrder[0])
            .toBeLessThan(effects.acceptStation.mock.invocationCallOrder[0]);
          expectAcceptedStation(stationPayload(deviceType, number, 'manual-team'), response);
          expectStationEffects(stationCase, effects);
          expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'region-switch',
            trackingId: 'switch', operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'});
          expect(states.mock.calls).toEqual([[webex.cc['lastPublishedRegionState']]]);
          expect(webex.cc['sessionRequest']).toBeUndefined();
        }
      );

      it.each(['backend', 'no-primary'])('T-007 failedLogoutPreservesAcceptedStation %s', async (kind) => {
        await prepare('enabled', true);
        if (kind === 'backend') webex.cc.services.agent.logout.mockRejectedValue(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        else mockWebSocketManager.hasUsableSocket.mockReturnValue(false);
        await expect(webex.cc.stationLogout({logoutReason: 'user'})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        mockWebSocketManager.hasUsableSocket.mockReturnValue(true);
        await welcome(accept());
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expect(webex.cc['lastPublishedRegionState'].status).toBe('ready');
      });

      it.each([
        ['rejected logout', false, false, true],
        ['retained pending logout', false, true, true],
        ['retained suppression', true, false, true],
        ['automation disabled at Welcome', false, false, false],
      ])('T-012 Welcome reevaluates current logout policy: %s', async (_name, prior, pending, automate) => {
        await prepare('enabled', true);
        const accepted = webex.cc['acceptedStation'];
        webex.cc['suppressAutomaticRelogin'] = prior;
        const backend = createDeferred<any>();
        webex.cc.services.agent.logout.mockReturnValue(backend.promise);
        const logout = webex.cc.stationLogout({logoutReason: 'user'});
        const rejected = expect(logout).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        // Start with the opposite configuration to prove policy is read at Welcome.
        webex.cc.$config.allowAutomatedRelogin = !automate;
        const options = accept();
        webex.cc.$config.allowAutomatedRelogin = automate;
        if (!pending) {
          backend.reject(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          await rejected;
        }
        expect(webex.cc['logoutPending']).toBe(pending);
        expect(webex.cc['suppressAutomaticRelogin']).toBe(pending || prior);
        expect(webex.cc['acceptedStation']).toBe(accepted);
        await welcome(options);
        const restores = automate && !pending && !prior;
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(restores ? 1 : 0);
        expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
        expect(webex.cc['lastPublishedRegionState']).toMatchObject(restores
          ? {status: 'ready', reason: 'region-switch'}
          : {status: 'stationLoginRequired', reason: 'automatic-relogin-disabled'});
        if (pending) {
          backend.reject(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          await rejected;
          // A subsequent replacement Welcome uses the newly restored suppression policy.
          await welcome(options);
          expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
          expect(webex.cc['lastPublishedRegionState']).toMatchObject({status: 'ready', reason: 'region-switch'});
        }
      });

      it.each([false, true])('T-012 failedLogoutRestoresPriorSuppression prior=%s', async prior => {
        await prepare('enabled', true);
        webex.cc['suppressAutomaticRelogin'] = prior;
        webex.cc.services.agent.logout.mockRejectedValue(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        await expect(webex.cc.stationLogout({logoutReason: 'user'})).rejects.toThrow();
        expect(webex.cc['logoutPending']).toBe(false);
        expect(webex.cc['suppressAutomaticRelogin']).toBe(prior);
        expect(webex.cc['priorStationActive']).toBe(true);
      });

      it.each(['line', 'wxApp'].flatMap(stage => ['none', 'station', 'authoritative logout'].map(boundary => [stage, boundary])))(
        'T-012 confirmedLogoutCleanupFailurePreservesOwnedPolicy stage=%s boundary=%s', async (stage, boundary) => {
          await prepare('enabled', true);
          const cleanup = createDeferred<void>();
          if (stage === 'line') webex.cc.webCallingService.deregisterWebCallingLine.mockReturnValue(cleanup.promise);
          else jest.spyOn(webex.cc as any, 'teardownWxAppLocalState').mockReturnValue(cleanup.promise);
          const logout = webex.cc.stationLogout({logoutReason: 'user'});
          const rejected = expect(logout).rejects.toThrow();
          await settle();
          expect(webex.cc['logoutPending']).toBe(false);
          expect(webex.cc['suppressAutomaticRelogin']).toBe(true);
          expect(webex.cc['acceptedStation']).toBeUndefined();
          expect(webex.cc['priorStationActive']).toBe(false);
          if (boundary === 'station') {
            webex.cc.services.agent.stationLogin.mockResolvedValue(result({agentSessionId: 'replacement'}));
            await webex.cc.stationLogin({teamId: 'team', loginOption: 'EXTENSION', dialNumber: '1234'});
          } else if (boundary === 'authoritative logout') webex.cc['handleWebsocketMessage'](JSON.stringify({
            ...result({type: CC_EVENTS.AGENT_LOGOUT_SUCCESS}), type: CC_EVENTS.AGENT_LOGOUT,
          }));
          const accepted = webex.cc['acceptedStation'];
          const session = webex.cc['currentAgentSessionId'];
          cleanup.reject(new Error('local cleanup')); await rejected;
          expect(webex.cc['logoutPending']).toBe(false);
          expect(webex.cc['suppressAutomaticRelogin']).toBe(boundary !== 'station');
          expect(webex.cc['acceptedStation']).toBe(accepted);
          expect(webex.cc['currentAgentSessionId']).toBe(session);
          if (boundary === 'none') {
            await welcome(accept());
            expect(webex.cc['lastPublishedRegionState']).toMatchObject({status: 'stationLoginRequired', reason: 'region-switch'});
            expect(webex.cc.services.agent.reload).not.toHaveBeenCalled();
            expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
          }
        }
      );

      it.each(['station', 'registration', 'deregister', 'authoritative logout']
        .flatMap(boundary => [false, true].map(success => [boundary, success])))(
        'T-012 oldLogoutReplyCannotOverwriteReplacement %s success=%s', async (boundary, success) => {
          await prepare('enabled', true);
          const backend = createDeferred<any>();
          webex.cc.services.agent.logout.mockReturnValue(backend.promise);
          const logout = webex.cc.stationLogout({logoutReason: 'user'});
          const rejected = expect(logout).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          if (boundary === 'registration') await webex.cc.register();
          else if (boundary === 'deregister') await webex.cc.deregister();
          else {
            webex.cc.services.agent.stationLogin.mockResolvedValue(result({agentSessionId: 'replacement'}));
            await webex.cc.stationLogin({teamId: 'replacement-team', loginOption: 'EXTENSION', dialNumber: '5678'});
            if (boundary === 'authoritative logout') webex.cc['handleWebsocketMessage'](JSON.stringify({
              ...result({type: CC_EVENTS.AGENT_LOGOUT_SUCCESS, agentSessionId: 'replacement'}), type: CC_EVENTS.AGENT_LOGOUT,
            }));
          }
          const accepted = webex.cc['acceptedStation'];
          const session = webex.cc['currentAgentSessionId'];
          const suppression = webex.cc['suppressAutomaticRelogin'];
          expect(webex.cc['logoutPending']).toBe(false);
          if (boundary === 'authoritative logout') {
            expect(accepted).toBeUndefined(); expect(suppression).toBe(true);
          }
          if (success) backend.resolve({data: {type: CC_EVENTS.AGENT_LOGOUT_SUCCESS}});
          else backend.reject(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          await rejected;
          expect(webex.cc['acceptedStation']).toBe(accepted);
          expect(webex.cc['currentAgentSessionId']).toBe(session);
          expect(webex.cc['suppressAutomaticRelogin']).toBe(suppression);
          expect(webex.cc['logoutPending']).toBe(false);
        }
      );

      it.each(['logout', 'replacement login'])(
        'T-007 failedProfileLogoutPreservesAcceptedStation only until logout succeeds: failure at %s', async stage => {
          await prepare('enabled', true);
          const accepted = webex.cc['acceptedStation'];
          const saved = {...accepted, payload: {...accepted.payload, roles: [...accepted.payload.roles]}};
          const fields = acceptedFields();
          const failure = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
          if (stage === 'logout') webex.cc.services.agent.logout.mockRejectedValueOnce(failure);
          else webex.cc.services.agent.stationLogin.mockRejectedValueOnce(failure);
          await expect(webex.cc.updateAgentProfile({teamId: 'new', loginOption: 'EXTENSION', dialNumber: '999'})).rejects.toBe(failure);
          expect(webex.cc.services.agent.logout).toHaveBeenCalledTimes(1);
          if (stage === 'logout') {
            expect(webex.cc.services.agent.stationLogin).not.toHaveBeenCalled();
            expect(webex.cc['acceptedStation']).toBe(accepted);
            expect(webex.cc['acceptedStation']).toEqual(saved);
            expect(acceptedFields()).toEqual(fields);
          } else {
            expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
            expect(webex.cc.services.agent.stationLogin.mock.calls[0][0]).toEqual({data: {
              deviceType: LoginOption.EXTENSION, dialNumber: '999', deviceId: '999', isExtension: true,
              teamId: 'new', roles: [AGENT], teamName: '', siteId: '', usesOtherDN: false, auxCodeId: '',
            }});
            expect(webex.cc['acceptedStation']).toBeUndefined();
            expect(webex.cc['priorStationActive']).toBe(false);
            expect(webex.cc['currentAgentSessionId']).toBeUndefined();
            expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(false);
            expect(webex.cc.agentConfig.currentTeamId).toBeUndefined();
            expect(webex.cc.agentConfig.deviceType).toBeUndefined();
            expect(webex.cc.agentConfig.dn).toBeUndefined();
            expect(webex.cc.agentConfig.defaultDn).toBeUndefined();
          }
        }
      );

      it.each(['stationLogin', 'register-restored'].flatMap(source => [true, false].flatMap(hydrationFirst => [
        {source, hydrationFirst, servingRegion: ' pRoDuS1 ', limitedService: false},
        {source, hydrationFirst, servingRegion: ' PrODuS2 ', limitedService: true},
      ])))('T-011 hydrationCompletionRepublishesHomeRegionAndLimitedService %j', async ({source, hydrationFirst, servingRegion, limitedService}) => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: source === 'register-restored'};
        const reader = createDeferred<any>();
        const reload = createDeferred<any>();
        webex.cc.services.config.getMultiRegionSettings.mockReturnValue(reader.promise);
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        mockWebSocketManager.getServingRegion.mockReturnValue(servingRegion);
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({webRtcEnabled: false}));
        webex.cc.services.agent.stationLogin.mockResolvedValue(result());
        webex.cc.services.agent.reload.mockReturnValue(reload.promise);
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        const registration = webex.cc.register();
        await settle();
        expect(webex.cc.services.config.getMultiRegionSettings).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(source === 'register-restored' ? 1 : 0);
        expect(listener).not.toHaveBeenCalled();
        if (hydrationFirst) {
          reader.resolve({eligibility: 'enabled', homeRegion: ' ProDUs1 '}); await settle();
          expect(listener).not.toHaveBeenCalled();
        }
        if (source === 'register-restored') reload.resolve(result());
        await registration;
        if (source === 'stationLogin')
          await webex.cc.stationLogin({teamId: 'team', loginOption: 'EXTENSION', dialNumber: '1234'});
        const complete = {status: 'ready', reason: 'initial-login',
          homeRegion: ' ProDUs1 ', servingRegion, limitedService};
        expect(listener.mock.calls).toEqual([[hydrationFirst ? complete : {
          status: 'ready', reason: 'initial-login', servingRegion,
        }]]);
        if (!hydrationFirst) {
          reader.resolve({eligibility: 'enabled', homeRegion: ' ProDUs1 '}); await settle();
        }
        expect(listener.mock.calls).toEqual(hydrationFirst ? [[complete]] : [
          [{status: 'ready', reason: 'initial-login', servingRegion}], [complete],
        ]);
        expect(webex.cc['lastPublishedRegionState']).toEqual(complete);
        webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
        expect(listener).toHaveBeenCalledTimes(hydrationFirst ? 1 : 2);
      });

      it.each([true, false])('T-011 hydrationRepublishesExistingSnapshotOnly present=%s', async (present) => {
        await prepare(); if (present) await webex.cc.stationLogin({teamId: 'team', loginOption: 'EXTENSION', dialNumber: '1234'});
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        mockWebSocketManager.getServingRegion.mockReturnValue('produs2');
        webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
        webex.cc['onMultiRegionSettingsChanged'](webex.cc['registrationGeneration']);
        expect(listener).toHaveBeenCalledTimes(present ? 1 : 0);
        if (present) expect(listener).toHaveBeenCalledWith({status: 'ready', reason: 'initial-login',
          homeRegion: 'produs1', servingRegion: 'produs2', limitedService: true});
      });

      it('T-005 ordinaryMismatchSingleReloadSnapshot', async () => {
        await prepare();
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        const terminal = webex.cc.services.connectionService.reset.mock.calls.slice(-1)[0][0].onTerminalFailure;
        const failure = Object.assign(new Error('safe'), {data: {kind: 'region-mismatch', status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
        terminal(failure); terminal(failure);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].status).toBe('reloadRequired');
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
      });

      it.each([undefined, '', 'different-agent'])('T-003 primaryWelcomeIdentityFenced %s', async (agentId) => {
        await prepare('enabled', true); accept();
        expect(webex.cc['acceptedStation']).toBeDefined();
        expect(webex.cc['priorStationActive']).toBe(true);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual(['switch']);
        webex.cc['handleWebsocketMessage'](JSON.stringify({type: 'Welcome', data: {agentId}}));
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(true);
        expect(webex.cc['acceptedStation']).toBeUndefined();
        expect(webex.cc['priorStationActive']).toBe(false);
        expect([...webex.cc['acceptedSwitchIds']]).toEqual([]);
        expect(webex.cc.services.connectionService.stop).toHaveBeenCalled();
      });

      it.each([true, false])('T-007 backendSessionNotificationsReconcile / backendSessionNotificationIdentityAndProvenance local=%s', async (local) => {
        await prepare('enabled', true);
        webex.cc.services.aqmReqs.isLocalSessionTrackingId.mockReturnValue(local);
        webex.cc['handleWebsocketMessage'](JSON.stringify(result({teamId: 'other', dn: '987', trackingId: 'remote'})));
        expect(webex.cc['acceptedStation'].payload.teamId).toBe(local ? 'team' : 'other');
        expect(webex.cc['acceptedStation'].payload.dialNumber).toBe(local ? '1234' : '987');
      });

      it('T-007 remoteLogoutPreventsAutomaticRestore', async () => {
        await prepare('enabled', true);
        webex.cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_LOGOUT,
          data: {orgId: 'mockOrgId', agentId: 'agent123', agentSessionId: 'session', type: CC_EVENTS.AGENT_LOGOUT_SUCCESS}}));
        await welcome(accept());
        expect(webex.cc.services.agent.reload).not.toHaveBeenCalled();
        expect(webex.cc['lastPublishedRegionState'].reason).toBe('region-switch');
      });

      it.each([
        ['empty envelope', {type: undefined, orgId: undefined, trackingId: undefined}, undefined],
        ['missing identifiers', {orgId: undefined, trackingId: undefined}, undefined],
        ['nested injection', {type: 'other', data: {
          type: 'SYSTEM_REGION_SWITCH', orgId: 'mockOrgId', trackingId: 'nested-switch',
          operation: 'FAILOVER', scope: 'ORG',
        }}, undefined],
        ['whitespace identifiers', {orgId: ' \t ', trackingId: ' \n '}, undefined],
        ['non-string identifiers', {orgId: 123, trackingId: {id: 'switch'}}, undefined],
        ['valid top-level', {}, {}],
        ['trimmed identifiers', {orgId: ' \t mockOrgId \n ', trackingId: ' \t trimmed-envelope \n '},
          {trackingId: 'trimmed-envelope'}],
        ...['FAILOVER', 'FAILBACK'].flatMap(operation => ['REGION', 'ORG'].map(scope => [
          `${operation} ${scope}`, {data: {operation, scope}}, {operation, scope},
        ])),
        ['unrecognized operation', {data: {operation: 'MOVE', scope: 'ORG'}}, {scope: 'ORG'}],
        ['unrecognized scope', {data: {operation: 'FAILBACK', scope: 'AGENT'}}, {operation: 'FAILBACK'}],
        ['unrecognized metadata', {data: {operation: 'MOVE', scope: 'AGENT'}}, {}],
        ['wrong-case operation', {data: {operation: 'failover', scope: 'REGION'}}, {scope: 'REGION'}],
        ['wrong-case scope', {data: {operation: 'FAILOVER', scope: 'org'}}, {operation: 'FAILOVER'}],
        ['malformed operation', {data: {operation: 123, scope: 'ORG'}}, {scope: 'ORG'}],
        ['malformed scope', {data: {operation: 'FAILBACK', scope: {value: 'ORG'}}}, {operation: 'FAILBACK'}],
        ['untrusted extra fields', {data: {operation: 'FAILOVER', scope: 'REGION',
          type: 'SYSTEM_REGION_SWITCH', trackingId: 'injected', orgId: 'foreign-org',
          token: 'SECRET', replacementUrl: 'wss://untrusted.invalid'}},
          {operation: 'FAILOVER', scope: 'REGION'}],
        ...[
          ['empty data', {}], ['null data', null], ['string data', 'FAILOVER'],
          ['numeric data', 123], ['boolean data', true],
          ['array data', [{operation: 'FAILOVER', scope: 'ORG'}]],
        ].map(([name, data]) => [name, {data}, {}]),
      ])(
        'T-002/T-013 systemRegionSwitchNeverPublicRawEvent: %s', async (name, overrides, snapshotFields) => {
          await prepare('enabled');
          expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
          const trackingId = `envelope-${name.replace(/ /g, '-')}`;
          const frame = {type: 'SYSTEM_REGION_SWITCH', orgId: 'mockOrgId', trackingId, ...overrides};
          const raw = jest.fn(); webex.cc.on('SYSTEM_REGION_SWITCH', raw);
          const states = jest.fn(); webex.cc.on('region:stateChange', states);
          const owner = captureSwitchOwner(); const actions = switchActions();
          const recoveries = webex.cc.services.connectionService.recoverRegion.mock.calls.length;

          webex.cc['handleWebsocketMessage'](JSON.stringify(frame));

          expect(raw).not.toHaveBeenCalled();
          if (snapshotFields === undefined) {
            expect(captureSwitchOwner()).toEqual(owner);
            expect(switchActions()).toEqual(actions);
            expect(states.mock.calls).toEqual([]);
          } else {
            const snapshot = {status: 'recovering', reason: 'region-switch', trackingId,
              homeRegion: 'produs1', ...snapshotFields};
            expect(states.mock.calls).toEqual([[snapshot]]);
            expect(webex.cc['lastPublishedRegionState']).toEqual(snapshot);
            expect([...webex.cc['acceptedSwitchIds']]).toEqual([snapshot.trackingId]);
            expect(webex.cc.services.connectionService.recoverRegion).toHaveBeenCalledTimes(recoveries + 1);
          }
        }
      );
    });

    describe('T-005 initial subscription mismatch boundary', () => {
      const recognizedReason = 'REGION_MISMATCH_NO_OVERRIDE';
      const createConflict = (details: object) =>
        Object.assign(new Error('registration conflict'), {statusCode: 409}, details);

      beforeEach(() => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION],
        }));
      });

      it.each<[string, object]>([
        ['header', {headers: {'X-WxCC-Region-Reason': ` ${recognizedReason} `}}],
        ['body', {body: {reason: recognizedReason}}],
        ['nested body', {body: {error: {reason: recognizedReason}}}],
      ])('excludesOther409StatusAndOperation recognized %s 409 only for subscription failure', async (_source, details) => {
        const failure = createConflict(details);
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        const requireReload = jest.spyOn(webex.cc, 'requireRegionReload');
        mockWebSocketManager.initWebSocket.mockRejectedValueOnce(failure);

        await expect(webex.cc.register()).rejects.toMatchObject({
          message: 'REGION_RELOAD_REQUIRED', data: {reason: 'REGION_RELOAD_REQUIRED'},
        });
        expect(listener.mock.calls).toEqual([[{status: 'reloadRequired', reason: 'region-mismatch'}]]);
        expect(requireReload).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.config.getAgentConfig).not.toHaveBeenCalled();
        expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'regionMismatch');
        expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledWith(false, 'regionMismatch');

        listener.mockClear();
        webex.cc.services.config.getAgentConfig.mockRejectedValueOnce(failure);
        await expect(webex.cc.register()).rejects.toBe(failure);
        expect(listener).not.toHaveBeenCalled();
        expect(requireReload).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.config.getMultiRegionSettings).not.toHaveBeenCalled();
        expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
          METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED, {orgId: undefined}, ['operational']
        );
      });

      it.each(['task configuration', 'silent relogin'])(
        'preserves a recognized 409 from subsequent %s', async (stage) => {
          const failure = createConflict({headers: {'x-wxcc-region-reason': recognizedReason}});
          const listener = jest.fn();
          webex.cc.on('region:stateChange', listener);
          if (stage === 'task configuration') {
            mockTaskManager.setConfigFlags.mockImplementationOnce(() => { throw failure; });
          } else {
            webex.cc.$config.allowAutomatedRelogin = true;
            jest.spyOn(webex.cc, 'silentRelogin').mockRejectedValueOnce(failure);
          }

          await expect(webex.cc.register()).rejects.toBe(failure);
          expect(listener).not.toHaveBeenCalled();
          expect(mockWebSocketManager.close).not.toHaveBeenCalled();
        }
      );

      it.each(['superseded registration', 'changed organization'])(
        'ignores a late recognized subscription 409 after %s', async (boundary) => {
          const subscription = createDeferred<{agentId: string}>();
          mockWebSocketManager.initWebSocket.mockReturnValueOnce(subscription.promise);
          const listener = jest.fn();
          webex.cc.on('region:stateChange', listener);
          const requireReload = jest.spyOn(webex.cc, 'requireRegionReload');
          const failure = createConflict({body: {reason: recognizedReason}});
          const pending = webex.cc.register();
          const rejected = expect(pending).rejects;
          let current: Promise<Profile> | undefined;
          if (boundary === 'superseded registration') current = webex.cc.register();
          else webex.credentials.getOrgId.mockReturnValue('otherOrgId');

          subscription.reject(failure);
          if (current) {
            await rejected.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
            await expect(current).resolves.toHaveProperty('agentId', 'agent123');
            expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
          } else await rejected.toBe(failure);
          expect(requireReload).not.toHaveBeenCalled();
          expect(listener.mock.calls).toEqual(current ? [] : [
            [{status: 'unavailable', reason: 'recovery-failed'}],
          ]);
        }
      );

      describe.each(['mercury', 'reload', 'calling line', 'wxApp'])(
        'pending initial registration during %s', (stage) => {
          const restoredSession = {data: {
            agentId: 'agent123', agentSessionId: 'restored-session', teamId: 'team',
            deviceType: LoginOption.BROWSER, dn: 'webrtc-agent123',
          }};
          let work;
          let stageWork;

          beforeEach(() => {
            work = createDeferred<any>();
            webex.cc.$config.allowAutomatedRelogin = true;
            webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile());
            const mercury = jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
            const reload = webex.cc.services.agent.reload.mockResolvedValue(restoredSession);
            const calling = jest.spyOn(webex.cc.webCallingService, 'registerWebCallingLine').mockResolvedValue(undefined);
            const wxApp = jest.spyOn(webex.cc, 'ensureWxAppPostStationLogin').mockResolvedValue(undefined);
            stageWork = {mercury, reload, 'calling line': calling, wxApp}[stage];
            stageWork.mockReturnValueOnce(work.promise);
          });

          it.each(['resolve', 'interrupted', 'aborted'])(
            'preserves reload-required ahead of %s settlement', async (settlement) => {
              const listener = jest.fn();
              webex.cc.on('region:stateChange', listener);
              const pending = webex.cc.register();
              const rejection = expect(pending).rejects.toMatchObject({
                constructor: Error, message: 'REGION_RELOAD_REQUIRED',
                data: {reason: 'REGION_RELOAD_REQUIRED'},
              });
              await flushEventLoopTurn();
              expect(stageWork).toHaveBeenCalledTimes(1);
              expect(listener).not.toHaveBeenCalled();
              const controller = webex.cc['registrationAbortController'];
              const {onTerminalFailure} = webex.cc.services.connectionService.reset.mock.calls[0][0];
              onTerminalFailure(createConflict({body: {reason: recognizedReason}}));
              onTerminalFailure(createConflict({body: {reason: recognizedReason}}));
              if (settlement === 'aborted') controller.abort();
              if (settlement === 'resolve') work.resolve(restoredSession);
              else work.reject(Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));

              await rejection;
              expect(controller.signal.aborted).toBe(true);
              expect(listener.mock.calls).toEqual([
                [{status: 'reloadRequired', reason: 'region-mismatch'}],
              ]);
              expect(webex.cc['lastPublishedRegionState']).toEqual({
                status: 'reloadRequired', reason: 'region-mismatch',
              });
            }
          );

          it('retains the old terminal outcome when the mismatch observer registers a replacement', async () => {
            let replacement;
            const listener = jest.fn(() => {
              webex.cc.$config.allowAutomatedRelogin = false;
              replacement = webex.cc.register();
            });
            webex.cc.once('region:stateChange', listener);
            const pending = webex.cc.register();
            const rejection = expect(pending).rejects.toMatchObject({
              data: {reason: 'REGION_RELOAD_REQUIRED'},
            });
            await flushEventLoopTurn();
            const oldController = webex.cc['registrationAbortController'];
            const {onTerminalFailure} = webex.cc.services.connectionService.reset.mock.calls[0][0];
            onTerminalFailure(createConflict({body: {reason: recognizedReason}}));
            work.resolve(restoredSession);

            await rejection;
            await expect(replacement).resolves.toHaveProperty('agentId', 'agent123');
            expect(listener).toHaveBeenCalledTimes(1);
            expect(oldController.signal.aborted).toBe(true);
            expect(webex.cc['registrationAbortController']).not.toBe(oldController);
            expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
            expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
          });

          it('ignores the obsolete ordinary mismatch callback after replacement', async () => {
            const listener = jest.fn();
            webex.cc.on('region:stateChange', listener);
            const pending = webex.cc.register();
            const rejection = expect(pending).rejects.toMatchObject({
              data: {reason: 'RECOVERY_INTERRUPTED'},
            });
            await flushEventLoopTurn();
            const {onTerminalFailure} = webex.cc.services.connectionService.reset.mock.calls[0][0];
            webex.cc.$config.allowAutomatedRelogin = false;
            const replacement = webex.cc.register();
            onTerminalFailure(createConflict({body: {reason: recognizedReason}}));
            work.resolve(restoredSession);

            await rejection;
            await expect(replacement).resolves.toHaveProperty('agentId', 'agent123');
            expect(listener).not.toHaveBeenCalled();
            expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
          });
        }
      );

      it('does not change an already-completed registration when ordinary recovery requires reload', async () => {
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        const completed = webex.cc.register();
        const profile = await completed;
        const settled = jest.fn();
        completed.then(settled);
        expect(webex.cc['pendingRegistration']).toBeUndefined();
        const {onTerminalFailure} = webex.cc.services.connectionService.reset.mock.calls[0][0];
        onTerminalFailure(createConflict({body: {reason: recognizedReason}}));

        await expect(completed).resolves.toBe(profile);
        expect(settled.mock.calls).toEqual([[profile]]);
        expect(listener.mock.calls).toEqual([
          [{status: 'reloadRequired', reason: 'region-mismatch'}],
        ]);
      });

      it.each([
        {headers: {'x-wxcc-region-reason': 'UNKNOWN'}, body: {reason: recognizedReason}},
        {body: {reason: 'REGION_MISMATCH_ORG_NOT_ELIGIBLE'}},
        {body: {reason: recognizedReason.toLowerCase()}},
        {},
      ])('excludesOther409StatusAndOperation unrecognized subscription conflict %j', async (details) => {
        const failure = createConflict(details);
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        mockWebSocketManager.initWebSocket.mockRejectedValueOnce(failure);

        await expect(webex.cc.register()).rejects.toBe(failure);
        expect(listener).not.toHaveBeenCalled();
        expect(mockWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc.services.config.getAgentConfig).not.toHaveBeenCalled();
      });
    });

    describe('T-001 registration-owned MR hydration', () => {
      const settleHydration = async () => {
        for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
      };
      const createReaderFailure = (status?: number, reason?: string) =>
        Object.defineProperties(new Error('request failed'), {
          name: {value: status === 0 ? 'NetworkOrCORSError' : 'Error'},
          statusCode: {value: status},
          body: {value: {reason, reasonCode: 9999}},
          headers: {value: {TrackingID: 'reader-id'}},
        });
      const prepare = (agentId = 'agent123') => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          agentId, webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION],
        }));
        return webex.cc.services.config.getMultiRegionSettings as jest.Mock;
      };

      afterEach(() => {
        webex.cc['registrationAbortController']?.abort();
        jest.useRealTimers();
      });

      it.each(['agent123', 'replacement-agent'])('welcomeIdentityBoundAtHydrationLaunch %s', async (replacement) => {
        const reader = prepare();
        const launches: Array<{orgId: string; signal: AbortSignal; aborted: boolean;
          registrationAgentId: string; profileAgentId: string}> = [];
        webex.cc.agentConfig = createFreshAgentProfile({agentId: 'stale-agent'});
        reader.mockImplementation((orgId, signal) => {
          launches.push({orgId, signal, aborted: signal?.aborted,
            registrationAgentId: webex.cc['registrationAgentId'],
            profileAgentId: webex.cc.agentConfig.agentId});
          return Promise.resolve({eligibility: 'enabled', homeRegion: 'us1'});
        });
        const profile = await webex.cc.register();
        await settleHydration();
        const firstSignal = webex.cc['registrationAbortController'].signal;
        expect(profile.agentId).toBe('agent123');
        expect(reader.mock.calls).toEqual([['mockOrgId', firstSignal]]);
        expect(reader.mock.calls[0][1]).toBe(firstSignal);
        expect(launches).toEqual([{orgId: 'mockOrgId', signal: firstSignal, aborted: false,
          registrationAgentId: 'agent123', profileAgentId: 'agent123'}]);
        expect(firstSignal.aborted).toBe(false);

        webex.credentials.getOrgId.mockReturnValue('replacement-org');
        prepare(replacement);
        const replacementProfile = await webex.cc.register();
        await settleHydration();
        const replacementSignal = webex.cc['registrationAbortController'].signal;
        expect(replacementSignal).not.toBe(firstSignal);
        expect(firstSignal.aborted).toBe(true);
        expect(replacementSignal.aborted).toBe(false);
        expect(replacementProfile.agentId).toBe(replacement);
        expect(webex.cc.services.config.getAgentConfig.mock.calls).toEqual([
          ['mockOrgId', 'agent123'], ['replacement-org', replacement],
        ]);
        expect(reader.mock.calls).toEqual([
          ['mockOrgId', firstSignal], ['replacement-org', replacementSignal],
        ]);
        expect(reader.mock.calls[1][1]).toBe(replacementSignal);
        expect(launches).toEqual([
          {orgId: 'mockOrgId', signal: firstSignal, aborted: false,
            registrationAgentId: 'agent123', profileAgentId: 'agent123'},
          {orgId: 'replacement-org', signal: replacementSignal, aborted: false,
            registrationAgentId: replacement, profileAgentId: replacement},
        ]);
        expect(webex.cc['registrationAgentId']).toBe(replacement);
      });

      it.each([undefined, null, '', ' '])('primary Welcome requires nonblank identity %#', async (agentId) => {
        prepare();
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId});
        await expect(webex.cc.register()).rejects.toThrow('Primary Welcome agent identity is required');
        expect(webex.cc.services.config.getAgentConfig).not.toHaveBeenCalled();
        expect(webex.cc.services.config.getMultiRegionSettings).not.toHaveBeenCalled();
      });

      it('rejects a mismatched or failed Profile without launching hydration', async () => {
        const reader = prepare();
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({agentId: 'other-agent'}));
        await expect(webex.cc.register()).rejects.toThrow('identities differ');
        expect(reader).not.toHaveBeenCalled();
        webex.cc.services.config.getAgentConfig.mockRejectedValue(new Error('Profile failed'));
        await expect(webex.cc.register()).rejects.toThrow('Profile failed');
        expect(reader).not.toHaveBeenCalled();
      });

      it('eligibilityChangeHookAfterCurrentResult stores before the hook and ignores stale work', async () => {
        const reader = prepare();
        const pending = createDeferred<any>();
        reader.mockReturnValueOnce(pending.promise).mockResolvedValue({eligibility: 'disabled'});
        const seen: unknown[] = [];
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged').mockImplementation(() => {
          seen.push(webex.cc['multiRegionSettings']);
        });
        const profile = await webex.cc.register();
        expect(profile.agentId).toBe('agent123');
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        await webex.cc.register();
        await settleHydration();
        pending.resolve({eligibility: 'enabled', homeRegion: 'us1'});
        await settleHydration();
        expect(hook).toHaveBeenCalledTimes(1);
        expect(seen).toEqual([{eligibility: 'disabled'}]);
      });

      it.each(['enabled', 'disabled'])('a throwing settings hook cannot retry a successful %s read', async eligibility => {
        jest.useFakeTimers();
        const reader = prepare();
        const settings = {eligibility, homeRegion: 'us1'};
        reader.mockResolvedValue(settings);
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged').mockImplementationOnce(() => {
          expect(webex.cc['multiRegionSettings']).toBe(settings);
          throw new Error('settings hook failed');
        });

        await expect(webex.cc.register()).resolves.toHaveProperty('agentId', 'agent123');
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(1);
        expect(hook).toHaveBeenCalledTimes(1);
        expect(webex.cc['multiRegionSettings']).toBe(settings);
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(10000);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(1);
        expect(hook).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      });

      it.each(['resolve', 'reject'])('silentReloginRejectsWhileHydrationPending %s', async (settle) => {
        const reader = prepare();
        const pending = createDeferred<any>();
        reader.mockReturnValue(pending.promise);
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
        webex.cc.services.agent.reload.mockRejectedValue(new Error('restore failed'));
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged');
        await expect(webex.cc.register()).rejects.toThrow();
        const signal = reader.mock.calls[0][1];
        expect(signal.aborted).toBe(true);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        if (settle === 'resolve') pending.resolve({eligibility: 'enabled', homeRegion: 'us1'});
        else pending.reject(new Error('late reader failure'));
        await settleHydration();
        expect(hook).not.toHaveBeenCalled();
        expect(reader).toHaveBeenCalledTimes(1);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
      });

      it.each([
        ...['reject', 'resolve'].flatMap(settlement => ([
          [undefined, undefined, 5], [0, undefined, 5], [408, undefined, 5], [429, undefined, 5],
          [500, undefined, 5], [502, undefined, 5], [503, undefined, 5], [599, undefined, 5],
          [undefined, 'INVALID_MR_SETTINGS', 5], [undefined, 'INVALID_ORG_ID', 5],
          [401, undefined, 1], [403, undefined, 1], [400, undefined, 1], [404, undefined, 1],
          [409, undefined, 1], [302, undefined, 1], [undefined, 'RECOVERY_INTERRUPTED', 5],
          [0, 'RECOVERY_INTERRUPTED', 5], [0, 'INVALID_ORG_ID', 5],
          [401, 'INVALID_MR_SETTINGS', 1], [403, 'INVALID_MR_SETTINGS', 1],
          [503, 'INVALID_ORG_ID', 5], [503, 'RECOVERY_INTERRUPTED', 5],
          [400, 'INVALID_MR_SETTINGS', 1], [404, 'INVALID_MR_SETTINGS', 1],
        ] as const).map(([status, reason, reads]) => ({settlement, status, reason, reads}))),
        {settlement: 'invalid-org', status: undefined, reason: 'INVALID_ORG_ID', reads: 1},
        {settlement: 'invalid-settings', status: undefined, reason: 'INVALID_MR_SETTINGS', reads: 5},
      ])('readerRetryClassification / offline4295xxPacing / fiveBoundedReads / completeProfileUnaffected $settlement status=$status reason=$reason', async ({settlement, status, reason, reads}) => {
        jest.useFakeTimers();
        const reader = prepare();
        const ActualConfigService = jest.requireActual('../../../src/services/config').default;
        const configReader = new ActualConfigService();
        if (settlement === 'invalid-org') webex.credentials.getOrgId.mockReturnValue(' ');
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION],
          aiFeature: {realtimeTranscripts: {enable: true}} as any,
        }));
        const failure = createReaderFailure(status, reason);
        mockWebexRequest.request.mockImplementation(() => {
          if (settlement === 'invalid-settings') return Promise.resolve({statusCode: 200, body: []});
          if (settlement === 'resolve') return Promise.resolve({
            statusCode: status, body: {reason, reasonCode: 9999}, headers: {TrackingID: 'reader-id'},
          });
          return Promise.reject(failure);
        });
        const readTimes: number[] = [];
        const startedAt = Date.now();
        reader.mockImplementation((orgId, signal) => {
          readTimes.push(Date.now() - startedAt);
          return configReader.getMultiRegionSettings(orgId, signal);
        });
        const credentials = webex.credentials;
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        const profile = await webex.cc.register();
        await settleHydration();
        expect(profile.agentId).toBe('agent123');
        expect(reader).toHaveBeenCalledTimes(1);
        for (let attempt = 1; attempt < reads; attempt += 1) {
          jest.advanceTimersByTime(attempt * 1000 - 1);
          await settleHydration();
          expect(reader).toHaveBeenCalledTimes(attempt);
          jest.advanceTimersByTime(1);
          await settleHydration();
          expect(reader).toHaveBeenCalledTimes(attempt + 1);
        }
        jest.advanceTimersByTime(60000);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(reads);
        expect(readTimes).toEqual(reads === 5 ? [0, 1000, 3000, 6000, 10000] : [0]);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(webex.cc.agentConfig).toBe(profile);
        expect(webex.cc.services.config.getAgentConfig).toHaveBeenCalledTimes(1);
        expect(webex.credentials).toBe(credentials);
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
        expect(mockWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc.services.rtdWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc.services.agent.logout).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
        expect(mockWebexRequest.request).toHaveBeenCalledTimes(settlement === 'invalid-org' ? 0 : reads);
        const readerFailure = await reader.mock.results[0].value.catch(error => error);
        if (settlement === 'reject') expect(readerFailure).toBe(failure);
        expect(Utils.normalizeRecoveryFailure(readerFailure)).toEqual({
          ...(status !== undefined ? {status} : {}), ...(reason ? {reason} : {}),
          ...(!settlement.startsWith('invalid-') ? {reasonCode: 9999, trackingId: 'reader-id'} : {}),
        });
      });

      it.each(['enabled', 'disabled'])('recovers from status-zero offline failure on a later serial read: %s', async (eligibility) => {
        jest.useFakeTimers();
        const reader = prepare();
        const pending = createDeferred<any>();
        const readTimes: number[] = [];
        const startedAt = Date.now();
        reader.mockImplementation(() => {
          readTimes.push(Date.now() - startedAt);
          return readTimes.length === 1 ? Promise.reject(createReaderFailure(0)) : pending.promise;
        });
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged');
        const profile = await webex.cc.register();
        await settleHydration();
        jest.advanceTimersByTime(999);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1);
        await settleHydration();
        expect(readTimes).toEqual([0, 1000]);
        jest.advanceTimersByTime(60000);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(2);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        const settings = {eligibility, homeRegion: 'us1'};
        pending.resolve(settings);
        await settleHydration();
        expect(webex.cc['multiRegionSettings']).toEqual(settings);
        expect(hook).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(60000);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(2);
        expect(webex.cc.agentConfig).toBe(profile);
        expect(webex.cc.services.config.getAgentConfig).toHaveBeenCalledTimes(1);
      });

      it.each([1, 2, 3, 4])('cancels status-zero offline hydration during retry wait %s', async (waitingAttempt) => {
        jest.useFakeTimers();
        const reader = prepare();
        reader.mockRejectedValue(createReaderFailure(0));
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged');
        await webex.cc.register();
        await settleHydration();
        for (let attempt = 1; attempt < waitingAttempt; attempt += 1) {
          jest.advanceTimersByTime(attempt * 1000);
          await settleHydration();
        }
        expect(reader).toHaveBeenCalledTimes(waitingAttempt);
        jest.advanceTimersByTime(waitingAttempt * 1000 - 1);
        await settleHydration();
        const signal = webex.cc['registrationAbortController'].signal;
        const removeListener = jest.spyOn(signal, 'removeEventListener');
        webex.cc['registrationAbortController'].abort();
        await settleHydration();
        expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(60000);
        await settleHydration();
        expect(reader).toHaveBeenCalledTimes(waitingAttempt);
        expect(hook).not.toHaveBeenCalled();
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
      });

      it.each([403, 503])('replacementRegisterClearsPriorEnabledSettings before awaiting and through reader failure %s', async (status) => {
        jest.useFakeTimers();
        const reader = prepare();
        const pending = createDeferred<any>();
        const welcome = createDeferred<any>();
        const failure = createReaderFailure(status);
        reader.mockResolvedValueOnce({eligibility: 'enabled', homeRegion: 'produs1'})
          .mockReturnValueOnce(pending.promise).mockRejectedValue(failure);
        mockWebSocketManager.getServingRegion.mockReturnValue('produs1');
        await webex.cc.register(); await settleHydration();
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
        webex.cc['publishRegionState'](webex.cc['buildRegionState']('ready', 'initial-login'));
        expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'initial-login',
          homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false});

        mockWebSocketManager.initWebSocket.mockReturnValueOnce(welcome.promise);
        const replacement = webex.cc.register();
        // No await: even the replacement Welcome and reader have not completed.
        expect(reader).toHaveBeenCalledTimes(1);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
        const expectUnknownSnapshot = () => {
          expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
          expect(webex.cc['buildRegionState']('ready', 'initial-login')).toEqual({status: 'ready', reason: 'initial-login'});
          webex.cc['publishRegionState'](webex.cc['buildRegionState']('ready', 'initial-login'));
          expect(webex.cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'initial-login', servingRegion: 'produs1'});
        };
        expectUnknownSnapshot();
        welcome.resolve({agentId: 'agent123'}); await replacement;
        expect(reader).toHaveBeenCalledTimes(2);
        expectUnknownSnapshot();
        pending.reject(failure); await settleHydration();
        expectUnknownSnapshot();
        const reads = status === 503 ? 5 : 1;
        for (let attempt = 1; attempt < reads; attempt += 1) {
          jest.advanceTimersByTime(attempt * 1000 - 1); await settleHydration();
          expect(reader).toHaveBeenCalledTimes(attempt + 1);
          expectUnknownSnapshot();
          jest.advanceTimersByTime(1); await settleHydration();
          expect(reader).toHaveBeenCalledTimes(attempt + 2);
          expectUnknownSnapshot();
        }
        jest.advanceTimersByTime(60000); await settleHydration();
        expect(reader).toHaveBeenCalledTimes(reads + 1);
        expectUnknownSnapshot();
        expect(jest.getTimerCount()).toBe(0);
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
      });

      it.each([true, false])('oneCyclePerRegister / nextRegisterObservesEntitlementChanges initial=%s', async (enabled) => {
        const reader = prepare();
        reader.mockResolvedValueOnce({eligibility: enabled ? 'enabled' : 'disabled'})
          .mockResolvedValueOnce({eligibility: enabled ? 'disabled' : 'enabled'});
        await webex.cc.register();
        await settleHydration();
        expect(webex.cc['multiRegionSettings'].eligibility).toBe(enabled ? 'enabled' : 'disabled');
        await webex.cc['handleConnectionLost']({isConnectionLost: true});
        expect(reader).toHaveBeenCalledTimes(1);
        await webex.cc.register();
        await settleHydration();
        expect(webex.cc['multiRegionSettings'].eligibility).toBe(enabled ? 'disabled' : 'enabled');
        expect(reader).toHaveBeenCalledTimes(2);
      });

      it('ordinaryReconnectDoesNotReread and actually restores the session', async () => {
        const reader = prepare();
        reader.mockResolvedValue({eligibility: 'enabled'});
        await webex.cc.register();
        await settleHydration();
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
        webex.cc.services.agent.reload.mockResolvedValue({data: {agentId: 'agent123', agentSessionId: 'session', deviceType: LoginOption.EXTENSION, dn: '1234', teamId: 'team'}});
        const restore = jest.spyOn(webex.cc, 'silentRelogin');
        await webex.cc['handleConnectionLost']({isConnectionLost: true});
        await webex.cc['handleConnectionLost']({isSocketReconnected: true});
        expect(restore).toHaveBeenCalledTimes(1);
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(1);
        expect(reader).toHaveBeenCalledTimes(1);
      });

      it('readerDependencyFailureRetainsUnknown and preserves the valid Profile/session', async () => {
        const reader = prepare();
        reader.mockRejectedValue({statusCode: 403});
        const profile = await webex.cc.register();
        await settleHydration();
        expect(webex.cc.agentConfig).toBe(profile);
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(mockWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc.services.rtdWebSocketManager.close).not.toHaveBeenCalled();
      });

      it.each([401, 403])('T-012 readerVsPrimaryVsRtdAuthBoundaries / terminalReaderAuthIsolation reader status=%s', async (status) => {
        const reader = prepare();
        reader.mockRejectedValue({statusCode: status, body: {reason: 'AUTH_FAILED'}, headers: {trackingid: 'auth-reader'}});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({
          webRtcEnabled: false, loginVoiceOptions: [LoginOption.EXTENSION],
          aiFeature: {realtimeTranscripts: {enable: true}} as any,
        }));
        const credentials = webex.credentials;
        const profile = await webex.cc.register();
        await settleHydration();
        expect(profile.agentId).toBe('agent123');
        expect(webex.credentials).toBe(credentials);
        expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledTimes(1);
        expect(mockWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc.services.rtdWebSocketManager.close).not.toHaveBeenCalled();
        expect(webex.cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(reader).toHaveBeenCalledTimes(1);
      });

      it('oldOrgHydrationDiscarded prevents late hydration and clears context on next register', async () => {
        const reader = prepare();
        const pending = createDeferred<any>();
        reader.mockReturnValueOnce(pending.promise).mockResolvedValue({eligibility: 'disabled'});
        const hook = jest.spyOn(webex.cc, 'onMultiRegionSettingsChanged');
        await webex.cc.register();
        webex.credentials.getOrgId.mockReturnValue('replacement-org');
        pending.resolve({eligibility: 'enabled', homeRegion: 'us1'});
        await settleHydration();
        expect(hook).not.toHaveBeenCalled();
        await webex.cc.register();
        await settleHydration();
        expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'disabled'});
      });
    });

    describe('T-011/T-012 initial region snapshots', () => {
      const loginResult = {trackingId: 'login-id', data: {
        agentId: 'agent123', agentSessionId: 'session', teamId: 'team', channelsMap: {},
      }};
      const login = () => webex.cc.stationLogin({loginOption: LoginOption.EXTENSION, teamId: 'team', dialNumber: '1234'});

      beforeEach(() => {
        webex.cc.agentConfig = createFreshAgentProfile();
        webex.cc.services.agent.stationLogin.mockResolvedValue(loginResult);
        webex.cc.services.agent.logout.mockResolvedValue({data: {}});
      });

      it('firstStationLoginReady and logoutThenReloginEmitsReadyAgain', async () => {
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        await login();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0]).toEqual({status: 'ready', reason: 'initial-login'});
        expect(Object.isFrozen(listener.mock.calls[0][0])).toBe(true);
        await webex.cc.stationLogout({logoutReason: 'User'});
        expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
        await login();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener.mock.calls[1][0]).toEqual(listener.mock.calls[0][0]);
      });

      it('registerRestoredSessionReady once, while ordinary reconnect emits nothing new', async () => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({webRtcEnabled: false}));
        const response = {data: {agentId: 'agent123', agentSessionId: 'session', teamId: 'team', deviceType: LoginOption.EXTENSION, dn: '1234'}};
        const secondReload = createDeferred<any>();
        webex.cc.services.agent.reload.mockResolvedValueOnce(response).mockReturnValueOnce(secondReload.promise);
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        await webex.cc.register();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({status: 'ready', reason: 'initial-login'});
        const reconnect = webex.cc['handleConnectionLost']({isSocketReconnected: true});
        const settled = jest.fn(); const observed = reconnect.then(settled);
        expect(webex.cc.services.agent.reload).toHaveBeenCalledTimes(2);
        await flushMicrotasks();
        expect(settled).not.toHaveBeenCalled();
        secondReload.resolve({...response, data: {...response.data, agentSessionId: 'reconnected-session'}});
        await reconnect; await observed;
        expect(settled).toHaveBeenCalledTimes(1);
        expect(webex.cc['currentAgentSessionId']).toBe('reconnected-session');
        expect(listener).toHaveBeenCalledTimes(1);
      });

      it.each([
        [' Us1 ', 'uS1', {homeRegion: ' Us1 ', servingRegion: 'uS1', limitedService: false}],
        ['uS1', ' Us2 ', {homeRegion: 'uS1', servingRegion: ' Us2 ', limitedService: true}],
        [undefined, ' Us2 ', {servingRegion: ' Us2 '}],
        [' Us1 ', undefined, {homeRegion: ' Us1 '}],
      ])('T-011 normalizedHomeServingComparison home=%s serving=%s', (homeRegion, servingRegion, metadata) => {
        webex.cc['multiRegionSettings'] = {eligibility: 'enabled', ...(homeRegion ? {homeRegion} : {})};
        mockWebSocketManager.getServingRegion.mockReturnValue(servingRegion);
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        webex.cc['publishRegionState'](webex.cc['buildRegionState']('ready', 'initial-login'));
        expect(listener.mock.calls).toEqual([[{status: 'ready', reason: 'initial-login', ...metadata}]]);
      });

      it.each([
        ['enabled', ' pRoDuS1 ', {homeRegion: ' ProDUs1 ', servingRegion: ' pRoDuS1 ', limitedService: false}],
        ['enabled', ' PrODuS2 ', {homeRegion: ' ProDUs1 ', servingRegion: ' PrODuS2 ', limitedService: true}],
        ['enabled', undefined, {homeRegion: ' ProDUs1 '}],
        ['disabled', ' pRoDuS1 ', {homeRegion: ' ProDUs1 ', servingRegion: ' pRoDuS1 '}],
        ['disabled', ' PrODuS2 ', {homeRegion: ' ProDUs1 ', servingRegion: ' PrODuS2 '}],
        ['disabled', undefined, {homeRegion: ' ProDUs1 '}],
        ['unknown', ' pRoDuS1 ', {servingRegion: ' pRoDuS1 '}],
        ['unknown', ' PrODuS2 ', {servingRegion: ' PrODuS2 '}],
        ['unknown', undefined, {}],
      ])('T-011 enabledOnlyLimitedService eligibility=%s serving=%s', (eligibility, servingRegion, metadata) => {
        // Retain stale input deliberately: unknown eligibility must hide its home region too.
        webex.cc['multiRegionSettings'] = {eligibility, homeRegion: ' ProDUs1 '};
        mockWebSocketManager.getServingRegion.mockReturnValue(servingRegion);
        const listener = jest.fn(); webex.cc.on('region:stateChange', listener);
        webex.cc['publishRegionState'](webex.cc['buildRegionState']('ready', 'initial-login'));
        expect(listener.mock.calls).toEqual([[{status: 'ready', reason: 'initial-login', ...metadata}]]);
      });

      it.each(['calling line', 'wxApp'])(
        'register-restored BROWSER readiness waits for successful %s setup', async (stage) => {
          webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: true};
          mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
          webex.cc.services.config.getAgentConfig.mockImplementation(() => Promise.resolve(createFreshAgentProfile()));
          webex.cc.services.agent.reload.mockResolvedValue({data: {
            agentId: 'agent123', agentSessionId: 'session', teamId: 'team',
            deviceType: LoginOption.BROWSER, dn: 'webrtc-agent123',
          }});
          jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
          const calling = jest.spyOn(webex.cc.webCallingService, 'registerWebCallingLine').mockResolvedValue(undefined);
          const wxApp = jest.spyOn(webex.cc, 'ensureWxAppPostStationLogin').mockResolvedValue(undefined);
          const setup = stage === 'calling line' ? calling : wxApp;
          const listener = jest.fn();
          webex.cc.on('region:stateChange', listener);

          for (const succeeds of [false, true]) {
            const work = createDeferred<void>();
            setup.mockReturnValueOnce(work.promise);
            const pending = webex.cc.register();
            const settlement = succeeds
              ? expect(pending).resolves.toHaveProperty('agentId', 'agent123')
              : expect(pending).rejects.toThrow('registration setup failed');
            await flushEventLoopTurn();
            expect(setup).toHaveBeenCalledTimes(succeeds ? 2 : 1);
            expect(listener).not.toHaveBeenCalled();
            expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
            if (succeeds) work.resolve();
            else work.reject(Object.assign(new Error('registration setup failed'), {
              details: {data: {reason: 'registration setup failed'}},
            }));

            await settlement;
            expect(listener.mock.calls).toEqual(succeeds ? [[{status: 'ready', reason: 'initial-login'}]] : []);
            expect(webex.cc['lastPublishedRegionState']).toEqual(succeeds
              ? {status: 'ready', reason: 'initial-login'} : undefined);
            expect(webex.cc['registrationAbortController'].signal.aborted).toBe(!succeeds);
          }
        }
      );

      it('socketOnlyNeverReady', async () => {
        webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        webex.cc.services.config.getAgentConfig.mockResolvedValue(createFreshAgentProfile({webRtcEnabled: false}));
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        await webex.cc.register();
        expect(listener).not.toHaveBeenCalled();
      });

      it.each(['recovering', 'ready', 'reloadRequired', 'stationLoginRequired', 'unavailable'])(
        'throwingObserverSkipsLaterListeners %s', (status) => {
          const first = jest.fn(() => { throw new Error('host observer'); });
          const second = jest.fn();
          const all = jest.fn();
          webex.cc.on('region:stateChange', first);
          webex.cc.on('region:stateChange', second);
          webex.cc.on('all', all);
          const state = {status, reason: 'region-switch', retryAfterMs: 1};
          expect(() => webex.cc['publishRegionState'](state)).not.toThrow();
          expect(webex.cc['lastPublishedRegionState']).toEqual(state);
          expect(first).toHaveBeenCalledTimes(1);
          webex.cc['publishRegionState']({...state});
          expect(first).toHaveBeenCalledTimes(1);
          expect(second).not.toHaveBeenCalled();
          expect(all).not.toHaveBeenCalled();
          webex.cc.off('region:stateChange', first);
          webex.cc['publishRegionState']({...state});
          expect(first).toHaveBeenCalledTimes(1);
          expect(second).not.toHaveBeenCalled();
          expect(all).not.toHaveBeenCalled();
          const changed = {...state, retryAfterMs: 2};
          webex.cc['publishRegionState'](changed);
          expect(second.mock.calls).toEqual([[changed]]);
          expect(all.mock.calls).toEqual([['region:stateChange', changed]]);
          expect(Object.isFrozen(second.mock.calls[0][0])).toBe(true);
          expect(all.mock.calls[0][1]).toBe(second.mock.calls[0][0]);
          expect(first).toHaveBeenCalledTimes(1);
        }
      );

      it.each(['stationLogout', 'deregister', 'multiLogin', 'register'])(
        'resets publication before the first await at %s', async (boundary) => {
          webex.cc['publishRegionState']({status: 'ready', reason: 'region-switch', autoAvailable: 'succeeded', trackingId: 'old'});
          webex.cc['regionStateContext'] = {autoAvailable: 'succeeded', trackingId: 'old'};
          let pending: Promise<unknown> | undefined;
          if (boundary === 'stationLogout') pending = webex.cc.stationLogout({logoutReason: 'User'});
          if (boundary === 'deregister') pending = webex.cc.deregister();
          if (boundary === 'multiLogin') webex.cc['handleWebsocketMessage'](JSON.stringify({type: 'AGENT_MULTI_LOGIN'}));
          if (boundary === 'register') {
            jest.spyOn(webex.cc, 'connectWebsocket').mockRejectedValue(new Error('stop registration'));
            pending = webex.cc.register();
          }
          expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
          expect(webex.cc['regionStateContext']).toEqual({});
          await pending?.catch(() => undefined);
        }
      );

      it.each(['orgReplacement', 'orgReplacementAtStation', 'agentIdentityMismatch'].flatMap(boundary =>
        [false, true].map(reentrant => ({boundary, reentrant}))))(
        'resets publication at identity boundary and rechecks replacement ownership %j', async ({boundary, reentrant}) => {
          webex.cc.$config = {...webex.cc.$config, allowAutomatedRelogin: false};
          mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
          webex.cc.services.config.getAgentConfig.mockImplementation(async () => createFreshAgentProfile({webRtcEnabled: false}));
          webex.cc.services.config.getMultiRegionSettings.mockResolvedValue({eligibility: 'enabled', homeRegion: 'produs1'});
          await webex.cc.register();
          mockWebSocketManager.getServingRegion.mockReturnValue('produs1');
          await login();
          const ready = {status: 'ready', reason: 'initial-login', homeRegion: 'produs1',
            servingRegion: 'produs1', limitedService: false};
          expect(webex.cc['lastPublishedRegionState']).toEqual(ready);
          const context = {trackingId: 'old', operation: 'FAILOVER', scope: 'ORG'};
          webex.cc['regionStateContext'] = {...context, autoAvailable: 'succeeded'};
          const oldRegistration = webex.cc['registrationAbortController'];
          const oldGeneration = webex.cc['registrationGeneration'];
          const oldStation = webex.cc['stationRevision'];
          const oldProfile = webex.cc.agentConfig;
          mockWebSocketManager.close.mockImplementation(() => mockWebSocketManager.getServingRegion.mockReturnValue(undefined));
          const publications: any[] = [];
          let replacement: Promise<unknown> | undefined;
          let replacementController: AbortController | undefined;
          const listener = jest.fn(state => {
            publications.push({state, frozen: Object.isFrozen(state), cached: webex.cc['lastPublishedRegionState'] === state,
              context: {...webex.cc['regionStateContext']}, settings: {...webex.cc['multiRegionSettings']},
              oldAborted: oldRegistration.signal.aborted});
            if (reentrant && state.status === 'unavailable') {
              replacement = webex.cc.register();
              replacementController = webex.cc['registrationAbortController'];
              webex.cc['regionStateContext'] = {trackingId: 'replacement'};
            }
          });
          webex.cc.on('region:stateChange', listener);

          let current: boolean | undefined;
          if (boundary === 'agentIdentityMismatch')
            webex.cc['handleWebsocketMessage'](JSON.stringify({type: 'Welcome', data: {agentId: 'replacement-agent'}}));
          else {
            webex.credentials.getOrgId.mockReturnValue('replacement-org');
            current = boundary === 'orgReplacement'
              ? webex.cc['isCurrentRegistration'](oldGeneration, 'mockOrgId', oldRegistration.signal, 'agent123')
              : webex.cc['isCurrentStation'](oldGeneration, oldStation, 'mockOrgId', oldProfile);
          }

          if (boundary !== 'agentIdentityMismatch') expect(current).toBe(false);
          expect(publications).toEqual([{
            state: {status: 'unavailable', reason: 'recovery-failed', ...context, homeRegion: 'produs1'},
            frozen: true, cached: true, context,
            settings: {eligibility: 'unknown'}, oldAborted: true,
          }]);
          expect(webex.cc['lastPublishedRegionState']).toBeUndefined();
          expect(webex.cc['regionStateContext']).toEqual(reentrant ? {trackingId: 'replacement'} : {});
          expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
          if (reentrant) {
            expect(webex.cc['registrationAbortController']).toBe(replacementController);
            expect(replacementController.signal.aborted).toBe(false);
          } else {
            expect(oldRegistration.signal.aborted).toBe(true);
            replacement = webex.cc.register();
          }
          await replacement;
          for (let turn = 0; turn < 24; turn += 1) await Promise.resolve();
          expect(webex.cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
          expect(webex.cc['regionStateContext']).toEqual(reentrant ? {trackingId: 'replacement'} : {});
          mockWebSocketManager.getServingRegion.mockReturnValue('produs1');
          await login();
          expect(listener.mock.calls.map(([state]) => state)).toEqual([
            {status: 'unavailable', reason: 'recovery-failed', ...context, homeRegion: 'produs1'},
            ready,
          ]);
          expect(webex.cc['lastPublishedRegionState']).toEqual(ready);
          expect(webex.cc['regionStateContext']).toEqual({});
          expect(webex.cc['registrationGeneration']).toBeGreaterThan(oldGeneration);
          expect(oldRegistration.signal.aborted).toBe(true);
        }
      );

      it.each(['accepted-team', undefined, null, '', '   '])(
        'T-007 login snapshot uses a usable accepted response team: %s', async (teamId) => {
          webex.cc.services.agent.stationLogin.mockResolvedValue({
            ...loginResult, data: {...loginResult.data, teamId},
          });
          await login();
          const acceptedTeam = teamId === 'accepted-team' ? teamId : 'team';
          expect(webex.cc.agentConfig.currentTeamId).toBe(acceptedTeam);
          expect(webex.cc['acceptedStation'].payload).toEqual({
            dialNumber: '1234', teamId: acceptedTeam, deviceType: LoginOption.EXTENSION,
            isExtension: true, deviceId: '1234', roles: [AGENT], teamName: '', siteId: '',
            usesOtherDN: false, auxCodeId: '',
          });
        }
      );

      it.each(['resolve', 'reject', 'interrupted'])('station backend %s remains observed after an early line failure', async (settle) => {
        const backend = createDeferred<any>();
        const backendSettled = jest.fn();
        void backend.promise.then(backendSettled, backendSettled);
        const lineError = Object.assign(new Error('ancillary WebRTC registration exploded'), {
          details: {trackingId: 'distinctive-line-error', data: {reason: 'DISTINCTIVE_WEBRTC_LINE_FAILURE'}},
        });
        webex.cc.services.agent.stationLogin.mockReturnValue(backend.promise);
        webex.cc.webCallingService.registerWebCallingLine.mockRejectedValue(lineError);
        const listener = jest.fn();
        webex.cc.on('region:stateChange', listener);
        const pending = webex.cc.stationLogin({loginOption: LoginOption.BROWSER, teamId: 'team'});
        await expect(pending).rejects.toThrow(new Error('DISTINCTIVE_WEBRTC_LINE_FAILURE'));
        expect(getErrorDetailsSpy.mock.calls).toEqual([[lineError, METHODS.STATION_LOGIN, CC_FILE]]);
        await expect(pending).rejects.toBe(getErrorDetailsSpy.mock.results[0].value.error);
        expect(webex.cc.services.agent.stationLogin).toHaveBeenCalledTimes(1);
        expect(webex.cc.webCallingService.registerWebCallingLine.mock.calls).toEqual([[]]);
        expect(backendSettled).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
        expect(webex.cc.webCallingService.loginOption).toBeUndefined();
        expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenLastCalledWith(false);
        expect(webex.cc['acceptedStation']).toBeUndefined();
        if (settle === 'resolve') backend.resolve(loginResult);
        else backend.reject(settle === 'interrupted'
          ? Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED') : new Error('backend failed'));
        await flushMicrotasks();
        expect(backendSettled).toHaveBeenCalledTimes(1);
        expect(webex.cc.webCallingService.registerWebCallingLine).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledTimes(settle === 'resolve' ? 1 : 0);
        expect(webex.cc.webCallingService.loginOption).toBe(settle === 'resolve' ? LoginOption.BROWSER : undefined);
        expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenLastCalledWith(settle === 'resolve');
        expect(Boolean(webex.cc['acceptedStation'])).toBe(settle === 'resolve');
      });

      it.each(['resolve', 'reject'])(
        'T-007 old provisional line failure cannot roll back newer acceptance: %s', async (settle) => {
          const backend = createDeferred<any>();
          const line = createDeferred<void>();
          webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
          webex.cc.webCallingService.registerWebCallingLine.mockReturnValueOnce(line.promise);
          const pending = webex.cc.stationLogin({loginOption: LoginOption.BROWSER, teamId: 'old-team'});
          const rejection = expect(pending).rejects.toThrow();
          await login();
          const accepted = webex.cc['acceptedStation'];
          line.reject(new Error('old line failed'));
          await rejection;
          if (settle === 'resolve') backend.resolve({...loginResult, data: {...loginResult.data, teamId: 'old-team'}});
          else backend.reject(new Error('old backend failed'));
          await flushMicrotasks();
          expect(webex.cc['acceptedStation']).toBe(accepted);
          expect(webex.cc.agentConfig.currentTeamId).toBe('team');
          expect(webex.cc.webCallingService.loginOption).toBe(LoginOption.EXTENSION);
          expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenLastCalledWith(false);
        }
      );

      it.each(['rejected', 'interrupted'])(
        'T-007 provisional calling is cleared on backend %s while the line is pending', async (outcome) => {
          const backend = createDeferred<any>();
          const line = createDeferred<void>();
          webex.cc.services.agent.stationLogin.mockReturnValueOnce(backend.promise);
          webex.cc.webCallingService.registerWebCallingLine.mockReturnValueOnce(line.promise);
          const pending = webex.cc.stationLogin({loginOption: LoginOption.BROWSER, teamId: 'team'});
          const rejection = expect(pending).rejects.toThrow();
          expect(webex.cc.webCallingService.loginOption).toBe(LoginOption.BROWSER);
          backend.reject(outcome === 'interrupted'
            ? Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED') : new Error('backend failed'));
          await flushMicrotasks();
          expect(webex.cc['acceptedStation']).toBeUndefined();
          expect(webex.cc.webCallingService.loginOption).toBeUndefined();
          expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenLastCalledWith(false);
          line.resolve(); await rejection;
        }
      );

      it('T-007 acceptance while line is pending survives its later ancillary rejection', async () => {
        const line = createDeferred<void>();
        webex.cc.webCallingService.registerWebCallingLine.mockReturnValueOnce(line.promise);
        const pending = webex.cc.stationLogin({loginOption: LoginOption.BROWSER, teamId: 'team'});
        const rejection = expect(pending).rejects.toThrow();
        await flushMicrotasks();
        const accepted = webex.cc['acceptedStation'];
        expect(accepted.payload.deviceType).toBe(LoginOption.BROWSER);
        line.reject(new Error('line failed after acceptance'));
        await rejection;
        expect(webex.cc['acceptedStation']).toBe(accepted);
        expect(webex.cc.webCallingService.loginOption).toBe(LoginOption.BROWSER);
        expect(webex.cc.webCallingService.setBrowserVoiceRequired).toHaveBeenLastCalledWith(true);
      });
    });

    it('should register successfully and return agent profile', async () => {
      mockAgentProfile.aiFeature = {realtimeTranscripts: {enable: true}} as any;
      const mercuryConnect = jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
      const connectWebsocketSpy = jest.spyOn(webex.cc, 'connectWebsocket');
      const setupEventListenersSpy = jest.spyOn(webex.cc, 'setupEventListeners');
      const reloadSpy = jest.spyOn(webex.cc.services.agent, 'reload').mockResolvedValue({
        data: {
          auxCodeId: 'auxCodeId',
          agentId: 'agent123',
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
      expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
        resource: SUBSCRIBE_API,
        signal: webex.cc['registrationAbortController'].signal,
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
      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
        resource: 'v1/realtime/subscribe',
        signal: webex.cc['rtdEpoch'].controller.signal,
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
          agentId: 'agent123',
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
        signal: webex.cc['registrationAbortController'].signal,
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

    describe('registration failure diagnostics', () => {
      const sensitiveUrl =
        'wss://USERINFO_SECRET@socket.example/subscribe?token=QUERY_SECRET#FRAGMENT_SECRET';
      const requestOptions = {
        url: sensitiveUrl,
        headers: {authorization: 'Bearer BEARER_SECRET'},
        body: {dialNumber: 'DN_SECRET'},
      };
      const createHttpFailure = () =>
        Object.assign(new Error(`POST ${sensitiveUrl} WEBEX_TRACKING_ID=MESSAGE_SECRET`), {
          name: 'WebexHttpError',
          statusCode: 503,
          id: 'HttpError\r\n:503',
          orgId: 'org\r\n-safe',
          trackingId: sensitiveUrl,
          options: requestOptions,
          response: {
            headers: {TrackingId: 'tracking\r\n-safe:123', Authorization: 'Bearer BEARER_SECRET'},
            body: {reasonCode: '1037', reason: `REASON_SECRET ${sensitiveUrl}`},
            options: requestOptions,
          },
        });
      const expectSafeDiagnostics = (failure: unknown) => {
        const inspect = (value: unknown) => {
          if (typeof value === 'string') {
            expect(value).not.toMatch(/SECRET|wss?:\/\/|https?:\/\/|[\r\n]/);
          } else if (value && typeof value === 'object') {
            expect(value).not.toBe(failure);
            expect(value).not.toBeInstanceOf(Error);
            Object.entries(value).forEach(([key, nested]) => {
              expect(key).not.toMatch(
                /^(message|reason|error|stack|url|body|headers|options|request|response|details)$/
              );
              inspect(nested);
            });
          }
        };
        [
          LoggerProxy.log,
          LoggerProxy.info,
          LoggerProxy.warn,
          LoggerProxy.error,
          mockMetricsManager.timeEvent,
          mockMetricsManager.trackEvent,
          mockWebexRequest.uploadLogs,
        ].forEach((sink: jest.Mock) => inspect(sink.mock.calls));
      };

      it.each([
        {
          name: 'URL-bearing Error',
          createFailure: () => new Error(`Failed to open ${sensitiveUrl}`),
          data: {},
          correlationId: undefined,
          orgId: undefined,
        },
        {
          name: 'URL-bearing DOMException',
          createFailure: () => new DOMException(`Invalid socket URL ${sensitiveUrl}`, 'SyntaxError'),
          data: {},
          correlationId: undefined,
          orgId: undefined,
        },
        {
          name: 'WebexHttpError with safe normalized metadata',
          createFailure: createHttpFailure,
          data: {status: 503, reasonCode: 1037, id: 'HttpError:503', trackingId: 'tracking-safe:123'},
          correlationId: 'tracking-safe:123',
          orgId: 'org-safe',
        },
        {
          name: 'legacy top-level upload correlation',
          createFailure: () => ({
            message: sensitiveUrl,
            trackingId: 'legacy\r\n-tracking',
            status: 0,
            details: {data: {reasonCode: 0, reason: 'REGION_RELOAD_REQUIRED'}},
          }),
          data: {status: 0, reasonCode: 0, trackingId: 'legacy-tracking'},
          correlationId: 'legacy-tracking',
          orgId: undefined,
        },
        {
          name: 'URL identifiers and nonfinite numeric fields',
          createFailure: () => ({
            statusCode: Infinity,
            id: sensitiveUrl,
            trackingId: sensitiveUrl,
            orgId: sensitiveUrl,
            details: {trackingId: sensitiveUrl, data: {reasonCode: NaN, reason: 'REASON_SECRET'}},
          }),
          data: {},
          correlationId: undefined,
          orgId: undefined,
        },
        {
          name: 'object-valued diagnostic fields',
          createFailure: () => ({
            statusCode: requestOptions,
            id: requestOptions,
            trackingId: requestOptions,
            orgId: requestOptions,
            details: {trackingId: requestOptions, data: {reasonCode: requestOptions}},
          }),
          data: {},
          correlationId: undefined,
          orgId: undefined,
        },
        {
          name: 'null rejection',
          createFailure: () => null,
          data: {},
          correlationId: undefined,
          orgId: undefined,
        },
      ])(
        'preserves rejection and emits only safe diagnostics: $name',
        async ({createFailure, data, correlationId, orgId}) => {
          const failure = createFailure();
          mockWebSocketManager.initWebSocket.mockRejectedValue(failure);

          await expect(webex.cc.register()).rejects.toBe(failure);

          expect((LoggerProxy.error as jest.Mock).mock.calls).toEqual([
            ['Error during register', {module: CC_FILE, method: 'connectWebsocket', data}],
            ['Error during register', {module: CC_FILE, method: 'register', data}],
          ]);
          expect(mockMetricsManager.trackEvent.mock.calls).toEqual([
            [METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED, {orgId}, ['operational']],
          ]);
          expect(mockWebexRequest.uploadLogs.mock.calls).toEqual([[{correlationId}]]);
          expectSafeDiagnostics(failure);
        }
      );

      it.each(['logger', 'metrics', 'upload-throw', 'upload-reject', 'upload-pending'])(
        'preserves the operation error with a failing or pending diagnostic sink: %s',
        async (sink) => {
          const failure = createHttpFailure();
          const diagnosticError = new Error(`DIAGNOSTIC_SECRET ${sensitiveUrl}`);
          mockWebSocketManager.initWebSocket.mockRejectedValue(failure);
          if (sink === 'logger') {
            (LoggerProxy.error as jest.Mock)
              .mockImplementationOnce(() => {
                throw diagnosticError;
              })
              .mockImplementationOnce(() => {
                throw diagnosticError;
              });
          } else if (sink === 'metrics') {
            mockMetricsManager.trackEvent.mockImplementation(() => {
              throw diagnosticError;
            });
          } else if (sink === 'upload-throw') {
            mockWebexRequest.uploadLogs.mockImplementation(() => {
              throw diagnosticError;
            });
          } else if (sink === 'upload-reject') {
            mockWebexRequest.uploadLogs.mockRejectedValue(diagnosticError);
          } else {
            mockWebexRequest.uploadLogs.mockReturnValue(new Promise(() => {}));
          }

          await expect(webex.cc.register()).rejects.toBe(failure);
          await flushMicrotasks();

          expect(LoggerProxy.error).toHaveBeenCalledTimes(2);
          expect(mockMetricsManager.trackEvent).toHaveBeenCalledTimes(1);
          expect(mockWebexRequest.uploadLogs.mock.calls).toEqual([
            [{correlationId: 'tracking-safe:123'}],
          ]);
          expectSafeDiagnostics(failure);
        }
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
          agentId: 'agent123',
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
        signal: webex.cc['registrationAbortController'].signal,
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
          agentId: 'agent123',
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
        signal: webex.cc['registrationAbortController'].signal,
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
          agentId: 'agent123',
          deviceType: LoginOption.EXTENSION,
          dn: '12345',
        },
      });
      jest.spyOn(webex.cc.services.config, 'getAgentConfig').mockResolvedValue(mockAgentProfile);
      mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});

      await webex.cc.register();

      expect(webex.cc.services.rtdWebSocketManager.initWebSocket).toHaveBeenCalledWith({
        body: {
          force: true,
          isKeepAliveEnabled: false,
          clientType: 'WebexCCSDK',
          allowMultiLogin: false,
        },
        resource: 'v1/realtime/subscribe',
        signal: webex.cc['rtdEpoch'].controller.signal,
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
          agentId: 'agent123',
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
          agentId: 'agent123',
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
          signal: webex.cc['rtdEpoch'].controller.signal,
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

        expect(mockWebSocketManager.initWebSocket).toHaveBeenCalledWith({
          body: {
            force: true,
            isKeepAliveEnabled: false,
            clientType: 'WebexCCSDK',
            allowMultiLogin: false,
          },
          resource: SUBSCRIBE_API,
          signal: webex.cc['registrationAbortController'].signal,
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
    beforeEach(() => bindRtdUnitOwner());
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
      const guard = {generation: 0, signal: new AbortController().signal,
        assertCommandAllowed: () => undefined};
      task.bindRecoveryGuard(guard);
      taskManager.startSession(guard);

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
          message: 'RECOVERY_INTERRUPTED',
          data: {reason: 'RECOVERY_INTERRUPTED'},
        });
        await expect(midCallRequest).rejects.toMatchObject({
          message: 'RECOVERY_INTERRUPTED',
          data: {reason: 'RECOVERY_INTERRUPTED'},
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
      }, undefined, {generation: 0, signal: undefined});

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
      }, undefined, {generation: 0, signal: undefined});
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
      }, undefined, {generation: 0, signal: undefined});
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

      expect(stationLogoutMock).toHaveBeenCalledWith({data: data}, undefined, {generation: 1});
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

      expect(stateChangeSpy).toHaveBeenCalledWith({data: payload}, undefined, {generation: 0, signal: undefined, correlationId: 'mock-tracking-uuid'});
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

      expect(stateChangeSpy).toHaveBeenCalledWith({data: expectedPayload}, undefined, {generation: 0, signal: undefined, correlationId: 'mock-tracking-uuid'});
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

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload}, undefined, {generation: 0, signal: undefined, correlationId: 'mock-tracking-uuid'});
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

      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload}, undefined, {generation: 0, signal: undefined, correlationId: 'mock-tracking-uuid'});
      expect(result).toEqual({data: expectedPayload});
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        `Agent state changed successfully to auxCodeId: ${expectedPayload.auxCodeId}`,
        {
          module: CC_FILE,
          method: 'setAgentState',
        }
      );
      expect(setAgentStatusMock).toHaveBeenCalledWith({data: expectedPayload}, undefined, {generation: 0, signal: undefined, correlationId: 'mock-tracking-uuid'});
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
    beforeEach(() => bindRtdUnitOwner());
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

    it('T-012 multiLoginWellnessSessionMatch clears only a current session', () => {
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

    describe('ordinary browser calling policy', () => {
      const prepareBrowserRelogin = (webRtcEnabled, disableWebRTCRegistration = false) => {
        webex.cc.agentConfig = {
          agentId: 'agent123',
          webRtcEnabled,
          loginVoiceOptions: [LoginOption.BROWSER],
        } as Profile;
        webex.cc.$config = {
          ...webex.cc.$config,
          allowAutomatedRelogin: true,
          allowMultiLogin: true,
          disableWebRTCRegistration,
        };
        mockWebSocketManager.initWebSocket.mockResolvedValue({agentId: 'agent123'});
        jest.spyOn(webex.internal.mercury, 'connect').mockResolvedValue(true);
        webex.cc.services.config.getAgentConfig.mockResolvedValue(webex.cc.agentConfig);
        webex.cc.services.agent.reload.mockResolvedValue({
          data: {
            agentId: 'agent123',
            deviceType: LoginOption.BROWSER,
            dn: 'webrtc-agent123',
          },
        });
      };

      it.each([
        [true, false],
        [true, true],
        [false, false],
        [false, true],
      ])(
        'replaces the line unless disabled with webRtcEnabled=%s, disabled=%s',
        async (webRtcEnabled, disableWebRTCRegistration) => {
          prepareBrowserRelogin(webRtcEnabled, disableWebRTCRegistration);
          const calling = webex.cc.webCallingService;

          await webex.cc['silentRelogin']();

          expect(calling.registerWebCallingLine).toHaveBeenCalledTimes(
            disableWebRTCRegistration ? 0 : 1
          );
          expect(calling.ensureWebCallingLine).not.toHaveBeenCalled();
          expect(calling.setLoginOption).toHaveBeenLastCalledWith(LoginOption.BROWSER);
          expect(calling.setBrowserVoiceRequired).toHaveBeenLastCalledWith(
            webRtcEnabled && !disableWebRTCRegistration
          );
        }
      );

      it.each([
        ['register', true],
        ['register', false],
        ['silentRelogin', true],
        ['silentRelogin', false],
      ])(
        'awaits line registration and propagates its rejection during %s with webRtcEnabled=%s',
        async (method, webRtcEnabled) => {
          prepareBrowserRelogin(webRtcEnabled);
          const line = createDeferred<void>();
          const calling = webex.cc.webCallingService;
          calling.registerWebCallingLine.mockReturnValue(line.promise);
          const settled = jest.fn();
          const registration = webex.cc[method]();
          registration.then(settled, settled);
          await flushEventLoopTurn();

          expect(calling.registerWebCallingLine).toHaveBeenCalledTimes(1);
          expect(calling.ensureWebCallingLine).not.toHaveBeenCalled();
          expect(settled).not.toHaveBeenCalled();

          const rejection = expect(registration).rejects.toThrow('browser registration failed');
          const failure = Object.assign(new Error('browser registration failed'), {
            details: {data: {reason: 'browser registration failed'}},
          });
          line.reject(failure);
          await rejection;
          expect(settled).toHaveBeenCalledTimes(1);
          expect(getErrorDetailsSpy).toHaveBeenCalledWith(failure, 'silentRelogin', CC_FILE);
        }
      );
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
      const setAgentStateSpy = jest.spyOn(webex.cc.services.agent, 'stateChange').mockResolvedValue({
        data: {auxCodeId: '0', lastStateChangeTimestamp: 1234, lastIdleCodeChangeTimestamp: 12345},
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
      expect(setAgentStateSpy.mock.calls[0][0]).toEqual({data: {
        state: 'Available',
        auxCodeId: '0', // even if get auxcodeId from relogin response, it should be 0 for available state
        lastStateChangeReason: 'agent-wss-disconnect',
        agentId: 'agentId',
      }});
      expect(webex.cc.agentConfig.isAgentLoggedIn).toBe(true);
      expect(webex.cc.agentConfig.lastStateAuxCodeId).toBe('auxCodeId');
      expect(webex.cc.agentConfig.lastStateChangeTimestamp).toStrictEqual(1738575135188); // it should be updated with the new timestamp of setAgentState response
      expect(webex.cc.agentConfig.lastIdleCodeChangeTimestamp).toStrictEqual(1738575135189);
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
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
        close: jest.fn(),
        cancelPending: jest.fn(),
        off: jest.fn(),
        on: jest.fn(),
      };
      mockRTDWebSocketManager = {
        isSocketClosed: false,
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
        close: jest.fn(),
        cancelPending: jest.fn(),
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
      getServingRegion: jest.fn(),
      clearServingRegion: jest.fn(),
      hasUsableSocket: jest.fn(() => true),
        close: jest.fn(),
        cancelPending: jest.fn(),
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

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'registrationEnded');
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenNthCalledWith(
        1,
        false,
        'registrationEnded'
      );
      expect(webex.cc.services.rtdWebSocketManager.close).toHaveBeenCalledTimes(1);
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
      expect(mockRTDWebSocketManager.close).toHaveBeenNthCalledWith(
        1,
        false,
        'registrationEnded'
      );
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledTimes(1);
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

      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'registrationEnded');
      expect(mockRTDWebSocketManager.close).toHaveBeenNthCalledWith(
        1,
        false,
        'registrationEnded'
      );
      expect(mockRTDWebSocketManager.close).toHaveBeenCalledTimes(1);
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
      expect(mockWebSocketManager.close).toHaveBeenCalledWith(false, 'registrationEnded');
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

    it('does not apply unowned station notification device data', () => {
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

      expect(setLoginOptionSpy).not.toHaveBeenCalled();
      expect(webex.cc.webCallingService.setBrowserVoiceRequired).not.toHaveBeenCalled();
    });

    it('keeps local calling ownership for an unowned other-device notification', () => {
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

      expect(setBrowserVoiceRequiredSpy).not.toHaveBeenCalled();
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

/** Cross-owner tests deliberately live outside the file's mocked ContactCenter graph. */
describe('realRecoveryWiring', () => {
  const sourceMocks = [
    '../../../src/logger-proxy', '../../../src/services', '../../../src/services/task/TaskManager',
    '../../../src/metrics/MetricsManager', '../../../src/services/core/WebexRequest',
    '../../../src/services/ApiAiAssistant', '../../../src/services/WebCallingService',
    '../../../src/services/task/TaskFactory', '../../../src/services/task/voice/WebRTC',
    '../../../src/services/task/taskDataNormalizer', '../../../src/services/task/state-machine',
    '../../../src/services/task/state-machine/uiControlsComputer', '../../../src/services/task/AutoWrapup',
    '../../../src/services/EntryPoint', '../../../src/services/AddressBook', '../../../src/services/Queue',
    '../../../src/services/config', '../../../src/services/core/websocket/WebSocketManager',
    '../../../src/services/core/websocket/connection-service', 'uuid',
  ];
  const flush = async () => { for (let i = 0; i < 50; i += 1) await Promise.resolve(); };
  class NativeSocket {
    static instances: NativeSocket[] = [];
    readyState = 0;
    onopen?: () => void;
    onclose?: () => void;
    onerror?: () => void;
    onmessage?: (event: {data: string}) => void;
    send = jest.fn();
    close = jest.fn(() => { this.readyState = 3; });
    constructor(public url: string) { NativeSocket.instances.push(this); }
    welcome(agentId = 'agent') {
      this.readyState = 1; this.onopen?.(); this.message({type: 'Welcome', data: {agentId}});
    }
    message(frame: unknown) { this.onmessage?.({data: JSON.stringify(frame)}); }
    lost() { this.readyState = 3; this.onclose?.(); }
  }

  const withGraph = async (scenario: (h: any) => Promise<void>, wireSettings: any = {id: 'org', multiRegionEnabled: true, homeRegion: 'produs1'}, rtdOptions: {enabled?: boolean; aiFeature?: AIFeatureFlags; pending?: Promise<unknown>; browserVoice?: boolean} = {}, registrationOptions: {beforeRegister?: (h: any) => void; autoRegister?: boolean; allowAutomatedRelogin?: boolean} = {}) => {
    const saved = sourceMocks.map(name => [name, jest.requireMock(name)] as const);
    const original = {socket: global.WebSocket, worker: global.Worker,
      create: URL.createObjectURL, revoke: URL.revokeObjectURL, crypto: Object.getOwnPropertyDescriptor(global, 'crypto'),
      location: Object.getOwnPropertyDescriptor(window, 'location')};
    const navigationReload = jest.fn();
    let graph: any;
    let host: any;
    const jitter = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    jest.useFakeTimers();
    NativeSocket.instances = [];
    try {
      // Observe the real browser boundary, including navigation from transitive SDK helpers.
      // The documented host restart example executes separately in its own VM context.
      Object.defineProperty(window, 'location', {configurable: true, enumerable: original.location?.enumerable,
        value: {...window.location, reload: navigationReload}});
      jest.isolateModules(() => {
        sourceMocks.forEach(name => jest.dontMock(name));
        graph = {
          ContactCenter: jest.requireActual('../../../src/cc').default,
          Services: jest.requireActual('../../../src/services').default,
          routingAgent: jest.requireActual('../../../src/services/agent').default,
          AqmReqs: jest.requireActual('../../../src/services/core/aqm-reqs').default,
          TaskManager: jest.requireActual('../../../src/services/task/TaskManager').default,
          Task: jest.requireActual('../../../src/services/task/Task').default,
          WebRTC: jest.requireActual('../../../src/services/task/voice/WebRTC').default,
          WebSocketManager: jest.requireActual('../../../src/services/core/websocket/WebSocketManager').WebSocketManager,
          ConnectionService: jest.requireActual('../../../src/services/core/websocket/connection-service').ConnectionService,
          MetricsManager: jest.requireActual('../../../src/metrics/MetricsManager').default,
          WebexRequest: jest.requireActual('../../../src/services/core/WebexRequest').default,
          LoggerProxy: jest.requireActual('../../../src/logger-proxy').default,
        };
      });
      graph.Services.instance = undefined; graph.TaskManager.taskManager = undefined;
      graph.WebexRequest.instance = undefined; graph.MetricsManager.resetInstance();
      Object.defineProperty(global, 'crypto', {value: require('crypto').webcrypto, configurable: true});
      global.WebSocket = NativeSocket as any;
      global.Worker = jest.fn(() => ({postMessage: jest.fn(), terminate: jest.fn()})) as any;
      URL.createObjectURL = jest.fn(() => 'blob:controlled-worker'); URL.revokeObjectURL = jest.fn();
      host = MockWebex({children: {cc: graph.ContactCenter},
        config: {cc: {...config.cc, allowAutomatedRelogin: registrationOptions.allowAutomatedRelogin ?? false}},
        credentials: {getOrgId: () => 'org'},
        logger: {log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn(), debug: jest.fn()},
        once: jest.fn((_event, callback) => callback()),
      });
      host.internal.newMetrics = {submitBehavioralEvent: jest.fn(), submitOperationalEvent: jest.fn(), submitBusinessEvent: jest.fn()};
      host.internal.services = {isIntegrationEnvironment: () => true,
        waitForCatalog: jest.fn().mockResolvedValue(undefined), get: jest.fn()};
      host.internal.support = {submitLogs: jest.fn().mockResolvedValue({trackingid: 'safe-upload'})};
      const requests: any[] = [];
      const pendingRtdSubscriptions: Array<{promise: Promise<unknown>}> = [];
      const holdNextRtdSubscribe = () => {
        const pending = createDeferred<any>();
        pendingRtdSubscriptions.push(pending);
        return pending;
      };
      host.request = jest.fn(async (request) => {
        requests.push(request);
        const resource = request.resource;
        if (resource === SUBSCRIBE_API) return {statusCode: 200, body: {webSocketUrl: 'wss://routing.produs1.cisco.com/?signature=private'}};
        if (resource === 'v1/realtime/subscribe') return pendingRtdSubscriptions.shift()?.promise || rtdOptions.pending || {statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com/?signature=private'}};
        if (resource.endsWith('/organization-setting')) return {statusCode: 200, body: [await wireSettings]};
        if (resource.endsWith('/v2/user/by-ci-user-id/agent/desktop-login')) return {statusCode: 200, body: {
          user: {ciUserId: 'agent', dbId: 'db', siteId: 'site', firstName: 'Agent', lastName: 'Test'},
          agentProfile: {loginVoiceOptions: rtdOptions.browserVoice ? ['BROWSER', 'EXTENSION', 'AGENT_DN'] : ['EXTENSION'], dialPlanEnabled: false},
        }};
        if (resource.endsWith('/desktop-login')) return {statusCode: 200, body: {
          organization: {}, organizationSetting: {webRtcEnabled: !!rtdOptions.browserVoice}, tenantConfiguration: {},
          ...(rtdOptions.enabled ? {aiFeature: {realtimeTranscripts: {enable: true}, suggestedResponses: {enable: true}, generatedSummaries: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true}}} : {}),
          ...(rtdOptions.aiFeature ? {aiFeature: rtdOptions.aiFeature} : {}),
        }};
        if (resource.includes('/auxiliary-code') || resource.includes('/v2/team?')) return {statusCode: 200, body: {data: [], meta: {totalPages: 1}}};
        if (resource.endsWith('/site/site')) return {statusCode: 200, body: {}};
        return {statusCode: 200, body: {}};
      });
      const cc = host.cc;
      expect(cc.services).toBeInstanceOf(graph.Services);
      expect(cc.services.aqmReqs).toBeInstanceOf(graph.AqmReqs);
      expect(cc.taskManager).toBeInstanceOf(graph.TaskManager);
      expect(cc.services.webSocketManager).toBeInstanceOf(graph.WebSocketManager);
      expect(cc.services.connectionService.constructor.name).toBe('ConnectionService');
      for (const name of ['ContactCenter', 'Services', 'AqmReqs', 'TaskManager', 'WebSocketManager'])
        expect(jest.isMockFunction(graph[name])).toBe(false);
      expect(jest.isMockFunction(cc.handleRegionSwitch)).toBe(false);
      expect(jest.isMockFunction(cc.services.agent.reload)).toBe(false);
      const frame = (type: string, id: string, extra = {}) => ({type, orgId: 'org', trackingId: 'outer', data: {
        type, trackingId: id?.replace(/^webex-js-sdk_/, ''), orgId: 'org', agentId: 'agent', agentSessionId: 'session',
        teamId: 'team', deviceType: 'EXTENSION', dn: '1234', isExtension: true, channelsMap: {},
        auxCodeId: 'idle', status: 'LoggedIn', subStatus: 'Idle', lastStateChangeReason: 'initial',
        lastStateChangeTimestamp: 1, lastIdleCodeChangeTimestamp: 1, ...extra,
      }});
      const login = async (loginOption = LoginOption.EXTENSION, agentSessionId = 'session') => {
        const promise = cc.stationLogin({teamId: 'team', loginOption, dialNumber: '1234'});
        const observed = promise.catch(() => undefined); await flush();
        const request = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
        const id = request.headers.trackingid;
        NativeSocket.instances.filter(socket => socket.url.includes('routing.')).slice(-1)[0].message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, id, {
          agentSessionId, deviceType: loginOption, isExtension: loginOption === LoginOption.EXTENSION,
          dn: loginOption === LoginOption.BROWSER ? 'webrtc-agent' : '1234',
        }), type: CC_EVENTS.AGENT_STATION_LOGIN});
        await promise; await observed; await flush();
      };
      const harness = {cc, graph, host, requests, frame, login, flush, holdNextRtdSubscribe,
        navigationReload, sockets: NativeSocket.instances};
      registrationOptions.beforeRegister?.(harness);
      if (registrationOptions.autoRegister !== false) {
        const registered = cc.register(); const observed = registered.catch(() => undefined);
        await flush(); NativeSocket.instances[0].welcome(); await flush();
        if (registrationOptions.allowAutomatedRelogin) {
          const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
          NativeSocket.instances[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
        }
        await registered; await observed; await flush();
      }
      await scenario(harness);
    } finally {
      try {
        if (host?.cc) {
          host.cc['terminateRegistration']();
          host.cc.services.webSocketManager.close(false);
          host.cc.services.rtdWebSocketManager.close(false);
          host.cc.taskManager.stopSession();
        }
        if (graph) {
          graph.Services.instance = undefined; graph.TaskManager.taskManager = undefined;
          graph.WebexRequest.instance = undefined; graph.MetricsManager.resetInstance();
          graph.LoggerProxy.logger = undefined;
        }
      } finally {
        saved.forEach(([name, value]) => jest.doMock(name, () => value));
        global.WebSocket = original.socket; global.Worker = original.worker;
        URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke;
        if (original.crypto) Object.defineProperty(global, 'crypto', original.crypto);
        else Reflect.deleteProperty(global, 'crypto');
        if (original.location) Object.defineProperty(window, 'location', original.location);
        else Reflect.deleteProperty(window, 'location');
        jitter.mockRestore();
        jest.clearAllTimers(); jest.useRealTimers();
      }
    }
  };

  it.each(['multi-login', 'state-change'])('T-012 affectedPublicForwardingContainsThrow top-level %s', async boundary => {
    await withGraph(async ({cc, login, frame, flush}) => {
      await login();
      const registration = cc['registrationAbortController'];
      const event = boundary === 'multi-login' ? AGENT_EVENTS.AGENT_MULTI_LOGIN : AGENT_EVENTS.AGENT_STATE_CHANGE;
      const data = boundary === 'multi-login'
        ? {type: 'AgentMultiLoginCloseSession', agentSessionId: 'session'}
        : frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, 'remote-state', {
          auxCodeId: 'break', lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3,
        }).data;
      const applied: any[] = [];
      const first = jest.fn(() => {
        applied.push(boundary === 'multi-login' ? {
          aborted: registration.signal.aborted, phase: cc['recoveryPhase'],
          mode: cc.services.connectionService['mode'], station: cc['acceptedStation'],
          session: cc['currentAgentSessionId'], primary: cc.services.webSocketManager.hasUsableSocket(),
          rtd: cc['rtdEpoch'],
        } : {
          auxCodeId: cc.agentConfig.lastStateAuxCodeId,
          stateTimestamp: cc.agentConfig.lastStateChangeTimestamp,
          idleTimestamp: cc.agentConfig.lastIdleCodeChangeTimestamp,
        });
        throw new Error('host');
      });
      const later = jest.fn(); const all = jest.fn(); const specialized = jest.fn();
      cc.on(event, first); cc.on(event, later); cc.on('all', all);
      cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, specialized);
      // Call the owning handler so transport fan-out cannot mask a missing host boundary.
      expect(() => cc['handleWebsocketMessage'](JSON.stringify({type: boundary === 'multi-login'
        ? CC_EVENTS.AGENT_MULTI_LOGIN : CC_EVENTS.AGENT_STATE_CHANGE, data}))).not.toThrow();
      await flush();
      expect(first.mock.calls).toEqual([[data]]);
      expect(later).not.toHaveBeenCalled();
      expect(all.mock.calls.filter(([name]) => name === event)).toEqual([]);
      expect(applied).toEqual([boundary === 'multi-login' ? {
        aborted: true, phase: 'unavailable', mode: 'stopped', station: undefined,
        session: undefined, primary: false, rtd: undefined,
      } : {auxCodeId: 'break', stateTimestamp: 2, idleTimestamp: 3}]);
      expect(specialized.mock.calls).toEqual(boundary === 'multi-login' ? [] : [[data]]);
      if (boundary === 'state-change') {
        expect(all.mock.calls.filter(([name]) => name === AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS))
          .toEqual([[AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, data]]);
      }
    }, undefined, {enabled: true});
  });

  it.each(['primary', 'RTD'])('T-012 affectedPublicForwardingContainsThrow wellness via %s', async boundary => {
    await withGraph(async ({cc, sockets, login, flush}) => {
      await login(); cc.agentConfig.isWellnessBreakEnabled = true;
      const socket = sockets.find(socket => socket.url.includes(boundary === 'primary' ? 'routing.' : 'rtd.'));
      if (boundary === 'RTD') {socket.welcome(); await flush();}
      const handle = boundary === 'primary' ? cc['handleWebsocketMessage'] : cc['handleRTDWebsocketMessage'];
      const first = jest.fn(() => {throw new Error('host');}); const later = jest.fn(); const all = jest.fn();
      cc.on(CC_EVENTS.WELLNESS_BREAK, first); cc.on(CC_EVENTS.WELLNESS_BREAK, later); cc.on('all', all);
      const notification = actionEvent => ({type: 'Wellness_Break_Handler', orgId: 'org', trackingId: 'wellness', data: {
        agentId: 'agent', orgId: 'org', notifType: 'Wellness_Break_Handler',
        notifDetails: {actionEvent, actionText: 'Take a break'},
        data: {orgId: 'org', agentSessionId: 'session', interactionId: 'interaction'},
      }});
      const expected = {agentId: 'agent', orgId: 'org', agentSessionId: 'session',
        actionEvent: 'SUGGEST_WELLNESS_BREAK', actionText: 'Take a break', interactionId: 'interaction', trackingId: 'wellness'};
      const tasks = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      expect(() => handle(JSON.stringify(notification('SUGGEST_WELLNESS_BREAK')))).not.toThrow();
      expect(first.mock.calls).toEqual([[expected]]);
      expect(later).not.toHaveBeenCalled();
      expect(all.mock.calls.filter(([name]) => name === CC_EVENTS.WELLNESS_BREAK)).toEqual([]);
      expect(tasks).not.toHaveBeenCalled();
      expect(cc['currentAgentSessionId']).toBe('session');
      cc.off(CC_EVENTS.WELLNESS_BREAK, first);
      const next = {...expected, actionEvent: 'PROVIDE_WELLNESS_BREAK'};
      expect(() => handle(JSON.stringify(notification(next.actionEvent)))).not.toThrow();
      expect(later.mock.calls).toEqual([[next]]);
      expect(all.mock.calls.filter(([name]) => name === CC_EVENTS.WELLNESS_BREAK)).toEqual([[CC_EVENTS.WELLNESS_BREAK, next]]);
      expect(tasks).not.toHaveBeenCalled();
      tasks.mockRestore();
    }, undefined, {enabled: true});
  });

  it('T-012 affectedPublicForwardingContainsThrow voice applies state before host publication', async () => {
    await withGraph(async ({cc}) => {
      const applied: any[] = [];
      const first = jest.fn(() => {applied.push(cc.getVoiceConnectionState()); throw new Error('host');});
      const later = jest.fn(); const all = jest.fn(); const serviceObserver = jest.fn();
      cc.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, first); cc.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, later); cc.on('all', all);
      cc.webCallingService.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, serviceObserver);
      const unavailable = {status: 'unavailable', lineStatus: 'unknown', mobiusSocketStatus: 'unknown'};
      expect(() => cc.webCallingService.setBrowserVoiceRequired(true)).not.toThrow();
      expect(applied).toEqual([unavailable]);
      expect(first.mock.calls).toEqual([[unavailable]]);
      expect(later).not.toHaveBeenCalled();
      expect(all.mock.calls.filter(([name]) => name === VOICE_CONNECTION_EVENTS.STATE_CHANGE)).toEqual([]);
      expect(serviceObserver.mock.calls).toEqual([[unavailable]]);
      cc.off(VOICE_CONNECTION_EVENTS.STATE_CHANGE, first);
      const next = {...unavailable, status: 'not-required'};
      expect(() => cc.webCallingService.setBrowserVoiceRequired(false)).not.toThrow();
      expect(cc.getVoiceConnectionState()).toEqual(next);
      expect(later.mock.calls).toEqual([[next]]);
      expect(all.mock.calls.filter(([name]) => name === VOICE_CONNECTION_EVENTS.STATE_CHANGE))
        .toEqual([[VOICE_CONNECTION_EVENTS.STATE_CHANGE, next]]);
    });
  });

  describe('ordinary recovery during registration', () => {
    const deferProfile = async ({cc, sockets, flush}) => {
      const profileGate = createDeferred<void>();
      const getAgentConfig = cc.services.config.getAgentConfig.bind(cc.services.config);
      jest.spyOn(cc.services.config, 'getAgentConfig').mockImplementation(async (...args) => {
        const profile = await getAgentConfig(...args);
        await profileGate.promise;
        return profile;
      });
      const registered = cc.register();
      const settled = jest.fn();
      registered.then(settled, settled);
      await flush(); sockets[0].welcome(); await flush();
      expect(cc.services.connectionService['mode']).toBe('stopped');
      expect(settled).not.toHaveBeenCalled();
      return {profileGate, registered, settled};
    };

    it.each([false, true])('ordinaryLossDuringRegisterProfileFetchReconnects automated=%s', async automated => {
      await withGraph(async h => {
        const {cc, requests, sockets, frame, flush} = h;
        const states = jest.fn(); cc.on('region:stateChange', states);
        const device = jest.spyOn(cc, 'handleDeviceType');
        const wxApp = jest.spyOn(cc, 'ensureWxAppPostStationLogin');
        const {profileGate, registered, settled} = await deferProfile(h);
        sockets[0].lost();
        jest.advanceTimersByTime(1000); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
        profileGate.resolve(); await flush();
        expect(cc.services.connectionService['mode']).toBe('ordinary');
        expect(cc.services.connectionService['restoreTimer']).toBeDefined();
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
        expect(settled).toHaveBeenCalledTimes(automated ? 0 : 1);
        jest.advanceTimersByTime(4999); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
        jest.advanceTimersByTime(1); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
        sockets[1].welcome(); await flush();
        if (automated) {
          const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
          expect(reloads).toHaveLength(1);
          expect(settled).not.toHaveBeenCalled();
          sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads[0].headers.trackingid,
            {lastStateChangeReason: 'agent-wss-disconnect'}));
          await flush();
          const changes = requests.filter(r => r.resource === '/v1/agents/session/state');
          expect(changes).toHaveLength(1);
          sockets[1].message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, changes[0].headers.trackingid),
            type: CC_EVENTS.AGENT_STATE_CHANGE});
          await registered; await flush();
          expect(device.mock.calls).toEqual([[LoginOption.EXTENSION, '1234']]);
          expect(wxApp).toHaveBeenCalledTimes(1);
          expect(wxApp.mock.calls[0][0]).toBe(cc['commandController'].signal);
          expect(states.mock.calls).toEqual([[{status: 'ready', reason: 'initial-login',
            homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false}]]);
          expect(cc['currentAgentSessionId']).toBe('session');
        } else {
          await registered;
          expect(device).not.toHaveBeenCalled();
          expect(wxApp).not.toHaveBeenCalled();
          expect(states).not.toHaveBeenCalled();
        }
        jest.advanceTimersByTime(5000); sockets[1].message({keepalive: 'true'}); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(automated ? 1 : 0);
        expect(settled).toHaveBeenCalledTimes(1);
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(cc.services.connectionService.listenerCount('connectionLost')).toBe(1);
      }, undefined, {}, {autoRegister: false, allowAutomatedRelogin: automated});
    });

    it.each([false, true])('usablePrimaryDuringRegisterProfileFetchDoesNotResubscribe automated=%s', async automated => {
      await withGraph(async h => {
        const {cc, requests, sockets, frame, flush} = h;
        const {profileGate, registered} = await deferProfile(h);
        profileGate.resolve(); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
        if (automated) {
          const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
          expect(reloads).toHaveLength(1);
          sockets[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads[0].headers.trackingid));
        }
        await registered; await flush();
        jest.advanceTimersByTime(5000); sockets[0].message({keepalive: 'true'}); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(automated ? 1 : 0);
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      }, undefined, {}, {autoRegister: false, allowAutomatedRelogin: automated});
    });

    it('registrationOwnsReloginWhenPrimaryRecoversBeforeMercuryConnectCompletes', async () => {
      await withGraph(async h => {
        const {cc, host, requests, sockets, frame, flush} = h;
        const mercury = createDeferred<void>();
        host.internal.mercury = {connect: jest.fn(() => mercury.promise)};
        const {profileGate, registered, settled} = await deferProfile(h);
        sockets[0].lost(); profileGate.resolve(); await flush();
        expect(host.internal.mercury.connect).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000); await flush(); sockets[1].welcome(); await flush();
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
        expect(settled).not.toHaveBeenCalled();
        mercury.resolve(); await flush();
        const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
        expect(reloads).toHaveLength(1);
        sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads[0].headers.trackingid));
        await registered; await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(1);
        expect(cc.services.connectionService.listenerCount('connectionLost')).toBe(1);
        expect(cc['currentAgentSessionId']).toBe('session');
      }, undefined, {browserVoice: true}, {autoRegister: false, allowAutomatedRelogin: true});
    });

    it.each([
      [401, undefined, {kind: 'authentication-failed', status: 401}],
      [403, undefined, {kind: 'authentication-failed', status: 403}],
      [409, 'REGION_MISMATCH_REGION_FAILOVER', {reason: 'REGION_RELOAD_REQUIRED'}],
    ])('registrationConnectionWaitSettlesOnTerminalAdmission %s', async (status, reason, expected) => {
      await withGraph(async h => {
        const {cc, host, requests, sockets, flush} = h;
        const {profileGate, registered} = await deferProfile(h);
        sockets[0].lost(); profileGate.resolve(); await flush();
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource !== SUBSCRIBE_API) return boundary(request);
          requests.push(request);
          return Promise.reject({statusCode: status, body: {reason}});
        });
        const rejected = expect(registered).rejects.toMatchObject({data: expected});
        jest.advanceTimersByTime(5000); await flush(); await rejected;
        expect(cc.services.connectionService['mode']).toBe('stopped');
        expect(cc.services.connectionService.listenerCount('connectionLost')).toBe(1);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
      }, undefined, {}, {autoRegister: false, allowAutomatedRelogin: true});
    });

    it.each(['register', 'deregister'])('registrationConnectionWaitCannotOutlive %s', async boundary => {
      await withGraph(async h => {
        const {cc, requests, sockets, flush} = h;
        const {profileGate, registered} = await deferProfile(h);
        sockets[0].lost(); profileGate.resolve(); await flush();
        const interrupted = expect(registered).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        cc.$config.allowAutomatedRelogin = false;
        const replacement = cc[boundary](); await flush();
        if (boundary === 'register') sockets[1].welcome();
        await replacement; await interrupted; await flush();
        jest.advanceTimersByTime(5000); await flush();
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(boundary === 'register' ? 2 : 1);
        expect(cc.services.connectionService.listenerCount('connectionLost')).toBe(boundary === 'register' ? 1 : 0);
        expect(cc['acceptedStation']).toBeUndefined();
      }, undefined, {}, {autoRegister: false, allowAutomatedRelogin: true});
    });

    it.each([401, 403])('obsoleteReconnectReloginCannotTerminateReplacementRegistration %s', async status => {
      await withGraph(async ({cc, requests, sockets, flush}) => {
        const oldReload = createDeferred<void>();
        jest.spyOn(cc, 'silentRelogin').mockReturnValueOnce(oldReload.promise);
        cc.$config.allowAutomatedRelogin = true;
        const reconnect = cc['handleConnectionLost']({isSocketReconnected: true});
        cc.$config.allowAutomatedRelogin = false;
        const replacement = cc.register(); await flush(); sockets[1].welcome();
        await replacement; await flush();
        const controller = cc['registrationAbortController'];
        oldReload.reject({statusCode: status}); await reconnect; await flush();
        expect(cc['registrationAbortController']).toBe(controller);
        expect(controller.signal.aborted).toBe(false);
        expect(cc['recoveryPhase']).toBe('idle');
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
      });
    });

    it('registrationConnectionWaitRetainsOrdinaryWatchdog', async () => {
      await withGraph(async h => {
        const {cc, host, requests, sockets, flush} = h;
        const {profileGate, registered} = await deferProfile(h);
        sockets[0].lost(); profileGate.resolve(); await flush();
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource !== SUBSCRIBE_API) return boundary(request);
          requests.push(request);
          return Promise.reject({statusCode: 503});
        });
        const failed = expect(registered).rejects.toThrow();
        for (let slot = 1; slot < 10; slot += 1) {
          jest.advanceTimersByTime(5000); await flush();
          expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(slot + 1);
        }
        jest.advanceTimersByTime(4999); await flush();
        expect(cc.services.connectionService['mode']).toBe('ordinary');
        jest.advanceTimersByTime(1); await flush(); await failed;
        expect(cc.services.connectionService['mode']).toBe('stopped');
        expect(cc.services.connectionService.listenerCount('connectionLost')).toBe(1);
        const count = requests.length;
        jest.advanceTimersByTime(120000); await flush();
        expect(requests).toHaveLength(count);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toEqual([]);
      }, undefined, {}, {autoRegister: false, allowAutomatedRelogin: true});
    });
  });

  describe('MR-06 browser calling integration', () => {
    // Keep the ContactCenter, AQM, TaskManager and calling owner real; control only
    // the external Calling SDK's line events and client creation boundary.
    const withBrowserGraph = async (scenario: (h: any) => Promise<void>, wireSettings?: any,
      rtdOptions: {enabled?: boolean} = {}) => {
      const api = jest.requireActual('@webex/calling');
      const {LINE_EVENTS} = api;
      const line = Object.assign(new EventEmitter(), {
        mobiusDeviceId: 'retained-browser-device',
        register: jest.fn(), deregister: jest.fn().mockResolvedValue(undefined),
      });
      const client = Object.assign(new EventEmitter(), {
        getLines: jest.fn(() => ({browser: line})),
        getActiveCalls: jest.fn(() => ({})), isMobiusSocketConnected: jest.fn(() => true),
      });
      line.register.mockImplementation(() => line.emit(LINE_EVENTS.REGISTERED, line));
      const createClient = jest.fn().mockResolvedValue(client);
      const spies: jest.SpyInstance[] = [];
      const spy = (owner, method) => {
        const observation = jest.spyOn(owner, method);
        spies.push(observation);
        return observation;
      };
      jest.doMock('@webex/calling', () => ({...api, createClient}));
      try {
        await withGraph(async h => {
          const calling = h.cc.webCallingService;
          expect(jest.isMockFunction(calling.ensureWebCallingLine)).toBe(false);
          expect(jest.isMockFunction(calling.registerWebCallingLine)).toBe(false);
          expect(h.cc.agentConfig.webRtcEnabled).toBe(true);
          expect(h.cc.agentConfig.loginVoiceOptions).toContain(LoginOption.BROWSER);
          const browserFields = {deviceType: LoginOption.BROWSER, dn: 'webrtc-agent', isExtension: false};
          const reply = async (resource, type, extra = {}) => {
            const request = h.requests.filter(r => r.resource === resource).slice(-1)[0];
            expect(request).toBeDefined();
            const frame = h.frame(type, request.headers.trackingid, {...browserFields, ...extra});
            h.sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].message(
              resource === '/v1/agents/login' ? {...frame, type: CC_EVENTS.AGENT_STATION_LOGIN} : frame
            );
            await h.flush();
          };
          const recover = async () => {
            h.sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'browser-switch'});
            jest.advanceTimersByTime(105000); await h.flush();
            h.sockets[1].welcome(); await h.flush();
          };
          const observePreservation = () => {
            const listeners = line.eventNames().map(event => [event, line.listeners(event)]);
            const clientListeners = client.eventNames().map(event => [event, client.listeners(event)]);
            const cleanup = spy(calling, 'cleanupWebCallingRegistration');
            const replace = spy(calling, 'registerWebCallingLine');
            const deregister = spy(calling, 'deregisterWebCallingLine');
            const ensure = spy(calling, 'ensureWebCallingLine');
            const lineOff = spy(line, 'off'); const clientOff = spy(client, 'off');
            createClient.mockClear(); line.register.mockClear(); line.deregister.mockClear();
            const assertRetained = () => {
              expect(calling['line']).toBe(line);
              expect(calling['callingClient']).toBe(client);
              expect(line.eventNames().map(event => [event, line.listeners(event)])).toEqual(listeners);
              expect(client.eventNames().map(event => [event, client.listeners(event)])).toEqual(clientListeners);
              for (const operation of [createClient, line.register, line.deregister, lineOff,
                clientOff, cleanup, replace, deregister]) expect(operation).not.toHaveBeenCalled();
            };
            return {ensure, assertRetained};
          };
          await scenario({...h, calling, line, client, createClient, api, spy,
            reply, recover, observePreservation});
        }, wireSettings, {...rtdOptions, browserVoice: true});
      } finally {
        spies.reverse().forEach(observation => observation.mockRestore());
        jest.dontMock('@webex/calling');
      }
    };

    const startBrowserAndRtd = async ({cc, calling, line, api, login, sockets, flush}) => {
      await login(LoginOption.BROWSER);
      const primary = sockets.find(socket => socket.url.includes('routing.'));
      const rtd = sockets.find(socket => socket.url.includes('rtd.'));
      rtd.welcome(); await flush();
      expect(line.register).toHaveBeenCalledTimes(1);
      expect(line.listeners(api.LINE_EVENTS.REGISTERED).length).toBeGreaterThan(0);
      expect(calling['line']).toBe(line);
      expect(calling.getVoiceConnectionState().lineStatus).toBe(VoiceLineStatus.REGISTERED);
      expect(calling.isVoiceReady()).toBe(true);
      expect(cc['acceptedStation'].payload.deviceType).toBe(LoginOption.BROWSER);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(cc.services.rtdWebSocketManager.hasUsableSocket()).toBe(true);
      expect(cc['rtdEpoch'].active).toBe(true);
      return {primary, rtd};
    };

    it('T-013 oldPublicSignaturesVoiceControls snapshots and complete Task controls survive replacement recovery', async () => {
      await withBrowserGraph(async h => {
        const {cc, sockets, requests, login, frame, flush, line, client, api} = h;
        const voice = jest.fn(); cc.on(VOICE_CONNECTION_EVENTS.STATE_CHANGE, voice);
        const initial = {status: 'not-required', lineStatus: 'unknown', mobiusSocketStatus: 'unknown'};
        expect(cc.getVoiceConnectionState()).toEqual(initial);
        const detached = cc.getVoiceConnectionState(); detached.reason = 'consumer-owned-copy';
        expect(cc.getVoiceConnectionState()).toEqual(initial);
        await login(LoginOption.BROWSER);
        const ready = {status: 'ready', lineStatus: 'registered', mobiusSocketStatus: 'connected'};
        expect(cc.getVoiceConnectionState()).toEqual(ready);
        expect(voice.mock.calls.map(([state]) => state)).toEqual([
          {status: 'unavailable', lineStatus: 'unknown', mobiusSocketStatus: 'unknown'},
          {status: 'unavailable', lineStatus: 'connecting', mobiusSocketStatus: 'unknown'},
          {status: 'unavailable', lineStatus: 'connecting', mobiusSocketStatus: 'connected'},
          ready,
        ]);
        const disabled = {isVisible: false, isEnabled: false};
        // Specify every legacy control independently of the control computer.
        const disabledLeg = {
          accept: disabled, decline: disabled, hold: disabled, transfer: disabled, consult: disabled,
          end: disabled, recording: disabled, mute: disabled, consultTransfer: disabled,
          endConsult: disabled, conference: disabled, exitConference: disabled,
          transferConference: disabled, mergeToConference: disabled, wrapup: disabled,
          switch: disabled, keypad: disabled,
        };
        const connectedControls = {
          main: {...disabledLeg,
            hold: {isVisible: true, isEnabled: true}, end: {isVisible: true, isEnabled: true},
            consult: {isVisible: true, isEnabled: false}, transfer: {isVisible: true, isEnabled: true},
            mute: {isVisible: true, isEnabled: true}},
          consult: disabledLeg, activeLeg: 'main',
          consultTransferDestinations: {consult: ['agent', 'dialNumber', 'entryPoint'], transfer: ['agent', 'dialNumber', 'entryPoint']},
        };
        const {task} = offerRetainedTask(h, 'compatibility-task');
        expect(task.uiControls).toEqual(connectedControls);
        const controlsChanged = jest.fn(); task.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, controlsChanged);
        const pending = cc.setAgentState({state: 'Idle', auxCodeId: 'break'});
        const interrupted = expect(pending).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await flush();
        const oldStateId = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0].headers.trackingid;
        cc.$config.allowAutomatedRelogin = true;
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'compatibility-first'});
        await interrupted; await flush();
        const fencedControls = {...connectedControls, main: {
          ...connectedControls.main,
          hold: {isVisible: true, isEnabled: false}, end: {isVisible: true, isEnabled: false},
          consult: {isVisible: true, isEnabled: false}, transfer: {isVisible: true, isEnabled: false},
          mute: {isVisible: true, isEnabled: false},
        }};
        expect(task.uiControls).toEqual(connectedControls);
        expect(cc.getVoiceConnectionState()).toEqual(ready);
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        expect(task.uiControls).toEqual(fencedControls);
        expect(controlsChanged.mock.calls.slice(-1)).toEqual([[fencedControls]]);
        const oldReload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
        sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'compatibility-replacement'});
        await flush();
        expect(task.uiControls).toEqual(fencedControls);
        expect(cc.getVoiceConnectionState()).toEqual(ready);
        jest.advanceTimersByTime(105000); await flush(); sockets[2].welcome(); await flush();
        const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
        expect(reload.headers.trackingid).not.toBe(oldReload.headers.trackingid);
        sockets[2].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, oldReload.headers.trackingid));
        await flush();
        expect(cc['lastPublishedRegionState'].status).toBe('recovering');
        sockets[2].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
          {deviceType: 'BROWSER', dn: 'webrtc-agent', isExtension: false}));
        await flush();
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        expect(task.uiControls).toEqual(fencedControls);
        expect(offerRetainedTask(h, 'replacement-task').task.uiControls).toEqual(connectedControls);
        expect(cc.getVoiceConnectionState()).toEqual(ready);
        expect(voice).toHaveBeenCalledTimes(4);
        const changed = cc.setAgentState({state: 'Idle', auxCodeId: 'break'});
        const stateSettled = jest.fn(); changed.then(stateSettled, stateSettled); await flush();
        const stateId = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0].headers.trackingid;
        expect(stateId).not.toBe(oldStateId);
        expect(stateSettled).not.toHaveBeenCalled();
        sockets[2].message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, oldStateId), type: CC_EVENTS.AGENT_STATE_CHANGE});
        await flush(); expect(stateSettled).not.toHaveBeenCalled();
        const stateResponse = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, stateId,
          {auxCodeId: 'break'}), type: CC_EVENTS.AGENT_STATE_CHANGE};
        sockets[2].message(stateResponse);
        await expect(changed).resolves.toEqual(stateResponse); await flush();
        expect(stateSettled).toHaveBeenCalledTimes(1);
        line.emit(api.LINE_EVENTS.RECONNECTING);
        const reconnecting = {status: 'unavailable', lineStatus: 'reconnecting', mobiusSocketStatus: 'connected',
          reason: 'LINE_RECONNECTING', retryable: true};
        expect(cc.getVoiceConnectionState()).toEqual(reconnecting);
        expect(voice.mock.calls.slice(-1)).toEqual([[reconnecting]]);
        line.emit(api.LINE_EVENTS.RECONNECTED);
        client.emit(api.CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED);
        const reconnected = {...ready, lineStatus: 'reconnected'};
        expect(cc.getVoiceConnectionState()).toEqual(reconnected);
        expect(voice.mock.calls.slice(-1)).toEqual([[reconnected]]);
      });
    });

    const observeDisabledBoundary = ({cc, host, calling, requests, sockets, spy, observePreservation}) => {
      const {ensure, assertRetained} = observePreservation();
      const voiceState = calling.getVoiceConnectionState();
      const credentials = host.credentials;
      credentials.authorization = 'Bearer retained-browser-token';
      credentials.invalidate = jest.fn();
      const credentialState = {...credentials};
      const primary = cc.services.webSocketManager;
      const rtd = cc.services.rtdWebSocketManager;
      // Observe only this switch, after registration and any earlier RTD pause.
      const stop = spy(cc.services.connectionService, 'stop');
      const pause = spy(cc.services.connectionService, 'pause');
      const recover = spy(cc.services.connectionService, 'recoverRegion');
      const primaryClose = spy(primary, 'close');
      const rtdClose = spy(rtd, 'close');
      const forbidden = [ensure, recover, spy(cc, 'deregister'), spy(cc, 'silentRelogin'),
        spy(cc.services.agent, 'reload'), spy(cc.services.agent, 'stationLogin'),
        spy(cc.services.agent, 'logout'), spy(cc.services.contact, 'end'),
        spy(calling, 'cleanUpCall'), spy(calling, 'declineCall'), spy(host, 'refresh'),
        credentials.invalidate];
      const metric = spy(cc.metricsManager, 'trackEvent');
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const requestCount = requests.length; const socketCount = sockets.length;
      return () => {
        expect(pause.mock.calls).toEqual([[]]);
        expect(stop.mock.calls).toEqual([[]]);
        expect(primaryClose.mock.calls).toEqual([[false, 'notEligible']]);
        // The regional fence closes RTD first; disabled eligibility then closes it explicitly.
        expect(rtdClose.mock.calls).toEqual([[false, 'regionRecovery'], [false, 'notEligible']]);
        expect(rtdClose.mock.invocationCallOrder[0]).toBeLessThan(stop.mock.invocationCallOrder[0]);
        expect(listener.mock.calls).toEqual([[{
          status: 'unavailable', reason: 'not-eligible', trackingId: 'disabled-switch',
        }]]);
        expect(cc['lastPublishedRegionState']).toEqual(listener.mock.calls[0][0]);
        expect(cc['recoveryPhase']).toBe('unavailable');
        expect(cc.services.connectionService['mode']).toBe('stopped');
        for (const manager of [primary, rtd]) {
          expect(manager['attempt']).toBeUndefined();
          expect(manager.hasUsableSocket()).toBe(false);
          expect(manager.isSocketClosed).toBe(true);
          expect(manager.shouldReconnect).toBe(false);
        }
        expect(cc['rtdPaused']).toBe(true);
        expect(cc['rtdEpoch']).toBeUndefined();
        assertRetained();
        expect(calling.getVoiceConnectionState()).toEqual(voiceState);
        expect(calling.isVoiceReady()).toBe(true);
        expect(host.credentials).toBe(credentials);
        expect({...host.credentials}).toEqual(credentialState);
        forbidden.forEach(operation => expect(operation).not.toHaveBeenCalled());
        expect(regionMetrics(metric)).toEqual([]);
        expect(requests).toHaveLength(requestCount);
        expect(sockets).toHaveLength(socketCount);
      };
    };

    it.each([
      ['disabledStopsBothTransportsKeepsLine', {id: 'org', multiRegionEnabled: false}],
      ['legacyDisabledRecordDoesNotEnterDr', {id: 'org'}],
    ])('T-002 %s with registered BROWSER line and active RTD', async (_name, wireSettings) => {
      await withBrowserGraph(async h => {
        const {cc, flush} = h;
        const {primary, rtd} = await startBrowserAndRtd(h);
        cc.$config.allowAutomatedRelogin = true;
        expect(cc['multiRegionSettings'].eligibility).toBe('disabled');
        const assertDisabled = observeDisabledBoundary(h);

        primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'disabled-switch'});
        await flush(); assertDisabled();
        for (const socket of [primary, rtd]) {
          expect(socket.close).toHaveBeenCalledTimes(1);
          expect(socket.readyState).toBe(3);
        }
        for (let elapsed = 0; elapsed < 180000; elapsed += 5000) {
          jest.advanceTimersByTime(5000); await flush();
        }
        assertDisabled();
      }, wireSettings, {enabled: true});
    });

    it.each([
      ['http', 'http'], ['http', 'welcome'], ['welcome', 'http'], ['welcome', 'welcome'],
    ])('T-002 lateDisabledSubscribeCannotInstall primary=%s RTD=%s', async (primaryPhase, rtdPhase) => {
      await withBrowserGraph(async h => {
        const {cc, host, requests, sockets, flush} = h;
        const {primary} = await startBrowserAndRtd(h);
        cc.$config.allowAutomatedRelogin = true;
        const admissions = [createDeferred<any>(), createDeferred<any>()];
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          const index = [SUBSCRIBE_API, 'v1/realtime/subscribe'].indexOf(request.resource);
          if (index < 0) return boundary(request);
          requests.push(request);
          return admissions[index].promise;
        });
        cc['pauseRtd']();
        const rtdPending = cc['resumeRtd'](cc['registrationAbortController'].signal);
        const rtdSettled = jest.fn(); rtdPending.then(rtdSettled);
        primary.lost(); jest.advanceTimersByTime(5000); await flush();
        const managers = [cc.services.webSocketManager, cc.services.rtdWebSocketManager];
        const phases = [primaryPhase, rtdPhase];
        const responses = ['routing.produs2', 'rtd.produs2'].map(hostname => ({
          statusCode: 200, body: {webSocketUrl: `wss://${hostname}.cisco.com`},
        }));
        for (let index = 0; index < phases.length; index += 1) {
          if (phases[index] === 'welcome') admissions[index].resolve(responses[index]);
        }
        await flush();
        const attempts = managers.map(manager => manager['attempt']);
        attempts.forEach((attempt, index) => {
          expect(attempt).toBeDefined();
          expect(attempt.accepted).toBe(false);
          expect(attempt.signal.aborted).toBe(false);
          expect(!!attempt.socket).toBe(phases[index] === 'welcome');
        });
        expect(rtdSettled).not.toHaveBeenCalled();
        // Retain native callbacks as if Welcome/error/close was already queued by the browser.
        const lateCallbacks = attempts.map(({socket}) => socket && ({
          open: socket.onopen, message: socket.onmessage, error: socket.onerror, close: socket.onclose,
        }));
        const assertDisabled = observeDisabledBoundary(h);

        // Both transports are pending: deliver through the actual registered ContactCenter handler.
        expect(managers[0].listeners('message')).toContain(cc['handleWebsocketMessage']);
        cc['handleWebsocketMessage'](JSON.stringify({
          type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'disabled-switch',
        }));
        await flush();
        expect(rtdSettled).toHaveBeenCalledTimes(1);
        attempts.forEach(attempt => expect(attempt.signal.aborted).toBe(true));
        assertDisabled();

        admissions.forEach((admission, index) => admission.resolve(responses[index]));
        lateCallbacks.forEach(callbacks => {
          callbacks?.open?.();
          callbacks?.message?.({data: JSON.stringify({type: 'Welcome', data: {agentId: 'agent'}})});
          callbacks?.error?.(); callbacks?.close?.();
        });
        await rtdPending; await flush();
        for (let elapsed = 0; elapsed < 180000; elapsed += 5000) {
          jest.advanceTimersByTime(5000); await flush();
        }
        assertDisabled();
        attempts.forEach(({socket}) => {
          if (!socket) return;
          expect(socket.close).toHaveBeenCalledTimes(1);
          expect(socket.readyState).toBe(3);
          expect(socket.onmessage).toBeNull();
        });
      }, {id: 'org', multiRegionEnabled: false}, {enabled: true});
    });

    it.each(['reload', 'saved-login fallback'])(
      'T-007 drCallingPreserveVersusOrdinaryReplace: automatic %s', async route => {
        await withBrowserGraph(async ({cc, calling, login, recover, reply, observePreservation}) => {
          await login(LoginOption.BROWSER);
          expect(calling.isVoiceReady()).toBe(true);
          const {ensure, assertRetained} = observePreservation();
          cc.$config.allowAutomatedRelogin = true;
          await recover();
          const signal = cc['commandController'].signal;
          if (route === 'saved-login fallback') {
            await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038});
            await reply('/v1/agents/login', CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS);
          } else await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS);
          expect(ensure).toHaveBeenCalledTimes(1);
          expect(ensure).toHaveBeenCalledWith(signal);
          expect(signal.aborted).toBe(false);
          assertRetained();
          expect(calling.isVoiceReady()).toBe(true);
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
        });
      });

    it.each(['automatic reload', 'automatic fallback', 'manual accepted station', 'manual first station']
      .flatMap(route => [false, true].map(throwingSink => ({route, throwingSink}))))(
      'T-009 unexpectedPreserveEnsureFailure retains station: $route throwingSink=$throwingSink',
      async ({route, throwingSink}) => {
        await withBrowserGraph(async ({cc, graph, host, calling, login, recover, reply, requests,
          flush, spy, observePreservation}) => {
          const manual = route.startsWith('manual');
          if (route === 'manual first station') {
            calling.setLoginOption(LoginOption.BROWSER); calling.setBrowserVoiceRequired(true);
            await calling.registerWebCallingLine();
          } else await login(LoginOption.BROWSER);
          const {ensure, assertRetained} = observePreservation();
          cc.$config.allowAutomatedRelogin = !manual;
          await recover();
          if (route === 'automatic fallback')
            await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038});
          const error = Object.assign(new Error('PRIVATE_ENSURE_ERROR'), {
            station: {dialNumber: 'PRIVATE_DN', agentSessionId: 'PRIVATE_SESSION'},
          });
          ensure.mockRejectedValueOnce(error);
          const diagnostic = spy(graph.LoggerProxy, 'error'); diagnostic.mockClear();
          host.logger.error.mockClear();
          if (throwingSink) host.logger.error.mockImplementation(() => {throw new Error('sink');});
          const metrics = spy(cc.metricsManager, 'trackEvent'); metrics.mockClear();
          const states = jest.fn(); cc.on('region:stateChange', states);
          const failed = jest.fn(); cc.on(AGENT_EVENTS.AGENT_STATION_LOGIN_FAILED, failed);
          const pending = manual
            ? cc.stationLogin({teamId: 'team', loginOption: LoginOption.BROWSER}) : undefined;
          await flush();
          const loginResponse = manual || route === 'automatic fallback';
          await reply(loginResponse ? '/v1/agents/login' : '/v1/agents/reload',
            loginResponse ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_SUCCESS,
            {agentSessionId: 'PRIVATE_SESSION'});
          if (manual) await expect(pending).resolves.toEqual({
            type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS,
            trackingId: requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0].headers.trackingid.replace(/^webex-js-sdk_/, ''),
            orgId: 'org', agentId: 'agent', agentSessionId: 'PRIVATE_SESSION', teamId: 'team',
            deviceType: LoginOption.BROWSER, dn: 'webrtc-agent', isExtension: false,
            auxCodeId: 'idle', status: 'LoggedIn', subStatus: 'Idle', lastStateChangeReason: 'initial',
            lastStateChangeTimestamp: 1, lastIdleCodeChangeTimestamp: 1,
            mmProfile: {chat: undefined, email: undefined, social: undefined, telephony: undefined},
            notifsTrackingId: 'outer',
          });
          expect(ensure).toHaveBeenCalledTimes(1);
          expect(diagnostic.mock.calls).toEqual([['Unexpected web calling ensure failure', {
            module: CC_FILE, method: manual ? METHODS.STATION_LOGIN : METHODS.HANDLE_DEVICE_TYPE,
          }]]);
          expect(host.logger.error).toHaveBeenCalledTimes(1);
          expect(JSON.stringify(host.logger.error.mock.calls)).not.toMatch(/PRIVATE|Error:|dialNumber|agentSessionId/);
          assertRetained();
          expect(calling.isVoiceReady()).toBe(true);
          expect(cc['acceptedStation'].sessionId).toBe('PRIVATE_SESSION');
          expect(cc['currentAgentSessionId']).toBe('PRIVATE_SESSION');
          expect(cc.agentConfig.isAgentLoggedIn).toBe(true);
          expect(states.mock.calls.map(([state]) => [state.status, state.reason]))
            .toEqual([['ready', 'region-switch']]);
          expect(failed).not.toHaveBeenCalled();
          expect(metrics.mock.calls.filter(([event]) => event === METRIC_EVENT_NAMES.STATION_LOGIN_FAILED ||
            event === METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED)).toEqual([]);
        });
      });

    it.each(['automatic', 'manual'])(
      'T-009 unexpectedPreserveEnsureFailure rechecks %s ownership after a cancelling diagnostic throws',
      async route => {
        await withBrowserGraph(async ({cc, graph, login, recover, reply, flush, spy, observePreservation}) => {
          await login(LoginOption.BROWSER);
          const {ensure, assertRetained} = observePreservation();
          cc.$config.allowAutomatedRelogin = route === 'automatic';
          await recover();
          const acknowledgement = createDeferred<void>();
          ensure.mockReturnValueOnce(acknowledgement.promise);
          const diagnostic = spy(graph.LoggerProxy, 'error').mockImplementation(() => {
            cc['terminateRegistration']();
            throw new Error('sink');
          });
          const postLogin = spy(cc, 'ensureWxAppPostStationLogin'); postLogin.mockClear();
          const pending = route === 'manual'
            ? cc.stationLogin({teamId: 'team', loginOption: LoginOption.BROWSER}) : undefined;
          const interrupted = pending && expect(pending).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          await flush();
          await reply(route === 'manual' ? '/v1/agents/login' : '/v1/agents/reload',
            route === 'manual' ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_SUCCESS);
          expect(ensure).toHaveBeenCalledTimes(1);
          const states = jest.fn(); cc.on('region:stateChange', states);
          acknowledgement.reject(new Error('PRIVATE_ENSURE_ERROR'));
          await flush(); await interrupted;
          expect(diagnostic.mock.calls).toEqual([['Unexpected web calling ensure failure', {
            module: CC_FILE, method: route === 'manual' ? METHODS.STATION_LOGIN : METHODS.HANDLE_DEVICE_TYPE,
          }]]);
          expect(cc['acceptedStation']).toBeUndefined();
          expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([]);
          expect(postLogin).not.toHaveBeenCalled();
          assertRetained();
        });
      });

    it('T-007 drCallingPreserveVersusOrdinaryReplace: initial/ordinary login and silentRelogin replace', async () => {
      await withBrowserGraph(async ({cc, calling, line, login, reply, flush, spy}) => {
        const replace = spy(calling, 'registerWebCallingLine');
        const ensure = spy(calling, 'ensureWebCallingLine');
        await login(LoginOption.BROWSER);
        expect(replace).toHaveBeenCalledTimes(1);
        expect(line.deregister).not.toHaveBeenCalled();
        await login(LoginOption.BROWSER);
        expect(replace).toHaveBeenCalledTimes(2);
        expect(line.deregister).toHaveBeenCalledTimes(1);
        const ordinary = cc['silentRelogin'](); await flush();
        await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS);
        await ordinary;
        expect(replace.mock.calls).toEqual([[], [], []]);
        expect(line.deregister).toHaveBeenCalledTimes(2);
        expect(ensure).not.toHaveBeenCalled();
      });
    });

    it.each([
      [LoginOption.BROWSER, true, false, true],
      [LoginOption.BROWSER, false, false, true],
      [LoginOption.BROWSER, true, true, false],
      [LoginOption.EXTENSION, true, false, false],
    ])('T-007 ordinaryReloginKeepsTasksAndAuth device=%s webRtcEnabled=%s disabled=%s replaces=%s',
      async (deviceType, webRtcEnabled, disabled, replaces) => {
        await withBrowserGraph(async h => {
          const {cc, host, calling, line, client, createClient, requests, sockets,
            login, frame, flush, spy} = h;
          const credentials = host.credentials;
          credentials.authorization = 'Bearer retained-ordinary-test-token';
          credentials.invalidate = jest.fn();
          await login(deviceType);
          cc.agentConfig.webRtcEnabled = webRtcEnabled;
          cc.$config.disableWebRTCRegistration = disabled;
          cc.$config.allowAutomatedRelogin = true;
          const {task, data, deliver} = offerRetainedTask(h);
          const actor = task.stateMachineService;
          const controls = task.uiControls;
          const controlValues = JSON.parse(JSON.stringify(controls));
          const lifetime = task['recoveryGuard'];
          expect(jest.isMockFunction(task.hold)).toBe(false);
          expect(actor.getSnapshot().status).toBe('active');
          expect(controls.main.hold).toEqual({isVisible: true, isEnabled: true});

          // Baseline after real registration, login and Task intake, so initial setup
          // cannot mask an extra session start, credential change or regional cleanup.
          const credentialValues = {...credentials};
          const profile = cc.agentConfig;
          const published = cc['lastPublishedRegionState'];
          expect(published.status).toBe('ready');
          expect(published.reason).toBe('initial-login');
          const revision = cc['stateIntentRevision'];
          const region = jest.fn(); cc.on('region:stateChange', region);
          const forbidden = [
            spy(cc.taskManager, 'invalidateRegionalTasks'),
            spy(cc.taskManager, 'clearAISummaryState'),
            spy(cc.taskManager, 'startSession'),
            spy(cc.services.config, 'getMultiRegionSettings'),
            spy(cc.services.config, 'getAgentConfig'),
            spy(cc.services.connectionService, 'recoverRegion'),
            spy(host, 'refresh'), credentials.invalidate,
          ];
          const catalog = host.internal.services;
          catalog.updateServices = jest.fn(); catalog.updateCatalog = jest.fn();
          const catalogValues = {...catalog};
          const catalogWrites = jest.fn();
          const catalogOwner = new Proxy(catalog, {
            set(target, key, value) { catalogWrites(key, value); return Reflect.set(target, key, value); },
            deleteProperty(target, key) { catalogWrites(key); return Reflect.deleteProperty(target, key); },
            defineProperty(target, key, value) { catalogWrites(key, value); return Reflect.defineProperty(target, key, value); },
          });
          host.internal.services = catalogOwner;
          const catalogWaits = catalog.waitForCatalog.mock.calls.length;
          const catalogReads = catalog.get.mock.calls.length;
          const requestBoundary = host.request.getMockImplementation();
          const authenticated = jest.fn();
          const hostRequest = host.request;
          hostRequest.mockImplementation(function (request) {
            // The network boundary represents host authentication. The real subscribe,
            // AQM and Task owners must all borrow this same receiver and credentials.
            authenticated(request, this, this.credentials, this.credentials.authorization);
            return requestBoundary(request);
          });
          const requestCount = requests.length;
          const replace = spy(calling, 'registerWebCallingLine');
          const ensure = spy(calling, 'ensureWebCallingLine');
          const cleanup = spy(calling, 'cleanupWebCallingRegistration');
          const reload = spy(cc.services.agent, 'reload');
          const stateChange = spy(cc.services.agent, 'stateChange');
          const relogin = spy(cc, 'silentRelogin');
          const registrations = line.register.mock.calls.length;
          const deregistrations = line.deregister.mock.calls.length;
          const creations = createClient.mock.calls.length;
          const assertPreserved = () => {
            expect(cc.taskManager.getTask(data.interactionId)).toBe(task);
            expect(task.stateMachineService).toBe(actor);
            expect(actor.getSnapshot().status).toBe('active');
            expect(task.uiControls).toBe(controls);
            expect(task.uiControls).toEqual(controlValues);
            expect(task['recoveryGuard']).toBe(lifetime);
            expect(lifetime.signal.aborted).toBe(false);
            expect(task['operationsInterrupted']).toBe(false);
            expect(host.credentials).toBe(credentials);
            expect({...credentials}).toEqual(credentialValues);
            expect(host.request).toBe(hostRequest);
            expect(host.internal.services).toBe(catalogOwner);
            expect({...catalog}).toEqual(catalogValues);
            expect(catalogWrites).not.toHaveBeenCalled();
            expect(catalog.updateServices).not.toHaveBeenCalled();
            expect(catalog.updateCatalog).not.toHaveBeenCalled();
            expect(cc.agentConfig).toBe(profile);
            expect(cc['lastPublishedRegionState']).toBe(published);
            expect(region).not.toHaveBeenCalled();
            expect(cc['autoAvailable']).toBeUndefined();
            expect(cc['stateIntentRevision']).toBe(revision);
            forbidden.forEach(operation => expect(operation).not.toHaveBeenCalled());
          };

          sockets[0].lost(); await flush(); assertPreserved();
          jest.advanceTimersByTime(4999); await flush();
          expect(requests).toHaveLength(requestCount);
          jest.advanceTimersByTime(1); await flush();
          expect(sockets).toHaveLength(2);
          expect(requests.slice(requestCount).map(r => r.resource)).toEqual([SUBSCRIBE_API]);
          expect(reload).not.toHaveBeenCalled();
          sockets[1].welcome(); await flush();
          expect(reload).toHaveBeenCalledTimes(1);
          expect(relogin).toHaveBeenCalledTimes(1);
          const request = requests[requestCount + 1];
          expect(request.resource).toBe('/v1/agents/reload');
          const response = frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, 'server-assigned-reload-id',
            {deviceType, isExtension: deviceType === LoginOption.EXTENSION,
              dn: deviceType === LoginOption.BROWSER ? 'webrtc-agent' : '1234',
              lastStateChangeReason: 'agent-wss-disconnect'});
          expect(stateChange).not.toHaveBeenCalled(); assertPreserved();
          sockets[1].message(response); await flush();
          await expect(reload.mock.results[0].value).resolves.toEqual(response);
          expect(stateChange).toHaveBeenCalledTimes(1);
          const state = requests[requestCount + 2];
          expect(state.resource).toBe('/v1/agents/session/state');
          expect(state.body).toEqual({state: 'Available', auxCodeId: '0',
            lastStateChangeReason: 'agent-wss-disconnect', agentId: 'agent'});
          expect(state.headers.trackingid).not.toBe(request.headers.trackingid);
          const ack = frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, state.headers.trackingid,
            {subStatus: 'Available', auxCodeId: '0', lastStateChangeReason: 'agent-wss-disconnect',
              lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3});
          sockets[1].message({...ack, type: CC_EVENTS.AGENT_STATE_CHANGE}); await flush();
          await expect(stateChange.mock.results[0].value).resolves.toEqual({...ack, type: CC_EVENTS.AGENT_STATE_CHANGE});
          await expect(relogin.mock.results[0].value).resolves.toBeUndefined();
          expect(cc.agentConfig.isAgentLoggedIn).toBe(true);
          expect(cc.agentConfig.lastStateAuxCodeId).toBe('0');
          expect(cc.agentConfig.lastStateChangeTimestamp).toBe(2);
          expect(calling.isBrowserVoiceRequired()).toBe(deviceType === LoginOption.BROWSER && webRtcEnabled && !disabled);
          expect(replace.mock.calls).toEqual(replaces ? [[]] : []);
          expect(cleanup).toHaveBeenCalledTimes(replaces ? 1 : 0);
          expect(ensure).not.toHaveBeenCalled();
          expect(line.register).toHaveBeenCalledTimes(registrations + (replaces ? 1 : 0));
          expect(line.deregister).toHaveBeenCalledTimes(deregistrations + (replaces ? 1 : 0));
          expect(createClient).toHaveBeenCalledTimes(creations + (replaces ? 1 : 0));
          expect(catalog.waitForCatalog).toHaveBeenCalledTimes(catalogWaits + (replaces ? 1 : 0));
          expect(catalog.get).toHaveBeenCalledTimes(catalogReads + (replaces ? 1 : 0));
          if (replaces) {
            expect(createClient.mock.calls.slice(creations)[0][0]).toBe(host);
            expect(calling['line']).toBe(line); expect(calling['callingClient']).toBe(client);
            expect(catalog.waitForCatalog.mock.calls.slice(catalogWaits)).toEqual([['postauth']]);
            expect(catalog.get.mock.calls.slice(catalogReads)).toEqual([['wcc-calling-rtms-domain']]);
          }
          assertPreserved();

          // Exercise a retained enabled control through the real Task -> AQM -> host
          // request path, then let the replacement primary settle its normal event.
          const held = task.hold(); const observed = held.catch(() => undefined);
          await flush();
          const hold = requests[requestCount + 3];
          expect(hold.resource).toBe(`/v1/tasks/${data.interactionId}/hold`);
          deliver(CC_EVENTS.AGENT_CONTACT_HELD, {interaction: {...data.interaction, state: 'connected'}});
          await held; await observed;
          expect(task.stateMachineService).toBe(actor);
          expect(task.state.value).toBe('HELD');
          expect(authenticated.mock.calls).toEqual(requests.slice(requestCount)
            .map(r => [r, host, credentials, credentialValues.authorization]));
          expect(requests.slice(requestCount).map(r => r.service)).toEqual(
            Array(4).fill('wcc-api-gateway'));
        });
      });

    it.each(['region-switch', 'automatic-relogin-disabled', 'session-restore-failed'])(
      'T-009 manualDrBrowserLoginPreservesHealthyLine after %s including failed retry', async reason => {
        await withBrowserGraph(async ({cc, calling, login, recover, reply, flush, spy, observePreservation}) => {
          if (reason === 'region-switch') {
            // A retained calling owner can outlive a station session.
            calling.setLoginOption(LoginOption.BROWSER); calling.setBrowserVoiceRequired(true);
            await calling.registerWebCallingLine();
          } else await login(LoginOption.BROWSER);
          const {ensure, assertRetained} = observePreservation();
          cc.$config.allowAutomatedRelogin = reason === 'session-restore-failed';
          await recover();
          if (reason === 'session-restore-failed') {
            await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_FAILED, {reasonCode: 1038});
            await reply('/v1/agents/login', CC_EVENTS.AGENT_STATION_LOGIN_FAILED, {reasonCode: 9999});
          }
          expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
          expect(cc['lastPublishedRegionState'].reason).toBe(reason);
          const dispatch = spy(cc.services.agent, 'stationLogin');
          const failed = cc.stationLogin({teamId: 'team', loginOption: LoginOption.BROWSER});
          const rejected = expect(failed).rejects.toBeInstanceOf(Error);
          await flush();
          const failedSignal = dispatch.mock.calls[0][2].signal;
          if (reason === 'region-switch') {
            expect(ensure).toHaveBeenCalledTimes(1);
            expect(ensure).toHaveBeenLastCalledWith(failedSignal);
          }
          await reply('/v1/agents/login', CC_EVENTS.AGENT_STATION_LOGIN_FAILED, {reasonCode: 9999});
          await rejected;
          expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
          expect(cc['lastPublishedRegionState'].reason).toBe(reason);
          assertRetained();
          const retry = cc.stationLogin({teamId: 'team', loginOption: LoginOption.BROWSER});
          await flush();
          const retrySignal = dispatch.mock.calls[1][2].signal;
          expect(retrySignal).not.toBe(failedSignal);
          await reply('/v1/agents/login', CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS);
          await retry;
          expect(ensure).toHaveBeenCalledTimes(reason === 'region-switch' ? 2 : 1);
          expect(ensure).toHaveBeenLastCalledWith(retrySignal);
          expect(retrySignal.aborted).toBe(false);
          assertRetained();
          expect(calling.isVoiceReady()).toBe(true);
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
        });
      });

    it.each(['success', 'error', 'timeout'])(
      'T-007 drReadyBeforeLineRegistrationAndTimeout: absent line later %s', async outcome => {
        await withBrowserGraph(async ({cc, calling, line, api, login, recover, reply, flush, spy}) => {
          await login(LoginOption.BROWSER);
          await calling.deregisterWebCallingLine();
          expect(calling['line']).toBeUndefined();
          line.register.mockImplementation(() => undefined);
          const ensure = spy(calling, 'ensureWebCallingLine');
          const replace = spy(calling, 'registerWebCallingLine');
          const states = jest.fn(); cc.on('region:stateChange', states);
          cc.$config.allowAutomatedRelogin = true;
          await recover();
          await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS);
          expect(ensure).toHaveBeenCalledTimes(1);
          expect(ensure).toHaveBeenCalledWith(cc['commandController'].signal);
          await expect(ensure.mock.results[0].value).resolves.toBeUndefined();
          const registration = calling['registrationAttempt'].promise;
          const completed = jest.fn(); registration.then(completed, completed);
          await flush();
          expect(completed).not.toHaveBeenCalled();
          expect(calling.getVoiceConnectionState()).toEqual({status: VOICE_CONNECTION_STATUS.UNAVAILABLE,
            lineStatus: 'connecting', mobiusSocketStatus: 'connected'});
          const ready = cc['lastPublishedRegionState'];
          expect(ready.status).toBe('ready');
          const publications = states.mock.calls.map(([state]) => state);
          expect(publications.filter(state => state.status === 'ready')).toEqual([ready]);
          jest.advanceTimersByTime(TIMEOUT_DURATION - 1); await flush();
          expect(completed).not.toHaveBeenCalled();
          if (outcome === 'success') line.emit(api.LINE_EVENTS.REGISTERED, line);
          else if (outcome === 'error') line.emit(api.LINE_EVENTS.ERROR, {status: 'inactive', message: 'line failed'});
          else jest.advanceTimersByTime(1);
          await flush();
          expect(completed).toHaveBeenCalledTimes(1);
          expect(calling.getVoiceConnectionState().status).toBe(outcome === 'success'
            ? VOICE_CONNECTION_STATUS.READY : VOICE_CONNECTION_STATUS.UNAVAILABLE);
          if (outcome === 'timeout') expect(calling.getVoiceConnectionState().reason).toBe('REGISTRATION_TIMEOUT');
          expect(cc['lastPublishedRegionState']).toBe(ready);
          expect(states.mock.calls.map(([state]) => state)).toEqual(publications);
          expect(replace).not.toHaveBeenCalled();
        });
      });

    const completeExplicitAvailable = async ({cc, sockets, requests, frame, flush}) => {
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(0);
      expect(cc['autoAvailable']).toBeUndefined();
      const revision = cc['stateIntentRevision'];
      const pending = cc.setAgentState({state: 'Available', auxCodeId: '0'});
      const settled = jest.fn(); pending.then(settled, settled); await flush();
      const changes = requests.filter(r => r.resource === '/v1/agents/session/state');
      expect(changes).toHaveLength(1);
      const id = changes[0].headers.trackingid;
      expect(cc['stateDispatches'].get(id.replace(/^webex-js-sdk_/, '')).source).toBe('explicit');
      expect(cc['stateIntentRevision']).toBe(revision + 1);
      expect(settled).not.toHaveBeenCalled();
      const response = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, id,
        {auxCodeId: '0', subStatus: 'Available'}), type: CC_EVENTS.AGENT_STATE_CHANGE};
      sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].message(response);
      await expect(pending).resolves.toEqual(response); await flush();
      expect(settled.mock.calls).toEqual([[response]]);
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(1);
      expect(cc['autoAvailable']).toBeUndefined();
    };

    it('T-007 availableVoiceGateUnchangedDuringDr rejects unready voice then dispatches once Mobius reconnects', async () => {
      await withBrowserGraph(async h => {
        const {cc, calling, api, login, recover, reply, host, requests, flush} = h;
        await login(LoginOption.BROWSER);
        calling['callingClient'].emit(api.CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED, {reason: 'transient'});
        cc.$config.allowAutomatedRelogin = true;
        await recover(); await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS);
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        expect(calling.isBrowserVoiceRequired()).toBe(true);
        expect(calling.isVoiceReady()).toBe(false);
        await expect(cc.setAgentState({state: 'Available', auxCodeId: '0'}))
          .rejects.toThrow(VOICE_CONNECTION_ERROR.NOT_READY);
        expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(0);
        expect(host.request.mock.calls.filter(([r]) => r.resource === '/v1/agents/session/state')).toHaveLength(0);
        calling['callingClient'].emit(api.CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED);
        expect(calling.isVoiceReady()).toBe(true);
        await completeExplicitAvailable(h);
        calling['callingClient'].emit(api.CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED);
        await flush();
        expect(host.request.mock.calls.filter(([r]) => r.resource === '/v1/agents/session/state')).toHaveLength(1);
      });
    });

    it.each(['extension', 'registration disabled'])(
      'T-007 availableVoiceGateUnchangedDuringDr dispatches without browser transport: %s', async transition => {
        await withBrowserGraph(async h => {
          const {cc, calling, api, login, recover, reply} = h;
          await login(LoginOption.BROWSER);
          calling['callingClient'].emit(api.CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED, {reason: 'transient'});
          if (transition === 'registration disabled') {
            cc.$config.allowMultiLogin = true; cc.$config.disableWebRTCRegistration = true;
          }
          cc.$config.allowAutomatedRelogin = true;
          await recover();
          const deviceType = transition === 'extension' ? LoginOption.EXTENSION : LoginOption.BROWSER;
          await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS,
            {deviceType, dn: deviceType === LoginOption.BROWSER ? 'webrtc-agent' : '1234',
              isExtension: deviceType === LoginOption.EXTENSION});
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
          expect(calling.getVoiceConnectionState().mobiusSocketStatus).toBe('disconnected');
          expect(calling.getVoiceConnectionState().status).toBe(VOICE_CONNECTION_STATUS.NOT_REQUIRED);
          expect(calling.isBrowserVoiceRequired()).toBe(false);
          await completeExplicitAvailable(h);
        });
      });

    it.each(['extension', 'dial number', 'webRtcEnabled false', 'registration disabled'])(
      'T-007 drDeviceModeChangeRetainsUnusedLine: %s', async transition => {
        await withBrowserGraph(async h => {
          const {cc, calling, line, api, login, recover, reply, spy, observePreservation} = h;
          await login(LoginOption.BROWSER);
          const {ensure, assertRetained} = observePreservation();
          // Retain both the line and independent transport diagnostics when no longer required.
          line.emit(api.LINE_EVENTS.RECONNECTING);
          const before = calling.getVoiceConnectionState();
          if (transition === 'webRtcEnabled false') cc.agentConfig.webRtcEnabled = false;
          if (transition === 'registration disabled') {
            cc.$config.allowMultiLogin = true; cc.$config.disableWebRTCRegistration = true;
          }
          cc.$config.allowAutomatedRelogin = true;
          await recover();
          const deviceType = transition === 'extension' ? LoginOption.EXTENSION
            : transition === 'dial number' ? LoginOption.AGENT_DN : LoginOption.BROWSER;
          await reply('/v1/agents/reload', CC_EVENTS.AGENT_RELOGIN_SUCCESS,
            {deviceType, dn: deviceType === LoginOption.BROWSER ? 'webrtc-agent' : '1234',
              isExtension: deviceType === LoginOption.EXTENSION});
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
          expect(calling.getVoiceConnectionState()).toEqual({...before, status: VOICE_CONNECTION_STATUS.NOT_REQUIRED});
          expect(calling.isBrowserVoiceRequired()).toBe(false);
          expect(ensure).not.toHaveBeenCalled();
          assertRetained();
          const {task} = offerRetainedTask(h, 'unused-line-task');
          const taskState = task.state;
          const taskEvent = spy(task, 'sendStateMachineEvent');
          const mapCall = spy(calling, 'mapCallToTask');
          const incoming = jest.fn(); cc.on(TASK_EVENTS.TASK_INCOMING, incoming);
          const call = {getCallId: jest.fn(() => 'unused-line-call')};
          line.emit(api.LINE_EVENTS.INCOMING_CALL, call);
          expect(calling['call']).toBe(call); // The retained transport listener still runs.
          expect(cc.taskManager['call']).toBeUndefined();
          expect(mapCall).not.toHaveBeenCalled();
          expect(taskEvent).not.toHaveBeenCalled();
          expect(task.state).toBe(taskState);
          expect(call.getCallId).not.toHaveBeenCalled();
          expect(incoming).not.toHaveBeenCalled();
        });
      });
  });

  const offerRetainedTask = ({cc, sockets}: any, interactionId = 'retained-task') => {
    const data = createAISummaryLifecycleTaskData({interactionId, conversationId: interactionId,
      type: CC_EVENTS.AGENT_CONTACT_RESERVED,
      agentId: 'agent', orgId: 'org', interaction: {state: 'new'} as any});
    const deliver = (type: string, extra = {}) => {
      const primary = sockets.filter(socket => socket.url.includes('routing.')).slice(-1)[0];
      primary.message({type: 'RoutingMessage', data: {...data, ...extra, type}});
    };
    deliver(CC_EVENTS.AGENT_CONTACT_RESERVED);
    const task = cc.taskManager.getTask(interactionId);
    expect(task).toBeDefined();
    deliver(CC_EVENTS.AGENT_CONTACT_ASSIGNED, {interaction: {...data.interaction, state: 'connected'}});
    expect(task.state.value).toBe('CONNECTED');

    return {task, data, deliver};
  };

  const prepareTerminalRtdWork = async h => {
    const {cc, host, requests, sockets, flush} = h;
    const rtd = sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0];
    rtd.welcome(); await flush();
    const epoch = cc['rtdEpoch'];
    expect(epoch.active).toBe(true);
    expect(cc['rtdPaused']).toBe(false);
    const detached = jest.spyOn(epoch.parent, 'removeEventListener');
    const releaseLink = jest.spyOn(epoch, 'detach');
    const callback = rtd.onmessage;
    const handler = cc['handleRTDWebsocketMessage'];
    const manager = cc.services.rtdWebSocketManager;
    expect(manager.listenerCount('message')).toBe(1);
    const close = jest.spyOn(manager, 'close');
    const {task, data, deliver} = offerRetainedTask(h, 'terminal-task');
    const feature = interactionId => ({type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
      interactionId, postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}});
    rtd.message(feature(data.interactionId)); rtd.message(feature('buffered-task'));
    rtd.message({type: CC_TASK_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
      data: {data: {conversationId: 'buffered-task'}}});
    expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
    expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
    const acknowledgement = createDeferred<any>();
    const boundary = host.request.getMockImplementation();
    host.internal.services.get.mockReturnValue('https://api.wxcc-us1.cisco.com');
    host.request.mockImplementation(request => {
      if (request.uri?.endsWith('/event')) { requests.push(request); return acknowledgement.promise; }
      return boundary(request);
    });
    const settled = jest.fn();
    const summary = task.requestPostCallSummary().then(
      value => { settled({value}); return {value}; },
      error => { settled({error}); return {error}; }
    );
    await flush();
    expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(1);
    const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
    return {epoch, task, data, deliver, summary, settled, acknowledgement, close,
      assertReleased: async reason => {
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(cc['rtdPaused']).toBe(true);
        expect(epoch.controller.signal.aborted).toBe(true);
        expect(releaseLink).toHaveBeenCalledTimes(1);
        expect(detached).toHaveBeenCalledWith('abort', expect.any(Function));
        expect(manager.listenerCount('message')).toBe(0);
        expect(manager['attempt']).toBeUndefined();
        expect(manager.shouldReconnect).toBe(false);
        expect(close).toHaveBeenCalledWith(false, reason);
        expect(rtd.close).toHaveBeenCalledTimes(1);
        expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
        expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
        expect(cc.taskManager['receivingSummaryBuffer'].size).toBe(0);
        expect(await summary).toEqual({error: expect.objectContaining({
          data: {reason: 'RECOVERY_INTERRUPTED'}})});
        expect(settled).toHaveBeenCalledTimes(1);
        const stale = JSON.stringify(feature('stale-task'));
        rtd.message(JSON.parse(stale)); callback?.({data: stale}); handler(stale);
        expect(delivered).not.toHaveBeenCalled();
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
        acknowledgement.reject(new Error('late summary acknowledgement'));
        await flush();
        expect(settled).toHaveBeenCalledTimes(1);
      }};
  };

  it.each([401, 403, 503])('T-012 ordinaryReconnectReloginFailure status=%s', async status => {
    await withGraph(async h => {
      const {cc, host, requests, sockets, login, flush} = h;
      await login();
      const work = await prepareTerminalRtdWork(h);
      const {task, data, deliver, epoch} = work;
      const lifetime = task['recoveryGuard'];
      const command = cc['commandController'];
      const registration = cc['registrationAbortController'];
      const credentials = host.credentials;
      credentials.supertoken = {access_token: 'retained-token', refresh_token: 'retained-refresh'};
      const credentialState = {...credentials, supertoken: {...credentials.supertoken}};
      const accepted = cc['acceptedStation'];
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const held = task.hold();
      const heldResult = held.then(value => ({value}), error => ({error}));
      await flush();
      expect(requests.filter(r => r.resource === `/v1/tasks/${data.interactionId}/hold`)).toHaveLength(1);
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource === '/v1/agents/reload') {
          requests.push(request); return Promise.reject({statusCode: status});
        }
        return boundary(request);
      });
      cc.$config.allowAutomatedRelogin = true;
      await cc['handleConnectionLost']({isSocketReconnected: true}); await flush();
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(1);
      expect(cc.taskManager.getTask(data.interactionId)).toBe(task);
      expect(cc['registrationAbortController']).toBe(registration);
      expect(registration.signal.aborted).toBe(false);
      expect(cc['acceptedStation']).toBe(accepted);
      if (status === 503) {
        expect(listener).not.toHaveBeenCalled();
        expect(cc['recoveryPhase']).toBe('ready');
        expect(cc.services.connectionService['mode']).toBe('ordinary');
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(sockets.every(socket => socket.close.mock.calls.length === 0)).toBe(true);
        expect(lifetime.signal.aborted).toBe(false);
        expect(command.signal.aborted).toBe(false);
        expect(task['operationsInterrupted']).toBe(false);
        expect(cc['rtdEpoch']).toBe(epoch);
        expect(cc['rtdPaused']).toBe(false);
        expect(cc.services.aqmReqs['recoveryGate']).toEqual({state: 'open'});
        expect(work.settled).not.toHaveBeenCalled();
        deliver(CC_EVENTS.AGENT_CONTACT_HELD, {interaction: {...data.interaction, state: 'connected'}});
        expect(await heldResult).toHaveProperty('value');
        expect(task.state.value).toBe('HELD');
        work.acknowledgement.resolve({statusCode: 202, body: {}});
        await flush();
        sockets.find(socket => socket.url.includes('rtd.')).message({type: CC_EVENTS.POST_CALL_SUMMARY,
          data: {data: {conversationId: data.interactionId}}});
        expect(await work.summary).toHaveProperty('value');
        // A later operation on the same retained Task still reaches the backend.
        const resumed = task.resume(); const observed = resumed.catch(() => undefined); await flush();
        expect(requests.filter(r => r.resource === `/v1/tasks/${data.interactionId}/unhold`)).toHaveLength(1);
        deliver(CC_EVENTS.AGENT_CONTACT_UNHELD, {interaction: {...data.interaction, state: 'connected'}});
        await resumed; await observed;
      } else {
        expect(listener.mock.calls).toEqual([[{status: 'unavailable', reason: 'authentication-failed', homeRegion: 'produs1'}]]);
        expect(cc.services.connectionService['mode']).toBe('stopped');
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(false);
        expect(sockets.every(socket => socket.close.mock.calls.length === 1)).toBe(true);
        expect(lifetime.signal.aborted).toBe(true);
        expect(command.signal.aborted).toBe(true);
        expect(task['operationsInterrupted']).toBe(true);
        expect(await heldResult).toEqual({error: expect.objectContaining({data: {reason: 'RECOVERY_INTERRUPTED'}})});
        await work.assertReleased('recoveryFailed');
        await expect(task.end()).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      }
      const count = requests.length;
      for (let tick = 0; tick < 120; tick += 1) {
        jest.advanceTimersByTime(5000);
        if (status === 503) sockets[0].message({keepalive: 'true'});
        await flush();
      }
      expect(requests).toHaveLength(count);
      expect(work.settled).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(status === 503 ? 0 : 1);
      expect(host.credentials).toBe(credentials);
      expect(credentials).toEqual(credentialState);
      if (status === 503) expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
    }, undefined, {enabled: true});
  });

  it('T-010 ordinaryMismatchReleasesActiveRtdEpoch', async () => {
    await withGraph(async h => {
      const {cc, host, requests, sockets, login, flush} = h;
      await login();
      const work = await prepareTerminalRtdWork(h);
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource === SUBSCRIBE_API) {
          requests.push(request);
          return Promise.reject({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
        }
        return boundary(request);
      });
      sockets[0].lost(); jest.advanceTimersByTime(5000); await flush();
      expect(listener.mock.calls).toEqual([[{status: 'reloadRequired', reason: 'region-mismatch', homeRegion: 'produs1'}]]);
      await work.assertReleased('regionMismatch');
      // The registration parent may abort after terminal release without retaining or reviving RTD.
      cc['registrationAbortController'].abort(); await flush();
      cc['requireRegionReload']();
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(work.close.mock.calls).toEqual([[false, 'regionMismatch']]);
      const count = requests.length;
      jest.advanceTimersByTime(600000); await flush();
      expect(requests).toHaveLength(count);
      expect(listener).toHaveBeenCalledTimes(1);
    }, undefined, {enabled: true});
  });

  it('T-010 registrationFailureReleasesRtdAfterParentAbort', async () => {
    await withGraph(async ({cc, sockets, requests, flush}) => {
      const completion = createDeferred<void>();
      const connect = cc['connectWebsocket'].bind(cc);
      jest.spyOn(cc, 'connectWebsocket').mockImplementation(async attempt => {
        const profile = await connect(attempt);
        await completion.promise;
        return profile;
      });
      const registered = cc.register();
      const rejected = expect(registered).rejects.toThrow('registration completion failed');
      await flush(); sockets[0].welcome(); await flush();
      const rtd = sockets.find(socket => socket.url.includes('rtd.'));
      rtd.welcome(); await flush();
      const epoch = cc['rtdEpoch'];
      expect(epoch.active).toBe(true);
      const detached = jest.spyOn(epoch.parent, 'removeEventListener');
      const close = jest.spyOn(cc.services.rtdWebSocketManager, 'close');
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'during-register'});
      expect(cc['recovery']).toBeDefined();
      expect(cc['rtdEpoch']).toBeUndefined();
      completion.reject(new Error('registration completion failed'));
      await rejected; await flush();
      expect(epoch.parent.aborted).toBe(true);
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(detached).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(cc['rtdPaused']).toBe(true);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
      expect(cc.services.rtdWebSocketManager.shouldReconnect).toBe(false);
      expect(close.mock.calls).toEqual([[false, 'regionRecovery'], [false, 'recoveryFailed']]);
      expect(rtd.close).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls.filter(([state]) => state.status === 'unavailable')).toEqual([
        [{status: 'unavailable', reason: 'recovery-failed', homeRegion: 'produs1', trackingId: 'during-register'}],
      ]);
      expect(cc.services.connectionService['mode']).toBe('stopped');
      const count = requests.length;
      cc['registrationAbortController'].abort();
      jest.advanceTimersByTime(600000); await flush();
      expect(requests).toHaveLength(count);
      expect(rtd.close).toHaveBeenCalledTimes(1);
    }, undefined, {enabled: true}, {autoRegister: false});
  });

  it.each(['backend-rejected', 'no-primary'])(
    'T-008 ordinaryLogoutPreservesTaskLifetime: %s', async outcome => {
      await withGraph(async h => {
        const {cc, host, requests, sockets, login, flush} = h;
        await login();
        cc.taskManager.setWrapupData({wrapUpProps: {autoWrapup: true, autoWrapupInterval: 1000,
          wrapUpReasonList: [{id: 'done', name: 'Done', isDefault: true, isSystem: false}]}});
        const {task, data, deliver} = offerRetainedTask(h);
        const lifetime = task['recoveryGuard'];
        const command = cc['commandController'];
        const pending = task.end();
        const interrupted = expect(pending).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await flush();
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => request.resource === '/v1/agents/logout'
          ? Promise.reject({statusCode: 400, body: {reason: 'AGENT_IN_INTERACTION'}}) : boundary(request));
        if (outcome === 'no-primary') {
          sockets[0].lost();
          expect(cc.services.webSocketManager.hasUsableSocket()).toBe(false);
        }
        await expect(cc.stationLogout({logoutReason: 'in interaction'})).rejects.toThrow();
        await interrupted;
        if (outcome === 'no-primary') {
          expect(host.request.mock.calls.filter(([r]) => r.resource === '/v1/agents/logout')).toHaveLength(0);
          jest.advanceTimersByTime(5000); await flush();
          expect(sockets).toHaveLength(2);
          sockets[1].welcome(); await flush();
        }
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(command.signal.aborted).toBe(true);
        expect(lifetime.signal.aborted).toBe(false);
        expect(task['operationsInterrupted']).toBe(false);
        expect(cc.taskManager.getTask(data.interactionId)).toBe(task);

        const held = task.hold();
        const observed = held.catch(() => undefined);
        await flush();
        const request = requests.find(r => r.resource === `/v1/tasks/${data.interactionId}/hold`);
        expect(request).toBeDefined();
        deliver(CC_EVENTS.AGENT_CONTACT_HELD, {
          interaction: {...data.interaction, state: 'connected'}});
        await held; await observed;
        expect(task.state.value).toBe('HELD');

        const incoming = jest.fn(); cc.on(TASK_EVENTS.TASK_INCOMING, incoming);
        const fresh = offerRetainedTask(h, 'next-offer').task;
        expect(incoming).toHaveBeenCalledTimes(1);
        expect(incoming).toHaveBeenCalledWith(fresh);
        deliver(CC_EVENTS.AGENT_WRAPUP, {wrapUpRequired: true,
          interaction: {...data.interaction, state: 'wrapUp'}});
        expect(task.data.wrapUpRequired).toBe(true);
        expect(task.autoWrapup.isRunning()).toBe(true);
        jest.advanceTimersByTime(1000); await flush();
        const wrapups = requests.filter(r => r.resource === `/v1/tasks/${data.interactionId}/wrapup`);
        expect(wrapups).toHaveLength(1);
        expect(wrapups[0].body).toEqual({wrapUpReason: 'Done', auxCodeId: 'done'});
        deliver(CC_EVENTS.AGENT_WRAPPEDUP);
        await flush();
      });
    });

  it.each(['register', 'deregister', 'terminal', 'reload'])(
    'T-008 terminalBoundaryEndsTaskLifetime: %s', async boundary => {
      await withGraph(async h => {
        const {cc, sockets, login, flush} = h;
        await login();
        const {task} = offerRetainedTask(h);
        const lifetime = task['recoveryGuard'];
        const pending = task.end();
        const interrupted = expect(pending).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await flush();
        if (boundary === 'register') {
          const register = cc.register();
          await flush(); sockets[1].welcome(); await register;
        } else if (boundary === 'deregister') await cc.deregister();
        else if (boundary === 'terminal') cc['handleRecoveryTerminal']({data: {kind: 'unavailable'}});
        else cc['requireRegionReload']();
        await interrupted;
        expect(lifetime.signal.aborted).toBe(true);
        expect(task['operationsInterrupted']).toBe(true);
        if (boundary === 'register') {
          expect(cc.taskManager['recoveryGuard'].signal).not.toBe(lifetime.signal);
          expect(cc.taskManager['recoveryGuard'].signal.aborted).toBe(false);
          await expect(task.end()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        }
      });
    });

  it.each(['automatic', 'no-prior-station', 'automatic-relogin-disabled', 'session-restore-failed'])(
    'T-008 recoveringCommandsBlockedBeforeIo / postWelcomeStaleTaskDisabledControlsNoEnd: %s', async outcome => {
      await withGraph(async h => {
        const {cc, requests, sockets, login, frame, flush} = h;
        if (outcome !== 'no-prior-station') await login();
        cc.$config.allowAutomatedRelogin = outcome !== 'automatic-relogin-disabled';
        if (outcome === 'session-restore-failed') cc['acceptedStation'].payload.teamId = '';
        const {task, data} = offerRetainedTask(h);
        const controls = task.uiControls;
        const ended = jest.fn(); task.on(TASK_EVENTS.TASK_END, ended);
        const inFlight = task.end();
        const interrupted = expect(inFlight).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await flush();
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        await interrupted;
        expect(task['recoveryGuard'].signal.aborted).toBe(true);
        const assertFenced = async () => {
          const count = requests.length;
          for (const command of [() => task.end(), () => task.hold(),
            () => task.transfer({to: 'agent-2', destinationType: 'agent'}),
            () => task.wrapup({wrapUpReason: 'Done', auxCodeId: 'done'})]) {
            await expect(command()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
          }
          expect(requests).toHaveLength(count);
          expect(cc.taskManager.getTask(data.interactionId)).toBe(task);
        };
        await assertFenced();
        jest.advanceTimersByTime(100001); await flush();
        expect(sockets).toHaveLength(1);
        await assertFenced();
        jest.advanceTimersByTime(4999); await flush();
        sockets[1].welcome(); await flush();
        if (outcome === 'automatic') {
          const reload = requests.find(r => r.resource === '/v1/agents/reload');
          sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
          await flush();
        } else {
          expect(cc['recoveryPhase']).toBe('manualLoginRequired');
          expect(cc['lastPublishedRegionState'].reason).toBe(outcome === 'no-prior-station' ? 'region-switch' : outcome);
          await assertFenced();
          await login();
        }
        expect(cc['recoveryPhase']).toBe('ready');
        const disableLeg = leg => Object.fromEntries(Object.entries(leg).map(([key, value]) =>
          [key, {...value as object, isEnabled: false}]));
        expect(task.uiControls).toEqual({...controls, main: disableLeg(controls.main), consult: disableLeg(controls.consult)});
        expect(task.stateMachineService).toBeUndefined();
        expect(ended).not.toHaveBeenCalled();
        const count = requests.length;
        await expect(task.end()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        await expect(task.hold()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        expect(requests).toHaveLength(count);
        const replacement = offerRetainedTask(h).task;
        expect(replacement).not.toBe(task);
        expect(replacement['recoveryGuard'].signal.aborted).toBe(false);
      });
    });

  it.each([
    [LoginOption.BROWSER, LoginOption.EXTENSION],
    [LoginOption.EXTENSION, LoginOption.BROWSER],
    [LoginOption.BROWSER, LoginOption.BROWSER],
  ])('T-007 failedStationLoginPreservesAcceptedDeviceAndVoiceState %s -> %s', async (acceptedMode, attemptedMode) => {
    await withGraph(async ({cc, login, flush}) => {
      const calling = cc.webCallingService;
      cc.agentConfig.webRtcEnabled = true;
      const initialLine = jest.spyOn(calling, 'registerWebCallingLine').mockResolvedValue(undefined);
      await login(acceptedMode);
      initialLine.mockRestore();
      const line = {deregister: jest.fn().mockResolvedValue(undefined)};
      if (acceptedMode === LoginOption.BROWSER) {
        calling['line'] = line;
        calling['handleLineRegistered'](line);
      }
      const accepted = cc['acceptedStation'];
      const replace = jest.spyOn(calling, 'registerWebCallingLine');
      const backend = createDeferred<any>();
      jest.spyOn(cc.services.agent, 'stationLogin').mockReturnValueOnce(backend.promise);
      const stateChange = jest.spyOn(cc.services.agent, 'stateChange').mockResolvedValue({data: {}});
      const pending = cc.stationLogin({teamId: 'attempted-team', loginOption: attemptedMode, dialNumber: '5678'});
      const rejection = expect(pending).rejects.toBeInstanceOf(Error);
      const assertAcceptedCalling = async () => {
        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc.agentConfig.currentTeamId).toBe('team');
        expect(cc.agentConfig.deviceType).toBe(acceptedMode);
        expect(calling.loginOption).toBe(acceptedMode);
        expect(calling.isBrowserVoiceRequired()).toBe(acceptedMode === LoginOption.BROWSER);
        expect(calling.isVoiceReady()).toBe(acceptedMode === LoginOption.BROWSER);
        expect(replace).not.toHaveBeenCalled();
        expect(line.deregister).not.toHaveBeenCalled();
        if (acceptedMode === LoginOption.BROWSER) expect(calling['line']).toBe(line);
        const call = {getCallId: () => 'incoming-call'};
        cc.taskManager['call'] = undefined;
        cc.taskManager['handleIncomingWebCall'](call);
        expect(cc.taskManager['call']).toBe(acceptedMode === LoginOption.BROWSER ? call : undefined);
        await cc.setAgentState({state: 'Available', auxCodeId: '0'});
      };
      await flush();
      await assertAcceptedCalling();
      backend.reject(new Error('replacement login rejected'));
      await rejection;
      await assertAcceptedCalling();
      expect(stateChange).toHaveBeenCalledTimes(2);
      if (acceptedMode === LoginOption.BROWSER) {
        calling['handleLineUnregistered']();
        await expect(cc.setAgentState({state: 'Available', auxCodeId: '0'}))
          .rejects.toThrow(VOICE_CONNECTION_ERROR.NOT_READY);
        expect(stateChange).toHaveBeenCalledTimes(2);
      }
      replace.mockRestore(); stateChange.mockRestore();
    });
  });

  it.each([false, true])(
    'T-009 manualDrLoginInvalidatesBeforeDispatchAndCallingPreparation: priorStation=%s', async priorStation => {
      await withGraph(async h => {
        const {cc, requests, sockets, login, frame, flush} = h;
        if (priorStation) await login();
        const {task} = offerRetainedTask(h);
        const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'manual-switch'});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        expect(cc['recoveryPhase']).toBe('manualLoginRequired');
        expect(cleanup).not.toHaveBeenCalled();
        expect(cc.taskManager.getTask(task.data.interactionId)).toBe(task);
        cc.agentConfig.webRtcEnabled = true;
        const calling = cc.webCallingService;
        const dispatch = jest.spyOn(cc.services.agent, 'stationLogin');
        const prepare = jest.spyOn(calling, 'setLoginOption');
        const voiceGate = jest.spyOn(calling, 'setBrowserVoiceRequired');
        const ensure = jest.spyOn(calling, 'ensureWebCallingLine').mockResolvedValue(undefined);
        const replace = jest.spyOn(calling, 'registerWebCallingLine');
        try {
          const pending = cc.stationLogin({teamId: 'team', loginOption: LoginOption.BROWSER});
          const observed = pending.catch(() => undefined);
          await flush();
          expect(cleanup).toHaveBeenCalledTimes(1);
          expect(cc.taskManager.getAllTasks()).toEqual({});
          await expect(task.end()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
          expect(dispatch).toHaveBeenCalledTimes(1);
          expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(dispatch.mock.invocationCallOrder[0]);
          const request = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
          sockets[1].message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, request.headers.trackingid,
            {deviceType: LoginOption.BROWSER, isExtension: false}), type: CC_EVENTS.AGENT_STATION_LOGIN});
          await pending; await observed; await flush();
          expect(prepare).toHaveBeenCalledWith(LoginOption.BROWSER);
          expect(voiceGate).toHaveBeenCalledWith(true);
          expect(ensure).toHaveBeenCalledTimes(1);
          for (const boundary of [prepare, voiceGate, ensure]) {
            expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(boundary.mock.invocationCallOrder[0]);
          }
          expect(replace).not.toHaveBeenCalled();
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
          expect(cleanup).toHaveBeenCalledTimes(1);
        } finally {
          cleanup.mockRestore(); dispatch.mockRestore(); prepare.mockRestore();
          voiceGate.mockRestore(); ensure.mockRestore(); replace.mockRestore();
        }
      });
    }
  );

  it('T-007 accepted calling mode commits before replacement line registration settles', async () => {
    await withGraph(async ({cc, login, flush, frame}) => {
      await login();
      cc.agentConfig.webRtcEnabled = true;
      const backend = createDeferred<any>();
      const line = createDeferred<void>();
      const calling = cc.webCallingService;
      const replace = jest.spyOn(calling, 'registerWebCallingLine').mockReturnValueOnce(line.promise);
      jest.spyOn(cc.services.agent, 'stationLogin').mockReturnValueOnce(backend.promise);
      const pending = cc.stationLogin({teamId: 'requested-team', loginOption: LoginOption.BROWSER});
      const settled = jest.fn(); pending.then(settled, settled);
      await flush();
      expect(calling.loginOption).toBe(LoginOption.EXTENSION);
      expect(calling.isBrowserVoiceRequired()).toBe(false);
      expect(replace).not.toHaveBeenCalled();
      backend.resolve(frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, 'accepted-login', {teamId: 'accepted-team'}));
      await flush();
      expect(cc['acceptedStation'].payload.teamId).toBe('accepted-team');
      expect(cc.agentConfig.currentTeamId).toBe('accepted-team');
      expect(calling.loginOption).toBe(LoginOption.BROWSER);
      expect(calling.isBrowserVoiceRequired()).toBe(true);
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      expect(replace).toHaveBeenCalledTimes(1);
      expect(settled).not.toHaveBeenCalled();
      line.resolve(); await pending;
      replace.mockRestore();
    });
  });

  it.each(['open', 'welcome', 'http'].flatMap(phase => [false, true].flatMap(voiceReady =>
    [false, true].map(success => [phase, voiceReady, success] as const))))(
    'T-002/T-010 rtdPauseCloseBeforeRecovering phase=%s voiceReady=%s lateSuccess=%s',
    async (phase, voiceReady, success) => {
      await withGraph(async h => {
        const {cc, sockets, requests, flush} = h;
        const barrier = await prepareRtdPublicationBarrier(h, phase, voiceReady);
        const publications = jest.fn(state => barrier.record(state));
        cc.on('region:stateChange', publications);
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const requestCount = requests.length; const socketCount = sockets.length;
        primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'});

        // Only record inside observers: publication deliberately catches consumer exceptions.
        expect(barrier.records.map(r => [r.state.status, r.state.autoAvailable])).toEqual([
          ['ready', 'cancelled'], ['recovering', undefined], ['recovering', undefined],
        ]);
        const {servingRegion, limitedService, ...ready} = barrier.ready;
        expect(barrier.records[0].state).toEqual({...ready, autoAvailable: 'cancelled'});
        barrier.expectPublications(publications);
        expect(barrier.summarySettled).not.toHaveBeenCalled();
        await flush();
        await barrier.expectInterrupted();
        const owner = lifecycleOwner(cc);
        const current = barrier.currentOwner();

        jest.advanceTimersByTime(50000); await flush();
        await barrier.releaseLate(success);
        jest.advanceTimersByTime(49999); await flush();
        barrier.replayCallbacks();
        jest.advanceTimersByTime(1); await flush(); // Complete the entire initial 100-second window.
        barrier.replayCallbacks(); await flush();
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(barrier.currentOwner()).toEqual(current);
        expect(requests).toHaveLength(requestCount);
        expect(sockets).toHaveLength(socketCount);
        expect(publications).toHaveBeenCalledTimes(3);
        barrier.expectOldOwnerInert();
      }, undefined, {enabled: true});
    }
  );

  const deferAutomaticStationRestore = async ({cc, host, requests, sockets, frame, flush}: any) => {
    expect(cc.$config.allowAutomatedRelogin).toBe(true);
    expect(cc['acceptedStation'].sessionId).toBe('session');
    const backend = createDeferred<any>();
    const boundary = host.request.getMockImplementation();
    host.request.mockImplementation(request => {
      if (request.resource === '/v1/agents/reload') {
        requests.push(request);
        return backend.promise;
      }
      return boundary(request);
    });
    const oldPrimary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
    oldPrimary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'automatic-rtd-switch'});
    jest.advanceTimersByTime(105000); await flush();
    const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
    expect(primary).not.toBe(oldPrimary);
    primary.welcome(); await flush();
    const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
    expect(cc['recoveryPhase']).toBe('restoringSession');

    return {primary, reload, accept: async (station = {}) => {
      backend.resolve({statusCode: 200, body: {}}); await flush();
      primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
        {agentSessionId: 'restored-session', ...station}));
      await flush();
    }};
  };

  // Composes the local TaskManager.ts case with the real Station snapshot/restoration owner.
  it('T-008 postCleanupHydrateCreatesFreshTaskRetainedStaysStale station-linked', async () => {
    await withGraph(async h => {
      const {cc, graph, requests, login, flush} = h;
      await login();
      const manager = cc.taskManager;
      const {task: retained, data, deliver} = offerRetainedTask(h);
      const oldActor = retained.stateMachineService;
      const oldGuard = retained['recoveryGuard'];
      const accepted = cc['acceptedStation'];
      const stationState = () => ({
        accepted: cc['acceptedStation'], session: cc['currentAgentSessionId'],
        active: cc['priorStationActive'], revision: cc['stationRevision'],
        profile: {loggedIn: cc.agentConfig.isAgentLoggedIn, team: cc.agentConfig.currentTeamId,
          device: cc.agentConfig.deviceType, dn: cc.agentConfig.dn, defaultDn: cc.agentConfig.defaultDn,
          auxCode: cc.agentConfig.lastStateAuxCodeId, stateTime: cc.agentConfig.lastStateChangeTimestamp,
          idleTime: cc.agentConfig.lastIdleCodeChangeTimestamp},
      });
      const initialStation = stationState();
      expect(accepted).toEqual({orgId: 'org', agentId: 'agent', sessionId: 'session',
        revision: initialStation.revision, payload: {teamId: 'team', deviceType: 'EXTENSION',
          dialNumber: '1234', deviceId: '1234', isExtension: true, roles: ['agent'], teamName: '',
          siteId: '', usesOtherDN: false, auxCodeId: ''}});
      expect(oldGuard).toBe(manager['recoveryGuard']);
      expect(retained.uiControls.main.hold.isEnabled).toBe(true);
      const controls = jest.fn(); retained.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, controls);
      const terminal = jest.fn();
      for (const owner of [cc, manager, retained]) {
        owner.on(TASK_EVENTS.TASK_END, terminal);
        owner.on(TASK_EVENTS.TASK_WRAPPEDUP, terminal);
      }
      const cleanupStations: ReturnType<typeof stationState>[] = [];
      const invalidate = manager.invalidateRegionalTasks.bind(manager);
      const cleanup = jest.spyOn(manager, 'invalidateRegionalTasks').mockImplementation(() => {
        cleanupStations.push(stationState());
        invalidate();
        cleanupStations.push(stationState());
      });
      const readyStations: ReturnType<typeof stationState>[] = [];
      const trace: string[] = [];
      const applications: Array<{phase: string; station: ReturnType<typeof stationState>}> = [];
      const apply = cc['applyRestoredStationEffects'].bind(cc);
      jest.spyOn(cc, 'applyRestoredStationEffects').mockImplementation(async (...args) => {
        applications.push({phase: cc['recoveryPhase'], station: stationState()});
        await apply(...args);
        trace.push('station-applied');
      });
      cc.on('region:stateChange', state => {
        if (state.status === 'ready') { readyStations.push(stationState()); trace.push('ready'); }
      });

      const restore = await deferAutomaticStationRestore(h);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(cleanupStations).toEqual([initialStation, initialStation]);
      cleanupStations.forEach(station => expect(station.accepted).toBe(accepted));
      expect(stationState()).toEqual(initialStation);
      expect(manager.getAllTasks()).toEqual({});
      expect(oldActor.getSnapshot().status).toBe('stopped');
      expect(retained.stateMachineService).toBeUndefined();
      expect(oldGuard.signal.aborted).toBe(true);
      expect(controls).toHaveBeenCalledTimes(1);
      expect(readyStations).toEqual([]);
      expect(applications).toEqual([]);
      expect(cc.services.aqmReqs['recoveryGate'].state).toBe('recovering');

      const hydrated = jest.fn();
      const publishedGuards: unknown[] = [];
      cc.on(TASK_EVENTS.TASK_HYDRATE, task => {
        hydrated(task);
        publishedGuards.push(task['recoveryGuard'], manager['recoveryGuard']);
      });
      const replacement = {...data, type: CC_EVENTS.AGENT_CONTACT, trackingId: 'replacement-hydrate',
        interaction: {...data.interaction, state: 'connected'}};
      restore.primary.message({type: 'RoutingMessage', data: replacement});
      const fresh = manager.getTask(data.interactionId);
      expect(fresh).toBeInstanceOf(graph.Task);
      expect(fresh).not.toBe(retained);
      expect(fresh.stateMachineService).not.toBe(oldActor);
      expect(fresh.state.value).toBe('CONNECTED');
      expect(fresh.stateMachineService.getSnapshot().context.taskData).toMatchObject(replacement);
      const liveGuard = manager['recoveryGuard'];
      expect(liveGuard).not.toBe(oldGuard);
      expect(liveGuard.signal.aborted).toBe(false);
      expect(liveGuard.generation).toBe(cc['recoveryGeneration']);
      expect(fresh['recoveryGuard']).toBe(liveGuard);
      expect(publishedGuards).toHaveLength(2);
      publishedGuards.forEach(guard => expect(guard).toBe(liveGuard));
      expect(hydrated.mock.calls).toEqual([[fresh]]);
      expect(Object.values(manager.getAllTasks())).toEqual([fresh]);
      fresh.on(TASK_EVENTS.TASK_END, terminal);
      fresh.on(TASK_EVENTS.TASK_WRAPPEDUP, terminal);
      await expect(fresh.hold()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
      await expect(fresh.end()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});

      // Exercise the real automatic accept path on an eligible digital offer while reload is pending.
      const autoData = createAISummaryLifecycleTaskData({interactionId: 'replacement-auto-answer',
        agentId: 'agent', orgId: 'org', type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        interaction: {mediaType: 'chat', state: 'new'} as any});
      restore.primary.message({type: 'RoutingMessage', data: autoData});
      const autoTask = manager.getTask(autoData.interactionId);
      expect(autoTask['uiControlConfig'].channelType).toBe(TASK_CHANNEL_TYPE.DIGITAL);
      expect(autoTask['recoveryGuard']).toBe(liveGuard);
      const autoAccept = jest.spyOn(autoTask, 'accept');
      const autoAnswered = jest.fn(); autoTask.on(TASK_EVENTS.TASK_AUTO_ANSWERED, autoAnswered);
      const offer = {...autoData, type: CC_EVENTS.AGENT_OFFER_CONTACT, isAutoAnswering: true};
      restore.primary.message({type: 'RoutingMessage', data: offer});
      await flush();
      expect(autoTask.data.isAutoAnswering).toBe(true);
      expect(autoAccept).toHaveBeenCalledTimes(1);
      expect(autoAnswered).not.toHaveBeenCalled();
      expect(requests.filter(r => r.resource.startsWith('/v1/tasks/'))).toEqual([]);
      expect(stationState()).toEqual(initialStation);
      expect(cc['recoveryPhase']).toBe('restoringSession');
      expect(applications).toEqual([]);
      expect(readyStations).toEqual([]);

      const assertRetainedStale = async () => {
        const count = requests.length;
        for (const action of [() => retained.hold(), () => retained.end(),
          () => retained.transfer({to: 'other-agent', destinationType: 'agent'}),
          () => retained.wrapup({wrapUpReason: 'Done', auxCodeId: 'done'})]) {
          await expect(action()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        }
        for (const leg of [retained.uiControls.main, retained.uiControls.consult])
          expect(Object.values(leg).every((control: any) => !control.isEnabled)).toBe(true);
        expect(retained.stateMachineService).toBeUndefined();
        expect(requests).toHaveLength(count);
        expect(terminal).not.toHaveBeenCalled();
      };
      await assertRetainedStale();
      await restore.accept({teamId: 'restored-team', dn: '5678', auxCodeId: 'restored-idle',
        lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3});
      const restoredStation = stationState();
      expect(restoredStation).toEqual({...initialStation, session: 'restored-session',
        accepted: {...accepted, sessionId: 'restored-session', payload: {...accepted.payload,
          teamId: 'restored-team', dialNumber: '5678', deviceId: '5678'}},
        profile: {...initialStation.profile, team: 'restored-team', dn: '5678', defaultDn: '5678',
          auxCode: 'restored-idle', stateTime: 2, idleTime: 3}});
      expect(restoredStation.accepted).not.toBe(accepted);
      expect(applications).toEqual([{phase: 'restoringSession', station: restoredStation}]);
      expect(readyStations).toEqual([restoredStation]);
      expect(trace).toEqual(['station-applied', 'ready']);
      expect(cc['recoveryPhase']).toBe('ready');
      expect(cc.services.aqmReqs['recoveryGate']).toEqual({state: 'open'});
      expect(manager['recoveryGuard']).toBe(liveGuard);
      expect(fresh['recoveryGuard']).toBe(liveGuard);
      expect(autoAccept).toHaveBeenCalledTimes(1); // The blocked offer is never replayed on ready.

      const held = fresh.hold(); const observed = held.catch(() => undefined);
      await flush();
      expect(requests.filter(r => r.resource === `/v1/tasks/${data.interactionId}/hold`)).toHaveLength(1);
      deliver(CC_EVENTS.AGENT_CONTACT_HELD, {interaction: replacement.interaction});
      await held; await observed;
      expect(fresh.state.value).toBe('HELD');
      restore.primary.message({type: 'RoutingMessage', data: offer});
      await flush();
      expect(autoAccept).toHaveBeenCalledTimes(2);
      expect(requests.filter(r => r.resource === `/v1/tasks/${autoData.interactionId}/accept`)).toHaveLength(1);
      restore.primary.message({type: 'RoutingMessage', data: {...autoData,
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED, interaction: {...autoData.interaction, state: 'connected'}}});
      await flush();
      expect(autoAnswered.mock.calls).toEqual([[autoTask]]);
      expect(hydrated.mock.calls).toEqual([[fresh]]);
      expect(manager.getTask(data.interactionId)).toBe(fresh);
      expect(cleanup).toHaveBeenCalledTimes(1);
      await assertRetainedStale();
      expect(controls).toHaveBeenCalledTimes(1);
    }, undefined, {}, {allowAutomatedRelogin: true});
  });

  it('hydrates wxApp mute during restoringSession and unmutes on the first ready toggle', async () => {
    await withGraph(async h => {
      const {cc, graph, login, flush} = h;
      await login();
      const {task: retained, data} = offerRetainedTask(h, 'restored-wxapp-task');
      cc.$config.enableWxBetterTogether = true;
      cc.taskManager.setConfigFlags({...cc.taskManager['configFlags'], enableWxBetterTogether: true});
      // Keep the external session integrations at their boundary; use the real station
      // application, TaskManager hydration, Voice backfill and command admission.
      jest.spyOn(cc, 'ensureWxAppMercuryAndSubscribe').mockResolvedValue(undefined);
      jest.spyOn(cc, 'publishAnswerOnWebexCrossClientState').mockResolvedValue(undefined);
      const phases: string[] = [];
      const details = jest.spyOn(cc['answerCallOnWebexService'], 'getCallDetails').mockImplementation(async () => {
        phases.push(cc['recoveryPhase']);
        return {muted: true};
      });
      const mute = jest.spyOn(cc['answerCallOnWebexService'], 'muteCall').mockResolvedValue(undefined);
      const unmute = jest.spyOn(cc['answerCallOnWebexService'], 'unmuteCall').mockResolvedValue(undefined);
      const restoration = await deferAutomaticStationRestore(h);
      restoration.primary.message({type: 'RoutingMessage', data: {
        ...data, type: CC_EVENTS.AGENT_CONTACT,
        interaction: {...data.interaction, state: 'connected', participants: {
          agent: {id: 'agent', deviceType: 'wxApp', deviceId: 'device-1', deviceCallId: 'call-1'},
        }},
      }});
      await flush();
      const restored = cc.taskManager.getTask(data.interactionId);
      expect(restored).toBeInstanceOf(graph.Task);
      expect(restored.constructor.name).toBe('Voice');
      expect(restored).not.toBe(retained);
      expect(restored.state.value).toBe('CONNECTED');
      expect(cc['recoveryPhase']).toBe('restoringSession');
      expect(details.mock.calls).toEqual([[{callId: 'call-1', lineOwnerId: undefined}]]);
      expect(restored.getWxAppMuted()).toBe(true);
      await expect(restored.toggleMute()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
      expect(mute).not.toHaveBeenCalled();
      expect(unmute).not.toHaveBeenCalled();

      await restoration.accept();
      expect(cc['recoveryPhase']).toBe('ready');
      // The post-station batch backfill also runs before ready, with no ready-time retry.
      expect(phases).toEqual(['restoringSession', 'restoringSession']);
      expect(restored.getWxAppMuted()).toBe(true);
      await restored.toggleMute();
      expect(unmute.mock.calls).toEqual([[{callId: 'call-1', lineOwnerId: undefined}]]);
      expect(mute).not.toHaveBeenCalled();
      expect(restored.getWxAppMuted()).toBe(false);
      await expect(retained.syncWxAppMuteFromCallDetails()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
      expect(details).toHaveBeenCalledTimes(2);
    }, undefined, {}, {allowAutomatedRelogin: true});
  });

  it.each([
    {stage: 'device', rejects: false},
    {stage: 'Mercury', rejects: false},
    {stage: 'Mercury', rejects: true},
    {stage: 'usersub', rejects: false},
    {stage: 'usersub', rejects: true},
    {stage: 'disabled usersub', rejects: false},
    {stage: 'cleanup', rejects: false},
  ])('ignores cancelled regional wxApp $stage completion (rejects=$rejects)', async ({stage, rejects}) => {
    await withGraph(async h => {
      const {cc, host, login, flush} = h;
      await login();
      const enableWxBetterTogether = stage !== 'disabled usersub';
      cc.$config.enableWxBetterTogether = enableWxBetterTogether;

      const pending = createDeferred<{statusCode: number; body: object}>();
      const device = {
        registered: false,
        userId: 'agent',
        url: 'https://wdm.example.com/devices/device',
        register: jest.fn(async () => {
          if (stage === 'device') await pending.promise;
          device.registered = true;
        }),
        unregister: jest.fn(),
      };
      const mercury = Object.assign(new EventEmitter(), {
        connected: false,
        connect: jest.fn(async () => {
          if (stage === 'Mercury') await pending.promise;
          mercury.connected = true;
        }),
        disconnect: jest.fn(async () => {
          if (stage === 'cleanup') await pending.promise;
          mercury.connected = false;
        }),
      });
      host.internal.device = device;
      host.internal.mercury = mercury;

      const crossClient = cc['webexCrossClientService'];
      if (!enableWxBetterTogether) {
        await crossClient.setManageWebexCallingInWxcc(true);
        expect(crossClient.isAnswerCallsStateActive()).toBe(true);
      }
      const publish = jest.fn(() => {
        if (stage === 'cleanup') return Promise.reject(new Error('usersub publish failed'));

        return pending.promise;
      });
      const request = host.request.getMockImplementation();
      host.request.mockImplementation(options => (
        options.service === 'usersub' ? publish() : request(options)
      ));
      const sync = cc['wxAppTelephonyMercurySync'];
      const subscribe = jest.spyOn(sync, 'subscribe');
      const unsubscribe = jest.spyOn(sync, 'unsubscribe');
      const teardown = jest.spyOn(crossClient, 'teardown');
      const syncMute = jest.spyOn(cc.taskManager, 'applyWxAppMuteStateFromSync');
      const hydrateMute = jest.spyOn(cc.taskManager, 'syncWxAppMuteFromCallDetailsForAllTasks');
      const resetFlag = jest.spyOn(cc, 'resetEnableWxBetterTogetherConfig');

      const restore = await deferAutomaticStationRestore(h);
      const {signal} = cc['sessionRequest'].owner;
      await restore.accept();
      expect(cc['recoveryPhase']).toBe('restoringSession');
      const suspended = {
        device: device.register,
        Mercury: mercury.connect,
        usersub: publish,
        'disabled usersub': publish,
        cleanup: mercury.disconnect,
      };
      expect(suspended[stage]).toHaveBeenCalledTimes(1);

      restore.primary.lost();
      await flush();
      expect(signal.aborted).toBe(true);
      const subscriptions = subscribe.mock.calls.length;
      const unsubscriptions = unsubscribe.mock.calls.length;
      const publishes = publish.mock.calls.length;

      if (rejects) pending.reject(new Error('obsolete session failed'));
      else pending.resolve({statusCode: 200, body: {}});
      await flush();
      mercury.emit('event:telephony_calls.muted', {data: {actorId: 'agent', callId: 'call-id', muted: true}});

      expect(subscribe).toHaveBeenCalledTimes(subscriptions);
      expect(unsubscribe).toHaveBeenCalledTimes(unsubscriptions);
      expect(publish).toHaveBeenCalledTimes(publishes);
      expect(teardown).not.toHaveBeenCalled();
      expect(syncMute).not.toHaveBeenCalled();
      expect(hydrateMute).not.toHaveBeenCalled();
      expect(resetFlag).not.toHaveBeenCalled();
      expect(cc.isWxBetterTogetherEnabled()).toBe(enableWxBetterTogether);
      expect(crossClient.isAnswerCallsStateActive()).toBe(!enableWxBetterTogether);
      expect(device.unregister).not.toHaveBeenCalled();
      if (stage === 'device') {
        expect(cc['wxAppDeviceRegisteredByCc']).toBe(false);
        expect(mercury.connect).not.toHaveBeenCalled();
      }
      if (stage === 'Mercury') expect(cc['wxAppMercuryConnectedByCc']).toBe(false);
      if (stage === 'cleanup') expect(cc['wxAppMercuryConnectedByCc']).toBe(true);
      else expect(mercury.disconnect).not.toHaveBeenCalled();
    }, undefined, {}, {allowAutomatedRelogin: true});
  });

  it('T-010 restoredSessionResumesRtd after ready with fresh enablement for the restored Task', async () => {
    await withGraph(async h => {
      const {cc, graph, host, sockets, requests, login, flush} = h;
      await login();
      const old = sockets.find(s => s.url.includes('rtd.')); old.welcome(); await flush();
      const oldSocketMessage = old.onmessage;
      const stored = cc.services.rtdWebSocketManager.listeners('message')[0];
      expect(stored).toBe(cc['handleRTDWebsocketMessage']);
      const registration = cc['registrationAbortController'];
      const oldEpoch = cc['rtdEpoch'];
      const {task: previous, data} = offerRetainedTask(h, 'restored-rtd-task');
      const enablement = {interactionId: data.interactionId,
        postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1};
      const featureFrame = {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: enablement}};
      const transcriptFrame = {type: CC_EVENTS.REAL_TIME_TRANSCRIPTION,
        data: {data: {conversationId: data.interactionId}}};
      old.message(featureFrame);
      expect(previous.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
      const oldFeature = jest.fn(); previous.on(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, oldFeature);
      const oldTranscript = jest.fn(); previous.on(CC_EVENTS.REAL_TIME_TRANSCRIPTION, oldTranscript);
      const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      const trace: string[] = [];
      const readyObservations: Array<{admissions: number; epoch: unknown}> = [];
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource === 'v1/realtime/subscribe') trace.push('rtd-admission');
        return boundary(request);
      });
      cc.on('region:stateChange', state => {
        if (state.status === 'ready') {
          trace.push('ready');
          readyObservations.push({admissions: requests.filter(r => r.resource === 'v1/realtime/subscribe').length,
            epoch: cc['rtdEpoch']});
        }
      });
      const application = createDeferred<void>();
      jest.spyOn(cc, 'ensureWxAppPostStationLogin').mockReturnValueOnce(application.promise);
      const restore = await deferAutomaticStationRestore(h);
      expect(cc['rtdPaused']).toBe(true);
      expect(oldEpoch.controller.signal.aborted).toBe(true);
      expect(old.close).toHaveBeenCalledTimes(1);
      delivered.mockClear();
      // Invoke the saved ContactCenter callback directly, bypassing socket filtering.
      stored(JSON.stringify(featureFrame));
      stored(JSON.stringify(transcriptFrame));
      expect(delivered).not.toHaveBeenCalled();
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
      expect(trace).toEqual([]);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      await restore.accept();
      expect(cc['acceptedStation'].sessionId).toBe('restored-session');
      expect(cc['lastPublishedRegionState'].status).toBe('recovering');
      expect(trace).toEqual([]);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      application.resolve(); await flush();
      expect(trace).toEqual(['ready', 'rtd-admission']);
      expect(readyObservations).toEqual([{admissions: 1, epoch: undefined}]);
      const epoch = cc['rtdEpoch'];
      expect(epoch).not.toBe(oldEpoch);
      expect(epoch.parent).toBe(registration.signal);
      expect(epoch.registration).toBe(cc['registrationGeneration']);
      expect(epoch.station).toBe(cc['stationRevision']);
      expect(epoch.sessionId).toBe('restored-session');
      expect(epoch.sessionId).toBe(cc['currentAgentSessionId']);
      expect(epoch.controller.signal.aborted).toBe(false);
      expect(cc['sessionRequest']).toBeUndefined();
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
      expect(current).not.toBe(old);
      current.welcome(); await epoch.promise; await flush();
      expect(cc['rtdPaused']).toBe(false);
      expect(cc.services.rtdWebSocketManager.listeners('message')).toEqual([stored]);
      const hydrate = jest.fn(); cc.on(TASK_EVENTS.TASK_HYDRATE, hydrate);
      restore.primary.message({type: 'RoutingMessage', data: {...data, type: CC_EVENTS.AGENT_CONTACT,
        interaction: {...data.interaction, state: 'connected'}}});
      const task = cc.taskManager.getTask(data.interactionId);
      expect(task).toBeInstanceOf(graph.Task);
      expect(task).not.toBe(previous);
      expect(hydrate).toHaveBeenCalledTimes(1);
      expect(hydrate).toHaveBeenCalledWith(task);
      expect(cc.agentConfig.aiFeature.generatedSummaries).toEqual({
        wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true});
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
      const feature = jest.fn(); task.on(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, feature);
      const transcript = jest.fn(); task.on(CC_EVENTS.REAL_TIME_TRANSCRIPTION, transcript);
      delivered.mockClear();
      // Retain the old native callback too: disposal must not be the only stale-socket fence.
      for (const frame of [featureFrame, transcriptFrame]) {
        old.message(frame);
        oldSocketMessage({data: JSON.stringify(frame)});
      }
      expect(delivered).not.toHaveBeenCalled();
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
      current.message(featureFrame); current.message(transcriptFrame);
      expect(delivered).toHaveBeenCalledTimes(2);
      expect(feature).toHaveBeenCalledTimes(1);
      expect(feature).toHaveBeenCalledWith(enablement);
      expect(transcript).toHaveBeenCalledTimes(1);
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
      expect(oldFeature).not.toHaveBeenCalled();
      expect(oldTranscript).not.toHaveBeenCalled();
      await cc['resumeRtd'](registration.signal);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
    }, undefined, {enabled: true}, {allowAutomatedRelogin: true});
  });

  it.each([
    ['transcripts', {realtimeTranscripts: {enable: true}}, false],
    ['suggestions', {suggestedResponses: {enable: true}}, false],
    ['post-call summary', {generatedSummaries: {wrapUpSummariesEnabled: true}}, false],
    ['mid-call summary', {generatedSummaries: {consultTransferSummariesEnabled: true}}, false],
    ['wellness', {}, true],
    ['disabled', {}, false],
  ])('T-010 allFiveFeatureConditions / freshRtdAdmissionAfterSession: %s', async (name, aiFeature, wellness) => {
    const initiallyEnabled = name === 'disabled';
    await withGraph(async h => {
      const {cc, sockets, requests, flush} = h;
      const initial = cc.agentConfig;
      const initialAdmissions = initiallyEnabled ? 1 : 0;
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(initialAdmissions);
      if (initiallyEnabled) { sockets.find(s => s.url.includes('rtd.')).welcome(); await flush(); }
      const restore = await deferAutomaticStationRestore(h);
      // No profile refetch occurs in DR; subscription policy must read the current complete Profile.
      cc.agentConfig = {...initial, aiFeature, isWellnessBreakEnabled: wellness};
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(initialAdmissions);
      await restore.accept();
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      expect(requests.filter(r => r.resource.endsWith('/v2/user/by-ci-user-id/agent/desktop-login'))).toHaveLength(1);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      if (initiallyEnabled) {
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(1);
        expect(cc['rtdPaused']).toBe(true);
      } else {
        const epoch = cc['rtdEpoch'];
        expect(epoch.parent).toBe(cc['registrationAbortController'].signal);
        const rtd = sockets.find(s => s.url.includes('rtd.')); rtd.welcome(); await epoch.promise;
        expect(cc['rtdPaused']).toBe(false);
      }
    }, undefined, {aiFeature: initiallyEnabled ? {realtimeTranscripts: {enable: true}} : {}},
    {allowAutomatedRelogin: true});
  });

  it.each([
    ['rtdPaused', true], ['registrationGeneration', -1], ['stationRevision', -1],
    ['currentAgentSessionId', 'obsolete-session'], ['registrationAbortController', new AbortController()],
  ])('T-010 storedRtdCallbackUsesContactCenterEpoch: %s', async (key, mismatch) => {
    await withGraph(async h => {
      const {cc, sockets, flush} = h;
      const old = sockets.find(s => s.url.includes('rtd.')); old.welcome(); await flush();
      const stored = cc.services.rtdWebSocketManager.listeners('message')[0];
      const restore = await deferAutomaticStationRestore(h); await restore.accept();
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
      current.welcome(); await cc['rtdEpoch'].promise;
      expect(cc.services.rtdWebSocketManager.listeners('message')).toEqual([stored]);
      const taskDelivery = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      const wellness = jest.spyOn(cc, 'handleWellnessBreakWebsocketPayload');
      const feature = JSON.stringify({type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
        interactionId: 'guarded-task', postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}});
      const live = cc[key as string];
      try {
        cc[key as string] = mismatch;
        stored(feature);
        stored(JSON.stringify({type: 'Wellness_Break_Handler', data: {}}));
        expect(taskDelivery).not.toHaveBeenCalled();
        expect(wellness).not.toHaveBeenCalled();
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
      } finally { cc[key as string] = live; }
      stored(feature);
      expect(taskDelivery).toHaveBeenCalledTimes(1);
      expect(wellness).toHaveBeenCalledTimes(1);
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
    }, undefined, {enabled: true}, {allowAutomatedRelogin: true});
  });

  it.each([401, 403, 503, 'network'])(
    'T-010 rtdFailureLeavesCoreReady after automatic restore: %s', async failure => {
      await withGraph(async h => {
        const {cc, graph, host, requests, sockets, frame, flush} = h;
        sockets.find(s => s.url.includes('rtd.')).welcome(); await flush();
        const sink = jest.spyOn(graph.LoggerProxy, 'info');
        const admission = createDeferred<any>();
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource === 'v1/realtime/subscribe') {
            requests.push(request);
            return admission.promise;
          }
          return boundary(request);
        });
        const ready = jest.fn(); cc.on('region:stateChange', ready);
        const restore = await deferAutomaticStationRestore(h); await restore.accept();
        const epoch = cc['rtdEpoch'];
        const guard = cc['getHttpRecoveryGuard']();
        const publications = ready.mock.calls.map(([state]) => state);
        expect(guard).toBeDefined();
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        expect(publications.filter(state => state.status === 'ready')).toHaveLength(1);
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
        admission.reject(failure === 'network' ? new Error('network unavailable') : {statusCode: failure});
        await epoch.promise; await flush();
        expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([
          {stage: 'rtd', outcome: 'failed', attempt: 1, elapsedMs: 0,
            ...(failure === 'network' ? {id: 'RTD_NETWORK'} : {status: failure}),
            ...([401, 403].includes(failure as number) ? {reason: 'authentication-failed'} : {})},
        ]);
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        expect(ready.mock.calls.map(([state]) => state)).toEqual(publications);
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(cc['registrationAbortController'].signal.aborted).toBe(false);
        expect(cc['getHttpRecoveryGuard']()).toEqual(guard);
        expect(guard.signal.aborted).toBe(false);
        expect(cc['rtdPaused']).toBe(true);
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(epoch.controller.signal.aborted).toBe(true);
        const command = cc.setAgentState({state: 'Idle', auxCodeId: 'idle'});
        await flush();
        const state = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0];
        const response = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, state.headers.trackingid,
          {agentSessionId: 'restored-session'}), type: CC_EVENTS.AGENT_STATE_CHANGE};
        restore.primary.message(response);
        await expect(command).resolves.toEqual(response);
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
        sink.mockRestore();
      }, undefined, {enabled: true}, {allowAutomatedRelogin: true});
    });

  it('T-010 repeatedRtdPauseResumeKeepsSingleMessageListener and resumeRtdWithActiveEpochIsNoOp', async () => {
    await withGraph(async ({cc, sockets, requests, flush, login, frame}) => {
      let current = sockets.find(s => s.url.includes('rtd.')); current.welcome(); await flush();
      const original = cc['rtdEpoch'];
      const clear = jest.spyOn(cc.taskManager, 'clearAISummaryState');
      const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      const enablement = {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
        interactionId: 'current-task', postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}};
      current.message(enablement);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await login();
        expect(cc['rtdEpoch']).toBe(original);
        expect(original.sessionId).toBe('session');
        expect(original.station).toBe(cc['stationRevision']);
        expect(original.controller.signal.aborted).toBe(false);
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
        current.message(enablement);
      }
      const restored = cc['silentRelogin'](); await flush();
      const reload = requests.find(r => r.resource === '/v1/agents/reload');
      sockets[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await restored;
      expect(cc['rtdEpoch']).toBe(original);
      current.message(enablement);
      expect(delivered).toHaveBeenCalledTimes(4);
      expect(clear).not.toHaveBeenCalled();
      expect(current.close).not.toHaveBeenCalled();
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(1);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
      await cc['resumeRtd'](cc['registrationAbortController'].signal);
      expect(cc['rtdEpoch']).toBe(original);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      for (let cycle = 0; cycle < 3; cycle += 1) {
        cc['pauseRtd'](); const pending = cc['resumeRtd'](cc['registrationAbortController'].signal);
        const same = cc['resumeRtd'](cc['registrationAbortController'].signal); expect(same).toBe(pending);
        await flush(); current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
        current.welcome('rtd'); await pending;
        expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
      }
      cc['terminateRegistration'](); expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
    }, undefined, {enabled: true});
  });

  it.each(['validation', 'backend', 'line', 'wxApp'])('T-010 ordinaryLoginFailurePreservesRtd %s', async failure => {
    await withGraph(async ({cc, host, sockets, requests, flush, login}) => {
      await login();
      const rtd = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
      rtd.welcome(); await flush();
      const epoch = cc['rtdEpoch'];
      const subscribeCount = requests.filter(r => r.resource === 'v1/realtime/subscribe').length;
      const clear = jest.spyOn(cc.taskManager, 'clearAISummaryState');
      const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      let rejected: Promise<unknown>;
      if (failure === 'validation') {
        rejected = cc.stationLogin({teamId: 'team', loginOption: LoginOption.AGENT_DN, dialNumber: ''});
      } else {
        if (failure === 'backend') {
          const boundary = host.request.getMockImplementation();
          host.request.mockImplementation(request => request.resource === '/v1/agents/login'
            ? Promise.reject({statusCode: 400, body: {reason: 'INVALID_LOGIN'}}) : boundary(request));
        } else if (failure === 'line') {
          cc.agentConfig.webRtcEnabled = true;
          jest.spyOn(cc.webCallingService, 'registerWebCallingLine').mockRejectedValueOnce(new Error('line failed'));
        } else jest.spyOn(cc, 'ensureWxAppPostStationLogin').mockRejectedValueOnce(new Error('wxApp failed'));
        rejected = login(failure === 'line' ? LoginOption.BROWSER : LoginOption.EXTENSION);
      }
      // Delivery stays live even while the attempted station request has not settled.
      rtd.message({type: CC_EVENTS.REAL_TIME_TRANSCRIPTION, data: {data: {conversationId: 'current-task'}}});
      expect(delivered).toHaveBeenCalledTimes(1);
      await expect(rejected).rejects.toBeInstanceOf(Error);
      await flush();
      rtd.message({type: CC_EVENTS.SUGGESTED_RESPONSE, data: {data: {conversationId: 'current-task'}}});
      expect(delivered).toHaveBeenCalledTimes(2);
      expect(cc['rtdEpoch']).toBe(epoch);
      expect(epoch.station).toBe(cc['stationRevision']);
      expect(epoch.controller.signal.aborted).toBe(false);
      expect(clear).not.toHaveBeenCalled();
      expect(rtd.close).not.toHaveBeenCalled();
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(subscribeCount);
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(subscribeCount);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
    }, undefined, {enabled: true});
  });

  it.each(['login', 'reload'].flatMap(method => ['http', 'welcome'].map(phase => [method, phase])))
  ('T-010 firstStationBindsPendingRtdAdmission %s %s', async (method, phase) => {
    const admission = createDeferred<any>();
    await withGraph(async ({cc, sockets, requests, flush, login, frame}) => {
      const epoch = cc['rtdEpoch'];
      const detach = jest.spyOn(epoch, 'detach');
      const clear = jest.spyOn(cc.taskManager, 'clearAISummaryState');
      const pending = cc['resumeRtd'](epoch.parent);
      if (method === 'login') await login();
      else {
        const restored = cc['silentRelogin'](); await flush();
        const reload = requests.find(r => r.resource === '/v1/agents/reload');
        sockets[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
        await restored;
      }
      expect(cc['rtdEpoch']).toBe(epoch);
      expect(cc['resumeRtd'](epoch.parent)).toBe(pending);
      expect(epoch.sessionId).toBe('session');
      expect(epoch.controller.signal.aborted).toBe(false);
      expect(clear).not.toHaveBeenCalled();
      expect(detach).not.toHaveBeenCalled();
      if (phase === 'http') {
        admission.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com'}});
        await flush();
      }
      const rtd = sockets.find(s => s.url.includes('rtd.')); rtd.welcome(); await pending;
      expect(cc['rtdPaused']).toBe(false);
      expect(epoch.active).toBe(true);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(1);
      expect(rtd.close).not.toHaveBeenCalled();
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
    }, undefined, {enabled: true, ...(phase === 'http' ? {pending: admission.promise} : {})});
  });

  it.each(['login', 'reload'].flatMap(method => ['success', 'line', 'wxApp'].map(outcome => [method, outcome])))
  ('T-010 acceptedSessionReplacementRestoresRtdBeforeAncillarySettlement %s %s', async (method, outcome) => {
    await withGraph(async ({cc, sockets, requests, flush, login, frame}) => {
      await login();
      const old = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; old.welcome(); await flush();
      const epoch = cc['rtdEpoch'];
      const subscribeCount = requests.filter(r => r.resource === 'v1/realtime/subscribe').length;
      const detach = jest.spyOn(epoch, 'detach');
      const clear = jest.spyOn(cc.taskManager, 'clearAISummaryState');
      const cancel = jest.spyOn(cc.services.rtdWebSocketManager, 'cancelPending');
      const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      jest.spyOn(cc.apiAIAssistant, 'sendEvent').mockResolvedValue(undefined);
      const summary = cc.apiAIAssistant.requestAndWaitForRtd({
        agentId: 'agent', interactionId: 'old-task', correlationId: 'old-task',
        rtdEventType: CC_EVENTS.POST_CALL_SUMMARY, eventType: AIAssistantEventType.CTI_EVENT,
        eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY, timeoutMs: 1000,
        createTimeoutError: () => new Error('summary timeout'),
      });
      const interrupted = expect(summary).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      const ancillary = createDeferred<void>();
      if (outcome === 'line') {
        cc.agentConfig.webRtcEnabled = true;
        jest.spyOn(cc.webCallingService, 'registerWebCallingLine').mockReturnValueOnce(ancillary.promise);
      } else if (outcome === 'wxApp') jest.spyOn(cc, 'ensureWxAppPostStationLogin').mockReturnValueOnce(ancillary.promise);
      const pending = method === 'login'
        ? cc.stationLogin({teamId: 'team', loginOption: outcome === 'line' ? LoginOption.BROWSER : LoginOption.EXTENSION, dialNumber: '1234'})
        : cc['silentRelogin']();
      const settled = jest.fn(); pending.then(settled, settled);
      await flush();
      const enablement = {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
        interactionId: 'old-task', postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}};
      old.message(enablement);
      expect(delivered).toHaveBeenCalledTimes(1);
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
      const request = requests.filter(r => r.resource === `/v1/agents/${method}`).slice(-1)[0];
      const type = method === 'login' ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_SUCCESS;
      const accepted = frame(type, request.headers.trackingid, {
        agentSessionId: 'replacement-session', deviceType: outcome === 'line' ? 'BROWSER' : 'EXTENSION',
      });
      const accept = cc['rememberAcceptedStation'].bind(cc);
      const released: unknown[] = [];
      const committed = jest.spyOn(cc, 'rememberAcceptedStation').mockImplementation(input => {
        accept(input);
        released.push([epoch.controller.signal.aborted, old.readyState,
          cc.apiAIAssistant['pendingRtdRequests'].size, cc.taskManager['pendingFeatureEnablement'].size]);
      });
      sockets[0].message(method === 'login' ? {...accepted, type: CC_EVENTS.AGENT_STATION_LOGIN} : accepted);
      await flush();
      await interrupted;
      expect(committed).toHaveBeenCalledTimes(1);
      expect(released).toEqual([[true, 3, 0, 0]]);
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(detach).toHaveBeenCalledTimes(1);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalledTimes(1);
      expect(old.close).toHaveBeenCalledTimes(1);
      expect(old.readyState).toBe(3);
      expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
      const replacement = cc['rtdEpoch'];
      expect(replacement).not.toBe(epoch);
      expect(replacement.sessionId).toBe('replacement-session');
      expect(replacement.parent).toBe(cc['registrationAbortController'].signal);
      expect(replacement.controller.signal.aborted).toBe(false);
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; current.welcome(); await flush();
      old.message(enablement); expect(delivered).toHaveBeenCalledTimes(1);
      current.message(enablement); expect(delivered).toHaveBeenCalledTimes(2);
      if (outcome !== 'success') {
        expect(settled).not.toHaveBeenCalled();
        ancillary.reject(new Error(`${outcome} failed`));
        await expect(pending).rejects.toBeInstanceOf(Error);
      } else await pending;
      await flush();
      expect(cc['rtdEpoch']).toBe(replacement);
      expect(cc['rtdPaused']).toBe(false);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(subscribeCount + 1);
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(subscribeCount + 1);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
      expect(current.close).not.toHaveBeenCalled();
    }, undefined, {enabled: true});
  });

  it.each(['http', 'welcome'].flatMap(phase => ['resolve', 'reject'].map(outcome => [phase, outcome])))
  ('T-010 sessionReplacementCancelsPendingRtdAdmission %s %s', async (phase, outcome) => {
    const admission = createDeferred<any>();
    await withGraph(async ({cc, host, sockets, requests, flush, login}) => {
      await login();
      cc['pauseRtd']();
      const boundary = host.request.getMockImplementation();
      if (phase === 'http') host.request.mockImplementationOnce(request => {
        if (request.resource !== 'v1/realtime/subscribe') return boundary(request);
        requests.push(request);
        return admission.promise;
      });
      const pending = cc['resumeRtd'](cc['registrationAbortController'].signal);
      const settled = jest.fn(); pending.then(settled);
      const epoch = cc['rtdEpoch']; await flush();
      const old = phase === 'welcome' ? sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0] : undefined;
      const detach = jest.spyOn(epoch, 'detach');
      const count = requests.filter(r => r.resource === 'v1/realtime/subscribe').length;
      await login(LoginOption.EXTENSION, 'replacement-session');
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(settled).toHaveBeenCalledTimes(1);
      expect(detach).toHaveBeenCalledTimes(1);
      const replacement = cc['rtdEpoch'];
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; current.welcome(); await flush();
      if (phase === 'http') {
        if (outcome === 'resolve') admission.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com'}});
        else admission.reject(new Error('obsolete admission failed'));
      } else if (outcome === 'resolve') old.welcome();
      else old.onerror?.();
      await pending; await flush();
      expect(cc['rtdEpoch']).toBe(replacement);
      expect(replacement.active).toBe(true);
      expect(replacement.controller.signal.aborted).toBe(false);
      expect(current.close).not.toHaveBeenCalled();
      if (old) expect(old.close).toHaveBeenCalledTimes(1);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(count + 1);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
    }, undefined, {enabled: true});
  });

  it.each(['http', 'welcome'].flatMap(phase => ['organization', 'station'].flatMap(drift =>
    ['resolve', 'reject'].map(outcome => [phase, drift, outcome]))))
  ('T-010 staleOwnedRtdAdmissionDisposesItsEpoch %s %s %s', async (phase, drift, outcome) => {
    const admission = createDeferred<any>();
    await withGraph(async ({cc, graph, host, sockets, flush}) => {
      const epoch = cc['rtdEpoch'];
      const detach = jest.spyOn(epoch, 'detach');
      const removed = jest.spyOn(epoch.parent, 'removeEventListener');
      const manager = cc.services.rtdWebSocketManager;
      const cancel = jest.spyOn(manager, 'cancelPending');
      const close = jest.spyOn(manager, 'close');
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      expect(manager.hasUsableSocket()).toBe(false);
      expect(manager.listenerCount('message')).toBe(1);
      // Drift without a synchronous lifecycle pause so settlement must dispose this owner.
      if (drift === 'organization') jest.spyOn(host.credentials, 'getOrgId').mockReturnValue('other-org');
      else cc['stationRevision'] += 1;
      expect(cc['rtdEpoch']).toBe(epoch);
      expect(epoch.controller.signal.aborted).toBe(false);
      if (phase === 'http') {
        if (outcome === 'resolve') admission.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com'}});
        else admission.reject(new Error('obsolete admission failed'));
        await flush();
      }
      const rtd = sockets.find(s => s.url.includes('rtd.'));
      if (outcome === 'resolve') rtd.welcome();
      else if (phase === 'welcome') rtd.onerror?.();
      await epoch.promise; await flush();
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(cc['rtdPaused']).toBe(true);
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(epoch.parent.aborted).toBe(drift === 'organization');
      expect(detach).toHaveBeenCalledTimes(1);
      expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(manager.listenerCount('message')).toBe(0);
      expect(manager['attempt']).toBeUndefined();
      expect(cancel).toHaveBeenCalled();
      expect(cancel.mock.calls[0][0].data).toEqual({reason: 'RECOVERY_INTERRUPTED'});
      expect(close).toHaveBeenCalledWith(false, 'regionRecovery');
      expect(manager.shouldReconnect).toBe(false);
      if (outcome === 'resolve') expect(rtd.close).toHaveBeenCalledTimes(1);
      expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([]);
      sink.mockRestore(); removed.mockRestore();
    }, undefined, {enabled: true, ...(phase === 'http' ? {pending: admission.promise} : {})});
  });

  it('T-010 staleRejectedRtdAdmissionPreservesReplacementEpoch', async () => {
    await withGraph(async ({cc, graph, sockets, flush}) => {
      const epoch = cc['rtdEpoch'];
      const old = sockets.find(s => s.url.includes('rtd.'));
      const removed = jest.spyOn(epoch.parent, 'removeEventListener');
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const pause = jest.spyOn(cc, 'pauseRtd');
      cc['pauseRtd']();
      // Install the replacement before the cancelled admission's rejection continuation runs.
      const pending = cc['resumeRtd'](epoch.parent);
      const replacement = cc['rtdEpoch'];
      expect(replacement).not.toBe(epoch);
      await epoch.promise; await flush();
      const manager = cc.services.rtdWebSocketManager;
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
      expect(pause).toHaveBeenCalledTimes(1);
      expect(cc['rtdEpoch']).toBe(replacement);
      expect(replacement.active).toBe(false);
      expect(replacement.controller.signal.aborted).toBe(false);
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(removed).toHaveBeenCalledTimes(1);
      expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(manager['attempt'].signal).toBe(replacement.controller.signal);
      expect(manager.listenerCount('message')).toBe(1);
      expect(old.close).toHaveBeenCalledTimes(1);
      expect(current.close).not.toHaveBeenCalled();
      expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([]);
      current.welcome(); await pending; await flush();
      expect(cc['rtdEpoch']).toBe(replacement);
      expect(replacement.active).toBe(true);
      expect(cc['rtdPaused']).toBe(false);
      expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([
        {stage: 'rtd', outcome: 'succeeded', attempt: 1, elapsedMs: 0},
      ]);
      sink.mockRestore(); removed.mockRestore(); pause.mockRestore();
    }, undefined, {enabled: true});
  });

  it.each(['switch', 'deregister'])('T-010 supersedingSwitchCancelsPendingRtdAdmission / deregisterCancelsPendingRtdAdmission %s', async boundary => {
    const deferred = createDeferred<any>();
    await withGraph(async ({cc, sockets, flush}) => {
      const epoch = cc['rtdEpoch']; expect(epoch.active).toBe(false);
      if (boundary === 'switch') sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      else await cc.deregister();
      expect(epoch.controller.signal.aborted).toBe(true);
      deferred.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com'}}); await flush();
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(0);
    }, undefined, {enabled: true, pending: deferred.promise});
  });

  const holdNonTaskAiHttp = ({cc, host}) => {
    cc.agentConfig.isWellnessBreakEnabled = true;
    host.internal.services.get.mockReturnValue('https://api.wxcc-us1.cisco.com');
    const http = createDeferred<any>();
    const dispatched: any[] = [];
    const settled = jest.fn();
    const boundary = host.request.getMockImplementation();
    host.request.mockImplementation(request => {
      if (request.uri?.endsWith('/event') || request.uri?.endsWith('/transcripts/list')) {
        dispatched.push(request);
        return http.promise;
      }
      return boundary(request);
    });
    const start = () => Promise.all([
      cc.apiAIAssistant.requestWellnessBreak(),
      cc.apiAIAssistant.fetchHistoricTranscripts('agent', 'interaction'),
    ].map(pending => pending.then(value => { settled(); return {value}; },
      error => { settled(); return {error}; })));

    return {http, dispatched, settled, start};
  };

  it.each(['before', 'after'].flatMap(timing => ['session', 'registration'].map(replacement => [timing, replacement])))(
    'T-012 rtdMultiLoginStaysClosedWithoutPrimaryTermination admits HTTP started %s termination until new %s', async (timing, replacement) => {
      await withGraph(async h => {
        const {cc, sockets, requests, frame, login, flush} = h;
        await restoreAutoAvailable(h, false);
        const rtd = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; rtd.welcome(); await flush();
        const http = holdNonTaskAiHttp(h);
        const commandOwner = cc['commandController'];
        let operation = timing === 'before' ? http.start() : undefined;
        const generation = cc['registrationGeneration'];
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const owner = lifecycleOwner(cc);
        const listener = jest.fn(); cc.on(AGENT_EVENTS.AGENT_MULTI_LOGIN, listener);
        rtd.message({type: CC_EVENTS.AGENT_MULTI_LOGIN}); await flush();
        expect(rtd.readyState).toBe(3); expect(primary.readyState).toBe(1);
        expect(cc['registrationGeneration']).toBe(generation);
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect([...cc['acceptedSwitchIds']]).toEqual(['switch']);
        expect(cc['acceptedStation']).toBeDefined();
        expect(cc['priorStationActive']).toBe(true);
        expect(listener).not.toHaveBeenCalled();
        if (timing === 'after') operation = http.start();
        await flush();
        expect(http.dispatched.map(request => [request.method, new URL(request.uri).pathname])).toEqual([
          ['POST', '/event'], ['POST', '/transcripts/list'],
        ]);
        expect(http.dispatched[0].body).toEqual({agentId: 'agent', orgId: 'org',
          eventType: AIAssistantEventType.CUSTOM_EVENT, eventName: AIAssistantEventName.WELLNESS_BREAK_ACTION,
          eventDetails: {data: {action: WELLNESS_BREAK_USER_ACTIONS.REQUESTED,
            agentSessionId: cc['currentAgentSessionId'], actionTimeStamp: Date.now()}}});
        expect(http.dispatched[1].body).toEqual({agentId: 'agent', orgId: 'org', interactionId: 'interaction'});
        expect(http.settled).not.toHaveBeenCalled();
        const transcripts = {interactionId: 'interaction', data: []};
        http.http.resolve({statusCode: 202, body: transcripts});
        await expect(operation).resolves.toEqual([{value: undefined}, {value: transcripts}]);
        expect(http.settled).toHaveBeenCalledTimes(2);
        expect(cc['commandController']).toBe(commandOwner);
        expect(commandOwner.signal.aborted).toBe(false);
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        await cc['resumeRtd'](cc['registrationAbortController'].signal);
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(2);
        primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        expect(lifecycleOwner(cc)).toEqual(owner);

        const session = cc['currentAgentSessionId'];
        const accepted = cc['acceptedStation'];
        const count = requests.filter(request => request.resource === 'v1/realtime/subscribe').length;
        const logout = jest.spyOn(cc.services.agent, 'logout').mockRejectedValueOnce(new Error('active interaction'));
        await expect(cc.stationLogout({logoutReason: 'in interaction'})).rejects.toThrow();
        logout.mockRestore(); await flush();
        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc['priorStationActive']).toBe(true);
        expect(cc['currentAgentSessionId']).toBe(session);
        expect(primary.readyState).toBe(1);
        expect(cc['registrationGeneration']).toBe(generation);
        const revision = cc['stationRevision'];
        primary.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, 'remote-payload',
          {teamId: 'updated-team'}), type: CC_EVENTS.AGENT_STATION_LOGIN});
        expect(cc['stationRevision']).toBe(revision + 1);
        expect(cc['acceptedStation'].payload.teamId).toBe('updated-team');
        expect(cc['currentAgentSessionId']).toBe(session);
        // An owned reload is also insufficient to reclaim a terminated RTD session.
        const reloaded = cc['silentRelogin'](); await flush();
        const reload = requests.filter(request => request.resource === '/v1/agents/reload').slice(-1)[0];
        primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
          {agentSessionId: session, teamId: 'updated-team'}));
        await reloaded; await flush();
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await cc['resumeRtd'](cc['registrationAbortController'].signal);
          await expect(http.start()).resolves.toEqual([{value: undefined}, {value: transcripts}]);
          await flush();
        }
        expect(requests.filter(request => request.resource === 'v1/realtime/subscribe')).toHaveLength(count);
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(cc['rtdPaused']).toBe(true);
        expect(primary.readyState).toBe(1);
        expect(cc['registrationGeneration']).toBe(generation);
        expect(cc['currentAgentSessionId']).toBe(session);
        expect(cc['priorStationActive']).toBe(true);
        expect(listener).not.toHaveBeenCalled();

        if (replacement === 'session') {
          await login(LoginOption.EXTENSION, 'replacement-session');
          expect(cc['currentAgentSessionId']).toBe('replacement-session');
          expect(cc['registrationGeneration']).toBe(generation);
        } else {
          cc.$config.allowAutomatedRelogin = false;
          const registered = cc.register(); await flush();
          sockets.filter(socket => socket.url.includes('routing.')).slice(-1)[0].welcome();
          await registered; await flush();
          expect(cc['registrationGeneration']).toBeGreaterThan(generation);
        }
        expect(requests.filter(request => request.resource === 'v1/realtime/subscribe')).toHaveLength(count + 1);
        expect(cc['rtdEpoch']).toBeDefined();
        sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0].welcome(); await flush();
        expect(cc['rtdEpoch'].active).toBe(true);
      }, undefined, {enabled: true});
    });

  it.each([false, true].flatMap(established => [undefined, '', '   '].map(session => [established, session])))(
  'T-012 rtdTerminationWithoutSession waits for replacement identity established=%s session=%j', async (established, agentSessionId) => {
    await withGraph(async h => {
      const {cc, sockets, requests, frame, login, flush} = h;
      if (established) await login();
      const rtd = sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0]; rtd.welcome(); await flush();
      rtd.message({type: CC_EVENTS.AGENT_MULTI_LOGIN}); await flush();
      const count = requests.filter(request => request.resource === 'v1/realtime/subscribe').length;
      // A successful owned login with absent identity still cannot prove replacement.
      const pending = cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
      await flush();
      const request = requests.filter(request => request.resource === '/v1/agents/login').slice(-1)[0];
      const response = frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, request.headers.trackingid, {agentSessionId});
      if (agentSessionId === undefined) delete response.data.agentSessionId;
      sockets[0].message({...response, type: CC_EVENTS.AGENT_STATION_LOGIN});
      await pending; await flush();
      expect(cc['currentAgentSessionId']).toBeUndefined();
      const http = holdNonTaskAiHttp(h);
      const operation = http.start(); await flush();
      http.http.resolve({statusCode: 202, body: {interactionId: 'interaction', data: []}});
      await operation;
      await cc['resumeRtd'](cc['registrationAbortController'].signal);
      expect(requests.filter(request => request.resource === 'v1/realtime/subscribe')).toHaveLength(count);
      expect(cc['rtdEpoch']).toBeUndefined();
      if (established) {
        await login();
        expect(requests.filter(request => request.resource === 'v1/realtime/subscribe')).toHaveLength(count);
        expect(cc['rtdEpoch']).toBeUndefined();
      }
      await login(LoginOption.EXTENSION, 'established-session');
      expect(requests.filter(request => request.resource === 'v1/realtime/subscribe')).toHaveLength(count + 1);
      expect(cc['currentAgentSessionId']).toBe('established-session');
      expect(cc['rtdEpoch']).toBeDefined();
    }, undefined, {enabled: true});
  });

  it.each(['switch', 'deregister'].flatMap(boundary => [false, true].map(success => [boundary, success])))
  ('T-012 HTTP after RTD termination is still interrupted by %s with lateSuccess=%s', async (boundary, success) => {
    await withGraph(async h => {
      const {cc, sockets, login, flush} = h;
      await login();
      const rtd = sockets.find(s => s.url.includes('rtd.')); rtd.welcome(); await flush();
      rtd.message({type: CC_EVENTS.AGENT_MULTI_LOGIN}); await flush();
      const http = holdNonTaskAiHttp(h);
      const operation = http.start();
      await flush();
      expect(http.dispatched).toHaveLength(2);
      expect(http.settled).not.toHaveBeenCalled();
      const commandOwner = cc['commandController'];
      if (boundary === 'switch') sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'http-switch'});
      else await cc.deregister();
      expect(commandOwner.signal.aborted).toBe(true);
      // Cancellation settles both callers before the external HTTP boundary settles.
      const results = await operation;
      expect(results.map(result => result.error?.data.reason)).toEqual([
        'RECOVERY_INTERRUPTED', 'RECOVERY_INTERRUPTED',
      ]);
      expect(http.settled).toHaveBeenCalledTimes(2);
      const track = jest.spyOn(cc['metricsManager'], 'trackEvent');
      if (success) http.http.resolve({statusCode: 202, body: {interactionId: 'interaction', data: []}});
      else http.http.reject(new Error('late AI HTTP failure'));
      await flush();
      expect(track.mock.calls.filter(([name]) => [
        METRIC_EVENT_NAMES.AI_ASSISTANT_WELLNESS_ACTION_ACCEPTED,
        METRIC_EVENT_NAMES.AI_ASSISTANT_FETCH_HISTORIC_TRANSCRIPTS_SUCCESS,
      ].includes(name))).toEqual([]);
      expect(http.settled).toHaveBeenCalledTimes(2);
      expect(cc['rtdEpoch']).toBeUndefined();
      track.mockRestore();
    }, undefined, {enabled: true});
  });

  it('T-010 staleRtdTranscriptsAndSuggestionsDropped / staleRtdWellnessAndEnablementDuringPauseDropped', async () => {
    await withGraph(async ({cc, sockets, flush}) => {
      const old = sockets.find(s => s.url.includes('rtd.')); old.welcome(); await flush();
      const enablement = {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
        interactionId: 'current-task', postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}};
      old.message(enablement); expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
      const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      const wellness = jest.spyOn(cc, 'handleWellnessBreakWebsocketPayload');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
      const stale = [enablement, {type: CC_EVENTS.REAL_TIME_TRANSCRIPTION, data: {data: {conversationId: 'current-task'}}},
        {type: CC_EVENTS.SUGGESTED_RESPONSE, data: {data: {conversationId: 'current-task'}}},
        {type: 'Wellness_Break_Handler', data: {}}];
      delivered.mockClear(); wellness.mockClear(); stale.forEach(frame => old.message(frame));
      expect(delivered).not.toHaveBeenCalled(); expect(wellness).not.toHaveBeenCalled();
      jest.advanceTimersByTime(105000); await flush();
      sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; current.welcome(); await flush();
      delivered.mockClear(); wellness.mockClear(); stale.forEach(frame => old.message(frame));
      expect(delivered).not.toHaveBeenCalled(); expect(wellness).not.toHaveBeenCalled();
      current.message(enablement); expect(delivered).toHaveBeenCalledTimes(1);
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
      delivered.mockRestore(); wellness.mockRestore();
    }, undefined, {enabled: true});
  });

  describe.each([
    {type: CC_TASK_EVENTS.POST_CALL_SUMMARY, invoke: (task) => task.requestPostCallSummary()},
    {type: CC_TASK_EVENTS.MID_CALL_SUMMARY, invoke: (task) => task.requestMidCallSummary('CONSULT')},
  ])('T-010 oldRtdCannotResolveNewSummary: $type', ({type, invoke}) => {
    it.each(['before', 'after'] as const)(
      'restoredTaskSummaryCapabilitiesRequireFreshEnablement %s hydration', async (enablementOrder) => {
        await withGraph(async h => {
          const {cc, graph, host, sockets, login, flush} = h;
          await login();
          const oldSocket = sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0];
          oldSocket.welcome(); await flush();
          // Retain the actual native callback to model a message already queued before close.
          const oldMessage = oldSocket.onmessage;
          expect(oldMessage).toEqual(expect.any(Function));
          const rtdFrame = (eventType: string, payload: unknown) => ({type: eventType, data: {data: payload}});
          const enablement = (interactionId: string) => ({interactionId,
            postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1});
          const featureFrame = rtdFrame(CC_TASK_EVENTS.FEATURE_ENABLEMENT, enablement('restored-summary'));
          const {task: retained, data} = offerRetainedTask(h, 'restored-summary');
          oldSocket.message(featureFrame);
          oldSocket.message(rtdFrame(CC_TASK_EVENTS.FEATURE_ENABLEMENT, enablement('cached-summary')));
          oldSocket.message(rtdFrame(CC_TASK_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
            {conversationId: 'cached-summary', summaryText: 'stale cached summary'}));
          expect(retained.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
          expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
          expect(cc.taskManager['receivingSummaryBuffer'].size).toBe(1);
          expect(retained['apiAIAssistant']).toBe(cc.apiAIAssistant);
          expect(jest.isMockFunction(cc.apiAIAssistant.requestAndWaitForRtd)).toBe(false);
          const http = [createDeferred<any>(), createDeferred<any>()];
          const boundary = host.request.getMockImplementation();
          host.internal.services.get.mockReturnValue('https://api.wxcc-us1.cisco.com');
          let summaryPosts = 0;
          host.request.mockImplementation(request => {
            if (request.uri?.endsWith('/event')) return http[summaryPosts++].promise;
            return boundary(request);
          });
          const oldSettled = jest.fn(error => error);
          const oldResult = invoke(retained).catch(oldSettled);
          await flush();
          expect(summaryPosts).toBe(1);
          const key = JSON.stringify([type, data.interactionId]);
          const oldRecord = cc.apiAIAssistant['pendingRtdRequests'].get(key);
          expect(oldRecord).toBeDefined();

          sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'summary-switch'});
          await flush();
          expect(oldSettled).toHaveBeenCalledTimes(1);
          expect(await oldResult).toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
          expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
          expect(cc.taskManager['receivingSummaryBuffer'].size).toBe(0);
          expect(retained.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
          oldMessage({data: JSON.stringify(featureFrame)});
          expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
          jest.advanceTimersByTime(105000); await flush();
          const primary = sockets.filter(socket => socket.url.includes('routing.')).slice(-1)[0];
          primary.welcome(); await flush();
          expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
          await login();
          const current = sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0];
          expect(current).not.toBe(oldSocket);
          current.welcome(); await flush();
          expect(cc['lastPublishedRegionState'].status).toBe('ready');
          expect(cc.taskManager.getTask(data.interactionId)).toBeUndefined();
          expect(cc.apiAIAssistant.aiFeature.generatedSummaries).toEqual({
            wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true,
          });
          const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
          const resolveRtd = jest.spyOn(cc.apiAIAssistant, 'resolveFromRtdEvent');
          const stale = {conversationId: data.interactionId, summaryText: 'old socket summary'};
          const staleFrame = rtdFrame(type, stale);
          const replayOld = () => [featureFrame, staleFrame].forEach(frame => oldMessage({data: JSON.stringify(frame)}));
          replayOld();
          expect(delivered).not.toHaveBeenCalled();
          expect(resolveRtd).not.toHaveBeenCalled();
          expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);

          const hydrate = (interactionId: string) => {
            primary.message({type: CC_EVENTS.AGENT_CONTACT, data: {...data,
              type: CC_EVENTS.AGENT_CONTACT, interactionId,
              interaction: {...data.interaction, interactionId, mainInteractionId: interactionId, state: 'connected'},
            }});
            const task = cc.taskManager.getTask(interactionId);
            expect(task).toBeInstanceOf(graph.Task);
            return task;
          };
          const expectDisabled = async task => {
            expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
            await expect(task.requestPostCallSummary()).rejects.toMatchObject({
              message: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
              data: {errorCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED},
            });
            await expect(task.requestMidCallSummary('CONSULT')).rejects.toMatchObject({
              message: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
              data: {errorCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED},
            });
            expect(summaryPosts).toBe(1);
            expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
          };
          // Stale cached enablement and receiving summaries cannot survive into hydration.
          const cachedSummary = jest.fn();
          const publishedCapabilities: unknown[] = [];
          const publication = jest.fn(task => {
            publishedCapabilities.push({interactionId: task.data.interactionId, ...task.aiSummaryCapabilities});
            task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_RECEIVED, cachedSummary);
          });
          cc.taskManager.on(TASK_EVENTS.TASK_HYDRATE, publication);
          await expectDisabled(hydrate('cached-summary'));
          expect(cachedSummary).not.toHaveBeenCalled();
          current.message(rtdFrame(CC_TASK_EVENTS.FEATURE_ENABLEMENT, enablement('unrelated-summary')));
          if (enablementOrder === 'before') current.message(featureFrame);
          const restored = hydrate(data.interactionId);
          expect(restored).not.toBe(retained);
          expect(restored['apiAIAssistant']).toBe(cc.apiAIAssistant);
          expect(publishedCapabilities).toEqual([
            {interactionId: 'cached-summary', postCallEnabled: false, midCallEnabled: false},
            {interactionId: data.interactionId, postCallEnabled: enablementOrder === 'before',
              midCallEnabled: enablementOrder === 'before'},
          ]);
          if (enablementOrder === 'after') {
            await expectDisabled(restored);
            replayOld();
            await expectDisabled(restored);
            current.message(featureFrame);
          }
          expect(restored.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
          expect(cc.taskManager['pendingFeatureEnablement'].has(data.interactionId)).toBe(false);
          const currentSettled = jest.fn(value => value);
          const result = invoke(restored).then(currentSettled, currentSettled);
          await flush();
          expect(summaryPosts).toBe(2);
          const pending = cc.apiAIAssistant['pendingRtdRequests'];
          const replacement = pending.get(key);
          expect(replacement).toBeDefined();
          expect(replacement).not.toBe(oldRecord);
          resolveRtd.mockClear(); delivered.mockClear();
          replayOld(); await flush();
          expect(delivered).not.toHaveBeenCalled();
          expect(resolveRtd).not.toHaveBeenCalled();
          expect(pending.get(key)).toBe(replacement);
          expect(currentSettled).not.toHaveBeenCalled();
          if (enablementOrder === 'before') http[0].resolve({statusCode: 202, body: {}});
          else http[0].reject(new Error('old same-key summary HTTP failed'));
          await flush();
          expect(oldSettled).toHaveBeenCalledTimes(1);
          expect(pending.get(key)).toBe(replacement);
          expect(currentSettled).not.toHaveBeenCalled();
          const fresh = {conversationId: data.interactionId, summaryText: 'current socket summary'};
          current.message(rtdFrame(type, fresh)); await flush();
          expect(delivered).toHaveBeenCalledTimes(1);
          expect(resolveRtd.mock.calls).toEqual([[type, data.interactionId, fresh]]);
          expect(pending.size).toBe(0);
          expect(currentSettled).not.toHaveBeenCalled(); // Matching RTD alone is insufficient.
          http[1].resolve({statusCode: 202, body: {}});
          await expect(result).resolves.toEqual(fresh);
          expect(currentSettled.mock.calls).toEqual([[fresh]]);
          replayOld(); await flush();
          expect(currentSettled).toHaveBeenCalledTimes(1);
          expect(pending.size).toBe(0);
          delivered.mockRestore(); resolveRtd.mockRestore();
        }, undefined, {enabled: true});
      }
    );
  });

  it.each([401, 403])('T-012 readerVsPrimaryVsRtdAuthBoundaries optional RTD status=%s', async status => {
    const pending = createDeferred<any>();
    await withGraph(async ({cc, sockets, login, flush}) => {
      await login(); await flush();
      pending.reject({statusCode: status, body: {reason: 'AUTH_FAILED'}}); await flush();
      expect(cc['registrationAbortController'].signal.aborted).toBe(false);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      expect(cc['rtdPaused']).toBe(true);
      expect(cc['getHttpRecoveryGuard']()).toBeDefined();
    }, undefined, {enabled: true, pending: pending.promise});
  });

  const manualStationPolicies = [
    ['automation disabled', 'automatic-relogin-disabled'],
    ['configuration absent', 'session-restore-failed'],
    ['configuration unusable', 'session-restore-failed'],
    ['automatic restoration exhausted', 'session-restore-failed'],
  ];

  const enterPriorStationManualRecovery = async (h, policy, reason) => {
    const {cc, sockets, requests, frame, login, flush} = h;
    await login();
    const old = sockets.find(s => s.url.includes('rtd.')); old.welcome(); await flush();
    const oldMessage = old.onmessage;
    const stored = cc.services.rtdWebSocketManager.listeners('message')[0];
    const oldEpoch = cc['rtdEpoch'];
    const registration = cc['registrationAbortController'];
    const admissions = requests.filter(r => r.resource === 'v1/realtime/subscribe').length;
    cc.agentConfig.isWellnessBreakEnabled = true;
    const {task} = offerRetainedTask(h, 'manual-rtd-task');
    const frames = [
      {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {
        interactionId: 'manual-rtd-task', postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1}}},
      {type: CC_EVENTS.REAL_TIME_TRANSCRIPTION, data: {data: {conversationId: 'manual-rtd-task'}}},
      {type: CC_EVENTS.SUGGESTED_RESPONSE, data: {data: {conversationId: 'manual-rtd-task'}}},
      {type: 'Wellness_Break_Handler', orgId: 'org', data: {agentId: 'agent', orgId: 'org',
        notifType: 'Wellness_Break_Handler', notifDetails: {actionEvent: 'SUGGEST_WELLNESS_BREAK'},
        data: {orgId: 'org', agentSessionId: 'session'}}},
    ];
    const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
    const wellness = jest.spyOn(cc, 'handleWellnessBreakWebsocketPayload');
    const taskEvents = [CC_EVENTS.REAL_TIME_TRANSCRIPTION, CC_EVENTS.SUGGESTED_RESPONSE,
      TASK_EVENTS.TASK_FEATURE_ENABLEMENT].map(event => {
      const listener = jest.fn(); task.on(event, listener); return listener;
    });
    const wellnessEvent = jest.fn(); cc.on(CC_EVENTS.WELLNESS_BREAK, wellnessEvent);
    frames.forEach(frame => old.message(frame));
    expect(delivered).toHaveBeenCalledTimes(3);
    expect(wellnessEvent).toHaveBeenCalledTimes(1);
    taskEvents.forEach(listener => expect(listener).toHaveBeenCalledTimes(1));
    expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
    cc.$config.allowAutomatedRelogin = policy !== 'automation disabled';
    if (policy === 'configuration absent') cc['acceptedStation'] = undefined;
    if (policy === 'configuration unusable') cc['acceptedStation'].payload.teamId = '';
    const reloadCount = requests.filter(r => r.resource === '/v1/agents/reload').length;
    const loginCount = requests.filter(r => r.resource === '/v1/agents/login').length;
    const primary = sockets.find(s => s.url.includes('routing.'));
    primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'manual-switch'});
    expect(old.close).toHaveBeenCalledTimes(1);
    expect(old.readyState).toBe(3);
    expect(oldEpoch.controller.signal.aborted).toBe(true);
    jest.advanceTimersByTime(105000); await flush();
    const current = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
    current.welcome(); await flush();
    if (policy === 'automatic restoration exhausted') {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
        expect(reloads).toHaveLength(reloadCount + attempt + 1);
        current.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reloads.slice(-1)[0].headers.trackingid,
          {reasonCode: 1037}));
        await flush();
        if (attempt < 3) { jest.advanceTimersByTime([2000, 4000, 8000][attempt]); await flush(); }
      }
      const logins = requests.filter(r => r.resource === '/v1/agents/login');
      expect(logins).toHaveLength(loginCount + 1);
      current.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, logins.slice(-1)[0].headers.trackingid,
        {reasonCode: 9999}), type: CC_EVENTS.AGENT_STATION_LOGIN});
      await flush();
    } else {
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(reloadCount);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(loginCount);
    }
    delivered.mockClear(); wellness.mockClear(); wellnessEvent.mockClear();
    taskEvents.forEach(listener => listener.mockClear());
    const replay = (includeStored = true) => frames.forEach(frame => {
      old.message(frame);
      oldMessage({data: JSON.stringify(frame)});
      if (includeStored) stored(JSON.stringify(frame));
    });
    const expectWithheld = () => {
      expect(old.close).toHaveBeenCalledTimes(1);
      expect(old.readyState).toBe(3);
      expect(cc['rtdPaused']).toBe(true);
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(admissions);
      expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(admissions);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
      expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
      expect(delivered).not.toHaveBeenCalled();
      expect(wellness.mock.calls.filter(([payload]) => payload.type === 'Wellness_Break_Handler')).toEqual([]);
      expect(wellnessEvent).not.toHaveBeenCalled();
      taskEvents.forEach(listener => expect(listener).not.toHaveBeenCalled());
    };
    const expectManual = () => {
      expect(cc['recoveryPhase']).toBe('manualLoginRequired');
      expect(cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired', reason,
        homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false, trackingId: 'manual-switch'});
      replay(); expectWithheld();
    };
    expectManual();
    return {primary: current, registration, admissions, frames, delivered, wellnessEvent,
      replay, expectWithheld, expectManual};
  };

  it.each(manualStationPolicies)(
    'T-010 manualLoginFailureKeepsRtdClosedAndRetryResumes with registration-owned child: %s', async (policy, reason) => {
      await withGraph(async h => {
        const {cc, host, sockets, login, flush, requests} = h;
        const manual = await enterPriorStationManualRecovery(h, policy, reason);
        const before = requests.length;
        await expect(cc.setAgentState({state: 'Available', auxCodeId: '0'}))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
        await expect(cc.stationLogin({teamId: 'team', loginOption: LoginOption.AGENT_DN, dialNumber: ''}))
          .rejects.toThrow('INVALID_DIAL_NUMBER');
        expect(requests).toHaveLength(before);
        manual.expectManual();
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementationOnce(request => {
          expect(request.resource).toBe('/v1/agents/login');
          requests.push(request);
          return Promise.reject({statusCode: 400, body: {reason: 'INVALID_LOGIN'}});
        });
        await expect(cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'}))
          .rejects.toBeInstanceOf(Error);
        host.request.mockImplementation(boundary);
        manual.expectManual();
        const resume = jest.spyOn(cc, 'resumeRtd');
        const readyObservations: unknown[] = [];
        cc.on('region:stateChange', state => {
          if (state.status === 'ready') readyObservations.push([
            requests.filter(r => r.resource === 'v1/realtime/subscribe').length, cc['rtdEpoch'],
            resume.mock.calls.length, state]);
        });
        await login(LoginOption.EXTENSION, 'manual-session');
        expect(readyObservations).toEqual([[manual.admissions, undefined, 0, {
          status: 'ready', reason: 'region-switch', homeRegion: 'produs1', servingRegion: 'produs1',
          limitedService: false, trackingId: 'manual-switch'}]]);
        expect(resume.mock.calls).toEqual([[manual.registration.signal]]);
        const epoch = cc['rtdEpoch'];
        expect(epoch.parent).toBe(manual.registration.signal);
        expect(epoch.controller.signal.aborted).toBe(false);
        expect(epoch.sessionId).toBe('manual-session');
        expect(cc['sessionRequest']).toBeUndefined();
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(manual.admissions + 1);
        const pendingResume = cc['resumeRtd'](manual.registration.signal);
        expect(pendingResume).toBe(epoch.promise);
        const rtd = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
        rtd.welcome(); await pendingResume; await flush();
        expect(cc['rtdPaused']).toBe(false);
        manual.replay(false);
        expect(manual.delivered).not.toHaveBeenCalled();
        expect(manual.wellnessEvent).not.toHaveBeenCalled();
        // The replacement socket delivers fresh frames, proving the stale checks have a live control.
        manual.frames.forEach(frame => rtd.message(frame));
        expect(manual.delivered).toHaveBeenCalledTimes(3);
        expect(manual.wellnessEvent).toHaveBeenCalledTimes(1);
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(1);
        await cc['resumeRtd'](manual.registration.signal);
        expect(cc['rtdEpoch']).toBe(epoch);
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(manual.admissions + 1);
        expect(sockets.filter(s => s.url.includes('rtd.'))).toHaveLength(manual.admissions + 1);
      }, undefined, {enabled: true});
    });

  it.each(['switch', 'deregister'].flatMap(boundary => ['manual', 'late success', 'late rejection']
    .map(phase => [boundary, phase])))(
    'T-010 manualPriorStationIgnoresSupersededWork: %s during %s', async (boundary, phase) => {
      await withGraph(async h => {
        const {cc, host, sockets, requests, frame, flush} = h;
        const manual = await enterPriorStationManualRecovery(h, 'automation disabled', 'automatic-relogin-disabled');
        const oldPrimaryMessage = manual.primary.onmessage;
        const http = createDeferred<any>();
        let loginRequest: any;
        let loginPromise: Promise<unknown>;
        const settled = jest.fn();
        if (phase !== 'manual') {
          const requestBoundary = host.request.getMockImplementation();
          host.request.mockImplementation(request => {
            if (request.resource !== '/v1/agents/login') return requestBoundary(request);
            requests.push(request); loginRequest = request;
            return http.promise;
          });
          loginPromise = cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
          loginPromise.then(settled, settled); await flush();
          expect(loginRequest).toBeDefined();
          expect(settled).not.toHaveBeenCalled();
          manual.expectManual();
        }
        const sessionRequest = cc['sessionRequest'];
        if (boundary === 'switch') {
          manual.primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'superseding-manual'});
        } else await cc.deregister();
        await flush();
        if (loginPromise) {
          await expect(loginPromise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          expect(sessionRequest.controller.signal.aborted).toBe(true);
          expect(settled).toHaveBeenCalledTimes(1);
        }
        manual.replay(); manual.expectWithheld();
        if (boundary === 'switch') {
          jest.advanceTimersByTime(105000); await flush();
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
          expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
        }
        const state = cc['lastPublishedRegionState'];
        const sessionId = cc['currentAgentSessionId'];
        const accepted = cc['acceptedStation'];
        const requestCount = requests.length;
        const socketCount = sockets.length;
        if (loginRequest) {
          const success = phase === 'late success';
          if (success) http.resolve({statusCode: 200, body: {}});
          else http.reject({statusCode: 400, body: {reason: 'INVALID_LOGIN'}});
          await flush();
          const response = {...frame(success ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_STATION_LOGIN_FAILED,
            loginRequest.headers.trackingid, {agentSessionId: 'obsolete-manual-session', reasonCode: success ? 0 : 9999}),
            type: CC_EVENTS.AGENT_STATION_LOGIN};
          oldPrimaryMessage({data: JSON.stringify(response)});
          if (boundary === 'switch') sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].message(response);
          await flush();
          expect(settled).toHaveBeenCalledTimes(1);
        }
        manual.replay(); manual.expectWithheld();
        jest.advanceTimersByTime(180000); await flush();
        manual.replay(); manual.expectWithheld();
        expect(cc['lastPublishedRegionState']).toBe(state);
        expect(cc['currentAgentSessionId']).toBe(sessionId);
        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc['currentAgentSessionId']).not.toBe('obsolete-manual-session');
        expect(requests).toHaveLength(requestCount);
        expect(sockets).toHaveLength(socketCount);
      }, undefined, {enabled: true});
    });

  it.each([0, 1, 2, 3, 4])('T-002 sharedRegistrationGenerationFencesWellnessAndRecovery before regional wait %s expires', async waitIndex => {
    await withGraph(async ({cc, host, requests, sockets, flush}) => {
      const delays = [105000, 63000, 31500, 15750, 15750];
      const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      const completion = expect(driver.mock.results[0].value).rejects.toMatchObject({data: {kind: 'cancelled'}});
      const recovery = cc['recovery'];
      const registration = cc['registrationAbortController'];
      for (const delay of delays.slice(0, waitIndex)) {
        jest.advanceTimersByTime(delay); await flush();
        sockets[sockets.length - 1].lost(); await flush();
      }
      jest.advanceTimersByTime(delays[waitIndex] - 1); await flush();
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(waitIndex + 1);
      expect(sockets).toHaveLength(waitIndex + 1);
      host.credentials.getOrgId = () => 'replacement-org';
      jest.advanceTimersByTime(1); await flush();
      expect(recovery.controller.signal.aborted).toBe(true);
      await completion;
      expect(registration.signal.aborted).toBe(true);
      expect(cc['recovery']).toBeUndefined();
      expect(cc.services.webSocketManager.listenerCount('socketClose')).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(600000); await flush();
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(waitIndex + 1);
      expect(sockets).toHaveLength(waitIndex + 1);
      expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
    });
  });

  it.each([0, 1])('T-002 identity detection during wait %s preserves a reentrant replacement registration', async waitIndex => {
    await withGraph(async ({cc, host, requests, sockets, flush}) => {
      const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      const completion = expect(driver.mock.results[0].value).rejects.toMatchObject({data: {kind: 'cancelled'}});
      if (waitIndex) {
        jest.advanceTimersByTime(105000); await flush();
        sockets[1].lost(); await flush();
      }
      let replacement: Promise<unknown>;
      cc.on('region:stateChange', state => {
        if (state.status === 'unavailable' && !replacement) {
          replacement = cc.register();
          replacement.catch(() => undefined);
        }
      });
      host.credentials.getOrgId = () => 'replacement-org';
      jest.advanceTimersByTime(waitIndex ? 63000 : 105000); await flush();
      expect(replacement).toBeDefined();
      await completion;
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(waitIndex + 2);
      expect(sockets).toHaveLength(waitIndex + 2);
      const current = sockets[sockets.length - 1];
      const registration = cc['registrationAbortController'];
      current.welcome(); await replacement; await flush();
      expect(cc['registrationOrgId']).toBe('replacement-org');
      expect(cc['registrationAgentId']).toBe('agent');
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      for (let turn = 0; turn < 25; turn += 1) {
        jest.advanceTimersByTime(5000); current.message({keepalive: 'true'}); await flush();
      }
      expect(registration.signal.aborted).toBe(false);
      expect(current.close).not.toHaveBeenCalled();
      expect(current.readyState).toBe(1);
      expect(cc.services.webSocketManager.listenerCount('socketClose')).toBe(1);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(waitIndex + 2);
      expect(sockets).toHaveLength(waitIndex + 2);
    });
  });

  const diagnostics = (sink) => sink.mock.calls
    .filter(([, context]) => context?.method === 'recordRecoveryDiagnostic')
    .map(([, context]) => context.data);
  const regionMetrics = (sink) => sink.mock.calls.filter(([name]) =>
    [METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS, METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED].includes(name));
  const secretFailure = (status = 503, reasonCode = '1037') => ({
    statusCode: status, body: {reasonCode, reason: 'REMOTE_SECRET'},
    headers: {trackingid: 'safe-tracking\n'}, options: {
      headers: {Authorization: 'BEARER_SECRET', authorization: 'TOKEN_SECRET'},
      body: {dialNumber: 'DN_SECRET'}, url: 'https://private.invalid/?secret=URL_SECRET',
    },
  });

  describe('T-013 noSecretsInAllAffectedDiagnostics', () => {
    // Snapshot at delivery time, including Error's normally invisible fields. A
    // later mutation or JSON.stringify(Error) must not conceal a leaked argument.
    const collect = (value: unknown, seen = new Set<unknown>()): string => {
      if (value === null || typeof value !== 'object') return String(value);
      if (seen.has(value)) return '[cycle]';
      seen.add(value);
      const keys = new Set<PropertyKey>(Reflect.ownKeys(value));
      if (value instanceof Error) ['name', 'message', 'stack', 'cause'].forEach(key => keys.add(key));
      return [...keys].map(key => `${String(key)}:${collect(Reflect.get(value, key), seen)}`).join('\n');
    };
    const forbidden = /DIAG_[A-Z_]+_SECRET|signature=|authorization|options|dialNumber/i;
    const transport = (status = 400, reasonCode = 1038) => ({
      statusCode: status,
      headers: {aUtHoRiZaTiOn: 'Bearer DIAG_HEADER_SECRET', trackingid: 'safe-tracking'},
      body: {reasonCode, reason: 'DIAG_REMOTE_REASON_SECRET', payload: 'DIAG_BODY_SECRET'},
      options: {
        headers: {Authorization: 'Bearer DIAG_UPPER_SECRET', authorization: 'Bearer DIAG_LOWER_SECRET'},
        body: {dialNumber: 'DIAG_DN_SECRET', payload: 'DIAG_OPTIONS_PAYLOAD_SECRET'},
        url: 'https://private.invalid/DIAG_URL_SECRET?signature=DIAG_SIGNATURE_SECRET',
      },
      payload: 'DIAG_ENVELOPE_SECRET',
    });
    const transportError = (status = 400, reasonCode = 1038) => {
      const error = Object.assign(new Error('DIAG_MESSAGE_SECRET https://private.invalid/?signature=DIAG_ERROR_URL_SECRET'), transport(status, reasonCode));
      Object.defineProperty(error, 'stack', {value: 'DIAG_STACK_SECRET', configurable: true});
      const cause = new Error('DIAG_CAUSE_MESSAGE_SECRET');
      Object.defineProperty(cause, 'cause', {value: error});
      Object.defineProperty(error, 'cause', {value: cause});
      return error;
    };

    it('detects non-enumerable message/stack/cause leaks even in cyclic arguments', () => {
      const error = transportError();
      for (const key of ['message', 'stack', 'cause'])
        expect(Object.prototype.propertyIsEnumerable.call(error, key)).toBe(false);
      const captured = collect([error]);
      for (const secret of ['DIAG_MESSAGE_SECRET', 'DIAG_STACK_SECRET', 'DIAG_CAUSE_MESSAGE_SECRET'])
        expect(captured).toContain(secret);
      expect(captured).toContain('[cycle]');
      expect(captured).toMatch(forbidden);
    });

    const withDiagnostics = async (scenario: (h: any) => Promise<void>, rtd = false) => {
      const captures: {sink: string; arguments: string}[] = [];
      const spies: jest.SpyInstance[] = [];
      const delivered = jest.fn();
      let proof: any;
      try {
        await withGraph(async h => {
          await scenario({...h, proof});
          // Exercise the actual public upload -> WebexRequest -> host support
          // chain in every row, even when recovery does not request an upload.
          await expect(h.cc.uploadLogs()).resolves.toMatchObject({trackingid: 'safe-upload'});
          await h.flush();
          if (h.cc.agentConfig) await expect(h.cc.deregister()).resolves.toBeUndefined();
          expect(h.cc.services.aqmReqs['operations'].size).toBe(0);
          expect(h.cc.services.aqmReqs['pendingRequests']).toEqual({});
          expect(h.cc.services.webSocketManager.hasUsableSocket()).toBe(false);
          expect(h.cc['lastPublishedRegionState']).toBeUndefined();
        }, undefined, {enabled: rtd}, {autoRegister: false, beforeRegister: h => {
          const capture = (sink, owner, method) => {
            const original = jest.isMockFunction(owner[method])
              ? owner[method].getMockImplementation() ?? (() => undefined) : owner[method];
            const spy = jest.spyOn(owner, method).mockImplementation(function (...args) {
              captures.push({sink, arguments: collect(args)});
              return original.apply(this, args);
            });
            spies.push(spy);
            return spy;
          };
          expect(h.graph.LoggerProxy.logger).toBe(h.host.logger);
          // Trap every host level, including currently dormant trace/debug.
          for (const level of ['log', 'info', 'warn', 'error', 'trace', 'debug']) {
            capture(`host.${level}`, h.host.logger, level);
            if (level !== 'debug') capture(`proxy.${level}`, h.graph.LoggerProxy, level);
          }
          const metric = capture('trackEvent', h.cc.metricsManager, 'trackEvent');
          const upload = capture('uploadLogs', h.cc.webexRequest, 'uploadLogs');
          const support = capture('submitLogs', h.host.internal.support, 'submitLogs');
          h.cc.on('all', (event, ...args) => {
            captures.push({sink: `event.${event}`, arguments: collect(args)});
            delivered(event, ...args);
          });
          // Only vary the internal logging flag; keep the actual adapter config,
          // admission, correlation, HTTP dispatch and AQM settlement unchanged.
          const info = spies.find(spy => spy === h.graph.LoggerProxy.info);
          const requireSink = (sink: string) => expect(captures.filter(call => call.sink === sink).length).toBeGreaterThan(0);
          const requireDiagnostic = (stage, outcome) => {
            const records = diagnostics(info);
            expect(records.filter(record => record.stage === stage && record.outcome === outcome).length).toBeGreaterThan(0);
            return records.filter(record => record.stage === stage && record.outcome === outcome).slice(-1)[0];
          };
          const register = async () => {
            const pending = h.cc.register();
            const settled = jest.fn(); const observed = pending.then(settled, settled);
            await h.flush();
            h.sockets.find(socket => socket.url.includes('routing.')).welcome();
            const response = await pending;
            expect(response).toBe(h.cc.agentConfig);
            await observed; await h.flush(); expect(settled).toHaveBeenCalledTimes(1);
          };
          const boundary = h.host.request.getMockImplementation();
          h.host.request.mockImplementation(async request => {
            const response = await boundary(request);
            if ([SUBSCRIBE_API, 'v1/realtime/subscribe'].includes(request.resource))
              response.body.webSocketUrl = response.body.webSocketUrl.replace('signature=private',
                request.resource === SUBSCRIBE_API ? 'signature=DIAG_ROUTING_URL_SECRET' : 'signature=DIAG_RTD_URL_SECRET');
            return response;
          });
          proof = {metric, upload, support, delivered, requireSink, requireDiagnostic, register};
        }});
        for (const sink of ['host.log', 'host.info', 'proxy.log', 'proxy.info', 'trackEvent', 'uploadLogs', 'submitLogs'])
          proof.requireSink(sink);
        expect(proof.upload.mock.calls.length).toBe(proof.support.mock.calls.length);
        for (const capture of captures)
          expect({sink: capture.sink, arguments: capture.arguments}).toEqual({sink: capture.sink, arguments: expect.not.stringMatching(forbidden)});
      } finally {
        spies.reverse().forEach(spy => spy.mockRestore());
      }
    };

    it.each(['initial-register', 'admission-http', 'optional-rtd', 'optional-rtd-socket', 'deregister'])
    ('redacts diagnostics during %s', async path => {
      await withDiagnostics(async ({cc, host, sockets, flush, login, proof}) => {
        const boundary = host.request.getMockImplementation();
        const failure = transportError(503, 1037);
        let failures = 0;
        host.request.mockImplementation(request => {
          if (((path === 'initial-register' && request.resource === SUBSCRIBE_API) ||
              (path === 'admission-http' && request.resource === SUBSCRIBE_API && cc['recovery']) ||
              (path === 'optional-rtd' && request.resource === 'v1/realtime/subscribe')) &&
              (failures === 0 || path === 'optional-rtd')) {
            failures += 1;
            return Promise.reject(failure);
          }
          return boundary(request);
        });
        if (path === 'initial-register') {
          // Integrates the separately owned ci_959a44011994128f4a672b0d
          // interpolation correction at both connectWebsocket/register catches.
          await expect(cc.register()).rejects.toBe(failure);
          expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
          expect(cc.services.webSocketManager.hasUsableSocket()).toBe(false);
          expect(proof.metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED)).toHaveLength(1);
          proof.requireSink('host.error'); proof.requireSink('proxy.error');
          expect(proof.upload).toHaveBeenCalledWith({correlationId: 'safe-tracking'});
          expect(proof.support).toHaveBeenCalledTimes(1);
        } else {
          await proof.register();
          if (path === 'optional-rtd-socket') {
            const rtd = sockets.find(socket => socket.url.includes('rtd.'));
            expect(rtd.url).toContain('signature=DIAG_RTD_URL_SECRET');
            rtd.onerror(); await flush();
            expect(proof.requireDiagnostic('rtd', 'failed')).toEqual({stage: 'rtd', outcome: 'failed', attempt: 1,
              elapsedMs: 0, id: 'RTD_NETWORK'});
          }
          await login();
          proof.requireSink('event.region:stateChange');
          proof.requireSink(`event.${AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS}`);
          if (path === 'admission-http') {
            sockets[0].message({...transport(), type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
            jest.advanceTimersByTime(105000); await flush();
            expect(proof.requireDiagnostic('admission', 'retrying')).toEqual({stage: 'admission', outcome: 'retrying', attempt: 1,
              elapsedMs: 105000, status: 503, reasonCode: 1037, trackingId: 'safe-tracking'});
            jest.advanceTimersByTime(62999); await flush(); expect(sockets).toHaveLength(1);
            jest.advanceTimersByTime(1); await flush(); sockets[1].welcome(); await flush();
            expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
            expect(regionMetrics(proof.metric).map(([name]) => name)).toEqual([
              METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED, METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS,
            ]);
          } else if (path === 'optional-rtd') {
            expect(proof.requireDiagnostic('rtd', 'failed')).toEqual({stage: 'rtd', outcome: 'failed', attempt: 1,
              elapsedMs: 0, status: 503, reasonCode: 1037, trackingId: 'safe-tracking'});
            expect(cc['rtdPaused']).toBe(true);
            expect(cc['lastPublishedRegionState'].status).toBe('ready');
            expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
          } else if (path === 'optional-rtd-socket') {
            sockets.filter(socket => socket.url.includes('rtd.')).slice(-1)[0].welcome(); await flush();
            proof.requireDiagnostic('rtd', 'succeeded');
            expect(cc['lastPublishedRegionState'].status).toBe('ready');
            expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
            expect(cc['rtdPaused']).toBe(false);
          } else {
            await expect(cc.deregister()).resolves.toBeUndefined();
            expect(proof.metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.WEBSOCKET_DEREGISTER_SUCCESS)).toHaveLength(1);
            expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
          }
        }
        expect(failures).toBe(['deregister', 'optional-rtd-socket'].includes(path as string) ? 0 : path === 'optional-rtd' ? 2 : 1);
      }, path.startsWith('optional-rtd'));
    });

    it.each(['reload', 'fallback', 'state-change'].flatMap(operation =>
      ['success', 'http', 'notification', 'timeout', 'interruption', 'late-resolve', 'late-reject'].map(path => [operation, path])))
    ('redacts %s diagnostics during %s', async (operation, path) => {
      await withDiagnostics(async ({cc, host, graph, sockets, requests, frame, flush, login, proof}) => {
        await proof.register(); await login(); cc.$config.allowAutomatedRelogin = true;
        const resource = operation === 'reload' ? '/v1/agents/reload' : operation === 'fallback' ? '/v1/agents/login' : '/v1/agents/session/state';
        const method = operation === 'reload' ? 'reload' : operation === 'fallback' ? 'stationLogin' : 'stateChange';
        const pending = createDeferred<any>();
        const boundary = host.request.getMockImplementation();
        let hits = 0, forcedFallbacks = 0;
        host.request.mockImplementation(request => {
          if (operation === 'fallback' && request.resource === '/v1/agents/reload') {
            requests.push(request); forcedFallbacks += 1;
            return Promise.reject(transportError());
          }
          if (request.resource === resource && hits++ === 0) {
            requests.push(request); return pending.promise;
          }
          return boundary(request);
        });
        const service = jest.spyOn(cc.services.agent, method);
        const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
        try {
          sockets[0].message({...transport(), type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
          const recovered = driver.mock.results[0].value;
          const recoverySettled = jest.fn(); const observedRecovery = recovered.then(recoverySettled, recoverySettled);
          jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
          if (operation === 'state-change') {
            const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
            sockets[1].message({...transport(), ...frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
              {lastStateChangeReason: 'agent-wss-disconnect'})}); await flush();
            expect(cc['lastPublishedRegionState'].autoAvailable).toBe('requesting');
          }
          expect(hits).toBe(1); expect(forcedFallbacks).toBe(operation === 'fallback' ? 1 : 0);
          expect(service).toHaveBeenCalledTimes(1);
          const promise = service.mock.results[0].value;
          const settled = jest.fn(); const observed = promise.then(settled, settled);
          const request = requests.filter(r => r.resource === resource).slice(-1)[0];
          const successType = operation === 'reload' ? CC_EVENTS.AGENT_RELOGIN_SUCCESS : operation === 'fallback' ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS;
          const failureType = operation === 'reload' ? CC_EVENTS.AGENT_RELOGIN_FAILED : operation === 'fallback' ? CC_EVENTS.AGENT_STATION_LOGIN_FAILED : CC_EVENTS.AGENT_STATE_CHANGE_FAILED;
          const notification = (success: boolean) => ({...transport(), ...frame(success ? successType : failureType, request.headers.trackingid,
            success ? {subStatus: 'Available', auxCodeId: '0', lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3} : {reason: 'REJECTED', reasonCode: 1038}),
          type: operation === 'reload' ? (success ? successType : failureType) : operation === 'fallback' ? CC_EVENTS.AGENT_STATION_LOGIN : CC_EVENTS.AGENT_STATE_CHANGE});
          const interrupted = ['interruption', 'late-resolve', 'late-reject'].includes(path as string);
          if (path === 'http') pending.reject(transportError());
          else if (interrupted) {
            if (path === 'interruption') {pending.resolve(transport(202)); await flush();}
            await expect(cc.deregister()).resolves.toBeUndefined();
          } else {
            pending.resolve(transport(202)); await flush();
            if (path === 'timeout') jest.advanceTimersByTime(20000);
            else sockets[1].message(notification(path === 'success'));
          }
          await observed; await flush(); expect(settled).toHaveBeenCalledTimes(1);
          if (interrupted) {
            await expect(promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
            await observedRecovery;
            if (operation !== 'state-change') await expect(recovered).rejects.toMatchObject({data: {kind: 'cancelled'}});
            expect(cc['lastPublishedRegionState']).toBeUndefined();
            const deliveredBeforeLate = proof.delivered.mock.calls.slice();
            const metricsBeforeLate = proof.metric.mock.calls.slice();
            if (path === 'late-reject') pending.reject(transportError());
            else pending.resolve(transport(202));
            sockets[1].message(notification(true)); await flush();
            expect(proof.delivered.mock.calls).toEqual(deliveredBeforeLate);
            expect(proof.metric.mock.calls).toEqual(metricsBeforeLate);
          } else {
            if (path === 'success') {
              await expect(promise).resolves.toEqual(notification(true));
              // Preserve generic business data (including the existing DN) and
              // the specialized mmProfile projection, without the transport envelope.
              expect(proof.delivered).toHaveBeenCalledWith(successType, notification(true).data);
              const event = operation === 'reload' ? AGENT_EVENTS.AGENT_RELOGIN_SUCCESS : operation === 'fallback' ? AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS : AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS;
              const {channelsMap, ...businessData} = notification(true).data;
              expect(proof.delivered).toHaveBeenCalledWith(event, operation === 'state-change' ? notification(true).data : {
                ...businessData, mmProfile: {chat: undefined, email: undefined, social: undefined, telephony: undefined}, notifsTrackingId: 'outer',
              });
            } else {
              const id = path === 'timeout' ? 'Service.aqm.reqs.Timeout' : path === 'notification'
                ? `Service.aqm.agent.${operation === 'reload' ? 'reload' : operation === 'fallback' ? 'stationLoginFailed' : 'stateChange'}`
                : operation === 'fallback' ? 'Service.aqm.agent.stationLogin' : 'Service.reqs.generic.failure';
              await expect(promise).rejects.toMatchObject({id});
              const stage = operation === 'reload' ? 'reload' : operation === 'fallback' ? 'fallback-login' : 'auto-available';
              const record = proof.requireDiagnostic(stage, operation === 'reload' ? 'retrying' : 'failed');
              expect(record.id).toBe(id);
              if (path === 'http') expect([record.status, record.reasonCode]).toEqual([400, 1038]);
              const diagnosticMessage = path === 'http' ? 'Routing HTTP request failed' : path === 'notification' ? 'Routing notification failed' : 'Routing request timeout';
              const diagnosticLevel = path === 'timeout' ? 'error' : path === 'notification' ? 'log' : 'info';
              expect(graph.LoggerProxy[diagnosticLevel]).toHaveBeenCalledWith(diagnosticMessage, expect.any(Object));
              for (const other of ['info', 'log', 'error'].filter(level => level !== diagnosticLevel))
                expect(graph.LoggerProxy[other]).not.toHaveBeenCalledWith(diagnosticMessage, expect.anything());
              if (path === 'notification') expect(proof.delivered).toHaveBeenCalledWith(failureType, notification(false).data);
              if (operation === 'reload') {
                if (path === 'timeout') {jest.advanceTimersByTime(2000); await flush();}
                const retry = requests.filter(r => r.resource === (path === 'timeout' ? '/v1/agents/reload' : '/v1/agents/login')).slice(-1)[0];
                const type = path === 'timeout' ? CC_EVENTS.AGENT_RELOGIN_SUCCESS : CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS;
                sockets[1].message({...transport(), ...frame(type, retry.headers.trackingid),
                  type: path === 'timeout' ? type : CC_EVENTS.AGENT_STATION_LOGIN}); await flush();
              }
            }
            await expect(recovered).resolves.toBeUndefined(); await observedRecovery;
            expect(cc['lastPublishedRegionState'].status).toBe(operation === 'fallback' && path !== 'success' ? 'stationLoginRequired' : 'ready');
            if (operation === 'state-change') expect(cc['lastPublishedRegionState'].autoAvailable).toBe(path === 'success' ? 'succeeded' : 'failed');
            expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
            expect(regionMetrics(proof.metric).map(([name]) => name)).toEqual([METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS]);
          }
          expect(recoverySettled).toHaveBeenCalledTimes(1);
          expect(cc.services.aqmReqs['operations'].size).toBe(0);
          proof.requireSink('event.region:stateChange');
          proof.requireSink(`event.${AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS}`);
        } finally {service.mockRestore(); driver.mockRestore();}
      });
    });
  });

  it.each(['logout', 'deregister', 'register', 'multi-login', 'supersede', 'terminal-cancelled'])(
    'T-012 cancellationAndCleanupDiagnosticsObservable at %s', async boundary => {
      await withGraph(async ({cc, graph, sockets, flush}) => {
        const sink = jest.spyOn(graph.LoggerProxy, 'info');
        const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
        const time = jest.spyOn(cc.metricsManager, 'timeEvent');
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch', data: {Authorization: 'TOKEN_SECRET', dialNumber: 'DN_SECRET'}});
        const owner = cc['recovery'];
        jest.advanceTimersByTime(37); await flush();
        if (boundary === 'logout') await expect(cc.stationLogout({logoutReason: 'user'})).rejects.toThrow();
        else if (boundary === 'deregister') await cc.deregister();
        else if (boundary === 'register') {
          const next = cc.register(); await flush(); sockets[1].welcome(); await next;
        } else if (boundary === 'multi-login') cc['handleWebsocketMessage'](JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN, data: {}}));
        else if (boundary === 'supersede') cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'next'}));
        else cc['handleRecoveryTerminal']({data: {kind: 'cancelled'}});
        await flush();
        expect(owner.controller.signal.aborted).toBe(true);
        expect(diagnostics(sink).filter(record => record.outcome === 'cancelled')).toEqual([
          {stage: 'admission', outcome: 'cancelled', attempt: 1, elapsedMs: 37},
        ]);
        expect(regionMetrics(metric)).toEqual([]);
        expect(JSON.stringify(diagnostics(sink))).not.toMatch(/SECRET|options|headers|dialNumber|response/);
        expect(time.mock.calls.some(([names]) => names.some(name => name.startsWith('Region Recovery')))).toBe(false);
        const count = diagnostics(sink).length;
        owner.controller.abort(); await flush();
        expect(diagnostics(sink)).toHaveLength(count);
        sink.mockRestore(); metric.mockRestore(); time.mockRestore();
      });
    });

  it('T-012/T-013 settings and ignored unknown events use detached stage diagnostics', async () => {
    const reader = createDeferred<any>();
    await withGraph(async ({cc, graph, host, sockets, flush}) => {
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'https://private.invalid/URL_SECRET',
        data: {Authorization: 'TOKEN_SECRET', dialNumber: 'DN_SECRET'}});
      expect(diagnostics(sink)).toEqual([{stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0}]);
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource.endsWith('/organization-setting')
        ? Promise.resolve({statusCode: 200, body: [{id: 'org', multiRegionEnabled: true}]}) : boundary(request));
      jest.advanceTimersByTime(23); reader.reject(secretFailure()); await flush();
      expect(diagnostics(sink).slice(-1)[0]).toEqual({stage: 'settings-read', outcome: 'retrying', attempt: 1,
        elapsedMs: 23, status: 503, reasonCode: 1037, trackingId: 'safe-tracking'});
      jest.advanceTimersByTime(1000); await flush();
      expect(diagnostics(sink).slice(-1)[0]).toEqual({stage: 'settings-read', outcome: 'succeeded', attempt: 2, elapsedMs: 0});
      expect([...cc['acceptedSwitchIds']]).toEqual([]);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'foreign', trackingId: 'foreign'});
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'}));
      expect(diagnostics(sink).filter(record => record.stage === 'ignored-event').slice(-2)).toEqual([
        {stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0, trackingId: 'foreign'},
        {stage: 'ignored-event', outcome: 'dropped', attempt: 0, elapsedMs: 0, trackingId: 'switch'},
      ]);
      expect(regionMetrics(metric)).toEqual([]);
      expect(JSON.stringify(diagnostics(sink))).not.toMatch(/SECRET|options|headers|body|dialNumber|response/);
      sink.mockRestore(); metric.mockRestore();
    }, reader.promise);
  });

  it.each([401, 403])('T-012 settings terminal stage preserves auth status=%s', async status => {
    const reader = createDeferred<any>();
    await withGraph(async ({cc, graph, flush}) => {
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      jest.advanceTimersByTime(17); reader.reject(secretFailure(status)); await flush();
      expect(diagnostics(sink)).toEqual([{stage: 'settings-read', outcome: 'terminal', attempt: 1,
        elapsedMs: 17, status, reasonCode: 1037, trackingId: 'safe-tracking'}]);
      expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
      sink.mockRestore();
    }, reader.promise);
  });

  it.each(['reload-success', 'fallback-success', 'fallback-failed', 'post1035-success'])(
    'T-012/T-013 restore stage outcomes and actual station metrics %s', async scenario => {
      await withGraph(async ({cc, graph, host, sockets, requests, frame, login, flush}) => {
        await login(); cc.$config.allowAutomatedRelogin = true;
        const sink = jest.spyOn(graph.LoggerProxy, 'info');
        const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource === '/v1/agents/reload' && scenario !== 'reload-success' &&
              requests.filter(r => r.resource === '/v1/agents/reload').length === 0) {
            requests.push(request); return Promise.reject(secretFailure(400, '1038'));
          }
          if (request.resource === '/v1/agents/login' && scenario !== 'fallback-success')
            return Promise.reject(secretFailure(400, scenario === 'post1035-success' ? '1035' : '9999'));
          return boundary(request);
        });
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        jest.advanceTimersByTime(105000); await flush(); jest.advanceTimersByTime(11); sockets[1].welcome(); await flush();
        if (scenario !== 'fallback-failed') {
          const resource = scenario === 'fallback-success' ? '/v1/agents/login' : '/v1/agents/reload';
          const request = requests.filter(r => r.resource === resource).slice(-1)[0];
          jest.advanceTimersByTime(29);
          const type = scenario === 'fallback-success' ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_SUCCESS;
          sockets[1].message({...frame(type, request.headers.trackingid),
            type: scenario === 'fallback-success' ? CC_EVENTS.AGENT_STATION_LOGIN : type}); await flush();
        }
        const stages = diagnostics(sink).filter(record => ['welcome', 'reload', 'fallback-login'].includes(record.stage));
        expect(stages[0]).toEqual({stage: 'welcome', outcome: 'succeeded', attempt: 1, elapsedMs: 11});
        const failedReload = {stage: 'reload', outcome: 'retrying', attempt: 1, elapsedMs: 0,
          status: 400, reasonCode: 1038, trackingId: 'safe-tracking', id: 'Service.reqs.generic.failure'};
        const success = {stage: scenario === 'fallback-success' ? 'fallback-login' : 'reload',
          outcome: 'succeeded', attempt: scenario === 'post1035-success' ? 2 : 1, elapsedMs: 29};
        if (scenario === 'reload-success') expect(stages.slice(1)).toEqual([success]);
        else if (scenario === 'fallback-success') expect(stages.slice(1)).toEqual([failedReload, success]);
        else if (scenario === 'fallback-failed') expect(stages.slice(1)).toEqual([failedReload,
          {stage: 'fallback-login', outcome: 'failed', attempt: 1, elapsedMs: 0,
            status: 400, reasonCode: 9999, trackingId: 'safe-tracking', id: 'Service.aqm.agent.stationLogin'}]);
        else expect(stages.slice(1)).toEqual([failedReload,
          {stage: 'fallback-login', outcome: 'retrying', attempt: 1, elapsedMs: 0,
            status: 400, reasonCode: 1035, trackingId: 'safe-tracking', id: 'Service.aqm.agent.stationLogin'}, success]);
        expect(metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS)).toHaveLength(
          ['reload-success', 'post1035-success'].includes(scenario) ? 1 : 0);
        expect(metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED)).toHaveLength(scenario === 'reload-success' ? 0 : 1);
        expect(regionMetrics(metric)).toHaveLength(1);
        expect(regionMetrics(metric)[0][0]).toBe(METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS);
        expect(JSON.stringify([diagnostics(sink), metric.mock.calls])).not.toMatch(/SECRET|options|headers|dialNumber|response|duration_ms/);
        sink.mockRestore(); metric.mockRestore();
      });
    });

  it.each(['auth-401', 'auth-403', 'subscribe-deadline', 'welcome-deadline', 'network', 'success'])(
    'T-012/T-013 optional RTD stage classification %s', async scenario => {
      const admission = createDeferred<any>();
      await withGraph(async ({cc, graph, sockets, flush}) => {
        const sink = jest.spyOn(graph.LoggerProxy, 'info');
        const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
        let elapsedMs = 31;
        if (scenario === 'subscribe-deadline') {elapsedMs = 20000; jest.advanceTimersByTime(elapsedMs);}
        else if (scenario === 'welcome-deadline') {
          admission.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com/?private=URL_SECRET'}});
          await flush(); elapsedMs = 30000; jest.advanceTimersByTime(elapsedMs);
        } else {
          jest.advanceTimersByTime(elapsedMs);
          if (scenario === 'success') {
            admission.resolve({statusCode: 200, body: {webSocketUrl: 'wss://rtd.produs2.cisco.com/?private=URL_SECRET'}});
            await flush(); sockets.find(s => s.url.includes('rtd.')).welcome();
          } else admission.reject(scenario === 'network' ? new Error('https://private.invalid/?TOKEN_SECRET') : secretFailure(Number(scenario.slice(5))));
        }
        await flush();
        expect(diagnostics(sink)).toEqual([{stage: 'rtd', outcome: scenario === 'success' ? 'succeeded' : 'failed', attempt: 1, elapsedMs,
          ...(scenario.startsWith('auth-') ? {status: Number(scenario.slice(5)), reasonCode: 1037, trackingId: 'safe-tracking', reason: 'authentication-failed'} : {}),
          ...(scenario.includes('deadline') ? {id: 'RTD_DEADLINE'} : {}),
          ...(scenario === 'network' ? {id: 'RTD_NETWORK'} : {}),
        }]);
        expect(regionMetrics(metric)).toEqual([]);
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        expect(cc['rtdPaused']).toBe(scenario !== 'success');
        expect(JSON.stringify(diagnostics(sink))).not.toMatch(/SECRET|options|headers|dialNumber|response/);
        sink.mockRestore(); metric.mockRestore();
      }, undefined, {enabled: true, pending: admission.promise});
    });

  it('T-012 reentrant cancellation sink cannot fence replacement timing or publish a false failure', async () => {
    await withGraph(async ({cc, graph, sockets, flush}) => {
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'A'});
      jest.advanceTimersByTime(19);
      const log = sink.getMockImplementation(); let replaced = false;
      sink.mockImplementation((message, context) => {
        if (context?.data?.outcome === 'cancelled' && !replaced) {
          replaced = true;
          cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
          throw new Error('throwing reentrant cancellation sink');
        }
        return log(message, context);
      });
      await expect(cc.stationLogout({logoutReason: 'user'})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      const slot = cc['recoveryAttempt'];
      expect(slot.owner).toBe(cc['recovery']);
      expect(cc['regionStateContext'].trackingId).toBe('B');
      expect(diagnostics(sink).filter(record => record.outcome === 'cancelled')).toEqual([
        {stage: 'admission', outcome: 'cancelled', attempt: 1, elapsedMs: 19},
      ]);
      await flush(); expect(cc['recoveryAttempt']).toBe(slot);
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      expect(regionMetrics(metric).map(([name, data]) => [name, data])).toEqual([
        [METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS, {stage: 'admission', outcome: 'succeeded', attempt: 1, elapsedMs: 105000}],
      ]);
      sink.mockRestore(); metric.mockRestore();
    });
  });

  it.each(['succeeded', 'failed', 'waiting'])(
    'T-012/T-013 auto-Available stage outcome=%s uses its own start and keeps admission metrics separate', async outcome => {
      await withGraph(async h => {
        const {cc, graph, sockets, requests, frame, flush} = h;
        const sink = jest.spyOn(graph.LoggerProxy, 'info');
        const otherLogs = ['log', 'warn', 'error'].map(name => jest.spyOn(graph.LoggerProxy, name));
        const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
        const log = sink.getMockImplementation(); let reply: unknown;
        sink.mockImplementation((message, context) => {
          if (context?.data?.stage === 'auto-available') {
            if (reply) cc['handleWebsocketMessage'](JSON.stringify(reply));
            else cc['handleAutoAvailableVoiceChange']();
            throw new Error('throwing reentrant auto stage sink');
          }
          return log(message, context);
        });
        await restoreAutoAvailable(h, outcome !== 'waiting');
        if (outcome !== 'waiting') {
          const state = requests.filter(r => r.resource === '/v1/agents/session/state')[0];
          jest.advanceTimersByTime(43);
          const type = outcome === 'succeeded' ? CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS : CC_EVENTS.AGENT_STATE_CHANGE_FAILED;
          reply = {...frame(type, state.headers.trackingid, outcome === 'succeeded'
            ? {subStatus: 'Available', auxCodeId: '0', lastStateChangeReason: 'agent-wss-disconnect', lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 2}
            : {reasonCode: '1037', reason: 'REMOTE_SECRET', Authorization: 'TOKEN_SECRET', dialNumber: 'DN_SECRET'}),
            type: CC_EVENTS.AGENT_STATE_CHANGE};
          sockets[1].message(reply); await flush();
        }
        expect(diagnostics(sink).filter(record => record.stage === 'auto-available')).toEqual([
          {stage: 'auto-available', outcome, attempt: 1, elapsedMs: outcome === 'waiting' ? 0 : 43,
            ...(outcome === 'failed' ? {reasonCode: 1037, id: 'Service.aqm.agent.stateChange', trackingId: requests.filter(r => r.resource === '/v1/agents/session/state')[0].headers.trackingid.replace(/^webex-js-sdk_/, '')} : {})},
        ]);
        expect(regionMetrics(metric)).toHaveLength(1);
        expect(regionMetrics(metric)[0][0]).toBe(METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS);
        expect(JSON.stringify([sink.mock.calls, ...otherLogs.map(log => log.mock.calls), metric.mock.calls,
          h.host.internal.support.submitLogs.mock.calls])).not.toMatch(/SECRET|options|headers|dialNumber|response/);
        otherLogs.forEach(log => log.mockRestore()); sink.mockRestore(); metric.mockRestore();
      });
    });

  it.each(['logger', 'metric'])('T-012 reentrant reload %s sink cannot apply obsolete session work', async boundary => {
    await withGraph(async ({cc, graph, sockets, requests, frame, login, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      const apply = jest.spyOn(cc, 'applyRestoredStationEffects');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'A'});
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const replace = () => {
        cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
        throw new Error('reentrant sink');
      };
      const log = sink.getMockImplementation();
      const track = metric.getMockImplementation();
      if (boundary === 'logger') sink.mockImplementation((message, context) => {
        if (context?.data?.stage === 'reload' && context.data.outcome === 'succeeded') return replace();
        return log(message, context);
      });
      else metric.mockImplementation((name, ...args) => {
        if (name === METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS) return replace();
        return track(name, ...args);
      });
      const request = requests.filter(r => r.resource === '/v1/agents/reload')[0];
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, request.headers.trackingid)); await flush();
      expect(apply).not.toHaveBeenCalled();
      expect(cc['regionStateContext'].trackingId).toBe('B');
      expect(cc['recoveryAttempt'].owner).toBe(cc['recovery']);
      expect(regionMetrics(metric)).toEqual([]);
      expect(metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS)).toHaveLength(boundary === 'logger' ? 0 : 1);
      sink.mockRestore(); metric.mockRestore(); apply.mockRestore();
    });
  });

  it('T-012 Welcome identity failure and obsolete optional callbacks stay scoped to their owners', async () => {
    const admission = createDeferred<any>();
    await withGraph(async ({cc, graph, sockets, flush}) => {
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      admission.reject(secretFailure(401)); await flush();
      expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([]);
      jest.advanceTimersByTime(105000); await flush(); jest.advanceTimersByTime(17); sockets[1].welcome('different-agent'); await flush();
      expect(diagnostics(sink).filter(record => record.stage === 'welcome')).toEqual([
        {stage: 'welcome', outcome: 'failed', attempt: 1, elapsedMs: 17},
      ]);
      expect(regionMetrics(metric)).toEqual([]);
      expect(cc['registrationAbortController'].signal.aborted).toBe(true);
      expect(JSON.stringify(diagnostics(sink))).not.toMatch(/SECRET|options|headers|dialNumber|response/);
      sink.mockRestore(); metric.mockRestore();
    }, undefined, {enabled: true, pending: admission.promise});
  });

  it('T-012 attemptFailureDiagnosticsPreserveClassification through real scheduler', async () => {
    await withGraph(async ({cc, graph, host, sockets, flush}) => {
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      const boundary = host.request.getMockImplementation(); let failed = false;
      host.request.mockImplementation(request => {
        if (request.resource === SUBSCRIBE_API && !failed) {
          failed = true;
          return Promise.reject({statusCode: 503, body: {reasonCode: 1037, reason: 'REMOTE_SECRET'},
            headers: {trackingid: 'safe-tracking'}, options: {headers: {authorization: 'TOKEN_SECRET'}, url: 'URL_SECRET'}});
        }
        return boundary(request);
      });
      const sink = jest.spyOn(graph.LoggerProxy.logger, 'info').mockImplementation(() => {throw new Error('diagnostic sink');});
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush();
      const failures = metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED);
      expect(failures).toHaveLength(1);
      expect(failures[0][1]).toEqual({stage: 'admission', outcome: 'retrying', attempt: 1,
        elapsedMs: 105000, status: 503, reasonCode: 1037, trackingId: 'safe-tracking'});
      jest.advanceTimersByTime(62999); await flush(); expect(sockets).toHaveLength(1);
      jest.advanceTimersByTime(1); await flush(); sockets[1].welcome(); await flush();
      const successes = metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS);
      expect(successes).toHaveLength(1);
      expect(successes[0][1]).toEqual({stage: 'admission', outcome: 'succeeded', attempt: 2, elapsedMs: 63000});
      expect(JSON.stringify([...failures, ...successes])).not.toMatch(/SECRET|response|options|duration_ms/);
      sink.mockRestore(); metric.mockRestore();
    });
  });

  it('T-012 regionDiagnosticSupersessionOwnsElapsed for A then B with late A failure', async () => {
    await withGraph(async ({cc, graph, host, sockets, flush}) => {
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const pending = createDeferred<any>(); const boundary = host.request.getMockImplementation();
      host.request.mockImplementationOnce(request => request.resource === SUBSCRIBE_API ? pending.promise : boundary(request));
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'A'});
      jest.advanceTimersByTime(105000); await flush();
      cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
      const slotB = cc['recoveryAttempt']; expect(slotB.owner).toBe(cc['recovery']);
      const beforeLate = diagnostics(sink);
      expect(beforeLate.filter(record => record.outcome === 'cancelled')).toEqual([
        {stage: 'admission', outcome: 'cancelled', attempt: 1, elapsedMs: 105000},
      ]);
      pending.reject({statusCode: 503, body: {reason: 'INTERNAL_ERROR'}}); await flush();
      expect(cc['recoveryAttempt']).toBe(slotB);
      expect(diagnostics(sink)).toEqual(beforeLate);
      expect(metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.REGION_RECOVERY_FAILED)).toHaveLength(0);
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const records = metric.mock.calls.filter(([name]) => name === METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS);
      expect(records).toHaveLength(1); expect(records[0][1].elapsedMs).toBe(105000);
      expect(cc['recoveryAttempt']).toBeUndefined();
      sink.mockRestore(); metric.mockRestore();
    });
  });

  it('T-012 throwingWelcomeAndReloadNotificationStillReady / throwingObserverLoggerMetricsCannotStopCleanupOrSuccess', async () => {
    await withGraph(async ({cc, graph, host, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const logger = graph.LoggerProxy.logger;
      const sinks = ['log', 'info', 'warn', 'error'].map(name => jest.spyOn(logger, name).mockImplementation(() => {throw new Error('logger sink');}));
      const originalMetric = cc.metricsManager.trackEvent.bind(cc.metricsManager);
      const metric = jest.spyOn(cc.metricsManager, 'trackEvent').mockImplementation((name, ...args) => {
        if (name === METRIC_EVENT_NAMES.REGION_RECOVERY_SUCCESS) throw new Error('metric sink');
        return originalMetric(name, ...args);
      });
      const early = () => {throw new Error('early internal listener');};
      cc.services.webSocketManager.prependListener('message', early);
      const later = jest.fn(); cc.services.webSocketManager.on('message', later);
      const ready = jest.fn(); cc.on('region:stateChange', ready);
      const skipped = jest.fn(); const all = jest.fn(); const specialized = jest.fn();
      cc.on(CC_EVENTS.AGENT_RELOGIN_SUCCESS, () => {throw new Error('host');});
      cc.on(CC_EVENTS.AGENT_RELOGIN_SUCCESS, skipped); cc.on('all', all);
      cc.on(AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, specialized);
      const reload = jest.spyOn(cc.services.agent, 'reload');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const request = requests.filter(r => r.resource === '/v1/agents/reload')[0];
      const response = frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, request.headers.trackingid);
      sockets[1].message(response); await flush();
      await expect(reload.mock.results[0].value).resolves.toEqual(response);
      expect(skipped).not.toHaveBeenCalled(); expect(specialized).toHaveBeenCalledTimes(1);
      expect(all.mock.calls.filter(([name]) => name === CC_EVENTS.AGENT_RELOGIN_SUCCESS)).toHaveLength(0);
      expect(ready.mock.calls.filter(([state]) => state.status === 'ready')).toHaveLength(1);
      expect(later).toHaveBeenCalled();
      for (let tick = 0; tick < 12; tick += 1) {jest.advanceTimersByTime(5000); sockets[1].message({keepalive: 'true'}); await flush();}
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      cc.services.webSocketManager.removeListener('message', early);
      sinks.forEach(sink => sink.mockRestore()); metric.mockRestore(); reload.mockRestore();
    });
  });

  // Hold only HTTP at an external boundary. The recovery scheduler, AQM aborts,
  // notification correlation and socket ownership continue to run normally.
  const holdRecoveryWork = async (h, phase = 'reload', trackingId = 'switch') => {
    const {cc, host, requests, sockets, flush} = h;
    const pending = createDeferred<any>();
    const boundary = host.request.getMockImplementation();
    let held = false;
    host.request.mockImplementation(request => {
      if (phase !== 'wait' && !held && request.resource === (phase === 'admission' ? SUBSCRIBE_API : '/v1/agents/reload')) {
        held = true; requests.push(request); return pending.promise;
      }
      return boundary(request);
    });
    const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
    const reload = jest.spyOn(cc.services.agent, 'reload');
    cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId}));
    const observed = driver.mock.results[0].value.then(value => ({value}), error => ({error}));
    const options = driver.mock.calls[0][0];
    if (phase !== 'wait') { jest.advanceTimersByTime(105000); await flush(); }
    if (phase === 'reload') {
      sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
      expect(reload).toHaveBeenCalledTimes(1);
      reload.mock.results[0].value.catch(() => undefined);
    }
    if (phase !== 'wait') expect(held).toBe(true);
    return {pending, observed, options, driver, reload, recovery: cc['recovery'],
      release: async (success: boolean) => {
        if (phase === 'wait') return;
        if (success) pending.resolve({statusCode: 200, body: {webSocketUrl: 'wss://obsolete.produs2.cisco.com/'}});
        else pending.reject({statusCode: 503, body: {reason: 'INTERNAL_ERROR'}});
        await flush();
      }};
  };
  const lifecycleOwner = cc => ({
    registration: [cc['registrationGeneration'], cc['registrationAbortController'],
      cc['registrationAbortController']?.signal.aborted, cc['registrationAgentId']],
    recovery: [cc['recoveryGeneration'], cc['recovery'], cc['recovery']?.controller.signal.aborted,
      cc['recoveryPhase'], cc['sessionRequest'], cc['sessionRequest']?.controller.signal.aborted,
      cc['commandController']?.signal.aborted],
    station: [cc['stationRevision'], cc['acceptedStation'], cc['priorStationActive'], cc['currentAgentSessionId'],
      cc['acceptedStation'] && {...cc['acceptedStation'], payload: {...cc['acceptedStation'].payload}}],
    history: [...cc['acceptedSwitchIds']],
    profile: cc.agentConfig && {...cc.agentConfig},
    publication: cc['lastPublishedRegionState'],
    settings: {...cc['multiRegionSettings']},
    primary: [cc.services.webSocketManager.hasUsableSocket(), cc.services.webSocketManager.getServingRegion()],
    mode: cc.services.connectionService['mode'],
  });

  it('T-012 throwingRegionObserverCannotStopTerminalSettlementCleanupOrFenceLateResults', async () => {
    await withGraph(async h => {
      const {cc, sockets, requests, host, login, frame, flush} = h;
      await login(); cc.$config.allowAutomatedRelogin = true;
      const rtd = sockets.find(socket => socket.url.includes('rtd.'));
      rtd.welcome(); await flush();
      const epoch = cc['rtdEpoch'];
      const lateRtdMessage = rtd.onmessage;
      expect(epoch.active).toBe(true);
      expect(cc.services.rtdWebSocketManager.hasUsableSocket()).toBe(true);
      const first = jest.fn(() => {throw new Error('region host');});
      const later = jest.fn(); const all = jest.fn();
      cc.on('region:stateChange', first); cc.on('region:stateChange', later); cc.on('all', all);
      const old = await holdRecoveryWork(h);
      const primary = sockets.filter(socket => socket.url.includes('routing.')).slice(-1)[0];
      const latePrimaryMessage = primary.onmessage;
      const reload = requests.filter(request => request.resource === '/v1/agents/reload').slice(-1)[0];
      // Observe the actual scheduler operation; the host handler itself returns void.
      const operation = old.driver.mock.results[0].value;
      const resolved = jest.fn(); const rejected = jest.fn();
      const settled = operation.then(resolved, rejected);
      expect(operation).toBeInstanceOf(Promise);
      expect(resolved).not.toHaveBeenCalled(); expect(rejected).not.toHaveBeenCalled();
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      old.pending.reject({statusCode: 401, body: {reasonCode: 1037}});
      await expect(operation).rejects.toMatchObject({data: {kind: 'authentication-failed', status: 401}});
      await settled; await flush();
      const terminal = {status: 'unavailable', reason: 'authentication-failed', trackingId: 'switch', homeRegion: 'produs1'};
      expect(first.mock.calls.slice(-1)).toEqual([[terminal]]);
      expect(first.mock.calls.filter(([state]) => state.status === 'unavailable')).toEqual([[terminal]]);
      expect(later).not.toHaveBeenCalled();
      expect(all.mock.calls.filter(([name]) => name === 'region:stateChange')).toEqual([]);
      expect(cc['lastPublishedRegionState']).toEqual(terminal);
      expect(resolved).not.toHaveBeenCalled(); expect(rejected).toHaveBeenCalledTimes(1);
      expect(rejected.mock.calls[0][0]).toBe((await old.observed).error);
      expect(cc.services.connectionService['mode']).toBe('stopped');
      expect(cc.services.connectionService['invocation']).toBeUndefined();
      expect(old.recovery.controller.signal.aborted).toBe(true);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(false);
      expect(cc.services.rtdWebSocketManager.hasUsableSocket()).toBe(false);
      expect(cc.services.webSocketManager.getServingRegion()).toBeUndefined();
      expect(cc.services.aqmReqs['operations'].size).toBe(0);
      expect(cc['sessionRequest']).toBeUndefined();
      expect(cc['rtdEpoch']).toBeUndefined(); expect(cc['rtdPaused']).toBe(true);
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
      expect(sockets.every(socket => socket.close.mock.calls.length === 1)).toBe(true);
      const owner = lifecycleOwner(cc); const requestCount = host.request.mock.calls.length;
      const publications = [...first.mock.calls];
      const delivered = jest.fn(); cc.on(AGENT_EVENTS.AGENT_RELOGIN_SUCCESS, delivered);
      const realtime = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
      const late = frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid, {agentSessionId: 'obsolete'});
      primary.message(late); latePrimaryMessage?.({data: JSON.stringify(late)});
      lateRtdMessage?.({data: JSON.stringify({type: CC_EVENTS.REAL_TIME_TRANSCRIPTION})});
      await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
        .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      jest.advanceTimersByTime(600000); await flush();
      expect(lifecycleOwner(cc)).toEqual(owner);
      expect(host.request).toHaveBeenCalledTimes(requestCount);
      expect(first.mock.calls).toEqual(publications);
      expect(delivered).not.toHaveBeenCalled();
      expect(realtime).not.toHaveBeenCalled();
      expect(resolved).not.toHaveBeenCalled(); expect(rejected).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
      realtime.mockRestore(); old.driver.mockRestore(); old.reload.mockRestore();
    }, undefined, {enabled: true});
  });

  it.each(['admission', 'reload'].flatMap(phase => [undefined, 'session'].flatMap(session =>
    [false, true].map(success => [phase, session, success]))))(
    'T-012 targetedMultiLogin during %s session=%s lateSuccess=%s', async (phase, session, success) => {
      await withGraph(async h => {
        const {cc, sockets, requests, frame, login, flush, host} = h;
        await login(); cc.$config.allowAutomatedRelogin = true;
        const generation = cc['registrationGeneration'];
        const registration = cc['registrationAbortController'];
        const old = await holdRecoveryWork(h, phase);
        const forwarded: any[] = [];
        cc.on(AGENT_EVENTS.AGENT_MULTI_LOGIN, data => forwarded.push({data,
          registrationAborted: registration.signal.aborted,
          recoveryAborted: old.recovery.controller.signal.aborted,
          mode: cc.services.connectionService['mode'],
          primaryUsable: cc.services.webSocketManager.hasUsableSocket(),
          history: [...cc['acceptedSwitchIds']],
          station: cc['acceptedStation'], active: cc['priorStationActive'],
        }));
        const data = {type: 'AgentMultiLoginCloseSession', ...(session ? {agentSessionId: session} : {})};
        const notification = {type: CC_EVENTS.AGENT_MULTI_LOGIN, data};
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        if (phase === 'reload') primary.message(notification);
        // A queued primary notification can be handed to the plugin during HTTP admission.
        else cc.services.webSocketManager.emit('message', JSON.stringify(notification));
        await flush();
        expect(forwarded).toEqual([{data, registrationAborted: true, recoveryAborted: true,
          mode: 'stopped', primaryUsable: false, history: [], station: undefined, active: false}]);
        expect(cc['registrationGeneration']).toBe(generation + 1);
        expect((await old.observed).error.data.kind).toBe('cancelled');
        const states = jest.fn(); cc.on('region:stateChange', states);
        const owner = lifecycleOwner(cc); const count = host.request.mock.calls.length;
        const socketCount = sockets.length;
        await old.release(success);
        primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, requests.filter(r => r.resource === '/v1/agents/reload')[0]?.headers.trackingid, {agentSessionId: 'obsolete'}));
        await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'}));
        jest.advanceTimersByTime(600000); await flush();
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(host.request).toHaveBeenCalledTimes(count);
        expect(sockets).toHaveLength(socketCount);
        expect(states).not.toHaveBeenCalled();
        expect(old.driver).toHaveBeenCalledTimes(1);
        expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
      });
    }
  );

  it.each(['register', 'deregister', 'org replacement', 'agent replacement'].flatMap(boundary =>
    ['wait', 'reload'].map(phase => [boundary, phase])).concat([['reload identity replacement', 'reload']]))(
    'T-012 sharedRegistrationGenerationFencesWellnessAndRecovery: %s during %s', async (boundary, phase) => {
      await withGraph(async h => {
        const {cc, host, requests, sockets, login, frame, flush} = h;
        await login(); cc.$config.allowAutomatedRelogin = true;
        cc.agentConfig.isWellnessBreakEnabled = true;
        const idleCode = createDeferred<any>();
        const requestBoundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource.includes('customFilter=isSystemCode==true')) {
            requests.push(request); return idleCode.promise;
          }
          return requestBoundary(request);
        });
        const wellness = cc.getWellbeingBreakIdleCode();
        const staleWellness = expect(wellness).rejects.toThrow('WELLNESS_BREAK_REGISTRATION_CHANGED');
        await flush();
        expect(requests.filter(r => r.resource.includes('customFilter=isSystemCode==true'))).toHaveLength(1);
        const old = await holdRecoveryWork(h, phase);
        const generation = cc['registrationGeneration'];
        const registration = cc['registrationAbortController'];
        const oldPrimary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const reloadRequest = requests.filter(r => r.resource === '/v1/agents/reload')[0];
        cc.$config.allowAutomatedRelogin = false;
        let operation = Promise.resolve();
        if (boundary === 'register') operation = cc.register();
        if (boundary === 'deregister') operation = cc.deregister();
        operation.catch(() => undefined);
        if (boundary === 'org replacement') {
          host.credentials.getOrgId = () => 'replacement-org';
          if (phase === 'wait') { jest.advanceTimersByTime(105000); await flush(); }
          else {
            await old.release(true);
            oldPrimary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloadRequest.headers.trackingid));
          }
        }
        if (boundary === 'agent replacement') {
          if (phase === 'wait') { jest.advanceTimersByTime(105000); await flush(); }
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome('replacement-agent');
        }
        if (boundary === 'reload identity replacement') {
          await old.release(true);
          oldPrimary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloadRequest.headers.trackingid,
            {agentId: 'replacement-agent', agentSessionId: 'obsolete'}));
        }
        await flush();
        expect(cc['registrationGeneration']).toBe(generation + 1);
        expect(registration.signal.aborted).toBe(true);
        expect(old.recovery.controller.signal.aborted).toBe(true);
        expect([...cc['acceptedSwitchIds']]).toEqual([]);
        expect(cc['acceptedStation']).toBeUndefined();
        expect(cc['priorStationActive']).toBe(false);
        expect((await old.observed).error).toBeDefined();
        if (boundary === 'register') {
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
        }
        await operation;
        // Even re-enabling wellness on a replacement cannot make the old read current.
        if (cc.agentConfig) cc.agentConfig.isWellnessBreakEnabled = true;
        const owner = lifecycleOwner(cc); const count = host.request.mock.calls.length;
        const socketCount = sockets.length;
        const states = jest.fn(); cc.on('region:stateChange', states);
        idleCode.resolve({statusCode: 200, body: {data: [{id: 'old-idle', name: 'WellbeingBreak',
          active: true, isSystemCode: true}], meta: {totalPages: 1}}});
        await staleWellness; await old.release(false); await flush();
        if (reloadRequest) oldPrimary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS,
          reloadRequest.headers.trackingid, {agentSessionId: 'obsolete'}));
        await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(cc['wellbeingBreakIdleCode']).toBeUndefined();
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(host.request).toHaveBeenCalledTimes(count);
        expect(sockets).toHaveLength(socketCount);
        expect(states).not.toHaveBeenCalled();
      });
    }
  );

  it.each(['failed-logout/silent-relogin', 'failed-logout/public-login', 'remote/recovering', 'remote/ready-cancelled'])(
    'T-012 cancelledDrRestoresOrdinaryTaskSession: %s', async boundary => {
      await withGraph(async h => {
        const {cc, requests, sockets, login, frame, flush} = h;
        if (boundary === 'remote/ready-cancelled') await restoreAutoAvailable(h, false);
        else await login();
        cc.$config.allowAutomatedRelogin = true;
        const registration = cc['registrationAbortController'];
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const listeners = cc.services.webSocketManager.listenerCount('message');
        const {task, data, deliver} = offerRetainedTask(h);
        const lifetime = task['recoveryGuard'];
        const controls = jest.fn(); task.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, controls);
        const ended = jest.fn(); task.on(TASK_EVENTS.TASK_END, ended);
        cc.on(TASK_EVENTS.TASK_END, ended);
        const hydrated = jest.fn(); cc.on(TASK_EVENTS.TASK_HYDRATE, hydrated);
        const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
        const summaries = jest.spyOn(cc.taskManager, 'clearAISummaryState');
        const start = jest.spyOn(cc.taskManager, 'startSession');
        cc.taskManager['pendingFeatureEnablement'].set('cached', {interactionId: 'cached'});
        cc.taskManager['receivingSummaryBuffer'].set('cached', {conversationId: 'cached'});
        if (boundary.startsWith('remote/')) {
          cc.on('region:stateChange', state => {
            if (boundary === 'remote/recovering' ? state.status === 'recovering'
              : state.status === 'ready' && state.autoAvailable === 'cancelled') {
              primary.message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'remote'), type: CC_EVENTS.AGENT_LOGOUT});
            }
          });
        }
        primary.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'cancelled-switch'});
        if (boundary.startsWith('failed-logout/')) {
          expect(cc.taskManager.getTask(data.interactionId)).toBe(task);
          expect(controls).not.toHaveBeenCalled();
          await expect(cc.stationLogout({logoutReason: 'during wait'})).rejects.toMatchObject({
            data: {reason: 'RECOVERY_INTERRUPTED'},
          });
          expect(cc['suppressAutomaticRelogin']).toBe(false);
          expect(cc['acceptedStation']).toBeDefined();
        } else {
          expect(cc['acceptedStation']).toBeUndefined();
          expect(cc['suppressAutomaticRelogin']).toBe(true);
        }
        await flush();
        expect(cc['recovery']).toBeUndefined();
        expect(cc['recoveryPhase']).toBe('idle');
        expect(cc.services.connectionService['mode']).toBe('ordinary');
        expect(registration.signal.aborted).toBe(false);
        expect(lifetime.signal.aborted).toBe(true);
        expect(cc.taskManager.getAllTasks()).toEqual({});
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);
        expect(summaries.mock.invocationCallOrder.slice(-1)[0]).toBeGreaterThan(cleanup.mock.invocationCallOrder[0]);
        expect(start.mock.invocationCallOrder[0]).toBeGreaterThan(summaries.mock.invocationCallOrder.slice(-1)[0]);
        expect(controls.mock.calls).toEqual([[task.uiControls]]);
        for (const leg of [task.uiControls.main, task.uiControls.consult])
          expect(Object.values(leg).every((control: any) => !control.isEnabled)).toBe(true);
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
        expect(cc.taskManager['receivingSummaryBuffer'].size).toBe(0);
        await expect(task.end()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        expect(ended).not.toHaveBeenCalled();

        // Both a missing primary and a later primary loss retain the ordinary five-second path.
        if (primary.readyState === 1) primary.lost();
        const subscriptions = requests.filter(r => r.resource === SUBSCRIBE_API).length;
        if (boundary.endsWith('public-login')) cc.$config.allowAutomatedRelogin = false;
        jest.advanceTimersByTime(4999); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions);
        jest.advanceTimersByTime(1); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions + 1);
        const replacement = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        expect(replacement).not.toBe(primary);
        replacement.welcome(); await flush();
        if (boundary.endsWith('silent-relogin')) {
          const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
          replacement.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid)); await flush();
          expect(cc['acceptedStation']).toBeDefined();
        } else if (boundary.endsWith('public-login')) await login();
        deliver(CC_EVENTS.AGENT_CONTACT, {interaction: {...data.interaction, state: 'connected'}});
        const fresh = cc.taskManager.getTask(data.interactionId);
        expect(fresh).toBeDefined();
        expect(fresh).not.toBe(task);
        expect(fresh.state.value).toBe('CONNECTED');
        expect(fresh['recoveryGuard'].signal.aborted).toBe(false);
        expect(hydrated.mock.calls).toEqual([[fresh]]);
        expect(offerRetainedTask(h, 'ordinary-offer').task).not.toBe(task);
        expect(ended).not.toHaveBeenCalled();
        deliver(CC_EVENTS.CONTACT_ENDED, {interaction: {...data.interaction, state: 'terminated'}, wrapUpRequired: false});
        expect(fresh.data.type).toBe(CC_EVENTS.CONTACT_ENDED);
        expect(task.data.type).toBe(CC_EVENTS.AGENT_CONTACT_ASSIGNED);
        expect(cc.services.webSocketManager.listenerCount('message')).toBe(listeners);
        expect(cleanup).toHaveBeenCalledTimes(1);
      });
    }
  );

  it.each(['logout', 'register', 'deregister', 'terminal'])(
    'T-012 interruptedTaskCleanupRechecksOwnerAfterObserver: %s', async boundary => {
      await withGraph(async h => {
        const {cc, requests, sockets, frame, login, flush} = h;
        await login();
        const {task, data} = offerRetainedTask(h);
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'manual-switch'});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        expect(cc['recoveryPhase']).toBe('manualLoginRequired');
        const start = jest.spyOn(cc.taskManager, 'startSession');
        const ended = jest.fn(); cc.on(TASK_EVENTS.TASK_END, ended);
        const duringCleanup: unknown[] = [];
        let operation: Promise<any>;
        task.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, () => {
          if (boundary === 'logout') operation = cc.stationLogout({logoutReason: 'controls observer'});
          else if (boundary === 'register') operation = cc.register();
          else if (boundary === 'deregister') operation = cc.deregister();
          else cc['requireRegionReload']();
          operation?.catch(() => undefined);
          // A freshly installed nested guard cannot admit frames until all old cleanup finishes.
          sockets[1].message({type: 'RoutingMessage', data: {...data, type: CC_EVENTS.AGENT_CONTACT}});
          duringCleanup.push({...cc.taskManager.getAllTasks()});
        });
        await expect(cc.stationLogin({teamId: 'replacement', loginOption: LoginOption.EXTENSION, dialNumber: '5678'}))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await flush();
        expect(duringCleanup).toEqual([{}]);
        expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
        if (boundary === 'logout') {
          sockets[1].message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'observer'), type: CC_EVENTS.AGENT_LOGOUT});
          await operation;
          expect(start).toHaveBeenCalledTimes(1); // The nested ordinary station owns this start.
          expect(cc.services.connectionService['mode']).toBe('ordinary');
          expect(offerRetainedTask(h, data.interactionId).task).not.toBe(task);
        } else if (boundary === 'register') {
          expect(start).not.toHaveBeenCalled();
          sockets[2].welcome(); await operation;
          expect(start).toHaveBeenCalledTimes(1); // Only the replacement registration may start.
        } else {
          await operation;
          expect(start).not.toHaveBeenCalled();
          expect(cc.services.connectionService['mode']).toBe('stopped');
          expect(cc.taskManager['recoveryGuard']?.signal.aborted ?? true).toBe(true);
        }
        await expect(task.end()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
        expect(ended).not.toHaveBeenCalled();
      });
    }
  );

  it.each(['unavailable', 'reloadRequired'])(
    'T-012 remoteLogoutCannotReopenTerminalRegistration: %s', async phase => {
      await withGraph(async ({cc, login, frame, requests, flush}) => {
        await login();
        if (phase === 'unavailable') cc['handleRecoveryTerminal']({data: {kind: 'unavailable'}});
        else cc['requireRegionReload']();
        const reset = jest.spyOn(cc.services.connectionService, 'reset');
        const start = jest.spyOn(cc.taskManager, 'startSession');
        cc['reconcileStationNotification'](frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'remote'));
        expect(cc['recoveryPhase']).toBe(phase);
        expect(cc.services.connectionService['mode']).toBe('stopped');
        expect(cc.taskManager['recoveryGuard'].signal.aborted).toBe(true);
        expect(reset).not.toHaveBeenCalled();
        expect(start).not.toHaveBeenCalled();
        const subscriptions = requests.filter(r => r.resource === SUBSCRIBE_API).length;
        jest.advanceTimersByTime(105000); await flush();
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions);
      });
    }
  );

  it.each([
    ['stationLogoutOrdinaryReconnectPreserved', 'ordinary'],
    ['stationLogoutDuringDrKeepsUsablePrimary', 'reload'],
    ['stationLogoutDuringDrWithoutPrimaryReconnectAndLogin', 'wait'],
  ])('T-012 %s', async (_name, phase) => {
    await withGraph(async h => {
      const {cc, requests, sockets, login, frame, flush} = h;
      await login(); cc.$config.allowAutomatedRelogin = true;
      const registration = cc['registrationAbortController'];
      const generation = cc['registrationGeneration'];
      const old = phase === 'ordinary' ? undefined : await holdRecoveryWork(h, phase);
      if (phase === 'reload') {
        await old.release(true);
        const request = requests.filter(r => r.resource === '/v1/agents/reload')[0];
        sockets.filter(s => s.url.includes('routing.')).slice(-1)[0]
          .message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, request.headers.trackingid));
        await old.observed; await flush();
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
      }
      const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
      const reset = jest.spyOn(cc.services.connectionService, 'reset');
      const logout = cc.stationLogout({logoutReason: 'user'});
      const observed = logout.catch(() => undefined); await flush();
      if (phase === 'wait') {
        await expect(logout).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(0);
        expect(cc['acceptedStation']).toBeDefined();
      } else {
        expect(primary.close).not.toHaveBeenCalled();
        expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
        primary.message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'), type: CC_EVENTS.AGENT_LOGOUT});
        await logout; expect(cc['acceptedStation']).toBeUndefined();
        expect(cc['priorStationActive']).toBe(false);
      }
      await observed; await flush();
      expect(cc['registrationGeneration']).toBe(generation);
      expect(registration.signal.aborted).toBe(false);
      if (old) {
        expect(reset).toHaveBeenCalledWith(expect.objectContaining({recoverIfDisconnected: true, signal: registration.signal}));
        if (phase === 'wait') expect((await old.observed).error.data.kind).toBe('cancelled');
        const owner = lifecycleOwner(cc);
        await old.release(false);
        await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'}));
        expect(lifecycleOwner(cc)).toEqual(owner);
      } else expect(reset).not.toHaveBeenCalled();
      if (phase !== 'wait') primary.lost();
      const subscriptions = requests.filter(r => r.resource === SUBSCRIBE_API).length;
      jest.advanceTimersByTime(4999); await flush();
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions);
      jest.advanceTimersByTime(1); await flush();
      const replacement = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
      expect(replacement).not.toBe(primary); replacement.welcome(); await flush();
      if (phase === 'wait') {
        const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
        replacement.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid)); await flush();
      }
      const states = jest.fn(); cc.on('region:stateChange', states);
      await login(LoginOption.EXTENSION, 'later-session');
      expect(cc['acceptedStation'].sessionId).toBe('later-session');
      expect(cc['priorStationActive']).toBe(true);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(states.mock.calls).toEqual([[{status: 'ready', reason: 'initial-login',
        homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false}]]);
      if (old) {
        const owner = lifecycleOwner(cc);
        replacement.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(old.driver).toHaveBeenCalledTimes(1);
      }
      reset.mockRestore();
    });
  });

  it('T-013 oldPublicSignaturesVoiceControls registration and operation-specific Promise settlement', async () => {
    await withGraph(async ({cc, graph, requests, sockets, frame, flush}) => {
      const watch = (promise: Promise<unknown>) => {
        const settled = jest.fn(); promise.then(settled, settled);
        return settled;
      };
      const registered = cc.register(); const registrationSettled = watch(registered);
      expect(registered).toBeInstanceOf(Promise);
      await flush();
      expect(registrationSettled).not.toHaveBeenCalled();
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toEqual([]);
      sockets[0].readyState = 1; sockets[0].onopen?.(); await flush();
      expect(registrationSettled).not.toHaveBeenCalled();
      sockets[0].message({type: 'Welcome', data: {agentId: 'agent'}});
      const profile = await registered; await flush();
      expect(profile).toBe(cc.agentConfig);
      expect(profile.agentId).toBe('agent');
      expect(cc['acceptedStation']).toBeUndefined();
      expect(registrationSettled).toHaveBeenCalledTimes(1);
      // Human station login has not been requested and is not a registration prerequisite.
      expect(requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource))).toEqual([]);

      const login = cc.stationLogin({teamId: 'team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
      const loginSettled = watch(login); await flush();
      const loginId = requests.find(r => r.resource === '/v1/agents/login').headers.trackingid;
      expect(loginSettled).not.toHaveBeenCalled(); // HTTP acknowledgement is not station completion.
      sockets[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, loginId)); await flush();
      expect(loginSettled).not.toHaveBeenCalled();
      const loginResponse = {...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, 'server-assigned-id'), type: CC_EVENTS.AGENT_STATION_LOGIN};
      sockets[0].message(loginResponse);
      const {channelsMap, ...loginData} = loginResponse.data;
      await expect(login).resolves.toEqual({...loginData, notifsTrackingId: 'outer',
        mmProfile: {chat: undefined, email: undefined, social: undefined, telephony: undefined}});
      await flush(); expect(loginSettled).toHaveBeenCalledTimes(1);

      const state = cc.setAgentState({state: 'Idle', auxCodeId: 'break'});
      const stateSettled = watch(state); await flush();
      const stateId = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0].headers.trackingid;
      expect(stateSettled).not.toHaveBeenCalled();
      sockets[0].message(loginResponse); await flush();
      expect(stateSettled).not.toHaveBeenCalled();
      const stateResponse = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, stateId,
        {auxCodeId: 'break'}), type: CC_EVENTS.AGENT_STATE_CHANGE};
      sockets[0].message(stateResponse);
      await expect(state).resolves.toEqual(stateResponse);
      await flush(); expect(stateSettled).toHaveBeenCalledTimes(1);

      const logout = cc.stationLogout({logoutReason: 'User requested logout'});
      const logoutSettled = watch(logout); await flush();
      expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(1);
      expect(logoutSettled).not.toHaveBeenCalled();
      sockets[0].message(stateResponse); await flush();
      expect(logoutSettled).not.toHaveBeenCalled();
      const logoutResponse = {...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'), type: CC_EVENTS.AGENT_LOGOUT};
      sockets[0].message(logoutResponse);
      await expect(logout).resolves.toEqual(logoutResponse);
      await flush(); expect(logoutSettled).toHaveBeenCalledTimes(1);
      expect(cc.getVoiceConnectionState()).toEqual({status: 'not-required', lineStatus: 'unknown', mobiusSocketStatus: 'unknown'});
      expect(cc.services).toBeInstanceOf(graph.Services);
      const deregistered = cc.deregister(); const deregistrationSettled = watch(deregistered);
      expect(deregistered).toBeInstanceOf(Promise);
      await expect(deregistered).resolves.toBeUndefined(); await flush();
      expect(deregistrationSettled).toHaveBeenCalledTimes(1);
      expect(sockets[0].close).toHaveBeenCalled();
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(false);
    }, undefined, {}, {autoRegister: false});
  });

  it('T-012 realRecoveryWiringUsesActualCollaborators and no-prior ordered policy', async () => {
    await withGraph(async ({cc, requests, sockets, flush}) => {
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      expect(listener.mock.calls[0][0].status).toBe('recovering');
      jest.advanceTimersByTime(99999); await flush();
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
      jest.advanceTimersByTime(10001); await flush();
      expect(sockets).toHaveLength(2); sockets[1].welcome(); await flush();
      expect(listener.mock.calls.slice(-1)[0][0].status).toBe('stationLoginRequired');
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
    });
  });

  it('T-012 drSuccessThenLogoutKeepsRestoredPrimary', async () => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush();
      const primary = sockets[1];
      primary.message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'early-logout'), type: CC_EVENTS.AGENT_LOGOUT});
      await flush();
      expect(cc['acceptedStation']).toBeDefined();
      expect(cc['lastPublishedRegionState'].status).toBe('recovering');
      primary.welcome(); await flush();
      const reload = requests.find(r => r.resource === '/v1/agents/reload');
      const recovery = cc['recovery'];
      let logout;
      let observed;
      cc.on('region:stateChange', state => {
        if (state.status === 'ready' && !logout) {
          logout = cc.stationLogout({logoutReason: 'user'});
          observed = logout.catch(() => undefined);
        }
      });
      primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await flush();
      expect(logout).toBeDefined();
      expect(recovery.controller.signal.aborted).toBe(true);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(primary.close).not.toHaveBeenCalled();
      const request = requests.find(r => r.resource === '/v1/agents/logout');
      expect(request).toBeDefined();
      const response = {...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'),
        type: CC_EVENTS.AGENT_LOGOUT};
      primary.message(response);
      await expect(logout).resolves.toEqual(response); await observed; await flush();
      expect(cc['acceptedStation']).toBeUndefined();
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(sockets).toHaveLength(2);
    });
  });

  it.each([false, true])('T-012 interrupted pending logout permits restoration and fences stale replies: success=%s', async success => {
    await withGraph(async ({cc, host, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const accepted = cc['acceptedStation'];
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      const http = createDeferred<any>();
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource !== '/v1/agents/logout') return boundary(request);
        requests.push(request);
        return http.promise;
      });
      const oldMessage = sockets[0].onmessage;
      const logout = cc.stationLogout({logoutReason: 'user'});
      const rejected = expect(logout).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      await flush();
      expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(1);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'during-logout'});
      await rejected; await flush();
      expect(cc['logoutPending']).toBe(false);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['acceptedStation']).toBe(accepted);
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(cc['acceptedStation']).toBe(accepted);
      const reload = requests.find(r => r.resource === '/v1/agents/reload');
      expect(reload).toBeDefined();
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await flush();
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'ready',
        reason: 'region-switch', trackingId: 'during-logout'});
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(1);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(cc['recovery'].cleaned).toBe(true);
      expect(cc['sessionRequest']).toBeUndefined();
      const restored = cc['acceptedStation'];
      const state = cc['lastPublishedRegionState'];
      if (success) http.resolve({statusCode: 200, body: {}});
      else http.reject({statusCode: 400});
      oldMessage({data: JSON.stringify({...frame(success ? CC_EVENTS.AGENT_LOGOUT_SUCCESS
        : CC_EVENTS.AGENT_LOGOUT_FAILED, 'old-logout'), type: CC_EVENTS.AGENT_LOGOUT})});
      await flush();
      expect(cc['acceptedStation']).toBe(restored);
      expect(cc['lastPublishedRegionState']).toBe(state);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['logoutPending']).toBe(false);
      sockets[1].message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'supervisor'), type: CC_EVENTS.AGENT_LOGOUT});
      await flush();
      expect(cc['acceptedStation']).toBeUndefined();
      expect(cc['priorStationActive']).toBe(false);
      expect(cc['currentAgentSessionId']).toBeUndefined();
      expect(cc['suppressAutomaticRelogin']).toBe(true);
      jest.advanceTimersByTime(5000); await flush();
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(sockets).toHaveLength(2);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'after-logout'});
      jest.advanceTimersByTime(105000); await flush(); sockets[2].welcome(); await flush();
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'stationLoginRequired', reason: 'region-switch'});
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(1);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
      expect(cleanup).toHaveBeenCalledTimes(1); // Only automatic restoration wipes station state.
      await login();
      expect(cc['logoutPending']).toBe(false);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      cleanup.mockRestore();
    });
  });

  it.each([false, true])('T-012 confirmed logout before Welcome takes no-prior branch with automation=%s', async automate => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = automate;
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      const logout = cc.stationLogout({logoutReason: 'user'});
      const observed = logout.catch(() => undefined);
      await flush();
      expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(1);
      sockets[0].message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'),
        type: CC_EVENTS.AGENT_LOGOUT});
      await logout; await observed; await flush();
      expect(cc['priorStationActive']).toBe(false);
      expect(cc['acceptedStation']).toBeUndefined();
      expect(cc['suppressAutomaticRelogin']).toBe(true);
      const profile = {...cc.agentConfig};
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'after-confirmed-logout'});
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'stationLoginRequired',
        reason: 'region-switch', trackingId: 'after-confirmed-logout'});
      expect(cc.agentConfig).toEqual(profile);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  it.each([false, true])('T-010 rejectedLogoutResumesFreshRtdForRetainedLiveTasks afterRecovery=%s', async afterRecovery => {
    await withGraph(async ({cc, host, requests, sockets, login, frame, flush}) => {
      await login();
      if (afterRecovery) {
        cc.$config.allowAutomatedRelogin = true;
        jest.spyOn(cc.webCallingService, 'isBrowserVoiceRequired').mockReturnValue(true);
        jest.spyOn(cc.webCallingService, 'isVoiceReady').mockReturnValue(false);
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        jest.advanceTimersByTime(105000); await flush();
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        primary.welcome(); await flush();
        const reload = requests.find(r => r.resource === '/v1/agents/reload');
        primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
          {lastStateChangeReason: 'agent-wss-disconnect'})); await flush();
        expect(cc['lastPublishedRegionState'].autoAvailable).toBe('waitingForVoice');
      }
      const recovery = cc['recovery'];
      const auto = cc['autoAvailable'];
      const removed = auto && jest.spyOn(auto.signal, 'removeEventListener');
      const old = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0]; old.welcome(); await flush();
      const subscriptions = requests.filter(r => r.resource === 'v1/realtime/subscribe').length;
      const epoch = cc['rtdEpoch'];
      const registration = cc['registrationAbortController'];
      const accepted = cc['acceptedStation'];
      const task = createAISummaryLifecycleTask(undefined, cc.apiAIAssistant);
      cc.taskManager['taskCollection'][task.data.interactionId] = task;
      const feature = jest.fn(); task.on(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, feature);
      const transcript = jest.fn(); task.on(CC_EVENTS.REAL_TIME_TRANSCRIPTION, transcript);
      const suggestion = jest.fn(); task.on(CC_EVENTS.SUGGESTED_RESPONSE, suggestion);
      const enablement = {interactionId: task.data.interactionId,
        postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1};
      const frames = [
        {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: enablement}},
        ...[CC_EVENTS.REAL_TIME_TRANSCRIPTION, CC_EVENTS.SUGGESTED_RESPONSE].map(type =>
          ({type, data: {data: {conversationId: task.data.interactionId}}})),
      ];
      old.message(frames[0]);
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
      feature.mockClear();
      jest.spyOn(cc.apiAIAssistant, 'sendEvent').mockResolvedValue(undefined);
      const summary = cc.apiAIAssistant.requestAndWaitForRtd({
        agentId: 'agent', interactionId: task.data.interactionId, correlationId: task.data.interactionId,
        rtdEventType: CC_EVENTS.POST_CALL_SUMMARY, eventType: AIAssistantEventType.CTI_EVENT,
        eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY, timeoutMs: 1000,
        createTimeoutError: () => new Error('summary timeout'),
      });
      const interrupted = expect(summary).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      const backend = createDeferred<any>();
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource === '/v1/agents/logout'
        ? backend.promise : boundary(request));
      const logout = cc.stationLogout({logoutReason: 'in interaction'});
      const rejected = expect(logout).rejects.toThrow();
      await flush(); await interrupted;
      expect(epoch.controller.signal.aborted).toBe(true);
      expect(old.close).toHaveBeenCalledTimes(1);
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
      frames.forEach(frame => old.message(frame));
      expect(feature).not.toHaveBeenCalled();
      expect(transcript).not.toHaveBeenCalled();
      expect(suggestion).not.toHaveBeenCalled();
      backend.reject({statusCode: 400, body: {reason: 'AGENT_IN_INTERACTION'}});
      await rejected; await flush();
      const replacement = cc['rtdEpoch'];
      expect(replacement).toBeDefined();
      expect(replacement).not.toBe(epoch);
      expect(replacement.parent).toBe(registration.signal);
      expect(replacement.station).toBe(cc['stationRevision']);
      const current = sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0];
      current.welcome(); await replacement.promise; await flush();
      expect(cc['acceptedStation']).toBe(accepted);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc.taskManager['taskCollection'][task.data.interactionId]).toBe(task);
      expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: false, midCallEnabled: false});
      frames.forEach(frame => old.message(frame));
      expect(feature).not.toHaveBeenCalled();
      expect(transcript).not.toHaveBeenCalled();
      expect(suggestion).not.toHaveBeenCalled();
      frames.forEach(frame => current.message(frame));
      expect(feature).toHaveBeenCalledTimes(1);
      expect(feature).toHaveBeenCalledWith(enablement);
      expect(transcript).toHaveBeenCalledTimes(1);
      expect(suggestion).toHaveBeenCalledTimes(1);
      expect(task.aiSummaryCapabilities).toEqual({postCallEnabled: true, midCallEnabled: true});
      await cc['resumeRtd'](registration.signal);
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(subscriptions + 1);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(1);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(cc['recovery']).toBeUndefined();
      expect(cc['autoAvailable']).toBeUndefined();
      if (afterRecovery) {
        expect(recovery.controller.signal.aborted).toBe(true);
        expectAutoListenersDetached(cc, removed);
        await cc['dispatchAutoAvailable'](auto); await flush();
        expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(0);
      }
    }, undefined, {enabled: true});
  });

  it('T-010 rejectedLogoutContainsReplacementRtdAdmissionFailure', async () => {
    await withGraph(async ({cc, graph, host, requests, sockets, login, flush}) => {
      await login(); sockets.find(s => s.url.includes('rtd.')).welcome(); await flush();
      const accepted = cc['acceptedStation'];
      const sink = jest.spyOn(graph.LoggerProxy, 'info');
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource === '/v1/agents/logout')
          return Promise.reject({statusCode: 400, body: {reason: 'AGENT_IN_INTERACTION'}});
        if (request.resource === 'v1/realtime/subscribe') {
          requests.push(request);
          return Promise.reject({statusCode: 503});
        }
        return boundary(request);
      });
      await expect(cc.stationLogout({logoutReason: 'in interaction'})).rejects.toThrow();
      await flush();
      expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
      expect(diagnostics(sink).filter(record => record.stage === 'rtd')).toEqual([
        {stage: 'rtd', outcome: 'failed', attempt: 1, elapsedMs: 0, status: 503},
      ]);
      expect(cc['acceptedStation']).toBe(accepted);
      expect(cc['registrationAbortController'].signal.aborted).toBe(false);
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['rtdEpoch']).toBeUndefined();
      expect(cc['rtdPaused']).toBe(true);
      expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
    }, undefined, {enabled: true});
  });

  it.each(['success', 'line-failure', 'wxApp-failure'])(
    'T-010 acceptedLogoutNeverResumesRtdAfter %s', async outcome => {
      await withGraph(async ({cc, sockets, requests, login, frame, flush}) => {
        await login(); sockets.find(s => s.url.includes('rtd.')).welcome(); await flush();
        if (outcome === 'line-failure')
          jest.spyOn(cc.webCallingService, 'deregisterWebCallingLine').mockRejectedValueOnce(new Error('line failed'));
        if (outcome === 'wxApp-failure')
          jest.spyOn(cc, 'teardownWxAppLocalState').mockRejectedValueOnce(new Error('wxApp failed'));
        const logout = cc.stationLogout({logoutReason: 'user'});
        const settled = outcome === 'success' ? expect(logout).resolves.toBeDefined() : expect(logout).rejects.toThrow();
        await flush();
        sockets[0].message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'), type: CC_EVENTS.AGENT_LOGOUT});
        await settled; await flush();
        expect(cc['acceptedStation']).toBeUndefined();
        expect(cc['suppressAutomaticRelogin']).toBe(true);
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
        expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
      }, undefined, {enabled: true});
    });

  it.each(['switch', 'deregister', 'multi-login', 'terminal', 'no-station'])(
    'T-010 rejectedLogoutCannotResumeRtdAfter %s', async boundary => {
      await withGraph(async ({cc, host, sockets, requests, login, flush}) => {
        if (boundary !== 'no-station') await login();
        sockets.find(s => s.url.includes('rtd.')).welcome(); await flush();
        const backend = createDeferred<any>();
        const request = host.request.getMockImplementation();
        host.request.mockImplementation(input => input.resource === '/v1/agents/logout'
          ? backend.promise : request(input));
        const logout = cc.stationLogout({logoutReason: 'user'});
        const rejected = expect(logout).rejects.toThrow();
        await flush();
        if (boundary === 'switch') sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'supersede'});
        else if (boundary === 'deregister') await cc.deregister();
        else if (boundary === 'multi-login') sockets[0].message({type: CC_EVENTS.AGENT_MULTI_LOGIN, data: {}});
        else if (boundary === 'terminal') cc['handleRecoveryTerminal']({data: {kind: 'unavailable'}});
        backend.reject({statusCode: 400}); await rejected; await flush();
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
        expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
      }, undefined, {enabled: true});
    });

  it('T-012 ordinary failed logout releases suppression so a later switch restores retained state', async () => {
    await withGraph(async ({cc, host, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const accepted = cc['acceptedStation'];
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource === '/v1/agents/logout'
        ? Promise.reject({statusCode: 503}) : boundary(request));
      await expect(cc.stationLogout({logoutReason: 'user'})).rejects.toThrow();
      expect(cc['logoutPending']).toBe(false);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['acceptedStation']).toBe(accepted);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'after-failure'});
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const reload = requests.find(r => r.resource === '/v1/agents/reload');
      expect(reload).toBeDefined();
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid)); await flush();
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'ready', trackingId: 'after-failure'});
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
    });
  });

  it('T-007 drRestoreDoesNotReread and real correlated session acceptance', async () => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      // REQ-012: include all HTTP traffic so unexpected failover/provisioning calls fail.
      const switchBoundary = requests.length;
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(110000); await flush(); sockets[1].welcome(); await flush();
      const reload = requests.filter(r => r.resource === '/v1/agents/reload')[0];
      expect(reload).toBeDefined();
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, 'wrong-id')); await flush();
      expect(cc['lastPublishedRegionState'].status).toBe('recovering');
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid)); await flush();
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      expect(requests.slice(switchBoundary).map(r => [r.method, r.resource])).toEqual([
        ['POST', SUBSCRIBE_API],
        ['POST', '/v1/agents/reload'],
      ]);
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(1);
    });
  });

  it.each([true, false])('T-002 nextRegisterEligibilityControlsSwitchEntry initial=%s', async (enabled) => {
    const wireSettings = {id: 'org', multiRegionEnabled: enabled};
    await withGraph(async ({cc, requests, sockets, flush}) => {
      wireSettings.multiRegionEnabled = !enabled;
      expect(cc['multiRegionSettings'].eligibility).toBe(enabled ? 'enabled' : 'disabled');
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(1);
      const next = cc.register(); const observed = next.catch(() => undefined);
      await flush(); sockets[1].welcome(); await next; await observed; await flush();
      sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      expect(cc['lastPublishedRegionState'].status).toBe(enabled ? 'unavailable' : 'recovering');
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(2);
    }, wireSettings);
  });

  it('T-007 failoverThenFailbackRestoresTwice using the accepted reload snapshot', async () => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      const states = jest.fn(); cc.on('region:stateChange', states);
      const failoverBoundary = requests.length;
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'A',
        data: {operation: 'FAILOVER', scope: 'ORG'}});
      const failover = cc['recovery'];
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const first = requests.find(r => r.resource === '/v1/agents/reload');
      const payload = {teamId: 'restored-team', deviceType: 'AGENT_DN', dialNumber: '5678',
        deviceId: '5678', isExtension: false, roles: ['agent'], teamName: '', siteId: '',
        usesOtherDN: false, auxCodeId: ''};
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, first.headers.trackingid,
        {teamId: 'restored-team', deviceType: 'AGENT_DN', dn: '5678', isExtension: false,
          agentSessionId: 'failover-session'})); await flush();
      expect(cc['acceptedStation']).toEqual({orgId: 'org', agentId: 'agent', sessionId: 'failover-session',
        revision: cc['stationRevision'], payload});
      expect(cc['currentAgentSessionId']).toBe('failover-session');
      expect(cc.services.connectionService['mode']).toBe('ordinary');
      expect(cc.services.webSocketManager.hasUsableSocket()).toBe(true);
      expect(failover.controller.signal.aborted).toBe(false);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toHaveLength(1);
      expect(requests.slice(failoverBoundary).map(r => [r.method, r.resource])).toEqual([
        ['POST', SUBSCRIBE_API],
        ['POST', '/v1/agents/reload'],
      ]);

      // The adopted primary owns the next switch after the first restore completed.
      const failbackBoundary = requests.length;
      sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B',
        data: {operation: 'FAILBACK', scope: 'REGION'}});
      expect(failover.controller.signal.aborted).toBe(true);
      const failback = cc['recovery']; expect(failback).not.toBe(failover);
      expect([...cc['acceptedSwitchIds']]).toEqual(['A', 'B']);
      expect(sockets[1].close).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(105000); await flush(); sockets[2].welcome(); await flush();
      const second = requests.filter(r => r.resource === '/v1/agents/reload')[1];
      sockets[2].message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, second.headers.trackingid,
        {reasonCode: 1038})); await flush();
      const fallback = requests.filter(r => r.resource === '/v1/agents/login')[1];
      expect(fallback.body).toEqual(payload);
      sockets[2].message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, fallback.headers.trackingid,
        {teamId: 'restored-team', deviceType: 'AGENT_DN', dn: '5678', isExtension: false,
          agentSessionId: 'failback-session'}), type: CC_EVENTS.AGENT_STATION_LOGIN}); await flush();

      const ready = (trackingId, operation, scope) => ({status: 'ready', reason: 'region-switch',
        trackingId, operation, scope, homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false});
      expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([
        [ready('A', 'FAILOVER', 'ORG')], [ready('B', 'FAILBACK', 'REGION')],
      ]);
      expect(cc['acceptedStation']).toEqual({orgId: 'org', agentId: 'agent', sessionId: 'failback-session',
        revision: cc['stationRevision'], payload});
      expect(cc['currentAgentSessionId']).toBe('failback-session');
      expect(cc.agentConfig).toMatchObject({currentTeamId: 'restored-team', deviceType: 'AGENT_DN',
        dn: '5678', defaultDn: '5678', isAgentLoggedIn: true});
      expect([...cc['acceptedSwitchIds']]).toEqual(['A', 'B']);
      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(failover.cleaned).toBe(true); expect(failback.cleaned).toBe(true);
      expect(cc.services.connectionService['mode']).toBe('ordinary');
      expect(cc['sessionRequest']).toBeUndefined();
      expect(requests.slice(failbackBoundary).map(r => [r.method, r.resource])).toEqual([
        ['POST', SUBSCRIBE_API],
        ['POST', '/v1/agents/reload'],
        ['POST', '/v1/agents/login'],
      ]);
      const ids = requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource))
        .map(r => r.headers.trackingid);
      expect(new Set(ids).size).toBe(4);
    });
  });

  const failRemainingNormalReloads = async ({cc, requests, frame, flush}, primary) => {
    const logins = () => requests.filter(request => request.resource === '/v1/agents/login');
    const previousLoginCount = logins().length;
    for (let attempt = cc['recovery'].reloads; attempt <= 4; attempt += 1) {
      const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
      expect(cc['recovery'].reloads).toBe(attempt);
      primary.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reloads.slice(-1)[0].headers.trackingid,
        {reasonCode: 1037})); await flush();
      if (attempt < 4) {
        const delay = [2000, 4000, 8000][attempt - 1];
        expect(cc['recovery'].retryNotBefore).toBe(Date.now() + delay);
        jest.advanceTimersByTime(delay - 1); await flush();
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(reloads.length);
        jest.advanceTimersByTime(1); await flush();
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(reloads.length + 1);
      }
    }
    expect(logins()).toHaveLength(previousLoginCount + 1);
    return logins().at(-1);
  };

  it.each([2000, 4000, 8000])('T-007 socketLossPreservesGenerationRestoreBudget during %sms retry wait', async delay => {
    await withGraph(async h => {
      const {cc, requests, sockets, login, frame, flush} = h;
      await login(); cc.$config.allowAutomatedRelogin = true;
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'retry-wait'});
      const recovery = cc['recovery'];
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const dispatched = [2000, 4000, 8000].indexOf(delay) + 1;
      for (let attempt = 1; attempt <= dispatched; attempt += 1) {
        const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
        sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reload.headers.trackingid,
          {reasonCode: 1037})); await flush();
        expect(recovery.retryNotBefore).toBe(Date.now() + [2000, 4000, 8000][attempt - 1]);
        if (attempt < dispatched) { jest.advanceTimersByTime([2000, 4000, 8000][attempt - 1]); await flush(); }
      }
      const deadline = recovery.retryNotBefore;
      jest.advanceTimersByTime(delay / 2); await flush();
      expect(deadline - Date.now()).toBe(delay / 2);
      const owner = cc['sessionRequest'];
      sockets[1].lost(); await flush();
      expect(owner.controller.signal.aborted).toBe(true);
      expect(cc['recovery']).toBe(recovery);
      expect(recovery.retryNotBefore).toBe(deadline);
      expect(recovery.retryNotBefore).toBeGreaterThan(Date.now());
      expect(recovery.reloads).toBe(dispatched);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(dispatched);
      jest.advanceTimersByTime(delay / 2); await flush();
      expect(Date.now()).toBe(deadline);
      expect(recovery.retryNotBefore).toBe(deadline);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(dispatched);
      jest.advanceTimersByTime(63000 - delay / 2); await flush();
      expect(sockets).toHaveLength(3);
      expect(recovery.retryNotBefore).toBe(deadline);
      sockets[2].welcome(); await flush();
      expect(cc['recovery']).toBe(recovery);
      expect(recovery.reloads).toBe(dispatched + 1);
      expect(recovery.retryNotBefore).toBe(deadline);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(dispatched + 1);
      const fallback = await failRemainingNormalReloads(h, sockets[2]);
      sockets[2].message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, fallback.headers.trackingid,
        {reasonCode: 9999}), type: CC_EVENTS.AGENT_STATION_LOGIN}); await flush();
      expect(cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired', reason: 'session-restore-failed',
        trackingId: 'retry-wait', homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false});
      expect(cc['sessionRequest']).toBeUndefined();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(3);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(4);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(2);
      expect(new Set(requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource))
        .map(r => r.headers.trackingid)).size).toBe(6);
    });
  });

  it.each(['post1035', 'pre-dispatch', 'automation-disabled', 'superseding-switch'])(
    'T-007 socketLossPreservesGenerationRestoreBudget %s', async lossPoint => {
      await withGraph(async h => {
        const {cc, requests, sockets, login, frame, flush} = h;
        await login(); cc.$config.allowAutomatedRelogin = true;
        const accepted = cc['acceptedStation'];
        const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
        const states = jest.fn(); cc.on('region:stateChange', states);
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'budget'});
        const recovery = cc['recovery'];
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome();
        if (lossPoint !== 'pre-dispatch') await flush();
        let current = sockets[1];
        const failFallback = async (request, reasonCode) => {
          current.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, request.headers.trackingid,
            {reasonCode}), type: CC_EVENTS.AGENT_STATION_LOGIN}); await flush();
        };
        if (['post1035', 'superseding-switch'].includes(lossPoint)) {
          if (lossPoint === 'superseding-switch') {
            const fallback = await failRemainingNormalReloads(h, current);
            await failFallback(fallback, 1035);
          } else {
            const first = requests.find(r => r.resource === '/v1/agents/reload');
            current.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, first.headers.trackingid,
              {reasonCode: 1038})); await flush();
            await failFallback(requests.filter(r => r.resource === '/v1/agents/login')[1], 1035);
          }
          expect(recovery.stage).toBe('manual');
          expect(requests.filter(r => r.resource === '/v1/agents/reload'))
            .toHaveLength(lossPoint === 'superseding-switch' ? 5 : 2);
        }
        if (lossPoint === 'superseding-switch') {
          const owner = cc['sessionRequest'];
          current.message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'fresh'}); await flush();
          expect(recovery.controller.signal.aborted).toBe(true);
          expect(owner.controller.signal.aborted).toBe(true);
          const fresh = cc['recovery']; expect(fresh).not.toBe(recovery);
          expect(fresh).toMatchObject({cleaned: false, stage: 'reload', reloads: 0, retryNotBefore: 0});
          jest.advanceTimersByTime(105000); await flush(); current = sockets[2]; current.welcome(); await flush();
          expect(fresh.reloads).toBe(1);
          const fallback = await failRemainingNormalReloads(h, current);
          await failFallback(fallback, 1035);
          expect(fresh.stage).toBe('manual');
          const extra = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
          current.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, extra.headers.trackingid,
            {reasonCode: 1037})); await flush();
        } else {
          const owner = cc['sessionRequest'];
          current.lost(); await flush();
          expect(cc['recovery']).toBe(recovery);
          if (owner) expect(owner.controller.signal.aborted).toBe(true);
          if (lossPoint === 'pre-dispatch') {
            expect(recovery.reloads).toBe(0);
            expect(recovery.retryNotBefore).toBe(0);
            expect(recovery.cleaned).toBe(false);
            expect(cleanup).not.toHaveBeenCalled();
            expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
          }
          if (lossPoint === 'automation-disabled') {
            expect(recovery.reloads).toBe(1);
            expect(recovery.retryNotBefore).toBe(Date.now() + 2000);
            cc.$config.allowAutomatedRelogin = false;
          }
          const deadline = recovery.retryNotBefore;
          const spent = {reloads: recovery.reloads, stage: recovery.stage};
          jest.advanceTimersByTime(63000); await flush();
          expect(recovery.retryNotBefore).toBe(deadline);
          expect(recovery).toMatchObject(spent);
          current = sockets[2]; current.welcome(); await flush();
          if (lossPoint === 'pre-dispatch') {
            expect(recovery.reloads).toBe(1);
            const fallback = await failRemainingNormalReloads(h, current);
            await failFallback(fallback, 9999);
          }
        }
        const superseded = lossPoint === 'superseding-switch';
        expect(cc['lastPublishedRegionState']).toEqual({status: 'stationLoginRequired',
          reason: lossPoint === 'automation-disabled' ? 'automatic-relogin-disabled' : 'session-restore-failed',
          trackingId: superseded ? 'fresh' : 'budget', homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false});
        expect(states.mock.calls.filter(([state]) => state.status === 'ready')).toEqual([]);
        expect(cc['acceptedStation']).toBe(accepted);
        expect(cc['sessionRequest']).toBeUndefined();
        expect(cc.services.aqmReqs['operations'].size).toBe(0);
        expect([...cc['acceptedSwitchIds']]).toEqual(superseded ? ['budget', 'fresh'] : ['budget']);
        expect(cleanup).toHaveBeenCalledTimes(superseded ? 2 : 1);
        expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(3);
        const counts = {'post1035': [2, 2], 'pre-dispatch': [4, 2],
          'automation-disabled': [1, 1], 'superseding-switch': [10, 3]}[lossPoint];
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(counts[0]);
        expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(counts[1]);
        expect(new Set(requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource))
          .map(r => r.headers.trackingid)).size).toBe(counts[0] + counts[1]);
      });
    });

  it('T-007 socketLossPreservesGenerationRestoreBudget across repeated Welcomes', async () => {
    await withGraph(async ({cc, requests, sockets, login, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      const waits = [105000, 63000, 31500, 15750, 15750, 15750];
      for (let attempt = 0; attempt < waits.length; attempt += 1) {
        jest.advanceTimersByTime(waits[attempt]); await flush();
        sockets[attempt + 1].welcome(); await flush();
        if (attempt < 4) expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(attempt + 1);
        if (attempt === 4) expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(2);
        if (attempt < 5) { sockets[attempt + 1].lost(); await flush(); }
      }
      expect(cc['lastPublishedRegionState'].status).toBe('stationLoginRequired');
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(4);
      expect(new Set(requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource))
        .map(r => r.headers.trackingid)).size).toBe(6);
      cleanup.mockRestore();
    });
  });

  it('discards tasks hydrated by a failed regional socket before the next restore', async () => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login();
      cc.$config.allowAutomatedRelogin = true;
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush();
      sockets[1].welcome(); await flush();

      const data = createAISummaryLifecycleTaskData({interactionId: 'provisional',
        agentId: 'agent', orgId: 'org', type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        interaction: {mediaType: 'chat', state: 'new'} as any});
      const offer = {type: 'RoutingMessage', data};
      sockets[1].message(offer);
      const stale = cc.taskManager.getTask(data.interactionId);
      await expect(stale.accept()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
      sockets[1].lost(); await flush();
      expect(cc.taskManager.getTask(data.interactionId)).toBeUndefined();

      jest.advanceTimersByTime(63000); await flush();
      sockets[2].welcome(); await flush();
      sockets[2].message(offer);
      expect(cc.taskManager.getTask(data.interactionId)).toBeDefined();
      expect(cc.taskManager.getTask(data.interactionId)).not.toBe(stale);
      const reload = requests.filter(request => request.resource === '/v1/agents/reload').slice(-1)[0];
      sockets[2].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await flush();
      expect(cc['lastPublishedRegionState'].status).toBe('ready');
      const requestCount = requests.length;
      await expect(stale.accept()).rejects.toMatchObject({data: {reason: 'STALE_TASK'}});
      expect(requests).toHaveLength(requestCount);
    });
  });

  it.each([3, null, undefined])('T-007 readyCarriesInitialAutoOutcomeBeforeDispatch and real automatic acknowledgment with idle timestamp %s', async (idleTimestamp) => {
    await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const snapshots: any[] = [];
      const stateRequests = () => requests.filter(request => request.resource === '/v1/agents/session/state');
      const requestsAtReady: number[] = [];
      const auxAtNotification: string[] = [];
      cc.on('region:stateChange', state => {
        snapshots.push(state);
        if (state.autoAvailable === 'requesting') requestsAtReady.push(stateRequests().length);
      });
      cc.on(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, () => auxAtNotification.push(cc.agentConfig.lastStateAuxCodeId));
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
      const reload = requests.filter(r => r.resource === '/v1/agents/reload')[0];
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
        {lastStateChangeReason: 'agent-wss-disconnect'})); await flush();
      expect(snapshots.filter(s => s.status === 'ready').map(s => s.autoAvailable)).toEqual(['requesting']);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      expect(requestsAtReady).toEqual([0]);
      expect(cc.agentConfig.lastStateAuxCodeId).toBe('idle');
      const state = stateRequests()[0];
      const ack = frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, state.headers.trackingid,
        {subStatus: 'Available', auxCodeId: '0', lastStateChangeReason: 'agent-wss-disconnect',
          lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: idleTimestamp});
      sockets[1].message({...ack, type: CC_EVENTS.AGENT_STATE_CHANGE}); await flush();
      expect(snapshots.filter(s => s.status === 'ready').map(s => s.autoAvailable)).toEqual(['requesting', 'succeeded']);
      expect(auxAtNotification).toEqual(['0']);
      expect(cc.agentConfig.lastStateAuxCodeId).toBe('0');
      expect(cc.agentConfig.lastIdleCodeChangeTimestamp).toBe(idleTimestamp ?? undefined);
      expectAutoListenersDetached(cc, removed);
      expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('succeeded');
      sockets[1].message({...ack, type: CC_EVENTS.AGENT_STATE_CHANGE});
      sockets[1].lost(); await flush();
      expect(snapshots.filter(s => s.status === 'ready').map(s => s.autoAvailable)).toEqual(['requesting', 'succeeded']);
      removed.mockRestore();
    });
  });

  const restoreAutoAvailable = async ({cc, requests, sockets, login, frame, flush}, ready = true, disconnectFields = {}) => {
    await login(); cc.$config.allowAutomatedRelogin = true;
    jest.spyOn(cc.webCallingService, 'isBrowserVoiceRequired').mockReturnValue(true);
    jest.spyOn(cc.webCallingService, 'isVoiceReady').mockReturnValue(ready);
    sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
    jest.advanceTimersByTime(105000); await flush();
    const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
    primary.welcome(); await flush();
    const reload = requests.filter(r => r.resource === '/v1/agents/reload')[0];
    primary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
      {lastStateChangeReason: 'agent-wss-disconnect', ...disconnectFields})); await flush();
    expect(cc['lastPublishedRegionState'].autoAvailable).toBe(ready ? 'requesting' : 'waitingForVoice');
  };

  const expectAutoListenersDetached = (cc, removed) => {
    expect(cc['autoAvailable']).toBeUndefined();
    expect(cc.webCallingService.listeners(VOICE_CONNECTION_EVENTS.STATE_CHANGE))
      .not.toContain(cc['handleAutoAvailableVoiceChange']);
    expect(removed).toHaveBeenCalledWith('abort', cc['handleAutoAvailableAbort']);
  };

  describe.each([
    [CC_EVENTS.AGENT_STATION_LOGIN, CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS],
    [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_RELOGIN_SUCCESS, AGENT_EVENTS.AGENT_RELOGIN_SUCCESS],
  ])('T-007 stationNotificationDisconnectPrecondition %s', (outer, nested, specialized) => {
    it.each([
      ['equal echo', {}, false],
      ['advanced echo', {lastStateChangeTimestamp: 10}, false],
      ['older state', {auxCodeId: 'other', lastStateChangeTimestamp: 8, lastIdleCodeChangeTimestamp: 100}, false],
      ['older idle', {auxCodeId: 'other', lastIdleCodeChangeTimestamp: 8}, false],
      ...['status', 'subStatus', 'auxCodeId', 'lastStateChangeReason'].map(key => [
        `equal version changed ${key}`, {[key]: 'changed'}, true,
      ]),
      ['newer state', {auxCodeId: 'other', lastStateChangeTimestamp: 10, lastIdleCodeChangeTimestamp: 0}, true],
      ['newer Available without idle timestamp', {subStatus: 'Available', lastStateChangeTimestamp: 10, lastIdleCodeChangeTimestamp: undefined}, true],
      ['newer idle', {auxCodeId: 'other', lastIdleCodeChangeTimestamp: 10}, true],
      ['changed station and state', {teamId: 'new-team', auxCodeId: 'other'}, true],
      ...['status', 'subStatus', 'auxCodeId', 'lastStateChangeReason'].map(key => [
        `missing ${key}`, {auxCodeId: 'other', [key]: undefined}, false,
      ]),
      ['string timestamp', {auxCodeId: 'other', lastStateChangeTimestamp: '10'}, false],
      ['missing timestamp', {auxCodeId: 'other', lastIdleCodeChangeTimestamp: undefined}, false],
      ['foreign org', {auxCodeId: 'other', orgId: 'foreign'}, false],
      ['foreign agent', {auxCodeId: 'other', agentId: 'foreign'}, false],
      ['blank session', {auxCodeId: 'other', agentSessionId: '   '}, false],
      ['missing provenance', {auxCodeId: 'other', trackingId: undefined}, false],
    ])('%s consumes only an accepted competing state', async (_name, fields, cancels) => {
      await withGraph(async h => {
        const {cc, sockets, requests, frame, flush} = h;
        await restoreAutoAvailable(h, false, {lastStateChangeTimestamp: 9, lastIdleCodeChangeTimestamp: 9});
        const auto = cc['autoAvailable'];
        const removed = jest.spyOn(auto.signal, 'removeEventListener');
        const primary = sockets.filter(socket => socket.url.includes('routing.')).slice(-1)[0];
        const notification = {...frame(nested, 'remote-state', {...auto.disconnect, type: nested, trackingId: 'remote-state', ...fields}), type: outer};
        const observe = () => ({pending: cc['autoAvailable'] !== undefined,
          attached: cc.webCallingService.listeners(VOICE_CONNECTION_EVENTS.STATE_CHANGE)
            .includes(cc['handleAutoAvailableVoiceChange'])});
        const published: any[] = []; const raw: any[] = []; const forwarded: any[] = [];
        cc.on('region:stateChange', state => published.push({state, ...observe()}));
        cc.on(nested, data => raw.push({data, ...observe()}));
        cc.on(specialized, data => forwarded.push({data, ...observe()}));

        primary.message(notification); await flush();

        const ownership = {pending: !cancels, attached: !cancels};
        expect(published).toEqual(cancels ? [{state: {...cc['lastPublishedRegionState'], autoAvailable: 'cancelled'},
          ...ownership}] : []);
        // Notifications retain their raw and specialized forwarding contracts, exactly once.
        const wireData = JSON.parse(JSON.stringify(notification.data));
        expect(raw).toEqual([{data: wireData, ...ownership}]);
        const {channelsMap, ...loginData} = wireData;
        expect(forwarded).toEqual([{data: {...loginData, notifsTrackingId: 'outer',
          mmProfile: {chat: undefined, email: undefined, social: undefined, telephony: undefined}}, ...ownership}]);
        expect(cc['lastPublishedRegionState'].autoAvailable).toBe(cancels ? 'cancelled' : 'waitingForVoice');
        if (cancels) expectAutoListenersDetached(cc, removed);
        else expect(cc['autoAvailable']).toBe(auto);

        cc.webCallingService.isVoiceReady.mockReturnValue(true);
        cc.webCallingService.emit(VOICE_CONNECTION_EVENTS.STATE_CHANGE, cc.getVoiceConnectionState());
        await flush();
        expect(requests.filter(request => request.resource === '/v1/agents/session/state')).toHaveLength(cancels ? 0 : 1);
        removed.mockRestore();
      });
    });
  });

  it.each(['voice-ready', 'dispatch'])('T-007 automaticDispatchRechecksConfirmedDisconnectState at %s', async boundary => {
    await withGraph(async h => {
      const {cc, requests, flush} = h;
      await restoreAutoAvailable(h, false);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      const changed = {...cc['confirmedState'], data: {...auto.disconnect, auxCodeId: 'newer-state'}};
      const metric = jest.spyOn(cc['metricsManager'], 'timeEvent');
      if (boundary === 'voice-ready') cc['confirmedState'] = changed;
      else metric.mockImplementationOnce(() => { cc['confirmedState'] = changed; });
      cc.webCallingService.isVoiceReady.mockReturnValue(true);
      await cc['dispatchAutoAvailable'](auto); await flush();
      expectAutoListenersDetached(cc, removed);
      expect(cc['lastPublishedRegionState'].autoAvailable).toBe('cancelled');
      expect(requests.filter(request => request.resource === '/v1/agents/session/state')).toHaveLength(0);
      removed.mockRestore(); metric.mockRestore();
    });
  });

  const prepareRtdPublicationBarrier = async (h, phase, voiceReady) => {
    const {cc, graph, host, requests, sockets, flush, holdNextRtdSubscribe} = h;
    await restoreAutoAvailable(h, voiceReady);
    const ready = {...cc['lastPublishedRegionState']};
    const auto = cc['autoAvailable'];
    const removed = jest.spyOn(auto.signal, 'removeEventListener');
    let admission;
    if (phase === 'http') {
      cc['pauseRtd']();
      admission = holdNextRtdSubscribe();
      cc['resumeRtd'](cc['registrationAbortController'].signal);
      await flush();
    }
    const manager = cc.services.rtdWebSocketManager;
    const epoch = cc['rtdEpoch'];
    const attempt = manager['attempt'];
    const old = attempt.socket;
    expect(epoch).toBeDefined();
    expect(attempt.signal).toBe(epoch.controller.signal);
    expect(!!old).toBe(phase !== 'http');
    expect(attempt.accepted).toBe(false);
    if (phase === 'open') {
      old.welcome('rtd-does-not-own-primary-identity'); await epoch.promise; await flush();
      expect(epoch.active).toBe(true);
      expect(manager.hasUsableSocket()).toBe(true);
    } else {
      expect(epoch.active).toBe(false);
      expect(old?.readyState).toBe(phase === 'welcome' ? 0 : undefined);
      if (old) { old.readyState = 1; old.onopen?.(); } // Transport opened, Welcome still pending.
    }
    const callbacks = {open: old?.onopen, message: old?.onmessage,
      error: old?.onerror, close: old?.onclose};
    const {task} = offerRetainedTask(h, 'publication-summary');
    expect(task).toBeInstanceOf(graph.Task);
    expect(task['apiAIAssistant']).toBe(cc.apiAIAssistant);
    expect(jest.isMockFunction(cc.apiAIAssistant.requestAndWaitForRtd)).toBe(false);
    task.setFeatureEnablement({interactionId: task.data.interactionId,
      postCallEnabled: true, midCallEnabled: true, actionTimestamp: 1});
    const summaryHttp = createDeferred<any>();
    const boundary = host.request.getMockImplementation();
    host.internal.services.get.mockReturnValue('https://api.wxcc-us1.cisco.com');
    host.request.mockImplementation(request => {
      if (request.uri?.endsWith('/event')) { requests.push(request); return summaryHttp.promise; }
      return boundary(request);
    });
    // Exercise both real Task summary call sites and the real ApiAIAssistant request map.
    const summarySettled = jest.fn();
    const summaries = [task.requestPostCallSummary(), task.requestMidCallSummary('CONSULT')]
      .map(pending => pending.then(value => { summarySettled({value}); return {value}; },
        error => { summarySettled({error}); return {error}; }));
    await flush();
    expect(requests.filter(r => r.uri?.endsWith('/event'))).toHaveLength(2);
    expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(2);
    expect(summarySettled).not.toHaveBeenCalled();
    const close = jest.spyOn(manager, 'close');
    const delivered = jest.spyOn(cc.taskManager, 'handleRealtimeWebsocketEvent');
    const oldSends = old?.send.mock.calls.length;
    const records: any[] = [];
    const record = state => records.push({state: {...state}, paused: cc['rtdPaused'],
      epochRemoved: cc['rtdEpoch'] === undefined, epochAborted: epoch.controller.signal.aborted,
      admissionRemoved: manager['attempt'] === undefined, admissionAborted: attempt.signal.aborted,
      pendingRequests: cc.apiAIAssistant['pendingRtdRequests'].size,
      readyState: old?.readyState, reconnect: manager.shouldReconnect,
      closes: close.mock.calls.map(args => [...args]), rejected: summarySettled.mock.calls.length});
    const frames = [
      {type: CC_TASK_EVENTS.FEATURE_ENABLEMENT, data: {data: {interactionId: 'stale-buffer',
        postCallEnabled: true, midCallEnabled: true, actionTimestamp: 2}}},
      ...[CC_EVENTS.POST_CALL_SUMMARY, CC_EVENTS.MID_CALL_SUMMARY,
        CC_EVENTS.REAL_TIME_TRANSCRIPTION, CC_EVENTS.SUGGESTED_RESPONSE].map(type =>
        ({type, data: {data: {conversationId: task.data.interactionId}}})),
    ];
    const replayCallbacks = () => {
      callbacks.open?.();
      callbacks.message?.({data: JSON.stringify({type: 'Welcome', data: {agentId: 'obsolete'}})});
      frames.forEach(frame => {
        callbacks.message?.({data: JSON.stringify(frame)});
      });
      callbacks.error?.(); callbacks.close?.();
    };
    return {ready, record, records, summarySettled, replayCallbacks,
      expectPublications: publications => {
        expect(records.length).toBeGreaterThan(0);
        for (const {state, ...barriers} of records) {
          expect(barriers).toEqual({paused: true, epochRemoved: true, epochAborted: true,
            admissionRemoved: true, admissionAborted: true, pendingRequests: 0,
            readyState: old ? 3 : undefined, reconnect: false,
            closes: [[false, 'regionRecovery']], rejected: 0});
        }
        publications.mock.invocationCallOrder.forEach(order =>
          expect(close.mock.invocationCallOrder[0]).toBeLessThan(order));
      },
      expectInterrupted: async () => {
        expect(await Promise.all(summaries)).toEqual([
          {error: expect.objectContaining({data: expect.objectContaining({reason: 'RECOVERY_INTERRUPTED'})})},
          {error: expect.objectContaining({data: expect.objectContaining({reason: 'RECOVERY_INTERRUPTED'})})},
        ]);
        expect(summarySettled).toHaveBeenCalledTimes(2);
      },
      releaseLate: async success => {
        if (success) {
          admission?.resolve({statusCode: 200, body: {webSocketUrl: 'wss://obsolete-rtd.produs2.cisco.com/'}});
          summaryHttp.resolve({statusCode: 202, body: {}});
        } else {
          admission?.reject(new Error('obsolete RTD subscribe failed'));
          summaryHttp.reject(new Error('obsolete summary HTTP failed'));
        }
        replayCallbacks(); await epoch.promise; await flush();
      },
      currentOwner: () => ({paused: cc['rtdPaused'], epoch: cc['rtdEpoch'],
        epochState: cc['rtdEpoch'] && [cc['rtdEpoch'].active, cc['rtdEpoch'].controller.signal.aborted,
          cc['rtdEpoch'].registration, cc['rtdEpoch'].station, cc['rtdEpoch'].sessionId],
        attempt: manager['attempt'], usable: manager.hasUsableSocket(), reconnect: manager.shouldReconnect,
        closed: manager.isSocketClosed, listeners: manager.listeners('message'),
        pending: cc.apiAIAssistant['pendingRtdRequests'].size,
        features: [...cc.taskManager['pendingFeatureEnablement']],
        capabilities: {...task.aiSummaryCapabilities}}),
      expectOldOwnerInert: () => {
        expect(epoch.controller.signal.aborted).toBe(true);
        expect(manager['attempt']).not.toBe(attempt);
        expect(delivered).not.toHaveBeenCalled();
        expect(cc.taskManager['pendingFeatureEnablement'].size).toBe(0);
        expect(cc.apiAIAssistant['pendingRtdRequests'].size).toBe(0);
        expect(summarySettled).toHaveBeenCalledTimes(2);
        if (old) {
          expect(old.readyState).toBe(3);
          expect(old.close).toHaveBeenCalledTimes(1);
          expect(old.send).toHaveBeenCalledTimes(oldSends);
        }
        expectAutoListenersDetached(cc, removed);
      },
    };
  };

  it.each([
    ...['recovering', 'ready/cancelled'].flatMap(observer => ['register', 'deregister', 'logout']
      .flatMap(boundary => [false, true].map(success => [observer, boundary, success, undefined, false]))),
    ...['open', 'welcome', 'http'].flatMap(phase => [false, true].flatMap(voiceReady =>
      ['register', 'deregister', 'logout'].flatMap(boundary => [false, true]
        .map(success => ['ready/cancelled', boundary, success, phase, voiceReady])))),
  ])(
    'T-012 cancelledObserverCannotResumeSupersededRecovery / observerReentrantLogoutDeregister: %s calls %s lateSuccess=%s rtd=%s voiceReady=%s', async (observer, boundary, success, rtdPhase, voiceReady) => {
      await withGraph(async h => {
        const {cc, requests, sockets, login, frame, flush, host} = h;
        let old; let barrier;
        if (observer === 'recovering') {
          await login(); cc.$config.allowAutomatedRelogin = true;
          old = await holdRecoveryWork(h);
        } else {
          const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
          if (rtdPhase) barrier = await prepareRtdPublicationBarrier(h, rtdPhase, voiceReady);
          else await restoreAutoAvailable(h, false);
          old = {driver, options: driver.mock.calls[0][0], recovery: cc['recovery'], release: async () => {}};
        }
        const oldPrimary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const oldReload = requests.find(r => r.resource === '/v1/agents/reload');
        const registration = cc['registrationGeneration'];
        const snapshots: any[] = [];
        let operation: Promise<any>;
        const reentrant = jest.fn(state => {
          if (operation || !(observer === 'recovering'
            ? state.status === 'recovering' && state.trackingId === 'B'
            : state.status === 'ready' && state.autoAvailable === 'cancelled')) return;
          cc.$config.allowAutomatedRelogin = false;
          operation = boundary === 'register' ? cc.register() : boundary === 'deregister'
            ? cc.deregister() : cc.stationLogout({logoutReason: 'observer'});
          operation.catch(() => undefined);
        });
        const publications = jest.fn(state => { snapshots.push(state); barrier?.record(state); });
        cc.on('region:stateChange', publications);
        cc.on('region:stateChange', reentrant);
        cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
        barrier?.expectPublications(publications);
        if (barrier) expect(barrier.summarySettled).not.toHaveBeenCalled();
        await flush();
        await barrier?.expectInterrupted();
        expect(operation).toBeDefined();
        expect(old.recovery.controller.signal.aborted).toBe(true);
        if (boundary === 'register') {
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
          await operation;
          if (barrier) {
            sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0].welcome();
            await cc['rtdEpoch'].promise; await flush();
          }
        } else if (boundary === 'deregister') await operation;
        else if (observer === 'recovering')
          await expect(operation).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        else {
          oldPrimary.message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'observer-logout'), type: CC_EVENTS.AGENT_LOGOUT});
          await operation;
        }
        await flush();
        expect(cc['registrationGeneration']).toBe(registration + (boundary === 'logout' ? 0 : 1));
        expect(cc['recovery']).toBeUndefined();
        expect(cc['autoAvailable']).toBeUndefined();
        expect([...cc['acceptedSwitchIds']]).toEqual(boundary === 'logout' ? ['switch', 'B'] : []);
        expect(snapshots.map(s => [s.status, s.trackingId, s.autoAvailable])).toEqual(observer === 'recovering'
          ? [['recovering', 'B', undefined]] : [['ready', 'switch', 'cancelled']]);
        const owner = lifecycleOwner(cc); const count = host.request.mock.calls.length;
        const socketCount = sockets.length;
        const rtdOwner = barrier?.currentOwner();
        const replacementSocket = barrier && boundary === 'register'
          ? sockets.filter(s => s.url.includes('rtd.')).slice(-1)[0] : undefined;
        await old.release(success);
        oldPrimary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, oldReload.headers.trackingid,
          {agentSessionId: 'obsolete'}));
        await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        if (barrier) {
          await barrier.releaseLate(success);
          for (let tick = 0; tick < 20; tick += 1) {
            jest.advanceTimersByTime(5000);
            const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
            primary.message({keepalive: 'true'});
            await flush();
          }
          barrier.replayCallbacks(); await flush();
          expect(barrier.currentOwner()).toEqual(rtdOwner);
          barrier.expectOldOwnerInert();
          if (replacementSocket) expect(replacementSocket.close).not.toHaveBeenCalled();
        }
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(host.request).toHaveBeenCalledTimes(count);
        expect(sockets).toHaveLength(socketCount);
        expect(old.driver).toHaveBeenCalledTimes(1); // B never resumes after its observer replaced it.
        if (boundary === 'logout') {
          expect(cc.services.connectionService['mode']).toBe('ordinary');
          cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
          expect(lifecycleOwner(cc)).toEqual(owner);
          expect(old.driver).toHaveBeenCalledTimes(1);
          const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
          primary.lost();
          const subscriptions = requests.filter(r => r.resource === SUBSCRIBE_API).length;
          jest.advanceTimersByTime(4999); await flush();
          expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions);
          jest.advanceTimersByTime(1); await flush();
          expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(subscriptions + 1);
        }
      }, undefined, {enabled: !!rtdPhase});
    }
  );

  it.each([false, true])('T-002 distinctSwitchSupersedes pending restore lateSuccess=%s', async success => {
    await withGraph(async h => {
      const {cc, requests, sockets, login, frame, flush, host} = h;
      await login(); cc.$config.allowAutomatedRelogin = true;
      const generation = cc['registrationGeneration'];
      const old = await holdRecoveryWork(h, 'reload', 'A');
      const oldPrimary = sockets[1];
      const oldReload = requests.find(r => r.resource === '/v1/agents/reload');
      cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'B'}));
      const replacement = cc['recovery'];
      const observedB = old.driver.mock.results[1].value.catch(error => { throw error; });
      observedB.catch(() => undefined);
      expect(old.recovery.controller.signal.aborted).toBe(true);
      expect((await old.observed).error.data.kind).toBe('cancelled');
      const owner = lifecycleOwner(cc); const count = host.request.mock.calls.length;
      const states = jest.fn(); cc.on('region:stateChange', states);
      await old.release(success);
      oldPrimary.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, oldReload.headers.trackingid, {agentSessionId: 'obsolete'}));
      await flush();
      expect(lifecycleOwner(cc)).toEqual(owner);
      expect(host.request).toHaveBeenCalledTimes(count);
      expect(states).not.toHaveBeenCalled();
      expect(old.reload).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(105000); await flush(); sockets[2].welcome(); await flush();
      const reloads = requests.filter(r => r.resource === '/v1/agents/reload');
      expect(reloads).toHaveLength(2);
      expect(reloads[1].headers.trackingid).not.toBe(oldReload.headers.trackingid);
      sockets[2].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads[1].headers.trackingid, {agentSessionId: 'B-session'}));
      await observedB; await flush();
      expect(cc['recovery']).toBe(replacement);
      expect(cc['registrationGeneration']).toBe(generation);
      expect(cc['acceptedStation'].sessionId).toBe('B-session');
      expect(cc['priorStationActive']).toBe(true);
      expect([...cc['acceptedSwitchIds']]).toEqual(['A', 'B']);
      expect(cc['lastPublishedRegionState']).toEqual({status: 'ready', reason: 'region-switch',
        trackingId: 'B', homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false});
      const readyOwner = lifecycleOwner(cc);
      for (const trackingId of ['A', 'B']) sockets[2].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId});
      expect(lifecycleOwner(cc)).toEqual(readyOwner);
      expect(old.driver).toHaveBeenCalledTimes(2);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
    });
  });

  it.each([false, true].flatMap(ready => [401, 409].map(statusCode => [ready, statusCode] as const)))(
    'T-012 terminalCancellationUsesLastReadyOrNone ready=%s status=%s', async (ready, statusCode) => {
      await withGraph(async h => {
        const {cc, host, sockets, flush, login} = h;
        let old;
        if (ready) {
          const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
          await restoreAutoAvailable(h, false);
          old = {options: driver.mock.calls[0][0], recovery: cc['recovery']};
        } else {
          await login(); cc.$config.allowAutomatedRelogin = true;
          old = await holdRecoveryWork(h, 'admission');
        }
        const snapshots = jest.fn(); cc.on('region:stateChange', snapshots);
        const failure = {statusCode, body: {reason: statusCode === 409 ? 'REGION_MISMATCH_NO_OVERRIDE' : 'AUTH_FAILED'}};
        if (ready) {
          const boundary = host.request.getMockImplementation();
          host.request.mockImplementation(request => request.resource === SUBSCRIBE_API
            ? Promise.reject(failure) : boundary(request));
          sockets[1].lost(); jest.advanceTimersByTime(5000); await flush();
        } else { old.pending.reject(failure); await old.observed; await flush(); }
        const context = {trackingId: 'switch', homeRegion: 'produs1'};
        const terminal = {status: statusCode === 409 ? 'reloadRequired' : 'unavailable',
          reason: statusCode === 409 ? 'region-mismatch' : 'authentication-failed', ...context};
        expect(snapshots.mock.calls).toEqual([
          ...(ready ? [[{status: 'ready', reason: 'region-switch', ...context, autoAvailable: 'cancelled'}]] : []),
          [terminal],
        ]);
        expect(cc['lastPublishedRegionState']).toEqual(terminal);
        expect(cc['autoAvailable']).toBeUndefined();
        expect(old.recovery.controller.signal.aborted).toBe(true);
        const owner = lifecycleOwner(cc); const count = host.request.mock.calls.length;
        await expect(old.options.afterWelcome({agentId: 'agent'}, new AbortController().signal))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        cc['handleAutoAvailableVoiceChange'](); cc['handleAutoAvailableAbort']();
        jest.advanceTimersByTime(600000); await flush();
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(host.request).toHaveBeenCalledTimes(count);
        expect(snapshots).toHaveBeenCalledTimes(ready ? 2 : 1);
        expect(jest.getTimerCount()).toBe(0);
      });
    }
  );

  describe('T-012 registration boundary ownership', () => {
    const invalidatedState = cc => ({
      settings: {...cc['multiRegionSettings']}, agentId: cc['registrationAgentId'],
      history: [...cc['acceptedSwitchIds']],
      station: cc['acceptedStation'], active: cc['priorStationActive'],
      dispatches: cc['stateDispatches'].size, confirmed: cc['confirmedState'],
      ordinal: cc['acceptedExplicitOrdinal'],
      idleCode: cc['wellbeingBreakIdleCode'],
    });
    const cleared = {
      settings: {eligibility: 'unknown'}, agentId: undefined, history: [],
      station: undefined, active: false, dispatches: 0, confirmed: undefined,
      ordinal: 0, idleCode: undefined,
    };
    const runBoundary = (h, boundary) => {
      const {cc, host, sockets} = h;
      if (boundary === 'register') return cc.register();
      if (boundary === 'deregister') return cc.deregister();
      const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
      // Exercise the primary consumer's synchronous termination boundary before forwarding.
      if (boundary === 'primary multi-login') cc.services.webSocketManager.emit('message', JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN,
        data: {type: 'AgentMultiLoginCloseSession', agentSessionId: cc['currentAgentSessionId']}}));
      else if (boundary === 'agent replacement') primary.message({type: 'Welcome', data: {agentId: 'replacement-agent'}});
      else {
        host.credentials.getOrgId = () => 'replacement-org';
        expect(cc['isCurrentRegistration'](cc['registrationGeneration'], 'org',
          cc['registrationAbortController'].signal, 'agent')).toBe(false);
      }
      return Promise.resolve();
    };

    it('invalidates eligibility before a reentrant logout interrupts register entry', async () => {
      await withGraph(async h => {
        const {cc, requests} = h;
        await restoreAutoAvailable(h, false);
        const ready = cc['lastPublishedRegionState'];
        cc['wellbeingBreakIdleCode'] = {id: 'old-idle-code'};
        let observed; let cancellation; let nested: Promise<unknown>; let revisions;
        cc.on('region:stateChange', state => {
          if (state.autoAvailable !== 'cancelled') return;
          cancellation = state;
          observed = invalidatedState(cc);
          const before = [cc['stationRevision'], cc['recoveryGeneration']];
          nested = cc.stationLogout({logoutReason: 'observer'}).catch(error => error);
          revisions = {before, after: [cc['stationRevision'], cc['recoveryGeneration']]};
        });
        await expect(cc.register()).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(await nested).toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(observed).toEqual(cleared);
        // The new generation is not a terminated owner: logout must still cancel its entry.
        expect(revisions.after).toEqual(revisions.before.map(revision => revision + 1));
        expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(0);
        cc['publishRegionState'](cc['buildRegionState']('unavailable', 'recovery-failed'));
        expect(cc['lastPublishedRegionState']).toEqual({status: 'unavailable', reason: 'recovery-failed'});
        expect(cancellation).toEqual({...ready, autoAvailable: 'cancelled', servingRegion: undefined, limitedService: undefined});
      });
    });

    it.each(['deregister', 'primary multi-login', 'org replacement', 'agent replacement'])(
      'clears registration state before reentrant logout during %s', async boundary => {
        await withGraph(async h => {
          const {cc, host, requests, sockets} = h;
          await restoreAutoAvailable(h, true);
          const ready = cc['lastPublishedRegionState'];
          const registration = cc['registrationAbortController'];
          const epoch = cc['rtdEpoch'];
          expect(cc['stateDispatches'].size).toBeGreaterThan(0);
          cc['wellbeingBreakIdleCode'] = {id: 'old-idle-code'};
          host.internal.mercury = {connected: true, off: jest.fn(), disconnect: jest.fn().mockResolvedValue(undefined)};
          host.internal.device = {unregister: jest.fn().mockResolvedValue(undefined)};
          cc.agentConfig.webRtcEnabled = true;
          cc.agentConfig.loginVoiceOptions = [LoginOption.BROWSER, LoginOption.EXTENSION];
          const publications: any[] = [];
          let observed; let nested: Promise<unknown>; let revisions;
          cc.on('region:stateChange', state => {
            publications.push(state);
            if (state.autoAvailable !== 'cancelled') return;
            observed = invalidatedState(cc);
            const before = [cc['stationRevision'], cc['recoveryGeneration']];
            nested = cc.stationLogout({logoutReason: 'observer'}).catch(error => error);
            revisions = {before, after: [cc['stationRevision'], cc['recoveryGeneration']]};
          });
          await runBoundary(h, boundary);
          expect(await nested).toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          expect(observed).toEqual(cleared);
          expect(invalidatedState(cc)).toEqual(cleared);
          expect(revisions.after).toEqual(revisions.before);
          expect(registration.signal.aborted).toBe(true);
          expect(epoch.controller.signal.aborted).toBe(true);
          expect(cc['recoveryPhase']).toBe('unavailable');
          expect(cc.services.connectionService['mode']).toBe('stopped');
          expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
          expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(0);
          expect(publications).toEqual([
            {...ready, autoAvailable: 'cancelled', servingRegion: undefined, limitedService: undefined},
            ...(['org replacement', 'agent replacement'].includes(boundary)
              ? [{status: 'unavailable', reason: 'recovery-failed', trackingId: 'switch', homeRegion: 'produs1'}] : []),
          ]);
          expect(cc['lastPublishedRegionState']).toBeUndefined();
          expect(cc['regionStateContext']).toEqual({});
          if (boundary === 'deregister') {
            expect(cc.agentConfig).toBeNull();
            expect(cc['currentAgentSessionId']).toBeUndefined();
            expect(cc.services.webSocketManager.listeners('message')).not.toContain(cc['handleWebsocketMessage']);
            expect(cc.services.rtdWebSocketManager.listeners('message')).not.toContain(cc['handleRTDWebsocketMessage']);
            expect(cc.services.connectionService.listeners('connectionLost')).not.toContain(cc['handleConnectionLost']);
            expect(cc.taskManager.listeners(TASK_EVENTS.TASK_INCOMING)).not.toContain(cc['handleIncomingTask']);
            expect(host.internal.mercury.disconnect).toHaveBeenCalledTimes(1);
            expect(host.internal.device.unregister).toHaveBeenCalledTimes(1);
          }
        }, undefined, {enabled: true});
      }
    );

    it.each(['register', 'deregister', 'primary multi-login', 'org replacement', 'agent replacement'])(
      'preserves a replacement registration started by the cancelled observer during %s', async boundary => {
        await withGraph(async h => {
          const {cc, host, sockets, flush, login} = h;
          await restoreAutoAvailable(h, false);
          let replacement: Promise<unknown>;
          let controller: AbortController;
          cc.on('region:stateChange', state => {
            if (state.autoAvailable !== 'cancelled') return;
            replacement = cc.register();
            replacement.catch(() => undefined);
            controller = cc['registrationAbortController'];
            cc['regionStateContext'] = {trackingId: 'replacement'};
          });
          const operation = runBoundary(h, boundary);
          if (['register', 'deregister'].includes(boundary))
            await expect(operation).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          else await operation;
          expect(replacement).toBeDefined();
          expect(controller.signal.aborted).toBe(false);
          expect(cc['registrationAbortController']).toBe(controller);
          expect(cc['regionStateContext']).toEqual({trackingId: 'replacement'});
          cc.$config.allowAutomatedRelogin = false;
          await flush();
          const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
          primary.welcome(); await replacement; await flush();
          await login(LoginOption.EXTENSION, 'replacement-session');
          expect(cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
          expect(cc['registrationAgentId']).toBe('agent');
          expect(cc['registrationOrgId']).toBe(host.credentials.getOrgId());
          expect(cc['currentAgentSessionId']).toBe('replacement-session');
          expect(cc['acceptedStation']).toMatchObject({agentId: 'agent', sessionId: 'replacement-session'});
          expect(cc['priorStationActive']).toBe(true);
          expect(cc['recoveryPhase']).toBe('ready');
          expect(controller.signal.aborted).toBe(false);
          expect(primary.close).not.toHaveBeenCalled();
        });
      }
    );
  });

  it('T-012 reentrant switch before logout dispatch releases only provisional suppression', async () => {
    await withGraph(async h => {
      const {cc, requests, sockets, flush} = h;
      await restoreAutoAvailable(h, false);
      const accepted = cc['acceptedStation'];
      cc.on('region:stateChange', state => {
        if (state.autoAvailable === 'cancelled')
          cc['handleWebsocketMessage'](JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'reentrant'}));
      });
      await expect(cc.stationLogout({logoutReason: 'user'})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      expect(cc['logoutPending']).toBe(false);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['acceptedStation']).toBe(accepted);
      expect(requests.filter(r => r.resource === '/v1/agents/logout')).toHaveLength(0);
      jest.advanceTimersByTime(105000); await flush(); sockets[2].welcome(); await flush();
      const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
      sockets[2].message(h.frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await flush();
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'ready',
        reason: 'region-switch', trackingId: 'reentrant'});
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(2);
      expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
    });
  });

  it('T-012 reentrant logout failure restores the original suppression policy', async () => {
    await withGraph(async h => {
      const {cc, host, flush} = h;
      await restoreAutoAvailable(h, false);
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource === '/v1/agents/logout'
        ? Promise.reject({statusCode: 503}) : boundary(request));
      let nested: Promise<unknown>;
      cc.on('region:stateChange', state => {
        if (state.autoAvailable === 'cancelled') nested = cc.stationLogout({logoutReason: 'observer'}).catch(error => error);
      });
      await expect(cc.stationLogout({logoutReason: 'user'})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      await nested; await flush();
      expect(cc['logoutPending']).toBe(false);
      expect(cc['suppressAutomaticRelogin']).toBe(false);
      expect(cc['priorStationActive']).toBe(true);
      expect(cc['autoAvailable']).toBeUndefined();
    });
  });

  it.each([
    [false, false], [false, true], [true, false], [true, true],
  ])('T-007 real socket loss terminalizes auto-Available ready=%s reconnect=%s without relogin', async (ready, reconnect) => {
    await withGraph(async h => {
      const {cc, requests, sockets, flush} = h;
      await restoreAutoAvailable(h, ready);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const barrier = cc['inFlightDrAutoState'];
      cc['suppressAutomaticRelogin'] = true;
      cc.services.webSocketManager.shouldReconnect = reconnect;
      sockets[1].lost();
      expect(auto.signal.aborted).toBe(true);
      expectAutoListenersDetached(cc, removed);
      const outcome = ready ? 'failed' : 'cancelled';
      expect(listener.mock.calls.map(([state]) => state)).toEqual([{
        status: 'ready', reason: 'region-switch', trackingId: 'switch', homeRegion: 'produs1',
        autoAvailable: outcome,
      }]);
      if (ready) {
        expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('failed');
        expect(cc['inFlightDrAutoState']).toBe(barrier);
      }
      await flush();
      if (barrier) await barrier;
      expect(cc['inFlightDrAutoState']).toBeUndefined();
      jest.advanceTimersByTime(5000); await flush();
      if (reconnect) { sockets[2].welcome(); await flush(); }
      cc.webCallingService.isVoiceReady.mockReturnValue(true);
      cc.webCallingService.emit(VOICE_CONNECTION_EVENTS.STATE_CHANGE);
      cc['handleAutoAvailableAbort'](); cc['handleAutoAvailableVoiceChange'](); await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(1);
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(ready ? 1 : 0);
      expect(cc.agentConfig.lastStateAuxCodeId).toBe('idle');
      removed.mockRestore();
    });
  });

  it.each([
    ['missing session', {agentSessionId: undefined}],
    ['foreign session', {agentSessionId: 'foreign'}],
    ['foreign organization', {orgId: 'foreign'}],
    ['foreign agent', {agentId: 'foreign'}],
    ['missing status', {status: undefined}],
    ['invalid subStatus', {subStatus: 42}],
    ['missing auxCodeId', {auxCodeId: undefined}],
    ['missing reason', {lastStateChangeReason: undefined}],
    ['invalid state timestamp', {lastStateChangeTimestamp: null}],
    ['invalid idle timestamp', {lastIdleCodeChangeTimestamp: '3'}],
    ['stale version', {lastStateChangeTimestamp: 0}],
  ])('T-007 real AQM acknowledged but unconfirmed auto-Available fails: %s', async (_name, fields) => {
    await withGraph(async h => {
      const {cc, requests, sockets, frame, flush} = h;
      const stateChange = jest.spyOn(cc.services.agent, 'stateChange');
      await restoreAutoAvailable(h);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      const confirmed = cc['confirmedState'];
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const state = requests.filter(r => r.resource === '/v1/agents/session/state')[0];
      const ack = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, state.headers.trackingid,
        {subStatus: 'Available', auxCodeId: '0', lastStateChangeReason: 'agent-wss-disconnect',
          lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3, ...fields}),
        type: CC_EVENTS.AGENT_STATE_CHANGE};
      sockets[1].message(ack); await flush();
      await expect(stateChange.mock.results[0].value).resolves.toEqual(JSON.parse(JSON.stringify(ack)));
      expectAutoListenersDetached(cc, removed);
      expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('failed');
      expect(cc['confirmedState']).toBe(confirmed);
      expect([cc.agentConfig.lastStateAuxCodeId, cc.agentConfig.lastStateChangeTimestamp,
        cc.agentConfig.lastIdleCodeChangeTimestamp]).toEqual(['idle', 1, 1]);
      expect(listener.mock.calls.map(([state]) => state.autoAvailable)).toEqual(['failed']);
      sockets[1].message(ack); cc['handleAutoAvailableVoiceChange'](); await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(stateChange).toHaveBeenCalledTimes(1);
      // Correlation is passive after failure; a later authoritative state can still update cache.
      sockets[1].message({...ack, data: {...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
        state.headers.trackingid, {subStatus: 'Available', auxCodeId: '0',
          lastStateChangeTimestamp: 3, lastIdleCodeChangeTimestamp: 4}).data}});
      await flush();
      expect(cc.agentConfig.lastStateAuxCodeId).toBe('0');
      expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('failed');
      expect(listener).toHaveBeenCalledTimes(1);
      removed.mockRestore(); stateChange.mockRestore();
    });
  });

  it('T-007 real AQM rejection detaches auto listeners and retains the failed outcome', async () => {
    await withGraph(async h => {
      const {cc, requests, sockets, frame, flush} = h;
      await restoreAutoAvailable(h);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const state = requests.filter(r => r.resource === '/v1/agents/session/state')[0];
      const failure = {...frame(CC_EVENTS.AGENT_STATE_CHANGE_FAILED, state.headers.trackingid,
        {reason: 'REJECTED'}), type: CC_EVENTS.AGENT_STATE_CHANGE};
      sockets[1].message(failure); await flush();
      expectAutoListenersDetached(cc, removed);
      expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('failed');
      sockets[1].message(failure); sockets[1].lost(); await flush();
      cc['handleAutoAvailableAbort'](); cc['handleAutoAvailableVoiceChange'](); await flush();
      expect(listener.mock.calls.map(([state]) => state.autoAvailable)).toEqual(['failed']);
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(1);
      removed.mockRestore();
    });
  });

  it.each([
    [false, 'switch'], [true, 'switch'], [false, 'deregister'], [true, 'deregister'],
  ])('T-007 lifecycle supersession consumes auto before transport disposal: ready=%s boundary=%s', async (ready, boundary) => {
    await withGraph(async h => {
      const {cc, sockets, frame, flush} = h;
      await restoreAutoAvailable(h, ready);
      const auto = cc['autoAvailable'];
      const removed = jest.spyOn(auto.signal, 'removeEventListener');
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      if (boundary === 'switch')
        sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'replacement'});
      else await cc.deregister();
      expect(sockets[1].close).toHaveBeenCalledTimes(1);
      expectAutoListenersDetached(cc, removed);
      if (ready && boundary === 'switch')
        expect(cc['stateDispatches'].get(auto.requestId).outcome).toBe('cancelled');
      await flush();
      sockets[1].message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, auto.requestId,
        {auxCodeId: '0', subStatus: 'Available'}), type: CC_EVENTS.AGENT_STATE_CHANGE});
      cc['handleAutoAvailableAbort'](); cc['handleAutoAvailableVoiceChange'](); await flush();
      expect(listener.mock.calls.filter(([state]) => state.autoAvailable !== undefined)
        .map(([state]) => [state.status, state.autoAvailable])).toEqual([['ready', 'cancelled']]);
      expect(cc['lastPublishedRegionState']?.status).toBe(boundary === 'switch' ? 'recovering' : undefined);
      expect(cc['inFlightDrAutoState']).toBeUndefined();
      removed.mockRestore();
    });
  });

  it('T-011 unknownMetadataClearsPriorValues through initial and every DR retry wait', async () => {
    await withGraph(async ({cc, host, requests, sockets, login, flush}) => {
      await login();
      const previous = cc['lastPublishedRegionState'];
      expect(previous).toEqual({status: 'ready', reason: 'initial-login', homeRegion: 'produs1',
        servingRegion: 'produs1', limitedService: false});
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => {
        if (request.resource !== SUBSCRIBE_API) return boundary(request);
        requests.push(request);
        return Promise.reject({statusCode: 503});
      });
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const recovering = {status: 'recovering', reason: 'region-switch', trackingId: 'switch',
        operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'};
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch',
        data: {operation: 'FAILOVER', scope: 'ORG'}});
      const expected = [[recovering], [{...recovering, retryAfterMs: 105000}]];
      expect(listener.mock.calls).toEqual(expected);
      expect(cc.services.webSocketManager.getServingRegion()).toBeUndefined();
      const waits = [105000, 63000, 31500, 15750];
      for (let attempt = 0; attempt < waits.length; attempt += 1) {
        jest.advanceTimersByTime(waits[attempt] - 1); await flush();
        expect(requests.filter(request => request.resource === SUBSCRIBE_API)).toHaveLength(attempt + 1);
        expect(listener.mock.calls).toEqual(expected);
        expect(cc['lastPublishedRegionState']).toEqual({...recovering, retryAfterMs: waits[attempt]});
        jest.advanceTimersByTime(1); await flush();
        expect(requests.filter(request => request.resource === SUBSCRIBE_API)).toHaveLength(attempt + 2);
        if (attempt < waits.length - 1)
          expected.push([{...recovering, retryAfterMs: waits[attempt + 1]}]);
        expect(listener.mock.calls).toEqual(expected);
        expect(cc.services.webSocketManager.getServingRegion()).toBeUndefined();
      }
      expect(listener.mock.calls.every(([state]) => Object.isFrozen(state))).toBe(true);
      expect(previous).toEqual({status: 'ready', reason: 'initial-login', homeRegion: 'produs1',
        servingRegion: 'produs1', limitedService: false});
    });
  });

  it.each(['explicit state', 'authentication failure', 'mismatch', 'socket replacement'])(
    'T-011 unknownMetadataClearsPriorValues through native primary close: %s', async boundary => {
      await withGraph(async ({cc, host, requests, sockets, login, frame, flush}) => {
        await login(); cc.$config.allowAutomatedRelogin = true;
        const request = host.request.getMockImplementation();
        host.request.mockImplementation(options => options.resource === SUBSCRIBE_API
          ? Promise.resolve({statusCode: 200, body: {webSocketUrl: 'wss://routing.produs2.cisco.com/'}})
          : request(options));
        jest.spyOn(cc.webCallingService, 'isBrowserVoiceRequired').mockReturnValue(true);
        jest.spyOn(cc.webCallingService, 'isVoiceReady').mockReturnValue(false);
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch',
          data: {operation: 'FAILOVER', scope: 'ORG'}});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        const reload = requests.filter(r => r.resource === '/v1/agents/reload')[0];
        sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid,
          {lastStateChangeReason: 'agent-wss-disconnect'})); await flush();
        const context = {status: 'ready', reason: 'region-switch', trackingId: 'switch',
          operation: 'FAILOVER', scope: 'ORG', homeRegion: 'produs1'};
        expect(cc['lastPublishedRegionState']).toEqual({...context, servingRegion: 'produs2',
          limitedService: true, autoAvailable: 'waitingForVoice'});
        const listener = jest.fn(); cc.on('region:stateChange', listener);

        sockets[1].lost();
        expect(cc.services.webSocketManager.getServingRegion()).toBeUndefined();
        if (boundary === 'explicit state') {
          host.request.mockImplementation(options => options.resource === '/v1/agents/session/state'
            ? Promise.reject({statusCode: 503}) : request(options));
          await expect(cc.setAgentState({state: 'Idle', auxCodeId: 'manual'})).rejects.toBeDefined();
        } else {
          host.request.mockImplementation(options => {
            if (options.resource !== SUBSCRIBE_API) return request(options);
            if (boundary === 'socket replacement')
              return Promise.resolve({statusCode: 200, body: {webSocketUrl: 'wss://routing.produs1.cisco.com/'}});
            return Promise.reject(boundary === 'mismatch'
              ? {statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}}
              : {statusCode: 401});
          });
          jest.advanceTimersByTime(5000); await flush();
          if (boundary === 'socket replacement') { sockets[2].welcome(); await flush(); }
        }

        const expected: unknown[] = [{...context, autoAvailable: 'cancelled'}];
        if (boundary === 'authentication failure' || boundary === 'mismatch')
          expected.push({...context, status: boundary === 'mismatch' ? 'reloadRequired' : 'unavailable',
            reason: boundary === 'mismatch' ? 'region-mismatch' : 'authentication-failed'});
        expect(listener.mock.calls.map(([state]) => state)).toEqual(expected);
        expect(host.request.mock.calls.filter(([options]) => options.resource === '/v1/agents/session/state'))
          .toHaveLength(boundary === 'explicit state' ? 1 : 0);
      });
    }
  );

  it.each([
    [409, 'REGION_MISMATCH_NO_OVERRIDE', 'reloadRequired', 'region-mismatch'],
    [401, 'AUTH_FAILED', 'unavailable', 'authentication-failed'],
  ])('T-002 ignoredHydrationSwitchThenOrdinaryReconnectAndMismatch status=%s', async (statusCode, reason, status, terminalReason) => {
    const settings = createDeferred<any>();
    await withGraph(async ({cc, host, requests, sockets, flush}) => {
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const recover = jest.spyOn(cc.services.connectionService, 'recoverRegion');
      const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
      const registration = cc['registrationAbortController'];
      expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(1);

      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'ignored-switch'});
      expect(sockets[0].close).not.toHaveBeenCalled();
      expect(cc.services.webSocketManager.getServingRegion()).toBe('produs1');
      expect([...cc['acceptedSwitchIds']]).toEqual([]);
      expect(listener).not.toHaveBeenCalled();

      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource === SUBSCRIBE_API
        ? Promise.reject({statusCode, body: {reason}}) : boundary(request));
      sockets[0].lost(); jest.advanceTimersByTime(4999); await flush();
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
      expect(host.request.mock.calls.filter(([r]) => r.resource === SUBSCRIBE_API)).toHaveLength(1);
      expect(listener).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1); await flush();
      expect(host.request.mock.calls.filter(([r]) => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(listener.mock.calls).toEqual([[{status, reason: terminalReason}]]);
      const terminal = cc['lastPublishedRegionState'];
      expect(registration.signal.aborted).toBe(false);
      expect(jest.getTimerCount()).toBe(1); // The independent settings deadline is still pending.

      settings.resolve({id: 'org', multiRegionEnabled: true, homeRegion: 'produs1'});
      await flush();
      expect(cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
      expect(cc['lastPublishedRegionState']).toBe(terminal);
      jest.advanceTimersByTime(600000); await flush();
      expect(listener.mock.calls).toEqual([[{status, reason: terminalReason}]]);
      expect(recover).not.toHaveBeenCalled();
      expect(cleanup).not.toHaveBeenCalled();
      expect([...cc['acceptedSwitchIds']]).toEqual([]);
      expect(cc['recovery']).toBeUndefined();
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(1);
      expect(host.request.mock.calls.filter(([r]) => r.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(sockets).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(0);
      recover.mockRestore(); cleanup.mockRestore();
    }, settings.promise);
  });

  it('T-005 drMismatchSingleReloadSnapshot uses the actual recoverRegion rejection', async () => {
    await withGraph(async ({cc, host, sockets, login, flush, navigationReload}) => {
      await login(); cc.$config.allowAutomatedRelogin = true;
      const primary = cc.services.webSocketManager;
      const rtd = cc.services.rtdWebSocketManager;
      const connection = cc.services.connectionService;
      const oldRtd = sockets.find(socket => socket.url.includes('rtd.'));
      oldRtd.welcome(); await flush();
      const rtdEpoch = cc['rtdEpoch'];
      expect(cc['rtdPaused']).toBe(false);
      const stale = sockets.map(socket => ({open: socket.onopen, message: socket.onmessage, close: socket.onclose}));
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const connectionEvents = jest.fn(); connection.on('connectionLost', connectionEvents);
      const driver = jest.spyOn(connection, 'recoverRegion');
      const reload = jest.spyOn(cc.services.agent, 'reload');
      const boundary = host.request.getMockImplementation();
      const failure = {status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE', trackingId: 'dr-mismatch'};
      host.request.mockImplementation(request => request.resource === SUBSCRIBE_API
        ? Promise.reject({statusCode: 409,
          headers: {'X-WXCC-Region-Reason': failure.reason, trackingid: failure.trackingId}})
        : boundary(request));

      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      expect(driver).toHaveBeenCalledTimes(1);
      const options = driver.mock.calls[0][0];
      const rejection = expect(driver.mock.results[0].value).rejects.toHaveProperty('data', {
        ...failure, kind: 'region-mismatch'});
      const recovery = cc['recovery'];
      const context = {trackingId: 'switch', homeRegion: 'produs1'};
      const snapshots = [
        [{status: 'recovering', reason: 'region-switch', ...context}],
        [{status: 'recovering', reason: 'region-switch', ...context, retryAfterMs: 105000}],
      ];
      expect(listener.mock.calls).toEqual(snapshots);
      expect(rtdEpoch.controller.signal.aborted).toBe(true);
      expect(cc['rtdEpoch']).toBeUndefined();
      jest.advanceTimersByTime(104999); await flush();
      expect(host.request.mock.calls.filter(([request]) => request.resource === SUBSCRIBE_API)).toHaveLength(1);
      jest.advanceTimersByTime(1); await flush(); await rejection;

      const terminal = {status: 'reloadRequired', reason: 'region-mismatch', ...context};
      snapshots.push([terminal]);
      expect(listener.mock.calls).toEqual(snapshots);
      expect(navigationReload).not.toHaveBeenCalled();
      expect(cc['lastPublishedRegionState']).toEqual(terminal);
      expect(recovery.controller.signal.aborted).toBe(true);
      expect(cc['recovery']).toBeUndefined();
      expect(cc['recoveryAttempt']).toBeUndefined();
      expect(cc['recoveryPhase']).toBe('reloadRequired');
      expect(cc['rtdPaused']).toBe(true);
      expect(cc['getHttpRecoveryGuard']()).toBeUndefined();
      expect(primary.shouldReconnect).toBe(false);
      expect(rtd.shouldReconnect).toBe(false);
      expect(primary.hasUsableSocket()).toBe(false);
      expect(rtd.hasUsableSocket()).toBe(false);
      expect(primary.listenerCount('socketClose')).toBe(0);
      expect(rtd.listenerCount('message')).toBe(0);
      expect(sockets.every(socket => socket.readyState === 3)).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      const count = host.request.mock.calls.length;

      for (const delay of [180000, 5000, 45000, 63000, 600000]) {
        options.onScheduled(2, 63000);
        options.onAttemptSettled(1, 'terminal', failure);
        stale.forEach(callbacks => {
          callbacks.open?.();
          callbacks.message?.({data: JSON.stringify({type: 'Welcome', data: {agentId: 'agent'}})});
          callbacks.close?.();
        });
        primary.emit('socketClose', {shouldReconnect: true});
        rtd.emit('socketClose', {shouldReconnect: true});
        await cc['resumeRtd'](cc['registrationAbortController'].signal);
        jest.advanceTimersByTime(delay); await flush();
        expect(listener.mock.calls).toEqual(snapshots);
        expect(host.request).toHaveBeenCalledTimes(count);
        expect(connectionEvents).not.toHaveBeenCalled();
        expect(navigationReload).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      }
      expect(driver).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(host.request.mock.calls.filter(([request]) => request.resource === SUBSCRIBE_API)).toHaveLength(2);
      expect(host.request.mock.calls.filter(([request]) => request.resource === 'v1/realtime/subscribe')).toHaveLength(1);
      expect(host.request.mock.calls.filter(([request]) => request.resource === '/v1/agents/reload')).toHaveLength(0);
      expect(sockets).toHaveLength(2);
      driver.mockRestore(); reload.mockRestore();
    }, undefined, {enabled: true});
  });

  it('T-002 ignoredHydrationSwitchThenOrdinaryReconnectAndMismatch', async () => {
    const settings = createDeferred<any>();
    const admission = createDeferred<any>();
    const listener = jest.fn();
    let terminalCallback: jest.Mock;
    await withGraph(async ({cc, host, requests, sockets, flush}) => {
      const resolved = jest.fn(); const rejected = jest.fn();
      const registered = cc.register();
      const settled = registered.then(resolved, rejected);
      await flush();
      expect(sockets).toHaveLength(1);
      expect(resolved).not.toHaveBeenCalled();
      sockets[0].welcome(); await flush();
      await expect(registered).resolves.toBe(cc.agentConfig);
      await settled; await flush();
      expect(resolved).toHaveBeenCalledTimes(1);
      expect(rejected).not.toHaveBeenCalled();
      expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
      expect(requests.filter(r => r.resource.endsWith('/organization-setting'))).toHaveLength(1);

      const clearSummaries = jest.spyOn(cc.taskManager, 'clearAISummaryState');
      const forbidden = [
        jest.spyOn(cc.services.connectionService, 'pause'),
        jest.spyOn(cc.services.connectionService, 'recoverRegion'),
        jest.spyOn(cc.taskManager, 'invalidateRegionalTasks'),
        jest.spyOn(cc.taskManager, 'cleanupTaskCallResources'),
        jest.spyOn(cc.taskManager, 'removeTaskFromCollection'),
        jest.spyOn(cc.webCallingService, 'cleanUpCall'),
        jest.spyOn(cc.webCallingService, 'deregisterWebCallingLine'),
      ];
      const connectionEvents = jest.fn();
      cc.services.connectionService.on('connectionLost', connectionEvents);
      const subscriptions = () => host.request.mock.calls.filter(([r]) => r.resource === SUBSCRIBE_API);
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'ignored-switch'});
      expect(listener).not.toHaveBeenCalled();
      expect(sockets[0].close).not.toHaveBeenCalled();
      expect([...cc['acceptedSwitchIds']]).toEqual([]);
      forbidden.forEach(spy => expect(spy).not.toHaveBeenCalled());
      expect(clearSummaries).not.toHaveBeenCalled();

      sockets[0].lost();
      expect(connectionEvents).toHaveBeenCalledTimes(1);
      connectionEvents.mockClear();
      jest.advanceTimersByTime(4999); await flush();
      expect(subscriptions()).toHaveLength(1);
      expect(listener).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1); await flush();
      expect(subscriptions()).toHaveLength(2);
      expect(sockets).toHaveLength(1);
      expect(listener).not.toHaveBeenCalled();
      expect(terminalCallback).not.toHaveBeenCalled();
      expect(clearSummaries).not.toHaveBeenCalled();
      admission.reject({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
      await flush();
      const terminal = {status: 'reloadRequired', reason: 'region-mismatch'};
      expect(listener.mock.calls).toEqual([[terminal]]);
      const published = cc['lastPublishedRegionState'];
      expect(published).toEqual(terminal);
      const requestCount = host.request.mock.calls.length;
      const assertTerminal = (pendingTimers = 0) => {
        expect(terminalCallback).toHaveBeenCalledTimes(1);
        expect(terminalCallback.mock.calls[0][0].data).toEqual({kind: 'region-mismatch',
          status: 409, reason: 'REGION_MISMATCH_NO_OVERRIDE'});
        expect(listener.mock.calls).toEqual([[terminal]]);
        expect(cc['lastPublishedRegionState']).toBe(published);
        expect(cc['recoveryPhase']).toBe('reloadRequired');
        expect([...cc['acceptedSwitchIds']]).toEqual([]);
        expect(host.request).toHaveBeenCalledTimes(requestCount);
        expect(subscriptions()).toHaveLength(2);
        expect(sockets).toHaveLength(1);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
        expect(resolved).toHaveBeenCalledTimes(1);
        expect(rejected).not.toHaveBeenCalled();
        expect(connectionEvents).not.toHaveBeenCalled();
        forbidden.forEach(spy => expect(spy).not.toHaveBeenCalled());
        expect(clearSummaries).toHaveBeenCalledTimes(1);
        expect(cc['rtdEpoch']).toBeUndefined();
        expect(cc['rtdPaused']).toBe(true);
        expect(cc.services.rtdWebSocketManager.listenerCount('message')).toBe(0);
        expect(jest.getTimerCount()).toBe(pendingTimers);
      };
      assertTerminal(1);
      jest.advanceTimersByTime(4999); await flush();
      assertTerminal(1);

      // Integrates the terminal-hydration guard from ci_16749e915e076cfc2090649c:
      // settings may complete, but cannot enrich/re-publish the terminal snapshot.
      settings.resolve({statusCode: 200, body: [{id: 'org', multiRegionEnabled: true, homeRegion: 'produs1'}]});
      await flush();
      expect(cc['multiRegionSettings']).toEqual({eligibility: 'enabled', homeRegion: 'produs1'});
      assertTerminal();
      jest.advanceTimersByTime(180000); await flush();
      assertTerminal();
      forbidden.forEach(spy => spy.mockRestore());
      clearSummaries.mockRestore();
    }, undefined, undefined, {
      autoRegister: false,
      beforeRegister: ({cc, host, requests}) => {
        cc.on('region:stateChange', listener);
        const reset = cc.services.connectionService.reset.bind(cc.services.connectionService);
        jest.spyOn(cc.services.connectionService, 'reset').mockImplementation(options => {
          terminalCallback = jest.fn(options.onTerminalFailure);
          return reset({...options, onTerminalFailure: terminalCallback});
        });
        const boundary = host.request.getMockImplementation();
        let subscriptions = 0;
        host.request.mockImplementation(request => {
          if (request.resource.endsWith('/organization-setting')) {
            requests.push(request);
            return settings.promise;
          }
          if (request.resource === SUBSCRIBE_API && ++subscriptions > 1) {
            requests.push(request);
            return admission.promise;
          }
          return boundary(request);
        });
      },
    });
  });

  it('T-005 registerRejectAndSingleReloadSnapshot', async () => {
    const listener = jest.fn();
    let admission: ReturnType<typeof createDeferred>;
    await withGraph(async ({cc, host, requests, sockets, flush, navigationReload}) => {
      for (let generation = 1; generation <= 2; generation += 1) {
        admission = createDeferred();
        const resolved = jest.fn(); const rejected = jest.fn();
        const previousGeneration = cc['registrationGeneration'];
        const registered = cc.register();
        const settled = registered.then(resolved, rejected);
        await flush();
        expect(cc['registrationGeneration']).toBe(previousGeneration + 1);
        expect(host.request).toHaveBeenCalledTimes(generation);
        expect(resolved).not.toHaveBeenCalled();
        expect(rejected).not.toHaveBeenCalled();
        expect(sockets).toHaveLength(0);
        admission.reject({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}});
        await expect(registered).rejects.toMatchObject({
          name: 'Error', message: 'REGION_RELOAD_REQUIRED', data: {reason: 'REGION_RELOAD_REQUIRED'},
        });
        await settled; await flush();
        expect(resolved).not.toHaveBeenCalled();
        expect(rejected).toHaveBeenCalledTimes(1);
        expect(rejected.mock.calls[0][0].data).toEqual({reason: 'REGION_RELOAD_REQUIRED'});
        const snapshots = Array.from({length: generation}, () => [{status: 'reloadRequired', reason: 'region-mismatch'}]);
        expect(listener.mock.calls).toEqual(snapshots);
        expect(cc['lastPublishedRegionState']).toEqual(snapshots[generation - 1][0]);
        expect(navigationReload).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(180000); await flush();
        expect(listener.mock.calls).toEqual(snapshots);
        expect(host.request).toHaveBeenCalledTimes(generation);
        expect(requests.map(r => r.resource)).toEqual(Array(generation).fill(SUBSCRIBE_API));
        expect(sockets).toHaveLength(0);
        expect(resolved).not.toHaveBeenCalled();
        expect(rejected).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
        expect(navigationReload).not.toHaveBeenCalled();
      }
    }, undefined, undefined, {
      autoRegister: false,
      beforeRegister: ({cc, host, requests}) => {
        cc.on('region:stateChange', listener);
        host.request.mockImplementation(request => {
          requests.push(request);
          return admission.promise;
        });
      },
    });
  });

  it('T-005 ordinaryMismatchSingleReloadSnapshot uses the actual ordinary terminal callback', async () => {
    await withGraph(async ({cc, host, requests, sockets, flush, navigationReload}) => {
      const listener = jest.fn(); cc.on('region:stateChange', listener);
      const boundary = host.request.getMockImplementation();
      host.request.mockImplementation(request => request.resource === SUBSCRIBE_API
        ? Promise.reject({statusCode: 409, body: {reason: 'REGION_MISMATCH_NO_OVERRIDE'}})
        : boundary(request));
      sockets[0].lost(); jest.advanceTimersByTime(4999); await flush();
      expect(listener).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1); await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toEqual({status: 'reloadRequired', reason: 'region-mismatch', homeRegion: 'produs1'});
      expect(navigationReload).not.toHaveBeenCalled();
      const count = host.request.mock.calls.length;
      jest.advanceTimersByTime(180000); await flush();
      expect(host.request).toHaveBeenCalledTimes(count);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(0);
      expect(navigationReload).not.toHaveBeenCalled();
    });
  });

  it.each([401, 403].flatMap(status => ['reload', 'fallback', 'post1035'].map(stage => [status, stage])))
    ('T-007 terminalAuthAcrossRestoreStages status=%s stage=%s', async (status, stage) => {
      await withGraph(async ({cc, host, sockets, login, flush}) => {
        await login(); cc.$config.allowAutomatedRelogin = true;
        const boundary = host.request.getMockImplementation(); let reloads = 0; let logins = 0;
        host.request.mockImplementation(request => {
          if (request.resource === '/v1/agents/reload') {
            reloads += 1;
            if (stage === 'reload' || reloads > 1) return Promise.reject({statusCode: status, body: {reasonCode: 1037}});
            return Promise.reject({statusCode: 400, body: {reasonCode: 1038}});
          }
          if (request.resource === '/v1/agents/login') {
            logins += 1;
            return Promise.reject({statusCode: stage === 'fallback' ? status : 400,
              body: {reasonCode: 1035}});
          }
          return boundary(request);
        });
        const listener = jest.fn(); cc.on('region:stateChange', listener);
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        expect(listener.mock.calls.slice(-1)[0][0]).toEqual({status: 'unavailable',
          reason: 'authentication-failed', homeRegion: 'produs1', trackingId: 'switch'});
        expect(listener.mock.calls.filter(([s]) => s.status === 'stationLoginRequired')).toHaveLength(0);
        expect(reloads).toBe(stage === 'post1035' ? 2 : 1);
        expect(logins).toBe(stage === 'reload' ? 0 : 1);
        jest.advanceTimersByTime(180000); await flush();
        expect(reloads).toBe(stage === 'post1035' ? 2 : 1);
      });
    });

  it.each(['no-prior-station', 'automatic-relogin-disabled', 'session-restore-failed', 'automatic-restore-failed'])(
    'T-008 manualLoginAndGettersAllowed / T-010 noPriorStationResume / manualPriorStationDefers / manualLoginFailureKeepsRtdClosedAndRetryResumes %s', async reason => {
      await withGraph(async h => {
        const {cc, sockets, requests, login, frame, flush} = h;
        const oldRtd = sockets.find(s => s.url.includes('rtd.'));
        oldRtd.welcome(); await flush();
        if (reason !== 'no-prior-station') await login();
        cc.$config.allowAutomatedRelogin = reason !== 'automatic-relogin-disabled';
        if (reason === 'session-restore-failed') cc['acceptedStation'].payload.teamId = '';
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'manual'});
        expect(oldRtd.readyState).toBe(3);
        jest.advanceTimersByTime(105000); await flush();
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        primary.welcome(); await flush();
        if (reason === 'automatic-restore-failed') {
          const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
          primary.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reload.headers.trackingid, {reasonCode: 1038})); await flush();
          const fallback = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
          primary.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, fallback.headers.trackingid, {reasonCode: 9999}),
            type: CC_EVENTS.AGENT_STATION_LOGIN}); await flush();
        }
        expect(cc['recoveryPhase']).toBe('manualLoginRequired');
        const expectedAdmissions = reason === 'no-prior-station' ? 2 : 1;
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(expectedAdmissions);
        expect(cc.getVoiceConnectionState()).toEqual(cc.webCallingService.getVoiceConnectionState());
        const before = requests.length;
        await expect(cc.setAgentState({state: 'Available', auxCodeId: '0'}))
          .rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
        expect(requests).toHaveLength(before);
        if (reason !== 'no-prior-station') {
          await expect(cc.stationLogin({teamId: 'retry-team', loginOption: LoginOption.AGENT_DN, dialNumber: ''})).rejects.toThrow();
          const failed = cc.stationLogin({teamId: 'retry-team', loginOption: LoginOption.EXTENSION, dialNumber: '1234'});
          const rejected = expect(failed).rejects.toBeInstanceOf(Error); await flush();
          const request = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
          primary.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, request.headers.trackingid, {reasonCode: 9999}),
            type: CC_EVENTS.AGENT_STATION_LOGIN}); await rejected; await flush();
          expect(cc['recoveryPhase']).toBe('manualLoginRequired');
          expect(cc['rtdPaused']).toBe(true);
          expect(cc['rtdEpoch']).toBeUndefined();
          expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(1);
        }
        await login(LoginOption.EXTENSION, 'manual-session');
        expect(cc['acceptedStation'].sessionId).toBe('manual-session');
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
        expect(requests.filter(r => r.resource === 'v1/realtime/subscribe')).toHaveLength(2);
      }, undefined, {enabled: true});
    }
  );

  it('T-007 ordinaryReloginSupersedesDrAutoWithoutExplicitIntent', async () => {
    await withGraph(async h => {
      const {cc, requests, sockets, frame, flush} = h;
      await restoreAutoAvailable(h, false);
      const auto = cc['autoAvailable'];
      const revision = cc['stateIntentRevision'];
      const pending = cc['handleConnectionLost']({isSocketReconnected: true});
      await flush();
      const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reload.headers.trackingid));
      await pending; await flush();
      expect(cc.webCallingService.listeners(VOICE_CONNECTION_EVENTS.STATE_CHANGE))
        .not.toContain(cc['handleAutoAvailableVoiceChange']);
      expect(cc['autoAvailable']).toBeUndefined();
      expect(cc['stateIntentRevision']).toBe(revision);
      expect(cc['lastPublishedRegionState'].autoAvailable).toBe('cancelled');
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(0);
    });
  });

  it('T-007 abandoned ordinary relogin cannot set Available or initialize wxApp after a switch', async () => {
    await withGraph(async ({cc, requests, sockets, frame, login, flush}) => {
      await login();
      cc.$config.allowAutomatedRelogin = true;
      const device = createDeferred<void>();
      const setupDevice = jest.spyOn(cc, 'handleDeviceType').mockReturnValueOnce(device.promise);
      const setupWxApp = jest.spyOn(cc, 'ensureWxAppPostStationLogin');
      const reloads = () => requests.filter(request => request.resource === '/v1/agents/reload');
      const ordinary = cc['handleConnectionLost']({isSocketReconnected: true});
      await flush();
      sockets[0].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads()[0].headers.trackingid,
        {lastStateChangeReason: 'agent-wss-disconnect'}));
      await flush();
      expect(setupDevice).toHaveBeenCalledTimes(1);

      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      jest.advanceTimersByTime(105000); await flush();
      sockets[1].welcome(); await flush();
      sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, reloads()[1].headers.trackingid));
      await flush();
      expect(cc['lastPublishedRegionState'].status).toBe('ready');

      device.resolve(undefined);
      await flush();
      expect(requests.filter(request => request.resource === '/v1/agents/session/state')).toHaveLength(0);
      await ordinary;
      expect(setupWxApp).toHaveBeenCalledTimes(1);
    });
  });

  it('T-007 ordinary relogin cannot reopen admission after a switch from its cancellation observer', async () => {
    await withGraph(async h => {
      const {cc, sockets, requests, flush} = h;
      await restoreAutoAvailable(h, false);
      cc.on('region:stateChange', state => {
        if (state.autoAvailable === 'cancelled')
          sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'new-switch'});
      });

      const ordinary = cc['handleConnectionLost']({isSocketReconnected: true});
      await flush();
      expect(cc['recoveryPhase']).toBe('waiting');
      expect(cc['lastPublishedRegionState']).toMatchObject({status: 'recovering', trackingId: 'new-switch'});
      expect(requests.filter(request => request.resource === '/v1/agents/reload')).toHaveLength(1);
      await ordinary;
    });
  });

  it.each(['waitingForVoice', 'requesting', 'succeeded', 'failed', 'cancelled'])(
    'T-011 completeSnapshotEachAutoOutcome %s', async outcome => {
      await withGraph(async h => {
        const {cc, requests, sockets, frame, flush} = h;
        const states: any[] = [];
        cc.on('region:stateChange', state => states.push(state));
        await restoreAutoAvailable(h, outcome !== 'waitingForVoice' && outcome !== 'cancelled');
        const primary = sockets[1];
        const state = requests.find(r => r.resource === '/v1/agents/session/state');
        if (outcome === 'succeeded' || outcome === 'failed') {
          const type = outcome === 'succeeded' ? CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS : CC_EVENTS.AGENT_STATE_CHANGE_FAILED;
          primary.message({...frame(type, state.headers.trackingid,
            {subStatus: 'Available', auxCodeId: '0', lastStateChangeTimestamp: 2,
              lastIdleCodeChangeTimestamp: 3}), type: CC_EVENTS.AGENT_STATE_CHANGE});
        }
        if (outcome === 'cancelled') {
          const explicit = cc.setAgentState({state: 'Idle', auxCodeId: 'explicit'});
          await flush();
          const request = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0];
          primary.message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, request.headers.trackingid,
            {auxCodeId: 'explicit'}), type: CC_EVENTS.AGENT_STATE_CHANGE});
          await explicit;
        }
        await flush();
        const initial = outcome === 'waitingForVoice' || outcome === 'cancelled' ? 'waitingForVoice' : 'requesting';
        const snapshot = autoAvailable => ({status: 'ready', reason: 'region-switch', trackingId: 'switch',
          homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false, autoAvailable});
        expect(states.filter(s => s.status === 'ready' && s.reason === 'region-switch'))
          .toEqual(initial === outcome ? [snapshot(outcome)] : [snapshot(initial), snapshot(outcome)]);
      });
    }
  );

  it.each([401, 403, 503].flatMap(status => [true, false].map(enabled => ({status, enabled}))))(
    'T-002 nextRegisterEligibilityControlsSwitchEntry dependency status=$status then enabled=$enabled',
    async ({status, enabled}) => {
      let failSettings = true;
      const readTimes: number[] = [];
      const states = jest.fn();
      const wireSettings = {id: 'org', multiRegionEnabled: enabled, homeRegion: 'produs1'};
      await withGraph(async ({cc, requests, sockets, flush}) => {
        const primary = cc.services.webSocketManager;
        const connection = cc.services.connectionService;
        const recover = jest.spyOn(connection, 'recoverRegion');
        const stop = jest.spyOn(connection, 'stop');
        const primaryClose = jest.spyOn(primary, 'close');
        const rtdClose = jest.spyOn(cc.services.rtdWebSocketManager, 'close');
        const reads = status === 503 ? 5 : 1;
        expect(readTimes).toHaveLength(1);
        for (let attempt = 1; attempt < reads; attempt += 1) {
          jest.advanceTimersByTime(attempt * 1000 - 1); await flush();
          expect(readTimes).toHaveLength(attempt);
          jest.advanceTimersByTime(1); await flush();
          expect(readTimes).toHaveLength(attempt + 1);
        }
        const expectedTimes = status === 503 ? [0, 1000, 3000, 6000, 10000] : [0];
        expect(readTimes.map(time => time - readTimes[0])).toEqual(expectedTimes);
        expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(cc['registrationAbortController'].signal.aborted).toBe(false);
        const before = requests.length;
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'unknown'});
        for (let i = 0; i < 20; i += 1) {
          sockets[0].message({keepalive: 'true'}); jest.advanceTimersByTime(5000); await flush();
        }
        expect(readTimes.map(time => time - readTimes[0])).toEqual(expectedTimes);
        expect(cc['multiRegionSettings']).toEqual({eligibility: 'unknown'});
        expect(states).not.toHaveBeenCalled();
        expect(cc['lastPublishedRegionState']).toBeUndefined();
        expect([...cc['acceptedSwitchIds']]).toEqual([]);
        expect(cc['recovery']).toBeUndefined();
        expect(recover).not.toHaveBeenCalled();
        expect(stop).not.toHaveBeenCalled();
        expect(primaryClose).not.toHaveBeenCalled();
        expect(rtdClose).not.toHaveBeenCalled();
        expect(sockets[0].close).not.toHaveBeenCalled();
        expect(primary.hasUsableSocket()).toBe(true);
        expect(requests).toHaveLength(before);

        failSettings = false;
        const registration = cc.register(); const observed = registration.catch(() => undefined);
        await flush(); sockets[1].welcome(); await registration; await observed; await flush();
        expect(cc['multiRegionSettings']).toEqual({eligibility: enabled ? 'enabled' : 'disabled',
          homeRegion: 'produs1'});
        expect(readTimes).toHaveLength(reads + 1);
        expect(states).not.toHaveBeenCalled();
        expect([...cc['acceptedSwitchIds']]).toEqual([]);
        stop.mockClear(); primaryClose.mockClear(); rtdClose.mockClear();
        sockets[1].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'fresh'});
        await flush();
        expect([...cc['acceptedSwitchIds']]).toEqual(['fresh']);
        expect(recover).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect(stop).toHaveBeenCalledTimes(enabled ? 0 : 1);
        expect(primaryClose.mock.calls).toEqual([[false, enabled ? 'regionRecovery' : 'notEligible']]);
        expect(rtdClose.mock.calls).toEqual(enabled ? [] : [[false, 'notEligible']]);
        expect(states.mock.calls).toEqual(enabled ? [
          [{status: 'recovering', reason: 'region-switch', trackingId: 'fresh', homeRegion: 'produs1'}],
          [{status: 'recovering', reason: 'region-switch', trackingId: 'fresh', homeRegion: 'produs1',
            retryAfterMs: 105000}],
        ] : [[{status: 'unavailable', reason: 'not-eligible', trackingId: 'fresh', homeRegion: 'produs1'}]]);
        expect(readTimes).toHaveLength(reads + 1);
      }, wireSettings, {}, {beforeRegister: ({cc, host}) => {
        cc.on('region:stateChange', states);
        const boundary = host.request.getMockImplementation();
        host.request.mockImplementation(request => {
          if (request.resource.endsWith('/organization-setting')) {
            readTimes.push(Date.now());
            if (failSettings) return Promise.reject({statusCode: status});
          }
          return boundary(request);
        });
      }});
    }
  );

  it('T-012 reRegisterListenerCardinality retains exactly one owned listener per event', async () => {
    await withGraph(async ({cc, sockets, flush}) => {
      const primary = cc.services.webSocketManager;
      const rtd = cc.services.rtdWebSocketManager;
      const counts = emitter => Object.fromEntries(emitter.eventNames().map(event => [event, emitter.listenerCount(event)]));
      const expected = [counts(primary), counts(rtd), counts(cc.taskManager)];
      const callbacks = [primary.listeners('message'), rtd.listeners('message')];
      for (let i = 0; i < 3; i += 1) {
        await cc.deregister();
        // AQM's constructor-owned listener survives for the Services lifetime.
        expect(primary.listeners('message')).toEqual([cc.services.aqmReqs['onMessage']]);
        expect(rtd.listenerCount('message')).toBe(0);
        const pending = cc.register(); await flush();
        sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome();
        await pending; await flush();
        expect([counts(primary), counts(rtd), counts(cc.taskManager)]).toEqual(expected);
        expect(primary.listeners('message')).toEqual(callbacks[0]);
        expect(rtd.listeners('message')).toEqual(callbacks[1]);
      }
    });
  });

  it.each(['timeout', 'abort'].flatMap(boundary => [false, true].flatMap(replacement =>
    [false, true].map(success => [boundary, replacement, success]))))(
    'T-007 lateFallbackSuccessAfterTimeoutCannotCompleteManualLogin / lateFallbackSuccessAfterAbortCannotCompleteManualLogin / lateSessionFailureCannotRejectManualLogin boundary=%s replacement=%s success=%s',
    async (boundary, replacement, success) => {
      await withGraph(async ({cc, requests, sockets, login, frame, flush}) => {
        await login(); cc.$config.allowAutomatedRelogin = true;
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'late-fallback'});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        const reload = requests.find(r => r.resource === '/v1/agents/reload');
        sockets[1].message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reload.headers.trackingid, {reasonCode: 1038}));
        await flush();
        const abandoned = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
        expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(2);
        if (boundary === 'timeout') {
          jest.advanceTimersByTime(20000); await flush();
          expect(cc['recoveryPhase']).toBe('manualLoginRequired');
        } else {
          cc.$config.allowAutomatedRelogin = false;
          await expect(cc.stationLogout({logoutReason: 'cancel fallback'}))
            .rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          jest.advanceTimersByTime(5000); await flush();
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
        }
        cc.$config.allowAutomatedRelogin = false;
        let current = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        if (replacement) {
          current.lost(); jest.advanceTimersByTime(5000); await flush();
          current = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
          expect(current).not.toBe(sockets[1]); current.welcome(); await flush();
        }
        const settled = jest.fn();
        const manual = cc.stationLogin({teamId: 'manual-team', loginOption: LoginOption.AGENT_DN, dialNumber: '9999'});
        const observed = manual.then(value => {settled('success'); return value;}, error => {settled('failure'); throw error;});
        observed.catch(() => undefined); await flush();
        const request = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
        expect(request.headers.trackingid).not.toBe(abandoned.headers.trackingid);
        const before = lifecycleOwner(cc);
        const states = jest.fn(); cc.on('region:stateChange', states);
        const oldType = success ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_STATION_LOGIN_FAILED;
        // Deliver on the current transport too: socket-ID filtering alone cannot pass this case.
        current.message({...frame(oldType, abandoned.headers.trackingid,
          {teamId: 'obsolete-team', agentSessionId: 'obsolete-session', dn: '1111'}), type: CC_EVENTS.AGENT_STATION_LOGIN});
        await flush();
        expect(settled).not.toHaveBeenCalled();
        expect(states).not.toHaveBeenCalled();
        expect(lifecycleOwner(cc)).toEqual(before);
        current.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS, request.headers.trackingid,
          {teamId: 'manual-team', agentSessionId: 'manual-session', deviceType: 'AGENT_DN', dn: '9999', isExtension: false}),
          type: CC_EVENTS.AGENT_STATION_LOGIN});
        await observed; await flush();
        expect(settled.mock.calls).toEqual([['success']]);
        expect(cc['acceptedStation'].payload).toEqual({teamId: 'manual-team', deviceType: 'AGENT_DN',
          dialNumber: '9999', deviceId: '9999', isExtension: false, roles: ['agent'],
          teamName: '', siteId: '', usesOtherDN: false, auxCodeId: ''});
        expect(cc['acceptedStation'].sessionId).toBe('manual-session');
        expect(cc['lastPublishedRegionState'].status).toBe('ready');
      });
    }
  );

  it.each(['timeout', 'abort'].flatMap(boundary => [false, true].flatMap(replacement =>
    [false, true].map(success => [boundary, replacement, success]))))(
    'T-007 lateReloadCannotCompleteRetry / sameSocketAndReplacementKeepStateCorrelation boundary=%s replacement=%s success=%s',
    async (boundary, replacement, success) => {
      await withGraph(async h => {
        const {cc, requests, sockets, frame, login, flush} = h;
        await login(); cc.$config.allowAutomatedRelogin = true;
        const reloads = jest.spyOn(cc.services.agent, 'reload');
        const cleanup = jest.spyOn(cc.taskManager, 'invalidateRegionalTasks');
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'reload-retry'});
        jest.advanceTimersByTime(105000); await flush(); sockets[1].welcome(); await flush();
        const first = requests.find(r => r.resource === '/v1/agents/reload');
        let current = sockets[1];
        const abandoned = cc['sessionRequest'];
        if (boundary === 'timeout') {
          jest.advanceTimersByTime(20000); await flush();
          expect(cc['recovery'].retryNotBefore).toBe(Date.now() + 2000);
          jest.advanceTimersByTime(2000); await flush();
        } else {
          current.lost(); await flush();
          expect(abandoned.controller.signal.aborted).toBe(true);
          expect(cc['recovery'].retryNotBefore).toBe(Date.now() + 2000);
          jest.advanceTimersByTime(63000); await flush();
          current = sockets[2]; current.welcome(); await flush();
        }
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(2);
        // Retain this retry's primary or interrupt it once more and use its replacement.
        if (replacement) {
          const previous = current;
          current.lost(); await flush();
          expect(cc['recovery'].retryNotBefore).toBe(Date.now() + 4000);
          jest.advanceTimersByTime(boundary === 'timeout' ? 63000 : 31500); await flush();
          current = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
          expect(current).not.toBe(previous); current.welcome(); await flush();
        }
        const count = replacement ? 3 : 2;
        expect(reloads).toHaveBeenCalledTimes(count);
        expect(cc['recovery'].reloads).toBe(count);
        const second = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
        expect(second.headers.trackingid).not.toBe(first.headers.trackingid);
        const settled = jest.fn();
        const observedReload = reloads.mock.results.slice(-1)[0].value.then(settled, settled);
        const owner = cc['sessionRequest'];
        expect(owner.controller.signal.aborted).toBe(false);
        expect(cc.services.aqmReqs['operations'].size).toBe(1);
        expect(current.readyState).toBe(1);
        expect(cc['lastPublishedRegionState'].status).toBe('recovering');
        const before = lifecycleOwner(cc);
        const states = jest.fn(); cc.on('region:stateChange', states);
        // All abandoned IDs are delivered on the usable primary while its retry is pending.
        for (const stale of requests.filter(r => r.resource === '/v1/agents/reload').slice(0, -1)) {
          current.message(frame(success ? CC_EVENTS.AGENT_RELOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_FAILED,
            stale.headers.trackingid, {teamId: 'obsolete', agentSessionId: 'obsolete', dn: '0000',
              reasonCode: 1038, lastStateChangeReason: 'agent-wss-disconnect'}));
          await flush();
          expect(lifecycleOwner(cc)).toEqual(before);
          expect(settled).not.toHaveBeenCalled();
          expect(states).not.toHaveBeenCalled();
          expect(cc['sessionRequest']).toBe(owner);
          expect(cc.services.aqmReqs['operations'].size).toBe(1);
        }
        current.message(frame(CC_EVENTS.AGENT_RELOGIN_SUCCESS, second.headers.trackingid,
          {agentSessionId: 'current-session', teamId: 'current-team', dn: '9876'}));
        await observedReload; await flush();
        expect(settled).toHaveBeenCalledTimes(1);
        expect(states.mock.calls).toEqual([[{status: 'ready', reason: 'region-switch', trackingId: 'reload-retry',
          homeRegion: 'produs1', servingRegion: 'produs1', limitedService: false}]]);
        expect(cc['acceptedStation']).toEqual({orgId: 'org', agentId: 'agent', sessionId: 'current-session',
          revision: cc['stationRevision'], payload: {teamId: 'current-team', deviceType: 'EXTENSION',
            dialNumber: '9876', deviceId: '9876', isExtension: true, roles: ['agent'], teamName: '',
            siteId: '', usesOtherDN: false, auxCodeId: ''}});
        expect(cc['autoAvailable']).toBeUndefined();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(cc.services.aqmReqs['operations'].size).toBe(0);
        expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(1);
        expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(count);
        const explicit = cc.setAgentState({state: 'Idle', auxCodeId: 'manual'});
        await flush();
        const state = requests.filter(r => r.resource === '/v1/agents/session/state').slice(-1)[0];
        const stateSettled = jest.fn(); const observed = explicit.then(stateSettled); observed.catch(() => undefined);
        current.message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, 'obsolete-state', {auxCodeId: 'old'}), type: CC_EVENTS.AGENT_STATE_CHANGE});
        await flush(); expect(stateSettled).not.toHaveBeenCalled();
        current.message({...frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, state.headers.trackingid, {auxCodeId: 'manual', agentSessionId: 'current-session',
            lastStateChangeTimestamp: 2, lastIdleCodeChangeTimestamp: 3}), type: CC_EVENTS.AGENT_STATE_CHANGE});
        await observed; expect(stateSettled).toHaveBeenCalledTimes(1);
        expect(cc.agentConfig.lastStateAuxCodeId).toBe('manual');
      });
    }
  );

  it.each(['wait', 'subscribe', 'welcome', 'reload', 'retry-delay', 'fallback', 'post1035'].flatMap(phase =>
    ['logout', 'deregister', 'register', 'multi-login', 'org replacement', 'agent replacement', 'supersede', 'remote logout']
      .flatMap(boundary => [false, true].map(success => [phase, boundary, success]))))(
    'T-012 everyTerminationDuringEveryAwait / lateHttpWelcomeReloadMedia phase=%s boundary=%s lateSuccess=%s',
    async (phase, boundary, success) => {
      await withGraph(async ({cc, host, requests, sockets, login, frame, flush}) => {
        await login(); cc.$config.allowAutomatedRelogin = true;
        const http = createDeferred<any>();
        const requestBoundary = host.request.getMockImplementation();
        let held = false;
        host.request.mockImplementation(request => {
          if (phase === 'subscribe' && request.resource === SUBSCRIBE_API && !held) {
            held = true; requests.push(request); return http.promise;
          }
          return requestBoundary(request);
        });
        const driver = jest.spyOn(cc.services.connectionService, 'recoverRegion');
        sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'old'});
        const recovery = cc['recovery'];
        const observed = driver.mock.results[0].value.catch(error => error);
        if (phase !== 'wait') { jest.advanceTimersByTime(105000); await flush(); }
        const primary = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        const callbacks = {open: primary.onopen, message: primary.onmessage, close: primary.onclose};
        if (!['wait', 'subscribe', 'welcome'].includes(phase)) {
          primary.welcome(); await flush();
          if (phase === 'retry-delay') {
            const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
            primary.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reload.headers.trackingid, {reasonCode: 1037}));
            await flush();
          }
          if (phase === 'fallback' || phase === 'post1035') {
            const reload = requests.filter(r => r.resource === '/v1/agents/reload').slice(-1)[0];
            primary.message(frame(CC_EVENTS.AGENT_RELOGIN_FAILED, reload.headers.trackingid, {reasonCode: 1038}));
            await flush();
            expect(requests.filter(r => r.resource === '/v1/agents/login')).toHaveLength(2);
            if (phase === 'post1035') {
              const fallback = requests.filter(r => r.resource === '/v1/agents/login').slice(-1)[0];
              primary.message({...frame(CC_EVENTS.AGENT_STATION_LOGIN_FAILED, fallback.headers.trackingid,
                {reasonCode: 1035}), type: CC_EVENTS.AGENT_STATION_LOGIN}); await flush();
              expect(requests.filter(r => r.resource === '/v1/agents/reload')).toHaveLength(2);
            }
          }
        }
        expect(recovery.controller.signal.aborted).toBe(false);
        const abandoned = requests.filter(r => ['/v1/agents/login', '/v1/agents/reload'].includes(r.resource));
        cc.$config.allowAutomatedRelogin = false;
        let operation: Promise<unknown> | undefined;
        if (boundary === 'logout') operation = cc.stationLogout({logoutReason: 'user'});
        if (boundary === 'register') operation = cc.register();
        if (boundary === 'deregister') operation = cc.deregister();
        const operationObserved = operation?.catch(error => error);
        if (boundary === 'multi-login') cc.services.webSocketManager.emit('message', JSON.stringify({type: CC_EVENTS.AGENT_MULTI_LOGIN}));
        if (boundary === 'org replacement') {
          host.credentials.getOrgId = () => 'replacement-org';
          await expect(cc.setAgentState({state: 'Idle', auxCodeId: 'idle'})).rejects.toThrow();
        }
        if (boundary === 'agent replacement') cc.services.webSocketManager.emit('message', JSON.stringify({type: 'Welcome', data: {agentId: 'replacement-agent'}}));
        if (boundary === 'supersede') cc.services.webSocketManager.emit('message', JSON.stringify({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'new'}));
        if (boundary === 'remote logout') cc.services.webSocketManager.emit('message', JSON.stringify({
          ...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'remote-logout'), type: CC_EVENTS.AGENT_LOGOUT}));
        await flush();
        if (boundary === 'register') {
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await flush();
        }
        if (boundary === 'logout' && cc.services.webSocketManager.hasUsableSocket())
          primary.message({...frame(CC_EVENTS.AGENT_LOGOUT_SUCCESS, 'logout'), type: CC_EVENTS.AGENT_LOGOUT});
        await operationObserved; await flush();
        expect(recovery.controller.signal.aborted).toBe(true);
        await observed;
        const owner = lifecycleOwner(cc);
        const count = requests.length;
        const publications = jest.fn(); cc.on('region:stateChange', publications);
        if (held) {
          if (success) http.resolve({statusCode: 200, body: {webSocketUrl: 'wss://obsolete.produs2.cisco.com/'}});
          else http.reject(new Error('abandoned HTTP'));
        }
        callbacks.open?.();
        callbacks.message?.({data: JSON.stringify({type: 'Welcome', data: {agentId: 'agent'}})});
        callbacks.close?.();
        const current = sockets.filter(s => s.url.includes('routing.')).slice(-1)[0];
        for (const request of abandoned) {
          const loginRequest = request.resource === '/v1/agents/login';
          const type = loginRequest
            ? success ? CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS : CC_EVENTS.AGENT_STATION_LOGIN_FAILED
            : success ? CC_EVENTS.AGENT_RELOGIN_SUCCESS : CC_EVENTS.AGENT_RELOGIN_FAILED;
          current.message({...frame(type, request.headers.trackingid,
            {teamId: 'obsolete', agentSessionId: 'obsolete'}), ...(loginRequest ? {type: CC_EVENTS.AGENT_STATION_LOGIN} : {})});
        }
        await flush();
        expect(lifecycleOwner(cc)).toEqual(owner);
        expect(publications).not.toHaveBeenCalled();
        expect(requests).toHaveLength(count);
        expect(cc.services.aqmReqs['operations'].size).toBe(0);
        expect(driver).toHaveBeenCalledTimes(boundary === 'supersede' ? 2 : 1);
      });
    }
  );

  it.each([
    ['independent higher state version', {}, 2, 1, true],
    ['independent higher idle version', {}, 1, 2, true],
    ['independent equal version differing tuple', {}, 1, 1, true],
    ['lower state version despite newer idle', {}, 0, 999, false],
    ['lower idle version', {}, 1, 0, false],
    ['failure', {type: CC_EVENTS.AGENT_STATE_CHANGE_FAILED}, 2, 3, false],
    ['foreign org', {orgId: 'foreign'}, 2, 3, false],
    ['foreign agent', {agentId: 'foreign'}, 2, 3, false],
    ['foreign session', {agentSessionId: 'foreign'}, 2, 3, false],
    ['missing session', {agentSessionId: undefined}, 2, 3, false],
    ['non-numeric timestamp', {}, '2', 3, false],
    ['non-finite state timestamp on the wire', {}, Infinity, 3, false],
    ['missing status', {status: undefined}, 2, 3, false],
    ['malformed aux', {auxCodeId: 1}, 2, 3, false],
  ])('T-007 authoritativeStateReconciliation field table %s', async (_name, fields, stateVersion, idleVersion, applies) => {
    await withGraph(async ({cc, sockets, login, frame, flush}) => {
      await login();
      const profile = cc.agentConfig;
      const station = cc['acceptedStation'];
      const revision = cc['stationRevision'];
      const session = cc['currentAgentSessionId'];
      const voice = cc.getVoiceConnectionState();
      const confirmed = cc['confirmedState'];
      const payload = frame(CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS, 'independent', {
        subStatus: 'Available', auxCodeId: '0', lastStateChangeTimestamp: stateVersion,
        lastIdleCodeChangeTimestamp: idleVersion, teamId: 'must-not-change', deviceType: 'BROWSER',
        dn: 'must-not-change', ...fields});
      const received = JSON.parse(JSON.stringify(payload)).data;
      const generic = jest.fn(), success = jest.fn(), changed = jest.fn();
      cc.on(received.type, generic);
      cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS, success);
      cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE, changed);
      sockets[0].message({...payload, type: CC_EVENTS.AGENT_STATE_CHANGE}); await flush();
      expect(cc.agentConfig).toBe(profile);
      expect([profile.lastStateAuxCodeId, profile.lastStateChangeTimestamp, profile.lastIdleCodeChangeTimestamp])
        .toEqual(applies ? ['0', stateVersion, idleVersion] : ['idle', 1, 1]);
      expect(cc['acceptedStation']).toBe(station);
      expect(cc['stationRevision']).toBe(revision);
      expect(cc['currentAgentSessionId']).toBe(session);
      expect([profile.currentTeamId, profile.deviceType, profile.dn, profile.isAgentLoggedIn])
        .toEqual(['team', 'EXTENSION', '1234', true]);
      expect(cc.getVoiceConnectionState()).toEqual(voice);
      expect(generic.mock.calls).toEqual([[received]]);
      expect(changed.mock.calls).toEqual([[received]]);
      expect(success.mock.calls).toEqual(received.type === CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS ? [[received]] : []);
      const current = cc['confirmedState'];
      if (!applies) expect(current).toBe(confirmed);
      else {
        expect(current.data).toEqual(received);
        // An identical echo is idempotent, including ledger identity and dispatch ordering.
        sockets[0].message({...payload, type: CC_EVENTS.AGENT_STATE_CHANGE}); await flush();
        expect(cc['confirmedState']).toBe(current);
        expect(generic).toHaveBeenCalledTimes(2);
      }
    });
  });

  it('T-008 entryInterruptBefore100sWait and real gate admission', async () => {
    await withGraph(async ({cc, requests, sockets, login, flush}) => {
      await login();
      const pending = cc.services.agent.reload();
      const rejection = expect(pending).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      await flush();
      sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
      await rejection;
      await expect(cc.setAgentState({state: 'Available', auxCodeId: '0'})).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
      expect(requests.filter(r => r.resource === '/v1/agents/session/state')).toHaveLength(0);
      expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
    });
  });

  it.each(['switch', 'register', 'deregister', 'multi-login', 'org replacement', 'agent replacement'])(
    'T-008/T-009/T-012 everyTerminationDuringEveryAwait / lateHttpWelcomeReloadMedia pending media %s', async boundary => {
    const mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    const acquisition = createDeferred<MediaStream>();
    const getUserMedia = jest.fn(() => acquisition.promise);
    const track = {stop: jest.fn()};
    Object.defineProperty(navigator, 'mediaDevices', {value: {getUserMedia}, configurable: true});
    try {
      await withGraph(async ({cc, graph, host, requests, sockets, login, flush}) => {
        await login();
        const calling = cc.webCallingService;
        calling.setLoginOption(LoginOption.BROWSER);
        calling.setBrowserVoiceRequired(true);
        const line = {deregister: jest.fn().mockResolvedValue(undefined)};
        calling['line'] = line;
        calling['handleLineRegistered'](line);
        expect(calling.isVoiceReady()).toBe(true);
        const call = {answer: jest.fn(), end: jest.fn(), off: jest.fn(), getCallId: () => 'pending-call'};
        calling['call'] = call;
        const answer = jest.spyOn(calling, 'answerCall');
        const deregister = jest.spyOn(calling, 'deregisterWebCallingLine');
        const end = jest.spyOn(cc.services.contact, 'end');
        const data = createAISummaryLifecycleTaskData({type: CC_EVENTS.AGENT_CONTACT,
          agentId: 'agent', orgId: 'org', interaction: {state: 'new'} as any});
        sockets[0].message({type: CC_EVENTS.AGENT_CONTACT, data});
        const task = cc.taskManager.getTask(data.interactionId);
        expect(task).toBeInstanceOf(graph.WebRTC);
        expect(jest.isMockFunction(task.accept)).toBe(false);
        const ended = jest.fn(); task.on(TASK_EVENTS.TASK_END, ended);
        const controller = cc['commandController'];
        const interrupt = jest.spyOn(cc.taskManager, 'interruptTaskOperations');
        const rejected = jest.fn();
        const result = task.accept().catch(error => {rejected(error); return error;});
        expect(getUserMedia).toHaveBeenCalledWith({audio: true});

        let operation: Promise<unknown> | undefined;
        if (boundary === 'switch') sockets[0].message({type: 'SYSTEM_REGION_SWITCH', orgId: 'org', trackingId: 'switch'});
        if (boundary === 'register') operation = cc.register();
        if (boundary === 'deregister') operation = cc.deregister();
        operation?.catch(() => undefined);
        if (boundary === 'multi-login') sockets[0].message({type: CC_EVENTS.AGENT_MULTI_LOGIN});
        if (boundary === 'org replacement') {
          host.credentials.getOrgId = () => 'replacement-org';
          await expect(cc.setAgentState({state: 'Idle', auxCodeId: 'idle'})).rejects.toThrow();
        }
        if (boundary === 'agent replacement') sockets[0].message({type: 'Welcome', data: {agentId: 'replacement-agent'}});
        expect(controller.signal.aborted).toBe(true);
        expect(interrupt).toHaveBeenCalled();
        await flush();
        // Assert settlement while acquisition is still pending, before any cleanup can mask it.
        expect(rejected).toHaveBeenCalledTimes(1);
        expect((await result).data.reason).toBe('RECOVERY_INTERRUPTED');
        if (boundary === 'register') {
          sockets.filter(s => s.url.includes('routing.')).slice(-1)[0].welcome(); await operation;
        } else await operation;
        if (boundary === 'switch') {
          expect(cc.taskManager.getTask(data.interactionId)).toBe(task);
          jest.advanceTimersByTime(50000); await flush();
          expect(sockets).toHaveLength(1);
          expect(requests.filter(r => r.resource === SUBSCRIBE_API)).toHaveLength(1);
          expect(cc['lastPublishedRegionState'].status).toBe('recovering');
        }
        expect(track.stop).not.toHaveBeenCalled();
        const cleanupCalls = [deregister.mock.calls.length, line.deregister.mock.calls.length];

        acquisition.resolve({getTracks: () => [track], getAudioTracks: () => [track]} as unknown as MediaStream);
        await flush();
        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(answer).not.toHaveBeenCalled();
        expect(call.answer).not.toHaveBeenCalled();
        expect(call.end).not.toHaveBeenCalled();
        expect(end).not.toHaveBeenCalled();
        expect(ended).not.toHaveBeenCalled();
        expect([deregister.mock.calls.length, line.deregister.mock.calls.length]).toEqual(cleanupCalls);
        if (boundary === 'switch') {
          expect(cleanupCalls).toEqual([0, 0]);
          expect(calling['line']).toBe(line);
          expect(calling.isVoiceReady()).toBe(true);
        }
      });
    } finally {
      if (mediaDevices) Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
      else Reflect.deleteProperty(navigator, 'mediaDevices');
    }
  });
});

function hostRecoveryGuideSources() {
  const fs = require('fs'), path = require('path');
  const guide = () => fs.readFileSync(path.resolve(__dirname, '../../../docs/getting-started.md'), 'utf8');
  const helperSource = () => {
    const text = guide();
    const start = '<!-- region-recovery-host-example:start -->';
    const end = '<!-- region-recovery-host-example:end -->';
    expect(text.split(start)).toHaveLength(2); expect(text.split(end)).toHaveLength(2);
    expect(text.indexOf(start)).toBeLessThan(text.indexOf(end));
    const source = text.slice(text.indexOf(start) + start.length, text.indexOf(end));
    const match = source.match(/^\s*```ts\r?\n([\s\S]*?)\r?\n```\s*$/);
    expect(match).not.toBeNull(); expect(match[1]).not.toContain('```');

    return match[1];
  };
  const wiringSource = () => {
    const section = guide().split('## Multi-region recovery host restart\n')[1].split('\n## ')[0];
    const blocks = Array.from(section.matchAll(/```ts\r?\n([\s\S]*?)\r?\n```/g));
    expect(blocks).toHaveLength(2);

    return blocks[1][1];
  };

  return {guide, helperSource, wiringSource};
}

describe('T-006/T-013 exact host recovery guide', () => {
  const ts = require('typescript'), vm = require('vm');
  const {helperSource, wiringSource} = hostRecoveryGuideSources();
  const load = () => {
    const result = ts.transpileModule(helperSource(), {reportDiagnostics: true,
      compilerOptions: {target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None}});
    expect((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
    const helper = vm.runInNewContext(result.outputText + '\n;decideRegionRestart;', {}, {timeout: 1000});
    expect(typeof helper).toBe('function');
    return helper;
  };
  const storage = () => {
    const map = new Map<string, string>();
    return {map, getItem: jest.fn(key => map.has(key) ? map.get(key) : null),
      setItem: jest.fn((key, value) => {map.set(key, value);})};
  };

  it('exactMarkedHelperIsExecuted and firstRestartStoredBeforeNavigation', () => {
    const helper = load(); const tab = storage(); const order: string[] = [];
    tab.setItem.mockImplementation((key, value) => {tab.map.set(key, value); order.push('stored');});
    if (helper(() => 'org', 1, () => tab) === 'restart') order.push('navigation');
    expect(order).toEqual(['stored', 'navigation']);
    expect(tab.getItem).toHaveBeenCalledWith('ccsdk:region-reload:org');
  });
  it('perOrgPerTabPersistsAcrossReloadContexts', () => {
    const tab = storage(); expect(load()(() => 'org-a', 100, () => tab)).toBe('restart');
    expect(load()(() => 'org-a', 101, () => tab)).toBe('blocked');
    expect(load()(() => 'org-b', 101, () => tab)).toBe('restart');
    expect(load()(() => 'org-a', 101, () => storage())).toBe('restart');
  });
  it.each([[119999, 'blocked'], [120000, 'restart']])('119999Blocked120000Allowed age=%s', (age, expected) => {
    const helper = load(), tab = storage(); helper(() => 'org', 1000, () => tab);
    expect(helper(() => 'org', 1000 + Number(age), () => tab)).toBe(expected);
  });
  it.each(['', 'not json', '{}', '[]', 'null', 'true', '-1', '"123"', 'NaN', 'Infinity', '1001'])(
    'clockRollbackAndStorageFailureBlocked / malformed guard %s', value => {
      const tab = storage(); tab.map.set('ccsdk:region-reload:org', value);
      expect(load()(() => 'org', 1000, () => tab)).toBe('blocked');
      expect(tab.setItem).not.toHaveBeenCalled();
    });
  it.each([NaN, Infinity, -1])('invalid time %s fails closed', now => {
    const tab = storage(); expect(load()(() => 'org', now, () => tab)).toBe('blocked');
    expect(tab.setItem).not.toHaveBeenCalled();
  });
  it('obtainingSessionStorageThrowsBlocked', () => {
    const access = () => {throw new Error('SecurityError');};
    expect(load()(() => 'org', 100, access)).toBe('blocked');
  });
  it.each(['getItem', 'setItem'])('storageMethodsThrowBlocked %s', method => {
    const tab = storage(); tab[method].mockImplementation(() => {throw new Error('storage denied');});
    expect(load()(() => 'org', 100, () => tab)).toBe('blocked');
  });
  it('authenticatedOrgReadAtDecisionTime', () => {
    const tab = storage(), helper = load(); let org: any = 'org-a';
    const read = jest.fn(() => org);
    expect(helper(read, 100, () => tab)).toBe('restart'); org = 'org-b';
    expect(helper(read, 100, () => tab)).toBe('restart'); org = '  ';
    expect(helper(read, 100, () => tab)).toBe('blocked'); org = null;
    expect(helper(read, 100, () => tab)).toBe('blocked');
    expect(helper(() => {throw new Error('identity unavailable');}, 100, () => tab)).toBe('blocked');
    expect(tab.setItem).toHaveBeenCalledTimes(2);
  });
  it('deliveredHostWiringCompilesWithStrictTypeScript', () => {
    const exampleFile = '/region-recovery-host-example.ts';
    const declarationsFile = '/region-recovery-host-declarations.d.ts';
    // Declare only the imported SDK surface and initialized host used by the delivered wiring.
    const files = new Map([
      [exampleFile, `${helperSource()}\n${wiringSource()}`],
      [declarationsFile, `
        declare module '@webex/contact-center' {
          export const REGION_RECOVERY_EVENTS: {readonly STATE_CHANGE: 'region:stateChange'};
          export const REGION_RECOVERY_ERROR_CODES: {
            readonly REGION_RELOAD_REQUIRED: 'REGION_RELOAD_REQUIRED';
          };
          export type RegionRecoveryState = {
            status: 'recovering' | 'ready' | 'reloadRequired' | 'stationLoginRequired' | 'unavailable';
          };
        }
        declare const webex: {
          credentials: {getOrgId(): string | null | undefined};
          cc: {
            on(event: 'region:stateChange', listener: (state: import('@webex/contact-center').RegionRecoveryState) => void): void;
            off(event: 'region:stateChange', listener: (state: import('@webex/contact-center').RegionRecoveryState) => void): void;
            register(): Promise<unknown>;
            stationLogout(options: {logoutReason: string}): Promise<unknown>;
            deregister(): Promise<void>;
          };
        };
      `],
    ]);
    const options = {strict: true, useUnknownInCatchVariables: true, noEmit: true,
      target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.ESNext,
      lib: ['lib.es2019.d.ts', 'lib.dom.d.ts'], types: []};
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      files.has(fileName)
        ? ts.createSourceFile(fileName, files.get(fileName), languageVersion, true)
        : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram(Array.from(files.keys()), options, host);
    expect(ts.getPreEmitDiagnostics(program).map(d =>
      ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });
});

describe('delivered host recovery wiring regressions', () => {
  const ts = require('typescript'), vm = require('vm');
  const {helperSource, wiringSource} = hostRecoveryGuideSources();
  const {REGION_RECOVERY_EVENTS, REGION_RECOVERY_ERROR_CODES} = require('../../../src/constants');
  const blockedMessage = 'Automatic restart blocked. Check the session and restart manually.';
  const ready = Object.freeze({status: 'ready', reason: 'region-switch', autoAvailable: 'waitingForVoice'});
  const cancelled = Object.freeze({...ready, autoAvailable: 'cancelled'});
  const mismatch = Object.freeze({status: 'reloadRequired', reason: 'region-mismatch'});
  const key = 'ccsdk:region-reload:org';

  // Execute the delivered wiring only here; T-006 still evaluates the marked helper alone.
  const loadWiring = () => {
    const cc = Object.assign(new EventEmitter(), {
      register: jest.fn().mockResolvedValue({agentId: 'agent'}),
      stationLogout: jest.fn().mockResolvedValue({loggedOut: true}),
      deregister: jest.fn().mockResolvedValue(undefined),
    });
    const values = new Map<string, string>();
    const sessionStorage = {
      getItem: jest.fn(key => values.has(key) ? values.get(key) : null),
      setItem: jest.fn((key, value) => {values.set(key, value);}),
    };
    const reload = jest.fn(), error = jest.fn();
    const webex = {cc, credentials: {getOrgId: jest.fn(() => 'org')}};
    const importedSdk = {REGION_RECOVERY_EVENTS, REGION_RECOVERY_ERROR_CODES};
    const result = ts.transpileModule(`${helperSource()}\n${wiringSource()}`, {
      reportDiagnostics: true,
      compilerOptions: {target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS},
    });
    expect((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
    const host = vm.runInNewContext(
      result.outputText + '\n;({registerAgent, logoutAgent, teardownAgent, getRegion: () => region});',
      {webex, window: {sessionStorage, location: {reload}}, console: {error}, Date, exports: {},
        require: name => {
          expect(name).toBe('@webex/contact-center');
          return importedSdk;
        }},
      {timeout: 1000}
    );
    const publish = snapshot => cc.emit(REGION_RECOVERY_EVENTS.STATE_CHANGE, snapshot);

    return {host, cc, publish, values, sessionStorage, reload, error};
  };

  afterEach(() => jest.useRealTimers());

  it.each([
    ['register', 'registerAgent', 'resolve'],
    ['register', 'registerAgent', 'reject'],
    ['stationLogout', 'logoutAgent', 'resolve'],
    ['stationLogout', 'logoutAgent', 'reject'],
  ])('%s/%s clears synchronous cancellation and preserves %s settlement', async (sdkMethod, hostMethod, outcome) => {
    const {host, cc, publish} = loadWiring();
    await host.registerAgent();
    publish(ready);
    expect(host.getRegion()).toBe(ready);
    const pending = createDeferred<unknown>();
    const result = {operation: sdkMethod};
    const failure = Object.assign(new Error('operation failed'), {data: {reason: 'RECOVERY_INTERRUPTED'}});
    cc[sdkMethod].mockClear().mockImplementation(() => {
      publish(cancelled);
      expect(host.getRegion()).toBe(cancelled);
      return pending.promise;
    });
    if (outcome === 'reject') pending.reject(failure);
    const operation = host[hostMethod]();
    const displayedAfterInvocation = host.getRegion();
    if (outcome === 'resolve') {
      pending.resolve(result);
      await expect(operation).resolves.toBe(result);
    } else {
      await expect(operation).rejects.toBe(failure);
    }
    expect(displayedAfterInvocation).toBeUndefined();
    expect(cc[sdkMethod].mock.calls).toEqual(sdkMethod === 'register'
      ? [[]] : [[{logoutReason: 'User requested logout'}]]);
    expect(host.getRegion()).toBeUndefined();
    publish(ready);
    expect(host.getRegion()).toBe(ready);
    expect(cc.listenerCount(REGION_RECOVERY_EVENTS.STATE_CHANGE)).toBe(1);
  });

  it.each(['during register invocation', 'while register is pending'])(
    'one mismatch event and rejection %s request one non-unloading restart', async timing => {
      jest.useFakeTimers().setSystemTime(1000);
      const {host, cc, publish, values, sessionStorage, reload, error} = loadWiring();
      const pending = createDeferred<unknown>();
      const failure = Object.assign(new Error('region mismatch'), {
        data: {reason: REGION_RECOVERY_ERROR_CODES.REGION_RELOAD_REQUIRED},
      });
      cc.register.mockImplementation(() => {
        if (timing === 'during register invocation') publish(mismatch);
        return pending.promise;
      });
      // Navigation returns; the rejection still runs in this same host context.
      reload.mockImplementation(() => {
        expect(values.get(key)).toBe('1000');
      });
      const operation = host.registerAgent();
      expect(host.getRegion()).toBeUndefined();
      if (timing === 'while register is pending') publish(mismatch);
      pending.reject(failure);
      await expect(operation).rejects.toBe(failure);
      expect(reload.mock.calls).toEqual([[]]);
      expect(error).not.toHaveBeenCalled();
      expect(sessionStorage.getItem.mock.calls).toEqual([[key]]);
      expect(sessionStorage.setItem.mock.calls).toEqual([[key, '1000']]);
      expect(cc.listenerCount(REGION_RECOVERY_EVENTS.STATE_CHANGE)).toBe(1);
    }
  );

  it.each(['event', 'register rejection', 'event and register rejection'])(
    'non-unloading reload surfaces blocked %s requests and permits restart at 120000 ms', async source => {
      jest.useFakeTimers().setSystemTime(1000);
      const {host, cc, publish, values, sessionStorage, reload, error} = loadWiring();
      await host.registerAgent();
      // This navigation boundary deliberately returns without unloading the host context.
      reload.mockImplementation(() => {
        expect(values.get(key)).toBe(JSON.stringify(Date.now()));
      });
      publish(mismatch);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
      const failure = Object.assign(new Error('region mismatch'), {
        data: {reason: REGION_RECOVERY_ERROR_CODES.REGION_RELOAD_REQUIRED},
      });
      cc.register.mockImplementation(() => {
        if (source === 'event and register rejection') publish(mismatch);
        return Promise.reject(failure);
      });
      const request = async () => {
        if (source === 'event') publish(mismatch);
        else await expect(host.registerAgent()).rejects.toBe(failure);
      };
      for (const elapsed of [0, 119999]) {
        jest.setSystemTime(1000 + elapsed);
        await request();
        expect(error.mock.calls).toEqual(Array(elapsed === 0 ? 1 : 2).fill([blockedMessage]));
        expect(reload).toHaveBeenCalledTimes(1);
        expect(values.get(key)).toBe('1000');
      }
      jest.setSystemTime(121000);
      await request();
      expect(reload).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(2);
      expect(sessionStorage.setItem.mock.calls).toEqual([[key, '1000'], [key, '121000']]);
      expect(host.getRegion()).toEqual(source === 'event' ? mismatch : undefined);
    }
  );
});
