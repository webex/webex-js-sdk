import {isEventOfType} from '../../../../../../src/services/task/state-machine/types';
import {TaskEvent} from '../../../../../../src/services/task/state-machine';

describe('state-machine types', () => {
  describe('isEventOfType', () => {
    it('returns true for matching type', () => {
      const event = {type: TaskEvent.TASK_INCOMING, taskData: {interactionId: 'id'} as any};
      expect(isEventOfType(event as any, TaskEvent.TASK_INCOMING)).toBe(true);
    });

    it('returns false for non-matching type or undefined', () => {
      const event = {type: TaskEvent.TASK_INCOMING, taskData: {interactionId: 'id'} as any};
      expect(isEventOfType(event as any, TaskEvent.ASSIGN)).toBe(false);
      expect(isEventOfType(undefined, TaskEvent.ASSIGN)).toBe(false);
    });
  });
});

