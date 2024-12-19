import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {ITask, TASK_EVENTS, TaskId} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {CC_EVENTS} from '../config/types';
import {LoginOption} from '../../types';
import LoggerProxy from '../../logger-proxy';
import Task from '.';

export default class TaskManager extends EventEmitter {
  private call: ICall;
  private contact: ReturnType<typeof routingContact>;
  private taskCollection: Record<TaskId, ITask>;
  private webCallingService: WebCallingService;
  private webSocketManager: WebSocketManager;
  private static taskManager;
  public currentTask: ITask;

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

  private handleIncomingWebCall = (call: ICall) => {
    if (this.currentTask) {
      this.emit(TASK_EVENTS.TASK_INCOMING, this.currentTask);
    }
    this.call = call;
  };

  public registerIncomingCallEvent() {
    this.webCallingService.on(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  public unregisterIncomingCallEvent() {
    this.webCallingService.off(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      const payload = JSON.parse(event);
      if (payload.data) {
        switch (payload.data.type) {
          case CC_EVENTS.AGENT_CONTACT_RESERVED:
            this.currentTask = new Task(this.contact, this.webCallingService, payload.data);

            this.taskCollection[payload.data.interactionId] = this.currentTask;
            if (this.webCallingService.loginOption !== LoginOption.BROWSER) {
              this.emit(TASK_EVENTS.TASK_INCOMING, this.currentTask);
            } else if (this.call) {
              this.emit(TASK_EVENTS.TASK_INCOMING, this.currentTask);
            }
            break;
          case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
            this.currentTask = this.currentTask.updateTaskData(payload.data);
            this.currentTask.emit(TASK_EVENTS.TASK_ASSIGNED, this.currentTask);
            break;
          case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
          case CC_EVENTS.CONTACT_ENDED:
            if (this.currentTask.data.interaction.state === 'new') {
              this.currentTask.emit(TASK_EVENTS.TASK_END, {wrapupRequired: false});
              if (this.webCallingService.loginOption === LoginOption.BROWSER) {
                this.currentTask.unregisterWebCallListeners();
                this.webCallingService.unregisterCallListeners();
              }
              this.removeCurrentTaskFromCollection();
            }
            break;
          case CC_EVENTS.AGENT_WRAPUP:
            this.currentTask = this.currentTask.updateTaskData(payload.data);
            this.currentTask.emit(TASK_EVENTS.TASK_END, {wrapupRequired: true});
            break;
          case CC_EVENTS.AGENT_WRAPPEDUP:
            this.removeCurrentTaskFromCollection();
            break;
          default:
            break;
        }
      }
    });
  }

  private removeCurrentTaskFromCollection() {
    if (this.currentTask && this.currentTask.data && this.currentTask.data.interactionId) {
      delete this.taskCollection[this.currentTask.data.interactionId];
      LoggerProxy.info(`Task removed from collection: ${this.currentTask.data.interactionId}`, {
        module: TASK_MANAGER_FILE,
        method: 'removeCurrentTaskFromCollection',
      });
    }
  }

  /**
   * @param taskId - Unique identifier for each task
   */
  public getTask = (taskId: string) => {
    return this.taskCollection[taskId];
  };

  /**
   * @param taskId - Unique identifier for each task
   */
  public getAllTasks = (): Record<TaskId, ITask> => {
    return this.taskCollection;
  };

  /**
   * @param contact - Routing Contact layer. Talks to AQMReq layer to convert events to promises
   * @param webCallingService - Webrtc Service Layer
   * @param webSocketManager - Websocket Manager to maintain websocket connection and keepalives
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
