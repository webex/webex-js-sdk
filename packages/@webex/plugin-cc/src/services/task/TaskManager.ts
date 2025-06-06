import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {MEDIA_CHANNEL, TASK_EVENTS, TaskData, TaskId, ITask} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {METHODS} from './constants';
import {CC_EVENTS, CC_TASK_EVENTS} from '../config/types';
import {ConfigFlags, LoginOption} from '../../types';
import LoggerProxy from '../../logger-proxy';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import TaskFactory from './TaskFactory';
import WebRTC from './voice/WebRTC';

/** @internal */
export default class TaskManager extends EventEmitter {
  private call: ICall;
  private contact: ReturnType<typeof routingContact>;
  /**
   * Collection of tasks indexed by TaskId
   * @type {Record<TaskId, ITask>}
   * @private
   */
  private taskCollection: Record<TaskId, ITask>;
  private webCallingService: WebCallingService;
  private webSocketManager: WebSocketManager;
  private metricsManager: MetricsManager;
  private static taskManager: TaskManager;
  private configFlags?: ConfigFlags;

  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager
  ) {
    super();
    this.contact = contact;
    this.webCallingService = webCallingService;
    this.webSocketManager = webSocketManager;
    this.taskCollection = {};
    this.metricsManager = MetricsManager.getInstance();

    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  private handleIncomingWebCall = (call: ICall) => {
    const currentTask = Object.values(this.taskCollection).find(
      (t) => t.data.interaction.mediaType === MEDIA_CHANNEL.TELEPHONY
    );

    if (currentTask) {
      this.webCallingService.mapCallToTask(call.getCallId(), currentTask.data.interactionId);
      LoggerProxy.log(`Call mapped to task`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.HANDLE_INCOMING_WEB_CALL,
        interactionId: currentTask.data.interactionId,
      });
      this.emit(TASK_EVENTS.TASK_INCOMING, currentTask);
    }
    this.call = call;
  };

  /**
   * Inject agent profile after instantiation
   */
  public setConfigFlags(configFlags: ConfigFlags): void {
    this.configFlags = configFlags;
  }

  public registerIncomingCallEvent() {
    this.webCallingService.on(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  public unregisterIncomingCallEvent() {
    this.webCallingService.off(LINE_EVENTS.INCOMING_CALL, this.handleIncomingWebCall);
  }

  private registerTaskListeners() {
    this.webSocketManager.on('message', (event: string) => {
      const payload = JSON.parse(event);
      let task: ITask;

      if (payload.data?.type) {
        // for events emitted on existing tasks
        if (Object.values(CC_TASK_EVENTS).includes(payload.data.type)) {
          task = this.taskCollection[payload.data.interactionId];
        }
        LoggerProxy.info(`Handling task event ${payload.data?.type}`, {
          module: TASK_MANAGER_FILE,
          method: METHODS.REGISTER_TASK_LISTENERS,
          interactionId: payload.data?.interactionId,
        });
        switch (payload.data.type) {
          case CC_EVENTS.AGENT_CONTACT:
            this.taskCollection[payload.data.interactionId] = task;
            this.emit(TASK_EVENTS.TASK_HYDRATE, task);
            break;

          case CC_EVENTS.AGENT_CONTACT_RESERVED:
            task = TaskFactory.createTask(
              this.contact,
              this.webCallingService,
              {...payload.data, isConsulted: false},
              this.configFlags
            );
            this.taskCollection[payload.data.interactionId] = task;
            // for telephony in-browser we wait for incoming call, else fire immediately
            if (
              this.webCallingService.loginOption !== LoginOption.BROWSER ||
              task.data.interaction.mediaType !== MEDIA_CHANNEL.TELEPHONY ||
              this.call
            ) {
              this.emit(TASK_EVENTS.TASK_INCOMING, task);
            }
            break;
          case CC_EVENTS.AGENT_OFFER_CONTACT:
            this.updateTaskData(task, payload.data);
            LoggerProxy.log(`Agent offer contact received for task`, {
              module: TASK_MANAGER_FILE,
              method: METHODS.REGISTER_TASK_LISTENERS,
              interactionId: payload.data?.interactionId,
            });
            this.emit(TASK_EVENTS.TASK_OFFER_CONTACT, task);
            break;
          case CC_EVENTS.AGENT_OUTBOUND_FAILED:
            if (task.data) {
              this.removeTaskFromCollection(task);
            }
            LoggerProxy.log(`Agent outbound failed for task`, {
              module: TASK_MANAGER_FILE,
              method: METHODS.REGISTER_TASK_LISTENERS,
              interactionId: payload.data?.interactionId,
            });
            break;
          case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_ASSIGNED, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
            this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: true,
            });
            task.emit(TASK_EVENTS.TASK_END, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
            this.updateTaskData(task, payload.data);
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
          case CC_EVENTS.AGENT_INVITE_FAILED:
            this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: payload.data.interaction.state !== 'new',
            });
            this.handleTaskCleanup(task);
            task.emit(TASK_EVENTS.TASK_END, task);

            break;
          case CC_EVENTS.AGENT_CONTACT_HELD:
            // As soon as the main interaction is held, we need to emit TASK_HOLD
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_HOLD, task);
            break;
          case CC_EVENTS.AGENT_CONTACT_UNHELD:
            // As soon as the main interaction is unheld, we need to emit TASK_RESUME
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_UNHOLD, task);
            break;
          case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
            this.updateTaskData(task, {
              ...payload.data,
              wrapUpRequired: true,
            });
            task.emit(TASK_EVENTS.TASK_END, task);
            break;
          case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_CONSULT_QUEUE_FAILED, task);
            break;
          case CC_EVENTS.AGENT_CONSULT_CREATED:
            // Received when self agent initiates a consult
            this.updateTaskData(task, {
              ...payload.data,
              isConsulted: false, // This ensures that the task consult status is always reset
            });
            task.emit(TASK_EVENTS.TASK_CONSULT_CREATED, task);
            break;
          case CC_EVENTS.AGENT_OFFER_CONSULT:
            // Received when other agent sends us a consult offer
            this.updateTaskData(task, {
              ...payload.data,
              isConsulted: true, // This ensures that the task is marked as us being requested for a consult
            });
            task.emit(TASK_EVENTS.TASK_OFFER_CONSULT, task);
            break;
          case CC_EVENTS.AGENT_CONSULTING:
            // Received when agent is in an active consult state
            this.updateTaskData(task, payload.data);
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
            this.updateTaskData(task, payload.data);
            break;
          case CC_EVENTS.AGENT_CONSULT_ENDED:
            this.updateTaskData(task, payload.data);
            if (task.data.isConsulted) {
              // This will be the end state of the task as soon as we end the consult in case of
              // us being offered a consult
              this.removeTaskFromCollection(task);
            }
            task.emit(TASK_EVENTS.TASK_CONSULT_END, task);
            break;
          case CC_EVENTS.AGENT_CTQ_CANCELLED:
            // This event is received when the consult using queue is cancelled using API
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_CONSULT_QUEUE_CANCELLED, task);
            break;
          case CC_EVENTS.AGENT_WRAPUP:
            this.updateTaskData(task, payload.data);
            break;
          case CC_EVENTS.AGENT_WRAPPEDUP:
            this.removeTaskFromCollection(task);
            task.emit(TASK_EVENTS.TASK_WRAPPEDUP, task);
            break;
          case CC_EVENTS.CONTACT_RECORDING_PAUSED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RECORDING_PAUSED, task);
            break;
          case CC_EVENTS.CONTACT_RECORDING_PAUSE_FAILED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED, task);
            break;
          case CC_EVENTS.CONTACT_RECORDING_RESUMED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RECORDING_RESUMED, task);
            break;
          case CC_EVENTS.CONTACT_RECORDING_RESUME_FAILED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RECORDING_RESUME_FAILED, task);
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

  private updateTaskData(task: ITask, taskData: TaskData) {
    if (!task) {
      throw new Error('Task not found for update');
    }

    task.updateTaskData(taskData);
    this.taskCollection[taskData.interactionId] = task;
  }

  private removeTaskFromCollection(task: ITask) {
    if (task?.data?.interactionId) {
      delete this.taskCollection[task.data.interactionId];
      LoggerProxy.info(`Task removed from collection`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REMOVE_TASK_FROM_COLLECTION,
        interactionId: task.data.interactionId,
      });
    }
  }

  private handleTaskCleanup(task: ITask) {
    if (
      this.webCallingService.loginOption === LoginOption.BROWSER &&
      task.data.interaction.mediaType === MEDIA_CHANNEL.TELEPHONY &&
      task instanceof WebRTC
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

  public getTask(taskId: TaskId): ITask {
    return this.taskCollection[taskId];
  }

  public getAllTasks(): Record<TaskId, ITask> {
    return {...this.taskCollection};
  }

  public static getTaskManager(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    webSocketManager: WebSocketManager
  ): TaskManager {
    if (!TaskManager.taskManager) {
      TaskManager.taskManager = new TaskManager(contact, webCallingService, webSocketManager);
    }

    return TaskManager.taskManager;
  }
}
