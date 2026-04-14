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
});
