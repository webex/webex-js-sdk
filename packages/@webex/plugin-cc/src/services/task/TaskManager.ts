import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {ITask, TASK_EVENTS, TaskId} from './types';
import {CC_EVENTS} from '../config/types';
import {LoginOption} from '../../types';
import Task from '.';

export default class TaskManager extends EventEmitter {
  private call: ICall;
  private contact: ReturnType<typeof routingContact>;
  private taskCollection: Record<TaskId, ITask>;
  private webCallingService: WebCallingService;
  private webSocketManager: WebSocketManager;
  private static taskManager;
  public task: ITask;

  /**
   * @param contact - Routing Contact layer. Talks to AQMReq layer to convert events to promises
   * @param webCallingService - Webrtc Service Layer
   * @param webSocketManager - Websocket Manager to maintain websocket connection and keepalives
   */
  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager
  ) {
    super();
    this.contact = contact;
    this.taskCollection = {};
    this.webCallingService = webCallingService;
    this.webSocketManager = webSocketManager;
    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  private registerIncomingCallEvent() {
    this.webCallingService.on(LINE_EVENTS.INCOMING_CALL, (call) => {
      if (this.task) {
        this.emit(TASK_EVENTS.TASK_INCOMING, this.task);
      }
      this.call = call;
    });
  }

  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      const payload = JSON.parse(event);
      if (payload.data) {
        switch (payload.data.type) {
          case CC_EVENTS.AGENT_CONTACT_RESERVED:
            this.task = new Task(this.contact, this.webCallingService, payload.data);

            this.taskCollection[payload.data.interactionId] = this.task;
            if (this.webCallingService.loginOption !== LoginOption.BROWSER) {
              this.emit(TASK_EVENTS.TASK_INCOMING, this.task);
            } else if (this.call) {
              this.emit(TASK_EVENTS.TASK_INCOMING, this.task);
            }
            break;
          case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
            this.task = this.task.updateTaskData(payload.data);
            this.emit(TASK_EVENTS.TASK_ASSIGNED, this.task);
            break;
          default:
            break;
        }
      }
    });
  }

  /**
   * @param taskId - string.
   */
  public getTask = (taskId: string) => {
    return this.taskCollection[taskId];
  };

  /**
   *
   */
  public getAllTasks = (): Record<TaskId, ITask> => {
    return this.taskCollection;
  };

  /**
   * webSocketManager - WebSocketManager
   */
  public static getTaskManager = (
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager
  ): TaskManager => {
    if (!this.taskManager) {
      this.taskManager = new TaskManager(contact, webCallingService, webSocketManager);
    }

    return this.taskManager;
  };
}
