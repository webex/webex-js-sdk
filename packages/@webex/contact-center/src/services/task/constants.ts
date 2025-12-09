/**
 * Constants for Task Service
 * @module @webex/plugin-cc/services/task/constants
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
export const TASK_MANAGER_FILE = 'taskManager';
export const TASK_FILE = 'task';

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
};
