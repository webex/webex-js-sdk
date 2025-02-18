import 'jsdom-global/register';
import EventEmitter from 'events';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import {CALL_EVENT_KEYS, CallingClientConfig, LINE_EVENTS} from '@webex/calling';
import {CC_EVENTS} from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact';
import Task from '../../../../../src/services/task';
import {TASK_EVENTS} from '../../../../../src/services/task/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import config from '../../../../../src/config';
import {wrap} from 'module';

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
    interaction: {},
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
    taskManager.currentTask = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: taskDataMock,
    };
    taskManager.call = mockCall;
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, taskManager.currentTask);
  });

  it('should handle WebSocket message for AGENT_CONTACT_RESERVED and emit task:incoming for browser case', () => {
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
      taskManager.currentTask
    );
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.currentTask);
    expect(taskManager.getAllTasks()).toHaveProperty(payload.data.interactionId);

    const assignedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
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

    const currentTaskAssignedSpy = jest.spyOn(taskManager.currentTask, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(assignedPayload));

    expect(currentTaskAssignedSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_ASSIGNED,
      taskManager.currentTask
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
      taskManager.currentTask
    );
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.currentTask);
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

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const webCallListenerSpy = jest.spyOn(taskManager.currentTask, 'unregisterWebCallListeners');
    const callOffSpy = jest.spyOn(mockCall, 'off');
    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interaction: {state: 'new'},
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    taskManager.currentTask.data = payload.data;
    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, {wrapupRequired: false});
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

  it('should emit TASK_HYDRATE event on AGENT_CONTACT event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONTACT,
      },
    };

    const taskEmitSpy = jest.spyOn(taskManager, 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HYDRATE, taskManager.currentTask);
    expect(taskManager.taskCollection[payload.data.interactionId]).toBe(taskManager.currentTask);
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

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const updateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');

    webSocketManagerMock.emit('message', JSON.stringify(wrapupPayload));

    expect(updateTaskDataSpy).toHaveBeenCalledWith(wrapupPayload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_END, {wrapupRequired: true});
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

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_HOLD, taskManager.currentTask);
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

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_RESUME, taskManager.currentTask);
  });

  it('handle AGENT_CONSULT_CREATED event', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_CREATED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
  });

  it('handle AGENT_OFFER_CONTACT event', () => {

    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_OFFER_CONTACT
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');

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

    taskManager.taskCollection[taskId] = taskManager.currentTask;

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
    taskManager.currentTask.updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.currentTask.data = {...newData, isConsulted: true};
      return taskManager.currentTask;
    });

    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskManager.currentTask.updateTaskData).toHaveBeenCalledWith({
      ...payload.data,
      isConsulted: true,
    });
    expect(taskManager.currentTask.data.isConsulted).toBe(true);
  });

  it('should emit TASK_CONSULT_ACCEPTED event on AGENT_CONSULTING event', () => {
    const consultingPayload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULTING,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));
    taskManager.currentTask.updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.currentTask.data = {...newData, isConsulted: true};
      return taskManager.currentTask;
    });

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    webSocketManagerMock.emit('message', JSON.stringify(consultingPayload));
    expect(taskManager.currentTask.updateTaskData).toHaveBeenCalledWith(consultingPayload.data);
    expect(taskManager.currentTask.data.isConsulted).toBe(true);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_ACCEPTED,
      taskManager.currentTask
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
    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULT_END, taskManager.currentTask);
  });

  it('should emit TASK_CONSULT_ENDED event and remove currentTask when on AGENT_CONSULT_ENDED event when requested for a consult', () => {
    const payload = {
      data: {
        ...initalPayload.data,
        type: CC_EVENTS.AGENT_CONSULT_ENDED,
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(initalPayload));

    taskManager.currentTask.updateTaskData = jest.fn().mockImplementation((newData) => {
      taskManager.currentTask.data = {...newData, isConsulted: true};
      return taskManager.currentTask;
    });

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULT_END, taskManager.currentTask);
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
    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED,
      taskManager.currentTask
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
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
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
    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskUpdateTaskDataSpy).toHaveBeenCalledWith(payload.data);
    expect(taskEmitSpy).toHaveBeenCalledWith(
      TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED,
      taskManager.currentTask
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

    taskManager.taskCollection[taskId] = taskManager.currentTask;
    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(ronaPayload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_REJECT, ronaPayload.data.reason);
    expect(taskManager.getTask(taskId)).toBeUndefined();
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

    taskManager.taskCollection[taskId] = taskManager.currentTask;

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

    const taskEmitSpy = jest.spyOn(taskManager.currentTask, 'emit');
    const taskUpdateTaskDataSpy = jest.spyOn(taskManager.currentTask, 'updateTaskData');
    webSocketManagerMock.emit('message', JSON.stringify(payload));
    expect(taskEmitSpy).not.toHaveBeenCalled();
    expect(taskUpdateTaskDataSpy).not.toHaveBeenCalled();
  });
});
  
