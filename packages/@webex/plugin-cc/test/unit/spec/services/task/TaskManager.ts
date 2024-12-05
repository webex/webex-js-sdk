import 'jsdom-global/register';
import EventEmitter from 'events';
import { LoginOption, WebexSDK } from '../../../../../src/types';
import { CALL_EVENT_KEYS, CallingClientConfig, LINE_EVENTS } from '@webex/calling';
import { CC_EVENTS } from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact'
import Task from '../../../../../src/services/task';
import { TASK_EVENTS } from '../../../../../src/services/task/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import config from '../../../../../src/config';

jest.mock('./../../../../../src/services/task', () => {
  return jest.fn().mockImplementation(() => {
    return {
        updateTaskData: jest.fn(),
    };
  });
});

describe('TaskManager', () => {
  let mockCall;
  let webSocketManagerMock;
  let onSpy;
  let taskManager;
  let contactMock;
  let taskDataMock;
  let webCallingService;
  let webex: WebexSDK;
  const taskId = '0ae913a4-c857-4705-8d49-76dd3dde75e4';

  beforeEach(() => {
    contactMock = contact;
    webSocketManagerMock = new EventEmitter();

    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
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
      end: jest.fn()
    };

    taskDataMock = {
      type: CC_EVENTS.AGENT_CONTACT_RESERVED,
      agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
      eventTime: 1733211616959,
      eventType: "RoutingMessage",
      interaction: {},
      interactionId: taskId,
      orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
      trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
      mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
      destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
      owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      queueMgr: 'aqm',
    };

    webCallingService.loginOption = LoginOption.BROWSER;
    webCallingService.call = mockCall;
    onSpy = jest.spyOn(webCallingService, 'on');

    taskManager = new TaskManager(contactMock, webCallingService, webSocketManagerMock);
    taskManager.currentTask = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      unregisterWebCallListeners: jest.fn(),
      data: taskDataMock
    }
    taskManager.call = mockCall;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize TaskManager and register listeners', () => {
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
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: "0ae913a4-c857-4705-8d49-76dd3dde75e4",
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(Task).toHaveBeenCalledWith(contactMock, webCallingService , payload.data);
    expect(taskIncomingSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, taskManager.currentTask);
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.currentTask);
    expect(taskManager.getAllTasks()).toHaveProperty(payload.data.interactionId);

    const assignedPayload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: "0ae913a4-c857-4705-8d49-76dd3dde75e4",
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const taskAssignedSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(assignedPayload));

    expect(taskAssignedSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_ASSIGNED, taskManager.currentTask);
  });

  it('should handle WebSocket message for AGENT_CONTACT_RESERVED and emit task:incoming for extension case', () => {
    webCallingService.loginOption = LoginOption.EXTENSION;
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: "0ae913a4-c857-4705-8d49-76dd3dde75e4",
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(Task).toHaveBeenCalledWith(contactMock, webCallingService , payload.data);
    expect(taskIncomingSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, taskManager.currentTask);
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
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: taskId,
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm'
      }
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
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: taskId1,
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm'
      }
    };

    const mockTask2 = {
      accept: jest.fn(),
      decline: jest.fn(),
      updateTaskData: jest.fn(),
      data: {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: taskId2,
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm'
      }
    };

    taskManager.taskCollection[taskId1] = mockTask1;
    taskManager.taskCollection[taskId2] = mockTask2;

    const allTasks = taskManager.getAllTasks();

    expect(allTasks).toHaveProperty(taskId1, mockTask1);
    expect(allTasks).toHaveProperty(taskId2, mockTask2);
  });

  it('test call listeners being switched off on call end', () => {
    const taskEmitSpy = jest.spyOn(taskManager, 'emit');
    const webCallingServiceOffSpy = jest.spyOn(webCallingService, 'off');
    const callOffSpy = jest.spyOn(mockCall, 'off');
    const payload = {
      data: {
        type: CC_EVENTS.CONTACT_ENDED,
        agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
        eventTime: 1733211616959,
        eventType: "RoutingMessage",
        interaction: {},
        interactionId: taskId,
        orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
        trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
      },
    };

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_UNASSIGNED, taskManager.currentTask);
    expect(taskManager.currentTask.unregisterWebCallListeners).toHaveBeenCalledWith();
    expect(callOffSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, callOffSpy.mock.calls[0][1]);

    taskManager.unregisterIncomingCallEvent();
    expect(webCallingServiceOffSpy).toHaveBeenCalledWith(LINE_EVENTS.INCOMING_CALL, webCallingServiceOffSpy.mock.calls[0][1]);
  });
});