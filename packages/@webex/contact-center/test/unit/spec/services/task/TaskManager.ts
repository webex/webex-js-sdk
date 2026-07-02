import 'jsdom-global/register';
import EventEmitter from 'events';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import {CALL_EVENT_KEYS, CallingClientConfig, LINE_EVENTS} from '@webex/calling';
import {CC_AGENT_EVENTS, CC_EVENTS} from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact';
import Task from '../../../../../src/services/task/Task';
import {TASK_EVENTS} from '../../../../../src/services/task/types';
import {TaskEvent} from '../../../../../src/services/task/state-machine';
import WebRTC from '../../../../../src/services/task/voice/WebRTC';
import {Profile} from '../../../../../src/services/config/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import config from '../../../../../src/config';
import {CC_TASK_EVENTS} from '../../../../../src/services/config/types';
import TaskFactory from '../../../../../src/services/task/TaskFactory';

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

  const createMockTask = (data = taskDataMock) => {
    const task = new EventEmitter() as any;

    const updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {...task.data, ...newData};
      return task;
    });

    Object.assign(task, {
      data,
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData,
      unregisterWebCallListeners: jest.fn(),
      cancelAutoWrapupTimer: jest.fn(),
    });

    const taskEventMap: Partial<Record<TaskEvent, string>> = {
      [TaskEvent.TASK_INCOMING]: TASK_EVENTS.TASK_INCOMING,
      [TaskEvent.TASK_OFFERED]: TASK_EVENTS.TASK_OFFER_CONTACT,
      [TaskEvent.OFFER_CONSULT]: TASK_EVENTS.TASK_OFFER_CONSULT,
      [TaskEvent.HYDRATE]: TASK_EVENTS.TASK_HYDRATE,
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

      const mappedEvent = taskEventMap[event.type as TaskEvent];
      if (mappedEvent) {
        if (
          [TaskEvent.ASSIGN_FAILED, TaskEvent.RONA, TaskEvent.INVITE_FAILED].includes(
            event.type as TaskEvent
          )
        ) {
          task.emit(mappedEvent, event.reason ?? event.taskData?.reason);
        } else if (event.type === TaskEvent.OUTBOUND_FAILED) {
          task.emit(mappedEvent, event.reason);
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
<<<<<<< HEAD
    rtdWebSocketManagerMock = new EventEmitter();
=======
    mockApiAIAssistant = {
      sendEvent: jest.fn().mockResolvedValue({}),
      setAIFeatureFlags: jest.fn(),
      aiFeature: {
        realtimeTranscripts: {
          enable: true,
        },
      },
    };
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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

<<<<<<< HEAD
    mockApiAIAssistant = {
      sendEvent: jest.fn().mockResolvedValue({}),
    };

    taskManager = new TaskManager(
      mockApiAIAssistant as any,
      contactMock,
      webCallingService,
      webSocketManagerMock as any,
      rtdWebSocketManagerMock as any
    );
    taskManager.taskCollection[taskId] = createMockTask(taskDataMock);
    (taskManager as any).setupTaskListeners?.(taskManager.taskCollection[taskId]);
=======
    taskManager = new TaskManager(
      mockApiAIAssistant,
      contactMock,
      webCallingService,
      webSocketManagerMock
    );
    const taskMock = {
      emit: jest.fn(),
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn().mockImplementation((updatedData) => {
        taskMock.data = {...taskMock.data, ...updatedData};
        return taskMock;
      }),
      data: taskDataMock,
    };
    taskManager.taskCollection[taskId] = taskMock;
    taskManager.agentId = 'test-agent-id';
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
    taskManager.call = mockCall;
    taskManager.setAgentId('test-agent-id');

    jest
      .spyOn(TaskFactory, 'createTask')
      .mockImplementation((contact, webCallingService, data, configFlags) => createMockTask(data));
  });

  afterEach(() => {
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

<<<<<<< HEAD
    expect(incomingHandler).toHaveBeenCalledWith(taskManager.getTask(taskId));
    taskManager.off(TASK_EVENTS.TASK_INCOMING, incomingHandler);
=======
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(taskId)
    );
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
      'START'
    );
    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledWith(
      'test-agent-id',
      interactionId,
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      'STOP'
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

  it('should emit REAL_TIME_TRANSCRIPTION from RTD websocket payload', () => {
    const task = taskManager.getTask(taskId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const realtimePayload = {
      data: {
        agentId: 'test-agent-id',
        data: {
          content: 'Thank you. Okay.',
          conversationId: taskId,
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

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(realtimePayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(
      CC_EVENTS.REAL_TIME_TRANSCRIPTION,
      realtimePayload.data
    );
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

  it('should invoke sendEvent for configured start/stop backend events', () => {
    const message = (type: CC_EVENTS) =>
      JSON.stringify({
        data: {
          ...taskDataMock,
          taskId,
          type,
        },
      });

    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONTACT_ASSIGNED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULTING));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_CONFERENCED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_ENDED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_WRAPUP));
    webSocketManagerMock.emit('message', message(CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE));

    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledTimes(6);
    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledWith(
      'test-agent-id',
      taskId,
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      'START'
    );
    expect(mockApiAIAssistant.sendEvent).toHaveBeenCalledWith(
      'test-agent-id',
      taskId,
      'CUSTOM_EVENT',
      'GET_TRANSCRIPTS',
      'STOP'
    );
  });

  it('should not invoke sendEvent for transcript events when realtime transcript feature is disabled', () => {
    mockApiAIAssistant.aiFeature = {
      realtimeTranscripts: {
        enable: false,
      },
    };
    mockApiAIAssistant.setAIFeatureFlags(mockApiAIAssistant.aiFeature);

    const message = (type: CC_EVENTS) =>
      JSON.stringify({
        data: {
          ...taskDataMock,
          taskId,
          type,
        },
      });

    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONTACT_ASSIGNED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULTING));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_CONFERENCED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_CONSULT_ENDED));
    webSocketManagerMock.emit('message', message(CC_EVENTS.AGENT_WRAPUP));
    webSocketManagerMock.emit('message', message(CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE));

    expect(mockApiAIAssistant.sendEvent).not.toHaveBeenCalled();
  });

  it('should emit REAL_TIME_TRANSCRIPTION from task object', () => {
    const task = taskManager.getTask(taskId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const realtimePayload = {
      data: {
        ...taskDataMock,
        type: CC_EVENTS.REAL_TIME_TRANSCRIPTION,
        data: {
          content: 'hello from transcript',
        },
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(realtimePayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(
      CC_EVENTS.REAL_TIME_TRANSCRIPTION,
      realtimePayload.data
    );
  });

  it('should emit REAL_TIME_TRANSCRIPTION from RTD websocket payload on task object', () => {
    const task = taskManager.getTask(taskId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const realtimePayload = {
      data: {
        notifType: CC_EVENTS.REAL_TIME_TRANSCRIPTION,
        data: {
          conversationId: taskId,
          content: 'hello from rtd websocket',
        },
      },
    };

    taskManager.handleRealtimeWebsocketEvent(JSON.stringify(realtimePayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.REAL_TIME_TRANSCRIPTION, realtimePayload.data);
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

<<<<<<< HEAD
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
=======
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const webCallListenerSpy = jest.spyOn(
      taskManager.getTask(taskId),
      'unregisterWebCallListeners'
    );
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(stateMachineEvent?.taskData.wrapUpRequired).toBe(false);
=======
    const task = taskManager.getTask(taskId);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
      },
    };

    task.updateTaskData(payload.data);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
<<<<<<< HEAD
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(stateMachineEvent?.taskData.wrapUpRequired).toBe(true);
    sendStateMachineEventSpy.mockRestore();
=======
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.CONTACT_ENDED, {...payload.data});
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, taskManager.getTask(taskId));
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
  });

  it('should emit TASK_REJECT event on AGENT_INVITE_FAILED event', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

<<<<<<< HEAD
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
=======
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const metricsTrackSpy = jest.spyOn(taskManager.metricsManager, 'trackEvent');
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
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
=======
    taskManager.getTask(taskId).updateTaskData(payload.data);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_INVITE_FAILED, {...payload.data});
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_REJECT, payload.data.reason);
    // Verify the correct metric event name is used for AGENT_INVITE_FAILED
    expect(metricsTrackSpy).toHaveBeenCalled();
    expect(metricsTrackSpy.mock.calls[0][0]).toBe('Agent Invite Failed');
  });

  it('should not emit TASK_HYDRATE if task is already present in taskManager', () => {
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
  it('should emit TASK_WRAPUP event on AGENT_WRAPUP event', () => {
=======
  it('should emit TASK_END event on AGENT_WRAPUP event', () => {
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
      const taskAcceptSpy = jest.spyOn(task, 'accept').mockResolvedValue(undefined);
      const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
=======
      const taskManagerEmitSpy = jest.spyOn(taskManager, 'emit');
      const taskAcceptSpy = jest.spyOn(task, 'accept').mockResolvedValue(undefined);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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

<<<<<<< HEAD
      const stateMachineEvent = expectLastStateMachineEvent(
        sendStateMachineEventSpy,
        TaskEvent.TASK_OFFERED
      );
      expect(stateMachineEvent?.taskData).toEqual(autoAnswerPayload.data);
      // Verify task auto-answer event was emitted
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
      sendStateMachineEventSpy.mockRestore();
=======
      // Verify BOTH events were emitted
      expect(taskManagerEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_OFFER_CONTACT, task);
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
      const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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

<<<<<<< HEAD
      const stateMachineEvent = expectLastStateMachineEvent(
        sendStateMachineEventSpy,
        TaskEvent.OFFER_CONSULT
      );
      expect(stateMachineEvent?.taskData).toEqual({
        ...consultAutoAnswerPayload.data,
        isConsulted: true,
      });
      // Verify task auto-answer event was emitted
=======
      // Verify BOTH events were emitted
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_OFFER_CONSULT, task);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_AUTO_ANSWERED, task);

      // Verify isConsulted flag is set correctly
      expect(task.data.isConsulted).toBe(true);
<<<<<<< HEAD
      sendStateMachineEventSpy.mockRestore();
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
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
=======
  it('should NOT remove OUTDIAL task from taskCollection on AGENT_OUTBOUND_FAILED when terminated (wrap-up flow)', () => {
    const task = taskManager.getTask(taskId);
    task.updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {
        ...task.data,
        ...newData,
        interaction: {
          ...task.data.interaction,
          ...newData.interaction,
          outboundType: 'OUTDIAL',
          state: 'new',
          isTerminated: true,
        },
      };
      return task;
    });
    task.unregisterWebCallListeners = jest.fn();
    const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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
<<<<<<< HEAD
        agentsPendingWrapUp: ['agent-123'],
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
=======

    expect(taskManager.getTask(taskId)).toBeDefined();
    expect(removeTaskSpy).not.toHaveBeenCalled();
  });

  it('should emit TASK_OUTDIAL_FAILED event on AGENT_OUTBOUND_FAILED', () => {
    const task = taskManager.getTask(taskId);
    task.updateTaskData = jest.fn().mockReturnValue(task);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
        interactionId: taskId,
        reason: 'CUSTOMER_BUSY',
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_OUTDIAL_FAILED, 'CUSTOMER_BUSY');
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
    const agentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';
    taskManager.setAgentId(agentId);

    const task = taskManager.getTask(taskId);
    task.updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {
        ...task.data,
        ...newData,
        interaction: {
          ...task.data.interaction,
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: [agentId],
      };
      return task;
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
        agentsPendingWrapUp: [agentId],
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(removeTaskSpy).not.toHaveBeenCalled();
    expect(taskManager.getTask(taskId)).toBeDefined();
  });

  it('should remove OUTDIAL task on CONTACT_ENDED when agentsPendingWrapUp is empty', () => {
    const task = taskManager.getTask(taskId);
    task.updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {
        ...task.data,
        ...newData,
        interaction: {
          ...task.data.interaction,
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        agentsPendingWrapUp: [],
      };
      return task;
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
    task.updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {
        ...task.data,
        ...newData,
        interaction: {
          ...task.data.interaction,
          outboundType: 'OUTDIAL',
          state: 'new',
          mediaType: 'telephony',
        },
        // agentsPendingWrapUp is undefined
      };
      return task;
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

  describe('wrapUpRequired logic in CONTACT_ENDED event', () => {
    const agentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';

    beforeEach(() => {
      // Set the agent ID on taskManager
      taskManager.setAgentId(agentId);
    });

    it('should set wrapUpRequired to true when agent is in agentsPendingWrapUp array for non-campaign tasks', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId, 'other-agent-id'],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: true,
        })
      );
    });

    it('should set wrapUpRequired to false when agent is not in agentsPendingWrapUp array', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: ['other-agent-id', 'another-agent-id'],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: false,
        })
      );
    });

    it('should set wrapUpRequired to false when agentsPendingWrapUp is an empty array', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: false,
        })
      );
    });

    it('should set wrapUpRequired to false when agentsPendingWrapUp is undefined', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          // agentsPendingWrapUp is not defined
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: false,
        })
      );
    });

    it('should set wrapUpRequired to false when agentsPendingWrapUp is null', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: null,
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: false,
        })
      );
    });

    it('should set wrapUpRequired to true when agent is the only one in agentsPendingWrapUp for non-campaign tasks', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: true,
        })
      );
    });

    it('should set wrapUpRequired to true for different interaction states when agent is in agentsPendingWrapUp for non-campaign tasks', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            ...newData.interaction,
          },
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      // Test with 'connected' state
      const payloadConnected = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payloadConnected));

      expect(task.updateTaskData).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          wrapUpRequired: true,
        })
      );

      // Test with 'held' state to verify it still works regardless of state
      const payloadHeld = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'held',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payloadHeld));

      expect(task.updateTaskData).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          wrapUpRequired: true,
        })
      );
    });

    it('should set wrapUpRequired to false for campaign preview tasks even when agent is in agentsPendingWrapUp', () => {
      const task = taskManager.getTask(taskId);
      // Set up task as a campaign preview task via outboundType
      task.data.interaction = {
        ...task.data.interaction,
        outboundType: 'STANDARD_PREVIEW_CAMPAIGN',
      };
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            state: 'connected',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(task.updateTaskData).toHaveBeenCalledWith(
        expect.objectContaining({
          wrapUpRequired: false,
        })
      );
    });
  });

  it('should remove OUTDIAL task from taskCollection on AGENT_CONTACT_ASSIGN_FAILED when NOT terminated (user-declined)', () => {
    const task = taskManager.getTask(taskId);
    task.updateTaskData = jest.fn().mockImplementation((newData) => {
      task.data = {
        ...task.data,
        ...newData,
        interaction: {
          ...task.data.interaction,
          ...newData.interaction,
          outboundType: 'OUTDIAL',
          state: 'new',
          isTerminated: false,
        },
      };
      return task;
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
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskManager.getTask(taskId)).toBeUndefined();
    expect(removeTaskSpy).toHaveBeenCalled();
<<<<<<< HEAD
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
      agentsPendingWrapUp: ['agent-123'],
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
        agentsPendingWrapUp: ['agent-123'],
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
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.CONSULT_END
    );
    expect(stateMachineEvent?.taskData).toEqual(payload.data);
    sendStateMachineEventSpy.mockRestore();
=======
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_END,
      taskManager.getTask(taskId)
    );
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
    const stateMachineEvent = expectLastStateMachineEvent(
      sendStateMachineEventSpy,
      TaskEvent.ASSIGN_FAILED
    );
    expect(stateMachineEvent?.reason).toBe(assignFailedPayload.data.reason);
    sendStateMachineEventSpy.mockRestore();
=======
    expect(taskUpdateDataSpy).toHaveBeenCalledWith(assignFailedPayload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_REJECT,
      assignFailedPayload.data.reason
    );
    // Verify the correct metric event name is used for AGENT_CONTACT_ASSIGN_FAILED
    expect(metricsTrackSpy).toHaveBeenCalled();
    expect(metricsTrackSpy.mock.calls[0][0]).toBe('Agent Contact Assign Failed');
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.CONSULTING_ACTIVE);
    expect(taskManagerEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_MULTI_LOGIN_HYDRATE,
      taskManager.getTask(taskId)
    );
    sendStateMachineEventSpy.mockRestore();
=======
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_CONSULTING, consultingPayload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULTING,
      taskManager.getTask(taskId)
    );
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
    expect(sendStateMachineEventSpy).not.toHaveBeenCalled();
    expect(updateTaskDataSpy).toHaveBeenCalledWith(unassignedPayload.data);
  });

  it('preserves consult fields from state context during consulting payload refresh', () => {
    const task = createMockTask({
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
    const task = createMockTask({
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
=======
    expect(taskEmitSpy).toHaveBeenCalledWith(
      CC_EVENTS.AGENT_CONTACT_UNASSIGNED,
      unassignedPayload.data
    );
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, taskManager.getTask(taskId));
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
  });

  it('should handle chat interaction and emit TASK_INCOMING immediately', () => {
    // Setup chat payload with specific media type
    const chatPayload = {
      data: {
        ...initalPayload.data,
        interaction: {mediaType: 'chat'},
      },
    };

<<<<<<< HEAD
=======
    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
=======
    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
    webSocketManagerMock.emit('message', JSON.stringify(chatReservedPayload));
    const task = taskManager.getTask(chatReservedPayload.data.interactionId);
    const sendStateMachineEventSpy = task.sendStateMachineEvent as jest.Mock;

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.TASK_INCOMING);
=======
    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(chatReservedPayload));

    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(chatReservedPayload.data.interactionId)
    );
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // 2. Chat task is assigned
    const chatAssignedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
      },
    };

<<<<<<< HEAD
    webSocketManagerMock.emit('message', JSON.stringify(chatAssignedPayload));

    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.ASSIGN);
=======
    const task = taskManager.getTask(chatReservedPayload.data.interactionId);
    const taskEmitSpy = jest.spyOn(task, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(chatAssignedPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_ASSIGNED, task);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // 3. Chat task is ended with state 'new' to trigger cleanup
    const chatEndedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'chat', state: 'new'}, // Change to 'new' state
<<<<<<< HEAD
        wrapUpRequired: false,
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
    const task2 = taskManager.getTask(task2Payload.data.interactionId);
    const task2SendStateMachineEventSpy = task2.sendStateMachineEvent as jest.Mock;
=======
    // Create spies for all tasks
    const task1EmitSpy = jest.spyOn(taskManager.getTask(task1Payload.data.interactionId), 'emit');
    const task2EmitSpy = jest.spyOn(taskManager.getTask(task2Payload.data.interactionId), 'emit');
    const task3EmitSpy = jest.spyOn(taskManager.getTask(task3Payload.data.interactionId), 'emit');

    // Store reference to task2 before it gets removed
    const task2 = taskManager.getTask(task2Payload.data.interactionId);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // End only the second task (chat task)
    const chatEndedPayload = {
      data: {
        ...task2Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'chat', state: 'new'}, // Using 'new' to trigger cleanup
<<<<<<< HEAD
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
=======
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(chatEndedPayload));

    // Verify only task2 emitted TASK_END
    expect(task1EmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END);
    expect(task2EmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task2);
    expect(task3EmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // Verify task2 was removed from collection (since state was 'new')
    expect(taskManager.getTask(task2Payload.data.interactionId)).toBeUndefined();

    // Verify other tasks remain in the collection
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();

    // Store reference to task3 before we end it
    const task3 = taskManager.getTask(task3Payload.data.interactionId);
<<<<<<< HEAD
    const task3SendStateMachineEventSpy = task3.sendStateMachineEvent as jest.Mock;
=======
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // Now end task3 with a state that doesn't trigger cleanup
    const emailEndedPayload = {
      data: {
        ...task3Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: {mediaType: 'email', state: 'connected'}, // Using 'connected' to NOT trigger cleanup
<<<<<<< HEAD
        wrapUpRequired: true,
      },
    };

    task3.data.interaction.state = 'connected';
    webSocketManagerMock.emit('message', JSON.stringify(emailEndedPayload));

    const secondEndEvent = expectLastStateMachineEvent(
      task3SendStateMachineEventSpy,
      TaskEvent.CONTACT_ENDED
    );
    expect(secondEndEvent?.taskData).toEqual(emailEndedPayload.data);
=======
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(emailEndedPayload));

    // Verify task3 emitted TASK_END
    expect(task3EmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task3);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

    // Verify task3 is still in collection (since state was 'connected')
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();

    // Verify task1 remains unaffected
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
  });

  it('should emit TRANSFER_SUCCESS event on AGENT_VTEAM_TRANSFERRED event', () => {
    // First create a task by emitting the initial payload
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
<<<<<<< HEAD
    const task = taskManager.getTask(taskId);
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
=======

    // Get a reference to the task from taskCollection
    const task = taskManager.getTask(taskId);

    // Now spy on the task's emit method
    const taskEmitSpy = jest.spyOn(task, 'emit');
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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

<<<<<<< HEAD
    // Check that the state machine received the END event
    expectLastStateMachineEvent(sendStateMachineEventSpy, TaskEvent.TRANSFER_SUCCESS);
    sendStateMachineEventSpy.mockRestore();
=======
    // Check that task.emit was called with TASK_END event
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task);
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6

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
<<<<<<< HEAD
    const sendStateMachineEventSpy = jest.spyOn(task, 'sendStateMachineEvent');
=======
    const updateSpy = jest.spyOn(task, 'updateTaskData').mockImplementation((data) => {
      task.data = {...(task.data || {}), ...(data || {})};
      return task;
    });
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

  describe('Conference event handling', () => {
    let task;
<<<<<<< HEAD

    beforeEach(() => {
      task = {
        data: {interactionId: taskId},
        emit: jest.fn(),
        updateTaskData: jest.fn(),
        sendStateMachineEvent: jest.fn(),
=======
    const agentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';

    beforeEach(() => {
      // Set the agentId on taskManager before tests run
      taskManager.setAgentId(agentId);

      task = {
        data: {interactionId: taskId},
        emit: jest.fn(),
        updateTaskData: jest.fn().mockImplementation((updatedData) => {
          // Mock the updateTaskData method to actually update task.data
          task.data = {...task.data, ...updatedData};
          return task;
        }),
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
        data: {type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE, interactionId: taskId},
=======
        data: {
          type: CC_EVENTS.PARTICIPANT_JOINED_CONFERENCE,
          interactionId: taskId,
          participantId: 'new-participant-123',
          participantType: 'agent',
          interaction: {
            participants: {
              [agentId]: {pType: 'Agent', hasLeft: false},
              'new-participant-123': {pType: 'Agent', hasLeft: false},
            },
            media: {
              [taskId]: {
                mType: 'mainCall',
                participants: [agentId, 'new-participant-123'],
              },
            },
          },
        },
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
      };
      webSocketManagerMock.emit('message', JSON.stringify(payload));
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      const call = task.sendStateMachineEvent.mock.calls[0][0];
      expect(call.type).toBe(TaskEvent.PARTICIPANT_LEAVE);
    });

<<<<<<< HEAD
    it('handles AGENT_CONSULT_CONFERENCING event without errors', () => {
=======
    it('should call updateTaskData only once for PARTICIPANT_JOINED_CONFERENCE with pre-calculated isConferenceInProgress', () => {
      const payload = {
        data: {
          type: CC_EVENTS.PARTICIPANT_JOINED_CONFERENCE,
          interactionId: taskId,
          participantId: 'new-agent-789',
          interaction: {
            participants: {
              [agentId]: {pType: 'Agent', hasLeft: false},
              'agent-2': {pType: 'Agent', hasLeft: false},
              'new-agent-789': {pType: 'Agent', hasLeft: false},
              'customer-1': {pType: 'Customer', hasLeft: false},
            },
            media: {
              [taskId]: {
                mType: 'mainCall',
                participants: [agentId, 'agent-2', 'new-agent-789', 'customer-1'],
              },
            },
          },
        },
      };

      const updateTaskDataSpy = jest.spyOn(task, 'updateTaskData');

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      // Verify updateTaskData was called exactly once
      expect(updateTaskDataSpy).toHaveBeenCalledTimes(1);

      // Verify it was called with isConferenceInProgress already calculated
      expect(updateTaskDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          participantId: 'new-agent-789',
          isConferenceInProgress: true, // 3 active agents
        })
      );

      expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_JOINED, task);
    });

    describe('PARTICIPANT_LEFT_CONFERENCE event handling', () => {
      it('should call updateTaskData only once for PARTICIPANT_LEFT_CONFERENCE with pre-calculated isConferenceInProgress', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {pType: 'Agent', hasLeft: false},
                'agent-2': {pType: 'Agent', hasLeft: true}, // This agent left
                'customer-1': {pType: 'Customer', hasLeft: false},
              },
              media: {
                [taskId]: {
                  mType: 'mainCall',
                  participants: [agentId, 'customer-1'], // agent-2 removed from participants
                },
              },
            },
          },
        };

        const updateTaskDataSpy = jest.spyOn(task, 'updateTaskData');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Verify updateTaskData was called exactly once
        expect(updateTaskDataSpy).toHaveBeenCalledTimes(1);

        // Verify it was called with isConferenceInProgress already calculated
        expect(updateTaskDataSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isConferenceInProgress: false, // Only 1 active agent remains
          })
        );

        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should emit TASK_PARTICIPANT_LEFT event when participant leaves conference', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: false,
                },
              },
            },
          },
        };

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should NOT remove task when agent is still in interaction', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: false,
                },
              },
            },
          },
        };

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Task should still exist in collection
        expect(taskManager.getTask(taskId)).toBeDefined();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should NOT remove task when agent left but is in main interaction', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: true,
                },
              },
              media: {
                [taskId]: {
                  mType: 'mainCall',
                  participants: [agentId],
                },
              },
            },
          },
        };

        const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Task should still exist - not removed
        expect(removeTaskSpy).not.toHaveBeenCalled();
        expect(taskManager.getTask(taskId)).toBeDefined();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should NOT remove task when agent left but is primary (owner)', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: true,
                },
              },
              owner: agentId,
              media: {
                [taskId]: {
                  mType: 'consultCall',
                  participants: ['other-agent'],
                },
              },
            },
          },
        };

        const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Task should still exist - not removed because agent is primary
        expect(removeTaskSpy).not.toHaveBeenCalled();
        expect(taskManager.getTask(taskId)).toBeDefined();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should remove task when agent left and is NOT in main interaction and is NOT primary', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: true,
                },
              },
              owner: 'another-agent-id',
              media: {
                [taskId]: {
                  mType: 'mainCall',
                  participants: ['another-agent-id'],
                },
              },
            },
          },
        };

        const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Task should be removed
        expect(removeTaskSpy).toHaveBeenCalled();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should remove task when agent is not in participants list', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                'other-agent-id': {
                  hasLeft: false,
                },
              },
              owner: 'another-agent-id',
            },
          },
        };

        const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // Task should be removed because agent is not in participants
        expect(removeTaskSpy).toHaveBeenCalled();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should update isConferenceInProgress based on remaining active agents', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: false,
                  pType: 'Agent',
                },
                'agent-2': {
                  hasLeft: false,
                  pType: 'Agent',
                },
                'customer-1': {
                  hasLeft: false,
                  pType: 'Customer',
                },
              },
              media: {
                [taskId]: {
                  mType: 'mainCall',
                  participants: [agentId, 'agent-2', 'customer-1'],
                },
              },
            },
          },
        };

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // isConferenceInProgress should be true (2 active agents)
        expect(task.data.isConferenceInProgress).toBe(true);
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should set isConferenceInProgress to false when only one agent remains', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {
              participants: {
                [agentId]: {
                  hasLeft: false,
                  pType: 'Agent',
                },
                'agent-2': {
                  hasLeft: true,
                  pType: 'Agent',
                },
                'customer-1': {
                  hasLeft: false,
                  pType: 'Customer',
                },
              },
              media: {
                [taskId]: {
                  mType: 'mainCall',
                  participants: [agentId, 'customer-1'],
                },
              },
            },
          },
        };

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // isConferenceInProgress should be false (only 1 active agent)
        expect(task.data.isConferenceInProgress).toBe(false);
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });

      it('should handle participant left when no participants data exists', () => {
        const payload = {
          data: {
            type: CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE,
            interactionId: taskId,
            interaction: {},
          },
        };

        const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

        webSocketManagerMock.emit('message', JSON.stringify(payload));

        // When no participants data exists, checkParticipantNotInInteraction returns true
        // Since agent won't be in main interaction either, task should be removed
        expect(removeTaskSpy).toHaveBeenCalled();
        expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_PARTICIPANT_LEFT, task);
      });
    });

    it('should handle PARTICIPANT_LEFT_CONFERENCE_FAILED event', () => {
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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
<<<<<<< HEAD
      const otherTask: any = {
=======
      const otherTask = {
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
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

<<<<<<< HEAD
      expect(task.sendStateMachineEvent).toHaveBeenCalled();
      expect(otherTask.sendStateMachineEvent).not.toHaveBeenCalled();
    });
  });

  describe('state machine integration', () => {
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
=======
      // Only the matching task should be updated
      expect(task.data.isConferencing).toBe(true);
      expect(task.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONFERENCE_STARTED, task);

      // Other task should not be affected
      expect(otherTask.data.isConferencing).toBeUndefined();
      expect(otherTask.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskCleanup - stage changes', () => {
    const agentId = '723a8ffb-a26e-496d-b14a-ff44fb83b64f';

    beforeEach(() => {
      taskManager.setAgentId(agentId);
    });

    it('should remove OUTDIAL task on CONTACT_ENDED when current agent is NOT in agentsPendingWrapUp', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: ['different-agent-123'], // Current agent not in the list
        };
        return task;
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
          agentsPendingWrapUp: ['different-agent-123'], // Current agent not in the list
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeUndefined();
    });

    it('should NOT remove OUTDIAL task on CONTACT_ENDED when current agent IS in agentsPendingWrapUp', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId, 'other-agent-456'], // Current agent IS in the list
        };
        return task;
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
          agentsPendingWrapUp: [agentId, 'other-agent-456'], // Current agent IS in the list
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).not.toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeDefined();
    });

    it('should remove OUTDIAL task when needsWrapUp is false and task is outdial', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'WRAPUP', // Not 'new' state
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [], // No agents pending wrap-up
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();
      const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            outboundType: 'OUTDIAL',
            state: 'WRAPUP', // Not 'new' state
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [], // No agents pending wrap-up
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeUndefined();
    });

    it('should remove OUTDIAL task when needsWrapUp is false (agentsPendingWrapUp is undefined)', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'WRAPUP',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: undefined, // No agentsPendingWrapUp field
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();
      const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            outboundType: 'OUTDIAL',
            state: 'WRAPUP',
            mediaType: 'telephony',
          },
          // agentsPendingWrapUp not included
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeUndefined();
    });

    it('should NOT remove OUTDIAL task when needsWrapUp is true (current agent in agentsPendingWrapUp) even if state is WRAPUP', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'WRAPUP',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId], // Current agent needs wrap-up
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();
      const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            outboundType: 'OUTDIAL',
            state: 'WRAPUP',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId], // Current agent needs wrap-up
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).not.toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeDefined();
    });

    it('should remove non-OUTDIAL task when state is new regardless of agentsPendingWrapUp', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'PREVIEW', // Not OUTDIAL
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        };
        return task;
      });
      task.unregisterWebCallListeners = jest.fn();
      const removeTaskSpy = jest.spyOn(taskManager, 'removeTaskFromCollection');

      const payload = {
        data: {
          type: CC_EVENTS.CONTACT_ENDED,
          interactionId: taskId,
          interaction: {
            outboundType: 'PREVIEW',
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: [agentId],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeUndefined();
    });

    it('should handle agentsPendingWrapUp with multiple agents correctly - remove if current agent not in list', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: ['agent-1', 'agent-2', 'agent-3'], // Current agent not in the list
        };
        return task;
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
          agentsPendingWrapUp: ['agent-1', 'agent-2', 'agent-3'],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeUndefined();
    });

    it('should handle agentsPendingWrapUp with multiple agents correctly - keep if current agent is in list', () => {
      const task = taskManager.getTask(taskId);
      task.updateTaskData = jest.fn().mockImplementation((newData) => {
        task.data = {
          ...task.data,
          ...newData,
          interaction: {
            ...task.data.interaction,
            outboundType: 'OUTDIAL',
            state: 'new',
            mediaType: 'telephony',
          },
          agentsPendingWrapUp: ['agent-1', agentId, 'agent-3'], // Current agent IS in the list
        };
        return task;
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
          agentsPendingWrapUp: ['agent-1', agentId, 'agent-3'],
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(payload));

      expect(removeTaskSpy).not.toHaveBeenCalled();
      expect(taskManager.getTask(taskId)).toBeDefined();
    });
  });

  describe('CONTACT_MERGED event handling', () => {
    let task;
    let taskEmitSpy;
    let managerEmitSpy;

    beforeEach(() => {
      // Create initial task
      webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
      task = taskManager.getTask(taskId);
      taskEmitSpy = jest.spyOn(task, 'emit');
      managerEmitSpy = jest.spyOn(taskManager, 'emit');
    });

    it('should update existing task data and emit TASK_MERGED event when CONTACT_MERGED is received', () => {
      const mergedPayload = {
        data: {
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: taskId,
          agentId: taskDataMock.agentId,
          interaction: {
            ...taskDataMock.interaction,
            state: 'merged',
            customField: 'updated-value',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(mergedPayload));

      const updatedTask = taskManager.getTask(taskId);
      expect(updatedTask).toBeDefined();
      expect(updatedTask.data.interaction.customField).toBe('updated-value');
      expect(updatedTask.data.interaction.state).toBe('merged');
      expect(managerEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MERGED, updatedTask);
    });

    it('should create new task when CONTACT_MERGED is received for non-existing task', () => {
      const newMergedTaskId = 'new-merged-task-id';
      const mergedPayload = {
        data: {
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: newMergedTaskId,
          agentId: taskDataMock.agentId,
          interaction: {
            mediaType: 'telephony',
            state: 'merged',
            participants: {
              [taskDataMock.agentId]: {
                isWrapUp: false,
                hasJoined: true,
              },
            },
          },
        },
      };

      // Verify task doesn't exist before
      expect(taskManager.getTask(newMergedTaskId)).toBeUndefined();

      webSocketManagerMock.emit('message', JSON.stringify(mergedPayload));

      // Verify task was created
      const newTask = taskManager.getTask(newMergedTaskId);
      expect(newTask).toBeDefined();
      expect(newTask.data.interactionId).toBe(newMergedTaskId);
      expect(managerEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MERGED, newTask);
    });

    it('should remove child task when childInteractionId is present in CONTACT_MERGED', () => {
      const childTaskId = 'child-task-id';
      const parentTaskId = 'parent-task-id';

      // Create child task
      const childPayload = {
        data: {
          type: CC_EVENTS.AGENT_CONTACT_RESERVED,
          interactionId: childTaskId,
          agentId: taskDataMock.agentId,
          interaction: {mediaType: 'telephony'},
        },
      };
      webSocketManagerMock.emit('message', JSON.stringify(childPayload));

      // Verify child task exists
      expect(taskManager.getTask(childTaskId)).toBeDefined();

      // Create parent task
      const parentPayload = {
        data: {
          type: CC_EVENTS.AGENT_CONTACT_RESERVED,
          interactionId: parentTaskId,
          agentId: taskDataMock.agentId,
          interaction: {mediaType: 'telephony'},
        },
      };
      webSocketManagerMock.emit('message', JSON.stringify(parentPayload));

      // Send CONTACT_MERGED with childInteractionId
      const mergedPayload = {
        data: {
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: parentTaskId,
          childInteractionId: childTaskId,
          agentId: taskDataMock.agentId,
          interaction: {
            mediaType: 'telephony',
            state: 'merged',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(mergedPayload));

      // Verify child task was removed
      expect(taskManager.getTask(childTaskId)).toBeUndefined();

      // Verify parent task still exists
      expect(taskManager.getTask(parentTaskId)).toBeDefined();

      // Verify TASK_MERGED event was emitted
      expect(managerEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MERGED,
        expect.objectContaining({
          data: expect.objectContaining({
            interactionId: parentTaskId,
          }),
        })
      );
    });

    it('should handle CONTACT_MERGED with EP-DN participant correctly', () => {
      const epdnTaskId = 'epdn-merged-task';
      const mergedPayload = {
        data: {
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: epdnTaskId,
          agentId: taskDataMock.agentId,
          interaction: {
            mediaType: 'telephony',
            state: 'merged',
            participants: {
              [taskDataMock.agentId]: {
                type: 'Agent',
                isWrapUp: false,
                hasJoined: true,
              },
              'epdn-participant': {
                type: 'EpDn',
                epId: 'entry-point-123',
                isWrapUp: false,
              },
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(mergedPayload));

      const mergedTask = taskManager.getTask(epdnTaskId);
      expect(mergedTask).toBeDefined();
      expect(mergedTask.data.interaction.participants['epdn-participant']).toBeDefined();
      expect(mergedTask.data.interaction.participants['epdn-participant'].type).toBe('EpDn');
      expect(managerEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MERGED, mergedTask);
    });

    it('should not affect other tasks when CONTACT_MERGED is received', () => {
      const otherTaskId = 'other-unrelated-task';
      const otherPayload = {
        data: {
          type: CC_EVENTS.AGENT_CONTACT_RESERVED,
          interactionId: otherTaskId,
          agentId: taskDataMock.agentId,
          interaction: {mediaType: 'chat'},
        },
      };
      webSocketManagerMock.emit('message', JSON.stringify(otherPayload));

      const otherTask = taskManager.getTask(otherTaskId);
      const otherTaskEmitSpy = jest.spyOn(otherTask, 'emit');

      // Send CONTACT_MERGED for the original task
      const mergedPayload = {
        data: {
          type: CC_EVENTS.CONTACT_MERGED,
          interactionId: taskId,
          agentId: taskDataMock.agentId,
          interaction: {
            mediaType: 'telephony',
            state: 'merged',
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(mergedPayload));

      // Verify other task was not affected
      expect(otherTaskEmitSpy).not.toHaveBeenCalled();
      expect(otherTask.data.interaction.mediaType).toBe('chat');

      // Verify original task was updated
      expect(managerEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MERGED,
        expect.objectContaining({
          data: expect.objectContaining({
            interactionId: taskId,
          }),
        })
      );
    });
  });

  describe('Campaign Preview Reservation', () => {
    it('should create a task and emit TASK_CAMPAIGN_PREVIEW_RESERVATION when AgentOfferCampaignReservation is received', () => {
      const campaignPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: 'campaign-interaction-123',
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      const managerEmitSpy = jest.spyOn(taskManager, 'emit');

      webSocketManagerMock.emit('message', JSON.stringify(campaignPayload));

      // Should emit with a task object (not raw data)
      expect(managerEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        expect.objectContaining({
          data: expect.objectContaining({
            interactionId: 'campaign-interaction-123',
            type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
            wrapUpRequired: false,
            isAutoAnswering: false,
          }),
        })
      );

      // Task should be in the collection so subsequent events (e.g. AGENT_CONTACT_ASSIGNED) can find it
      expect(taskManager['taskCollection']['campaign-interaction-123']).toBeDefined();
    });

    it('should re-key task and emit TASK_ASSIGNED when AgentContactAssigned uses a new interactionId', () => {
      const reservationInteractionId = 'campaign-reservation-id';
      const assignedInteractionId = 'campaign-assigned-id';

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
            interactionId: reservationInteractionId,
            agentId: taskDataMock.agentId,
            orgId: taskDataMock.orgId,
            trackingId: 'campaign-tracking-456',
            interaction: {
              mediaType: 'telephony',
              callProcessingDetails: {campaignId: 'campaign-789'},
            },
          },
        })
      );

      const taskBeforeAssign = taskManager['taskCollection'][reservationInteractionId];
      expect(taskBeforeAssign).toBeDefined();

      const taskEmitSpy = jest.spyOn(taskBeforeAssign, 'emit');

      webSocketManagerMock.emit(
        'message',
        JSON.stringify({
          data: {
            type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
            interactionId: assignedInteractionId,
            reservationInteractionId,
            agentId: taskDataMock.agentId,
            orgId: taskDataMock.orgId,
            trackingId: 'campaign-tracking-assigned',
            interaction: {mediaType: 'telephony', state: 'connected'},
          },
        })
      );

      expect(taskManager['taskCollection'][reservationInteractionId]).toBeUndefined();
      expect(taskManager['taskCollection'][assignedInteractionId]).toBe(taskBeforeAssign);
      expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_ASSIGNED, taskBeforeAssign);

      taskEmitSpy.mockRestore();
    });

    it('should not emit TASK_INCOMING for campaign preview reservation when incoming WebRTC call arrives', () => {
      const campaignPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: 'campaign-interaction-123',
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      // Remove the default task so only the campaign preview task is in the collection
      delete taskManager['taskCollection'][taskId];

      // Create campaign preview task via the reservation event
      webSocketManagerMock.emit('message', JSON.stringify(campaignPayload));

      const managerEmitSpy = jest.spyOn(taskManager, 'emit');

      // Simulate an incoming WebRTC call
      const incomingCallCb = onSpy.mock.calls[0][1];
      incomingCallCb(mockCall);

      // TASK_INCOMING should NOT be emitted because the only telephony task is a campaign preview
      expect(managerEmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, expect.anything());
    });

    it('should update existing task when AgentOfferCampaignReservation is received for known interactionId', () => {
      const campaignPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: 'campaign-interaction-123',
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      // Send the first reservation to create the task
      webSocketManagerMock.emit('message', JSON.stringify(campaignPayload));

      const managerEmitSpy = jest.spyOn(taskManager, 'emit');

      // Send a second reservation for the same interactionId
      webSocketManagerMock.emit('message', JSON.stringify(campaignPayload));

      expect(managerEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_RESERVATION,
        expect.objectContaining({
          data: expect.objectContaining({
            interactionId: 'campaign-interaction-123',
          }),
        })
      );
    });

    it('should emit TASK_CAMPAIGN_CONTACT_UPDATED and NOT remove task when CampaignContactUpdated is received', () => {
      const campaignInteractionId = 'campaign-interaction-123';

      // First create a campaign preview task
      const reservationPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: campaignInteractionId,
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(reservationPayload));

      // Verify task exists in collection
      const task = taskManager['taskCollection'][campaignInteractionId];
      expect(task).toBeDefined();

      const taskEmitSpy = jest.spyOn(task, 'emit');

      // Now send CampaignContactUpdated
      const campaignContactUpdatedPayload = {
        data: {
          type: CC_EVENTS.CAMPAIGN_CONTACT_UPDATED,
          interactionId: campaignInteractionId,
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          interaction: {
            mediaType: 'telephony',
            state: 'new',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(campaignContactUpdatedPayload));

      // Task should still exist in collection (not removed — non-terminal event)
      expect(taskManager['taskCollection'][campaignInteractionId]).toBeDefined();

      // TASK_CAMPAIGN_CONTACT_UPDATED should have been emitted
      expect(taskEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_CONTACT_UPDATED,
        expect.objectContaining({
          data: expect.objectContaining({
            interactionId: campaignInteractionId,
          }),
        })
      );

      // TASK_END should NOT have been emitted
      expect(taskEmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END, expect.anything());
    });

    it('should emit TASK_CAMPAIGN_PREVIEW_ACCEPT_FAILED when CampaignPreviewAcceptFailed is received', () => {
      const campaignInteractionId = 'campaign-interaction-123';

      // First create a campaign preview task
      const reservationPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: campaignInteractionId,
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(reservationPayload));

      const task = taskManager['taskCollection'][campaignInteractionId];
      expect(task).toBeDefined();

      const taskEmitSpy = jest.spyOn(task, 'emit');

      const failPayload = {
        data: {
          type: CC_EVENTS.CAMPAIGN_PREVIEW_ACCEPT_FAILED,
          interactionId: campaignInteractionId,
          campaignId: 'campaign-789',
          reason: 'INTERNAL_ERROR',
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(failPayload));

      expect(taskEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_ACCEPT_FAILED,
        expect.objectContaining({
          data: expect.objectContaining({interactionId: campaignInteractionId}),
        })
      );
      // Task should still exist (failure is non-terminal)
      expect(taskManager['taskCollection'][campaignInteractionId]).toBeDefined();

      // Failure payload (reason, campaignId) should be merged into task.data
      expect(task.data.reason).toBe('INTERNAL_ERROR');

      // Original reservation data must be preserved
      expect(task.data.interaction).toBeDefined();
      expect(task.data.interaction.callProcessingDetails.campaignId).toBe('campaign-789');
    });

    it('should emit TASK_CAMPAIGN_PREVIEW_SKIP_FAILED when CampaignPreviewSkipFailed is received', () => {
      const campaignInteractionId = 'campaign-interaction-123';

      const reservationPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: campaignInteractionId,
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(reservationPayload));

      const task = taskManager['taskCollection'][campaignInteractionId];
      expect(task).toBeDefined();

      const taskEmitSpy = jest.spyOn(task, 'emit');

      const failPayload = {
        data: {
          type: CC_EVENTS.CAMPAIGN_PREVIEW_SKIP_FAILED,
          interactionId: campaignInteractionId,
          campaignId: 'campaign-789',
          reason: 'INTERNAL_ERROR',
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(failPayload));

      expect(taskEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_SKIP_FAILED,
        expect.objectContaining({
          data: expect.objectContaining({interactionId: campaignInteractionId}),
        })
      );
      expect(taskManager['taskCollection'][campaignInteractionId]).toBeDefined();

      // Failure payload (reason) should be merged into task.data
      expect(task.data.reason).toBe('INTERNAL_ERROR');

      // Original reservation data must be preserved
      expect(task.data.interaction).toBeDefined();
      expect(task.data.interaction.callProcessingDetails.campaignId).toBe('campaign-789');
    });

    it('should emit TASK_CAMPAIGN_PREVIEW_REMOVE_FAILED when CampaignPreviewRemoveFailed is received', () => {
      const campaignInteractionId = 'campaign-interaction-123';

      const reservationPayload = {
        data: {
          type: CC_EVENTS.AGENT_OFFER_CAMPAIGN_RESERVATION,
          interactionId: campaignInteractionId,
          agentId: taskDataMock.agentId,
          orgId: taskDataMock.orgId,
          trackingId: 'campaign-tracking-456',
          interaction: {
            mediaType: 'telephony',
            callProcessingDetails: {
              campaignId: 'campaign-789',
            },
          },
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(reservationPayload));

      const task = taskManager['taskCollection'][campaignInteractionId];
      expect(task).toBeDefined();

      const taskEmitSpy = jest.spyOn(task, 'emit');

      const failPayload = {
        data: {
          type: CC_EVENTS.CAMPAIGN_PREVIEW_REMOVE_FAILED,
          interactionId: campaignInteractionId,
          campaignId: 'campaign-789',
          reason: 'INTERNAL_ERROR',
        },
      };

      webSocketManagerMock.emit('message', JSON.stringify(failPayload));

      expect(taskEmitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_CAMPAIGN_PREVIEW_REMOVE_FAILED,
        expect.objectContaining({
          data: expect.objectContaining({interactionId: campaignInteractionId}),
        })
      );
      expect(taskManager['taskCollection'][campaignInteractionId]).toBeDefined();

      // Failure payload (reason) should be merged into task.data
      expect(task.data.reason).toBe('INTERNAL_ERROR');

      // Original reservation data must be preserved
      expect(task.data.interaction).toBeDefined();
      expect(task.data.interaction.callProcessingDetails.campaignId).toBe('campaign-789');
    });

    it('should not emit campaign preview failure events when task does not exist', () => {
      const nonExistentId = 'non-existent-interaction';

      const failPayload = {
        data: {
          type: CC_EVENTS.CAMPAIGN_PREVIEW_SKIP_FAILED,
          interactionId: nonExistentId,
          campaignId: 'campaign-789',
          reason: 'INTERNAL_ERROR',
        },
      };

      // Should not throw when task is not found
      expect(() => {
        webSocketManagerMock.emit('message', JSON.stringify(failPayload));
      }).not.toThrow();

      expect(taskManager['taskCollection'][nonExistentId]).toBeUndefined();
>>>>>>> 81672300901738f14289fd2a7414c6c4b1389aa6
    });
  });
});
