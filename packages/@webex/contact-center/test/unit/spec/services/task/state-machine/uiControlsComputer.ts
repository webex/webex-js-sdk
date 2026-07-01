import {TASK_CHANNEL_TYPE, VOICE_VARIANT} from '../../../../../../src/services/task/types';
import {TaskState} from '../../../../../../src/services/task/state-machine/constants';
import {
  computeUIControls,
  getDefaultUIControls,
} from '../../../../../../src/services/task/state-machine/uiControlsComputer';
import {getTaskStateForUiControls} from '../../../../../../src/services/task/state-machine/actions';
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

function createConsultedAgentInconsistentTaskData() {
  return createTaskData({
    agentId: 'agent-2',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    consultingAgentId: 'agent-1',
    isConsulted: false,
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
          mType: 'mainCall',
          isHold: false,
          participants: ['agent-1', 'customer-1'],
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

function createPendingConsultHydrateTaskData() {
  return createTaskData({
    agentId: 'agent-1',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultInitiated',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          hasJoined: false,
          consultState: 'consultReserved',
          isConsulted: true,
        },
        'agent-3': {id: 'agent-3', pType: 'AGENT', hasLeft: false, consultState: 'conferencing'},
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-3', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-1', 'agent-2'],
        },
      } as any,
      callProcessingDetails: {
        conferenceHoldParticipant: 'true',
      },
    } as any,
  });
}

function createHeldConferenceWithActiveConsultTaskData() {
  return createTaskData({
    agentId: 'agent-2',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    consultingAgentId: 'agent-1',
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-3': {
          id: 'agent-3',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultReserved',
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-2', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-1', 'agent-3'],
        },
      } as any,
    } as any,
  });
}

function createUnheldConferenceWithActiveConsultTaskData() {
  return createTaskData({
    agentId: 'agent-2',
    mediaResourceId: 'interaction-1',
    isConsulted: false,
    interaction: {
      state: 'conference',
      type: 'AgentContactUnheld',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      owner: 'agent-5',
      participants: {
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-5': {
          id: 'agent-5',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: false,
        },
        'agent-15': {
          id: 'agent-15',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: false,
          mType: 'mainCall',
          participants: ['customer-1', 'agent-5', 'agent-2'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: true,
          mType: 'consult',
          participants: ['agent-5', 'agent-15'],
        },
      } as any,
    } as any,
  });
}

function createConferenceWithOtherAgentConsultPendingTaskData() {
  return createTaskData({
    agentId: 'agent-2',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultInitiated',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-3': {
          id: 'agent-3',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultReserved',
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: false,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-2', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-1', 'agent-3'],
        },
      } as any,
    } as any,
  });
}

function createPostConsultCompletedMultiAgentTaskData(agentId: string) {
  return createTaskData({
    agentId,
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: null as any,
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      owner: 'agent-1',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultCompleted',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-3': {
          id: 'agent-3',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-4': {
          id: 'agent-4',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-5': {
          id: 'agent-5',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5', 'customer-1'],
        },
      } as any,
    } as any,
  });
}

function createConferenceConsultingInitiatorTaskData() {
  return createTaskData({
    agentId: 'agent-1',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    consultingAgentId: 'agent-1',
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      owner: 'agent-1',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-4': {
          id: 'agent-4',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultReserved',
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-2', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-1', 'agent-4'],
        },
      } as any,
    } as any,
  });
}

function createConferenceConsultInitiatedInitiatorTaskData() {
  return createTaskData({
    agentId: 'agent-1',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    destAgentId: 'agent-4',
    destinationType: 'Agent',
    isConsulted: false,
    type: 'AgentConsultCreated' as any,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      owner: 'agent-5',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consultInitiated',
          isConsulted: false,
        },
        'agent-2': {
          id: 'agent-2',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-4': {
          id: 'agent-4',
          pType: 'AGENT',
          hasLeft: false,
          hasJoined: false,
          consultState: null,
          isConsulted: true,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['agent-1', 'agent-2', 'customer-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-1', 'agent-4'],
        },
      } as any,
    } as any,
  });
}

function createAgentContactUnheldInitiatorConsultTaskData() {
  return createTaskData({
    agentId: 'agent-1',
    mediaResourceId: 'interaction-1',
    consultMediaResourceId: 'consult-media',
    destAgentId: null as any,
    isConsulted: false,
    interaction: {
      state: 'conference',
      interactionId: 'interaction-1',
      mainInteractionId: 'interaction-1',
      owner: 'agent-5',
      participants: {
        'agent-1': {
          id: 'agent-1',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: false,
        },
        'agent-15': {
          id: 'agent-15',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: true,
        },
        'agent-5': {
          id: 'agent-5',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'agent-3': {
          id: 'agent-3',
          pType: 'AGENT',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        'interaction-1': {
          mediaResourceId: 'interaction-1',
          isHold: true,
          mType: 'mainCall',
          participants: ['customer-1', 'agent-5', 'agent-3', 'agent-1'],
        },
        'consult-media': {
          mediaResourceId: 'consult-media',
          isHold: false,
          mType: 'consult',
          participants: ['agent-15', 'agent-1'],
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

function createTaskData1LikeConferenceConsultTaskData() {
  return createTaskData({
    agentId: '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9',
    mediaResourceId: '72402b8c-802d-4537-84d4-f244c3e586b1',
    consultMediaResourceId: '66cc5edd-8ac9-4f27-8f48-286edea460b2',
    consultingAgentId: '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9',
    destAgentId: '747a2138-0a24-48fc-8d69-3a336d9b7158',
    interaction: {
      state: 'conference',
      type: 'AgentConsulting',
      interactionId: '72402b8c-802d-4537-84d4-f244c3e586b1',
      mainInteractionId: '72402b8c-802d-4537-84d4-f244c3e586b1',
      participants: {
        '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9': {
          id: '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9',
          pType: 'Agent',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: false,
        },
        '747a2138-0a24-48fc-8d69-3a336d9b7158': {
          id: '747a2138-0a24-48fc-8d69-3a336d9b7158',
          pType: 'Agent',
          hasLeft: false,
          consultState: 'consulting',
          isConsulted: true,
        },
        'e271075a-077d-42d0-9ae4-2a43cb847664': {
          id: 'e271075a-077d-42d0-9ae4-2a43cb847664',
          pType: 'Agent',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        'ed612aec-bafe-404d-b9b2-ea7de23a04f0': {
          id: 'ed612aec-bafe-404d-b9b2-ea7de23a04f0',
          pType: 'Agent',
          hasLeft: false,
          consultState: 'conferencing',
          isConsulted: false,
        },
        '+14696762938': {id: '+14696762938', pType: 'Customer', hasLeft: false},
      } as any,
      media: {
        '72402b8c-802d-4537-84d4-f244c3e586b1': {
          mediaResourceId: '72402b8c-802d-4537-84d4-f244c3e586b1',
          mType: 'mainCall',
          isHold: true,
          participants: [
            '+14696762938',
            'e271075a-077d-42d0-9ae4-2a43cb847664',
            'ed612aec-bafe-404d-b9b2-ea7de23a04f0',
            '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9',
          ],
        },
        '66cc5edd-8ac9-4f27-8f48-286edea460b2': {
          mediaResourceId: '66cc5edd-8ac9-4f27-8f48-286edea460b2',
          mType: 'consult',
          isHold: false,
          participants: ['747a2138-0a24-48fc-8d69-3a336d9b7158', '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9'],
        },
      } as any,
      owner: 'e271075a-077d-42d0-9ae4-2a43cb847664',
      callProcessingDetails: {
        conferenceHoldParticipant: 'true',
      },
    } as any,
  });
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
    expect(uiControls.consult.mute).toEqual({isVisible: false, isEnabled: false});
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
    expect(uiControls.consult.mute).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.end).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.switch).toEqual({isVisible: false, isEnabled: false});
  });

  it('enables mute only on active leg when main leg is active', () => {
    const baseTaskData = createConsultTaskData();
    const taskData = createTaskData({
      ...baseTaskData,
      interaction: {
        ...baseTaskData.interaction,
        media: {
          ...baseTaskData.interaction.media,
          'consult-media': {
            ...baseTaskData.interaction.media['consult-media'],
            participants: ['agent-1', 'agent-2'],
          },
        },
      },
    });
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      taskData,
      consultCallHeld: true,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        voiceVariant: VOICE_VARIANT.WEBRTC,
      },
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.mute).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.mute).toEqual({isVisible: true, isEnabled: false});
  });

  it('enables mute only on active leg when consult leg is active', () => {
    const baseTaskData = createConsultTaskData();
    const taskData = createTaskData({
      ...baseTaskData,
      interaction: {
        ...baseTaskData.interaction,
        media: {
          ...baseTaskData.interaction.media,
          'consult-media': {
            ...baseTaskData.interaction.media['consult-media'],
            participants: ['agent-1', 'agent-2'],
          },
        },
      },
    });
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      taskData,
      consultCallHeld: false,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        voiceVariant: VOICE_VARIANT.WEBRTC,
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, context.taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.main.mute).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.mute).toEqual({isVisible: true, isEnabled: true});
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

  it('hides main-leg controls for consulted agent when payload isConsulted is stale false', () => {
    const taskData = createConsultedAgentInconsistentTaskData();
    const baseContext = createVoiceContext();
    const consultedContext = createVoiceContext({
      consultInitiator: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONNECTED, consultedContext, taskData);

    expect(uiControls.main.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: false, isEnabled: false});
  });

  it('keeps consult-ring controls disabled except endConsult during hydrate pending state', () => {
    const pendingTaskData = createPendingConsultHydrateTaskData();
    const context = createVoiceContext({
      taskData: pendingTaskData as any,
      consultInitiator: false,
      consultFromConference: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, pendingTaskData as any);

    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});

    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.mergeToConference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
  });

  it('collapses stale consult leg controls during wrapup', () => {
    const context = createVoiceContext();

    const uiControls = computeUIControls(TaskState.WRAPPING_UP, context, context.taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.wrapup).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult).toEqual(getDefaultUIControls().consult);
  });

  it('disables consult for non-initiators when another agent has active consult', () => {
    const taskData = createConferenceWithOtherAgentConsultPendingTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      consultFromConference: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: false});
  });

  it('enables end and exitConference for non-initiators on held main leg while another agent consults', () => {
    const taskData = createHeldConferenceWithActiveConsultTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.exitConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables end and exitConference on held main leg when consultInitiator flag is stale true', () => {
    const taskData = createHeldConferenceWithActiveConsultTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.exitConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables end and exitConference on unheld main leg for non-initiator during active conference consult', () => {
    const taskData = createUnheldConferenceWithActiveConsultTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.exitConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('keeps consult disabled for non-owner after owner consult completes in multi-agent conference', () => {
    const taskData = createPostConsultCompletedMultiAgentTaskData('agent-2');
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-2',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: false});
  });

  it('keeps consult enabled for owner after consult completes in multi-agent conference', () => {
    const taskData = createPostConsultCompletedMultiAgentTaskData('agent-1');
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
  });

  it('hides transfer and enables transferConference on consult leg for conference initiator', () => {
    const taskData = createConferenceConsultingInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData);

    expect(uiControls.consult.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transferConference).toEqual({isVisible: true, isEnabled: false});
  });

  it('keeps consult leg controls active and main leg conference controls disabled on hydrate-like context', () => {
    const taskData = createConferenceConsultingInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.transferConference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.mergeToConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables consult leg controls for conference DN AgentConsulting after destination joined', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      consultingAgentId: 'agent-1',
      consultMediaResourceId: 'consult-media-1',
      isConsulted: false,
      destinationType: 'DN',
      type: 'AgentConsulting' as any,
      interaction: {
        state: 'conference',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consulting',
            isConsulted: false,
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'conferencing',
          },
          'dn-dest': {
            id: 'dn-dest',
            pType: 'DN',
            hasLeft: false,
            hasJoined: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            participants: ['agent-1', 'agent-2', 'customer-1'],
            isHold: false,
          },
          'consult-media-1': {
            mediaResourceId: 'consult-media-1',
            mType: 'consult',
            participants: ['agent-1', 'dn-dest'],
            isHold: false,
          },
        } as any,
      } as any,
    });
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultDestinationType: 'entryPoint',
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData);

    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.mergeToConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
  });

  it('keeps transferConference visible on consult leg for initiator even when state is conferencing', () => {
    const taskData = createConferenceConsultingInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.consult.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('shows transferConference for initiator in AgentContactUnheld-style conference consult context', () => {
    const taskData = createAgentContactUnheldInitiatorConsultTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: false,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('shows transferConference on main leg when initiator has active conference consult', () => {
    const taskData = createConferenceConsultingInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: true,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.transfer).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.transferConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: false});
  });

  it('keeps transferConference visible on consult leg for taskData1-style payload', () => {
    const taskData = createTaskData1LikeConferenceConsultTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: '058b3e7c-8fcf-45ee-b0c4-4ef546d360b9',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.transfer).toEqual({isVisible: false, isEnabled: false});
  });

  it('enables transferConference after AgentConsulting follows AgentConsultCreated for initiator', () => {
    const baseContext = createVoiceContext();
    const createdTaskData = createConferenceConsultInitiatedInitiatorTaskData();
    const createdContext = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      taskData: createdTaskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });
    const createdControls = computeUIControls(TaskState.CONSULTING, createdContext, createdTaskData);

    expect(createdControls.consult.transferConference).toEqual({isVisible: true, isEnabled: false});

    const consultingTaskData = createConferenceConsultingInitiatorTaskData();
    const consultingContext = createVoiceContext({
      ...createdContext,
      taskData: consultingTaskData,
      consultDestinationAgentJoined: true,
    });
    const consultingControls = computeUIControls(
      TaskState.CONSULTING,
      consultingContext,
      consultingTaskData
    );

    expect(consultingControls.consult.transferConference).toEqual({isVisible: true, isEnabled: true});
  });

  it('hides exitConference on main leg for consult initiator before destination joins', () => {
    const taskData = createConferenceConsultInitiatedInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONFERENCING, context, taskData);

    expect(uiControls.main.exitConference).toEqual({isVisible: false, isEnabled: false});
  });

  it('hides exitConference on main leg while consulting and destination has not joined', () => {
    const taskData = createConferenceConsultInitiatedInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: true,
      consultFromConference: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData);

    expect(uiControls.main.exitConference).toEqual({isVisible: false, isEnabled: false});
  });

  it('hides exitConference on main leg for pending self consult even with stale initiator flags', () => {
    const taskData = createConferenceConsultInitiatedInitiatorTaskData();
    const baseContext = createVoiceContext();
    const context = createVoiceContext({
      consultInitiator: false,
      consultFromConference: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      taskData,
      uiControlConfig: {
        ...baseContext.uiControlConfig,
        agentId: 'agent-1',
      },
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData);

    expect(uiControls.main.exitConference).toEqual({isVisible: false, isEnabled: false});
  });

  function createSimpleHeldConsultInitiatedTaskData() {
    return createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultCreated' as any,
      interaction: {
        state: 'consult',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consultInitiated',
            isConsulted: false,
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: false,
            consultState: 'consultReserved',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
          'consult-media': {
            mediaResourceId: 'consult-media',
            mType: 'consult',
            isHold: false,
            participants: ['agent-2', 'agent-1'],
          },
        } as any,
      } as any,
    });
  }

  function createConsultFailedHeldMainTaskData() {
    return createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultFailed' as any,
      interaction: {
        state: 'consult',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: false,
            consultState: 'consultReserved',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
          'consult-media': {
            mediaResourceId: 'consult-media',
            mType: 'consult',
            isHold: false,
            participants: ['agent-2', 'agent-1'],
          },
        } as any,
      } as any,
    });
  }

  it('infers HELD (not CONSULTING) while consultee has not joined', () => {
    const taskData = createSimpleHeldConsultInitiatedTaskData();

    expect(getTaskStateForUiControls(taskData as any, 'agent-1')).toBe(TaskState.HELD);
  });

  it('matches Stable Prod consult-requested controls for AgentConsultCreated while HELD', () => {
    const taskData = createSimpleHeldConsultInitiatedTaskData();
    const context = createVoiceContext({
      taskData: taskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, context, taskData as any);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.hold).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.mergeToConference).toEqual({isVisible: true, isEnabled: false});
  });

  it('clears consult leg and restores HELD main controls after AgentConsultEnded from Stable Prod', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultEnded' as any,
      interaction: {
        state: 'connected',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            holdTimestamp: 1780495564872,
            participants: ['customer-1', 'agent-1'],
          },
        } as any,
      } as any,
    });
    const staleContext = createVoiceContext({
      taskData: {
        ...(taskData as any),
        interaction: {
          ...(taskData as any).interaction,
          media: {
            ...(taskData as any).interaction.media,
            'consult-media': {
              mediaResourceId: 'consult-media',
              mType: 'consult',
              isHold: false,
              participants: ['agent-2', 'agent-1'],
            },
          },
        },
      },
      consultInitiator: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, staleContext, taskData as any);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.consult.endConsult).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.recording).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables switch, transfer, and merge on consult leg after AgentConsulting accept', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      consultingAgentId: 'agent-1',
      destAgentId: 'agent-2',
      isConsulted: false,
      type: 'AgentConsulting' as any,
      interaction: {
        state: 'consulting',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consulting',
            isConsulted: false,
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: true,
            consultState: 'consulting',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
          'consult-media': {
            mediaResourceId: 'consult-media',
            mType: 'consult',
            isHold: false,
            participants: ['agent-2', 'agent-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: taskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.CONSULTING, context, taskData as any);

    expect(uiControls.activeLeg).toBe('consult');
    expect(uiControls.consult.switch).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.mergeToConference).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.endConsult).toEqual({isVisible: true, isEnabled: true});
  });

  it('shows RONA failure controls after AgentConsultFailed while HELD', () => {
    const taskData = createConsultFailedHeldMainTaskData();
    const context = createVoiceContext({
      taskData: taskData as any,
      consultInitiator: false,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, context, taskData as any);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.recording).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.main.conference).toEqual({isVisible: false, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: false, isEnabled: false});
  });

  it('enables main.consult on AgentConsultFailed while consult media remains and destinationJoined is stale', () => {
    const taskData = createConsultFailedHeldMainTaskData();
    const context = createVoiceContext({
      taskData: taskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, context, taskData as any);

    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables main.consult when consultCompleted with stale consultMediaResourceId only (RONA cleanup)', () => {
    const taskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      isConsulted: false,
      type: 'AgentConsultEnded' as any,
      interaction: {
        state: 'connected',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
        } as any,
      } as any,
    });
    const context = createVoiceContext({
      taskData: taskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: true,
      consultCallHeld: false,
    });

    const uiControls = computeUIControls(TaskState.CONSULT_INITIATING, context, taskData as any);

    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables main.consult after AgentConsultFailed then AgentConsultEnded on held main leg (RONA)', () => {
    const consultEndedTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultEnded' as any,
      interaction: {
        state: 'connected',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: false,
            consultState: 'consultReserved',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
        } as any,
      } as any,
    });
    const staleContext = createVoiceContext({
      taskData: consultEndedTaskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      consultFromConference: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, staleContext, consultEndedTaskData as any);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
  });

  it('enables main.consult after AgentConsultEnded when consult ended before consultee answered (held main leg)', () => {
    // Agent 1 initiates consult to Agent 2 and ends it before Agent 2 answers.
    // Backend AgentConsultEnded: main on hold, self consultCompleted, no consult media,
    // and the consultee (destAgent) is not present in the participants map.
    const consultEndedTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultEnded' as any,
      interaction: {
        state: 'connected',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: true,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
        } as any,
      } as any,
    });
    // Stale context from CONSULT_INITIATING: initiator true, consultee never joined.
    const staleContext = createVoiceContext({
      taskData: consultEndedTaskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      consultFromConference: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, staleContext, consultEndedTaskData as any);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.transfer).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.recording).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: false});
    expect(uiControls.consult.endConsult).toEqual({isVisible: false, isEnabled: false});
  });

  it('enables main.consult after AgentConsultEnded even when reconciled task.data still carries stale consult media/participant', () => {
    // Reproduces the real runtime data: Task.reconcileData deep-merges and never deletes keys,
    // so after AgentConsultEnded the stale consult-media entry and consultee participant from
    // AgentConsultCreated persist in task.data. The consult button must still be enabled.
    const consultEndedTaskData = createTaskData({
      agentId: 'agent-1',
      mediaResourceId: 'interaction-1',
      consultMediaResourceId: 'consult-media',
      destAgentId: 'agent-2',
      destinationType: 'Agent',
      isConsulted: false,
      type: 'AgentConsultEnded' as any,
      interaction: {
        state: 'connected',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        owner: 'agent-1',
        participants: {
          'agent-1': {
            id: 'agent-1',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: true,
            consultState: 'consultCompleted',
            isConsulted: false,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
          // Stale consultee retained by reconcileData (never joined, consult leg gone).
          'agent-2': {
            id: 'agent-2',
            pType: 'Agent',
            hasLeft: false,
            hasJoined: false,
            consultState: 'consulting',
            isConsulted: true,
          },
        } as any,
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            isHold: true,
            participants: ['customer-1', 'agent-1'],
          },
          // Stale consult media retained by reconcileData merge.
          'consult-media': {
            mediaResourceId: 'consult-media',
            mType: 'consult',
            isHold: false,
            participants: ['agent-1', 'agent-2'],
          },
        } as any,
      } as any,
    });
    const staleContext = createVoiceContext({
      taskData: consultEndedTaskData as any,
      consultInitiator: true,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      consultFromConference: false,
    });

    const uiControls = computeUIControls(TaskState.HELD, staleContext, consultEndedTaskData as any);

    expect(uiControls.activeLeg).toBe('main');
    expect(uiControls.main.consult).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.main.hold).toEqual({isVisible: true, isEnabled: true});
    expect(uiControls.consult.endConsult).toEqual({isVisible: false, isEnabled: false});
  });

});

describe('uiControlsComputer outdial accept/decline controls', () => {
  function createOutdialContext(voiceVariant: 'webrtc' | 'pstn' = 'webrtc'): TaskContext {
    const taskData = createTaskData({
      interaction: {
        outboundType: 'OUTDIAL',
        state: 'new',
        isTerminated: false,
      } as any,
    });
    return {
      taskData,
      consultInitiator: false,
      exitingConference: false,
      consultFromConference: false,
      transferConferenceRequested: false,
      consultDestinationType: null,
      consultDestinationAgentId: null,
      consultDestinationAgentJoined: false,
      consultCallHeld: false,
      recordingControlsAvailable: false,
      recordingInProgress: false,
      uiControlConfig: {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isRecordingEnabled: false,
        agentId: 'agent-1',
        voiceVariant,
      },
      uiControls: getDefaultUIControls(),
    };
  }

  it('accept is visible but disabled for WebRTC outdial in OFFERED state', () => {
    const context = createOutdialContext('webrtc');
    const uiControls = computeUIControls(TaskState.OFFERED, context, context.taskData);

    expect(uiControls.main.accept).toEqual({isVisible: true, isEnabled: false});
  });

  it('decline is visible but disabled for WebRTC outdial in OFFERED state', () => {
    const context = createOutdialContext('webrtc');
    const uiControls = computeUIControls(TaskState.OFFERED, context, context.taskData);

    expect(uiControls.main.decline).toEqual({isVisible: true, isEnabled: false});
  });
});

describe('uiControlsComputer WebRTC call-control end button', () => {
  function createConnectedContext(voiceVariant: 'webrtc' | 'pstn'): TaskContext {
    const taskData = createTaskData({
      interaction: {
        state: 'connected',
      } as any,
    });

    return {
      taskData,
      consultInitiator: false,
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
        isEndTaskEnabled: false,
        isEndConsultEnabled: true,
        channelType: TASK_CHANNEL_TYPE.VOICE,
        isRecordingEnabled: true,
        agentId: taskData.agentId,
        voiceVariant,
      },
      uiControls: getDefaultUIControls(),
    };
  }

  it('shows main end for connected WebRTC call-control tasks even when end task is disabled', () => {
    const context = createConnectedContext('webrtc');
    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.main.end).toEqual({isVisible: true, isEnabled: true});
  });

  it('keeps main end hidden for non-WebRTC voice tasks when end task is disabled', () => {
    const context = createConnectedContext('pstn');
    const uiControls = computeUIControls(TaskState.CONNECTED, context, context.taskData);

    expect(uiControls.main.end).toEqual({isVisible: false, isEnabled: false});
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
