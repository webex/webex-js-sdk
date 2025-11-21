/**
 * Task State Machine
 *
 * Export all state machine components for easy importing
 */

// Main state machine
export {
  getTaskStateMachineConfig,
  createTaskStateMachine,
  createTaskStateMachineWithActions,
} from './TaskStateMachine';
export type {TaskStateMachine} from './TaskStateMachine';

// Types
export {TaskState, TaskEvent, isEventOfType} from './types';
export type {
  TaskContext,
  TaskEventPayload,
  TaskStateMachineConfig,
  UIControls,
  UIControlConfig,
} from './types';

// Guards
export {guards} from './guards';
export type {GuardParams, GuardFunction} from './guards';
export type {TaskAction} from './types';

// Actions
export {actions, createInitialContext, createActionsWithCallbacks} from './actions';
export type {ActionCallbacks} from './actions';
