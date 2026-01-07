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

      service.send({type: TaskEvent.OFFER, taskData});

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

      service.send({type: TaskEvent.OFFER, taskData: initialTaskData});
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

      service.send({type: TaskEvent.OFFER, taskData: initialTaskData});
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

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ACCEPT});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);

      service.send({type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HOLD_INITIATING);

      service.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      service.send({type: TaskEvent.UNHOLD, mediaResourceId: taskData.mediaResourceId});
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

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);

      service.send({type: TaskEvent.PAUSE_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(false);

      service.send({type: TaskEvent.RESUME_RECORDING});
      expect(service.getSnapshot().context.recordingInProgress).toBe(true);
    });
  });

  describe('wrap-up and completion flow', () => {
    it('moves from CONNECTED -> WRAPPING_UP -> COMPLETED on END/WRAPUP', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONNECTED);

      service.send({type: TaskEvent.END});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);

      service.send({type: TaskEvent.WRAPUP});
      expect(service.getSnapshot().value).toBe(TaskState.COMPLETED);
    });

    it('handles CONTACT_ENDED by entering wrapping up before completion', () => {
      const service = startMachine();
      // Primary agent (isConsulted: false) should go to WRAPPING_UP
      const taskData = createTaskData({isConsulted: false} as any);

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});

      // CONTACT_ENDED event must include taskData for shouldWrapUpForThisAgent check
      service.send({type: TaskEvent.CONTACT_ENDED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.WRAPPING_UP);

      service.send({type: TaskEvent.AUTO_WRAPUP});
      expect(service.getSnapshot().value).toBe(TaskState.COMPLETED);
    });
  });

  describe('consult and conference flows', () => {
    it('tracks consult destination, agent join, and clears on consult end', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.OFFER, taskData});
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
      const taskData = createTaskData();

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ASSIGN, taskData});
      service.send({type: TaskEvent.CONSULT_CREATED, taskData});
      expect(service.getSnapshot().value).toBe(TaskState.CONSULTING);

      service.send({type: TaskEvent.MERGE_TO_CONFERENCE});
      expect(service.getSnapshot().value).toBe(TaskState.CONF_INITIATING);

      service.send({type: TaskEvent.CONFERENCE_START});
      expect(service.getSnapshot().value).toBe(TaskState.CONFERENCING);
    });

    it('returns to CONNECTED when CTQ cancel arrives before queue connects', () => {
      const service = startMachine();
      const taskData = createTaskData();

      service.send({type: TaskEvent.OFFER, taskData});
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

      service.send({type: TaskEvent.OFFER, taskData});
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

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ACCEPT});
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

      service.send({type: TaskEvent.OFFER, taskData});
      service.send({type: TaskEvent.ACCEPT});
      service.send({type: TaskEvent.HOLD, mediaResourceId: taskData.mediaResourceId});
      service.send({type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);

      service.send({type: TaskEvent.UNHOLD, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.RESUME_INITIATING);

      service.send({type: TaskEvent.UNHOLD_FAILED, mediaResourceId: taskData.mediaResourceId});
      expect(service.getSnapshot().value).toBe(TaskState.HELD);
    });
  });
});
