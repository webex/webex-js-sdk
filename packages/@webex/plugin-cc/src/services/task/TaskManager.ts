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
      if (this.currentTask.data.interaction.mediaChannel === 'telephony') {
        this.webCallingService.mapCallToTask(call.getCallId(), this.currentTask.data.interactionId);
        LoggerProxy.log('Call mapped to task', {
          module: TASK_MANAGER_FILE,
          method: 'handleIncomingWebCall',
        });
      }
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
            this.currentTask.data = {...this.currentTask.data, isConsulted: false}; // Ensure isConsulted prop exists
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
            this.currentTask.emit(TASK_EVENTS.TASK_REJECT, payload.data.reason);
            this.handleTaskCleanup();
            break;
          case CC_EVENTS.CONTACT_ENDED:
            this.currentTask.emit(TASK_EVENTS.TASK_END, {wrapupRequired: false});
            this.handleTaskCleanup();
            break;
          case CC_EVENTS.AGENT_CONTACT_HELD:
            // As soon as the main interaction is held, we need to emit TASK_HOLD
            this.updateCurrentTaskDataAndEmitEvent(payload.data, TASK_EVENTS.TASK_HOLD);
            break;
          case CC_EVENTS.AGENT_CONTACT_UNHELD:
            // As soon as the main interaction is unheld, we need to emit TASK_RESUME
            this.updateCurrentTaskDataAndEmitEvent(payload.data, TASK_EVENTS.TASK_RESUME);
            break;
          case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
            this.updateCurrentTaskDataAndEmitEvent(
              payload.data,
              TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED
            );
            break;
          case CC_EVENTS.AGENT_CONSULT_CREATED:
            // Received when self agent initiates a consult
            this.currentTask = this.currentTask.updateTaskData(payload.data);
            // Do not emit anything since this be received only as a result of an API invocation(handled by a promise)
            break;
          case CC_EVENTS.AGENT_OFFER_CONSULT: {
            // Received when other agent sends us a consult offer
            this.currentTask = this.currentTask.updateTaskData({
              ...payload.data,
              isConsulted: true, // This ensures that the task is marked as us being requested for a consult
            });
            break;
          }
          case CC_EVENTS.AGENT_CONSULTING:
            // Received when agent is in an active consult state
            this.currentTask = this.currentTask.updateTaskData(payload.data);
            if (this.currentTask.data.isConsulted) {
              // Fire only if you are the agent who received the consult request
              this.currentTask.emit(TASK_EVENTS.TASK_CONSULT_ACCEPTED, this.currentTask);
            }
            break;
          case CC_EVENTS.AGENT_CONSULT_FAILED:
            // This can only be received by the agent who initiated the consult.
            // We need not emit any event here since this will be result of promise
            this.currentTask.updateTaskData(payload.data);
            break;
          case CC_EVENTS.AGENT_CONSULT_ENDED:
            this.updateCurrentTaskDataAndEmitEvent(payload.data, TASK_EVENTS.TASK_CONSULT_END);
            if (this.currentTask.data.isConsulted) {
              // This will be the end state of the task as soon as we end the consult in case of
              // us being offered a consult
              this.removeCurrentTaskFromCollection();
            }
            break;
          case CC_EVENTS.AGENT_CTQ_CANCELLED:
            // This event is received when the consult using queue is cancelled using API
            this.updateCurrentTaskDataAndEmitEvent(
              payload.data,
              TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED
            );
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

  private updateCurrentTaskDataAndEmitEvent(taskData, event) {
    this.currentTask = this.currentTask.updateTaskData(taskData);
    this.currentTask.emit(event, this.currentTask);
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

  private handleTaskCleanup() {
    if (this.webCallingService.loginOption === LoginOption.BROWSER) {
      this.currentTask.unregisterWebCallListeners();
      this.webCallingService.cleanUpCall();
    }
    this.removeCurrentTaskFromCollection();
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
