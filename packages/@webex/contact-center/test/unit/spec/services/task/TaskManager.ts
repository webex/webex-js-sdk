import 'jsdom-global/register';
import EventEmitter from 'events';
import {ConfigFlags, LoginOption, WebexSDK} from '../../../../../src/types';
import {CALL_EVENT_KEYS, CallingClientConfig, LINE_EVENTS} from '@webex/calling';
import {
  CC_AGENT_EVENTS,
  CC_AI_SUMMARY_EVENTS,
  CC_EVENTS,
  WrapupData,
} from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact';
import {TASK_EVENTS} from '../../../../../src/services/task/types';
import {TaskEvent} from '../../../../../src/services/task/state-machine';
import WebRTC from '../../../../../src/services/task/voice/WebRTC';
import WebCallingService from '../../../../../src/services/WebCallingService';
import config from '../../../../../src/config';
import TaskFactory from '../../../../../src/services/task/TaskFactory';
import {METRIC_EVENT_NAMES} from '../../../../../src/metrics/constants';
import {
  AI_SUMMARY_DURATION_MS,
  AI_SUMMARY_REQUEST_CANCELLED,
  METHODS,
} from '../../../../../src/services/task/constants';
import {AI_SUMMARY_ERROR_CODES, TASK_MANAGER_FILE} from '../../../../../src/constants';
import {
  checkParticipantNotInInteraction,
  getAISummaryCorrelation,
  getConferenceParticipantsCount,
  getConsultMediaResourceId,
  getIsConsultInProgressForConferenceControls,
  getIsConsultedAgentForControls,
  getIsCustomerInCall,
  getServerHoldStateForControls,
  hasAgentInitiatedOutdial,
  isAutoAnswerEnabled,
  isCampaignPreviewReservation,
  isCampaignPreviewTask,
  isDigitalOutbound,
  isParticipantInMainInteraction,
  isPrimary,
  isSecondaryAgent,
  isSecondaryEpDnAgent,
  isWebRTCCall,
  shouldAutoAnswerTask,
  tryGetAISummaryCorrelation,
} from '../../../../../src/services/task/TaskUtils';

jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../../../../src/metrics/MetricsManager', () => {
  const mockTrackEvent = jest.fn();

  return {
    __esModule: true,
    default: {
      getInstance: jest.fn(() => ({
        trackEvent: mockTrackEvent,
      })),
    },
    mockTrackEvent,
  };
});

jest.mock('../../../../../src/services/task/contact', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../../../src/services/WebCallingService', () => {
  const EventEmitter = require('events');

  return {
    __esModule: true,
    default: class MockWebCallingService extends EventEmitter {
      loginOption?: string;
      call?: unknown;
      mapCallToTask = jest.fn();
      cleanUpCall = jest.fn(() => {
        (this.call as {off?: (event: string, listener: () => void) => void})?.off?.(
          'remote_media',
          () => undefined
        );
        (this.call as {off?: (event: string, listener: () => void) => void})?.off?.(
          'disconnect',
          () => undefined
        );
      });
    },
  };
});

jest.mock('../../../../../src/services/task/TaskFactory', () => ({
  __esModule: true,
  default: {
    createTask: jest.fn(),
  },
}));

jest.mock('../../../../../src/services/task/state-machine', () => {
  const TaskEvent = {
    TASK_INCOMING: 'TASK_INCOMING',
    TASK_OFFERED: 'TASK_OFFERED',
    OFFER_CONSULT: 'OFFER_CONSULT',
    HYDRATE: 'HYDRATE',
    CONTACT_UPDATED: 'CONTACT_UPDATED',
    CONTACT_OWNER_CHANGED: 'CONTACT_OWNER_CHANGED',
    ASSIGN: 'ASSIGN',
    HOLD_SUCCESS: 'HOLD_SUCCESS',
    UNHOLD_SUCCESS: 'UNHOLD_SUCCESS',
    CONSULT_CREATED: 'CONSULT_CREATED',
    CONSULTING_ACTIVE: 'CONSULTING_ACTIVE',
    CONSULT_END: 'CONSULT_END',
    CONSULT_FAILED: 'CONSULT_FAILED',
    CTQ_CANCEL: 'CTQ_CANCEL',
    CTQ_CANCEL_FAILED: 'CTQ_CANCEL_FAILED',
    CONFERENCE_START: 'CONFERENCE_START',
    CONFERENCE_FAILED: 'CONFERENCE_FAILED',
    CONFERENCE_END: 'CONFERENCE_END',
    PARTICIPANT_LEAVE: 'PARTICIPANT_LEAVE',
    TRANSFER_SUCCESS: 'TRANSFER_SUCCESS',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    TRANSFER_CONFERENCE_SUCCESS: 'TRANSFER_CONFERENCE_SUCCESS',
    TASK_WRAPUP: 'TASK_WRAPUP',
    CONTACT_ENDED: 'CONTACT_ENDED',
    WRAPUP_COMPLETE: 'WRAPUP_COMPLETE',
    ASSIGN_FAILED: 'ASSIGN_FAILED',
    INVITE_FAILED: 'INVITE_FAILED',
    RONA: 'RONA',
    OUTBOUND_FAILED: 'OUTBOUND_FAILED',
    PAUSE_RECORDING: 'PAUSE_RECORDING',
    RECORDING_STARTED: 'RECORDING_STARTED',
    RESUME_RECORDING: 'RESUME_RECORDING',
    CAMPAIGN_PREVIEW_ACCEPT_FAILED: 'CAMPAIGN_PREVIEW_ACCEPT_FAILED',
    CAMPAIGN_PREVIEW_SKIP_FAILED: 'CAMPAIGN_PREVIEW_SKIP_FAILED',
    CAMPAIGN_PREVIEW_REMOVE_FAILED: 'CAMPAIGN_PREVIEW_REMOVE_FAILED',
    END: 'END',
  };

  return {
    __esModule: true,
    TaskEvent,
  };
});

jest.mock('../../../../../src/services/task/voice/WebRTC', () => {
  const EventEmitter = require('events');

  return {
    __esModule: true,
    default: class MockWebRTC extends EventEmitter {
      data: Record<string, unknown>;
      webCallingService: EventEmitter;
      handleRemoteMedia = jest.fn();
      unregisterWebCallListeners = jest.fn(() => {
        this.webCallingService.off('remote_media', this.handleRemoteMedia);
      });
      cancelAutoWrapupTimer = jest.fn();
      updateUiControls = jest.fn();
      updateTaskData = jest.fn((newData) => {
        this.data = {...this.data, ...newData};

        return this;
      });
      sendStateMachineEvent = jest.fn((event) => {
        if (event.taskData) {
          this.updateTaskData(event.taskData);
        }
        if (event.type === 'CONTACT_ENDED') {
          this.emit('task:cleanup', this, {removeFromCollection: false});
        }
      });

      constructor(
        _contact: unknown,
        _webCallingService: unknown,
        data: Record<string, unknown>
      ) {
        super();
        this.data = data;
        this.webCallingService = _webCallingService as EventEmitter;
        this.webCallingService.on('remote_media', this.handleRemoteMedia);
      }
    },
  };
});

describe('TaskManager', () => {
  let mockCall;
  let mockApiAIAssistant;
  let webSocketManagerMock;
  let rtdWebSocketManagerMock;
  let onSpy;
  let offSpy;
  let taskManager;
  let contactMock;
  let taskDataMock;
  let webCallingService;
  let webex: WebexSDK;
  const taskId = '0ae913a4-c857-4705-8d49-76dd3dde75e4';
  const getMetricsTrackEvent = (): jest.Mock =>
    require('../../../../../src/metrics/MetricsManager').mockTrackEvent;
  const getLoggerProxy = (): Record<string, jest.Mock> =>
    require('../../../../../src/logger-proxy').default;
  const getInboundDropMetricCalls = () =>
    getMetricsTrackEvent().mock.calls.filter(
      ([eventName]) => eventName === METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED
    );
  const expectNoSensitiveDiagnostics = (...sensitiveValues: string[]) => {
    const diagnostics = JSON.stringify({
      metrics: getMetricsTrackEvent().mock.calls,
      warnings: getLoggerProxy().warn.mock.calls,
      errors: getLoggerProxy().error.mock.calls,
    });

    sensitiveValues.forEach((value) => {
      expect(diagnostics).not.toContain(value);
    });
  };

  const createEventEmitterTask = (data = taskDataMock) => {
    const task = new EventEmitter() as any;
    const originalOn = task.on.bind(task);

    const updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {...task.data, ...newData};
      return task;
    });

    Object.assign(task, {
      data,
      on: jest.fn((...args) => originalOn(...args)),
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData,
      configureAISummary: jest.fn(),
      unregisterWebCallListeners: jest.fn(),
      cancelAutoWrapupTimer: jest.fn(),
    });

    return task;
  };

  const createStateMachineTask = (data = taskDataMock) => {
    const task = createEventEmitterTask(data);

    const taskEventMap: Partial<Record<TaskEvent, string>> = {
      [TaskEvent.TASK_INCOMING]: TASK_EVENTS.TASK_INCOMING,
      [TaskEvent.TASK_OFFERED]: TASK_EVENTS.TASK_OFFER_CONTACT,
      [TaskEvent.OFFER_CONSULT]: TASK_EVENTS.TASK_OFFER_CONSULT,
      [TaskEvent.HYDRATE]: TASK_EVENTS.TASK_HYDRATE,
      [TaskEvent.CONTACT_OWNER_CHANGED]: TASK_EVENTS.TASK_HYDRATE,
      [TaskEvent.ASSIGN]: TASK_EVENTS.TASK_ASSIGNED,
      [TaskEvent.HOLD_SUCCESS]: TASK_EVENTS.TASK_HOLD,
      [TaskEvent.UNHOLD_SUCCESS]: TASK_EVENTS.TASK_RESUME,
      [TaskEvent.CONSULT_CREATED]: TASK_EVENTS.TASK_CONSULT_CREATED,
      [TaskEvent.CONSULTING_ACTIVE]: TASK_EVENTS.TASK_CONSULT_ACCEPTED,
      [TaskEvent.CONSULT_END]: TASK_EVENTS.TASK_CONSULT_END,
      [TaskEvent.CONSULT_FAILED]: CC_EVENTS.AGENT_CONSULT_FAILED,
      [TaskEvent.CTQ_CANCEL]: TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED,
      [TaskEvent.CTQ_CANCEL_FAILED]: TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED,
      [TaskEvent.END]: TASK_EVENTS.TASK_END,
      [TaskEvent.CONTACT_ENDED]: TASK_EVENTS.TASK_END,
      [TaskEvent.ASSIGN_FAILED]: TASK_EVENTS.TASK_REJECT,
      [TaskEvent.INVITE_FAILED]: TASK_EVENTS.TASK_REJECT,
      [TaskEvent.RONA]: TASK_EVENTS.TASK_REJECT,
      [TaskEvent.OUTBOUND_FAILED]: TASK_EVENTS.TASK_OUTDIAL_FAILED,
      [TaskEvent.RECORDING_STARTED]: TASK_EVENTS.TASK_RECORDING_STARTED,
      [TaskEvent.PAUSE_RECORDING]: TASK_EVENTS.TASK_RECORDING_PAUSED,
      [TaskEvent.RESUME_RECORDING]: TASK_EVENTS.TASK_RECORDING_RESUMED,
      [TaskEvent.WRAPUP_COMPLETE]: TASK_EVENTS.TASK_WRAPPEDUP,
    };

    task.sendStateMachineEvent = jest.fn().mockImplementation((event) => {
      if (event.taskData) {
        task.updateTaskData(event.taskData);
      }

      let mappedEvent = taskEventMap[event.type as TaskEvent];
      if (
        event.type === TaskEvent.TASK_INCOMING &&
        event.isCampaignReservationAccept === true
      ) {
        mappedEvent = TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION;
      }

      if (mappedEvent) {
        if (
          [TaskEvent.ASSIGN_FAILED, TaskEvent.RONA, TaskEvent.INVITE_FAILED].includes(
            event.type as TaskEvent
          )
        ) {
          task.emit(mappedEvent, event.reason ?? event.taskData?.reason);
        } else if (event.type === TaskEvent.OUTBOUND_FAILED) {
          if (!event.taskData?.suppressOutdialFailedPopup) {
            task.emit(mappedEvent, event.reason);
          }
        } else {
          task.emit(mappedEvent, task);
        }
      }

      if ([TaskEvent.ASSIGN, TaskEvent.CONSULTING_ACTIVE].includes(event.type as TaskEvent)) {
        task.emit(TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE, task);
      }

      // Auto-answer is now handled at the Task layer (triggered by state machine actions)
      if (
        [TaskEvent.TASK_OFFERED, TaskEvent.OFFER_CONSULT].includes(event.type as TaskEvent) &&
        (event.taskData?.isAutoAnswering === true || event.taskData?.isAutoAnswering === 'true')
      ) {
        Promise.resolve(task.accept())
          .then(() => {
            task.emit(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
          })
          .catch(() => undefined);
      }

      // Cleanup is now emitted by state machine actions (Task layer).
      // Simulate the TASK_CLEANUP emission for unit tests using mock tasks.
      const eventType = event.type as TaskEvent;
      const shouldCleanup =
        eventType === TaskEvent.CONTACT_ENDED ||
        eventType === TaskEvent.END ||
        eventType === TaskEvent.TASK_WRAPUP ||
        eventType === TaskEvent.WRAPUP_COMPLETE ||
        eventType === TaskEvent.ASSIGN_FAILED ||
        eventType === TaskEvent.INVITE_FAILED ||
        eventType === TaskEvent.RONA ||
        eventType === TaskEvent.OUTBOUND_FAILED ||
        (eventType === TaskEvent.CONSULT_END && task.data?.isConsulted === true);

      if (shouldCleanup) {
        const removeFromCollection = eventType !== TaskEvent.CONTACT_ENDED;
        task.emit(TASK_EVENTS.TASK_CLEANUP, task, {removeFromCollection});
      }
    });

    return task;
  };

  taskDataMock = {
    type: CC_EVENTS.AGENT_CONTACT_RESERVED,
    agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
    eventTime: 1733211616959,
    eventType: 'RoutingMessage',
    interaction: {mediaType: 'telephony'},
    interactionId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
    orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
    trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
    mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
    destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
    owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
    queueMgr: 'aqm',
  };

  const initalPayload = {
    data: taskDataMock,
  };

  const createReceivingSummaryTask = (
    interactionId: string,
    conversationId: string,
    parentInteractionId?: string
  ) =>
    createEventEmitterTask({
      ...taskDataMock,
      interactionId,
      mediaResourceId: interactionId,
      interaction: {
        mediaType: 'telephony',
        mainInteractionId: conversationId,
        callProcessingDetails: parentInteractionId ? {parentInteractionId} : {},
      },
    });

  const expectLastStateMachineEvent = (
    spy: jest.SpyInstance | jest.Mock,
    expectedType: TaskEvent
  ) => {
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1] || [];
    const event = lastCall[3]?.type ? lastCall[3] : lastCall[0];
    expect(event?.type).toBe(expectedType);
    return event;
  };

  beforeEach(() => {
    contactMock = contact;
    webSocketManagerMock = new EventEmitter();
    rtdWebSocketManagerMock = new EventEmitter();

    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    } as unknown as WebexSDK;

    webCallingService = new WebCallingService(
      webex,
      config.cc.callingClientConfig as CallingClientConfig
    );

    mockCall = {
      on: jest.fn(),
      off: jest.fn(),
      answer: jest.fn(),
      mute: jest.fn(),
      isMuted: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      getCallId: jest.fn().mockReturnValue('call-id-123'),
    };

    webCallingService.loginOption = LoginOption.BROWSER;
    webCallingService.call = mockCall;
    onSpy = jest.spyOn(webCallingService, 'on');
    offSpy = jest.spyOn(webCallingService, 'off');

    mockApiAIAssistant = {
      sendEvent: jest.fn().mockResolvedValue({}),
    };
    require('../../../../../src/metrics/MetricsManager').default.getInstance.mockReturnValue({
      trackEvent: getMetricsTrackEvent(),
    });

    taskManager = new TaskManager(
      mockApiAIAssistant as any,
      contactMock,
      webCallingService,
      webSocketManagerMock as any,
      rtdWebSocketManagerMock as any
    );
    taskManager.taskCollection[taskId] = createStateMachineTask(taskDataMock);
    (taskManager as any).setupTaskListeners?.(taskManager.taskCollection[taskId]);
    taskManager.call = mockCall;
    taskManager.setAgentId('test-agent-id');

    jest
      .spyOn(TaskFactory, 'createTask')
      .mockImplementation((contact, webCallingService, data, configFlags) =>
        createStateMachineTask(data)
      );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should initialize TaskManager and register listeners', () => {
    webSocketManagerMock.emit('message', JSON.stringify({data: taskDataMock}));
    const incomingCallCb = onSpy.mock.calls[0][1];
    const incomingHandler = jest.fn();
    taskManager.on(TASK_EVENTS.TASK_INCOMING, incomingHandler);

    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingService.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);
    expect(onSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, incomingCallCb);

    incomingCallCb(mockCall);

    expect(incomingHandler).toHaveBeenCalledWith(taskManager.getTask(taskId));
    taskManager.off(TASK_EVENTS.TASK_INCOMING, incomingHandler);
  });

  it('should re-emit task related events', () => {
    const dummyPayload = {
      data: {...taskDataMock, type: CC_TASK_EVENTS.AGENT_CONSULTING},
    };
    webSocketManagerMock.emit('message', JSON.stringify({data: taskDataMock}));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');

    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingService.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);

    webSocketManagerMock.emit('message', JSON.stringify(dummyPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_ACCEPTED,
      taskManager.getTask(taskId)
    );
  });

  it('should invoke sendEvent for configured start/stop backend events', () => {
    taskManager.setConfigFlags({
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      webRtcEnabled: true,
      autoWrapup: false,
      aiFeature: {
        id: 'ai-feature-1',
        realtimeTranscripts: {
          enable: true,
        },
      },
    });

    const interactionId = taskId;
    const message = (type: CC_EVENTS) =>
      JSON.stringify({
        data: {
          ...taskDataMock,
          interactionId,
          type,
        },
      });

    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONTACT_ASSIGNED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULTING));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_CONFERENCED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_ENDED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_WRAPUP));

    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledTimes(6);
    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledWith(
      'test-agent-id',
      interactionId,
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      {action: 'START'}
    );
    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledWith(
      'test-agent-id',
      interactionId,
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      {action: 'STOP'}
    );
  });

  it('should not invoke sendEvent when realtime transcripts are disabled in aiFeature', () => {
    taskManager.setConfigFlags({
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      webRtcEnabled: true,
      autoWrapup: false,
      aiFeature: {
        id: 'ai-feature-1',
        realtimeTranscripts: {
          enable: false,
        },
      },
    });

    const message = (type: CC_EVENTS) =>
      JSON.stringify({
        data: {
          ...taskDataMock,
          interactionId: taskId,
          type,
        },
      });

    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONTACT_ASSIGNED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULTING));

    expect(mockApiAIAssistant.sendEvent).not.toHaveBeenCalled();
  });

  it('should not invoke sendEvent when realtime transcripts config is missing', () => {
    taskManager.setConfigFlags({
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      webRtcEnabled: true,
      autoWrapup: false,
      aiFeature: {
        id: 'ai-feature-1',
        suggestedResponses: {
          enable: true,
        },
      },
    });

    const message = (type: CC_EVENTS) =>
      JSON.stringify({
        data: {
          ...taskDataMock,
          interactionId: taskId,
          type,
        },
      });

    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONTACT_ASSIGNED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULTING));

    expect(mockApiAIAssistant.sendEvent).not.toHaveBeenCalled();
  });

  it('should preserve REAL_TIME_TRANSCRIPTION payloads exactly once across AI summary frames', () => {
    const task = taskManager.getTask(taskId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const observedOrder: string[] = [];
    const transcriptHandler = jest.fn((payload) => {
      observedOrder.push(`transcript:${payload.data.messageId}`);
    });
    const createRealtimePayload = (messageId: string, content: string) => ({
      data: {
        agentId: 'test-agent-id',
        data: {
          content,
          conversationId: taskId,
          isFinal: true,
          languageCode: 'en-US',
          messageId,
          orgId: 'org-id',
          publishTimestamp: 1773807297475,
          role: 'AGENT',
          trackingId: `tracking-id-${messageId}`,
          utteranceId: `utterance-id-${messageId}`,
        },
        notifDetails: {
          actionEvent: 'REAL_TIME_TRANSCRIPTION',
        },
        notifType: 'REAL_TIME_TRANSCRIPTION',
        orgId: 'org-id',
      },
      orgId: 'org-id',
      trackingId: 'notifs_tracking-id',
      type: 'REAL_TIME_TRANSCRIPTION',
    });
    const firstRealtimePayload = createRealtimePayload('1', 'Thank you. Okay.');
    const secondRealtimePayload = createRealtimePayload('2', 'I can help with that.');

    task.on(CC_EVENTS.REAL_TIME_TRANSCRIPTION, transcriptHandler);
    getMetricsTrackEvent().mockImplementation((_eventName, fields) => {
      if (fields.dropReason) {
        observedOrder.push(`ai-summary:${fields.dropReason}`);
      }
    });

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(firstRealtimePayload));
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {data: {conversationId: taskId, summaryText: {invalid: true}}},
      })
    );
    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(secondRealtimePayload));

    expect(taskEmitSpy).toHaveBeenCalledTimes(2);
    expect(taskEmitSpy).toHaveBeenNthCalledWith(
      1,
      CC_EVENTS.REAL_TIME_TRANSCRIPTION,
      firstRealtimePayload.data
    );
    expect(taskEmitSpy).toHaveBeenNthCalledWith(
      2,
      CC_EVENTS.REAL_TIME_TRANSCRIPTION,
      secondRealtimePayload.data
    );
    expect(transcriptHandler).toHaveBeenCalledTimes(2);
    expect(transcriptHandler).toHaveBeenNthCalledWith(1, firstRealtimePayload.data);
    expect(transcriptHandler).toHaveBeenNthCalledWith(2, secondRealtimePayload.data);
    expect(observedOrder).toEqual([
      'transcript:1',
      'ai-summary:invalid-payload',
      'transcript:2',
    ]);
  });

  it('should ignore RTD transcript events when task is not found', () => {
    const realtimePayload = {
      data: {
        data: {
          content: 'Thank you. Okay.',
          conversationId: 'missing-task-id',
          isFinal: true,
          languageCode: 'en-US',
          messageId: '1',
          orgId: 'org-id',
          publishTimestamp: 1773807297475,
          role: 'AGENT',
          trackingId: 'tracking-id',
          utteranceId: 'utterance-id',
        },
        notifDetails: {
          actionEvent: 'REAL_TIME_TRANSCRIPTION',
        },
        notifType: 'REAL_TIME_TRANSCRIPTION',
        orgId: 'org-id',
      },
      orgId: 'org-id',
      trackingId: 'notifs_tracking-id',
      type: 'REAL_TIME_TRANSCRIPTION',
    };

    const existingTaskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(realtimePayload));

    expect(existingTaskEmitSpy).not.toHaveBeenCalled();
  });

  it('should store and forward valid feature enablement frames with raw flag metrics', () => {
    const payload = {
      type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
      data: {
        data: {
          interactionId: taskId,
          postCallEnabled: true,
          midCallEnabled: false,
          actionTimestamp: 10,
        },
      },
    };

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(payload));
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {
          data: {
            interactionId: taskId,
            postCallEnabled: undefined,
            midCallEnabled: true,
          },
        },
      })
    );

    expect((taskManager as any).aiSummaryCoordinator.getFeatureEnablement(taskId)).toEqual({
      interactionId: taskId,
      postCallEnabled: undefined,
      midCallEnabled: true,
    });
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
      {
        validationOutcome: 'valid',
        postCallEnabled: true,
        midCallEnabled: false,
      },
      ['operational']
    );
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
      {
        validationOutcome: 'valid',
        postCallEnabled: 'absent',
        midCallEnabled: true,
      },
      ['operational']
    );
  });

  it('should emit task:featureEnablement on the matching task when a feature frame arrives with the task registered', () => {
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const featurePayload = {
      interactionId: taskId,
      postCallEnabled: true,
      midCallEnabled: false,
      actionTimestamp: 10,
    };

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: featurePayload},
      })
    );

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featurePayload);
  });

  it('should retain and emit feature enablement when its metric fails', () => {
    const task = taskManager.getTask(taskId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const featurePayload = {
      interactionId: taskId,
      postCallEnabled: true,
      midCallEnabled: false,
      actionTimestamp: 10,
    };
    getMetricsTrackEvent().mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });

    expect(() =>
      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
          data: {data: featurePayload},
        })
      )
    ).not.toThrow();

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featurePayload);
    expect((taskManager as any).aiSummaryCoordinator.getFeatureEnablement(taskId)).toEqual(
      featurePayload
    );
  });

  it('should replay retained feature enablement after the public incoming task event', () => {
    const interactionId = 'retained-feature-task';
    const featurePayload = {
      interactionId,
      postCallEnabled: true,
      midCallEnabled: true,
      actionTimestamp: 10,
    };
    const incomingPayload = {
      ...taskDataMock,
      interactionId,
      mediaResourceId: interactionId,
    };
    const featureHandler = jest.fn();

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: featurePayload},
      })
    );
    taskManager.taskCollection = {};
    taskManager.on(TASK_EVENTS.TASK_INCOMING, (task) => {
      task.on(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featureHandler);
    });

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({data: {...incomingPayload, type: CC_EVENTS.AGENT_CONTACT_RESERVED}})
    );

    expect(featureHandler).toHaveBeenCalledTimes(1);
    expect(featureHandler).toHaveBeenCalledWith(featurePayload);
  });

  it('should emit task:featureEnablement on the task at registration when the feature frame arrived first (orphan path)', () => {
    jest.useFakeTimers();
    const newInteractionId = 'orphan-task-id';
    const featurePayload = {
      interactionId: newInteractionId,
      postCallEnabled: true,
      midCallEnabled: true,
      actionTimestamp: 5,
    };

    // Feature frame arrives before task registration — stored as orphan
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: featurePayload},
      })
    );

    // Build and register the task, then spy before calling retain
    const orphanTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: newInteractionId,
      mediaResourceId: newInteractionId,
      interaction: {mediaType: 'telephony'},
    });
    const taskEmitSpy = jest.spyOn(orphanTask, 'emit');
    taskManager.taskCollection[newInteractionId] = orphanTask;

    // deliverFeatureEnablementToTask is called at task creation after retention
    (taskManager as any).retainFeatureEnablementForTask(orphanTask);
    (taskManager as any).deliverFeatureEnablementToTask(orphanTask);

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featurePayload);

    taskManager.clearAISummaryState();
    jest.useRealTimers();
  });

  it('should not use a main interaction feature frame as fallback for a child task key', () => {
    jest.useFakeTimers();
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const childInteractionId = 'child-task';
    const conversationId = 'conversation-1';
    const childTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: childInteractionId,
      interaction: {
        mediaType: 'telephony',
        mainInteractionId: conversationId,
      },
    });
    const featurePayload = {
      interactionId: conversationId,
      postCallEnabled: true,
      midCallEnabled: true,
      actionTimestamp: 10,
    };

    taskManager.taskCollection = {
      [childInteractionId]: childTask,
    };

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: featurePayload},
      })
    );

    expect(coordinator.getFeatureEnablement(conversationId)).toEqual(featurePayload);
    expect(coordinator.getFeatureEnablement(childInteractionId)).toBeUndefined();

    taskManager.clearAISummaryState();
  });

  it('should metric classified invalid feature frames without storing or forwarding them', () => {
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {
          data: {
            interactionId: taskId,
            postCallEnabled: 'true',
            midCallEnabled: false,
          },
        },
      })
    );

    expect((taskManager as any).aiSummaryCoordinator.getFeatureEnablement(taskId)).toBeUndefined();
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
      {validationOutcome: 'invalid'},
      ['operational']
    );
  });

  it.each([
    ['missing inner payload', {type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT, data: {}}],
    [
      'non-object inner payload',
      {type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT, data: {data: 'invalid'}},
    ],
    [
      'array inner payload',
      {type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT, data: {data: ['invalid']}},
    ],
  ])('should count a classified feature frame with %s exactly once as invalid', (_label, frame) => {
    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(frame));

    const featureMetricCalls = getMetricsTrackEvent().mock.calls.filter(
      ([eventName]) => eventName === METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED
    );

    expect(featureMetricCalls).toEqual([
      [
        METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
        {validationOutcome: 'invalid'},
        ['operational'],
      ],
    ]);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
  });

  it.each(
    [
      [
        'post-call',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        'POST_CALL_SUMMARY',
        'POST_CALL_SUMMARY_TIMEOUT',
        {
          conversationId: taskId,
          adaptiveCard: {body: ['card']},
          adaptiveCardId: 'adaptive-card-id',
          editAdaptiveCard: {body: ['edit-card']},
          editAdaptiveCardId: 'edit-adaptive-card-id',
          languageCode: 'en-US',
          summaryText: 'safe summary',
          resolution: 'resolved',
          areTranscriptsAvailable: true,
          sections: {initialContactReason: 'billing', safeKey: 'safe value'},
          suggestedWrapUpCodes: [{name: 'Resolved', id: 'wrap-up-code-id'}],
          suggestedWrapUpCodesMessage: 'Use resolved wrap-up',
          timestamp: 1773807297475,
        },
      ],
      [
        'mid-call',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        'MID_CALL_SUMMARY',
        'MID_CALL_SUMMARY_TIMEOUT',
        {
          conversationId: 'mid-summary-conversation',
          adaptiveCard: {body: ['mid-card']},
          adaptiveCardId: 'mid-adaptive-card-id',
          editAdaptiveCard: {body: ['mid-edit-card']},
          editAdaptiveCardId: 'mid-edit-adaptive-card-id',
          languageCode: 'en-US',
          summaryText: 'safe mid summary',
          resolution: 'transferred',
          areTranscriptsAvailable: false,
          sections: {reasonForTransferOrConsult: 'specialist', safeKey: 'safe value'},
          timestamp: 1773807297476,
        },
      ],
    ] as const
  )(
    'should resolve matching %s initiator summary payload through the request Promise only',
    async (_summaryKind, realtimeEvent, inboundType, timeoutCode, summaryPayload) => {
      const coordinator = (taskManager as any).aiSummaryCoordinator;
      const registration = await coordinator.registerPendingAISummaryRequest(
        taskId,
        summaryPayload.conversationId,
        inboundType,
        timeoutCode
      );
      const task = createStateMachineTask({
        ...taskDataMock,
        interactionId: summaryPayload.conversationId,
        mediaResourceId: summaryPayload.conversationId,
      });
      const taskEmitSpy = jest.spyOn(task, 'emit');
      const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');

      taskManager.taskCollection[summaryPayload.conversationId] = task;

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: realtimeEvent,
          data: {data: summaryPayload},
        })
      );

      await expect(registration.result).resolves.toStrictEqual(summaryPayload);

      const taskEmittedEvents = taskEmitSpy.mock.calls.map(([eventName]) => eventName);
      const taskManagerEmittedEvents = taskManagerEmitSpy.mock.calls.map(
        ([eventName]) => eventName
      );

      [CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY].forEach(
        (summaryInboundEvent) => {
          expect(taskEmittedEvents).not.toContain(summaryInboundEvent);
          expect(taskManagerEmittedEvents).not.toContain(summaryInboundEvent);
        }
      );
    }
  );

  it('should resolve only the matching active mid-call initiator slot through TaskManager RTD routing', async () => {
    jest.useFakeTimers();
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const conversationId = 'shared-summary-conversation';
    const midSummaryPayload = {
      conversationId,
      adaptiveCard: {body: ['mid-card']},
      adaptiveCardId: 'mid-adaptive-card-id',
      editAdaptiveCard: {body: ['mid-edit-card']},
      editAdaptiveCardId: 'mid-edit-adaptive-card-id',
      languageCode: 'en-US',
      summaryText: 'private mid summary',
      resolution: 'transferred',
      areTranscriptsAvailable: true,
      sections: {reasonForTransferOrConsult: 'specialist'},
      timestamp: 1773807297476,
    };
    const postRegistration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      conversationId,
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const midRegistration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      conversationId,
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const postResolved = jest.fn();
    const postRejected = jest.fn();
    const midResolved = jest.fn();
    const midRejected = jest.fn();
    const initiatorTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: conversationId,
      mediaResourceId: conversationId,
    });
    const initiatorTaskEmitSpy = jest.spyOn(initiatorTask, 'emit');
    const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');

    postRegistration.result.then(postResolved, postRejected);
    midRegistration.result.then(midResolved, midRejected);
    taskManager.taskCollection = {[conversationId]: initiatorTask};

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        data: {data: midSummaryPayload},
      })
    );
    await Promise.resolve();

    expect(midResolved).toHaveBeenCalledTimes(1);
    expect(midResolved).toHaveBeenCalledWith(midSummaryPayload);
    expect(midRejected).not.toHaveBeenCalled();
    expect(postResolved).not.toHaveBeenCalled();
    expect(postRejected).not.toHaveBeenCalled();
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    [CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY].forEach(
      (summaryInboundEvent) => {
        expect(initiatorTaskEmitSpy).not.toHaveBeenCalledWith(
          summaryInboundEvent,
          expect.anything()
        );
        expect(taskManagerEmitSpy).not.toHaveBeenCalledWith(
          summaryInboundEvent,
          expect.anything()
        );
      }
    );

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        data: {data: midSummaryPayload},
      })
    );

    expect(getInboundDropMetricCalls()).toHaveLength(1);
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        dropReason: 'late-or-uncorrelated',
        conversationId,
      },
      ['operational']
    );
    expectNoSensitiveDiagnostics('private mid summary', 'specialist');

    coordinator.cancelPendingAISummaryRequest(
      taskId,
      conversationId,
      'POST_CALL_SUMMARY',
      postRegistration.requestToken
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should reject on timeout and drop one later mid-call frame without changing settlement', async () => {
    jest.useFakeTimers();
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const registration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      'mid-timeout-conversation',
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const rejection = registration.result.catch((error) => error);

    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);

    const timeoutError = await rejection;

    expect(timeoutError).toEqual(
      expect.objectContaining({
        message: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT,
        data: {errorCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT},
      })
    );
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        data: {
          data: {
            conversationId: 'mid-timeout-conversation',
            summaryText: 'late summary must not resettle the request',
          },
        },
      })
    );

    expect(getInboundDropMetricCalls()).toHaveLength(1);
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        dropReason: 'late-or-uncorrelated',
        conversationId: 'mid-timeout-conversation',
      },
      ['operational']
    );
    await expect(registration.result).rejects.toBe(timeoutError);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should drop late post-call initiator summary events once', async () => {
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const postSummaryPayload = {
      conversationId: taskId,
      adaptiveCard: {body: ['card']},
      adaptiveCardId: 'adaptive-card-id',
      editAdaptiveCard: {body: ['edit-card']},
      editAdaptiveCardId: 'edit-adaptive-card-id',
      languageCode: 'en-US',
      summaryText: 'safe summary',
      resolution: 'resolved',
      areTranscriptsAvailable: true,
      sections: {initialContactReason: 'billing', safeKey: 'safe value'},
      suggestedWrapUpCodes: [{name: 'Resolved', id: 'wrap-up-code-id'}],
      suggestedWrapUpCodesMessage: 'Use resolved wrap-up',
      timestamp: 1773807297475,
    };
    const postRegistration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      taskId,
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {data: postSummaryPayload},
      })
    );

    await expect(postRegistration.result).resolves.toStrictEqual(postSummaryPayload);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {data: postSummaryPayload},
      })
    );

    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        dropReason: 'late-or-uncorrelated',
        conversationId: taskId,
      },
      ['operational']
    );
    expect(getInboundDropMetricCalls()).toHaveLength(1);
  });

  it.each(
    [
      [
        'post-call adaptive card',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, adaptiveCard: []},
      ],
      [
        'post-call adaptive card id',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, adaptiveCardId: 123},
      ],
      [
        'post-call edit adaptive card',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, editAdaptiveCard: null},
      ],
      [
        'post-call edit adaptive card id',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, editAdaptiveCardId: false},
      ],
      [
        'post-call language code',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, languageCode: 1},
      ],
      [
        'post-call summary text',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, summaryText: {invalid: true}},
      ],
      [
        'post-call resolution',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, resolution: []},
      ],
      [
        'post-call transcript availability',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, areTranscriptsAvailable: 'true'},
      ],
      [
        'post-call sections',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, sections: {initialContactReason: 1}},
      ],
      [
        'post-call suggested wrap-up collection',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, suggestedWrapUpCodes: {name: 'Resolved'}},
      ],
      [
        'post-call suggested wrap-up item',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, suggestedWrapUpCodes: [{name: 1}]},
      ],
      [
        'post-call suggested wrap-up message',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, suggestedWrapUpCodesMessage: 2},
      ],
      [
        'post-call timestamp',
        CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        {conversationId: taskId, timestamp: '1773807297475'},
      ],
      [
        'mid-call adaptive card',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        {conversationId: taskId, adaptiveCard: []},
      ],
      [
        'mid-call sections',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        {conversationId: taskId, sections: {reasonForTransferOrConsult: 1}},
      ],
      [
        'mid-call timestamp',
        CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        {conversationId: taskId, timestamp: '1773807297475'},
      ],
    ] as const
  )('should drop invalid %s initiator payload exactly once', (_label, eventType, data) => {
    const resolveSpy = jest.spyOn(
      (taskManager as any).aiSummaryCoordinator,
      'resolvePendingAISummaryRequest'
    );

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: eventType,
        data: {data},
      })
    );

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(getMetricsTrackEvent()).toHaveBeenCalledTimes(1);
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType,
        dropReason: 'invalid-payload',
      },
      ['operational']
    );
  });

  it.each(['parent-first', 'child-first'] as const)(
    'should select the unique receiving-agent leaf for parent-child order %s',
    (registryOrder) => {
      const parentTask = createReceivingSummaryTask('parent-task', 'conversation-1');
      const childTask = createReceivingSummaryTask(
        'child-task',
        'conversation-1',
        'parent-task'
      );

      taskManager.taskCollection =
        registryOrder === 'parent-first'
          ? {parent: parentTask, child: childTask}
          : {child: childTask, parent: parentTask};

      const childEmitSpy = jest.spyOn(childTask, 'emit');
      const parentEmitSpy = jest.spyOn(parentTask, 'emit');
      const receivingPayload = {
        conversationId: 'conversation-1',
        summaryText: 'receiver summary',
      };

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {data: receivingPayload},
        })
      );

      expect(childEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        receivingPayload
      );
      expect(parentEmitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        expect.anything()
      );
      expect(getInboundDropMetricCalls()).toHaveLength(0);
    }
  );

  it.each(['root-to-leaf', 'leaf-to-root'] as const)(
    'should select the unique receiving-agent leaf through chained lineage for order %s',
    (registryOrder) => {
      const grandparentTask = createReceivingSummaryTask('grandparent-task', 'conversation-1');
      const parentTask = createReceivingSummaryTask(
        'parent-task',
        'conversation-1',
        'grandparent-task'
      );
      const childTask = createReceivingSummaryTask(
        'child-task',
        'conversation-1',
        'parent-task'
      );

      taskManager.taskCollection =
        registryOrder === 'root-to-leaf'
          ? {
              grandparent: grandparentTask,
              parent: parentTask,
              child: childTask,
            }
          : {
              child: childTask,
              parent: parentTask,
              grandparent: grandparentTask,
            };

      const grandparentEmitSpy = jest.spyOn(grandparentTask, 'emit');
      const parentEmitSpy = jest.spyOn(parentTask, 'emit');
      const childEmitSpy = jest.spyOn(childTask, 'emit');
      const receivingPayload = {
        conversationId: 'conversation-1',
        summaryText: 'receiver chain summary',
      };

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {data: receivingPayload},
        })
      );

      expect(childEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        receivingPayload
      );
      [grandparentEmitSpy, parentEmitSpy].forEach((emitSpy) => {
        expect(emitSpy).not.toHaveBeenCalledWith(
          TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
          expect.anything()
        );
      });
      expect(getInboundDropMetricCalls()).toHaveLength(0);
    }
  );

  it.each(
    [
      [
        'cyclic',
        [
          ['cycle-a-task', 'cycle-b-task'],
          ['cycle-b-task', 'cycle-a-task'],
        ],
      ],
      [
        'missing-parent',
        [
          ['missing-parent-a-task', 'missing-parent-root-a'],
          ['missing-parent-b-task', 'missing-parent-root-b'],
        ],
      ],
    ] as const
  )(
    'should drop %s receiving-agent lineage ambiguity without task delivery',
    (_lineageKind, taskLineage) => {
      const receivingTasks = taskLineage.map(([interactionId, parentInteractionId]) =>
        createReceivingSummaryTask(interactionId, 'conversation-1', parentInteractionId)
      );
      const receivingTaskEmitSpies = receivingTasks.map((task) => jest.spyOn(task, 'emit'));
      const receivingPayload = {
        conversationId: 'conversation-1',
        summaryText: 'private ambiguous receiver summary',
      };

      taskManager.taskCollection = {
        first: receivingTasks[0],
        second: receivingTasks[1],
      };

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {data: receivingPayload},
        })
      );

      receivingTaskEmitSpies.forEach((emitSpy) => {
        expect(emitSpy).not.toHaveBeenCalledWith(
          TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
          expect.anything()
        );
      });
      expect(getInboundDropMetricCalls()).toHaveLength(1);
      expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
        {
          eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          dropReason: 'ambiguous-receiver',
          conversationId: 'conversation-1',
        },
        ['operational']
      );
      expectNoSensitiveDiagnostics('private ambiguous receiver summary');
    }
  );

  it('should warn with bounded metadata and continue past invalid receiver candidate tasks', () => {
    const conversationId = 'conversation-1';
    const invalidTaskId = 'invalid-correlation-task-id';
    const invalidTaskPayloadSentinel = 'private-invalid-task-payload';
    const rawEnvelopeSentinel = 'private-raw-envelope';
    const summarySentinel = 'private-summary';
    const sectionKeySentinel = 'private-section-key';
    const sectionValueSentinel = 'private-section-value';
    const arbitraryErrorSentinel = 'private-arbitrary-error';
    const invalidTask = createStateMachineTask({
      ...taskDataMock,
      taskId: invalidTaskId,
      interactionId: '',
      privatePayload: invalidTaskPayloadSentinel,
      interaction: {
        mainInteractionId: conversationId,
        callProcessingDetails: {},
      },
    });
    const validPeerTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'valid-peer-task',
      interaction: {
        mainInteractionId: conversationId,
        callProcessingDetails: {},
      },
    });
    const receivingPayload = {
      conversationId,
      summaryText: summarySentinel,
      sections: {[sectionKeySentinel]: sectionValueSentinel},
      error: {message: arbitraryErrorSentinel},
    };
    const invalidEmitSpy = jest.spyOn(invalidTask, 'emit');
    const validPeerEmitSpy = jest.spyOn(validPeerTask, 'emit');

    taskManager.taskCollection = {invalidTask, validPeerTask};

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
        rawEnvelope: rawEnvelopeSentinel,
      })
    );

    expect(getLoggerProxy().warn).toHaveBeenCalledTimes(1);
    expect(getLoggerProxy().warn).toHaveBeenNthCalledWith(
      1,
      'Invalid AI summary task correlation',
      {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_AI_SUMMARY_EVENT,
        data: {
          reason: 'invalid-task-correlation',
          scanContext: 'receiver-candidate-scan',
          taskId: invalidTaskId,
        },
      }
    );
    expect(invalidEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(validPeerEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      receivingPayload
    );
    expect(getInboundDropMetricCalls()).toHaveLength(0);

    const loggerDiagnostics = JSON.stringify({
      warnings: getLoggerProxy().warn.mock.calls,
      errors: getLoggerProxy().error.mock.calls,
      info: getLoggerProxy().info.mock.calls,
      logs: getLoggerProxy().log.mock.calls,
    });

    [
      invalidTaskPayloadSentinel,
      rawEnvelopeSentinel,
      summarySentinel,
      sectionKeySentinel,
      sectionValueSentinel,
      arbitraryErrorSentinel,
    ].forEach((sensitiveValue) => {
      expect(loggerDiagnostics).not.toContain(sensitiveValue);
    });
  });

  it.each(['self-first', 'peer-first'] as const)(
    'should exclude a self-parent candidate and deliver to the unique peer for %s registry order',
    (registryOrder) => {
      const selfReferencingTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: 'self-task',
        interaction: {
          mainInteractionId: 'conversation-1',
          callProcessingDetails: {parentInteractionId: 'self-task'},
        },
      });
      const peerTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: 'peer-task',
        interaction: {
          mainInteractionId: 'conversation-1',
          callProcessingDetails: {},
        },
      });
      taskManager.taskCollection =
        registryOrder === 'self-first'
          ? {selfReferencingTask, peerTask}
          : {peerTask, selfReferencingTask};
      const selfEmitSpy = jest.spyOn(selfReferencingTask, 'emit');
      const peerEmitSpy = jest.spyOn(peerTask, 'emit');

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {
            data: {
              conversationId: 'conversation-1',
              summaryText: 'private-summary',
            },
          },
        })
      );

      expect(selfEmitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        expect.anything()
      );
      expect(peerEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        {
          conversationId: 'conversation-1',
          summaryText: 'private-summary',
        }
      );
      expect(getInboundDropMetricCalls()).toHaveLength(0);
      expectNoSensitiveDiagnostics('private-summary');
    }
  );

  it('should buffer zero-match receiving summaries and flush when a matching task registers', () => {
    taskManager.taskCollection = {};
    const receivingPayload = {
      conversationId: 'conversation-1',
      summaryText: 'buffered receiver summary',
    };

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );

    const task = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'child-task',
      interaction: {
        mainInteractionId: 'conversation-1',
        callProcessingDetails: {},
      },
    });
    taskManager.taskCollection = {child: task};
    const taskEmitSpy = jest.spyOn(task, 'emit');
    (taskManager as any).flushReceivingSummaryForTask(task);

    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      receivingPayload
    );
  });

  it('should flush buffered receiving summaries after an unmapped task update establishes correlation', () => {
    jest.useFakeTimers();
    const conversationId = 'unmapped-update-conversation';
    const task = taskManager.getTask(taskId);
    const receiverHandler = jest.fn();
    const sendStateMachineEventSpy = task.sendStateMachineEvent as jest.Mock;
    const receivingPayload = {
      conversationId,
      summaryText: 'buffered unmapped update summary',
    };

    task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, receiverHandler);
    sendStateMachineEventSpy.mockClear();

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );

    expect(jest.getTimerCount()).toBe(1);

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_CONTACT_UNASSIGNED,
          interactionId: taskId,
          mediaResourceId: taskId,
          interaction: {
            mediaType: 'telephony',
            mainInteractionId: conversationId,
            callProcessingDetails: {},
          },
        },
      })
    );

    expect(sendStateMachineEventSpy).not.toHaveBeenCalled();
    expect(receiverHandler).toHaveBeenCalledTimes(1);
    expect(receiverHandler).toHaveBeenCalledWith(receivingPayload);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should clear reservation feature state and flush buffered receiver summary after reservation re-key', () => {
    jest.useFakeTimers();
    taskManager.taskCollection = {};
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const reservationInteractionId = 'reservation-rekey-id';
    const assignedInteractionId = 'assigned-rekey-id';
    const conversationId = 'reservation-rekey-conversation';
    const featurePayload = {
      interactionId: reservationInteractionId,
      postCallEnabled: true,
      midCallEnabled: true,
    };
    const assignedFeaturePayload = {
      interactionId: assignedInteractionId,
      postCallEnabled: false,
      midCallEnabled: true,
    };
    const receivingPayload = {
      conversationId,
      summaryText: 'buffered reservation rekey summary',
    };
    const receiverHandler = jest.fn();

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: reservationInteractionId,
          mediaResourceId: reservationInteractionId,
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {},
          },
        },
      })
    );

    const reservationTask = taskManager.getTask(reservationInteractionId);
    reservationTask.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, receiverHandler);
    const featureHandler = jest.fn();
    reservationTask.on(TASK_EVENTS.TASK_FEATURE_ENABLEMENT, featureHandler);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: featurePayload},
      })
    );

    expect(coordinator.getFeatureEnablement(reservationInteractionId)).toEqual(featurePayload);
    expect(jest.getTimerCount()).toBe(0);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: assignedFeaturePayload},
      })
    );

    expect(coordinator.getFeatureEnablement(assignedInteractionId)).toEqual(assignedFeaturePayload);
    expect(jest.getTimerCount()).toBe(1);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );

    expect(jest.getTimerCount()).toBe(2);

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
          interactionId: assignedInteractionId,
          reservationInteractionId,
          mediaResourceId: assignedInteractionId,
          interaction: {
            mediaType: 'telephony',
            mainInteractionId: conversationId,
            callProcessingDetails: {},
          },
        },
      })
    );

    expect(taskManager.getTask(assignedInteractionId)).toBe(reservationTask);
    expect(taskManager.getTask(reservationInteractionId)).toBeUndefined();
    expect(coordinator.getFeatureEnablement(reservationInteractionId)).toBeUndefined();
    expect(featureHandler).toHaveBeenCalledWith(assignedFeaturePayload);
    expect(receiverHandler).toHaveBeenCalledTimes(1);
    expect(receiverHandler).toHaveBeenCalledWith(receivingPayload);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should emit one bounded receiver-buffer-expired metric with no task event', () => {
    jest.useFakeTimers();
    const unmatchedTask = createReceivingSummaryTask('unmatched-task', 'other-conversation');
    const unmatchedTaskEmitSpy = jest.spyOn(unmatchedTask, 'emit');
    const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');
    const receivingPayload = {
      conversationId: 'conversation-1',
      summaryText: 'private expired receiver summary',
    };

    taskManager.taskCollection = {unmatchedTask};

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );

    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(unmatchedTaskEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(taskManagerEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS - 1);
    expect(getInboundDropMetricCalls()).toHaveLength(0);

    jest.advanceTimersByTime(1);

    expect(getInboundDropMetricCalls()).toHaveLength(1);
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        dropReason: 'receiver-buffer-expired',
        conversationId: 'conversation-1',
      },
      ['operational']
    );
    expect(unmatchedTaskEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(taskManagerEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expectNoSensitiveDiagnostics('private expired receiver summary');
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(
    [
      [
        'reserved contact',
        CC_EVENTS.AGENT_CONTACT_RESERVED,
        TASK_EVENTS.TASK_INCOMING,
        'receiver-reserved-task',
        'receiver-reserved-conversation',
      ],
      [
        'agent contact hydrate',
        CC_EVENTS.AGENT_CONTACT,
        TASK_EVENTS.TASK_HYDRATE,
        'receiver-agent-contact-task',
        'receiver-agent-contact-conversation',
      ],
      [
        'campaign preview reservation',
        CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        'receiver-campaign-task',
        'receiver-campaign-conversation',
      ],
    ] as const
  )(
    'should flush buffered receiving summaries once after %s publication',
    (_name, eventType, publicationEvent, interactionId, conversationId) => {
      jest.useFakeTimers();
      taskManager.taskCollection = {};
      const receivingPayload = {
        conversationId,
        summaryText: `buffered summary for ${conversationId}`,
      };
      const deliveryHandler = jest.fn();
      const observedOrder: string[] = [];

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {data: receivingPayload},
        })
      );

      taskManager.on(publicationEvent, (publishedTask) => {
        observedOrder.push('published');
        expect(publishedTask).toBe(taskManager.getTask(interactionId));
        publishedTask.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, (payload) => {
          observedOrder.push('receiver-summary');
          deliveryHandler(payload);
        });
      });

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...taskDataMock,
            type: eventType,
            interactionId,
            mediaResourceId: interactionId,
            interaction: {
              mediaType: 'telephony',
              mainInteractionId: conversationId,
              callProcessingDetails: {},
            },
          },
        })
      );

      expect(observedOrder).toEqual(['published', 'receiver-summary']);
      expect(deliveryHandler).toHaveBeenCalledTimes(1);
      expect(deliveryHandler).toHaveBeenCalledWith(receivingPayload);
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('should flush buffered receiving summaries once after TASK_MERGED publication', () => {
    jest.useFakeTimers();
    taskManager.taskCollection = {};
    const interactionId = 'receiver-merged-task';
    const conversationId = 'receiver-merged-conversation';
    const receivingPayload = {
      conversationId,
      summaryText: 'buffered summary for merged task',
    };
    const deliveryHandler = jest.fn();
    const observedOrder: string[] = [];

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );

    taskManager.on(TASK_EVENTS.TASK_MERGED, (publishedTask) => {
      observedOrder.push('published');
      expect(publishedTask).toBe(taskManager.getTask(interactionId));
      publishedTask.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, (payload) => {
        observedOrder.push('receiver-summary');
        deliveryHandler(payload);
      });
    });

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId,
          mediaResourceId: interactionId,
          interaction: {
            mediaType: 'telephony',
            mainInteractionId: conversationId,
            callProcessingDetails: {},
          },
        },
      })
    );

    expect(observedOrder).toEqual(['published', 'receiver-summary']);
    expect(deliveryHandler).toHaveBeenCalledTimes(1);
    expect(deliveryHandler).toHaveBeenCalledWith(receivingPayload);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should drop ambiguous receiving-agent frames with bounded metadata only', () => {
    const siblingA = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'sibling-a',
      interaction: {
        mainInteractionId: 'conversation-1',
        callProcessingDetails: {},
      },
    });
    const siblingB = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'sibling-b',
      interaction: {
        mainInteractionId: 'conversation-1',
        callProcessingDetails: {},
      },
    });
    taskManager.taskCollection = {siblingA, siblingB};

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {
          data: {
            conversationId: 'conversation-1',
            summaryText: 'private-summary',
            sections: {privateKey: 'private-value'},
            adaptiveCard: {body: ['private-card']},
            agentName: 'private-agent',
          },
        },
      })
    );

    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        dropReason: 'ambiguous-receiver',
        conversationId: 'conversation-1',
      },
      ['operational']
    );
    expect(JSON.stringify(getMetricsTrackEvent().mock.calls)).not.toContain('private-summary');
    expect(JSON.stringify(getMetricsTrackEvent().mock.calls)).not.toContain('privateKey');
    expect(JSON.stringify(getMetricsTrackEvent().mock.calls)).not.toContain('private-value');
    expect(JSON.stringify(getMetricsTrackEvent().mock.calls)).not.toContain('private-card');
    expect(JSON.stringify(getMetricsTrackEvent().mock.calls)).not.toContain('private-agent');
  });

  it('should cancel owner AI summary state and re-flush receiver buffers after task deletion', async () => {
    jest.useFakeTimers();
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const createCorrelatedTask = (interactionId: string, conversationId: string) =>
      createStateMachineTask({
        ...taskDataMock,
        interactionId,
        interaction: {
          mainInteractionId: conversationId,
          callProcessingDetails: {},
          mediaType: 'telephony',
        },
      });
    const deliveredConversationId = 'conversation-delivered-after-removal';
    const retainedConversationId = 'conversation-retained-after-removal';
    const deliveredPayload = {
      conversationId: deliveredConversationId,
      summaryText: 'deliver after owner removal',
    };
    const retainedPayload = {
      conversationId: retainedConversationId,
      summaryText: 'retain after owner removal',
    };

    taskManager.taskCollection = {};
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: deliveredPayload},
      })
    );
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: retainedPayload},
      })
    );

    const deliveredOwnerTask = createCorrelatedTask('owner-delivered-task', deliveredConversationId);
    const receiverTask = createCorrelatedTask('receiver-task', deliveredConversationId);
    const retainedOwnerTask = createCorrelatedTask('owner-retained-task', retainedConversationId);

    taskManager.taskCollection = {
      [deliveredOwnerTask.data.interactionId]: deliveredOwnerTask,
      [receiverTask.data.interactionId]: receiverTask,
      [retainedOwnerTask.data.interactionId]: retainedOwnerTask,
    };

    const deliveredOwnerEmitSpy = jest.spyOn(deliveredOwnerTask, 'emit');
    const receiverEmitSpy = jest.spyOn(receiverTask, 'emit');
    const retainedOwnerEmitSpy = jest.spyOn(retainedOwnerTask, 'emit');
    const deliveredRegistration = await coordinator.registerPendingAISummaryRequest(
      deliveredOwnerTask.data.interactionId,
      deliveredConversationId,
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const retainedRegistration = await coordinator.registerPendingAISummaryRequest(
      retainedOwnerTask.data.interactionId,
      retainedConversationId,
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );
    const deliveredCancellation = deliveredRegistration.result.catch((error) => error);
    const retainedCancellation = retainedRegistration.result.catch((error) => error);
    const elapsedMs = AI_SUMMARY_DURATION_MS / 2;

    expect(jest.getTimerCount()).toBe(4);
    jest.advanceTimersByTime(elapsedMs);

    (taskManager as any).removeTaskFromCollection(deliveredOwnerTask);
    (taskManager as any).removeTaskFromCollection(retainedOwnerTask);

    await expect(deliveredCancellation).resolves.toEqual(
      expect.objectContaining({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      })
    );
    await expect(retainedCancellation).resolves.toEqual(
      expect.objectContaining({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      })
    );
    expect(deliveredOwnerTask.cancelAutoWrapupTimer).toHaveBeenCalledTimes(1);
    expect(retainedOwnerTask.cancelAutoWrapupTimer).toHaveBeenCalledTimes(1);
    expect(taskManager.getTask(deliveredOwnerTask.data.interactionId)).toBeUndefined();
    expect(taskManager.getTask(retainedOwnerTask.data.interactionId)).toBeUndefined();
    expect(taskManager.getTask(receiverTask.data.interactionId)).toBe(receiverTask);
    expect(receiverEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      deliveredPayload
    );
    expect(deliveredOwnerEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(retainedOwnerEmitSpy).not.toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
      expect.anything()
    );
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS - elapsedMs - 1);
    expect(getMetricsTrackEvent()).not.toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        dropReason: 'receiver-buffer-expired',
        conversationId: retainedConversationId,
      },
      ['operational']
    );

    jest.advanceTimersByTime(1);

    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        dropReason: 'receiver-buffer-expired',
        conversationId: retainedConversationId,
      },
      ['operational']
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('should clear AI summary state, cancel pending requests, drop queued frames, and reactivate on config', async () => {
    jest.useFakeTimers();
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const generatedSummaries: NonNullable<
      NonNullable<ConfigFlags['aiFeature']>['generatedSummaries']
    > = {
      wrapUpSummariesEnabled: true,
      consultTransferSummariesEnabled: true,
    };
    const configFlags: ConfigFlags = {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      webRtcEnabled: true,
      autoWrapup: false,
      aiFeature: {
        id: 'ai-feature-1',
        generatedSummaries,
      },
    };
    const postRegistration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      taskId,
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const midRegistration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      taskId,
      'MID_CALL_SUMMARY',
      'MID_CALL_SUMMARY_TIMEOUT'
    );

    coordinator.setFeatureEnablement({interactionId: taskId, postCallEnabled: true}, false);
    coordinator.routeReceivingSummary({conversationId: 'conversation-1', summaryText: 'summary'}, []);
    expect(jest.getTimerCount()).toBe(4);

    taskManager.clearAISummaryState();

    await expect(postRegistration.result).rejects.toEqual(
      expect.objectContaining({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      })
    );
    await expect(midRegistration.result).rejects.toEqual(
      expect.objectContaining({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      })
    );
    expect(coordinator.getFeatureEnablement(taskId)).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');
    const receiverSummaryHandler = jest.fn();
    const postClearFrames = [
      {
        eventType: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {
          interactionId: taskId,
          postCallEnabled: true,
          midCallEnabled: false,
          actionTimestamp: 1773807297475,
        },
      },
      {
        eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {
          conversationId: taskId,
          summaryText: 'post-clear post-call summary',
        },
      },
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY,
        data: {
          conversationId: taskId,
          summaryText: 'post-clear mid-call summary',
        },
      },
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {
          conversationId: taskId,
          summaryText: 'post-clear receiver summary',
        },
      },
    ];
    const expectCoordinatorStateCleared = () => {
      expect((coordinator as any).pendingAISummaryRequests.POST_CALL_SUMMARY.size).toBe(0);
      expect((coordinator as any).pendingAISummaryRequests.MID_CALL_SUMMARY.size).toBe(0);
      expect((coordinator as any).receivingSummaryBuffer.size).toBe(0);
      expect((coordinator as any).interactionFeatureEnablement.size).toBe(0);
      expect(coordinator.getFeatureEnablement(taskId)).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
    };
    const expectNoPublicAISummaryEmission = () => {
      expect(receiverSummaryHandler).not.toHaveBeenCalled();
      [CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY].forEach(
        (summaryInboundEvent) => {
          expect(taskEmitSpy).not.toHaveBeenCalledWith(summaryInboundEvent, expect.anything());
          expect(taskManagerEmitSpy).not.toHaveBeenCalledWith(
            summaryInboundEvent,
            expect.anything()
          );
        }
      );
      expect(taskEmitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
        expect.anything()
      );
    };

    taskManager
      .getTask(taskId)
      .on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, receiverSummaryHandler);

    postClearFrames.forEach(({eventType, data}) => {
      getMetricsTrackEvent().mockClear();
      getLoggerProxy().warn.mockClear();

      taskManager.handleRealtimeWebsocketEvent(JSON.stringify({type: eventType, data: {data}}));

      expect(getMetricsTrackEvent()).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED,
        expect.anything(),
        expect.anything()
      );
      expect(getInboundDropMetricCalls()).toEqual([
        [
          METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
          {
            eventType,
            dropReason: 'sdk-deregistered',
          },
          ['operational'],
        ],
      ]);
      expectNoPublicAISummaryEmission();
      expectCoordinatorStateCleared();
    });

    taskManager.setConfigFlags(configFlags);
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {data: {interactionId: taskId, postCallEnabled: true}},
      })
    );

    expect(coordinator.getFeatureEnablement(taskId)).toEqual({
      interactionId: taskId,
      postCallEnabled: true,
    });
    jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);
    jest.useRealTimers();
  });

  it('should expose generated summary flags through the bound accessor and basic setters', () => {
    const wrapupData: WrapupData = {wrapUpProps: {wrapUpReasonList: []}};
    const generatedSummaries: NonNullable<
      NonNullable<ConfigFlags['aiFeature']>['generatedSummaries']
    > = {
      wrapUpSummariesEnabled: true,
      consultTransferSummariesEnabled: false,
    };
    const updatedGeneratedSummaries: NonNullable<
      NonNullable<ConfigFlags['aiFeature']>['generatedSummaries']
    > = {
      wrapUpSummariesEnabled: false,
      consultTransferSummariesEnabled: true,
    };
    const configFlags: ConfigFlags = {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      webRtcEnabled: true,
      autoWrapup: false,
      aiFeature: {
        id: 'ai-feature-1',
        generatedSummaries,
      },
    };
    const configuredInteractionId = 'generated-summary-flags-task';

    taskManager.taskCollection = {};
    taskManager.setWrapupData(wrapupData);
    taskManager.setAgentId('agent-id-1');
    taskManager.setWebRtcEnabled(true);
    taskManager.setConfigFlags(configFlags);

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          interactionId: configuredInteractionId,
          mediaResourceId: configuredInteractionId,
          type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        },
      })
    );

    const configuredTask = taskManager.getTask(configuredInteractionId);

    expect(taskManager.getAgentId()).toBe('agent-id-1');
    expect(configuredTask.configureAISummary).toHaveBeenCalledWith(
      mockApiAIAssistant,
      expect.any(Object),
      expect.any(Function)
    );
    const injectedGeneratedSummaryFlagsAccessor =
      configuredTask.configureAISummary.mock.calls[0][2];

    expect(injectedGeneratedSummaryFlagsAccessor()).toBe(generatedSummaries);
    taskManager.setConfigFlags({
      ...configFlags,
      aiFeature: {
        ...configFlags.aiFeature,
        generatedSummaries: updatedGeneratedSummaries,
      },
    });
    expect(injectedGeneratedSummaryFlagsAccessor()).toBe(updatedGeneratedSummaries);
    expect(configuredTask.configureAISummary).toHaveBeenCalledTimes(1);
    expect(TaskFactory.createTask).toHaveBeenLastCalledWith(
      contactMock,
      webCallingService,
      expect.objectContaining({interactionId: configuredInteractionId}),
      configFlags,
      wrapupData,
      'agent-id-1',
      undefined,
      undefined
    );
  });

  it.each([
    [
      'without a conversationId',
      {
        type: 'UNKNOWN_SUMMARY_EVENT',
        data: {
          data: {
            summaryText: 'private-summary',
            sections: {privateKey: 'private-value'},
          },
        },
      },
    ],
    [
      'without a registered task',
      {
        type: 'UNKNOWN_SUMMARY_EVENT',
        data: {
          data: {
            conversationId: 'missing-task-id',
            summaryText: 'private-summary',
          },
        },
      },
    ],
  ])('should classify unknown summary-like RTD frames as bounded drops %s', (_label, payload) => {
    taskManager.taskCollection = {};

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(payload));

    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: 'UNKNOWN_SUMMARY_EVENT',
        dropReason: 'unknown-event',
      },
      ['operational']
    );
    expect(getInboundDropMetricCalls()).toHaveLength(1);
    expect(getLoggerProxy().warn).toHaveBeenCalledTimes(1);
    expect(getLoggerProxy().warn).toHaveBeenCalledWith('AI summary inbound event dropped', {
      module: TASK_MANAGER_FILE,
      method: METHODS.HANDLE_AI_SUMMARY_EVENT,
      data: {
        reason: 'unknown-event',
        eventType: 'UNKNOWN_SUMMARY_EVENT',
      },
    });
    expectNoSensitiveDiagnostics('private-summary', 'privateKey', 'private-value');
  });

  it('should handle malformed AI summary and parser drop branches with bounded metadata', () => {
    taskManager.handleRealtimeWebsocketEvent('{bad-json "private-summary"');
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, data: {}})
    );
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {data: {conversationId: ''}},
      })
    );
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: {conversationId: ''}},
      })
    );
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({type: CC_EVENTS.REAL_TIME_TRANSCRIPTION, data: {data: {}}})
    );

    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {eventType: 'unknown', dropReason: 'unparseable'},
      ['operational']
    );
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        dropReason: 'malformed-envelope',
      },
      ['operational']
    );
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        dropReason: 'invalid-payload',
      },
      ['operational']
    );
    expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
      {
        eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        dropReason: 'invalid-payload',
      },
      ['operational']
    );
    expect(getInboundDropMetricCalls()).toHaveLength(4);
    expect(getLoggerProxy().warn).toHaveBeenCalledTimes(4);
    expect(getLoggerProxy().warn).toHaveBeenCalledWith('AI summary inbound event dropped', {
      module: TASK_MANAGER_FILE,
      method: METHODS.HANDLE_AI_SUMMARY_EVENT,
      data: {
        reason: 'unparseable',
        eventType: 'unknown',
      },
    });
    expectNoSensitiveDiagnostics('private-summary');
  });

  it.each([undefined, ''])(
    'drops receiving-agent summaries with summaryText %p',
    (summaryText) => {
      taskManager.taskCollection = {};

      taskManager.handleRealtimeWebsocketEvent(
        JSON.stringify({
          type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          data: {data: {conversationId: 'conversation-1', summaryText}},
        })
      );

      expect(getMetricsTrackEvent()).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_INBOUND_EVENT_DROPPED,
        {
          eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          dropReason: 'invalid-payload',
        },
        ['operational']
      );
    }
  );

  it('should keep a pending request operational after unparseable, malformed, and unknown frames', async () => {
    const coordinator = (taskManager as any).aiSummaryCoordinator;
    const conversationId = 'recovery-conversation';
    const registration = await coordinator.registerPendingAISummaryRequest(
      taskId,
      conversationId,
      'POST_CALL_SUMMARY',
      'POST_CALL_SUMMARY_TIMEOUT'
    );
    const validPayload = {
      conversationId,
      summaryText: 'valid recovery summary',
    };

    taskManager.handleRealtimeWebsocketEvent('{not-json');
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY, data: {}})
    );
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({type: 'UNKNOWN_SUMMARY_RECOVERY_EVENT', data: {data: {conversationId}}})
    );

    expect(getInboundDropMetricCalls()).toHaveLength(3);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY,
        data: {data: validPayload},
      })
    );

    await expect(registration.result).resolves.toStrictEqual(validPayload);
    expect(getInboundDropMetricCalls()).toHaveLength(3);
  });

  it('should contain throwing transcript listeners without unparseable inbound drops', () => {
    const task = taskManager.getTask(taskId);
    const transcriptHandler = jest.fn(() => {
      throw new Error('private transcript listener failure');
    });
    const payload = {
      data: {
        data: {
          content: 'private transcript content',
          conversationId: taskId,
          messageId: 'throwing-transcript',
        },
      },
      type: CC_EVENTS.REAL_TIME_TRANSCRIPTION,
    };

    task.on(CC_EVENTS.REAL_TIME_TRANSCRIPTION, transcriptHandler);

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(payload));

    expect(transcriptHandler).toHaveBeenCalledWith(payload.data);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(getLoggerProxy().warn).not.toHaveBeenCalled();
    expect(getLoggerProxy().error).toHaveBeenCalledWith(
      'Failed to dispatch RTD WebSocket message',
      {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_REAL_TIME_WEBSOCKET_EVENT,
        data: {
          reason: 'dispatch-error',
          eventType: CC_EVENTS.REAL_TIME_TRANSCRIPTION,
          conversationId: taskId,
        },
      }
    );
    expectNoSensitiveDiagnostics(
      'private transcript content',
      'private transcript listener failure'
    );
  });

  it('should contain throwing receiver summary listeners without unparseable inbound drops', () => {
    const task = taskManager.getTask(taskId);
    const receiverPayload = {
      conversationId: taskId,
      summaryText: 'private receiver summary',
      sections: {privateKey: 'private-value'},
      adaptiveCard: {body: ['private-card']},
      agentName: 'private-agent',
    };
    const receiverHandler = jest.fn(() => {
      throw new Error('private receiver listener failure');
    });

    task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, receiverHandler);

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receiverPayload},
      })
    );

    expect(receiverHandler).toHaveBeenCalledWith(receiverPayload);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(getLoggerProxy().warn).not.toHaveBeenCalled();
    expect(getLoggerProxy().error).toHaveBeenCalledWith(
      'AI summary receiver listener failed',
      {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_AI_SUMMARY_EVENT,
        data: {
          reason: 'consumer-listener-error',
          eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          conversationId: taskId,
        },
      }
    );
    expectNoSensitiveDiagnostics(
      'private receiver summary',
      'privateKey',
      'private-value',
      'private-card',
      'private-agent',
      'private receiver listener failure'
    );
  });

  it('should contain a throwing receiver listener while flushing a lifecycle buffer', () => {
    jest.useFakeTimers();
    const conversationId = 'throwing-flush-conversation';
    const receivingPayload = {
      conversationId,
      summaryText: 'private buffered summary',
    };

    taskManager.taskCollection = {};
    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
        data: {data: receivingPayload},
      })
    );
    expect(jest.getTimerCount()).toBe(1);

    const task = createReceivingSummaryTask('throwing-flush-task', conversationId);
    task.on(TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT, () => {
      throw new Error('private buffered listener failure');
    });
    taskManager.taskCollection = {task};

    expect(() => (taskManager as any).flushReceivingSummaryForTask(task)).not.toThrow();

    expect(jest.getTimerCount()).toBe(0);
    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(getLoggerProxy().error).toHaveBeenCalledWith(
      'AI summary receiver listener failed',
      {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_AI_SUMMARY_EVENT,
        data: {
          reason: 'consumer-listener-error',
          eventType: CC_AI_SUMMARY_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT,
          conversationId,
        },
      }
    );
    expectNoSensitiveDiagnostics('private buffered summary', 'private buffered listener failure');
  });

  it('should contain feature metric failures without unparseable inbound drops', () => {
    getMetricsTrackEvent().mockImplementationOnce(() => {
      throw new Error('private metric failure');
    });

    taskManager.handleRealtimeWebsocketEvent(
      JSON.stringify({
        type: CC_AI_SUMMARY_EVENTS.FEATURE_ENABLEMENT,
        data: {
          data: {
            interactionId: taskId,
            postCallEnabled: true,
            midCallEnabled: true,
          },
        },
      })
    );

    expect(getInboundDropMetricCalls()).toHaveLength(0);
    expect(getLoggerProxy().warn).not.toHaveBeenCalled();
    expect(getLoggerProxy().error).not.toHaveBeenCalled();
    expectNoSensitiveDiagnostics('private metric failure');
  });

  const expectTaskConfiguredForAISummary = (task) => {
    expect(task.configureAISummary).toHaveBeenCalledTimes(1);
    expect(task.configureAISummary).toHaveBeenCalledWith(
      mockApiAIAssistant,
      (taskManager as any).aiSummaryCoordinator,
      (taskManager as any).getGeneratedSummaryFlags
    );
    expect(task.on).toHaveBeenCalled();
    expect(task.configureAISummary.mock.invocationCallOrder[0]).toBeLessThan(
      task.on.mock.invocationCallOrder[0]
    );
  };

  it.each(
    [
      [
        'AGENT_CONTACT_RESERVED',
        TASK_EVENTS.TASK_INCOMING,
        {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_CONTACT_RESERVED,
          interactionId: 'ai-summary-reserved-task',
          mediaResourceId: 'ai-summary-reserved-task',
          interaction: {mediaType: 'telephony'},
        },
      ],
      [
        'missing-task AGENT_CONTACT',
        TASK_EVENTS.TASK_HYDRATE,
        {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_CONTACT,
          interactionId: 'ai-summary-agent-contact-task',
          mediaResourceId: 'ai-summary-agent-contact-task',
          interaction: {mediaType: 'telephony'},
        },
      ],
      [
        'campaign-preview reservation',
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: 'ai-summary-campaign-task',
          mediaResourceId: 'ai-summary-campaign-task',
          interaction: {mediaType: 'telephony'},
        },
      ],
      [
        'missing-task CONTACT_MERGED',
        TASK_EVENTS.TASK_MERGED,
        {
          ...taskDataMock,
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: 'ai-summary-merged-task',
          mediaResourceId: 'ai-summary-merged-task',
          interaction: {mediaType: 'telephony', callProcessingDetails: {}},
        },
      ],
    ] as const
  )(
    'should configure AI summary on factory-created task before publishing %s',
    (_name, publicationEvent, payload) => {
      taskManager.taskCollection = {};
      (TaskFactory.createTask as jest.Mock).mockClear();
      const publishedTasks: any[] = [];
      let registryEntryDuringConfiguration: unknown = 'not-observed';
      const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');

      (TaskFactory.createTask as jest.Mock).mockImplementationOnce(
        (_contact, _webCallingService, data) => {
          const createdTask = createStateMachineTask(data);

          createdTask.configureAISummary.mockImplementationOnce(() => {
            registryEntryDuringConfiguration = taskManager.getTask(payload.interactionId);
          });

          return createdTask;
        }
      );

      taskManager.on(publicationEvent, (publishedTask) => {
        publishedTasks.push(publishedTask);
        expect(publishedTask).toBe((TaskFactory.createTask as jest.Mock).mock.results[0].value);
        expectTaskConfiguredForAISummary(publishedTask);
      });

      webSocketManagerMock.emit('message', JSON.stringify({data: payload}));

      const createdTask = (TaskFactory.createTask as jest.Mock).mock.results[0].value;

      expect(TaskFactory.createTask).toHaveBeenCalledTimes(1);
      expect(taskManager.getTask(payload.interactionId)).toBe(createdTask);
      expect(publishedTasks).toEqual([createdTask]);
      expectTaskConfiguredForAISummary(createdTask);
      expect(registryEntryDuringConfiguration).toBeUndefined();
      const publicationCallIndex = taskManagerEmitSpy.mock.calls.findIndex(
        ([eventName]) => eventName === publicationEvent
      );

      expect(publicationCallIndex).toBeGreaterThanOrEqual(0);
      expect(createdTask.configureAISummary.mock.invocationCallOrder[0]).toBeLessThan(
        taskManagerEmitSpy.mock.invocationCallOrder[publicationCallIndex]
      );
    }
  );

  it('should cover task websocket parser exits and reservation re-key', () => {
    webSocketManagerMock.emit('message', '{bad-json');
    webSocketManagerMock.emit('message', JSON.stringify({keepalive: true}));
    webSocketManagerMock.emit('message', JSON.stringify({data: {type: 'unknown'}}));

    const reservationTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'reservation-id',
    });
    taskManager.taskCollection = {'reservation-id': reservationTask};
    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
          interactionId: 'assigned-id',
          reservationInteractionId: 'reservation-id',
          interaction: {mediaType: 'telephony'},
        },
      })
    );

    expect(taskManager.getTask('assigned-id')).toBe(reservationTask);
    expect(taskManager.getTask('reservation-id')).toBeUndefined();

    taskManager.taskCollection = {
      invalid: createStateMachineTask({
        ...taskDataMock,
        interactionId: '',
        interaction: {mainInteractionId: ''},
      }),
    };
    expect((taskManager as any).selectReceivingSummaryTasks('missing-conversation')).toEqual([]);
  });

  it('should handle campaign update and preview reservation lifecycle hooks', () => {
    const task = taskManager.getTask(taskId);
    const campaignUpdatePayload = {
      data: {
        ...taskDataMock,
        type: CC_EVENTS.CAMPAIGN_CONTACT_UPDATED,
        interaction: {
          callProcessingDetails: {
            campaignPreviewAutoAction: 'ACCEPT',
          },
        },
      },
    };
    const campaignUpdateEmitSpy = jest.spyOn(task, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(campaignUpdatePayload));

    expect(campaignUpdateEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CAMPAIGN_CONTACT_UPDATED,
      task
    );
    expect(task.data.interaction.callProcessingDetails.campaignPreviewAutoAction).toBe('ACCEPT');

    taskManager.taskCollection = {};
    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interaction: {mediaType: 'telephony'},
        },
      })
    );

    expect(taskManager.getTask(taskId)).toBeDefined();
    expect(TaskFactory.createTask).toHaveBeenLastCalledWith(
      contactMock,
      webCallingService,
      expect.objectContaining({
        wrapUpRequired: false,
        isConferenceInProgress: false,
        isAutoAnswering: false,
      }),
      undefined,
      undefined,
      'test-agent-id',
      undefined,
      undefined
    );
  });

  it('should handle contact merge creation and child cleanup paths', () => {
    const mergedHandler = jest.fn();
    const childTask = createStateMachineTask({
      ...taskDataMock,
      interactionId: 'child-interaction',
      interaction: {
        mediaType: 'telephony',
        callProcessingDetails: {},
      },
    });
    taskManager.taskCollection = {child: childTask};
    taskManager.on(TASK_EVENTS.TASK_MERGED, mergedHandler);

    webSocketManagerMock.emit(
      'message',
      JSON.stringify({
        data: {
          ...taskDataMock,
          type: CC_EVENTS.CONTACT_MERGED,
          childInteractionId: 'child-interaction',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {},
          },
        },
      })
    );

    expect(taskManager.getTask('child-interaction')).toBeUndefined();
    expect(mergedHandler).toHaveBeenCalledWith(taskManager.getTask(taskId));
  });

  it('should return the singleton from getTaskManager', () => {
    (TaskManager as any).taskManager = undefined;

    const singleton = TaskManager.getTaskManager(
      mockApiAIAssistant as any,
      contactMock,
      webCallingService,
      webSocketManagerMock as any,
      rtdWebSocketManagerMock as any
    );

    expect(TaskManager.getTaskManager(
      mockApiAIAssistant as any,
      contactMock,
      webCallingService,
      webSocketManagerMock as any,
      rtdWebSocketManagerMock as any
    )).toBe(singleton);
  });

  it('should cover TaskManager-imported TaskUtils helper branches', () => {
    const interaction = {
      interactionId: 'main',
      owner: 'agent-1',
      mediaType: 'telephony',
      participants: {
        'agent-1': {pType: 'Agent', hasLeft: false},
        'agent-2': {pType: 'Agent', hasLeft: false, consultState: 'consulting'},
        customer: {pType: 'Customer', hasLeft: false},
      },
      media: {
        main: {mType: 'mainCall', participants: ['agent-1', 'customer'], isHold: true},
        consult: {mType: 'consult', participants: ['agent-1', 'agent-2'], isHold: false},
      },
      callProcessingDetails: {
        relationshipType: 'consult',
        parentInteractionId: 'parent',
      },
    } as any;
    const task = {
      data: {
        agentId: 'agent-1',
        interactionId: 'main',
        mediaResourceId: 'consult',
        interaction,
      },
    } as any;

    expect(getIsCustomerInCall(interaction, 'main')).toBe(true);
    expect(getConferenceParticipantsCount(interaction, 'main')).toBe(1);
    expect(getIsConsultInProgressForConferenceControls(interaction, 'main', 'agent-1')).toBe(true);
    expect(getIsConsultedAgentForControls({isConsulted: true} as any, {} as any, false)).toBe(
      true
    );
    expect(getServerHoldStateForControls({taskData: task.data} as any, 'main')).toBe(true);
    expect(isPrimary(task, 'agent-1')).toBe(true);
    expect(isParticipantInMainInteraction(task, 'agent-1')).toBe(true);
    expect(checkParticipantNotInInteraction(task, 'missing-agent')).toBe(true);
    expect(getAISummaryCorrelation(task.data)).toEqual({
      conversationId: 'main',
      interactionId: 'main',
    });
    expect(getConsultMediaResourceId(interaction, undefined, 'agent-1')).toBe('consult');
  });

  it('should cover TaskManager-imported TaskUtils negative and auto-answer branches', () => {
    const baseInteraction = {
      interactionId: 'interaction-1',
      owner: 'agent-1',
      mediaType: 'telephony',
      mediaChannel: 'telephony',
      contactDirection: {type: 'OUTBOUND'},
      outboundType: 'OUTDIAL',
      previousVTeams: [],
      participants: {
        'agent-1': {pType: 'Agent', hasLeft: false, autoAnswerEnabled: true},
        'agent-left': {pType: 'Agent', hasLeft: true},
        supervisor: {pType: 'Supervisor', hasLeft: false},
        vva: {pType: 'VVA', hasLeft: false},
        customer: {pType: 'Customer', hasLeft: true},
      },
      media: {
        main: {
          mType: 'mainCall',
          participants: ['agent-1', 'agent-left', 'supervisor', 'vva', 'customer'],
        },
        consultReserved: {
          mType: 'consult',
          participants: ['agent-1', 'reserved-agent'],
        },
      },
      callProcessingDetails: {
        relationshipType: 'consult',
        parentInteractionId: 'parent',
        outdialAgentId: 'agent-1',
      },
    } as any;

    expect(getIsCustomerInCall(baseInteraction, 'main')).toBe(false);
    expect(getIsCustomerInCall({media: {}, participants: {}} as any, 'missing')).toBe(false);
    expect(getConferenceParticipantsCount(baseInteraction, 'main')).toBe(1);
    expect(getConferenceParticipantsCount({media: {}, participants: {}} as any, 'missing')).toBe(0);
    expect(getIsConsultInProgressForConferenceControls(undefined, 'main', 'agent-1')).toBe(false);
    expect(getIsConsultInProgressForConferenceControls(baseInteraction, undefined, 'agent-1')).toBe(
      false
    );
    expect(
      getIsConsultInProgressForConferenceControls(
        {
          ...baseInteraction,
          participants: {
            ...baseInteraction.participants,
            'reserved-agent': {
              pType: 'Agent',
              hasLeft: false,
              consultState: 'consultReserved',
              hasJoined: false,
            },
          },
        },
        'main',
        'agent-1'
      )
    ).toBe(false);
    expect(getIsConsultedAgentForControls({} as any, {consultInitiator: true} as any, true)).toBe(
      false
    );
    expect(getServerHoldStateForControls({} as any, 'missing')).toBeUndefined();
    expect(
      getServerHoldStateForControls(
        {taskData: {interaction: {media: {main: {}}}, mediaResourceId: 'main'}} as any,
        undefined
      )
    ).toBeUndefined();

    expect(isPrimary({data: {agentId: 'agent-1', interaction: {}}} as any, 'agent-1')).toBe(true);
    expect(isPrimary({data: {agentId: 'agent-2', interaction: {owner: 'agent-1'}}} as any, 'agent-2')).toBe(
      false
    );
    expect(isParticipantInMainInteraction({data: {interaction: {}}} as any, 'agent-1')).toBe(
      false
    );
    expect(checkParticipantNotInInteraction({data: {interaction: {}}} as any, 'agent-1')).toBe(
      true
    );
    expect(
      checkParticipantNotInInteraction(
        {
          data: {
            interaction: {
              participants: {'agent-1': {hasLeft: true}},
            },
          },
        } as any,
        'agent-1'
      )
    ).toBe(true);
    expect(tryGetAISummaryCorrelation({interactionId: ''} as any)).toBeUndefined();
    expect(() => getAISummaryCorrelation({interactionId: ''} as any)).toThrow(
      'AI_SUMMARY_CORRELATION_NOT_AVAILABLE'
    );
    expect(isSecondaryAgent({callProcessingDetails: undefined} as any)).toBe(false);
    expect(isSecondaryEpDnAgent({...baseInteraction, mediaType: 'email'})).toBe(false);
    expect(
      isCampaignPreviewTask({
        interaction: {
          outboundType: 'STANDARD_PREVIEW_CAMPAIGN',
          callProcessingDetails: {},
        },
      } as any)
    ).toBe(true);
    expect(
      isCampaignPreviewReservation({
        data: {type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION},
      } as any)
    ).toBe(true);
    expect(isAutoAnswerEnabled(baseInteraction, 'missing-agent')).toBe(false);
    expect(isWebRTCCall(baseInteraction, LoginOption.BROWSER, true)).toBe(true);
    expect(isWebRTCCall(baseInteraction, LoginOption.AGENT_DN, true)).toBe(false);
    expect(
      isDigitalOutbound({
        ...baseInteraction,
        mediaChannel: 'email',
      })
    ).toBe(true);
    expect(isDigitalOutbound({...baseInteraction, contactDirection: {type: 'INBOUND'}})).toBe(
      false
    );
    expect(hasAgentInitiatedOutdial(baseInteraction, 'agent-1')).toBe(true);
    expect(
      hasAgentInitiatedOutdial(
        {
          ...baseInteraction,
          callProcessingDetails: {
            ...baseInteraction.callProcessingDetails,
            BLIND_TRANSFER_IN_PROGRESS: true,
          },
        },
        'agent-1'
      )
    ).toBe(false);
    expect(shouldAutoAnswerTask({interaction: baseInteraction} as any, 'agent-1', LoginOption.BROWSER, true)).toBe(
      true
    );
    expect(
      shouldAutoAnswerTask(
        {
          interaction: {
            ...baseInteraction,
            mediaType: 'email',
            mediaChannel: 'email',
            previousVTeams: ['queue-1'],
          },
        } as any,
        'agent-1',
        LoginOption.AGENT_DN,
        false
      )
    ).toBe(false);
    expect(getConsultMediaResourceId(undefined, undefined, 'agent-1')).toBeUndefined();
  });

  it('should not re-emit agent related events', () => {
    const dummyPayload = {
      data: {
        ...taskDataMock,
        type: CC_AGENT_EVENTS.AGENT_BUDDY_AGENTS,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify({data: taskDataMock}));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingService.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);

    webSocketManagerMock.emit('message', JSON.stringify(dummyPayload));

    expect(taskEmitSpy).not.toHaveBeenCalled();
  });

  it('should handle WebSocket message for AGENT_CONTACT_RESERVED and emit task:incoming for browser case', () => {
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {mediaType: 'telephony'},
        interactionId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const incomingHandler = jest.fn();
    taskManager.on(TASK_EVENTS.TASK_INCOMING, incomingHandler);

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(incomingHandler).toHaveBeenCalledWith(taskManager.getTask(payload.data.interactionId));
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.getTask(taskId));
    expect(taskManager.getAllTasks()).toHaveProperty(payload.data.interactionId);

    const assignedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {mediaType: 'telephony'},
        interactionId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const currentTaskAssignedSpy = jest.spyOn(
      taskManager.getTask(payload.data.interactionId),
      'emit'
    );
    const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(assignedPayload));

    expect(currentTaskAssignedSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_ASSIGNED,
      taskManager.getTask(taskId)
    );
    expect(taskManagerEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
      taskManager.getTask(taskId)
    );
  });

  it('should handle WebSocket message for AGENT_CONTACT_RESERVED and emit task:incoming for extension case', () => {
    webCallingService.loginOption = LoginOption.EXTENSION;
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const incomingHandler = jest.fn();
    taskManager.on(TASK_EVENTS.TASK_INCOMING, incomingHandler);

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(incomingHandler).toHaveBeenCalledWith(taskManager.getTask(taskId));
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.getTask(taskId));
    expect(taskManager.getAllTasks()).toHaveProperty(payload.data.interactionId);
    taskManager.off(TASK_EVENTS.TASK_INCOMING, incomingHandler);
  });

  it('should send mapped events through the state machine without duplicate updates', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const updateSpy = task.updateTaskData as jest.Mock;
    updateSpy.mockClear();
    const sendSpy = task.sendStateMachineEvent as jest.Mock;
    sendSpy.mockClear();
    const cleanupSpy = jest.spyOn(taskManager as any, 'handleTaskCleanup');

    const assignFailedPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED,
        reason: 'ASSIGN_FAILED',
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(assignFailedPayload));

    const stateMachineEvent = expectLastStateMachineEvent(sendSpy, TaskEvent.ASSIGN_FAILED);
    expect(stateMachineEvent).toEqual({
      type: TaskEvent.ASSIGN_FAILED,
      reason: assignFailedPayload.data.reason,
    });
    expect(updateSpy).toHaveBeenCalledWith(assignFailedPayload.data);
    expect(cleanupSpy).toHaveBeenCalledWith(task);
  });

  it('should update task data directly when no state machine mapping exists', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const updateSpy = task.updateTaskData as jest.Mock;
    updateSpy.mockClear();
    const sendSpy = task.sendStateMachineEvent as jest.Mock;
    sendSpy.mockClear();

    const participantMovedPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.CONSULTED_PARTICIPANT_MOVING,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(participantMovedPayload));

    expect(sendSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(participantMovedPayload.data);
  });

  it('should return task by ID', () => {
    const taskId = 'task123';
    const mockTask = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    taskManager.taskCollection[taskId] = mockTask;

    expect(taskManager.getTask(taskId)).toBe(mockTask);
  });

  it('should return all tasks', () => {
    const taskId1 = 'task123';
    const taskId2 = 'task456';
    const mockTask1 = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId1,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const mockTask2 = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId2,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    taskManager.taskCollection[taskId1] = mockTask1;
    taskManager.taskCollection[taskId2] = mockTask2;

    const allTasks = taskManager.getAllTasks();

    expect(allTasks).toHaveProperty(taskId1, mockTask1);
    expect(allTasks).toHaveProperty(taskId2, mockTask2);
  });

  it('test call listeners being switched off on call end', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const webrtcTask = new WebRTC(contactMock, webCallingService, taskDataMock, {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
    (taskManager as any).taskCollection[taskId] = webrtcTask;
    // TaskManager must listen to task-level cleanup events emitted by the state machine.
    // This is normally wired when TaskManager creates the task via TaskFactory.
    (taskManager as any).setupTaskListeners(webrtcTask);

    const task = taskManager.getTask(taskId)!;
    // This test doesn't validate UI controls; avoid requiring full interaction.media
    // shape for WebRTC UI controls computation.
    jest.spyOn(task as any, 'updateUiControls').mockImplementation(() => undefined);
    const originalEmit = task.emit;
    jest.spyOn(task, 'emit').mockImplementation((event, arg) => {
      if (event === CC_EVENTS.CONTACT_ENDED) {
        return;
      }
      return originalEmit.call(task, event, arg);
    });

    const webCallListenerSpy = jest.spyOn(task, 'unregisterWebCallListeners');
    const callOffSpy = jest.spyOn(mockCall, 'off');
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {state: 'new', mediaType: 'telephony'},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    // Ensure the state machine is hydrated into a connected state before CONTACT_ENDED
    const hydratePayload = {
      data: {
        ...payload.data,
        type: CC_EVENTS.AGENT_CONTACT,
        interaction: {state: 'connected', mediaType: 'telephony'},
      },
    };

    taskManager.getTask(taskId).data = hydratePayload.data;
    webSocketManagerMock.emit('message', JSON.stringify(hydratePayload));

    taskManager.getTask(taskId).data = payload.data;
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(stateMachineEvent?.taskData.wrapUpRequired).toBe(false);
    expect(webCallListenerSpy).toHaveBeenCalledWith();
    expect(callOffSpy).toHaveBeenCalledWith(
      CALL_EVENT_KEYS.REMOTE_MEDIA,
      callOffSpy.mock.calls[0][1]
    );

    taskManager.unregisterIncomingCallEvent();
    expect(offSpy.mock.calls.length).toBe(2); // 1 for incoming call and 1 for remote media
    expect(offSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, offSpy.mock.calls[0][1]);
    expect(offSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, offSpy.mock.calls[1][1]);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_END event with wrapupRequired on regular call end', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {state: 'connected'},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    task.updateTaskData(payload.data);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(stateMachineEvent?.taskData.wrapUpRequired).toBe(true);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_REJECT event on AGENT_INVITE_FAILED event', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_INVITE_FAILED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {state: 'connected'},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        reason: 'INVITE_FAILED',
      },
    };

    task.updateTaskData(payload.data);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.INVITE_FAILED
    );
    expect(stateMachineEvent?.reason).toBe(payload.data.reason);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_HYDRATE even if task is already present in taskManager', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
      },
    };
    const existingTask = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(existingTask, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.HYDRATE
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    expect(existingTask).toBe(taskManager.getTask(taskId));
    expect(taskManager.taskCollection[payload.data.interactionId]).toBe(
      taskManager.getTask(taskId)
    );
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_HYDRATE event on AGENT_CONTACT when task is created from payload', () => {
    taskManager.taskCollection = [];
    const payload = {
      data: {
        ...initalPayload.data,
        interaction: {mediaType: 'telephony', state: 'new'},
        type: CC_EVENTS.AGENT_CONTACT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const createdTask = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = createdTask.sendStateMachineEvent as jest.Mock;
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.HYDRATE
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    expect(taskManager.taskCollection[payload.data.interactionId]).toBe(
      taskManager.getTask(taskId)
    );
  });

  it('should emit TASK_HYDRATE event on AGENT_CONTACT event if task is connected and not in the taskManager ', () => {
    taskManager.taskCollection = [];
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const createdTask = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = createdTask.sendStateMachineEvent as jest.Mock;
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.HYDRATE
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    expect(taskManager.taskCollection[payload.data.interactionId]).toBe(
      taskManager.getTask(taskId)
    );
  });

  it('should set isConferenceInProgress correctly when creating task via AGENT_CONTACT with conference in progress', () => {
    const testAgentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';
    taskManager.setAgentId(testAgentId);
    taskManager.taskCollection = [];

    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
        interaction: {
          mediaType: 'telephony',
          state: 'conference',
          participants: {
            [testAgentId]: {pType: 'Agent', hasLeft: false},
            'agent-2': {pType: 'Agent', hasLeft: false},
            'customer-1': {pType: 'Customer', hasLeft: false},
          },
          media: {
            [taskId]: {
              mType: 'mainCall',
              participants: [testAgentId, 'agent-2', 'customer-1'],
            },
          },
        },
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const createdTask = taskManager.getTask(taskId);
    expect(createdTask).toBeDefined();
    expect(createdTask.data.isConferenceInProgress).toBe(true);
  });

  it('should set isConferenceInProgress to false when creating task via AGENT_CONTACT with only one agent', () => {
    const testAgentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';
    taskManager.setAgentId(testAgentId);
    taskManager.taskCollection = [];

    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
        interaction: {
          mediaType: 'telephony',
          state: 'connected',
          participants: {
            [testAgentId]: {pType: 'Agent', hasLeft: false},
            'customer-1': {pType: 'Customer', hasLeft: false},
          },
          media: {
            [taskId]: {
              mType: 'mainCall',
              participants: [testAgentId, 'customer-1'],
            },
          },
        },
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const createdTask = taskManager.getTask(taskId);
    expect(createdTask).toBeDefined();
    expect(createdTask.data.isConferenceInProgress).toBe(false);
  });

  it('should emit TASK_WRAPUP event on AGENT_WRAPUP event', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const wrapupPayload = {
      data: {
        type: CC_EVENTS.AGENT_WRAPUP,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        wrapUpRequired: true,
      },
    };

    const task = taskManager.getTask(taskId);
    const updateTaskDataSpy = task.updateTaskData as jest.Mock;
    updateTaskDataSpy.mockClear();
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));

    expect(updateTaskDataSpy).toHaveBeenCalledWith(wrapupPayload.data);
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.TASK_WRAPUP);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_HOLD event on AGENT_CONTACT_HELD event', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_HELD,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const task = taskManager.getTask(taskId);
    const taskUpdateTaskDataSpy = task.updateTaskData as jest.Mock;
    taskUpdateTaskDataSpy.mockClear();
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.HOLD_SUCCESS
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_RESUME event on AGENT_CONTACT_UNHELD event', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_UNHELD,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const task = taskManager.getTask(taskId);
    const taskUpdateTaskDataSpy = task.updateTaskData as jest.Mock;
    taskUpdateTaskDataSpy.mockClear();
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.UNHOLD_SUCCESS
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('handle AGENT_CONSULT_CREATED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_CREATED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONSULT_CREATED
    );
    expect(stateMachineEvent?.taskData).toEqual({...payload.data, isConsulted: false});
    sendStateMachineEventSpy.mockRestore();
  });

  it('handle AGENT_OFFER_CONTACT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONTACT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.TASK_OFFERED
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  describe('Auto-Answer Functionality', () => {
    it('should emit both TASK_OFFER_CONTACT and TASK_AUTO_ANSWERED events when auto-answer succeeds', async () => {
      // Step 1: Create the task first with initial payload
      webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

      const task = taskManager.getTask(taskId);
      const taskEmitSpy = jest.spyOn(task, 'emit');
      const taskAcceptSpy = jest.spyOn(task, 'accept').mockResolvedValue(undefined);
      const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

      // Step 2: Trigger AGENT_OFFER_CONTACT with auto-answer
      const autoAnswerPayload = {
        data: {
          ...initalPayload.data,
          type: CC_EVENTS.AGENT_OFFER_CONTACT,
          isAutoAnswering: true,
          interaction: {
            ...initalPayload.data.interaction,
            mediaType: 'telephony',
            state: 'new',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(autoAnswerPayload));

      // Wait for async auto-answer to complete
      await new Promise(process.nextTick);

      // Verify accept was called
      expect(taskAcceptSpy).toHaveBeenCalledTimes(1);

      const stateMachineEvent = expectLastStateMachineEvent(
        sendStateMachineEventSpy,
        TaskEvent.TASK_OFFERED
      );
      expect(stateMachineEvent?.taskData).toEqual(autoAnswerPayload.data);
      // Verify task auto-answer event was emitted
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
      sendStateMachineEventSpy.mockRestore();
    });

    it('should NOT emit TASK_AUTO_ANSWERED event when auto-answer fails', async () => {
      // Step 1: Create the task first with initial payload
      webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

      const task = taskManager.getTask(taskId);
      const taskEmitSpy = jest.spyOn(task, 'emit');
      const taskAcceptSpy = jest
        .spyOn(task, 'accept')
        .mockRejectedValue(new Error('Accept failed'));

      // Step 2: Trigger AGENT_OFFER_CONTACT with auto-answer (will fail)
      const autoAnswerPayload = {
        data: {
          ...initalPayload.data,
          type: CC_EVENTS.AGENT_OFFER_CONTACT,
          isAutoAnswering: true,
          interaction: {
            ...initalPayload.data.interaction,
            mediaType: 'telephony',
            state: 'new',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(autoAnswerPayload));

      // Wait for async auto-answer to complete
      await new Promise(process.nextTick);

      // Verify accept was called
      expect(taskAcceptSpy).toHaveBeenCalledTimes(1);

      // Verify TASK_AUTO_ANSWERED event was NOT emitted on failure
      expect(taskEmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
    });

    it('should emit both TASK_OFFER_CONSULT and TASK_AUTO_ANSWERED events for consult with auto-answer', async () => {
      // Step 1: Create the task first with initial payload
      webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

      const task = taskManager.getTask(taskId);
      const taskEmitSpy = jest.spyOn(task, 'emit');
      const taskAcceptSpy = jest.spyOn(task, 'accept').mockResolvedValue(undefined);
      const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

      // Step 2: Trigger AGENT_OFFER_CONSULT with auto-answer
      const consultAutoAnswerPayload = {
        data: {
          ...initalPayload.data,
          type: CC_EVENTS.AGENT_OFFER_CONSULT,
          isAutoAnswering: true,
          isConsulted: true,
          interaction: {
            ...initalPayload.data.interaction,
            mediaType: 'telephony',
            state: 'consult',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(consultAutoAnswerPayload));

      // Wait for async auto-answer to complete
      await new Promise(process.nextTick);

      // Verify accept was called
      expect(taskAcceptSpy).toHaveBeenCalledTimes(1);

      const stateMachineEvent = expectLastStateMachineEvent(
        sendStateMachineEventSpy,
        TaskEvent.OFFER_CONSULT
      );
      expect(stateMachineEvent?.taskData).toEqual({
        ...consultAutoAnswerPayload.data,
        isConsulted: true,
      });
      // Verify task auto-answer event was emitted
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);

      // Verify isConsulted flag is set correctly
      expect(task.data.isConsulted).toBe(true);
      sendStateMachineEventSpy.mockRestore();
    });

    it('should NOT emit TASK_AUTO_ANSWERED when isAutoAnswering is false', async () => {
      // Step 1: Create the task first with initial payload
      webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

      const task = taskManager.getTask(taskId);
      const taskEmitSpy = jest.spyOn(task, 'emit');
      const taskAcceptSpy = jest.spyOn(task, 'accept').mockResolvedValue(undefined);

      // Step 2: Trigger AGENT_OFFER_CONTACT without auto-answer
      const normalPayload = {
        data: {
          ...initalPayload.data,
          type: CC_EVENTS.AGENT_OFFER_CONTACT,
          isAutoAnswering: false,
          interaction: {
            ...initalPayload.data.interaction,
            mediaType: 'telephony',
            state: 'new',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(normalPayload));

      // Wait for any async operations
      await new Promise(process.nextTick);

      // Verify accept was NOT called
      expect(taskAcceptSpy).not.toHaveBeenCalled();

      // Verify TASK_AUTO_ANSWERED event was NOT emitted
      expect(taskEmitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_AUTO_ANSWERED,
        expect.anything()
      );
    });
  });

  it('should remove OUTDIAL task from taskCollection on AGENT_OUTBOUND_FAILED when terminated', () => {
    const task = taskManager.getTask(taskId);
    Object.assign(task.data, {
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        state: 'new',
        isTerminated: true,
      },
      agentsPendingWrapUp: ['agent-123'],
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          isTerminated: true,
        },
        agentsPendingWrapUp: ['agent-123'],
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        reason: 'CUSTOMER_BUSY',
        reasonCode: 1022,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskManager.getTask(taskId)).toBeUndefined();
    expect(removeTaskSpy).toHaveBeenCalled();
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('CUSTOMER_BUSY');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_OUTDIAL_FAILED event on AGENT_OUTBOUND_FAILED', () => {
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: taskId,
        reason: 'CUSTOMER_BUSY',
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('CUSTOMER_BUSY');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should pass taskData in OUTBOUND_FAILED event for shouldWrapUp guard evaluation', () => {
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: taskId,
        reason: 'CUSTOMER_BUSY',
        agentsPendingWrapUp: ['agent-123'],
        interaction: {
          outboundType: 'OUTDIAL',
          isTerminated: true,
        },
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.taskData).toBeDefined();
    expect(stateMachineEvent?.taskData?.agentsPendingWrapUp).toEqual(['agent-123']);
    expect(stateMachineEvent?.taskData?.interaction?.outboundType).toBe('OUTDIAL');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should handle AGENT_OUTBOUND_FAILED gracefully when task is undefined', () => {
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: 'non-existent-task-id',
        reason: 'CUSTOMER_BUSY',
      },
    };
    // Should not throw error when task doesn't exist
    expect(() => {
      webSocketManagerMock.emit('message', JSON.stringify(payload));
    }).not.toThrow();
  });

  it('should NOT remove OUTDIAL task on CONTACT_ENDED when agentsPendingWrapUp exists', () => {
    const task = taskManager.getTask(taskId);
    Object.assign(task.data, {
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        state: 'new',
        mediaType: 'telephony',
      },
      agentsPendingWrapUp: ['test-agent-id'],
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(removeTaskSpy).not.toHaveBeenCalled();
    expect(taskManager.getTask(taskId)).toBeDefined();
  });

  it('should remove OUTDIAL task on CONTACT_ENDED when agentsPendingWrapUp is empty', () => {
    const task = taskManager.getTask(taskId);
    Object.assign(task.data, {
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        state: 'new',
        mediaType: 'telephony',
      },
      agentsPendingWrapUp: [],
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: [],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(removeTaskSpy).toHaveBeenCalled();
  });

  it('should remove OUTDIAL task on CONTACT_ENDED when agentsPendingWrapUp is undefined', () => {
    const task = taskManager.getTask(taskId);
    Object.assign(task.data, {
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        state: 'new',
        mediaType: 'telephony',
      },
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        // agentsPendingWrapUp not included
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(removeTaskSpy).toHaveBeenCalled();
  });

  it('should map non-wxApp agent-terminated OUTDIAL ContactEnded to CONTACT_ENDED (not OUTBOUND_FAILED)', () => {
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONTACT_ENDED);
    expect(outdialFailedSpy).not.toHaveBeenCalled();
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map non-wxApp agent-terminated OUTDIAL AgentOutboundFailed to OUTBOUND_FAILED with popup suppressed', () => {
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        reason: 'AGENT_ENDS',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('AGENT_ENDS');
    expect(stateMachineEvent?.taskData?.suppressOutdialFailedPopup).toBe(true);
    expect(outdialFailedSpy).not.toHaveBeenCalled();
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map wxApp agent-terminated OUTDIAL AgentOutboundFailed to OUTBOUND_FAILED with AGENT_ENDS', () => {
    const task = taskManager.getTask(taskId);
    task.uiControlConfig = {enableWxBetterTogether: true};
    task.data = {
      ...task.data,
      agentId: 'test-agent-id',
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        participants: {
          'test-agent-id': {
            id: 'test-agent-id',
            deviceType: 'wxApp',
            deviceId: 'device-1',
            deviceCallId: 'call-1',
          },
        },
      },
    };
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        reason: 'AGENT_ENDS',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
          participants: {
            'test-agent-id': {
              id: 'test-agent-id',
              deviceType: 'wxApp',
              deviceId: 'device-1',
              deviceCallId: 'call-1',
            },
          },
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('AGENT_ENDS');
    expect(outdialFailedSpy).toHaveBeenCalledWith('AGENT_ENDS');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map wxApp agent-terminated OUTDIAL ContactEnded to OUTBOUND_FAILED with AGENT_ENDS', () => {
    const task = taskManager.getTask(taskId);
    task.uiControlConfig = {enableWxBetterTogether: true};
    task.data = {
      ...task.data,
      agentId: 'test-agent-id',
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        participants: {
          'test-agent-id': {
            id: 'test-agent-id',
            deviceType: 'wxApp',
            deviceId: 'device-1',
            deviceCallId: 'call-1',
          },
        },
      },
    };
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
          participants: {
            'test-agent-id': {
              id: 'test-agent-id',
              deviceType: 'wxApp',
              deviceId: 'device-1',
              deviceCallId: 'call-1',
            },
          },
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('AGENT_ENDS');
    expect(stateMachineEvent?.taskData?.wrapUpRequired).toBe(true);
    expect(outdialFailedSpy).toHaveBeenCalledWith('AGENT_ENDS');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map offer-stage OUTDIAL decline ContactEnded to CONTACT_ENDED (not wrapup)', () => {
    const task = taskManager.getTask(taskId);
    task.stateMachineService = {
      getSnapshot: () => ({value: 'OFFERED'}),
    };
    task.uiControlConfig = {enableWxBetterTogether: true, wxAppAnswerPending: false};
    task.data = {
      ...task.data,
      agentId: 'test-agent-id',
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        participants: {
          'test-agent-id': {
            id: 'test-agent-id',
            deviceType: 'wxApp',
            deviceId: 'device-1',
            deviceCallId: 'call-1',
          },
        },
      },
    };
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: [],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONTACT_ENDED);
    expect(outdialFailedSpy).not.toHaveBeenCalled();
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map post-accept OUTDIAL ContactEnded to OUTBOUND_FAILED when still OFFERED with wxAppAnswerPending', () => {
    const task = taskManager.getTask(taskId);
    task.stateMachineService = {
      getSnapshot: () => ({value: 'OFFERED'}),
    };
    task.uiControlConfig = {enableWxBetterTogether: true, wxAppAnswerPending: true};
    task.data = {
      ...task.data,
      agentId: 'test-agent-id',
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        participants: {
          'test-agent-id': {
            id: 'test-agent-id',
            deviceType: 'wxApp',
            deviceId: 'device-1',
            deviceCallId: 'call-1',
          },
        },
      },
    };
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'offered',
          mediaType: 'telephony',
          participants: {
            'test-agent-id': {
              id: 'test-agent-id',
              deviceType: 'wxApp',
              deviceId: 'device-1',
              deviceCallId: 'call-1',
            },
          },
        },
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('AGENT_ENDS');
    expect(outdialFailedSpy).toHaveBeenCalledWith('AGENT_ENDS');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map post-accept agent-terminated OUTDIAL ContactEnded to OUTBOUND_FAILED when CONNECTED', () => {
    const task = taskManager.getTask(taskId);
    task.stateMachineService = {
      getSnapshot: () => ({value: 'CONNECTED'}),
    };
    task.uiControlConfig = {enableWxBetterTogether: true};
    task.data = {
      ...task.data,
      agentId: 'test-agent-id',
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        participants: {
          'test-agent-id': {
            id: 'test-agent-id',
            deviceType: 'wxApp',
            deviceId: 'device-1',
            deviceCallId: 'call-1',
          },
        },
      },
    };
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const outdialFailedSpy = jest.fn();
    task.on(TASK_EVENTS.TASK_OUTDIAL_FAILED, outdialFailedSpy);

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Agent',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'wrapUp',
          mediaType: 'telephony',
          participants: {
            'test-agent-id': {
              id: 'test-agent-id',
              deviceType: 'wxApp',
              deviceId: 'device-1',
              deviceCallId: 'call-1',
            },
          },
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OUTBOUND_FAILED
    );
    expect(stateMachineEvent?.reason).toBe('AGENT_ENDS');
    expect(outdialFailedSpy).toHaveBeenCalledWith('AGENT_ENDS');
    sendStateMachineEventSpy.mockRestore();
  });

  it('should map customer-terminated OUTDIAL ContactEnded to CONTACT_ENDED (no AGENT_ENDS remap)', () => {
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: taskId,
        terminatingParty: 'Customer',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONTACT_ENDED);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should handle CONTACT_ENDED gracefully when task is undefined', () => {
    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        interactionId: 'non-existent-task-id',
        interaction: {
          state: 'new',
        },
      },
    };
    // Should not throw error when task doesn't exist
    expect(() => {
      webSocketManagerMock.emit('message', JSON.stringify(payload));
    }).not.toThrow();
  });

  it('should remove OUTDIAL task from taskCollection on AGENT_CONTACT_ASSIGN_FAILED when NOT terminated (user-declined)', () => {
    const task = taskManager.getTask(taskId);
    Object.assign(task.data, {
      interaction: {
        ...task.data.interaction,
        outboundType: 'OUTDIAL',
        state: 'new',
        isTerminated: false,
      },
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {
          outboundType: 'OUTDIAL',
          state: 'new',
          isTerminated: false,
        },
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        reason: 'USER_DECLINED',
        reasonCode: 156,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskManager.getTask(taskId)).toBeUndefined();
    expect(removeTaskSpy).toHaveBeenCalled();
  });

  it('handle AGENT_OFFER_CONSULT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONSULT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.OFFER_CONSULT
    );
    expect(stateMachineEvent?.taskData).toEqual({...payload.data, isConsulted: true});
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_CONSULT_ACCEPTED event on AGENT_CONSULTING event', () => {
    const initialConsultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONSULT,
      },
    };

    const consultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULTING,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(initialConsultingPayload));
    webSocketManagerMock.emit('message', JSON.stringify(consultingPayload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONSULTING_ACTIVE
    );
    expect(stateMachineEvent?.taskData).toEqual(consultingPayload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_CONSULT_ENDED event on AGENT_CONSULT_ENDED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_ENDED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.getTask(taskId).data.isConsulted = true;
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONSULT_END
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_CONSULT_ENDED event and remove currentTask when on AGENT_CONSULT_ENDED event when requested for a consult', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_ENDED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    taskManager.getTask(taskId).data.isConsulted = true;
    const task = taskManager.getTask(taskId);

    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONSULT_END);
    expect(taskManager.getTask(taskId)).toBeUndefined(); // Ensure task is removed from the task collection after the consult ends
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_CANCELLED event on AGENT_CTQ_CANCELLED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CTQ_CANCELLED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CTQ_CANCEL
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should handle AGENT_CONSULT_FAILED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_FAILED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    // Always spy on the updated task object after CONTACT_RESERVED is emitted
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONSULT_FAILED
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_CONSULT_QUEUE_FAILED on AGENT_CTQ_CANCEL_FAILED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CTQ_CANCEL_FAILED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CTQ_CANCEL_FAILED
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_REJECT event on AGENT_CONTACT_OFFER_RONA event', () => {
    // First, emit AGENT_CONTACT_RESERVED to set up currentTask
    const reservedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(reservedPayload));

    const ronaPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_OFFER_RONA,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        reason: 'USER_REJECTED',
      },
    };

    taskManager.taskCollection[taskId] = taskManager.getTask(taskId);
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(ronaPayload));

    const stateMachineEvent = expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.RONA);
    expect(stateMachineEvent?.reason).toBe(ronaPayload.data.reason);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should emit TASK_REJECT event on AGENT_CONTACT_ASSIGN_FAILED event', () => {
    // First, emit AGENT_CONTACT_RESERVED to set up currentTask
    const reservedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(reservedPayload));

    const assignFailedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        reason: 'ASSIGN_FAILED',
      },
    };

    taskManager.taskCollection[taskId] = taskManager.getTask(taskId);
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(assignFailedPayload));

    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.ASSIGN_FAILED
    );
    expect(stateMachineEvent?.reason).toBe(assignFailedPayload.data.reason);
    sendStateMachineEventSpy.mockRestore();
  });

  it('should remove currentTask from taskCollection on AGENT_WRAPPEDUP event', () => {
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_WRAPPEDUP,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.WRAPUP_COMPLETE);
    sendStateMachineEventSpy.mockRestore();
    expect(taskManager.getTask(taskId)).toBeUndefined();
  });

  // case default
  it('should handle default case', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const payload = {
      data: {
        type: 'UNKNOWN_EVENT',
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = taskManager.getTask(taskId).updateTaskData as jest.Mock;
    taskUpdateTaskDataSpy.mockClear();
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).not.toHaveBeenCalled();
    expect(taskUpdateTaskDataSpy).not.toHaveBeenCalled();
  });

  it('should emit TASK_CONSULTING event when agent is consulting', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.getTask(taskId).data.isConsulted = false;
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');
    const consultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULTING,
        isConsulted: false,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(consultingPayload));
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONSULTING_ACTIVE);
    expect(taskManagerEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
      taskManager.getTask(taskId)
    );
    sendStateMachineEventSpy.mockRestore();
  });

  it('should update task data on AGENT_CONTACT_UNASSIGNED', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = task.sendStateMachineEvent as jest.Mock;
    sendStateMachineEventSpy.mockClear();
    const updateTaskDataSpy = task.updateTaskData as jest.Mock;
    updateTaskDataSpy.mockClear();
    const unassignedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_UNASSIGNED,
        agentId: initalPayload.data.agentId,
        eventTime: initalPayload.data.eventTime,
        eventType: initalPayload.data.eventType,
        interaction: {mediaType: 'telephony'},
        interactionId: initalPayload.data.interactionId,
        orgId: initalPayload.data.orgId,
        trackingId: initalPayload.data.trackingId,
        mediaResourceId: initalPayload.data.mediaResourceId,
        destAgentId: initalPayload.data.destAgentId,
        owner: initalPayload.data.owner,
        queueMgr: initalPayload.data.queueMgr,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(unassignedPayload));
    expect(sendStateMachineEventSpy).not.toHaveBeenCalled();
    expect(updateTaskDataSpy).toHaveBeenCalledWith(unassignedPayload.data);
  });

  it('preserves consult fields from state context during consulting payload refresh', () => {
    const task = createStateMachineTask({
      ...taskDataMock,
      interaction: {state: 'consulting'} as any,
      interactionId: taskId,
    });
    task.stateMachineService = {
      getSnapshot: () => ({
        value: 'CONSULTING',
        context: {
          consultDestinationAgentId: 'agent-preserved',
          consultDestinationType: 'agent',
        },
      }),
    };

    const incomingTaskData = {
      ...taskDataMock,
      interaction: {state: 'consulting'} as any,
      interactionId: taskId,
      destAgentId: null,
      destinationType: null,
    };

    (taskManager as any).updateTaskData(task, incomingTaskData);

    expect(task.updateTaskData).toHaveBeenCalledWith(
      expect.objectContaining({
        destAgentId: 'agent-preserved',
        destinationType: 'agent',
      })
    );
  });

  it('does not preserve stale consult fields once consult is no longer active', () => {
    const task = createStateMachineTask({
      ...taskDataMock,
      interaction: {state: 'connected'} as any,
      interactionId: taskId,
    });
    task.stateMachineService = {
      getSnapshot: () => ({
        value: 'CONNECTED',
        context: {
          consultDestinationAgentId: 'agent-stale',
          consultDestinationType: 'agent',
        },
      }),
    };

    const incomingTaskData = {
      ...taskDataMock,
      interaction: {state: 'connected'} as any,
      interactionId: taskId,
      destAgentId: null,
      destinationType: null,
    };

    (taskManager as any).updateTaskData(task, incomingTaskData);

    expect(task.updateTaskData).toHaveBeenCalledWith(
      expect.objectContaining({
        destAgentId: null,
        destinationType: null,
      })
    );
  });

  it('should handle chat interaction and emit TASK_INCOMING immediately', () => {
    // Setup chat payload with specific media type
    const chatPayload = {
      data: {
        ...initalPayload.data,
        interaction: {mediaType: 'chat'},
      },
    };

    // Simulate receiving a chat task
    webSocketManagerMock.emit('message', JSON.stringify(chatPayload));

    const chatTask = taskManager.getTask(chatPayload.data.interactionId);
    const sendStateMachineEventSpy = chatTask.sendStateMachineEvent as jest.Mock;
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.TASK_INCOMING
    );
    expect(stateMachineEvent?.taskData).toEqual(chatPayload.data);
    expect(taskManager.getAllTasks()).toHaveProperty(chatPayload.data.interactionId);
  });

  it('should handle email interaction and emit TASK_INCOMING immediately', () => {
    // Setup email payload
    const emailPayload = {
      data: {
        ...initalPayload.data,
        interaction: {mediaType: 'email'},
      },
    };

    // Simulate receiving an email task
    webSocketManagerMock.emit('message', JSON.stringify(emailPayload));

    const emailTask = taskManager.getTask(emailPayload.data.interactionId);
    const sendStateMachineEventSpy = emailTask.sendStateMachineEvent as jest.Mock;
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.TASK_INCOMING
    );
    expect(stateMachineEvent?.taskData).toEqual(emailPayload.data);
    expect(taskManager.getAllTasks()).toHaveProperty(emailPayload.data.interactionId);
  });

  it('should handle chat task lifecycle from reservation to assignment to end', () => {
    // 1. Chat task is reserved
    const chatReservedPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        interaction: {mediaType: 'chat'},
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(chatReservedPayload));
    const task = taskManager.getTask(chatReservedPayload.data.interactionId);
    const sendStateMachineEventSpy = task.sendStateMachineEvent as jest.Mock;

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.TASK_INCOMING);

    // 2. Chat task is assigned
    const chatAssignedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(chatAssignedPayload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.ASSIGN);

    // 3. Chat task is ended with state 'new' to trigger cleanup
    const chatEndedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'chat', state: 'new'}, // Change to 'new' state
        wrapUpRequired: false,
      },
    };

    // Simulate state on the task to allow cleanup logic
    task.data.interaction.state = 'new';
    webSocketManagerMock.emit('message', JSON.stringify(chatEndedPayload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONTACT_ENDED);
    // Verify task is removed since it was in a 'new' state
    expect(taskManager.getTask(chatReservedPayload.data.interactionId)).toBeUndefined();
  });

  it('should handle multiple tasks of different media types simultaneously', () => {
    // Setup telephony, chat and email payloads with different IDs
    const telephonyPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'telephony-task-id',
        interaction: {mediaType: 'telephony'},
      },
    };

    const chatPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'chat-task-id',
        interaction: {mediaType: 'chat'},
      },
    };

    const emailPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'email-task-id',
        interaction: {mediaType: 'email'},
      },
    };

    // Simulate receiving tasks of different types
    webSocketManagerMock.emit('message', JSON.stringify(telephonyPayload));
    webSocketManagerMock.emit('message', JSON.stringify(chatPayload));
    webSocketManagerMock.emit('message', JSON.stringify(emailPayload));

    // Verify all tasks are in the collection
    expect(taskManager.getAllTasks()).toHaveProperty(telephonyPayload.data.interactionId);
    expect(taskManager.getAllTasks()).toHaveProperty(chatPayload.data.interactionId);
    expect(taskManager.getAllTasks()).toHaveProperty(emailPayload.data.interactionId);

    // Verify the task media types are correctly set
    expect(
      taskManager.getTask(telephonyPayload.data.interactionId).data.interaction.mediaType
    ).toBe('telephony');
    expect(taskManager.getTask(chatPayload.data.interactionId).data.interaction.mediaType).toBe(
      'chat'
    );
    expect(taskManager.getTask(emailPayload.data.interactionId).data.interaction.mediaType).toBe(
      'email'
    );
  });

  it('should properly handle one task ending when multiple tasks are active', () => {
    // Create three tasks with different IDs and media types
    const task1Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-1',
        interaction: {mediaType: 'telephony'},
      },
    };

    const task2Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-2',
        interaction: {mediaType: 'chat'},
      },
    };

    const task3Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-3',
        interaction: {mediaType: 'email'},
      },
    };

    // Initialize all tasks
    webSocketManagerMock.emit('message', JSON.stringify(task1Payload));
    webSocketManagerMock.emit('message', JSON.stringify(task2Payload));
    webSocketManagerMock.emit('message', JSON.stringify(task3Payload));

    // Verify all tasks are in the collection
    expect(taskManager.getAllTasks()).toHaveProperty(task1Payload.data.interactionId);
    expect(taskManager.getAllTasks()).toHaveProperty(task2Payload.data.interactionId);
    expect(taskManager.getAllTasks()).toHaveProperty(task3Payload.data.interactionId);

    const task2 = taskManager.getTask(task2Payload.data.interactionId);
    const task2SendStateMachineEventSpy = task2.sendStateMachineEvent as jest.Mock;

    // End only the second task (chat task)
    const chatEndedPayload = {
      data: {
        ...task2Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'chat', state: 'new'}, // Using 'new' to trigger cleanup
        wrapUpRequired: false,
      },
    };

    task2.data.interaction.state = 'new';
    webSocketManagerMock.emit('message', JSON.stringify(chatEndedPayload));

    const firstEndEvent = expectLastStateMachineEvent(
      task2SendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(firstEndEvent?.taskData).toEqual(chatEndedPayload.data);

    // Verify task2 was removed from collection (since state was 'new')
    expect(taskManager.getTask(task2Payload.data.interactionId)).toBeUndefined();

    // Verify other tasks remain in the collection
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();

    // Store reference to task3 before we end it
    const task3 = taskManager.getTask(task3Payload.data.interactionId);
    const task3SendStateMachineEventSpy = task3.sendStateMachineEvent as jest.Mock;

    // Now end task3 with a state that doesn't trigger cleanup
    const emailEndedPayload = {
      data: {
        ...task3Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'email', state: 'connected'}, // Using 'connected' to NOT trigger cleanup
        wrapUpRequired: true,
        agentsPendingWrapUp: ['test-agent-id'],
      },
    };

    task3.data.interaction.state = 'connected';
    webSocketManagerMock.emit('message', JSON.stringify(emailEndedPayload));

    const secondEndEvent = expectLastStateMachineEvent(
      task3SendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(secondEndEvent?.taskData).toEqual(emailEndedPayload.data);

    // Verify task3 is still in collection (since state was 'connected')
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();

    // Verify task1 remains unaffected
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
  });

  it('should emit TRANSFER_SUCCESS event on AGENT_VTEAM_TRANSFERRED event', () => {
    // First create a task by emitting the initial payload
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

    const vteamTransferredPayload = {
      data: {
        type: CC_EVENTS.AGENT_VTEAM_TRANSFERRED,
        agentId: initalPayload.data.agentId,
        eventTime: initalPayload.data.eventTime,
        eventType: initalPayload.data.eventType,
        interaction: {},
        interactionId: initalPayload.data.interactionId,
        orgId: initalPayload.data.orgId,
        trackingId: initalPayload.data.trackingId,
        mediaResourceId: initalPayload.data.mediaResourceId,
        destAgentId: initalPayload.data.destAgentId,
        owner: initalPayload.data.owner,
        queueMgr: initalPayload.data.queueMgr,
      },
    };

    // No need to explicitly set the task in the collection as it's already there
    // from the initial message processing

    webSocketManagerMock.emit('message', JSON.stringify(vteamTransferredPayload));

    // Check that the state machine received the END event
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.TRANSFER_SUCCESS);
    sendStateMachineEventSpy.mockRestore();

    // The task should still exist in the collection based on current implementation
    expect(taskManager.getTask(taskId)).toBeDefined();
  });

  it('should update task data on AGENT_WRAPUP event', () => {
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_WRAPUP,
        interactionId: taskId,
        wrapUpRequired: true,
      },
    };
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(sendStateMachineEventSpy).toHaveBeenCalled();
    const stateMachineEvent = sendStateMachineEventSpy.mock.calls.at(-1)?.[0];
    expect(stateMachineEvent?.type).toBe(TaskEvent.TASK_WRAPUP);
    expect(stateMachineEvent?.taskData).toEqual({
      ...payload.data,
      wrapUpRequired: true,
    });
    sendStateMachineEventSpy.mockRestore();
  });

  it('should not attempt cleanup twice when AGENT_CONTACT_UNASSIGNED is followed by AGENT_WRAPUP', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const unregisterSpy = jest.spyOn(task, 'unregisterWebCallListeners');
    const cleanUpCallSpy = jest.spyOn(webCallingService, 'cleanUpCall');
    const unassignedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_UNASSIGNED,
        agentId: initalPayload.data.agentId,
        interaction: {mediaType: 'telephony'},
        interactionId: initalPayload.data.interactionId,
        orgId: initalPayload.data.orgId,
        trackingId: initalPayload.data.trackingId,
        mediaResourceId: initalPayload.data.mediaResourceId,
        destAgentId: initalPayload.data.destAgentId,
        owner: initalPayload.data.owner,
        queueMgr: initalPayload.data.queueMgr,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(unassignedPayload));
    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(cleanUpCallSpy).not.toHaveBeenCalled();
    unregisterSpy.mockClear();
    cleanUpCallSpy.mockClear();
    const wrapupPayload = {
      data: {
        type: CC_EVENTS.AGENT_WRAPUP,
        interactionId: taskId,
        interaction: {mediaType: 'telephony'},
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));
    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(cleanUpCallSpy).not.toHaveBeenCalled();
  });

  it('should not attempt cleanup when AGENT_VTEAM_TRANSFERRED is followed by AGENT_WRAPUP', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const task = taskManager.getTask(taskId);
    const unregisterSpy = jest.spyOn(task, 'unregisterWebCallListeners');
    const cleanUpCallSpy = jest.spyOn(webCallingService, 'cleanUpCall');
    const transferredPayload = {
      data: {
        type: CC_EVENTS.AGENT_VTEAM_TRANSFERRED,
        agentId: initalPayload.data.agentId,
        interaction: {mediaType: 'telephony'},
        interactionId: initalPayload.data.interactionId,
        orgId: initalPayload.data.orgId,
        trackingId: initalPayload.data.trackingId,
        mediaResourceId: initalPayload.data.mediaResourceId,
        destAgentId: initalPayload.data.destAgentId,
        owner: initalPayload.data.owner,
        queueMgr: initalPayload.data.queueMgr,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(transferredPayload));
    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(cleanUpCallSpy).not.toHaveBeenCalled();
    unregisterSpy.mockClear();
    cleanUpCallSpy.mockClear();
    const wrapupPayload = {
      data: {
        type: CC_EVENTS.AGENT_WRAPUP,
        interactionId: taskId,
        interaction: {mediaType: 'telephony'},
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));
    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(cleanUpCallSpy).not.toHaveBeenCalled();
  });

  describe('should emit appropriate task events for recording events', () => {
    const eventMap: Record<string, TaskEvent | null> = {
      STARTED: TaskEvent.RECORDING_STARTED,
      PAUSED: TaskEvent.PAUSE_RECORDING,
      PAUSE_FAILED: null,
      RESUMED: TaskEvent.RESUME_RECORDING,
      RESUME_FAILED: null,
    };

    ['STARTED', 'PAUSED', 'PAUSE_FAILED', 'RESUMED', 'RESUME_FAILED'].forEach((suffix) => {
      const ccEvent = CC_EVENTS[`CONTACT_RECORDING_${suffix}`];
      const expectedTaskEvent = eventMap[suffix];
      it(`should ${expectedTaskEvent ? 'send' : 'not send'} ${
        expectedTaskEvent ?? 'a'
      } state machine event on ${ccEvent} event`, () => {
        const payload = {data: {...initalPayload.data, type: ccEvent}};
        webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
        const task = taskManager.getTask(taskId);
        const sendStateMachineEventSpy = task.sendStateMachineEvent as jest.Mock;
        sendStateMachineEventSpy.mockClear();

        webSocketManagerMock.emit('message', JSON.stringify(payload));
        if (expectedTaskEvent) {
          const stateMachineEvent = expectLastStateMachineEvent(
            sendStateMachineEventSpy,
            expectedTaskEvent
          );
          expect(stateMachineEvent?.taskData).toEqual(payload.data);
        } else {
          expect(sendStateMachineEventSpy).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('Contact owner propagation', () => {
    const currentAgentId = 'test-agent-id';
    const previousOwnerId = 'previous-owner-id';
    const promotedOwnerId = 'promoted-owner-id';

    const createConferenceTaskData = (
      interactionId: string,
      owner: string,
      mainInteractionId = taskId
    ) => ({
      ...taskDataMock,
      agentId: currentAgentId,
      interactionId,
      owner,
      interaction: {
        mediaType: 'telephony',
        interactionId,
        mainInteractionId,
        owner,
        participants: {
          [currentAgentId]: {
            id: currentAgentId,
            pType: 'Agent',
            hasJoined: true,
            hasLeft: false,
          },
          [previousOwnerId]: {
            id: previousOwnerId,
            pType: 'Agent',
            hasJoined: true,
            hasLeft: false,
          },
          [promotedOwnerId]: {
            id: promotedOwnerId,
            pType: 'Agent',
            hasJoined: true,
            hasLeft: false,
          },
        },
        media: {
          [mainInteractionId]: {
            mediaResourceId: mainInteractionId,
            mediaType: 'telephony',
            mType: 'mainCall',
            participants: [currentAgentId, previousOwnerId, promotedOwnerId],
          },
        },
      },
    });

    const installTask = (data) => {
      const task = createMockTask(data);
      taskManager.taskCollection = {[data.interactionId]: task};
      (taskManager as any).setupTaskListeners(task);

      return task;
    };

    const createPromotedAgentOwnerChangeData = (
      interactionId = 'promoted-child-interaction-id',
      mainInteractionId = taskId
    ) => {
      const data = createConferenceTaskData(interactionId, currentAgentId, mainInteractionId);

      data.interaction.state = 'conference';

      return {...data, type: CC_EVENTS.CONTACT_OWNER_CHANGED};
    };

    const clearTasksAndFactoryHistory = () => {
      taskManager.taskCollection = {};
      (TaskFactory.createTask as jest.Mock).mockClear();
    };

    it('emits one hydrate when ContactUpdated changes interaction.owner', () => {
      const task = installTask(createConferenceTaskData(taskId, previousOwnerId));
      const hydrateHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, promotedOwnerId),
            type: CC_EVENTS.CONTACT_UPDATED,
          },
        })
      );

      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
      expect(task.data.interaction.owner).toBe(promotedOwnerId);
      expect(hydrateHandler).toHaveBeenCalledTimes(1);
      expect(hydrateHandler).toHaveBeenCalledWith(task);
    });

    it.each([
      ['the same owner', previousOwnerId],
      ['no owner', undefined],
      ['a blank owner', '   '],
    ])('keeps ContactUpdated data-only when it carries %s', (_description, owner) => {
      const task = installTask(createConferenceTaskData(taskId, previousOwnerId));
      const hydrateHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);
      const interaction = createConferenceTaskData(taskId, previousOwnerId).interaction;
      if (owner === undefined) {
        delete interaction.owner;
      } else {
        interaction.owner = owner;
      }

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, previousOwnerId),
            type: CC_EVENTS.CONTACT_UPDATED,
            interaction,
          },
        })
      );

      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_UPDATED);
      expect(hydrateHandler).not.toHaveBeenCalled();
    });

    it('correlates child-keyed ContactOwnerChanged and keeps the main task identity', () => {
      const childTaskId = 'surviving-child-id';
      const promotedChildId = 'promoted-child-id';
      const task = installTask(
        createConferenceTaskData(childTaskId, previousOwnerId, taskId)
      );
      const hydrateHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);

      const ownerChangeData = createConferenceTaskData(
        promotedChildId,
        promotedOwnerId,
        taskId
      );
      ownerChangeData.interaction.interactionId = taskId;
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {...ownerChangeData, type: CC_EVENTS.CONTACT_OWNER_CHANGED},
        })
      );

      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
      expect(task.data.interactionId).toBe(taskId);
      expect(task.data.interaction.owner).toBe(promotedOwnerId);
      expect(taskManager.taskCollection[childTaskId]).toBeUndefined();
      expect(taskManager.taskCollection[promotedChildId]).toBeUndefined();
      expect(taskManager.taskCollection[taskId]).toBe(task);
      expect(Object.values(taskManager.taskCollection).filter((entry) => entry === task)).toHaveLength(
        1
      );
      expect(hydrateHandler).toHaveBeenCalledTimes(1);
    });

    it('uses the incoming promotion snapshot to correlate a stale child-keyed task', () => {
      const childTaskId = 'stale-child-interaction-id';
      const staleTaskData = createConferenceTaskData(childTaskId, previousOwnerId, taskId);
      staleTaskData.interaction.media = {
        [childTaskId]: {
          mediaResourceId: childTaskId,
          mediaType: 'telephony',
          mType: 'consult',
          participants: [currentAgentId, promotedOwnerId],
        },
      };
      const task = installTask(staleTaskData);
      const hydrateHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({data: createPromotedAgentOwnerChangeData()})
      );

      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
      expect(task.data.interaction.owner).toBe(currentAgentId);
      expect(taskManager.taskCollection[childTaskId]).toBeUndefined();
      expect(taskManager.taskCollection[taskId]).toBe(task);
      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(hydrateHandler).toHaveBeenCalledTimes(1);
    });

    it('reuses a task stored under the incoming main-call media key', () => {
      const mainMediaInteractionId = 'main-media-interaction-id';
      const promotedChildId = 'promoted-child-without-main-id';
      const task = installTask(
        createConferenceTaskData(
          mainMediaInteractionId,
          previousOwnerId,
          mainMediaInteractionId
        )
      );
      const hydrateHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);
      const ownerChangeData = createPromotedAgentOwnerChangeData(
        promotedChildId,
        mainMediaInteractionId
      );
      delete ownerChangeData.interaction.mainInteractionId;

      webSocketManagerMock.emit('message', JSON.stringify({data: ownerChangeData}));

      expect(task.sendStateMachineEvent).toHaveBeenCalledTimes(1);
      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(taskManager.taskCollection[mainMediaInteractionId]).toBe(task);
      expect(taskManager.taskCollection[promotedChildId]).toBeUndefined();
      expect(Object.values(taskManager.taskCollection)).toEqual([task]);
      expect(task.listenerCount(TASK_EVENTS.TASK_HYDRATE)).toBe(1);
      expect(hydrateHandler).toHaveBeenCalledTimes(1);
      expect(hydrateHandler).toHaveBeenCalledWith(task);
    });

    it('prefers the exact task for ContactOwnerChanged over related child tasks', () => {
      const exactTask = installTask(createConferenceTaskData(taskId, previousOwnerId));
      const childTaskId = 'related-child-id';
      const childTask = createMockTask(
        createConferenceTaskData(childTaskId, previousOwnerId, taskId)
      );
      taskManager.taskCollection[childTaskId] = childTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, promotedOwnerId),
            type: CC_EVENTS.CONTACT_OWNER_CHANGED,
          },
        })
      );

      expectLastStateMachineEvent(exactTask.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
      expect(childTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('ignores a related ContactOwnerChanged task whose current agent is consult-only', () => {
      const childTaskId = 'consult-only-child-id';
      const data = createConferenceTaskData(childTaskId, previousOwnerId, taskId);
      data.interaction.media[taskId].participants = [previousOwnerId, promotedOwnerId];
      data.interaction.media[childTaskId] = {
        mediaResourceId: childTaskId,
        mediaType: 'telephony',
        mType: 'consult',
        participants: [currentAgentId, promotedOwnerId],
      };
      const task = installTask(data);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData('unmatched-child-id', promotedOwnerId, taskId),
            type: CC_EVENTS.CONTACT_OWNER_CHANGED,
          },
        })
      );

      expect(task.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(taskManager.taskCollection[childTaskId]).toBe(task);
      expect(TaskFactory.createTask).not.toHaveBeenCalled();
    });

    it.each([
      [
        'the current agent is marked departed',
        (data) => {
          data.interaction.participants[currentAgentId].hasLeft = true;
        },
      ],
      [
        'the current agent participant is missing',
        (data) => {
          delete data.interaction.participants[currentAgentId];
        },
      ],
      [
        'the current agent is present only on a consult leg',
        (data) => {
          data.interaction.media[taskId].mType = 'consult';
        },
      ],
    ])('does not recover a promoted task when %s', (_description, mutatePayload) => {
      clearTasksAndFactoryHistory();
      const ownerChangeData = createPromotedAgentOwnerChangeData();
      mutatePayload(ownerChangeData);

      webSocketManagerMock.emit('message', JSON.stringify({data: ownerChangeData}));

      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(taskManager.getAllTasks()).toEqual({});
    });

    it('ignores ambiguous active main-call matches for ContactOwnerChanged', () => {
      const firstTask = createMockTask(
        createConferenceTaskData('first-child-id', previousOwnerId, taskId)
      );
      const secondTask = createMockTask(
        createConferenceTaskData('second-child-id', previousOwnerId, taskId)
      );
      taskManager.taskCollection = {
        'first-child-id': firstTask,
        'second-child-id': secondTask,
      };

      const ownerChangeData = createConferenceTaskData(
        'unmatched-child-id',
        promotedOwnerId,
        taskId
      );
      ownerChangeData.interaction.interactionId = 'unmatched-child-id';
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {...ownerChangeData, type: CC_EVENTS.CONTACT_OWNER_CHANGED},
        })
      );

      expect(firstTask.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(secondTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('does not recover a new task when multiple stale related tasks become eligible from the payload', () => {
      const createStaleRelatedTask = (interactionId: string) => {
        const data = createConferenceTaskData(interactionId, previousOwnerId, taskId);
        data.interaction.media[taskId].participants = [previousOwnerId, promotedOwnerId];

        return createMockTask(data);
      };
      const firstTask = createStaleRelatedTask('first-stale-child-id');
      const secondTask = createStaleRelatedTask('second-stale-child-id');
      taskManager.taskCollection = {
        'first-stale-child-id': firstTask,
        'second-stale-child-id': secondTask,
      };
      (TaskFactory.createTask as jest.Mock).mockClear();

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({data: createPromotedAgentOwnerChangeData()})
      );

      expect(firstTask.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(secondTask.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(Object.keys(taskManager.taskCollection)).toEqual([
        'first-stale-child-id',
        'second-stale-child-id',
      ]);
    });

    it('ignores ContactOwnerChanged when different direct nested IDs match active tasks', () => {
      const firstTaskId = 'direct-main-id';
      const secondTaskId = 'direct-parent-id';
      const firstTask = createMockTask(
        createConferenceTaskData(firstTaskId, previousOwnerId, firstTaskId)
      );
      const secondTask = createMockTask(
        createConferenceTaskData(secondTaskId, previousOwnerId, secondTaskId)
      );
      taskManager.taskCollection = {
        [firstTaskId]: firstTask,
        [secondTaskId]: secondTask,
      };

      const ownerChangeData = createConferenceTaskData(
        'unmatched-child-id',
        promotedOwnerId,
        firstTaskId
      );
      ownerChangeData.interaction.interactionId = secondTaskId;
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {...ownerChangeData, type: CC_EVENTS.CONTACT_OWNER_CHANGED},
        })
      );

      expect(firstTask.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(secondTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('ignores ContactOwnerChanged without an interaction correlation identifier', () => {
      const task = installTask(createConferenceTaskData(taskId, previousOwnerId));

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.CONTACT_OWNER_CHANGED,
            interaction: {owner: promotedOwnerId},
          },
        })
      );

      expect(task.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('recovers a missing promoted-agent task under the main interaction and emits one hydrate', () => {
      clearTasksAndFactoryHistory();
      const hydrateHandler = jest.fn();
      const incomingHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);
      taskManager.on(TASK_EVENTS.TASK_INCOMING, incomingHandler);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({data: createPromotedAgentOwnerChangeData()})
      );

      expect(TaskFactory.createTask).toHaveBeenCalledTimes(1);
      expect(TaskFactory.createTask).toHaveBeenCalledWith(
        contactMock,
        webCallingService,
        expect.objectContaining({
          interactionId: taskId,
          isAutoAnswering: false,
          isConsulted: false,
          isConferenceInProgress: true,
          wrapUpRequired: false,
        }),
        undefined,
        undefined,
        currentAgentId,
        undefined,
        undefined
      );

      const recoveredTask = (TaskFactory.createTask as jest.Mock).mock.results[0].value;
      expectTaskConfiguredForAISummary(recoveredTask);
      expect(recoveredTask.sendStateMachineEvent).toHaveBeenCalledTimes(2);
      expect(recoveredTask.sendStateMachineEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: TaskEvent.HYDRATE,
          agentId: currentAgentId,
          taskData: expect.objectContaining({interactionId: taskId}),
        })
      );
      expect(recoveredTask.sendStateMachineEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: TaskEvent.CONTACT_OWNER_CHANGED,
          taskData: expect.objectContaining({interactionId: taskId}),
        })
      );
      expect(taskManager.taskCollection[taskId]).toBe(recoveredTask);
      expect(taskManager.taskCollection['promoted-child-interaction-id']).toBeUndefined();
      expect(Object.values(taskManager.taskCollection)).toEqual([recoveredTask]);
      expect(recoveredTask.data.interaction.owner).toBe(currentAgentId);
      expect(hydrateHandler).toHaveBeenCalledTimes(1);
      expect(hydrateHandler).toHaveBeenCalledWith(recoveredTask);
      expect(incomingHandler).not.toHaveBeenCalled();
    });

    it.each([
      [
        'another agent owns the interaction',
        (data) => {
          data.interaction.owner = promotedOwnerId;
          data.owner = promotedOwnerId;
        },
      ],
      [
        'the payload has no main-call media',
        (data) => {
          data.interaction.media = {};
        },
      ],
      [
        'the interaction is explicitly terminated',
        (data) => {
          data.interaction.isTerminated = true;
        },
      ],
    ])('does not create a missing task when %s', (_description, mutatePayload) => {
      clearTasksAndFactoryHistory();
      const ownerChangeData = createPromotedAgentOwnerChangeData();
      mutatePayload(ownerChangeData);

      webSocketManagerMock.emit('message', JSON.stringify({data: ownerChangeData}));

      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(taskManager.getAllTasks()).toEqual({});
    });

    it('does not create a missing task for an owner-changing ContactUpdated event', () => {
      clearTasksAndFactoryHistory();
      const contactUpdatedData = {
        ...createPromotedAgentOwnerChangeData(),
        type: CC_EVENTS.CONTACT_UPDATED,
      };

      webSocketManagerMock.emit('message', JSON.stringify({data: contactUpdatedData}));

      expect(TaskFactory.createTask).not.toHaveBeenCalled();
      expect(taskManager.getAllTasks()).toEqual({});
    });

    it('reuses a recovered task for later AgentContact and ContactMerged events', () => {
      clearTasksAndFactoryHistory();
      const hydrateHandler = jest.fn();
      const mergedHandler = jest.fn();
      taskManager.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);
      taskManager.on(TASK_EVENTS.TASK_MERGED, mergedHandler);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({data: createPromotedAgentOwnerChangeData()})
      );

      const recoveredTask = taskManager.taskCollection[taskId];
      expect(recoveredTask).toBeDefined();
      expect(recoveredTask.listenerCount(TASK_EVENTS.TASK_HYDRATE)).toBe(1);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, currentAgentId),
            type: CC_EVENTS.AGENT_CONTACT,
          },
        })
      );
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, currentAgentId),
            type: CC_EVENTS.CONTACT_MERGED,
            childInteractionId: 'promoted-child-interaction-id',
          },
        })
      );

      expect(TaskFactory.createTask).toHaveBeenCalledTimes(1);
      expect(taskManager.taskCollection[taskId]).toBe(recoveredTask);
      expect(taskManager.taskCollection['promoted-child-interaction-id']).toBeUndefined();
      expect(Object.values(taskManager.taskCollection)).toEqual([recoveredTask]);
      expect(recoveredTask.listenerCount(TASK_EVENTS.TASK_HYDRATE)).toBe(1);
      expect(hydrateHandler).toHaveBeenCalledTimes(2);
      expect(mergedHandler).toHaveBeenCalledTimes(1);
      expect(mergedHandler).toHaveBeenCalledWith(recoveredTask);
    });

    it('does not let a late ParticipantLeftConference restore a departed owner', () => {
      const task = installTask(createConferenceTaskData(taskId, previousOwnerId));

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, promotedOwnerId),
            type: CC_EVENTS.CONTACT_UPDATED,
          },
        })
      );

      const participantLeftData = createConferenceTaskData(taskId, previousOwnerId);
      participantLeftData.participantId = previousOwnerId;
      participantLeftData.interaction.participants[previousOwnerId].hasLeft = true;
      participantLeftData.interaction.media[taskId].participants = [
        currentAgentId,
        promotedOwnerId,
      ];
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {...participantLeftData, type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE},
        })
      );

      const participantLeaveEvent = expectLastStateMachineEvent(
        task.sendStateMachineEvent,
        TaskEvent.PARTICIPANT_LEAVE
      );
      expect(participantLeaveEvent.taskData.interaction.owner).toBe(promotedOwnerId);
      expect(task.data.interaction.owner).toBe(promotedOwnerId);
    });

    it('does not infer that an incoming owner departed from a partial main-call roster', () => {
      const task = installTask(createConferenceTaskData(taskId, promotedOwnerId));
      const partialParticipantLeftData = createConferenceTaskData(taskId, previousOwnerId);
      partialParticipantLeftData.participantId = 'another-agent-id';
      partialParticipantLeftData.interaction.media[taskId].participants = [
        currentAgentId,
        promotedOwnerId,
      ];

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...partialParticipantLeftData,
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
          },
        })
      );

      const participantLeaveEvent = expectLastStateMachineEvent(
        task.sendStateMachineEvent,
        TaskEvent.PARTICIPANT_LEAVE
      );
      expect(participantLeaveEvent.taskData.interaction.owner).toBe(previousOwnerId);
      expect(task.data.interaction.owner).toBe(previousOwnerId);
    });

    it('applies the promoted owner when ParticipantLeftConference arrives first', () => {
      const task = installTask(createConferenceTaskData(taskId, previousOwnerId));
      const participantLeftData = createConferenceTaskData(taskId, previousOwnerId);
      participantLeftData.participantId = previousOwnerId;
      participantLeftData.interaction.participants[previousOwnerId].hasLeft = true;
      participantLeftData.interaction.media[taskId].participants = [
        currentAgentId,
        promotedOwnerId,
      ];

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {...participantLeftData, type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE},
        })
      );
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            ...createConferenceTaskData(taskId, promotedOwnerId),
            type: CC_EVENTS.CONTACT_UPDATED,
          },
        })
      );

      expect(task.data.interaction.owner).toBe(promotedOwnerId);
      expectLastStateMachineEvent(task.sendStateMachineEvent, TaskEvent.CONTACT_OWNER_CHANGED);
    });
  });

  describe('Conference event handling', () => {
    let task;

    beforeEach(() => {
      task = {
        data: {interactionId: taskId},
        emit: jest.fn(),
        updateTaskData: jest.fn(),
        sendStateMachineEvent: jest.fn(),
      };
      taskManager.taskCollection[taskId] = task as any;
    });

    it('sends AGENT_CONSULT_CONFERENCED to state machine as CONFERENCE_START', () => {
      const payload = {
        data: {type: CC_EVENTS.AGENT_CONSULT_CONFERENCED, interactionId: taskId},
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      const call = task.sendStateMachineEvent.mock.calls[0][0];
      expect(call.type).toBe(TaskEvent.CONFERENCE_START);
    });

    it('sends PARTICIPANT_JOINED_CONFERENCE to state machine as CONFERENCE_START', () => {
      const payload = {
        data: {type: CC_EVENTS.PARTICIPANT_JOINED_CONFERENCE, interactionId: taskId},
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      const call = task.sendStateMachineEvent.mock.calls[0][0];
      expect(call.type).toBe(TaskEvent.CONFERENCE_START);
    });

    it('sends AGENT_CONSULT_CONFERENCE_FAILED to state machine as CONFERENCE_FAILED', () => {
      const payload = {
        data: {type: CC_EVENTS.AGENT_CONSULT_CONFERENCE_FAILED, interactionId: taskId},
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      const call = task.sendStateMachineEvent.mock.calls[0][0];
      expect(call.type).toBe(TaskEvent.CONFERENCE_FAILED);
    });

    it('sends PARTICIPANT_LEFT_CONFERENCE to state machine as PARTICIPANT_LEAVE', () => {
      const payload = {
        data: {type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE, interactionId: taskId},
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      const call = task.sendStateMachineEvent.mock.calls[0][0];
      expect(call.type).toBe(TaskEvent.PARTICIPANT_LEAVE);
    });

    it('routes participant-left from a main interaction to a child-keyed task', () => {
      const childTaskId = 'child-interaction-id';
      const childTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: childTaskId,
        isConsulted: true,
        interaction: {
          mediaType: 'telephony',
          interactionId: childTaskId,
          parentInteractionId: taskId,
        },
      });
      delete taskManager.taskCollection[taskId];
      taskManager.taskCollection[childTaskId] = childTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            participantId: 'test-agent-id',
            interaction: {
              mediaType: 'telephony',
              interactionId: taskId,
              mainInteractionId: taskId,
            },
          },
        })
      );

      expect(childTask.sendStateMachineEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEvent.PARTICIPANT_LEAVE,
          participantId: 'test-agent-id',
        })
      );
      expect(taskManager.taskCollection[childTaskId]).toBeUndefined();
      expect(taskManager.taskCollection[taskId]).toBe(childTask);
      expect(
        Object.values(taskManager.taskCollection).filter((entry) => entry === childTask)
      ).toHaveLength(1);
    });

    it('routes consult-end from a main interaction to a child-keyed consulted task', () => {
      const childTaskId = 'consult-child-interaction-id';
      const childTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: childTaskId,
        isConsulted: true,
        interaction: {
          mediaType: 'telephony',
          interactionId: childTaskId,
          callProcessingDetails: {parentInteractionId: taskId},
        },
      });
      delete taskManager.taskCollection[taskId];
      taskManager.taskCollection[childTaskId] = childTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.AGENT_CONSULT_ENDED,
            interactionId: taskId,
            interaction: {
              mediaType: 'telephony',
              interactionId: taskId,
              mainInteractionId: taskId,
            },
          },
        })
      );

      expect(childTask.sendStateMachineEvent).toHaveBeenCalledWith(
        expect.objectContaining({type: TaskEvent.CONSULT_END})
      );
    });

    it('deduplicates aliases of the same child task during related-interaction lookup', () => {
      const childTaskId = 'aliased-child-interaction-id';
      const childTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: childTaskId,
        interaction: {
          mediaType: 'telephony',
          interactionId: childTaskId,
          mainInteractionId: taskId,
        },
      });
      delete taskManager.taskCollection[taskId];
      taskManager.taskCollection[childTaskId] = childTask;
      taskManager.taskCollection['child-task-alias'] = childTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            participantId: 'test-agent-id',
          },
        })
      );

      expect(childTask.sendStateMachineEvent).toHaveBeenCalledTimes(1);
      expect(
        Object.values(taskManager.taskCollection).filter((entry) => entry === childTask)
      ).toHaveLength(1);
    });

    it('prefers an exact task match over a child task with the same main interaction', () => {
      const childTaskId = 'child-interaction-id';
      const childTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: childTaskId,
        interaction: {
          mediaType: 'telephony',
          interactionId: childTaskId,
          mainInteractionId: taskId,
        },
      });
      taskManager.taskCollection[childTaskId] = childTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            participantId: 'another-agent',
          },
        })
      );

      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      expect(childTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('does not route a main-interaction event when multiple unique child tasks match', () => {
      delete taskManager.taskCollection[taskId];
      const createChildTask = (interactionId: string) =>
        createStateMachineTask({
          ...taskDataMock,
          interactionId,
          interaction: {
            mediaType: 'telephony',
            interactionId,
            mainInteractionId: taskId,
          },
        });
      const firstChildTask = createChildTask('child-1');
      const secondChildTask = createChildTask('child-2');
      taskManager.taskCollection['child-1'] = firstChildTask;
      taskManager.taskCollection['child-2'] = secondChildTask;

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
          },
        })
      );

      expect(firstChildTask.sendStateMachineEvent).not.toHaveBeenCalled();
      expect(secondChildTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('does not route a lifecycle event without a correlation identifier', () => {
      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            participantId: 'another-agent',
          },
        })
      );

      expect(task.sendStateMachineEvent).not.toHaveBeenCalled();
    });

    it('removes every collection alias for a task during terminal cleanup', () => {
      taskManager.taskCollection['task-alias'] = task;

      (taskManager as any).removeTaskFromCollection(task);

      expect(taskManager.taskCollection[taskId]).toBeUndefined();
      expect(taskManager.taskCollection['task-alias']).toBeUndefined();
    });

    it('replaces an EP-DN child task with a hydrated main task on CONTACT_MERGED', () => {
      const childTaskId = 'ep-dn-child-interaction-id';
      const childTask = createStateMachineTask({
        ...taskDataMock,
        interactionId: childTaskId,
        interaction: {
          mediaType: 'telephony',
          interactionId: childTaskId,
          parentInteractionId: taskId,
        },
      });
      const mergedHandler = jest.fn();
      delete taskManager.taskCollection[taskId];
      taskManager.taskCollection[childTaskId] = childTask;
      taskManager.on(TASK_EVENTS.TASK_MERGED, mergedHandler);

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.CONTACT_MERGED,
            interactionId: taskId,
            childInteractionId: childTaskId,
            interaction: {
              mediaType: 'telephony',
              interactionId: taskId,
              mainInteractionId: taskId,
              state: 'conference',
              owner: 'test-agent-id',
              participants: {
                'test-agent-id': {id: 'test-agent-id', pType: 'Agent', hasLeft: false},
              },
              media: {
                [taskId]: {
                  mediaResourceId: taskId,
                  mediaType: 'telephony',
                  mType: 'mainCall',
                  participants: ['test-agent-id'],
                },
              },
            },
          },
        })
      );

      const mainTask = taskManager.taskCollection[taskId];
      expect(taskManager.taskCollection[childTaskId]).toBeUndefined();
      expect(mainTask).toBeDefined();
      expect(mainTask).not.toBe(childTask);
      expect(mainTask.sendStateMachineEvent).toHaveBeenCalledWith(
        expect.objectContaining({type: TaskEvent.HYDRATE})
      );
      expect(mergedHandler).toHaveBeenCalledWith(mainTask);
    });

    it('handles AGENT_CONSULT_CONFERENCING event without errors', () => {
      const payload = {
        data: {type: CC_EVENTS.AGENT_CONSULT_CONFERENCING, interactionId: taskId},
      };
      expect(() => {
        webSocketManagerMock.emit('message', JSON.stringify(payload));
      }).not.toThrow();
    });

    it('handles PARTICIPANT_LEFT_CONFERENCE_FAILED event without errors', () => {
      const payload = {
        data: {type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE_FAILED, interactionId: taskId},
      };
      expect(() => {
        webSocketManagerMock.emit('message', JSON.stringify(payload));
      }).not.toThrow();
    });

    it('only routes conference events to matching tasks', () => {
      const otherTaskId = 'other-task-id';
      const otherTask: any = {
        data: {interactionId: otherTaskId},
        emit: jest.fn(),
        updateTaskData: jest.fn(),
        sendStateMachineEvent: jest.fn(),
      };
      taskManager.taskCollection[otherTaskId] = otherTask;

      const payload = {
        data: {type: CC_EVENTS.AGENT_CONSULT_CONFERENCED, interactionId: taskId},
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      expect(otherTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });
  });

  describe('state machine integration', () => {
    it('maps the complete contact-center lifecycle event surface', () => {
      const mapEvent = (TaskManager as any).mapEventToTaskStateMachineEvent.bind(TaskManager);
      const payload = {
        ...taskDataMock,
        participantId: 'participant-1',
        reason: 'test-reason',
        agentsPendingWrapUp: ['agent-1'],
      } as any;

      Object.values(CC_EVENTS).forEach((eventType) => {
        mapEvent(eventType, payload, 'agent-1');
      });

      expect(
        mapEvent(
          CC_EVENTS.AGENT_CONTACT_RESERVED,
          {
            ...payload,
            interaction: {...payload.interaction, outboundType: 'STANDARD_PREVIEW_CAMPAIGN'},
          },
          'agent-1'
        )
      ).toMatchObject({isCampaignReservationAccept: true});
      expect(
        mapEvent(
          CC_EVENTS.AGENT_CONTACT_HELD,
          {
            ...payload,
            mediaResourceId: undefined,
            interaction: {
              ...payload.interaction,
              media: {
                [payload.interactionId]: {mediaResourceId: 'fallback-media-resource'},
              },
            },
          },
          'agent-1'
        )
      ).toMatchObject({mediaResourceId: 'fallback-media-resource'});
      expect(
        mapEvent(
          CC_EVENTS.CONTACT_ENDED,
          {...payload, agentsPendingWrapUp: undefined},
          'agent-1'
        ).taskData.wrapUpRequired
      ).toBe(false);
      expect(mapEvent('UNMAPPED_EVENT', payload, 'agent-1')).toBeNull();
    });

    it('maps CC events to task state machine events using normalized payload', () => {
      const mapped = (TaskManager as any).mapEventToTaskStateMachineEvent(
        CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        {...taskDataMock, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED}
      );

      expect(mapped).toEqual({
        type: TaskEvent.ASSIGN,
        taskData: {...taskDataMock, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED},
      });
    });

    it('sends mapped events to the task state machine service', () => {
      const payload = {...taskDataMock, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED};
      const task = taskManager.getTask(taskId);
      const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');

      webSocketManagerMock.emit('message', JSON.stringify({data: payload}));

      expect(sendStateMachineEventSpy).toHaveBeenCalledWith({
        type: TaskEvent.ASSIGN,
        taskData: payload,
      });

      sendStateMachineEventSpy.mockRestore();
    });
  });

  describe('applyEnableWxBetterTogether', () => {
    it('updates config flags and propagates to active tasks', () => {
      const taskOne = {setEnableWxBetterTogether: jest.fn()};
      const taskTwo = {setEnableWxBetterTogether: jest.fn()};

      taskManager.setConfigFlags({
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        enableWxBetterTogether: true,
      });
      taskManager['taskCollection'] = {
        [taskId]: taskOne,
        'task-2': taskTwo,
      };

      taskManager.applyEnableWxBetterTogether(false);

      expect(taskManager['configFlags']?.enableWxBetterTogether).toBe(false);
      expect(taskOne.setEnableWxBetterTogether).toHaveBeenCalledWith(false);
      expect(taskTwo.setEnableWxBetterTogether).toHaveBeenCalledWith(false);
    });
  });

  describe('applyWxAppMuteStateFromSync', () => {
    it('propagates mute state to all tasks', () => {
      const taskOne = {applyWxAppMuteStateFromSync: jest.fn()};
      const taskTwo = {applyWxAppMuteStateFromSync: jest.fn()};

      taskManager['taskCollection'] = {
        [taskId]: taskOne,
        'task-2': taskTwo,
      };

      taskManager.applyWxAppMuteStateFromSync('call-1', true);

      expect(taskOne.applyWxAppMuteStateFromSync).toHaveBeenCalledWith('call-1', true);
      expect(taskTwo.applyWxAppMuteStateFromSync).toHaveBeenCalledWith('call-1', true);
    });
  });
});
