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
import type {TaskActionCallbacks, TaskRuntimeOptions} from './Task';

type WebSocketPayload = TaskData & {
  type: CC_EVENTS | string;
  mediaResourceId?: string;
  reason?: string;
};

type WebSocketMessage = {
  keepalive?: 'true' | 'false' | boolean;
  data: WebSocketPayload;
};

/**
 * Actions to be performed after handling an event
 *
 * These actions represent TaskManager-level concerns (task collection lifecycle,
 * resource cleanup) rather than task-level state machine concerns. The separation
 * ensures proper responsibility:
 * - TaskManager: Collection management, metrics, cleanup
 * - State Machine: Task state transitions, event emissions, UI controls
 */
interface TaskEventActions {
  task?: ITask;
  shouldCleanupTask?: boolean;
  shouldRemoveFromCollection?: boolean;
  shouldCancelAutoWrapup?: boolean;
  shouldEmitTaskIncoming?: boolean;
}

/**
 * Context for processing an event
 *
 * Contains all information needed to process a WebSocket event:
 * - Event type and payload from the backend
 * - Task instance (if exists)
 * - Pre-mapped state machine event (if applicable)
 * - Task state flags (e.g., was this a consulted task)
 */
interface EventContext {
  eventType: CC_EVENTS;
  payload: WebSocketPayload;
  task?: ITask;
  stateMachineEvent?: TaskEventPayload | null;
  wasConsultedTask: boolean;
}

const CC_EVENT_SET = new Set<CC_EVENTS>(Object.values(CC_EVENTS) as CC_EVENTS[]);

const isCcEvent = (value: string): value is CC_EVENTS => CC_EVENT_SET.has(value as CC_EVENTS);
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
  private taskActionCallbacks: TaskActionCallbacks;
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
    this.taskActionCallbacks = this.createTaskActionCallbacks();
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
        return {type: TaskEvent.TASK_INCOMING, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CONTACT:
        return {type: TaskEvent.TASK_OFFERED, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT:
        return {type: TaskEvent.HYDRATE, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CONSULT:
        return {
          type: TaskEvent.OFFER_CONSULT,
          taskData: {...payload, isConsulted: true},
        };

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        return {type: TaskEvent.ASSIGN, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT_HELD:
        return {
          type: TaskEvent.HOLD_SUCCESS,
          mediaResourceId: mediaResourceId || '',
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        return {
          type: TaskEvent.UNHOLD_SUCCESS,
          mediaResourceId: mediaResourceId || '',
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONSULT_CREATED:
        return {
          type: TaskEvent.CONSULT_CREATED,
          taskData: {...payload, isConsulted: false},
        };

      case CC_EVENTS.AGENT_CONSULTING:
        return {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONSULT_ENDED:
        return {type: TaskEvent.CONSULT_END, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_FAILED:
        return {type: TaskEvent.CONSULT_FAILED, reason: payload.reason, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        return {type: TaskEvent.CTQ_CANCEL, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
        return {type: TaskEvent.CTQ_CANCEL_FAILED, taskData: payload};

      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
      case CC_EVENTS.AGENT_WRAPUP:
      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        return {type: TaskEvent.END, taskData: {...payload, wrapUpRequired: true}};

      case CC_EVENTS.AGENT_BLIND_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_VTEAM_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_CONSULT_TRANSFER_FAILED:
      case CC_EVENTS.AGENT_CONFERENCE_TRANSFER_FAILED:
        return {type: TaskEvent.TRANSFER_FAILED, taskData: payload};

      case CC_EVENTS.CONTACT_ENDED:
        return {
          type: TaskEvent.CONTACT_ENDED,
          taskData: {
            ...payload,
            wrapUpRequired: payload.interaction?.state !== 'new',
          },
        };

      case CC_EVENTS.AGENT_INVITE_FAILED:
        return {type: TaskEvent.INVITE_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED:
        return {type: TaskEvent.ASSIGN_FAILED, reason: payload.reason};

      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
        return {type: TaskEvent.RONA, taskData: payload, reason: payload.reason};

      case CC_EVENTS.AGENT_OUTBOUND_FAILED:
        return {type: TaskEvent.OUTBOUND_FAILED, reason: payload.reason};

      case CC_EVENTS.CONTACT_RECORDING_STARTED:
        return {type: TaskEvent.RECORDING_STARTED, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_PAUSED:
        return {type: TaskEvent.PAUSE_RECORDING, taskData: payload};

      case CC_EVENTS.CONTACT_RECORDING_RESUMED:
        return {type: TaskEvent.RESUME_RECORDING, taskData: payload};

      case CC_EVENTS.AGENT_WRAPPEDUP:
        return {type: TaskEvent.WRAPUP_COMPLETE, taskData: payload};

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
    task?: ITask,
    stateMachineEvent?: TaskEventPayload | null
  ): void {
    // Check if task has state machine
    const taskWithStateMachine = task as any;
    if (!taskWithStateMachine?.sendStateMachineEvent) {
      return;
    }

    const eventPayload =
      stateMachineEvent ?? TaskManager.mapEventToTaskStateMachineEvent(ccEvent, payload);

    if (eventPayload) {
      LoggerProxy.log(`Sending event to state machine: ${ccEvent} -> ${eventPayload.type}`, {
        module: TASK_MANAGER_FILE,
        method: 'sendEventToStateMachine',
        interactionId: payload.interactionId,
      });

      // Send event to task's state machine using the protected method
      taskWithStateMachine.sendStateMachineEvent(eventPayload);
    }
  }

  /**
   * Register WebSocket message listeners for task events
   *
   * Main entry point that orchestrates event processing through a clear pipeline:
   * 1. Parse and validate incoming WebSocket messages
   * 2. Prepare event context with task and state machine mappings
   * 3. Handle task lifecycle (creation, updates, collection management)
   * 4. Send events to state machine (which handles task-level emissions)
   * 5. Execute cleanup actions (resource management, collection updates)
   *
   * This architecture separates concerns:
   * - TaskManager: Manages task collection lifecycle and operational concerns
   * - State Machine: Manages individual task state and event emissions
   */
  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      // Step 1: Parse and validate the message
      const message = this.parseWebSocketMessage(event);
      if (!message) return;

      // Step 2: Prepare event context
      const context = this.prepareEventContext(message);
      if (!context) return;

      // Step 3: Handle event lifecycle and get actions to perform
      const actions = this.handleTaskLifecycleEvent(context);

      // Step 4: Process state machine events and emit legacy events
      this.processEventAndEmissions(context, actions);

      // Step 5: Execute post-processing actions
      this.executeTaskActions(actions);
    });
  }

  /**
   * Parse and validate WebSocket message
   * @returns Parsed message or null if invalid/keepalive
   */
  private parseWebSocketMessage(event: string): WebSocketMessage | null {
    try {
      const payload = JSON.parse(event) as WebSocketMessage;

      // Filter out keepalive messages
      if (payload?.keepalive === 'true' || payload?.keepalive === true) {
        return null;
      }

      // Normalize task data if present
      if (payload?.data?.interaction) {
        payload.data = normalizeTaskData(payload.data);
      }

      return payload;
    } catch (error) {
      LoggerProxy.error('Failed to parse WebSocket message', {
        module: TASK_MANAGER_FILE,
        method: 'parseWebSocketMessage',
        error,
      });

      return null;
    }
  }

  /**
   * Prepare context for event processing
   * @returns Event context or null if event type is invalid
   */
  private prepareEventContext(message: WebSocketMessage): EventContext | null {
    const eventType = message.data?.type;

    if (!eventType || !isCcEvent(eventType)) {
      return null;
    }

    const task = this.taskCollection[message.data.interactionId];
    const stateMachineEvent = TaskManager.mapEventToTaskStateMachineEvent(eventType, message.data);

    LoggerProxy.info(`Handling task event ${eventType}`, {
      module: TASK_MANAGER_FILE,
      method: 'prepareEventContext',
      interactionId: message.data?.interactionId,
    });

    return {
      eventType,
      payload: message.data,
      task,
      stateMachineEvent,
      wasConsultedTask: Boolean(task?.data?.isConsulted),
    };
  }

  /**
   * Handle task lifecycle events and determine required actions
   *
   * Delegates to specific event handlers based on event type. Each handler
   * is responsible for TaskManager-level concerns:
   * - Task creation and collection management
   * - Metrics tracking
   * - Resource cleanup decisions
   *
   * Note: Task-level state transitions and event emissions are handled by
   * the state machine via processEventAndEmissions()
   */
  private handleTaskLifecycleEvent(context: EventContext): TaskEventActions {
    const {eventType} = context;

    switch (eventType) {
      case CC_EVENTS.AGENT_CONTACT_RESERVED:
        return this.handleContactReserved(context);

      case CC_EVENTS.AGENT_CONTACT:
        return this.handleAgentContact(context);

      case CC_EVENTS.AGENT_OUTBOUND_FAILED:
        return this.handleOutboundFailed(context);

      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
      case CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED:
      case CC_EVENTS.AGENT_INVITE_FAILED:
        return this.handleTaskFailure(context);

      case CC_EVENTS.CONTACT_ENDED:
        return this.handleContactEnded(context);

      case CC_EVENTS.AGENT_CONSULT_ENDED:
        return this.handleConsultEnded(context);

      case CC_EVENTS.AGENT_WRAPPEDUP:
        return this.handleWrapupComplete(context);

      case CC_EVENTS.CONSULTED_PARTICIPANT_MOVING:
      case CC_EVENTS.PARTICIPANT_POST_CALL_ACTIVITY:
        return this.handleTaskDataUpdate(context);

      default:
        return this.handleDefaultEvent(context);
    }
  }

  /**
   * Handle AGENT_CONTACT_RESERVED event
   * Creates a new task and sends TASK_INCOMING event to state machine
   */
  private handleContactReserved(context: EventContext): TaskEventActions {
    const {payload} = context;

    const task = TaskFactory.createTask(
      this.contact,
      this.webCallingService,
      {...payload, isConsulted: false},
      this.configFlags,
      this.getTaskRuntimeOptions()
    );

    this.taskCollection[payload.interactionId] = task;

    // For telephony in-browser, we need to wait for the incoming call event
    // before the state machine can properly emit TASK_INCOMING
    // The state machine will handle emitting TASK_INCOMING via the callback
    const shouldWaitForIncomingCall =
      this.webCallingService.loginOption === LoginOption.BROWSER &&
      task.data.interaction.mediaType === MEDIA_CHANNEL.TELEPHONY &&
      !this.call;

    if (shouldWaitForIncomingCall) {
      // Don't send to state machine yet - wait for handleIncomingWebCall
      return {task};
    }

    // For all other cases, let the state machine handle TASK_INCOMING emission
    return {task};
  }

  /**
   * Handle AGENT_CONTACT event
   * Re-creates task if missing (multi-session scenario)
   */
  private handleAgentContact(context: EventContext): TaskEventActions {
    let {task} = context;
    const {payload} = context;

    if (!task) {
      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        {...payload, isConsulted: false},
        this.configFlags,
        this.getTaskRuntimeOptions()
      );
      this.taskCollection[payload.interactionId] = task;
    }

    return {task};
  }

  /**
   * Handle AGENT_OUTBOUND_FAILED event
   *
   * TaskManager responsibility: Mark failed outbound tasks for removal from collection.
   * The state machine handles the task-level OUTBOUND_FAILED event emission.
   */
  private handleOutboundFailed(context: EventContext): TaskEventActions {
    const {task, payload} = context;

    if (task?.data) {
      LoggerProxy.log('Agent outbound failed for task', {
        module: TASK_MANAGER_FILE,
        method: 'handleOutboundFailed',
        interactionId: payload?.interactionId,
      });

      return {task, shouldRemoveFromCollection: true};
    }

    return {task};
  }

  /**
   * Handle task failure events (RONA, ASSIGN_FAILED, INVITE_FAILED)
   *
   * TaskManager responsibilities:
   * - Track operational metrics for failed tasks
   * - Mark tasks for cleanup
   *
   * The state machine handles task-level state transitions and event emissions
   * (RONA, ASSIGN_FAILED, INVITE_FAILED events).
   */
  private handleTaskFailure(context: EventContext): TaskEventActions {
    const {task, eventType, payload} = context;

    if (!task) {
      return {};
    }

    // Map event type to metric name
    const eventTypeToMetricMap: Record<string, keyof typeof METRIC_EVENT_NAMES> = {
      [CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED]: 'AGENT_CONTACT_ASSIGN_FAILED',
      [CC_EVENTS.AGENT_INVITE_FAILED]: 'AGENT_INVITE_FAILED',
    };

    const metricEventName: keyof typeof METRIC_EVENT_NAMES =
      eventTypeToMetricMap[eventType] || 'AGENT_RONA';

    // Track operational metrics (TaskManager-level concern)
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES[metricEventName],
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(payload),
        taskId: payload.interactionId,
        reason: payload.reason,
      },
      ['behavioral', 'operational']
    );

    return {task, shouldCleanupTask: true};
  }

  /**
   * Handle CONTACT_ENDED event
   *
   * TaskManager responsibility: Mark tasks for cleanup (WebRTC resources, timers).
   * The state machine handles CONTACT_ENDED event emission and state transitions.
   */
  private handleContactEnded(context: EventContext): TaskEventActions {
    const {task} = context;

    if (task) {
      return {task, shouldCleanupTask: true};
    }

    return {};
  }

  /**
   * Handle AGENT_CONSULT_ENDED event
   *
   * TaskManager responsibility: Remove consulted tasks from collection when consult ends.
   * The state machine handles CONSULT_END event emission and state transitions.
   */
  private handleConsultEnded(context: EventContext): TaskEventActions {
    const {task, wasConsultedTask} = context;

    if (task && wasConsultedTask) {
      // End state for task if we were offered the consult
      return {task, shouldRemoveFromCollection: true};
    }

    return {task};
  }

  /**
   * Handle AGENT_WRAPPEDUP event
   *
   * TaskManager responsibilities:
   * - Cancel auto-wrapup timer (resource cleanup)
   * - Remove completed tasks from collection
   *
   * The state machine handles WRAPUP_COMPLETE event emission and state transitions.
   */
  private handleWrapupComplete(context: EventContext): TaskEventActions {
    const {task} = context;

    if (task) {
      return {
        task,
        shouldCancelAutoWrapup: true,
        shouldRemoveFromCollection: true,
      };
    }

    return {};
  }

  /**
   * Handle events that only need task data updates
   */
  private handleTaskDataUpdate(context: EventContext): TaskEventActions {
    const {task, payload} = context;

    if (task) {
      this.updateTaskData(task, payload);
    }

    return {task};
  }

  /**
   * Handle default/other events
   */
  private handleDefaultEvent(context: EventContext): TaskEventActions {
    const {task, payload, stateMachineEvent} = context;

    // For all other events, just update task data if needed
    if (task && payload && !stateMachineEvent) {
      this.updateTaskData(task, payload);
    }

    return {task};
  }

  /**
   * Process state machine events and emit legacy events
   *
   * This method bridges TaskManager and the state machine:
   * 1. Emits legacy CC_TASK_EVENTS for backward compatibility
   * 2. Sends events to state machine for:
   *    - Task state transitions
   *    - TASK_EVENTS emissions (via callbacks)
   *    - UI controls updates
   *
   * Note: TASK_EVENTS (like TASK_INCOMING, TASK_END, etc.) are now emitted
   * by the state machine via callbacks, not directly by TaskManager. This ensures
   * events are emitted in sync with state transitions.
   */
  private processEventAndEmissions(context: EventContext, actions: TaskEventActions): void {
    const {task} = actions;
    if (!task) return;

    const {eventType, payload, stateMachineEvent} = context;

    // Emit task-specific events for backward compatibility
    if (Object.values(CC_TASK_EVENTS).includes(eventType as any)) {
      task.emit(eventType as any, payload);
    }

    // Send event to state machine - this will trigger all TASK_EVENTS emissions
    // including TASK_INCOMING which is now handled via the state machine callbacks
    this.sendEventToStateMachine(eventType, payload, task, stateMachineEvent);
  }

  /**
   * Execute post-processing actions on tasks
   *
   * Handles TaskManager-level lifecycle concerns:
   * - Cancel timers (auto-wrapup)
   * - Cleanup resources (WebRTC, call objects)
   * - Manage task collection (remove completed/failed tasks)
   *
   * These are manager-level operations, distinct from task-level state
   * changes handled by the state machine.
   */
  private executeTaskActions(actions: TaskEventActions): void {
    const {task, shouldCancelAutoWrapup, shouldCleanupTask, shouldRemoveFromCollection} = actions;

    if (!task) return;

    if (shouldCancelAutoWrapup) {
      task.cancelAutoWrapupTimer();
    }

    if (shouldCleanupTask) {
      this.handleTaskCleanup(task);
    }

    if (shouldRemoveFromCollection) {
      this.removeTaskFromCollection(task);
    }
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

  private getTaskRuntimeOptions(): TaskRuntimeOptions {
    return {
      actionCallbacks: this.taskActionCallbacks,
    };
  }

  private createTaskActionCallbacks(): TaskActionCallbacks {
    return {
      onTaskHydrated: (task, taskData) => {
        if (taskData) {
          this.updateTaskData(task, taskData);
        }
        this.emit(TASK_EVENTS.TASK_HYDRATE, task);
      },
      onTaskOffered: (task, taskData) => {
        LoggerProxy.log(`Agent offer contact received for task`, {
          module: TASK_MANAGER_FILE,
          method: METHODS.REGISTER_TASK_LISTENERS,
          interactionId: taskData?.interactionId,
        });
        if (taskData) {
          this.updateTaskData(task, taskData);
        }
        this.emit(TASK_EVENTS.TASK_OFFER_CONTACT, task);
      },
    };
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
