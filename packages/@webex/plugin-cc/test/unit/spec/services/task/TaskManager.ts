import 'jsdom-global/register';
import EventEmitter from 'events';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import {CALL_EVENT_KEYS, CallingClientConfig, LINE_EVENTS} from '@webex/calling';
import {CC_AGENT_EVENTS, CC_EVENTS} from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact';
import Task from '../../../../../src/services/task';
import {TASK_EVENTS} from '../../../../../src/services/task/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import config from '../../../../../src/config';
import {wrap} from 'module';
import {CC_TASK_EVENTS} from '../../../../../src/services/config/types';

describe('TaskManager', () => {
  let mockCall;
  let webSocketManagerMock;
  let onSpy;
  let offSpy;
  let taskManager;
  let contactMock;
  let taskDataMock;
  let webCallingService;
  let webex: WebexSDK;
  const taskId = '0ae913a4-c857-4705-8d49-76dd3dde75e4';

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

  beforeEach(() => {
    contactMock = contact;
    webSocketManagerMock = new EventEmitter();

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

    taskManager = new TaskManager(contactMock, webCallingService, webSocketManagerMock);
    taskManager.taskCollection[taskId] = {
      emit: jest.fn(),
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: taskDataMock,
    };
    taskManager.call = mockCall;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should initialize TaskManager and register listeners', () => {
    webSocketManagerMock.emit('message', JSON.stringify({data: taskDataMock}));
    const incomingCallCb = onSpy.mock.calls[0][1];
    const taskEmitSpy = jest.spyOn(taskManager, 'emit');

    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingService.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);
    expect(onSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, incomingCallCb);

    incomingCallCb(mockCall);

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, taskManager.getTask(taskId));
  });

  it('should re-emit task related events', () => {
    const dummyPayload = {
      data: {...taskDataMock,
        type: CC_TASK_EVENTS.AGENT_CONSULTING,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify({data: taskDataMock}));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');

    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingService.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);

    webSocketManagerMock.emit('message', JSON.stringify(dummyPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(dummyPayload.data.type, dummyPayload.data);
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

    expect(taskEmitSpy).not.toHaveBeenCalledWith(dummyPayload.data.type, dummyPayload.data);
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

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(payload.data.interactionId)
    );
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

    const currentTaskAssignedSpy = jest.spyOn(taskManager.getTask(payload.data.interactionId), 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(assignedPayload));

    expect(currentTaskAssignedSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_ASSIGNED,
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

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(taskId)
    );
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.getTask(taskId));
    expect(taskManager.getAllTasks()).toHaveProperty(payload.data.interactionId);
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

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const webCallListenerSpy = jest.spyOn(taskManager.getTask(taskId), 'unregisterWebCallListeners');
    const callOffSpy = jest.spyOn(mockCall, 'off');
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

    taskManager.getTask(taskId).data = payload.data;
    const task = taskManager.getTask(taskId)
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_END, task
    );
    expect(webCallListenerSpy).toHaveBeenCalledWith();
    expect(callOffSpy).toHaveBeenCalledWith(
      CALL_EVENT_KEYS.REMOTE_MEDIA,
      callOffSpy.mock.calls[0][1]
    );

    taskManager.unregisterIncomingCallEvent();
    expect(offSpy.mock.calls.length).toBe(2); // 1 for incoming call and 1 for remote media
    expect(offSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, offSpy.mock.calls[0][1]);
    expect(offSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, offSpy.mock.calls[1][1]);
  });

  it('should emit TASK_END event with wrapupRequired on regular call end', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
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

    taskManager.getTask(taskId).updateTaskData(payload.data);
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).toHaveBeenCalledWith(
      CC_EVENTS.CONTACT_ENDED, 
      { ...payload.data}
    );
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_END, 
      taskManager.getTask(taskId)
    );
  });

  it('should emit TASK_HYDRATE event on AGENT_CONTACT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
      },
    };

    const taskEmitSpy = jest.spyOn(taskManager, 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, taskManager.getTask(taskId));
    expect(taskManager.taskCollection[payload.data.interactionId]).toBe(taskManager.getTask(taskId));
  });

  it('should emit TASK_END event on AGENT_WRAPUP event', () => {
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
      },
    };

    const updateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');

    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));

    expect(updateTaskDataSpy).toHaveBeenCalledWith(wrapupPayload.data);
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

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HOLD, taskManager.getTask(taskId));
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

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_RESUME, taskManager.getTask(taskId));
  });

  it('handle AGENT_CONSULT_CREATED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_CREATED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith({
      ...payload.data,
      isConsulted: false,
    });
    const task = taskManager.getTask(taskId);
    expect(task.data.isConsulted).toBe(false);
  });

  it('handle AGENT_OFFER_CONTACT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONTACT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
  });

  it('should remove currentTask from taskCollection on AGENT_OUTBOUND_FAILED event', () => {
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_OUTBOUND_FAILED,
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

    taskManager.taskCollection[taskId] = taskManager.getTask(taskId);

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskManager.getTask(taskId)).toBeUndefined();
  });

  it('handle AGENT_OFFER_CONSULT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONSULT,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.getTask(taskId).updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.getTask(taskId).data = {...newData, isConsulted: true};
      return taskManager.getTask(taskId);
    });

    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskManager.getTask(taskId).updateTaskData).toHaveBeenCalledWith({
      ...payload.data,
      isConsulted: true,
    });
    expect(taskManager.getTask(taskId).data.isConsulted).toBe(true);
  });

  it('should emit TASK_CONSULT_ACCEPTED event on AGENT_CONSULTING event', () => {
    const consultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULTING,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.getTask(taskId).updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.getTask(taskId).data = {...newData, isConsulted: true};
      return taskManager.getTask(taskId);
    });

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(consultingPayload));
    expect(taskManager.getTask(taskId).updateTaskData).toHaveBeenCalledWith(consultingPayload.data);
    expect(taskManager.getTask(taskId).data.isConsulted).toBe(true);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_ACCEPTED,
      taskManager.getTask(taskId)
    );
  });

  it('should emit TASK_CONSULT_ENDED event on AGENT_CONSULT_ENDED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_ENDED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULT_END, taskManager.getTask(taskId));
  });

  it('should emit TASK_CONSULT_ENDED event and remove currentTask when on AGENT_CONSULT_ENDED event when requested for a consult', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_ENDED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    taskManager.getTask(taskId).updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.getTask(taskId).data = {...newData, isConsulted: true};
      return taskManager.getTask(taskId);
    });
    const task = taskManager.getTask(taskId);

    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_CONSULT_ENDED, payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULT_END, task);
    expect(taskManager.getTask(taskId)).toBeUndefined(); // Ensure task is removed from the task collection after the consult ends
  });

  it('should emit TASK_CANCELLED event on AGENT_CTQ_CANCELLED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CTQ_CANCELLED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED,
      taskManager.getTask(taskId)
    );
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
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
  });

  it('should emit TASK_CONSULT_QUEUE_FAILED on AGENT_CTQ_CANCEL_FAILED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CTQ_CANCEL_FAILED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED,
      taskManager.getTask(taskId)
    );
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
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(ronaPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_REJECT, ronaPayload.data.reason);
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

    taskManager.taskCollection[taskId] = taskManager.getTask(taskId);

    webSocketManagerMock.emit('message', JSON.stringify(payload));

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
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.getTask(taskId), 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).not.toHaveBeenCalled();
    expect(taskUpdateTaskDataSpy).not.toHaveBeenCalled();
  });

  it('should emit TASK_CONSULTING event when agent is consulting', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.getTask(taskId).data.isConsulted = false;
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
    const consultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULTING,
        isConsulted: false,
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(consultingPayload));
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_CONSULTING, consultingPayload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULTING, taskManager.getTask(taskId));
  });

  it('should emit TASK_END event on AGENT_CONTACT_UNASSIGNED', () => {
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskEmitSpy = jest.spyOn(taskManager.getTask(taskId), 'emit');
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
    expect(taskEmitSpy).toHaveBeenCalledWith(CC_EVENTS.AGENT_CONTACT_UNASSIGNED, unassignedPayload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, taskManager.getTask(taskId));
  });

  it('should handle chat interaction and emit TASK_INCOMING immediately', () => {
    // Setup chat payload with specific media type
    const chatPayload = {
      data: {
        ...initalPayload.data,
        interaction: { mediaType: 'chat' },
      },
    };

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');
    
    // Simulate receiving a chat task
    webSocketManagerMock.emit('message', JSON.stringify(chatPayload));

    // For non-telephony tasks, TASK_INCOMING should be emitted immediately
    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(chatPayload.data.interactionId)
    );
    expect(taskManager.getAllTasks()).toHaveProperty(chatPayload.data.interactionId);
  });

  it('should handle email interaction and emit TASK_INCOMING immediately', () => {
    // Setup email payload
    const emailPayload = {
      data: {
        ...initalPayload.data,
        interaction: { mediaType: 'email' },
      },
    };

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');
    
    // Simulate receiving an email task
    webSocketManagerMock.emit('message', JSON.stringify(emailPayload));

    // For non-telephony tasks, TASK_INCOMING should be emitted immediately
    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(emailPayload.data.interactionId)
    );
    expect(taskManager.getAllTasks()).toHaveProperty(emailPayload.data.interactionId);
  });

  it('should handle chat task lifecycle from reservation to assignment to end', () => {
    // 1. Chat task is reserved
    const chatReservedPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        interaction: { mediaType: 'chat' },
      },
    };
    
    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(chatReservedPayload));
    
    expect(taskIncomingSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_INCOMING,
      taskManager.getTask(chatReservedPayload.data.interactionId)
    );
    
    // 2. Chat task is assigned
    const chatAssignedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
      },
    };
    
    const task = taskManager.getTask(chatReservedPayload.data.interactionId);
    const taskEmitSpy = jest.spyOn(task, 'emit');
    
    webSocketManagerMock.emit('message', JSON.stringify(chatAssignedPayload));
    
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_ASSIGNED, task);
    
    // 3. Chat task is ended with state 'new' to trigger cleanup
    const chatEndedPayload = {
      data: {
        ...chatReservedPayload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: { mediaType: 'chat', state: 'new' }, // Change to 'new' state
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(chatEndedPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task);
    // Verify task is removed since it was in a 'new' state
    expect(taskManager.getTask(chatReservedPayload.data.interactionId)).toBeUndefined();
  });

  it('should handle multiple tasks of different media types simultaneously', () => {
    // Setup telephony, chat and email payloads with different IDs
    const telephonyPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'telephony-task-id',
        interaction: { mediaType: 'telephony' },
      },
    };
    
    const chatPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'chat-task-id',
        interaction: { mediaType: 'chat' },
      },
    };
    
    const emailPayload = {
      data: {
        ...initalPayload.data,
        interactionId: 'email-task-id',
        interaction: { mediaType: 'email' },
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
    expect(taskManager.getTask(telephonyPayload.data.interactionId).data.interaction.mediaType).toBe('telephony');
    expect(taskManager.getTask(chatPayload.data.interactionId).data.interaction.mediaType).toBe('chat');
    expect(taskManager.getTask(emailPayload.data.interactionId).data.interaction.mediaType).toBe('email');
  });

  it('should properly handle one task ending when multiple tasks are active', () => {
    // Create three tasks with different IDs and media types
    const task1Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-1',
        interaction: { mediaType: 'telephony' },
      },
    };
    
    const task2Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-2',
        interaction: { mediaType: 'chat' },
      },
    };
    
    const task3Payload = {
      data: {
        ...initalPayload.data,
        interactionId: 'task-id-3',
        interaction: { mediaType: 'email' },
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
    
    // Create spies for all tasks
    const task1EmitSpy = jest.spyOn(taskManager.getTask(task1Payload.data.interactionId), 'emit');
    const task2EmitSpy = jest.spyOn(taskManager.getTask(task2Payload.data.interactionId), 'emit');
    const task3EmitSpy = jest.spyOn(taskManager.getTask(task3Payload.data.interactionId), 'emit');
    
    // Store reference to task2 before it gets removed
    const task2 = taskManager.getTask(task2Payload.data.interactionId);
    
    // End only the second task (chat task)
    const chatEndedPayload = {
      data: {
        ...task2Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: { mediaType: 'chat', state: 'new' }, // Using 'new' to trigger cleanup
      },
    };
    
    webSocketManagerMock.emit('message', JSON.stringify(chatEndedPayload));
    
    // Verify only task2 emitted TASK_END
    expect(task1EmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END);
    expect(task2EmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task2);
    expect(task3EmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END);
    
    // Verify task2 was removed from collection (since state was 'new')
    expect(taskManager.getTask(task2Payload.data.interactionId)).toBeUndefined();
    
    // Verify other tasks remain in the collection
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();
    
    // Store reference to task3 before we end it
    const task3 = taskManager.getTask(task3Payload.data.interactionId);
    
    // Now end task3 with a state that doesn't trigger cleanup
    const emailEndedPayload = {
      data: {
        ...task3Payload.data,
        type: CC_EVENTS.CONTACT_ENDED,
        interaction: { mediaType: 'email', state: 'connected' }, // Using 'connected' to NOT trigger cleanup
      },
    };
    
    webSocketManagerMock.emit('message', JSON.stringify(emailEndedPayload));
    
    // Verify task3 emitted TASK_END
    expect(task3EmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task3);
    
    // Verify task3 is still in collection (since state was 'connected')
    expect(taskManager.getTask(task3Payload.data.interactionId)).toBeDefined();
    
    // Verify task1 remains unaffected
    expect(task1EmitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_END);
    expect(taskManager.getTask(task1Payload.data.interactionId)).toBeDefined();
  });

  it('should emit TASK_END event on AGENT_VTEAM_TRANSFERRED event', () => {
    // First create a task by emitting the initial payload
    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    
    // Get a reference to the task from taskCollection
    const task = taskManager.getTask(taskId);
    
    // Now spy on the task's emit method
    const taskEmitSpy = jest.spyOn(task, 'emit');
    
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
    
    // Check that task.emit was called with TASK_END event
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, task);
    
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
    const updateSpy = jest.spyOn(task, 'updateTaskData').mockImplementation((data) => {
        task.data = { ...(task.data || {}), ...(data || {}) };
        return task;
    });
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(updateSpy).toHaveBeenCalledWith(payload.data);
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
        interaction: { mediaType: 'telephony' },
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
        interaction: { mediaType: 'telephony' },
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
        interaction: { mediaType: 'telephony' },
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
        interaction: { mediaType: 'telephony' },
      },
    };
    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));
    expect(unregisterSpy).not.toHaveBeenCalled();
    expect(cleanUpCallSpy).not.toHaveBeenCalled();
  });
});

