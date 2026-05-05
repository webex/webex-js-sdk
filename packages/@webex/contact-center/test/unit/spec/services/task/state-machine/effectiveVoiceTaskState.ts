import {TaskState} from '../../../../../../src/services/task/state-machine/constants';
import {resolveEffectiveVoiceTaskState} from '../../../../../../src/services/task/state-machine/effectiveVoiceTaskState';
import {createTaskData} from '../taskTestUtils';

describe('resolveEffectiveVoiceTaskState', () => {
  it('forces WRAPPING_UP when wrapUpRequired is true after transfer', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      wrapUpRequired: true,
      interaction: {
        state: 'connected',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: true},
        },
      } as any,
    });

    const effective = resolveEffectiveVoiceTaskState(TaskState.CONNECTED, taskData);

    expect(effective).toBe(TaskState.WRAPPING_UP);
  });

  it('forces WRAPPING_UP when current agent is listed in agentsPendingWrapUp', () => {
    const taskData = createTaskData({
      agentId: 'agent-2',
      wrapUpRequired: false,
      agentsPendingWrapUp: ['agent-2'],
      interaction: {
        state: 'connected',
      } as any,
    });

    const effective = resolveEffectiveVoiceTaskState(TaskState.IDLE, taskData);

    expect(effective).toBe(TaskState.WRAPPING_UP);
  });

  it('keeps machine state when transfer wrap-up markers do not apply to current agent', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      wrapUpRequired: false,
      agentsPendingWrapUp: ['agent-2'],
      interaction: {
        state: 'connected',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false, isWrapUp: false},
        },
      } as any,
    });

    const effective = resolveEffectiveVoiceTaskState(TaskState.CONNECTED, taskData);

    expect(effective).toBe(TaskState.CONNECTED);
  });
});
