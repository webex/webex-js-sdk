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

  it('derives consult leg from isConsultInProgress when consult media is unavailable', () => {
    const consultFlagOnlyTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: undefined,
      consultingAgentId: 'agent-1',
      isConsultInProgress: true,
      interaction: {
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'AGENT', hasLeft: false},
          'customer-1': {id: 'customer-1', pType: 'CUSTOMER', hasLeft: false},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            isHold: false,
            participants: ['agent-1', 'customer-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: consultFlagOnlyTaskData,
      consultDestinationAgentJoined: false,
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
  });

  it('keeps parked main transfer/conference/end visible-disabled when consult media is absent (EP-DN)', () => {
    const consultFlagOnlyTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: undefined,
      consultingAgentId: 'agent-1',
      isConsultInProgress: true,
      interaction: {
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'AGENT', hasLeft: false},
          'customer-1': {id: 'customer-1', pType: 'CUSTOMER', hasLeft: false},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            isHold: false,
            participants: ['agent-1', 'customer-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: consultFlagOnlyTaskData,
      consultDestinationAgentJoined: true,
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, context.taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.mergeToConference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables main switch, transfer, and conference after switch when hasParallelConsultLeg is false', () => {
    const consultFlagOnlyTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: undefined,
      consultingAgentId: 'agent-1',
      isConsultInProgress: true,
      interaction: {
        state: 'consulting',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'AGENT', hasLeft: false},
          'customer-1': {id: 'customer-1', pType: 'CUSTOMER', hasLeft: false},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            isHold: false,
            participants: ['agent-1', 'customer-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: consultFlagOnlyTaskData,
      consultDestinationAgentJoined: true,
      consultCallHeld: true,
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.switch).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.mergeToConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('shows only endConsult for consult relationship assignment payloads', () => {
    const consultRelationshipTaskData = createTaskData({
      agentId: 'agent-1',
      isConsulted: false,
      consultMediaResourceId: undefined,
      interaction: {
        interactionId: 'interaction-1',
        mainInteractionId: 'main-interaction-1',
        state: 'connected',
        callProcessingDetails: {
          relationshipType: 'consult',
          parentInteractionId: 'main-interaction-1',
          hasCustomerLeft: 'true',
        },
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'AGENT',
            hasLeft: false,
            currentState: 'post_call',
            isConsulted: false,
          },
          'customer-1': {
            id: 'customer-1',
            pType: 'CUSTOMER',
            hasLeft: false,
          },
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            isHold: false,
            mType: 'mainCall',
            participants: ['agent-1', 'customer-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: consultRelationshipTaskData,
      consultInitiator: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);
    const controls = uiControls.main;

    expect(controls.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(controls.accept).toEqual({isVisible: false, isEnabled: false});
    expect(controls.decline).toEqual({isVisible: false, isEnabled: false});
    expect(controls.hold).toEqual({isVisible: false, isEnabled: false});
    expect(controls.mute).toEqual({isVisible: false, isEnabled: false});
    expect(controls.end).toEqual({isVisible: false, isEnabled: false});
    expect(controls.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(controls.consult).toEqual({isVisible: false, isEnabled: false});
    expect(controls.conference).toEqual({isVisible: false, isEnabled: false});
    expect(controls.switch).toEqual({isVisible: false, isEnabled: false});
    expect(controls.wrapup).toEqual({isVisible: false, isEnabled: false});
    expect(controls.recording).toEqual({isVisible: false, isEnabled: false});
    expect(controls.exitConference).toEqual({isVisible: false, isEnabled: false});
    expect(controls.transferConference).toEqual({isVisible: false, isEnabled: false});
    expect(controls.mergeToConference).toEqual({isVisible: false, isEnabled: false});
  });

  it('full controls for new primary owner when stale relationshipType consult remains on main call', () => {
    const transferredOwnerTask = createTaskData({
      agentId: 'agent-2',
      isConsulted: false,
      consultMediaResourceId: undefined,
      interaction: {
        interactionId: 'main-1',
        mainInteractionId: 'main-1',
        state: 'connected',
        owner: 'agent-2',
        callProcessingDetails: {
          relationshipType: 'consult',
          parentInteractionId: 'main-1',
        },
        participants: {
          'agent-2': {id: 'agent-2', pType: 'AGENT', hasLeft: false},
          'customer-1': {id: 'customer-1', pType: 'CUSTOMER', hasLeft: false},
        } as any,
        media: {
          'main-1': {
            mediaResourceId: 'main-1',
            isHold: false,
            participants: ['agent-2', 'customer-1'],
          },
        } as any,
      } as any,
    });
    const base = createVoiceContext({
      taskData: transferredOwnerTask,
      consultInitiator: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
    });
    const context: TaskContext = {
      ...base,
      uiControlConfig: {
        ...base.uiControlConfig,
        agentId: 'agent-2',
      },
    };

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);
    const {main} = uiControls;

    expect(main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(main.recording).toEqual({isVisible: true, isEnabled: true});
    expect(main.end).toEqual({isVisible: true, isEnabled: true});
  });
});
