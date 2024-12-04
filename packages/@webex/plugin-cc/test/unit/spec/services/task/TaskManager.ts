import 'jsdom-global/register';
import EventEmitter from 'events';
import { LoginOption } from '../../../../../src/types';
import { LINE_EVENTS } from '@webex/calling';
import { CC_EVENTS } from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact'
import Task from '../../../../../src/services/task';
import { TASK_EVENTS } from '../../../../../src/services/task/types';

jest.mock('./../../../../../src/services/task', () => {
  return jest.fn().mockImplementation(() => {
    return {
        updateTaskData: jest.fn(),
    };
  });
});

describe('TaskManager', () => {
  let taskManager;
  let contactMock;
  let webCallingServiceMock ;
  let webSocketManagerMock;

  beforeEach(() => {
    contactMock = contact;
    webCallingServiceMock = new EventEmitter();
    webSocketManagerMock = new EventEmitter();

    webCallingServiceMock.loginOption = LoginOption.BROWSER;

    taskManager = new TaskManager(contactMock, webCallingServiceMock, webSocketManagerMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize TaskManager and register listeners', () => {
    expect(taskManager).toBeInstanceOf(TaskManager);
    expect(webCallingServiceMock.listenerCount(LINE_EVENTS.INCOMING_CALL)).toBe(1);
    expect(webSocketManagerMock.listenerCount('message')).toBe(1);
  });

  it('should handle WebSocket message for AGENT_CONTACT_RESERVED and emit task:incoming', () => {
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

    taskManager.call = {
      answer: jest.fn(),
      mute: jest.fn(),
      isMuted: jest.fn().mockReturnValue(true),
      end: jest.fn()
    };

    const taskIncomingSpy = jest.spyOn(taskManager, 'emit');

    webSocketManagerMock.emit('message', JSON.stringify(payload));

    expect(Task).toHaveBeenCalledWith(contactMock, webCallingServiceMock , payload.data);
    expect(taskIncomingSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_INCOMING, taskManager.task);
    expect(taskManager.getTask(payload.data.interactionId)).toBe(taskManager.task);
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

    expect(taskAssignedSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_ASSIGNED, taskManager.task);
  });

  it('should return task by ID', () => {
    const taskId = 'task123';
    const mockTask = jest.fn();
    taskManager.taskCollection[taskId] = mockTask;

    expect(taskManager.getTask(taskId)).toBe(mockTask);
  });

  it('should return all tasks', () => {
    const taskId1 = 'task123';
    const taskId2 = 'task456';
    const mockTask1 = jest.fn();
    const mockTask2 = jest.fn();

    taskManager.taskCollection[taskId1] = mockTask1;
    taskManager.taskCollection[taskId2] = mockTask2;

    const allTasks = taskManager.getAllTasks();

    expect(allTasks).toHaveProperty(taskId1, mockTask1);
    expect(allTasks).toHaveProperty(taskId2, mockTask2);
  });
});