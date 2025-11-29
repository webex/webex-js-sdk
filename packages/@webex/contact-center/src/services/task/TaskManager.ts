import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {ITask, MEDIA_CHANNEL, TASK_EVENTS, TaskData, TaskId} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {METHODS} from './constants';
import {CC_EVENTS, CC_TASK_EVENTS, WrapupData} from '../config/types';
import {ConfigFlags, LoginOption} from '../../types';
import LoggerProxy from '../../logger-proxy';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import TaskFactory from './TaskFactory';
import WebRTC from './voice/WebRTC';
import {TaskEvent, type TaskEventPayload} from './state-machine';
import {normalizeTaskData} from './taskDataNormalizer';

type WebSocketPayload = TaskData & {
  type: CC_EVENTS | string;
  mediaResourceId?: string;
  reason?: string;
};

type WebSocketMessage = {
  keepalive?: 'true' | 'false' | boolean;
  data: WebSocketPayload;
};
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
  private static taskManager;
  private wrapupData: WrapupData;
  private agentId: string;
  private configFlags?: ConfigFlags;
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
    this.webCallingService = webCallingService;
    this.webSocketManager = webSocketManager;
    this.taskCollection = {};
    this.metricsManager = MetricsManager.getInstance();
    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  public setWrapupData(wrapupData: WrapupData) {
    this.wrapupData = wrapupData;
  }

  public setAgentId(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Gets the current agent ID
   * @returns {string} The agent ID set for this task manager instance
   * @public
   */
  public getAgentId(): string {
    return this.agentId;
  }

  private handleIncomingWebCall = (call: ICall) => {
    const currentTask = Object.values(this.taskCollection).find(
      (task) => task.data.interaction.mediaType === 'telephony'
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

  /**
   * Map WebSocket CC_EVENTS to state machine TaskEvent
   * @param ccEvent - The CC_EVENT type from WebSocket
   * @param payload - The event payload
   * @returns TaskEventPayload for state machine or null if no mapping
   */
  private static mapEventToTaskStateMachineEvent(
    ccEvent: CC_EVENTS,
    payload: WebSocketPayload
  ): TaskEventPayload | null {
    const mediaResourceId =
      payload.mediaResourceId ||
      payload.interaction?.media?.[payload.interactionId]?.mediaResourceId;

    switch (ccEvent) {
      case CC_EVENTS.AGENT_CONTACT_RESERVED:
      case CC_EVENTS.AGENT_OFFER_CONTACT:
        return {type: TaskEvent.OFFER, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CONSULT:
        return {type: TaskEvent.OFFER_CONSULT, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        return {type: TaskEvent.ASSIGN, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT_HELD:
        return {type: TaskEvent.HOLD, mediaResourceId: mediaResourceId || ''};

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        return {type: TaskEvent.UNHOLD, mediaResourceId: mediaResourceId || ''};

      case CC_EVENTS.AGENT_CONSULT_CREATED:
        return {type: TaskEvent.CONSULT_CREATED, taskData: payload};

      case CC_EVENTS.AGENT_CONSULTING:
        return {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
        };

      case CC_EVENTS.AGENT_CONSULT_ENDED:
        return {type: TaskEvent.CONSULT_END};

      case CC_EVENTS.AGENT_CONSULT_FAILED:
        return {type: TaskEvent.CONSULT_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        return {type: TaskEvent.CTQ_CANCEL};

      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
      case CC_EVENTS.AGENT_WRAPUP:
      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        return {type: TaskEvent.WRAPUP_START};

      case CC_EVENTS.CONTACT_ENDED:
        return {type: TaskEvent.CONTACT_ENDED};

      case CC_EVENTS.AGENT_INVITE_FAILED:
        return {type: TaskEvent.INVITE_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
        return {type: TaskEvent.RONA};

      case CC_EVENTS.CONTACT_RECORDING_STARTED:
        return {type: TaskEvent.RECORDING_STARTED, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_PAUSED:
        return {type: TaskEvent.PAUSE_RECORDING};

      case CC_EVENTS.CONTACT_RECORDING_RESUMED:
        return {type: TaskEvent.RESUME_RECORDING};

      default:
        // Not all events need state machine mapping
        return null;
    }
  }

  /**
   * Send WebSocket event to state machine if task exists
   * @param ccEvent - The CC_EVENT type
   * @param payload - The event payload
   * @param task - The task instance
   */
  private sendEventToStateMachine(
    ccEvent: CC_EVENTS,
    payload: WebSocketPayload,
    task?: ITask
  ): void {
    // Check if task has state machine (will be added in Task interface)
    const taskWithStateMachine = task as any;
    if (!taskWithStateMachine?.stateMachineService) {
      return;
    }

    const stateMachineEvent = TaskManager.mapEventToTaskStateMachineEvent(ccEvent, payload);

    if (stateMachineEvent) {
      LoggerProxy.log(`Sending event to state machine: ${ccEvent} -> ${stateMachineEvent.type}`, {
        module: TASK_MANAGER_FILE,
        method: 'sendEventToStateMachine',
        interactionId: payload.interactionId,
      });

      // Send event to task's state machine
      taskWithStateMachine.stateMachineService.send(stateMachineEvent);
    }
  }

  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      const payload = JSON.parse(event) as WebSocketMessage;
      if (payload?.keepalive === 'true' || payload?.keepalive === true) {
        return;
      }
      if (payload?.data?.interaction) {
        payload.data = normalizeTaskData(payload.data);
      }
      // Re-emit the task events to the task object
      let task: ITask;
      if (payload.data?.type) {
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
            if (!task) {
              // Re-create task if it does not exist
              // This can happen when the task is created after the event is received (multi session)
              task = TaskFactory.createTask(
                this.contact,
                this.webCallingService,
                {...payload.data, isConsulted: false},
                this.configFlags
              );
              this.taskCollection[payload.data.interactionId] = task;
            }
            this.updateTaskData(task, payload.data);
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
            // We don't have to emit any event here since this will be result of promise.
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
          case CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED:
          case CC_EVENTS.AGENT_INVITE_FAILED: {
            this.updateTaskData(task, payload.data);

            const eventTypeToMetricMap: Record<string, keyof typeof METRIC_EVENT_NAMES> = {
              [CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED]: 'AGENT_CONTACT_ASSIGN_FAILED',
              [CC_EVENTS.AGENT_INVITE_FAILED]: 'AGENT_INVITE_FAILED',
            };
            const metricEventName: keyof typeof METRIC_EVENT_NAMES =
              eventTypeToMetricMap[payload.data.type] || 'AGENT_RONA';

            this.metricsManager.trackEvent(
              METRIC_EVENT_NAMES[metricEventName],
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
          }
          case CC_EVENTS.CONTACT_ENDED:
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
            task.emit(TASK_EVENTS.TASK_RESUME, task);
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
            // TODO: Check if we can use backend consult state instead of isConsulted
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
            this.updateTaskData(task, {...payload.data, wrapUpRequired: true});
            task.emit(TASK_EVENTS.TASK_END, task);
            break;
          case CC_EVENTS.AGENT_WRAPPEDUP:
            task.cancelAutoWrapupTimer();
            this.removeTaskFromCollection(task);
            task.emit(TASK_EVENTS.TASK_WRAPPEDUP, task);
            break;
          case CC_EVENTS.CONTACT_RECORDING_STARTED:
            this.updateTaskData(task, payload.data);
            task.emit(TASK_EVENTS.TASK_RECORDING_STARTED, task);
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
          case CC_EVENTS.CONSULTED_PARTICIPANT_MOVING:
            // Participant is being moved/transferred - update task state with movement info
            this.updateTaskData(task, payload.data);
            break;
          case CC_EVENTS.PARTICIPANT_POST_CALL_ACTIVITY:
            // Post-call activity for participant - update task state with activity details
            this.updateTaskData(task, payload.data);
            break;
          default:
            break;
        }

        // Send all events to state machine after processing
        // Task may have been created in AGENT_CONTACT or AGENT_CONTACT_RESERVED cases
        if (task) {
          task.emit(payload.data.type, payload.data);

          // Send event to state machine for all events
          this.sendEventToStateMachine(payload.data.type as CC_EVENTS, payload.data, task);
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
        method: METHODS.UPDATE_TASK_DATA,
      });
    }

    try {
      const currentTask = task.updateTaskData(taskData);
      this.taskCollection[taskData.interactionId] = currentTask;

      return currentTask;
    } catch (error) {
      LoggerProxy.error(`Failed to update task`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.UPDATE_TASK_DATA,
        interactionId: taskData.interactionId,
      });

      return task;
    }
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
