/**
 * Task State Machine
 *
 * Export all state machine components for easy importing
 */

// Main state machine
export {createTaskStateMachine} from './TaskStateMachine';
export type {TaskStateMachine} from './TaskStateMachine';

// Types & enums
export {TaskState, TaskEvent} from './constants';
export {isEventOfType} from './types';
export type {
  TaskContext,
  TaskEventPayload,
  TaskStateMachineConfig,
  UIControlConfig,
  TaskActionsMap,
  TaskActionArgs,
} from './types';

// Guards
export {guards} from './guards';
export type {GuardParams, GuardFunction} from './guards';

// Actions
export {actions, createInitialContext} from './actions';
