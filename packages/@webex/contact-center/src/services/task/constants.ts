/**
 * Constants for Task Service
 * @module @webex/contact-center/services/task/constants
 * @ignore
 */

export const TASK_MESSAGE_TYPE = 'RoutingMessage';
export const TASK_API = '/v1/tasks/';
export const HOLD = '/hold';
export const UNHOLD = '/unhold';
export const CONSULT = '/consult';
export const CONSULT_ACCEPT = '/consult/accept';
export const CONSULT_END = '/consult/end';
export const TRANSFER = '/transfer';
export const CONSULT_TRANSFER = '/consult/transfer';
export const PAUSE = '/record/pause';
export const RESUME = '/record/resume';
export const WRAPUP = '/wrapup';
export const END = '/end';
export const CONSULT_CONFERENCE = '/consult/conference';
export const CONFERENCE_EXIT = '/conference/exit';
export const CONFERENCE_TRANSFER = '/conference/transfer';
export const TASK_MANAGER_FILE = 'taskManager';
export const TASK_FILE = 'task';

/**
 * Task data field names that should be preserved during reconciliation
 * These fields are retained even if not present in new data during updates
 */
export const PRESERVED_TASK_DATA_FIELDS = {
  /** Indicates if the task is in consultation state */
  IS_CONSULTED: 'isConsulted',
  /** Indicates if wrap-up is required for this task */
  WRAP_UP_REQUIRED: 'wrapUpRequired',
  /** Indicates if a conference is currently in progress (2+ active agents) */
  IS_CONFERENCE_IN_PROGRESS: 'isConferenceInProgress',
};

/**
 * Array of task data field names that should not be deleted during reconciliation
 * Used by reconcileData method to preserve important task state fields
 */
export const KEYS_TO_NOT_DELETE: string[] = Object.values(PRESERVED_TASK_DATA_FIELDS);

// METHOD NAMES
export const METHODS = {
  // Task class methods
  ACCEPT: 'accept',
  TOGGLE_MUTE: 'toggleMute',
  DECLINE: 'decline',
  HOLD: 'hold',
  RESUME: 'resume',
  END: 'end',
  WRAPUP: 'wrapup',
  PAUSE_RECORDING: 'pauseRecording',
  RESUME_RECORDING: 'resumeRecording',
  CONSULT: 'consult',
  END_CONSULT: 'endConsult',
  TRANSFER: 'transfer',
  CONSULT_TRANSFER: 'consultTransfer',
  CONSULT_CONFERENCE: 'consultConference',
  EXIT_CONFERENCE: 'exitConference',
  TRANSFER_CONFERENCE: 'transferConference',
  UPDATE_TASK_DATA: 'updateTaskData',
  RECONCILE_DATA: 'reconcileData',

  // TaskManager class methods
  HANDLE_INCOMING_WEB_CALL: 'handleIncomingWebCall',
  REGISTER_TASK_LISTENERS: 'registerTaskListeners',
  REMOVE_TASK_FROM_COLLECTION: 'removeTaskFromCollection',
  HANDLE_TASK_CLEANUP: 'handleTaskCleanup',
  GET_TASK: 'getTask',
  GET_ALL_TASKS: 'getAllTasks',
  GET_TASK_MANAGER: 'getTaskManager',
  SETUP_AUTO_WRAPUP_TIMER: 'setupAutoWrapupTimer',
  CANCEL_AUTO_WRAPUP_TIMER: 'cancelAutoWrapupTimer',
};
