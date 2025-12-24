/**
 * Task State Machine
 *
 * Export all state machine components for easy importing
 */

// Main state machine
export {getTaskStateMachineConfig, createTaskStateMachine} from './TaskStateMachine';
export type {TaskStateMachine} from './TaskStateMachine';

// Types & enums
export {TaskState, TaskEvent, TaskAction} from './constants';
export {isEventOfType} from './types';
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

// Actions
export {actions, createInitialContext} from './actions';
