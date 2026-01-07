import EventEmitter from 'events';
import {ICall, LINE_EVENTS} from '@webex/calling';
import {WebSocketManager} from '../core/websocket/WebSocketManager';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import {MEDIA_CHANNEL, TASK_EVENTS, TaskData, TaskId, ITask} from './types';
import {TASK_MANAGER_FILE} from '../../constants';
import {METHODS} from './constants';
import {CC_EVENTS, WrapupData} from '../config/types';
import {ConfigFlags, LoginOption} from '../../types';
import LoggerProxy from '../../logger-proxy';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import {getIsConferenceInProgress, isSecondaryEpDnAgent, shouldAutoAnswerTask} from './TaskUtils';
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
  // eslint-disable-next-line no-use-before-define
  private static taskManager: TaskManager;
  private configFlags?: ConfigFlags;
  private wrapupData: WrapupData;
  private agentId: string;
  private webRtcEnabled: boolean;
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
    this.webRtcEnabled = false;

    this.registerTaskListeners();
    this.registerIncomingCallEvent();
  }

  /**
   * Set config flags for task creation
   */
  public setConfigFlags(configFlags: ConfigFlags) {
    this.configFlags = configFlags;
  }

  /**
   * Set wrapup configuration data
   */
  public setWrapupData(wrapupData: WrapupData) {
    this.wrapupData = wrapupData;
  }

  /**
   * Set agent ID for task operations
   */
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

  public setWebRtcEnabled(webRtcEnabled: boolean) {
    this.webRtcEnabled = webRtcEnabled;
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

      // Send TASK_INCOMING to state machine - it will emit on the task object
      const eventPayload = TaskManager.mapEventToTaskStateMachineEvent(
        CC_EVENTS.AGENT_CONTACT_RESERVED,
        currentTask.data as WebSocketPayload
      );
      const taskWithStateMachine = currentTask as any;
      if (eventPayload && taskWithStateMachine?.sendStateMachineEvent) {
        taskWithStateMachine.sendStateMachineEvent(eventPayload);
      }
    }
    this.call = call;
  };

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
   * @param agentId - Optional agent ID for state detection (needed for HYDRATE)
   * @returns TaskEventPayload for state machine or null if no mapping
   */
  private static mapEventToTaskStateMachineEvent(
    ccEvent: CC_EVENTS,
    payload: WebSocketPayload,
    agentId?: string
  ): TaskEventPayload | null {
    const mediaResourceId =
      payload.mediaResourceId ||
      payload.interaction?.media?.[payload.interactionId]?.mediaResourceId;

    switch (ccEvent) {
      // CC -> TaskEvent mappings (see TaskStateMachine comment for quick reference)
      case CC_EVENTS.AGENT_CONTACT_RESERVED: // AgentContactReserved -> TASK_INCOMING
        return {type: TaskEvent.TASK_INCOMING, taskData: payload};

      case CC_EVENTS.AGENT_OFFER_CONTACT: // AgentOfferContact -> TASK_OFFERED
        return {type: TaskEvent.TASK_OFFERED, taskData: payload};

      case CC_EVENTS.AGENT_CONTACT: // AgentContact -> HYDRATE
        // Include agentId for state detection (e.g., checking isWrapUp in participant data)
        return {type: TaskEvent.HYDRATE, taskData: payload, agentId};

      case CC_EVENTS.AGENT_OFFER_CONSULT: // AgentOfferConsult -> OFFER_CONSULT
        return {
          type: TaskEvent.OFFER_CONSULT,
          taskData: {...payload, isConsulted: true},
        };

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED: // AgentContactAssigned -> ASSIGN
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

      case CC_EVENTS.AGENT_CONSULTING: // AgentConsulting -> CONSULTING_ACTIVE
        // use context to figure out if it's the initiator or receiver using consultInitiator from context
        return {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
          taskData: payload,
        };

      case CC_EVENTS.AGENT_CONSULT_ENDED: // AgentConsultEnded -> CONSULT_END
        return {type: TaskEvent.CONSULT_END, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_FAILED:
      case CC_EVENTS.AGENT_CTQ_FAILED:
        return {type: TaskEvent.CONSULT_FAILED, reason: payload.reason, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        return {type: TaskEvent.CTQ_CANCEL, taskData: payload};

      case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
        return {type: TaskEvent.CTQ_CANCEL_FAILED, taskData: payload};

      case CC_EVENTS.AGENT_BLIND_TRANSFERRED: // AgentBlindTransferred -> TRANSFER_SUCCESS
      case CC_EVENTS.AGENT_CONSULT_TRANSFERRED: // AgentConsultTransferred -> TRANSFER_SUCCESS
      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED: // AgentVTeamTransferred -> TRANSFER_SUCCESS
        return {
          type: TaskEvent.TRANSFER_SUCCESS,
          taskData: payload,
        };

      case CC_EVENTS.AGENT_WRAPUP:
        return {type: TaskEvent.TASK_WRAPUP, taskData: {...payload, wrapUpRequired: true}};
      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        return null; // Add WRAPUP if needed

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

      // Conference events - these trigger state machine transition to CONFERENCING
      case CC_EVENTS.AGENT_CONSULT_CONFERENCED:
      case CC_EVENTS.PARTICIPANT_JOINED_CONFERENCE:
        return {type: TaskEvent.CONFERENCE_START, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_CONFERENCE_FAILED:
        return {type: TaskEvent.CONFERENCE_FAILED, reason: payload.reason, taskData: payload};

      case CC_EVENTS.AGENT_CONSULT_CONFERENCE_ENDED:
        return {type: TaskEvent.CONFERENCE_END, taskData: payload};

      case CC_EVENTS.PARTICIPANT_LEFT_CONFERENCE:
        // Use PARTICIPANT_LEAVE instead of CONFERENCE_END
        // The state machine will determine if conference should end based on agent count
        return {type: TaskEvent.PARTICIPANT_LEAVE, taskData: payload};

      case CC_EVENTS.AGENT_CONFERENCE_TRANSFERRED:
        return {type: TaskEvent.TRANSFER_CONFERENCE_SUCCESS, taskData: payload};

      default:
        // Not all events need state machine mapping
        return null;
    }
  }

  /**
   * Register WebSocket message listeners for task events
   *
   * Main entry point that orchestrates event processing through a clear pipeline:
   * 1. Parse and validate incoming WebSocket messages
   * 2. Prepare event context with task and state machine mappings
   * 3. Handle task lifecycle (creation, updates, collection management)
   * 4. Send events to state machine (task-level transitions/emissions)
   * 5. Execute cleanup actions (resource management, collection updates)
   *
   * This architecture separates concerns:
   * - TaskManager: Manages task collection lifecycle and operational concerns
   * - State Machine: Manages individual task state and event emissions
   */
  private registerTaskListeners() {
    this.webSocketManager.on('message', (event) => {
      // Step 1: Parse and validate the message
      const message = TaskManager.parseWebSocketMessage(event);
      if (!message) return;

      // Step 2: Prepare event context
      const context = this.prepareEventContext(message);
      if (!context) return;

      // Step 3: Handle event lifecycle and get actions to perform
      const actions = this.handleTaskLifecycleEvent(context);

      // Step 4: Process state machine events (task-level transitions/emissions)
      this.processEventAndEmissions(context, actions);

      // Step 5: Execute post-processing actions
      this.executeTaskActions(actions);
    });
  }

  /**
   * Parse and validate WebSocket message
   * @returns Parsed message or null if invalid/keepalive
   */
  private static parseWebSocketMessage(event: string): WebSocketMessage | null {
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
    const wasConsultedTask = Boolean(task?.data?.isConsulted);
    const computeWrapUpRequired = () => {
      if (message.data.wrapUpRequired !== undefined) {
        return message.data.wrapUpRequired;
      }
      if (message.data.isConsulted !== undefined) {
        return !message.data.isConsulted;
      }

      return !wasConsultedTask;
    };

    const adjustedPayload =
      eventType === CC_EVENTS.AGENT_CONSULT_TRANSFERRED ||
      eventType === CC_EVENTS.AGENT_BLIND_TRANSFERRED ||
      eventType === CC_EVENTS.AGENT_VTEAM_TRANSFERRED
        ? {
            ...message.data,
            wrapUpRequired: computeWrapUpRequired(),
          }
        : message.data;
    const stateMachineEvent = TaskManager.mapEventToTaskStateMachineEvent(
      eventType,
      adjustedPayload,
      this.agentId
    );

    LoggerProxy.info(`Handling task event ${eventType}`, {
      module: TASK_MANAGER_FILE,
      method: 'prepareEventContext',
      interactionId: message.data?.interactionId,
    });

    return {
      eventType,
      payload: adjustedPayload,
      task,
      stateMachineEvent,
      wasConsultedTask,
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
        return TaskManager.handleOutboundFailed(context);

      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
      case CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED:
      case CC_EVENTS.AGENT_INVITE_FAILED:
        return this.handleTaskFailure(context);

      case CC_EVENTS.CONTACT_ENDED:
        return TaskManager.handleContactEnded(context);

      case CC_EVENTS.AGENT_CONSULT_ENDED:
        return TaskManager.handleConsultEnded(context);

      case CC_EVENTS.AGENT_WRAPPEDUP:
        return TaskManager.handleWrapupComplete(context);

      case CC_EVENTS.CONTACT_MERGED:
        return this.handleContactMergedEvent(context);

      default:
        return this.handleDefaultEvent(context);
    }
  }

  /**
   * Handle AGENT_CONTACT_RESERVED event
   * Creates a new task; state machine event is sent during processing
   */
  private handleContactReserved(context: EventContext): TaskEventActions {
    const {payload} = context;
    const shouldAutoAnswer = shouldAutoAnswerTask(
      payload,
      this.agentId,
      this.webCallingService.loginOption,
      this.webRtcEnabled
    );

    const taskData: TaskData = {
      ...payload,
      isConsulted: false,
      isAutoAnswering: shouldAutoAnswer,
    };

    const task = TaskFactory.createTask(
      this.contact,
      this.webCallingService,
      taskData,
      this.configFlags,
      this.wrapupData,
      this.agentId
    );

    this.setupTaskListeners(task);
    this.taskCollection[payload.interactionId] = task;

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
      const shouldAutoAnswer = shouldAutoAnswerTask(
        payload,
        this.agentId,
        this.webCallingService.loginOption,
        this.webRtcEnabled
      );
      const taskData: TaskData = {
        ...payload,
        isConsulted: false,
        wrapUpRequired: payload.interaction?.participants?.[this.agentId]?.isWrapUp || false,
        isConferenceInProgress: getIsConferenceInProgress(payload),
        isAutoAnswering: shouldAutoAnswer,
      };

      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        taskData,
        this.configFlags,
        this.wrapupData,
        this.agentId
      );
      this.setupTaskListeners(task);
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
  private static handleOutboundFailed(context: EventContext): TaskEventActions {
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
  private static handleContactEnded(context: EventContext): TaskEventActions {
    const {task} = context;

    if (task) {
      LoggerProxy.log('Contact ended event processed', {
        module: TASK_MANAGER_FILE,
        method: 'handleContactEnded',
        interactionId: task.data?.interactionId,
      });

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
  private static handleConsultEnded(context: EventContext): TaskEventActions {
    const {task, wasConsultedTask} = context;

    if (task && wasConsultedTask) {
      LoggerProxy.log('Consult ended event processed', {
        module: TASK_MANAGER_FILE,
        method: 'handleConsultEnded',
        interactionId: task.data?.interactionId,
      });
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
  private static handleWrapupComplete(context: EventContext): TaskEventActions {
    const {task} = context;

    if (task) {
      LoggerProxy.log('Wrap-up complete event processed', {
        module: TASK_MANAGER_FILE,
        method: 'handleWrapupComplete',
        interactionId: task.data?.interactionId,
      });

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
      // These events don't drive state transitions; keep task snapshot in sync.
      this.updateTaskData(task, payload);
    }

    return {task};
  }

  /**
   * Handle default/other events
   */
  private handleDefaultEvent(context: EventContext): TaskEventActions {
    const {task, payload, stateMachineEvent} = context;

    // For unmapped events, just update task data if needed.
    // Mapped events are handled by the state machine in processEventAndEmissions().
    if (task && payload && !stateMachineEvent) {
      this.updateTaskData(task, payload);
    }

    return {task};
  }

  /**
   * Process state machine events and trigger task-level emissions
   *
   * This method bridges TaskManager and the state machine:
   * 1. Sends mapped events to the state machine for transitions/emissions
   * 2. Triggers auto-answer for offer events
   *
   * Note: TASK_EVENTS (like TASK_INCOMING, TASK_END, etc.) are now emitted
   * by the state machine via callbacks, not directly by TaskManager. This ensures
   * events are emitted in sync with state transitions.
   */
  private processEventAndEmissions(context: EventContext, actions: TaskEventActions): void {
    const {task} = actions;
    if (!task) return;

    const {eventType, payload, stateMachineEvent} = context;

    // Send event to state machine - this will trigger all TASK_EVENTS emissions
    // including TASK_INCOMING which is now handled via the state machine callbacks
    const taskWithStateMachine = task as any;
    if (stateMachineEvent && taskWithStateMachine?.sendStateMachineEvent) {
      taskWithStateMachine.sendStateMachineEvent(stateMachineEvent);
    }

    if (
      eventType === CC_EVENTS.AGENT_OFFER_CONTACT ||
      eventType === CC_EVENTS.AGENT_OFFER_CONSULT
    ) {
      this.handleAutoAnswer(task, Boolean(payload?.isAutoAnswering));
    }
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
      throw new Error('Task not found for update');
    }

    task.updateTaskData(taskData);
    this.taskCollection[taskData.interactionId] = task;

    return task;
  }

  /**
   * Setup listeners for task events that need to be bubbled up to TaskManager
   * This replaces the previous callback injection pattern
   */
  private setupTaskListeners(task: ITask): void {
    // Listen for TASK_INCOMING and re-emit so webex.cc can notify consumers
    task.on(TASK_EVENTS.TASK_INCOMING, (t: ITask) => {
      LoggerProxy.log(`Task incoming event received`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: t.data?.interactionId,
      });

      this.emit(TASK_EVENTS.TASK_INCOMING, t);
    });

    // Listen for TASK_HYDRATE on the task and re-emit on TaskManager
    task.on(TASK_EVENTS.TASK_HYDRATE, (t: ITask) => {
      // Task data is already updated by the task itself before emitting
      this.emit(TASK_EVENTS.TASK_HYDRATE, t);
    });
  }

  private removeTaskFromCollection(task: ITask) {
    if (typeof task.cancelAutoWrapupTimer === 'function') {
      task.cancelAutoWrapupTimer();
    }
    if (task?.data?.interactionId) {
      delete this.taskCollection[task.data.interactionId];
      LoggerProxy.info(`Task removed from collection`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REMOVE_TASK_FROM_COLLECTION,
        interactionId: task.data.interactionId,
      });
    }
  }

  /**
   * Handles CONTACT_MERGED event logic
   * @param task - The task to process
   * @param taskData - The task data from the event payload
   * @returns Updated or newly created task
   * @private
   */
  private handleContactMergedEvent(context: EventContext): TaskEventActions {
    const {payload} = context;
    let task = context.task;

    if (payload.childInteractionId) {
      // remove the child task from collection
      this.removeTaskFromCollection(this.taskCollection[payload.childInteractionId]);
    }

    if (task) {
      LoggerProxy.log(`Got CONTACT_MERGED: Task already exists in collection`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: payload.interactionId,
      });
      // update the task data
      this.updateTaskData(task, payload);
    } else {
      // Case2 : Task is not present in taskCollection
      LoggerProxy.log(`Got CONTACT_MERGED : Creating new task in taskManager`, {
        module: TASK_MANAGER_FILE,
        method: METHODS.REGISTER_TASK_LISTENERS,
        interactionId: payload.interactionId,
      });

      const taskData: TaskData = {
        ...payload,
        wrapUpRequired: payload.interaction?.participants?.[this.agentId]?.isWrapUp || false,
        isConferenceInProgress: getIsConferenceInProgress(payload),
        isConsulted: false,
      };

      task = TaskFactory.createTask(
        this.contact,
        this.webCallingService,
        taskData,
        this.configFlags,
        this.wrapupData,
        this.agentId
      );
      this.setupTaskListeners(task);
      this.taskCollection[payload.interactionId] = task;
    }

    if (task) {
      this.emit(TASK_EVENTS.TASK_MERGED, task);
    }

    return {task};
  }

  /**
   * Handles auto-answer logic for incoming tasks
   * Automatically accepts tasks when isAutoAnswering flag is set
   * The flag is set during task creation based on:
   * 1. WebRTC calls with auto-answer enabled in agent profile
   * 2. Agent-initiated WebRTC outdial calls
   * 3. Agent-initiated digital outbound (Email/SMS) without previous transfers
   *
   * @param task - The task to auto-answer
   * @private
   */
  private async handleAutoAnswer(task: ITask, shouldAutoAnswerOverride?: boolean): Promise<void> {
    if (!task || !task.data) {
      return;
    }

    const shouldAutoAnswer =
      shouldAutoAnswerOverride === true || Boolean(task.data.isAutoAnswering);

    if (!shouldAutoAnswer) {
      return;
    }

    LoggerProxy.info(`Auto-answering task`, {
      module: TASK_MANAGER_FILE,
      method: 'handleAutoAnswer',
      interactionId: task.data.interactionId,
    });

    try {
      await task.accept();
      LoggerProxy.info(`Task auto-answered successfully`, {
        module: TASK_MANAGER_FILE,
        method: 'handleAutoAnswer',
        interactionId: task.data.interactionId,
      });

      // Track successful auto-answer
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_SUCCESS,
        {
          taskId: task.data.interactionId,
          mediaType: task.data.interaction.mediaType,
          isAutoAnswered: true,
        },
        ['behavioral', 'operational']
      );
      // Emit task:autoAnswered event for widgets/UI to react
      task.emit(TASK_EVENTS.TASK_AUTO_ANSWERED, task);
    } catch (error) {
      // Reset isAutoAnswering flag on failure
      task.updateTaskData({...task.data, isAutoAnswering: false});
      LoggerProxy.error(`Failed to auto-answer task`, {
        module: TASK_MANAGER_FILE,
        method: 'handleAutoAnswer',
        interactionId: task.data.interactionId,
        error,
      });

      // Track auto-answer failure
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_FAILED,
        {
          taskId: task.data.interactionId,
          mediaType: task.data.interaction.mediaType,
          error: error?.message || 'Unknown error',
          isAutoAnswered: false,
        },
        ['behavioral', 'operational']
      );
    }
  }

  /**
   * Handles cleanup of task resources including Desktop/WebRTC call cleanup and task removal
   * @param task - The task to clean up
   * @private
   */
  private handleTaskCleanup(task: ITask) {
    if (
      this.webCallingService.loginOption === LoginOption.BROWSER &&
      task.data.interaction.mediaType === MEDIA_CHANNEL.TELEPHONY &&
      task instanceof WebRTC
    ) {
      task.unregisterWebCallListeners();
      this.webCallingService.cleanUpCall();
    }

    const isOutdial = task.data.interaction.outboundType === 'OUTDIAL';
    const isNew = task.data.interaction.state === 'new';
    const needsWrapUp = task.data.agentsPendingWrapUp?.length > 0;

    // For OUTDIAL: only remove if NOT terminated (user-declined, no wrap-up follows)
    // If terminated, keep task for wrap-up flow (CONTACT_ENDED → AGENT_WRAPUP)
    // For non-OUTDIAL: remove if state is 'new'
    // Always remove if secondary EpDn agent
    if ((isNew && !(isOutdial && needsWrapUp)) || isSecondaryEpDnAgent(task.data.interaction)) {
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
