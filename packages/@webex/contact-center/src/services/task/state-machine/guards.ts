/**
 * Task State Machine Guards
 *
 * Guard functions that determine if a state transition is allowed.
 * These functions validate the current context before allowing transitions.
 *
 * All guards now use a consistent object-based parameter structure for better
 * maintainability, type safety, and extensibility.
 */

import {StateValue} from 'xstate';
import {TaskContext, TaskEventPayload} from './types';

/**
 * Parameters passed to all guard functions
 */
export interface GuardParams {
  /** Task context containing all task-related data */
  context: TaskContext;
  /** Current state information */
  state?: {value: StateValue};
  /** Event that triggered the guard check (optional, for future use) */
  event?: TaskEventPayload;
}

/**
 * Guard function type - all guards follow this signature
 */
export type GuardFunction = (params: GuardParams) => boolean;

/**
 * Guard functions for state machine transitions
 * Only includes guards that are actively used in the codebase
 */
export const guards = {
  /**
   * Check if recording is active
   */
  recordingActive: ({context}: GuardParams): boolean => {
    return context.recordingActive && !context.recordingPaused;
  },

  /**
   * Check if recording is paused
   */
  recordingPaused: ({context}: GuardParams): boolean => {
    return context.recordingActive && context.recordingPaused;
  },
};
