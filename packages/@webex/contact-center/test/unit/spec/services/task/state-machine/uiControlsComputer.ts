import {TASK_CHANNEL_TYPE} from '../../../../../../src/services/task/types';
import {TaskState} from '../../../../../../src/services/task/state-machine/constants';
import {
  computeUIControls,
  getDefaultUIControls,
} from '../../../../../../src/services/task/state-machine/uiControlsComputer';
import {TaskContext} from '../../../../../../src/services/task/state-machine/types';
import {createTaskData} from '../taskTestUtils';

function createConsultTaskData() {
  return createTaskData({
    agentId: 'agent-1',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    consultingAgentId: 'agent-1',
    destAgentId: 'agent-2',
    interaction: {
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      participants: {
        'agent-1': {id: 'agent-1', pType: 'AGENT', hasLeft: false},
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          currentState: 'consulting',
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: false,
          participants: ['agent-1', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-2'],
        },
      } as any,
    } as any,
  });
}

function createVoiceContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    taskData: createConsultTaskData(),
    consultInitiator: true,
    exitingConference: false,
    consultFromConference: false,
    transferConferenceRequested: false,
    consultDestinationType: null,
    consultDestinationAgentId: null,
    consultDestinationAgentJoined: true,
    consultCallHeld: false,
    recordingControlsAvailable: true,
    recordingInProgress: true,
    uiControlConfig: {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      channelType: TASK_CHANNEL_TYPE.VOICE,
      isRecordingEnabled: true,
      agentId: 'agent-1',
    },
    uiControls: getDefaultUIControls(),
    ...overrides,
  };
}

describe('uiControlsComputer consult initiator controls', () => {
  it('returns separate main and consult controls when consult leg is active', () => {
    const context = createVoiceContext();

    const uiControls = computeUIControls(TaskState.CONSULTING, context, context.taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.consult).toBeDefined();

    expect(uiControls.main.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});

    expect(uiControls.consult.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.conference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: true});
  });

  it('switches top-level controls to main leg while keeping consult leg visible', () => {
    const context = createVoiceContext({
      consultCallHeld: true,
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.consult).toBeDefined();

    expect(uiControls.main.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.switch).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});

    expect(uiControls.consult.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.end).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.switch).toEqual({isVisible: false, isEnabled: false});
  });

  it('hides transfer for the consulted agent during consult', () => {
    const consultedTaskData = createConsultTaskData();
    const consultedContext = createVoiceContext({
      consultInitiator: false,
      taskData: {
        ...consultedTaskData,
        isConsulted: true,
      } as any,
    });

    const uiControls = computeUIControls(
      TaskState.CONSULTING,
      consultedContext,
      consultedContext.taskData
    );

    expect(uiControls.consult.transfer).toEqual({isVisible: false, isEnabled: false});
  });

  it('collapses stale consult leg controls during wrapup', () => {
    const context = createVoiceContext();

    const uiControls = computeUIControls(TaskState.WRAPPING_UP, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.wrapup).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult).toEqual(getDefaultUIControls().consult);
  });
});

describe('uiControlsComputer conference controls', () => {
  function createConferenceTaskData(participantCount: number) {
    const participants: Record<string, any> = {
      'customer-1': {id: 'customer-1', pType: 'Customer', hasJoined: true, hasLeft: false},
      'agent-1': {
        id: 'agent-1',
        pType: 'Agent',
        hasJoined: true,
        hasLeft: false,
        consultState: 'conferencing',
      },
    };
    const mainCallParticipants = ['customer-1', 'agent-1'];

    if (participantCount > 1) {
      participants['agent-2'] = {
        id: 'agent-2',
        pType: 'Agent',
        hasJoined: true,
        hasLeft: false,
        consultState: 'conferencing',
      };
      mainCallParticipants.push('agent-2');
    }

    return createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: '' as any,
      interaction: {
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        state: 'conference',
        participants,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: false,
            participants: mainCallParticipants,
          },
        },
      } as any,
    });
  }

  function createConferenceContext(participantCount: number, overrides: Partial<TaskContext> = {}): TaskContext {
    return {
      taskData: createConferenceTaskData(participantCount),
      consultInitiator: true,
      exitingConference: false,
      consultFromConference: false,
      transferConferenceRequested: false,
      consultDestinationType: null,
      consultDestinationAgentId: null,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      recordingControlsAvailable: true,
      recordingInProgress: true,
      uiControlConfig: {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isRecordingEnabled: true,
        agentId: 'agent-1',
      },
      uiControls: getDefaultUIControls(),
      ...overrides,
    };
  }

  it('pending conference (participantCount <= 1): transfer/recording enabled, consult disabled, exitConference hidden', () => {
    const context = createConferenceContext(1);

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, context.taskData);

    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.recording).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.exitConference).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
  });

  it('real conference (participantCount > 1): transfer/recording hidden, consult enabled, exitConference visible', () => {
    const context = createConferenceContext(2);

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, context.taskData);

    expect(uiControls.main.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.recording).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.exitConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
  });

  it('hold button shows visible but disabled in conference', () => {
    const context = createConferenceContext(2);

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, context.taskData);

    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: false});
  });
});

describe('uiControlsComputer post-call consult controls (customer left)', () => {
  function createPostCallConsultTaskData() {
    return createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      consultingAgentId: 'agent-1',
      destAgentId: 'agent-2',
      interaction: {
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        state: 'post_call',
        isTerminated: false,
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasJoined: true,
            hasLeft: false,
            consultState: 'consulting',
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consulting',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasJoined: true, hasLeft: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: false,
            participants: ['agent-1'],
          },
          'consult-media': {
            mediaResourceId: 'consult-media',
            mType: 'consult',
            isHold: false,
            participants: ['agent-1', 'agent-2'],
          },
        } as any,
      } as any,
    });
  }

  it('consult controls are visible but disabled when customer has left', () => {
    const taskData = createPostCallConsultTaskData();
    const context: TaskContext = {
      taskData,
      consultInitiator: true,
      exitingConference: false,
      consultFromConference: false,
      transferConferenceRequested: false,
      consultDestinationType: null,
      consultDestinationAgentId: null,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      recordingControlsAvailable: true,
      recordingInProgress: true,
      uiControlConfig: {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isRecordingEnabled: true,
        agentId: 'agent-1',
      },
      uiControls: getDefaultUIControls(),
    };

    const uiControls = computeUIControls(TaskState.CONSULTING, context, context.taskData);

    // Consult leg: transfer/conference/merge/switch should be visible but disabled
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: false});

    // Main leg end should be visible but disabled
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
  });
});
