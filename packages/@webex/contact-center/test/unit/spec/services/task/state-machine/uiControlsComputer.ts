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
        'customer-1': {id: 'customer-1', pType: 'CUSTOMER', hasLeft: false},
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
    expect(uiControls.consultLeg).not.toBeNull();

    expect(uiControls.main.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});

    expect(uiControls.consultLeg?.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consultLeg?.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consultLeg?.conference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consultLeg?.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consultLeg?.switchToMainCall).toEqual({isVisible: true, isEnabled: true});

    expect(uiControls.switchToMainCall).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.transfer).toEqual({isVisible: true, isEnabled: true});
  });

  it('switches top-level controls to main leg while keeping consult leg visible', () => {
    const context = createVoiceContext({
      consultCallHeld: true,
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.consultLeg).not.toBeNull();

    expect(uiControls.main.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.switchToConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});

    expect(uiControls.consultLeg?.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consultLeg?.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consultLeg?.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consultLeg?.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consultLeg?.end).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consultLeg?.switchToMainCall).toEqual({isVisible: false, isEnabled: false});

    expect(uiControls.switchToConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.end).toEqual({isVisible: true, isEnabled: false});
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

    expect(uiControls.transfer).toEqual({isVisible: false, isEnabled: false});
  });
});
