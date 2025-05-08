import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {ITask, MEDIA_CHANNEL, TASK_EVENTS, TaskData, TaskId} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {CC_EVENTS, CC_TASK_EVENTS} from '../config/types';
import {LoginOption} from '../../types';
import LoggerProxy from '../../logger-proxy';
import Task from '.';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';

export default class TaskManager extends EventEmitter {
  private call: ICall;
  private contact: ReturnType<typeof routingContact>;
  private taskCollection: Record<TaskId, ITask>;
  private webCallingService: WebCallingService;
  private webSocketManager: WebSocketManager;
  private metricsManager: MetricsManager;
  private static taskManager;

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
    this.metricsManager = MetricsManager.getInstance();
    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  private handleIncomingWebCall = (call: ICall) => {
    const currentTask = Object.values(this.taskCollection).find(
      (task) => task.data.interaction.mediaType === 'telephony'
    );

    if (currentTask) {
      this.webCallingService.mapCallToTask(call.getCallId(), currentTask.data.interactionId);
      LoggerProxy.log('Call mapped to task', {
        module: TASK_MANAGER_FILE,
        method: 'handleIncomingWebCall',
      });
      this.emit(TASK_EVENTS.TASK_INCOMING, currentTask);
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
      // Re-emit the task events to the task object
      let task: ITask;
      if (payload.data?.type) {
        if (Object.values(CC_TASK_EVENTS).includes(payload.data.type)) {
          task = this.taskCollection[payload.data.interactionId];
        }
        switch (payload.data.type) {
          case CC_EVENTS.AGENT_CONTACT:
            task = new Task(this.contact, this.webCallingService, {
              ...payload.data,
              wrapUpRequired:
                payload.data.interaction?.participants?.[payload.data.agentId]?.isWrapUp || false,
            });
            this.taskCollection[payload.data.interactionId] = task;
            this.emit(TASK_EVENTS.TASK_HYDRATE, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_RESERVED:
            task = new Task(this.contact, this.webCallingService, {
              ...payload.data,
              isConsulted: false,
            }); // Ensure isConsulted prop exists
            this.taskCollection[payload.data.interactionId] = task;
            if (
              this.webCallingService.loginOption !== LoginOption.BROWSER ||
              task.data.interaction.mediaType !== MEDIA_CHANNEL.TELEPHONY // for digital channels
            ) {
              this.emit(TASK_EVENTS.TASK_INCOMING, task);
            } else if (this.call) {
              this.emit(TASK_EVENTS.TASK_INCOMING, task);
            }
            break;
          case CC_EVENTS.AGENT_OFFER_CONTACT:
            // We don't have to emit any event here since this will be result of promise.
            task = this.updateTaskData(task, payload.data);
            LoggerProxy.log('Agent offer contact', {
              module: TASK_MANAGER_FILE,
              method: 'registerTaskListeners',
            });
            break;
          case CC_EVENTS.AGENT_OUTBOUND_FAILED:
            // We don't have to emit any event here since this will be result of promise.
            if (task.data) {
              this.removeTaskFromCollection(task);
            }
            LoggerProxy.log('Agent outbound failed', {
              module: TASK_MANAGER_FILE,
              method: 'registerTaskListeners',
            });
            break;
          case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
            task = this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_ASSIGNED, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
            task = this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: true,
            });
            task.emit(TASK_EVENTS.TASK_END, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
            task = this.updateTaskData(task, payload.data);
            this.metricsManager.trackEvent(
              METRIC_EVENT_NAMES.AGENT_RONA,
              {
                ...MetricsManager.getCommonTrackingFieldForAQMResponse(payload.data),
                taskId: payload.data.interactionId,
                reason: payload.data.reason,
              },
              ['behavioral', 'operational']
            );
            this.handleTaskCleanup(task);
            task.emit(TASK_EVENTS.TASK_REJECT, payload.data.reason);
            break;
          case CC_EVENTS.CONTACT_ENDED:
            task = this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: payload.data.interaction.state !== 'new',
            });
            this.handleTaskCleanup(task);
            task.emit(TASK_EVENTS.TASK_END, task);

            break;
          case CC_EVENTS.AGENT_CONTACT_HELD:
            // As soon as the main interaction is held, we need to emit TASK_HOLD
            task = this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_HOLD, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_UNHELD:
            // As soon as the main interaction is unheld, we need to emit TASK_RESUME
            task = this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RESUME, task);
            break;
          case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
            task = this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: true,
            });
            task.emit(TASK_EVENTS.TASK_END, task);
            break;
          case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
            task = this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED, task);
            break;
          case CC_EVENTS.AGENT_CONSULT_CREATED:
            // Received when self agent initiates a consult
            task = this.updateTaskData(task, {
              ...payload.data,
              isConsulted: false, // This ensures that the task consult status is always reset
            });
            // Do not emit anything since this be received only as a result of an API invocation(handled by a promise)
            break;
          case CC_EVENTS.AGENT_OFFER_CONSULT:
            // Received when other agent sends us a consult offer
            task = this.updateTaskData(task, {
              ...payload.data,
              isConsulted: true, // This ensures that the task is marked as us being requested for a consult
            });

            break;
          case CC_EVENTS.AGENT_CONSULTING:
            // Received when agent is in an active consult state
            task = this.updateTaskData(task, payload.data);
            if (task.data.isConsulted) {
              // Fire only if you are the agent who received the consult request
              task.emit(TASK_EVENTS.TASK_CONSULT_ACCEPTED, task);
            } else {
              // Fire only if you are the agent who initiated the consult
              task.emit(TASK_EVENTS.TASK_CONSULTING, task);
            }
            break;
          case CC_EVENTS.AGENT_CONSULT_FAILED:
            // This can only be received by the agent who initiated the consult.
            // We need not emit any event here since this will be result of promise
            task = this.updateTaskData(task, payload.data);
            break;
          case CC_EVENTS.AGENT_CONSULT_ENDED:
            task = this.updateTaskData(task, payload.data);
            if (task.data.isConsulted) {
              // This will be the end state of the task as soon as we end the consult in case of
              // us being offered a consult
              this.removeTaskFromCollection(task);
            }
            task.emit(TASK_EVENTS.TASK_CONSULT_END, task);
            break;
          case CC_EVENTS.AGENT_CTQ_CANCELLED:
            // This event is received when the consult using queue is cancelled using API
            task = this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED, task);
            break;
          case CC_EVENTS.AGENT_WRAPUP:
            task = this.updateTaskData(task, payload.data);
            break;
          case CC_EVENTS.AGENT_WRAPPEDUP:
            this.removeTaskFromCollection(task);
            break;
          default:
            break;
        }
        if (task) {
          task.emit(payload.data.type, payload.data);
        }
      }
    });
  }

  private updateTaskData(task: ITask, taskData: TaskData): ITask {
    if (!task) {
      return undefined;
    }

    if (!taskData?.interactionId) {
      LoggerProxy.warn('Received task update with missing interactionId', {
        module: TASK_MANAGER_FILE,
        method: 'updateTaskData',
      });
    }

    try {
      const currentTask = task.updateTaskData(taskData);
      this.taskCollection[taskData.interactionId] = currentTask;

      return currentTask;
    } catch (error) {
      LoggerProxy.error(`Failed to update task ${taskData.interactionId}`, {
        module: TASK_MANAGER_FILE,
        method: 'updateTaskData',
      });

      return task;
    }
  }

  private removeTaskFromCollection(task: ITask) {
    if (task?.data?.interactionId) {
      delete this.taskCollection[task.data.interactionId];
      LoggerProxy.info(`Task removed from collection: ${task.data.interactionId}`, {
        module: TASK_MANAGER_FILE,
        method: 'removeTaskFromCollection',
      });
    }
  }

  private handleTaskCleanup(task: ITask) {
    if (
      this.webCallingService.loginOption === LoginOption.BROWSER &&
      task.data.interaction.mediaType === 'telephony'
    ) {
      task.unregisterWebCallListeners();
      this.webCallingService.cleanUpCall();
    }
    if (task.data.interaction.state === 'new') {
      // Only remove tasks in 'new' state immediately. For other states,
      // retain tasks until they complete wrap-up, unless the task disconnected before being answered.
      this.removeTaskFromCollection(task);
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
