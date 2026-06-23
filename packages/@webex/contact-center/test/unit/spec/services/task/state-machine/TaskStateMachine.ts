import {createActor} from 'xstate';
import {
  createTaskStateMachine,
  TaskEvent,
  TaskState,
} from '../../../../../../src/services/task/state-machine';
import {createTaskData} from '../taskTestUtils';

const createConfig = () => ({
  channelType: 'voice' as const,
  isEndTaskEnabled: true,
  isEndConsultEnabled: true,
  voiceVariant: 'pstn' as const,
  isRecordingEnabled: true,
});

describe('Task state machine', () => {
  const startMachine = () => {
    const actor = createActor(createTaskStateMachine(createConfig()));
    actor.start();

    return actor;
  };

  describe('recording state derivation', () => {
    it('captures recording flags from offer payload', () => {
      const service = startMachine();
      const taskData = createTaskData({
        interaction: {
          callProcessingDetails: {
            recordInProgress: true,
            isPaused: false,
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.context.recordingControlsAvailable).toBe(true);
      expect(snapshot.context.recordingInProgress).toBe(true);
    });

    it('updates recordingPaused when ASSIGN payload reports pause', () => {
      const service = startMachine();
      const initialTaskData = createTaskData();
      const pausedTaskData = createTaskData({
        interaction: {
          callProcessingDetails: {
            isPaused: true,
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: initialTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: pausedTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.context.recordingControlsAvailable).toBe(true);
      expect(snapshot.context.recordingInProgress).toBe(false);
    });

    it('updates recording state when recording started event arrives', () => {
      const service = startMachine();
      const initialTaskData = createTaskData();
      const recordingTaskData = createTaskData({
        interaction: {
          callProcessingDetails: {
            recordingStarted: true,
            recordInProgress: true,
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: initialTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: initialTaskData});
      service.send({type: TaskEvent.RECORDING_STARTED, taskData: recordingTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONNECTED);
      expect(snapshot.context.recordingControlsAvailable).toBe(true);
      expect(snapshot.context.recordingInProgress).toBe(true);
    });
  });

  describe('hold and resume flow', () => {
    it('moves through HOLD -> HELD -> CONNECTED on success events', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);

      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HOLD_INITIATING);

      service.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      service.send({type: TaskEvent.UNHOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.RESUME_INITIATING);

      service.send({type: TaskEvent.UNHOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });
  });

  describe('recording pause/resume events', () => {
    it('toggles recordingPaused flag based on events', () => {
      const service = startMachine();
      const taskData = createTaskData({
        interaction: {
          callProcessingDetails: {recordInProgress: true},
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);

      service.send({type: TaskEvent.PAUSE_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(false);

      service.send({type: TaskEvent.RESUME_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);
    });

    it('toggles recording state while task is held', () => {
      const service = startMachine();
      const taskData = createTaskData({
        interaction: {
          callProcessingDetails: {recordInProgress: true},
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      service.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);

      service.send({type: TaskEvent.PAUSE_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(false);

      service.send({type: TaskEvent.RESUME_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);
    });
  });

  describe('wrap-up and completion flow', () => {
    it('moves from CONNECTED -> WRAPPING_UP -> COMPLETED on END/WRAPUP_COMPLETE', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);

      service.send({type: TaskEvent.TASK_WRAPUP});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);

      service.send({type: TaskEvent.WRAPUP_COMPLETE});
      expect(service.getSnapshot().value).toBe(TaskState.COMPLETED);
    });

    it('handles CONTACT_ENDED by entering wrapping up before completion', () => {
      const service = startMachine();
      // Primary agent (isConsulted: false) should go to WRAPPING_UP
      const taskData = createTaskData({isConsulted: false} as any);

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});

      // CONTACT_ENDED event must include taskData for shouldWrapUpForThisAgent check
      service.send({type: TaskEvent.CONTACT_ENDED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);

      service.send({type: TaskEvent.WRAPUP_COMPLETE});
      expect(service.getSnapshot().value).toBe(TaskState.COMPLETED);
    });
  });

  describe('consult and conference flows', () => {
    const createSingleAgentConferenceTaskData = (interactionState: string, isHold = false) =>
      createTaskData({
        interactionId: 'interaction-1',
        mediaResourceId: 'interaction-1',
        interaction: {
          state: interactionState,
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: ['agent-1', 'customer-1'],
              isHold,
            },
          },
        } as any,
      });

    const createConferenceConsultTaskData = ({
      interactionState,
      includeSecondAgent,
      conferenceHoldParticipant,
      isMainHeld = false,
    }: {
      interactionState: string;
      includeSecondAgent: boolean;
      conferenceHoldParticipant: boolean | string;
      isMainHeld?: boolean;
    }) =>
      createTaskData({
        interactionId: 'interaction-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media-1',
        interaction: {
          state: interactionState,
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
          callProcessingDetails: {
            conferenceHoldParticipant,
          },
          participants: {
            'agent-1': {
              id: 'agent-1',
              pType: 'Agent',
              hasLeft: false,
              consultState: 'consulting',
            },
            ...(includeSecondAgent
              ? {
                  'agent-2': {
                    id: 'agent-2',
                    pType: 'Agent',
                    hasLeft: false,
                  },
                }
              : {}),
            'agent-3': {
              id: 'agent-3',
              pType: 'Agent',
              hasLeft: false,
              isConsulted: true,
              consultState: 'consulting',
            },
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: includeSecondAgent
                ? ['agent-1', 'agent-2', 'customer-1']
                : ['agent-1', 'customer-1'],
              isHold: isMainHeld,
            },
            'consult-media-1': {
              mediaResourceId: 'consult-media-1',
              mType: 'consult',
              participants: ['agent-1', 'agent-3'],
              isHold: false,
            },
          },
        } as any,
      });

    it('boots from IDLE to CONSULTING on CONSULTING_ACTIVE for split-leg ordering', () => {
      const service = startMachine();
      const taskData = createTaskData({
        consultingAgentId: 'agent-1',
        isConsulted: false,
        interaction: {
          state: 'consulting',
        } as any,
      });

      expect(service.getSnapshot().value).toBe(TaskState.IDLE);
      service.send({
        type: TaskEvent.CONSULTING_ACTIVE,
        consultDestinationAgentJoined: true,
        taskData,
      });

      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);
      expect(service.getSnapshot().context.consultDestinationAgentJoined).toBe(true);
    });

    it('hydrates to CONSULTING when top-level state is conference but self consultState is consulting', () => {
      const service = startMachine();
      const taskData = createTaskData({
        isConsulted: false,
        interaction: {
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
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
              consultState: 'consulting',
              isConsulted: true,
            },
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: ['agent-1', 'customer-1'],
              isHold: true,
            },
            'consult-media-1': {
              mediaResourceId: 'consult-media-1',
              mType: 'consult',
              participants: ['agent-1', 'agent-2'],
              isHold: false,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.HYDRATE, taskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONSULTING);
      expect(snapshot.context.consultInitiator).toBe(true);
      expect(snapshot.context.consultFromConference).toBe(true);
    });

  it('hydrates consulted agent to CONSULTING when self consultState is consulting and main leg is held', () => {
    const service = startMachine();
    const taskData = createTaskData({
      agentId: 'agent-2',
      isConsulted: true,
      interaction: {
        state: 'conference',
        mainInteractionId: 'interaction-1',
        interactionId: 'interaction-1',
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
            consultState: 'consulting',
            isConsulted: true,
          },
          'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
        },
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            participants: ['agent-1', 'customer-1'],
            isHold: true,
          },
          'consult-media-1': {
            mediaResourceId: 'consult-media-1',
            mType: 'consult',
            participants: ['agent-1', 'agent-2'],
            isHold: false,
          },
        },
      } as any,
    });

    service.send({type: TaskEvent.HYDRATE, taskData});

    expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);
  });

    it('hydrates to CONSULTING when consult is pending (self consultState is consultInitiated)', () => {
      const service = startMachine();
      const taskData = createTaskData({
        isConsulted: false,
        interaction: {
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
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
              consultState: 'consultReserved',
              isConsulted: true,
            },
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: ['agent-1', 'customer-1'],
              isHold: true,
            },
            'consult-media-1': {
              mediaResourceId: 'consult-media-1',
              mType: 'consult',
              participants: ['agent-1', 'agent-2'],
              isHold: false,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.HYDRATE, taskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONSULTING);
      expect(snapshot.context.consultInitiator).toBe(true);
      expect(snapshot.context.consultFromConference).toBe(true);
    });

    it('tracks consult destination, agent join, and clears on consult end', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});

      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      expect(service.getSnapshot().context.consultInitiator).toBe(true);

      service.send({type: TaskEvent.CONSULT_SUCCESS});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({
        type: TaskEvent.CONSULTING_ACTIVE,
        consultDestinationAgentJoined: true,
      });
      expect(service.getSnapshot().context.consultDestinationAgentJoined).toBe(true);

      service.send({type: TaskEvent.CONSULT_END});
      const snapshotAfterEnd = service.getSnapshot();
      expect(snapshotAfterEnd.value).toBe(TaskState.HELD);
      expect(snapshotAfterEnd.context.consultDestinationAgentJoined).toBe(false);
    });

    it('returns to HELD with main-leg controls after AgentConsultEnded from Stable Prod while CONSULTING', () => {
      const service = startMachine();
      const baseTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: baseTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: baseTaskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-2',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS});
      service.send({type: TaskEvent.CONSULTING_ACTIVE, consultDestinationAgentJoined: true});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      const consultEndedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        type: 'AgentConsultEnded' as any,
        isConsulted: false,
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
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              isHold: true,
              participants: ['customer-1', 'agent-1'],
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.CONSULT_END, taskData: consultEndedTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.HELD);
      expect(snapshot.context.consultInitiator).toBe(false);
      expect(snapshot.context.consultCallHeld).toBe(false);
      expect(snapshot.context.consultDestinationAgentJoined).toBe(false);
      expect(snapshot.context.uiControls.activeLeg).toBe('main');
      expect(snapshot.context.uiControls.consult.endConsult).toEqual({
        isVisible: false,
        isEnabled: false,
      });
      expect(snapshot.context.uiControls.main.hold).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.main.consult).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.main.transfer).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.main.recording).toEqual({
        isVisible: true,
        isEnabled: true,
      });
    });

    it('enables main consult after ending consult before consultee answers (CONSULT_INITIATING -> CONSULT_END)', () => {
      const service = startMachine();
      const baseTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: baseTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: baseTaskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-2',
        destinationType: 'agent',
      });
      // Consult requested but consultee (agent-2) has not answered yet.
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);

      // Agent 1 ends the consult before agent-2 answers. Backend AgentConsultEnded:
      // main on hold, self consultCompleted, no consult media, consultee not in participants.
      const consultEndedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media',
        destAgentId: 'agent-2',
        destinationType: 'Agent',
        type: 'AgentConsultEnded' as any,
        isConsulted: false,
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
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              isHold: true,
              participants: ['customer-1', 'agent-1'],
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.CONSULT_END, taskData: consultEndedTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.HELD);
      expect(snapshot.context.consultInitiator).toBe(false);
      expect(snapshot.context.consultDestinationAgentJoined).toBe(false);
      expect(snapshot.context.uiControls.activeLeg).toBe('main');
      expect(snapshot.context.uiControls.main.consult).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.consult.endConsult).toEqual({
        isVisible: false,
        isEnabled: false,
      });
    });

    it('stays HELD and clears consult UI when AgentConsultEnded arrives on HELD state', () => {
      const service = startMachine();
      const heldTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        interaction: {
          state: 'hold',
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
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false, hasJoined: true},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              isHold: true,
              participants: ['customer-1', 'agent-1'],
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: heldTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: heldTaskData});
      service.send({
        type: TaskEvent.HOLD_INITIATED,
        mediaResourceId: heldTaskData.mediaResourceId,
      });
      service.send({
        type: TaskEvent.HOLD_SUCCESS,
        mediaResourceId: heldTaskData.mediaResourceId,
        taskData: heldTaskData,
      });
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      const consultEndedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        type: 'AgentConsultEnded' as any,
        isConsulted: false,
        interaction: {
          state: 'hold',
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
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              isHold: true,
              participants: ['customer-1', 'agent-1'],
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.CONSULT_END, taskData: consultEndedTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.HELD);
      expect(snapshot.context.consultInitiator).toBe(false);
      expect(snapshot.context.uiControls.activeLeg).toBe('main');
      expect(snapshot.context.uiControls.main.hold).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.consult.endConsult).toEqual({
        isVisible: false,
        isEnabled: false,
      });
    });

    it('keeps main.consult enabled on HELD after AgentConsultFailed then AgentConsultEnded (RONA)', () => {
      const service = startMachine();
      const heldTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        type: 'AgentContactHeld' as any,
        interaction: {
          state: 'hold',
          interactionId: 'interaction-1',
          mainInteractionId: 'interaction-1',
          owner: 'agent-1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
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

      service.send({type: TaskEvent.TASK_INCOMING, taskData: heldTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: heldTaskData});
      service.send({
        type: TaskEvent.HOLD_INITIATED,
        mediaResourceId: heldTaskData.mediaResourceId,
      });
      service.send({
        type: TaskEvent.HOLD_SUCCESS,
        mediaResourceId: heldTaskData.mediaResourceId,
        taskData: heldTaskData,
      });
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      const consultCreatedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media',
        consultingAgentId: 'agent-1',
        destAgentId: 'agent-2',
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
              participants: ['agent-2', 'agent-1'],
            },
          } as any,
        } as any,
      });
      service.send({type: TaskEvent.CONSULT_CREATED, taskData: consultCreatedTaskData});

      const consultFailedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media',
        consultingAgentId: 'agent-1',
        destAgentId: 'agent-2',
        isConsulted: false,
        type: 'AgentConsultFailed' as any,
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
      service.send({type: TaskEvent.CONSULT_FAILED, taskData: consultFailedTaskData});

      const consultEndedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media',
        isConsulted: false,
        type: 'AgentConsultEnded' as any,
        interaction: consultFailedTaskData.interaction,
      });
      service.send({type: TaskEvent.CONSULT_END, taskData: consultEndedTaskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.HELD);
      expect(snapshot.context.consultInitiator).toBe(false);
      expect(snapshot.context.uiControls.activeLeg).toBe('main');
      expect(snapshot.context.uiControls.main.consult).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.main.hold).toEqual({
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.context.uiControls.main.transfer).toEqual({
        isVisible: true,
        isEnabled: true,
      });
    });

    it('returns to main leg (HELD) and does not clear the task after AgentConsultFailed then AgentConsultEnded while CONSULTING (RONA)', () => {
      const service = startMachine();
      const heldTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        type: 'AgentContactHeld' as any,
        interaction: {
          state: 'hold',
          interactionId: 'interaction-1',
          mainInteractionId: 'interaction-1',
          owner: 'agent-1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
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

      service.send({type: TaskEvent.TASK_INCOMING, taskData: heldTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: heldTaskData});
      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: heldTaskData.mediaResourceId});
      service.send({
        type: TaskEvent.HOLD_SUCCESS,
        mediaResourceId: heldTaskData.mediaResourceId,
        taskData: heldTaskData,
      });
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      // Agent 1 initiates a consult and AgentConsulting arrives during ringing, moving the
      // initiator into CONSULTING before the consultee answers.
      service.send({type: TaskEvent.CONSULT, destination: 'agent-2', destinationType: 'agent'});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      service.send({type: TaskEvent.CONSULT_SUCCESS});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);
      expect(service.getSnapshot().context.consultInitiator).toBe(true);

      // Consultee RONAs: AgentConsultFailed arrives while still in CONSULTING. Main stays held.
      const consultFailedTaskData = createTaskData({
        agentId: 'agent-1',
        mediaResourceId: 'interaction-1',
        consultMediaResourceId: 'consult-media',
        consultingAgentId: 'agent-1',
        destAgentId: 'agent-2',
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
              participants: ['agent-2', 'agent-1'],
            },
          } as any,
        } as any,
      });
      service.send({type: TaskEvent.CONSULT_FAILED, taskData: consultFailedTaskData});
      // The initiator must leave CONSULTING and fall back to the held main leg (not stay in
      // CONSULTING, which would let the trailing AgentConsultEnded terminate the task).
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      // AgentConsultEnded closes out the consult leg.
      const consultEndedTaskData = createTaskData({
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
      service.send({type: TaskEvent.CONSULT_END, taskData: consultEndedTaskData});

      const snapshot = service.getSnapshot();
      // The task must remain on the main leg (HELD) and never reach TERMINATED.
      expect(snapshot.value).toBe(TaskState.HELD);
      expect(snapshot.value).not.toBe(TaskState.TERMINATED);
      expect(snapshot.context.consultInitiator).toBe(false);
      expect(snapshot.context.uiControls.activeLeg).toBe('main');
      expect(snapshot.context.uiControls.main.consult).toEqual({
        isVisible: true,
        isEnabled: true,
      });
    });

    it('transitions CONSULT_INITIATING to CONSULTING on CONSULTING_ACTIVE and marks destination joined', () => {
      const service = startMachine();
      const baseTaskData = createTaskData();
      const consultingTaskData = createTaskData({
        agentId: 'agent-1',
        isConsulted: false,
        consultMediaResourceId: 'consult-media',
        interaction: {
          state: 'consulting',
          interactionId: 'interaction-1',
          mainInteractionId: 'interaction-1',
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
          } as any,
          media: {
            'interaction-1': {mediaResourceId: 'interaction-1', mType: 'mainCall', isHold: true},
            'consult-media': {
              mediaResourceId: 'consult-media',
              mType: 'consult',
              participants: ['agent-1', 'agent-2'],
            },
          } as any,
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: baseTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: baseTaskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-2',
        destinationType: 'agent',
      });

      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);

      service.send({
        type: TaskEvent.CONSULTING_ACTIVE,
        consultDestinationAgentJoined: true,
        taskData: consultingTaskData,
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONSULTING);
      expect(snapshot.context.consultInitiator).toBe(true);
      expect(snapshot.context.consultDestinationAgentJoined).toBe(true);
    });

    it('keeps consultDestinationAgentJoined false while consultee is only reserved, then sets true on actual join', () => {
      const service = startMachine();
      const pendingTaskData = createTaskData({
        isConsulted: false,
        interaction: {
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
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
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: ['agent-1', 'customer-1'],
              isHold: true,
            },
            'consult-media-1': {
              mediaResourceId: 'consult-media-1',
              mType: 'consult',
              participants: ['agent-1', 'agent-2'],
              isHold: false,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.HYDRATE, taskData: pendingTaskData});

      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);
      expect(service.getSnapshot().context.consultDestinationAgentJoined).toBe(false);

      const joinedTaskData = {
        ...pendingTaskData,
        interaction: {
          ...pendingTaskData.interaction,
          participants: {
            ...pendingTaskData.interaction?.participants,
            'agent-2': {
              ...pendingTaskData.interaction?.participants?.['agent-2'],
              hasJoined: true,
              consultState: 'consulting',
            },
          },
        },
      } as any;

      service.send({type: TaskEvent.CONTACT_UPDATED, taskData: joinedTaskData});

      expect(service.getSnapshot().context.consultDestinationAgentJoined).toBe(true);
    });

    it('hydrates conference consult context flags for active consult leg controls', () => {
      const service = startMachine();
      const taskData = createTaskData({
        type: 'AgentContactUnheld' as any,
        isConsulted: false,
        consultingAgentId: 'agent-1',
        consultMediaResourceId: 'consult-media-1',
        interaction: {
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
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
            'agent-3': {
              id: 'agent-3',
              pType: 'Agent',
              hasLeft: false,
              consultState: 'conferencing',
              isConsulted: false,
            },
            'customer-1': {id: 'customer-1', pType: 'Customer', hasLeft: false},
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mType: 'mainCall',
              participants: ['agent-1', 'agent-3', 'customer-1'],
              isHold: false,
            },
            'consult-media-1': {
              mediaResourceId: 'consult-media-1',
              mType: 'consult',
              participants: ['agent-1', 'agent-2'],
              isHold: false,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.HYDRATE, taskData});

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONSULTING);
      expect(snapshot.context.consultInitiator).toBe(true);
      expect(snapshot.context.consultFromConference).toBe(true);
      expect(snapshot.context.consultDestinationAgentJoined).toBe(true);
      expect(snapshot.context.consultCallHeld).toBe(false);
    });

    it('returns to connected when consult ends after switching back to the main leg', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS});
      service.send({type: TaskEvent.SWITCH_TO_MAIN_CALL});

      expect(service.getSnapshot().context.consultCallHeld).toBe(true);

      service.send({type: TaskEvent.CONSULT_END});

      const snapshotAfterEnd = service.getSnapshot();
      expect(snapshotAfterEnd.value).toBe(TaskState.CONNECTED);
      expect(snapshotAfterEnd.context.consultCallHeld).toBe(false);
    });

    it('downgrades to HELD on CONSULT_END when conference has downgraded and conferenceHoldParticipant is true', () => {
      const service = startMachine();
      const conferenceTaskData = createConferenceConsultTaskData({
        interactionState: 'conference',
        includeSecondAgent: true,
        conferenceHoldParticipant: false,
      });
      const downgradedHeldTaskData = createConferenceConsultTaskData({
        interactionState: 'hold',
        includeSecondAgent: false,
        conferenceHoldParticipant: true,
        isMainHeld: true,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({type: TaskEvent.CONSULT, destination: 'agent-3', destinationType: 'agent'});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({type: TaskEvent.CONSULT_END, taskData: downgradedHeldTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);
    });

    it('downgrades to CONNECTED on CONSULT_END when conference has downgraded and conferenceHoldParticipant is false', () => {
      const service = startMachine();
      const conferenceTaskData = createConferenceConsultTaskData({
        interactionState: 'conference',
        includeSecondAgent: true,
        conferenceHoldParticipant: false,
      });
      const downgradedConnectedTaskData = createConferenceConsultTaskData({
        interactionState: 'connected',
        includeSecondAgent: false,
        conferenceHoldParticipant: false,
        isMainHeld: false,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({type: TaskEvent.CONSULT, destination: 'agent-3', destinationType: 'agent'});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({type: TaskEvent.CONSULT_END, taskData: downgradedConnectedTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });

    it('returns to CONFERENCING on CONSULT_END when conference is still active', () => {
      const service = startMachine();
      const conferenceTaskData = createConferenceConsultTaskData({
        interactionState: 'conference',
        includeSecondAgent: true,
        conferenceHoldParticipant: false,
      });
      const stillConferenceTaskData = createConferenceConsultTaskData({
        interactionState: 'conference',
        includeSecondAgent: true,
        conferenceHoldParticipant: false,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({type: TaskEvent.CONSULT, destination: 'agent-3', destinationType: 'agent'});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({type: TaskEvent.CONSULT_END, taskData: stillConferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);
    });

    it('transitions CONFERENCING to CONSULTING on CONSULTING_ACTIVE and marks DN consult joined', () => {
      const service = startMachine();
      const conferenceTaskData = createConferenceConsultTaskData({
        interactionState: 'conference',
        includeSecondAgent: true,
        conferenceHoldParticipant: false,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      const dnConsultTaskData = createTaskData({
        type: 'AgentConsulting' as any,
        agentId: 'agent-1',
        consultingAgentId: 'agent-1',
        isConsulted: false,
        destinationType: 'DN',
        consultMediaResourceId: 'consult-media-1',
        interaction: {
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
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
          },
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
          },
        } as any,
      });

      service.send({
        type: TaskEvent.CONSULTING_ACTIVE,
        consultDestinationAgentJoined: true,
        taskData: dnConsultTaskData,
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.value).toBe(TaskState.CONSULTING);
      expect(snapshot.context.consultDestinationAgentJoined).toBe(true);
      expect(snapshot.context.consultFromConference).toBe(true);
      expect(snapshot.context.consultDestinationType).toBe('entryPoint');
    });

    it('transitions to conferencing when merge event is received', () => {
      const service = startMachine();
      const taskData = createTaskData({consultingAgentId: 'agent-1'});

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      expect(service.getSnapshot().value).toBe(TaskState.CONF_INITIATING);

      service.send({type: TaskEvent.CONFERENCE_START});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);
    });

    it('terminates via wrapup when EXIT_CONFERENCE_SUCCESS is received in conferencing', () => {
      const service = startMachine();
      const taskData = createTaskData({
        // shouldWrapUpForThisAgent will return true when owner matches self agent
        interaction: {
          owner: 'agent-1',
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
          participants: {
            'agent-1': {
              id: 'agent-1',
              pType: 'Agent',
              type: 'Agent',
              hasJoined: true,
              hasLeft: false,
              isInPredial: false,
            },
            c1: {
              id: 'c1',
              pType: 'Customer',
              type: 'Customer',
              hasJoined: true,
              hasLeft: false,
              isInPredial: false,
            },
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mediaType: 'telephony',
              mediaMgr: 'mm',
              participants: ['agent-1', 'c1'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      service.send({type: TaskEvent.CONFERENCE_START, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({type: TaskEvent.EXIT_CONFERENCE_SUCCESS, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);
    });

    it('terminates when EXIT_CONFERENCE_SUCCESS is received in conferencing and wrapup is not required', () => {
      const service = startMachine();
      const taskData = createTaskData({
        isConsulted: true,
        wrapUpRequired: false,
        interaction: {
          owner: 'other-agent',
          state: 'conference',
          mainInteractionId: 'interaction-1',
          interactionId: 'interaction-1',
          participants: {
            'agent-1': {
              id: 'agent-1',
              pType: 'Agent',
              type: 'Agent',
              hasJoined: true,
              hasLeft: false,
              isInPredial: false,
              isWrapUp: false,
            },
            c1: {
              id: 'c1',
              pType: 'Customer',
              type: 'Customer',
              hasJoined: true,
              hasLeft: false,
              isInPredial: false,
            },
          },
          media: {
            'interaction-1': {
              mediaResourceId: 'interaction-1',
              mediaType: 'telephony',
              mediaMgr: 'mm',
              participants: ['agent-1', 'c1'],
              mType: 'mainCall',
              isHold: false,
              holdTimestamp: null,
            },
          },
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      service.send({type: TaskEvent.CONFERENCE_START, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({type: TaskEvent.EXIT_CONFERENCE_SUCCESS, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.TERMINATED);
    });

    it('downgrades to HELD on HOLD_SUCCESS when no other agents remain on task', () => {
      const service = startMachine();
      const conferenceTaskData = createSingleAgentConferenceTaskData('conference');
      const heldTaskData = createSingleAgentConferenceTaskData('hold', true);

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({
        type: TaskEvent.HOLD_SUCCESS,
        mediaResourceId: heldTaskData.mediaResourceId,
        taskData: heldTaskData,
      });

      expect(service.getSnapshot().value).toBe(TaskState.HELD);
    });

    it('downgrades to CONNECTED on UNHOLD_SUCCESS when no other agents remain on task', () => {
      const service = startMachine();
      const conferenceTaskData = createSingleAgentConferenceTaskData('conference');
      const connectedTaskData = createSingleAgentConferenceTaskData('connected', false);

      service.send({type: TaskEvent.TASK_INCOMING, taskData: conferenceTaskData});
      service.send({type: TaskEvent.ASSIGN, taskData: conferenceTaskData});
      service.send({type: TaskEvent.CONFERENCE_START, taskData: conferenceTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      service.send({
        type: TaskEvent.UNHOLD_SUCCESS,
        mediaResourceId: connectedTaskData.mediaResourceId,
        taskData: connectedTaskData,
      });

      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });

    it('returns to CONNECTED when CTQ cancel arrives before queue connects', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});

      service.send({
        type: TaskEvent.CONSULT,
        destination: 'queue-1',
        destinationType: 'queue',
      });
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);

      service.send({type: TaskEvent.CTQ_CANCEL});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });

    it('returns to CONNECTED when CTQ consult fails', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});

      service.send({
        type: TaskEvent.CONSULT,
        destination: 'queue-1',
        destinationType: 'queue',
      });
      expect(service.getSnapshot().value).toBe(TaskState.CONSULT_INITIATING);

      service.send({type: TaskEvent.CONSULT_FAILED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });
  });

  describe('failure scenarios', () => {
    it('returns to CONNECTED when HOLD fails', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HOLD_INITIATING);

      service.send({
        type: TaskEvent.HOLD_FAILED,
        mediaResourceId: taskData.mediaResourceId,
      });
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });

    it('falls back to HELD when UNHOLD fails', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      service.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      service.send({type: TaskEvent.UNHOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.RESUME_INITIATING);

      service.send({type: TaskEvent.UNHOLD_FAILED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);
    });
  });

  describe('CONF_INITIATING state event handlers', () => {
    it('transitions to CONFERENCING on CONFERENCE_START', () => {
      const service = startMachine();
      const taskData = createTaskData({consultingAgentId: 'agent-1'});

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      expect(service.getSnapshot().value).toBe(TaskState.CONF_INITIATING);

      service.send({type: TaskEvent.CONFERENCE_START, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);
    });

    it('transitions to WRAPPING_UP on CONSULT_END with isTerminated during CONF_INITIATING', () => {
      const service = startMachine();
      const taskData = createTaskData({consultingAgentId: 'agent-1'});

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      expect(service.getSnapshot().value).toBe(TaskState.CONF_INITIATING);

      const terminatedTaskData = createTaskData({
        consultingAgentId: 'agent-1',
        interaction: {
          isTerminated: true,
          owner: 'agent-1',
        } as any,
      });
      service.send({type: TaskEvent.CONSULT_END, taskData: terminatedTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);
    });

    it('transitions to CONNECTED on CONSULT_END without isTerminated during CONF_INITIATING', () => {
      const service = startMachine();
      const taskData = createTaskData({consultingAgentId: 'agent-1'});

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      expect(service.getSnapshot().value).toBe(TaskState.CONF_INITIATING);

      service.send({type: TaskEvent.CONSULT_END, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);
    });

  });

  describe('CONFERENCING state CONSULT_END with terminated interaction', () => {
    it('transitions to WRAPPING_UP when CONSULT_END arrives with isTerminated in CONFERENCING', () => {
      const service = startMachine();
      const taskData = createTaskData({
        consultingAgentId: 'agent-1',
        interaction: {
          owner: 'agent-1',
          state: 'conference',
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({
        type: TaskEvent.CONSULT,
        destination: 'agent-42',
        destinationType: 'agent',
      });
      service.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      service.send({type: TaskEvent.CONFERENCE_START, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);

      const terminatedTaskData = createTaskData({
        consultingAgentId: 'agent-1',
        interaction: {
          isTerminated: true,
          owner: 'agent-1',
          state: 'conference',
        } as any,
      });
      service.send({type: TaskEvent.CONSULT_END, taskData: terminatedTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);
    });
  });

  describe('OFFERED state event handlers', () => {
    it('transitions to TERMINATED when customer disconnects before agent answers', () => {
      const service = startMachine();
      const taskData = createTaskData({isConsulted: false});

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.OFFERED);

      service.send({type: TaskEvent.CONTACT_ENDED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.TERMINATED);
    });

    it('transitions to TERMINATED when consulted agent does not answer', () => {
      const service = startMachine();
      const taskData = createTaskData({
        isConsulted: true,
        consultingAgentId: 'agent-1',
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.OFFERED);

      service.send({type: TaskEvent.CONSULT_FAILED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.TERMINATED);
    });
  });

  describe('OUTBOUND_FAILED handling', () => {
    it('transitions from IDLE to TERMINATED on OUTBOUND_FAILED (race condition)', () => {
      const service = startMachine();
      expect(service.getSnapshot().value).toBe(TaskState.IDLE);

      const taskData = createTaskData({
        interaction: {
          outboundType: 'OUTDIAL',
          isTerminated: true,
        } as any,
      });

      service.send({type: TaskEvent.OUTBOUND_FAILED, taskData, reason: 'CUSTOMER_BUSY'});
      expect(service.getSnapshot().value).toBe(TaskState.TERMINATED);
    });

    it('transitions from OFFERED to TERMINATED on OUTBOUND_FAILED without wrapup', () => {
      const service = startMachine();
      const offerTaskData = createTaskData({
        interaction: {
          outboundType: 'OUTDIAL',
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: offerTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.OFFERED);

      const failedTaskData = createTaskData({
        interaction: {
          outboundType: 'OUTDIAL',
          isTerminated: true,
        } as any,
      });
      service.send({type: TaskEvent.OUTBOUND_FAILED, taskData: failedTaskData, reason: 'CUSTOMER_BUSY'});
      expect(service.getSnapshot().value).toBe(TaskState.TERMINATED);
    });

    it('transitions from OFFERED to WRAPPING_UP on OUTBOUND_FAILED when wrapup is required', () => {
      const service = startMachine();
      const offerTaskData = createTaskData({
        interaction: {
          outboundType: 'OUTDIAL',
        } as any,
      });

      service.send({type: TaskEvent.TASK_INCOMING, taskData: offerTaskData});
      expect(service.getSnapshot().value).toBe(TaskState.OFFERED);

      const failedTaskData = createTaskData({
        agentId: 'agent-1',
        agentsPendingWrapUp: ['agent-1'],
        interaction: {
          outboundType: 'OUTDIAL',
          isTerminated: true,
        } as any,
      });
      service.send({type: TaskEvent.OUTBOUND_FAILED, taskData: failedTaskData, reason: 'CUSTOMER_BUSY'});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);
    });
  });
});
