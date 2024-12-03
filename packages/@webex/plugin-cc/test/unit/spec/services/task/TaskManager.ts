import 'jsdom-global/register';
import EventEmitter from 'events';
import { LoginOption } from '../../../../../src/types';
import { LINE_EVENTS } from '@webex/calling';
import { CC_EVENTS } from '../../../../../src/services/config/types';
import TaskManager from '../../../../../src/services/task/TaskManager';
import * as contact from '../../../../../src/services/task/contact'
import { TaskData } from '../../../../../src/services/task/types';
import Task from '../../../../../src/services/task';

jest.mock('./../../../../../src/services/task', () => {
  return jest.fn().mockImplementation(() => {
    return {
      // Optionally mock methods or properties on the Task instance here
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

  it('should handle incoming call event and emit TASK_INCOMING', () => {
    const callMock = jest.fn();

    taskManager.on('task:incoming', (task) => {
      expect(task).toBe(taskManager.task);
    });

    webCallingServiceMock.emit(LINE_EVENTS.INCOMING_CALL, callMock);

    expect(taskManager.call).toBe(callMock);
    if (taskManager.task) {
      expect(taskManager.emit).toHaveBeenCalledWith('taskIncoming', taskManager.task);
    }
  });

  it('should handle WebSocket message and manage tasks', () => {
    const interactionId = '12345';
    const payload = {
      data: {
        type: CC_EVENTS.AGENT_CONTACT_RESERVED,
        
      },
    };

    const mockData: TaskData = {
      "agentId": "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
      "eventTime": 1733211616959,
      "eventType": "RoutingMessage",
      "interaction": expect.any(Object),
      "interactionId": "0ae913a4-c857-4705-8d49-76dd3dde75e4",
      "orgId": "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
      "trackingId": "575c0ec2-618c-42af-a61c-53aeb0a221ee",
      "type": "AgentContactReserved",
      mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
      destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
      consultMediaResourceId: '',
      owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      queueMgr: '',
      isConferencing: false
    }

    webSocketManagerMock.emit('message', JSON.stringify(mockData));

    expect(Task).toHaveBeenCalledWith(contactMock, webCallingServiceMock , payload.data);
    expect(taskManager.getTask(interactionId)).toBe(taskManager.task);
    expect(taskManager.getAllTasks()).toHaveProperty(interactionId);
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