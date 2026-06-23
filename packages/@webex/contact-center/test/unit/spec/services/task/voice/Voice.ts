import Voice from '../../../../../../src/services/task/voice/Voice';
import {
  TaskData,
  CONSULT_TRANSFER_DESTINATION_TYPE,
} from '../../../../../../src/services/task/types';
import {CC_EVENTS} from '../../../../../../src/services/config/types';
import {TaskEvent, TaskState} from '../../../../../../src/services/task/state-machine';
import {computeUIControls} from '../../../../../../src/services/task/state-machine/uiControlsComputer';
import * as Utils from '../../../../../../src/services/core/Utils';
import {createTaskData} from '../taskTestUtils';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({uploadLogs: jest.fn()}),
  },
}));

jest.mock('../../../../../../src/services/core/Utils', () => {
  const actual = jest.requireActual('../../../../../../src/services/core/Utils');
  return {
    __esModule: true,
    ...actual,
    // keep tests deterministic; avoid log upload side-effects on failures
    getErrorDetails: (err: any) => ({error: err}),
  };
});

const dummyContact = {
  hold: jest.fn().mockResolvedValue('held'),
  unHold: jest.fn().mockResolvedValue('resumed'),
  pauseRecording: jest.fn().mockResolvedValue('paused'),
  resumeRecording: jest.fn().mockResolvedValue('resumedRecording'),
  consult: jest.fn().mockResolvedValue('consulted'),
  consultConference: jest.fn().mockResolvedValue('conferenceStarted'),
  consultTransfer: jest.fn().mockResolvedValue('consultTransferred'),
} as any;

const createBaseData = (overrides: Partial<TaskData> = {}): TaskData =>
  createTaskData({
    interactionId: 'int1',
    mediaResourceId: 'media1',
    interaction: {
      ...(overrides.interaction || {}),
      media: {
        media1: {mediaResourceId: 'media1', isHold: false},
        ...(overrides.interaction as any)?.media,
      },
    },
    ...overrides,
  });

const primeConnectedState = (voice: Voice, taskData: TaskData) => {
  voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
  voice.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData});
};

const primeHeldState = (voice: Voice, taskData: TaskData) => {
  primeConnectedState(voice, taskData);
  voice.stateMachineService?.send({
    type: TaskEvent.HOLD_INITIATED,
    mediaResourceId: taskData.mediaResourceId,
  });
  voice.stateMachineService?.send({
    type: TaskEvent.HOLD_SUCCESS,
    mediaResourceId: taskData.mediaResourceId,
  });
};

describe('Voice Task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('emitTaskOutdialFailed', () => {
    it('emits the failure reason string instead of the Task object', () => {
      const taskData = createBaseData({
        interaction: {
          outboundType: 'OUTDIAL',
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {});
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.sendStateMachineEvent({
        type: TaskEvent.OUTBOUND_FAILED,
        taskData,
        reason: 'CUSTOMER_BUSY',
      });

      const outdialFailedCall = emitSpy.mock.calls.find(
        (call) => call[0] === 'task:outdialFailed'
      );
      expect(outdialFailedCall).toBeDefined();
      expect(outdialFailedCall![1]).toBe('CUSTOMER_BUSY');
    });
  });

  it('hides end and endConsult when disabled', () => {
    const voice = new Voice(dummyContact, createBaseData(), {
      isEndTaskEnabled: false,
      isEndConsultEnabled: false,
    });
    voice.updateTaskData(createBaseData());
    expect(voice.uiControls.main.end.isVisible).toBe(false);
    expect(voice.uiControls.main.endConsult.isVisible).toBe(false);
  });

  it('calls contact.hold when media is not held', async () => {
    const taskData = createBaseData() as any;
    const voice = new Voice(dummyContact, taskData, {});
    primeConnectedState(voice, taskData);
    await voice.holdResume();
    expect(dummyContact.hold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {mediaResourceId: 'media1'},
    });
  });

  it('calls contact.unHold when media is held', async () => {
    const heldData = createBaseData({
      interaction: {
        media: {media1: {mediaResourceId: 'media1', isHold: true}},
      } as any,
    }) as any;
    const voice = new Voice(dummyContact, heldData, {});
    primeHeldState(voice, heldData);
    await voice.holdResume();
    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {mediaResourceId: 'media1'},
    });
  });

  it('calls contact.unHold when state is held even if task data hold flag is stale', async () => {
    const taskData = createBaseData() as any;
    const voice = new Voice(dummyContact, taskData, {});
    primeHeldState(voice, taskData);
    voice.data.interaction.media.media1.isHold = false;

    await voice.holdResume();

    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {mediaResourceId: 'media1'},
    });
  });

  it('calls contact.unHold when state is conferencing and main media is held', async () => {
    const heldConferenceData = createBaseData({
      interaction: {
        state: 'conference',
        media: {media1: {mediaResourceId: 'media1', isHold: true}},
      } as any,
    }) as any;
    const voice = new Voice(dummyContact, heldConferenceData, {});
    primeConnectedState(voice, heldConferenceData);
    voice.stateMachineService?.send({type: TaskEvent.CONFERENCE_START, taskData: heldConferenceData});
    expect(voice.stateMachineService?.getSnapshot().value).toBe(TaskState.CONFERENCING);

    await voice.holdResume();

    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {mediaResourceId: 'media1'},
    });
  });

  it('uses the main media resource when stale consult media is left in task data', async () => {
    const heldData = createBaseData({
      mediaResourceId: 'main-media',
      interactionId: 'main-int',
      interaction: {
        mainInteractionId: 'main-int',
        media: {
          'main-int': {mediaResourceId: 'main-media', isHold: true},
          'consult-media': {mediaResourceId: 'consult-media', isHold: false, mType: 'consult'},
        },
      } as any,
    }) as any;
    const voice = new Voice(dummyContact, heldData, {});
    primeHeldState(voice, heldData);
    voice.data.mediaResourceId = 'consult-media';

    await voice.holdResume();

    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'main-int',
      data: {mediaResourceId: 'main-media'},
    });
    expect(dummyContact.hold).not.toHaveBeenCalled();
  });

  it('pauseRecording() calls contact.pauseRecording', async () => {
    const taskData = createBaseData();
    const voice = new Voice(dummyContact, taskData, {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
    primeConnectedState(voice, taskData);
    const res = await voice.pauseRecording();
    expect(dummyContact.pauseRecording).toHaveBeenCalledWith({interactionId: 'int1'});
  });

  it('resumeRecording() with no payload defaults to autoResumed false', async () => {
    const taskData = createBaseData();
    const voice = new Voice(dummyContact, taskData, {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
    primeConnectedState(voice, taskData);
    voice.stateMachineService?.send({type: TaskEvent.PAUSE_RECORDING});
    const res = await voice.resumeRecording();
    expect(dummyContact.resumeRecording).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {autoResumed: false},
    });
  });

  it('consult() calls contact.consult with payload', async () => {
    const taskData = createBaseData();
    const voice = new Voice(dummyContact, taskData, {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
    primeConnectedState(voice, taskData);
    const payload = {destination: 'agent1', destinationType: 'agent'} as any;
    const res = await voice.consult(payload);
    expect(dummyContact.consult).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: payload,
    });
  });

  describe('transfer()', () => {
    it('calls contact.consultTransfer for consult transfer to agent', async () => {
      const consultTransferMock = jest.fn().mockResolvedValue('consultedA');
      const dataWithState = createBaseData({
        interaction: {state: 'consulting'} as any,
      });
      const voice = new Voice(
        {...dummyContact, consultTransfer: consultTransferMock},
        dataWithState as any,
        {isEndTaskEnabled: true, isEndConsultEnabled: true}
      );

      const result = await voice.transfer({
        to: 'destB',
        destinationType: 'agent',
      });

      expect(consultTransferMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {to: 'destB', destinationType: 'agent'},
      });
    });

    it('throws if consult transfer to QUEUE but no destAgentId set', async () => {
      const dataWithState = createBaseData({
        destAgentId: undefined,
        interaction: {state: 'consulting'} as any,
      });
      const voice = new Voice(dummyContact, dataWithState as any, {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      });

      await expect(
        voice.transfer({
          to: 'queue1',
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
        })
      ).rejects.toThrow('No agent has accepted this queue consult yet');
    });

    it('uses data.destAgentId for queue consult transfer', async () => {
      const consultTransferMock = jest.fn().mockResolvedValue('consultedQ');
      const dataWithDest = createBaseData({
        destAgentId: 'agentD',
        interaction: {state: 'consulting'} as any,
      });
      const voice = new Voice(
        {...dummyContact, consultTransfer: consultTransferMock},
        dataWithDest as any,
        {isEndTaskEnabled: true, isEndConsultEnabled: true}
      );

      const result = await voice.transfer({
        to: 'queueX',
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
      });

      expect(consultTransferMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {
          to: 'agentD',
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        },
      });
    });

    it('uses preserved consult destination from task data for queue consult transfer', async () => {
      const consultTransferMock = jest.fn().mockResolvedValue('consultedQ');
      const dataWithState = createBaseData({
        destAgentId: undefined,
        destinationType: undefined,
        interaction: {state: 'consulting'} as any,
      });
      const voice = new Voice(
        {...dummyContact, consultTransfer: consultTransferMock},
        dataWithState as any,
        {isEndTaskEnabled: true, isEndConsultEnabled: true}
      );

      primeConnectedState(voice, dataWithState);
      voice.updateTaskData(
        createBaseData({
          destAgentId: 'agent-preserved',
          interaction: {state: 'consulting'} as any,
        }) as any
      );

      await voice.transfer({
        to: 'queueX',
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
      });

      expect(consultTransferMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {
          to: 'agent-preserved',
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        },
      });
    });
  });

  describe('endConsult()', () => {
    it('calls contact.consultEnd with correct payload', async () => {
      const consultEndMock = jest.fn().mockResolvedValue('endedC');
      const voice = new Voice({...dummyContact, consultEnd: consultEndMock}, createBaseData(), {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      });
      const payload = {isConsult: true, queueId: 'q1', taskId: 't1'};
      const result = await voice.endConsult(payload);

      expect(consultEndMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: payload,
      });
      expect(result).toBe('endedC');
    });

    it('uses mainInteractionId when present for consultEnd request', async () => {
      const consultEndMock = jest.fn().mockResolvedValue('endedC');
      const taskData = createBaseData({
        interactionId: 'child-int',
        interaction: {
          mainInteractionId: 'main-int',
        } as any,
      });
      const voice = new Voice({...dummyContact, consultEnd: consultEndMock}, taskData, {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      });

      await voice.endConsult({isConsult: true} as any);

      expect(consultEndMock).toHaveBeenCalledWith({
        interactionId: 'main-int',
        data: {isConsult: true},
      });
    });
  });

  describe('UI controls for AGENT_CONTACT_ASSIGNED', () => {
    it('shows main controls and hides accept/decline on AGENT_CONTACT_ASSIGNED', () => {
      const data: any = {...createBaseData(), type: CC_EVENTS.AGENT_CONTACT_ASSIGNED};
      const voice = new Voice(dummyContact, data, {
        isEndTaskEnabled: true,
        isEndConsultEnabled: false,
      });

      voice.updateTaskData(data);
      primeConnectedState(voice, data);

      expect(voice.uiControls.main.accept.isVisible).toBe(false);
      expect(voice.uiControls.main.decline.isVisible).toBe(false);
      expect(voice.uiControls.main.hold.isVisible).toBe(true);
      expect(voice.uiControls.main.transfer.isVisible).toBe(true);
      expect(voice.uiControls.main.consult.isVisible).toBe(true);
      expect(voice.uiControls.main.recording.isVisible).toBe(true);
      expect(voice.uiControls.main.end.isVisible).toBe(true);
      expect(voice.uiControls.main.endConsult.isVisible).toBe(false);
    });
  });

  describe('state machine derived controls', () => {
    it('keeps uiControls in sync with state machine context', () => {
      const taskData = createBaseData();
      const voice = new Voice(dummyContact, taskData, {});
      const initialSnapshot = voice.stateMachineService?.getSnapshot();
      const initialExpected = computeUIControls(
        initialSnapshot?.value as TaskState,
        initialSnapshot?.context as any,
        voice.data
      );
      expect(voice.uiControls).toEqual(initialExpected);

      voice.updateTaskData(taskData);
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      voice.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData});

      const snapshot = voice.stateMachineService?.getSnapshot();
      const expected = computeUIControls(
        snapshot?.value as TaskState,
        snapshot?.context as any,
        voice.data
      );
      expect(voice.uiControls).toEqual(expected);
    });
  });

  describe('recording operations', () => {
    const buildRecordingData = (recordingOverrides: Record<string, any>) =>
      createBaseData({
        interaction: {
          callProcessingDetails: recordingOverrides,
        } as any,
      });

    it('throws when pauseRecording is invoked without active recording', async () => {
      const voice = new Voice(dummyContact, createBaseData(), {});
      await expect(voice.pauseRecording()).rejects.toThrow(
        'Recording is not active or already paused'
      );
      expect(dummyContact.pauseRecording).not.toHaveBeenCalled();
    });

    it('pauses recording when state machine context indicates active recording', async () => {
      const taskData = buildRecordingData({recordInProgress: true});
      const voice = new Voice(dummyContact, taskData, {});
      primeConnectedState(voice, taskData);

      await voice.pauseRecording();
      expect(dummyContact.pauseRecording).toHaveBeenCalledWith({interactionId: 'int1'});
    });

    it('throws if resumeRecording is invoked while recording is not paused', async () => {
      const taskData = buildRecordingData({recordInProgress: true});
      const voice = new Voice(dummyContact, taskData, {});
      primeConnectedState(voice, taskData);

      await expect(voice.resumeRecording()).rejects.toThrow('Recording is not paused');
      expect(dummyContact.resumeRecording).not.toHaveBeenCalled();
    });

    it('resumes recording when context shows paused recording', async () => {
      const taskData = buildRecordingData({recordInProgress: true});
      const voice = new Voice(dummyContact, taskData, {});
      primeConnectedState(voice, taskData);
      voice.stateMachineService?.send({type: TaskEvent.PAUSE_RECORDING});

      await voice.resumeRecording();
      expect(dummyContact.resumeRecording).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {autoResumed: false},
      });
    });
  });

  describe('switchCall()', () => {
    const buildConsultingTaskData = () =>
      createBaseData({
        agentId: 'agent1',
        consultMediaResourceId: 'consultMedia1',
        interaction: {
          media: {
            media1: {
              mediaResourceId: 'media1',
              isHold: true,
              mType: 'mainCall',
              participants: ['agent1', 'customer1'],
            },
            consultMedia1: {
              mediaResourceId: 'consultMedia1',
              isHold: false,
              mType: 'consult',
              participants: ['agent1', 'agent2'],
            },
          },
          participants: {
            agent1: {id: 'agent1', pType: 'Agent', type: 'Agent', hasLeft: false},
            agent2: {id: 'agent2', pType: 'Agent', type: 'Agent', hasLeft: false},
            customer1: {id: 'customer1', pType: 'Customer', type: 'Customer', hasLeft: false},
          },
        } as any,
      });

    const primeConsultingState = (voice: Voice, taskData: TaskData) => {
      primeConnectedState(voice, taskData);
      voice.stateMachineService?.send({
        type: TaskEvent.CONSULT,
        destination: 'agent2',
        destinationType: 'agent' as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
    };

    it('switches from consult leg to main leg by unholding main media', async () => {
      const taskData = buildConsultingTaskData();
      const voice = new Voice(dummyContact, taskData, {});
      primeConsultingState(voice, taskData);

      await voice.switchCall();

      expect(dummyContact.unHold).toHaveBeenCalledTimes(1);
      expect(dummyContact.unHold).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {mediaResourceId: 'media1'},
      });
      expect(dummyContact.hold).not.toHaveBeenCalled();
    });

    it('switches from main leg to consult leg by holding main media', async () => {
      const taskData = buildConsultingTaskData();
      taskData.interaction.media.media1.isHold = false;
      taskData.interaction.media.consultMedia1.isHold = true;
      const voice = new Voice(dummyContact, taskData, {});
      primeConsultingState(voice, taskData);
      voice.stateMachineService?.send({type: TaskEvent.SWITCH_TO_MAIN_CALL});

      await voice.switchCall();

      expect(dummyContact.hold).toHaveBeenCalledTimes(1);
      expect(dummyContact.hold).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {mediaResourceId: 'media1'},
      });
      expect(dummyContact.unHold).not.toHaveBeenCalled();
    });
  });

  describe('consultConference()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uses cached consult destination when task data destination is cleared', async () => {
      const taskData = createBaseData({
        agentId: 'agent1',
        destAgentId: undefined,
        destinationType: undefined,
        interaction: {
          media: {
            media1: {mediaResourceId: 'media1', isHold: true},
          },
          participants: {
            agent1: {id: 'agent1', pType: 'Agent', type: 'Agent', hasLeft: false},
          },
        } as any,
      });

      const voice = new Voice(dummyContact, taskData, {});
      primeConnectedState(voice, taskData);
      voice.stateMachineService?.send({
        type: TaskEvent.CONSULT,
        destination: 'agent2',
        destAgentId: 'agent2',
        destinationType: 'agent' as any,
      });
      voice.updateTaskData(
        createBaseData({
          agentId: 'agent1',
          destAgentId: undefined,
          destinationType: undefined,
          interaction: {state: 'consulting'} as any,
        }) as any
      );

      await voice.consultConference();

      expect(dummyContact.consultConference).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: expect.objectContaining({
          to: 'agent2',
          destinationType: 'agent',
        }),
      });
    });

    it('falls back to derived destination when context and task destination are unavailable', async () => {
      jest.spyOn(Utils, 'calculateDestAgentId').mockReturnValueOnce('derivedAgent');
      jest.spyOn(Utils, 'calculateDestType').mockReturnValueOnce('agent');

      const taskData = createBaseData({
        agentId: 'agent1',
        destAgentId: undefined,
        destinationType: undefined,
        interaction: {
          media: {
            media1: {mediaResourceId: 'media1', isHold: true},
          },
          participants: {
            agent1: {id: 'agent1', pType: 'Agent', type: 'Agent', hasLeft: false},
          },
        } as any,
      });

      const voice = new Voice(dummyContact, taskData, {});
      primeConnectedState(voice, taskData);
      voice.stateMachineService?.send({
        type: TaskEvent.CONSULT,
        destination: '',
        destAgentId: undefined,
        destinationType: 'agent' as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.CONSULT_SUCCESS, taskData});

      await voice.consultConference();

      expect(dummyContact.consultConference).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: expect.objectContaining({
          to: 'derivedAgent',
        }),
      });
    });
  });
});
