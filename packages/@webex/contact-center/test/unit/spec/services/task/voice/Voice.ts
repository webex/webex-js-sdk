import Voice from '../../../../../../src/services/task/voice/Voice';
import RtdRequestResolver from '../../../../../../src/services/core/RtdRequestResolver';
import LoggerProxy from '../../../../../../src/logger-proxy';
import {
  TaskData,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  DESTINATION_TYPE,
  TASK_EVENTS,
} from '../../../../../../src/services/task/types';
import {CC_EVENTS} from '../../../../../../src/services/config/types';
import {TaskEvent, TaskState} from '../../../../../../src/services/task/state-machine';
import {computeUIControls} from '../../../../../../src/services/task/state-machine/uiControlsComputer';
import * as Utils from '../../../../../../src/services/core/Utils';
import {createTaskData} from '../taskTestUtils';
import {AIAssistantEventName} from '../../../../../../src/types';
import {AI_SUMMARY_ERROR_CODES} from '../../../../../../src/constants';
import {AI_SUMMARY_REQUEST_CANCELLED} from '../../../../../../src/services/task/constants';
import {createAISummaryError, flushMicrotasks} from '../../../../fixtures/aiSummaryTestUtils';
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';

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
  dropConferenceParticipant: jest.fn().mockResolvedValue({
    type: 'RoutingMessage',
    trackingId: 'drop-tracking-id',
    data: {},
  }),
  consultTransfer: jest.fn().mockResolvedValue('consultTransferred'),
  cancelTask: jest.fn().mockResolvedValue(undefined),
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

      const outdialFailedCall = emitSpy.mock.calls.find((call) => call[0] === 'task:outdialFailed');
      expect(outdialFailedCall).toBeDefined();
      expect(outdialFailedCall![1]).toBe('CUSTOMER_BUSY');
    });

    it('does not emit task:outdialFailed when suppressOutdialFailedPopup is set', () => {
      const taskData = createBaseData({
        interaction: {
          outboundType: 'OUTDIAL',
        } as any,
        suppressOutdialFailedPopup: true,
      });
      const voice = new Voice(dummyContact, taskData, {});
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.sendStateMachineEvent({
        type: TaskEvent.OUTBOUND_FAILED,
        taskData,
        reason: 'AGENT_ENDS',
      });

      const outdialFailedCall = emitSpy.mock.calls.find((call) => call[0] === 'task:outdialFailed');
      expect(outdialFailedCall).toBeUndefined();
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

  it('calls contact.unHold when state is connected and main media is held', async () => {
    const heldConnectedData = createBaseData({
      interaction: {
        media: {media1: {mediaResourceId: 'media1', isHold: true}},
      } as any,
    }) as any;
    const voice = new Voice(dummyContact, heldConnectedData, {});
    primeConnectedState(voice, heldConnectedData);

    await voice.holdResume();

    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: {mediaResourceId: 'media1'},
    });
    expect(dummyContact.hold).not.toHaveBeenCalled();
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
    voice.stateMachineService?.send({
      type: TaskEvent.CONFERENCE_START,
      taskData: heldConferenceData,
    });
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

  describe('AI summary noninterference for call controls', () => {
    const summaryAgentId = 'summary-agent-1';
    const wrapupPayload = {wrapUpReason: 'Customer resolved', auxCodeId: 'wrapup-code-1'} as const;
    const consultPayload = {
      to: 'consult-agent-1',
      destinationType: DESTINATION_TYPE.AGENT,
      holdParticipants: true,
    } as const;
    const transferPayload = {
      to: 'transfer-agent-1',
      destinationType: DESTINATION_TYPE.AGENT,
    } as const;
    const callControlMethods = [
      'wrapup',
      'consult',
      'blindTransfer',
      'vteamTransfer',
      'consultTransfer',
    ] as const;
    type CallControlMethod = (typeof callControlMethods)[number];
    type CallControlCase = {
      label: string;
      createOperationResult: () => unknown;
      expectedContactCalls: Record<CallControlMethod, unknown[][]>;
      prime: (voice: Voice, taskData: TaskData) => void;
      invoke: (voice: Voice) => Promise<unknown>;
      requestSummary: (voice: Voice) => Promise<unknown>;
      summaryEventName: AIAssistantEventName;
    };

    const createContactMock = (operationResult: any) =>
      ({
        hold: jest.fn().mockResolvedValue('held'),
        unHold: jest.fn().mockResolvedValue('resumed'),
        pauseRecording: jest.fn().mockResolvedValue('paused'),
        resumeRecording: jest.fn().mockResolvedValue('resumedRecording'),
        wrapup: jest.fn().mockResolvedValue(operationResult),
        consult: jest.fn().mockResolvedValue(operationResult),
        blindTransfer: jest.fn().mockResolvedValue(operationResult),
        vteamTransfer: jest.fn().mockResolvedValue(operationResult),
        consultTransfer: jest.fn().mockResolvedValue(operationResult),
      } as any);

    const createSummaryAdapter = () => ({
      sendSummaryGetEvent: jest.fn().mockResolvedValue(undefined),
      sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
    });

    const configureAISummary = (
      voice: Voice,
      adapter = createSummaryAdapter(),
      coordinator = new RtdRequestResolver(),
      getFeatureEnablement = () => ({
        interactionId: 'int1',
        postCallEnabled: true,
        midCallEnabled: true,
      })
    ) => {
      voice.configureAISummary(
        adapter as any,
        coordinator as any,
        jest.fn(() => ({
          wrapUpSummariesEnabled: true,
          consultTransferSummariesEnabled: true,
        })),
        getFeatureEnablement
      );

      return {adapter, coordinator};
    };

    const normalizeEmitCalls = (emitSpy: jest.SpyInstance, voice: Voice) =>
      emitSpy.mock.calls.map(([eventName, ...args]) => [
        eventName,
        ...args.map((arg) => (arg === voice ? 'VOICE_SELF' : arg)),
      ]);

    const getContactCalls = (contact: any) =>
      callControlMethods.reduce((calls, method) => {
        calls[method] = contact[method].mock.calls;

        return calls;
      }, {} as Record<CallControlMethod, unknown[][]>);

    const createVoiceHarness = (testCase: CallControlCase) => {
      const taskData = createBaseData();
      const operationResult = testCase.createOperationResult();
      const contact = createContactMock(operationResult);
      const voice = new Voice(
        contact,
        taskData,
        {isEndTaskEnabled: true, isEndConsultEnabled: true},
        undefined,
        summaryAgentId
      );

      testCase.prime(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      return {contact, emitSpy, operationResult, taskData, voice};
    };

    const captureCallControlOutcome = (
      harness: ReturnType<typeof createVoiceHarness>,
      result: unknown
    ) => {
      const snapshot = harness.voice.stateMachineService?.getSnapshot();

      return {
        contactCalls: getContactCalls(harness.contact),
        emitCalls: normalizeEmitCalls(harness.emitSpy, harness.voice),
        result,
        state: snapshot?.value,
        context: snapshot?.context,
        uiControls: harness.voice.uiControls,
      };
    };

    const runCallControl = async (testCase: CallControlCase) => {
      const harness = createVoiceHarness(testCase);
      const result = await testCase.invoke(harness.voice);

      expect(result).toBe(harness.operationResult);

      return captureCallControlOutcome(harness, result);
    };

    const callControlCases: CallControlCase[] = [
      {
        label: 'wrapup',
        createOperationResult: () => ({
          trackingId: 'wrapup-tracking-1',
          data: {wrappedUp: true},
        }),
        expectedContactCalls: {
          wrapup: [[{interactionId: 'int1', data: wrapupPayload}]],
          consult: [],
          blindTransfer: [],
          vteamTransfer: [],
          consultTransfer: [],
        },
        prime: primeConnectedState,
        invoke: (voice: Voice) => voice.wrapup({...wrapupPayload}),
        requestSummary: (voice: Voice) => voice.requestPostCallSummary(),
        summaryEventName: AIAssistantEventName.GET_POST_CALL_SUMMARY,
      },
      {
        label: 'consult',
        createOperationResult: () => ({
          trackingId: 'consult-tracking-1',
          data: createBaseData({
            destinationType: DESTINATION_TYPE.AGENT,
            destAgentId: 'consult-agent-1',
            interaction: {state: 'consulting'} as any,
          }),
        }),
        expectedContactCalls: {
          wrapup: [],
          consult: [[{interactionId: 'int1', data: consultPayload}]],
          blindTransfer: [],
          vteamTransfer: [],
          consultTransfer: [],
        },
        prime: primeConnectedState,
        invoke: (voice: Voice) => voice.consult({...consultPayload}),
        requestSummary: (voice: Voice) => voice.requestMidCallSummary('CONSULT'),
        summaryEventName: AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY,
      },
      {
        label: 'transfer',
        createOperationResult: () => ({
          trackingId: 'transfer-tracking-1',
          data: {transferred: true},
        }),
        expectedContactCalls: {
          wrapup: [],
          consult: [],
          blindTransfer: [[{interactionId: 'int1', data: transferPayload}]],
          vteamTransfer: [],
          consultTransfer: [],
        },
        prime: primeConnectedState,
        invoke: (voice: Voice) => voice.transfer({...transferPayload}),
        requestSummary: (voice: Voice) => voice.requestMidCallSummary('TRANSFER'),
        summaryEventName: AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY,
      },
    ];

    const expectSummaryGetRequest = (
      adapter: ReturnType<typeof createSummaryAdapter>,
      summaryEventName: AIAssistantEventName
    ) => {
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
        summaryAgentId,
        'int1',
        'int1',
        summaryEventName
      );
    };

    const expectCancelledSummary = async (summaryRequest: Promise<unknown>) => {
      await expect(summaryRequest).rejects.toMatchObject({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      });
    };

    const summaryActivityCases = [
      {
        label: 'while the matching AI summary request is pending',
        prepare: async (harness: VoiceHarnessWithCase) => {
          const {adapter, coordinator} = configureAISummary(harness.voice);
          const summaryRequest = harness.testCase.requestSummary(harness.voice);
          const summaryObserver = jest.fn();

          summaryRequest.then(summaryObserver, summaryObserver);
          await flushMicrotasks();

          expectSummaryGetRequest(adapter, harness.testCase.summaryEventName);
          expect(summaryObserver).not.toHaveBeenCalled();

          return async () => {
            expect(summaryObserver).not.toHaveBeenCalled();
            coordinator.clear('int1', 'int1');
            await expectCancelledSummary(summaryRequest);
          };
        },
      },
      {
        label: 'after coordinator owner cancellation',
        prepare: async (harness: VoiceHarnessWithCase) => {
          const {adapter, coordinator} = configureAISummary(harness.voice);
          const summaryRequest = harness.testCase.requestSummary(harness.voice);

          await flushMicrotasks();
          expectSummaryGetRequest(adapter, harness.testCase.summaryEventName);

          coordinator.clear('int1', 'int1');
          await expectCancelledSummary(summaryRequest);

          return async () => undefined;
        },
      },
      {
        label: 'after adapter rejection',
        prepare: async (harness: VoiceHarnessWithCase) => {
          const adapter = createSummaryAdapter();
          const adapterError = createAISummaryError(
            AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
          );

          adapter.sendSummaryGetEvent.mockRejectedValueOnce(adapterError);
          configureAISummary(harness.voice, adapter);

          await expect(harness.testCase.requestSummary(harness.voice)).rejects.toBe(adapterError);
          expectSummaryGetRequest(adapter, harness.testCase.summaryEventName);

          return async () => undefined;
        },
      },
    ];

    type VoiceHarnessWithCase = ReturnType<typeof createVoiceHarness> & {
      testCase: CallControlCase;
    };

    const createVoiceHarnessWithCase = (testCase: CallControlCase): VoiceHarnessWithCase => ({
      ...createVoiceHarness(testCase),
      testCase,
    });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    describe.each(summaryActivityCases)('$label', (summaryActivity) => {
      it.each(callControlCases)(
        '$label preserves contact arguments, resolved value, and task events',
        async (testCase) => {
          const baseline = await runCallControl(testCase);
          const harness = createVoiceHarnessWithCase(testCase);
          const finalizeSummaryActivity = await summaryActivity.prepare(harness);

          try {
            const result = await testCase.invoke(harness.voice);
            const observed = captureCallControlOutcome(harness, result);

            expect(result).toBe(harness.operationResult);
            expect(observed.contactCalls).toEqual(testCase.expectedContactCalls);
            expect(observed).toEqual(baseline);
          } finally {
            await finalizeSummaryActivity();
          }
        }
      );
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

  describe('dropConferenceParticipant()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      ['missing payload', undefined],
      ['missing participantId', {}],
      ['non-string participantId', {participantId: 42}],
      ['blank participantId', {participantId: '   '}],
    ])('rejects %s before registering a request', async (_label, payload) => {
      const taskData = createBaseData();
      const voice = new Voice(dummyContact, taskData, {});
      const timeEventSpy = jest.spyOn(MetricsManager.getInstance(), 'timeEvent');

      await expect(voice.dropConferenceParticipant(payload as any)).rejects.toThrow(
        'participantId must be a non-empty string'
      );

      expect(dummyContact.dropConferenceParticipant).not.toHaveBeenCalled();
      expect(timeEventSpy).not.toHaveBeenCalled();
    });

    it('uses the latest main interaction ID and records PII-safe success telemetry', async () => {
      const participantId = '+1/participant-secret';
      const taskData = createBaseData({
        interaction: {mainInteractionId: 'main-interaction-id'} as any,
      });
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'current-agent-id');
      const metricsManager = MetricsManager.getInstance();
      const timeEventSpy = jest.spyOn(metricsManager, 'timeEvent').mockImplementation();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent').mockImplementation();
      const infoSpy = jest.spyOn(LoggerProxy, 'info').mockImplementation();
      const logSpy = jest.spyOn(LoggerProxy, 'log').mockImplementation();

      await voice.dropConferenceParticipant({participantId});

      expect(dummyContact.dropConferenceParticipant).toHaveBeenCalledWith({
        interactionId: 'main-interaction-id',
        participantId,
      });
      expect(timeEventSpy).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
      ]);
      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_SUCCESS,
        expect.objectContaining({
          taskId: 'int1',
          requestInteractionId: 'main-interaction-id',
          agentId: 'current-agent-id',
        }),
        ['operational', 'behavioral', 'business']
      );

      const telemetryAndLogs = JSON.stringify([
        timeEventSpy.mock.calls,
        trackEventSpy.mock.calls,
        infoSpy.mock.calls,
        logSpy.mock.calls,
      ]);
      expect(telemetryAndLogs).not.toContain(participantId);
    });

    it('records PII-safe failure telemetry and rethrows the AQM error', async () => {
      const participantId = '+1/failure-secret';
      const failure = {
        details: {
          type: 'ParticipantDropConferenceFailed',
          trackingId: 'failure-tracking-id',
          data: {reason: participantId},
        },
      };
      dummyContact.dropConferenceParticipant.mockRejectedValueOnce(failure);
      const taskData = createBaseData({
        interaction: {mainInteractionId: 'main-interaction-id'} as any,
      });
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'current-agent-id');
      const metricsManager = MetricsManager.getInstance();
      jest.spyOn(metricsManager, 'timeEvent').mockImplementation();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent').mockImplementation();
      const errorSpy = jest.spyOn(LoggerProxy, 'error').mockImplementation();

      await expect(voice.dropConferenceParticipant({participantId})).rejects.toBe(failure);

      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
        expect.objectContaining({
          taskId: 'int1',
          requestInteractionId: 'main-interaction-id',
          agentId: 'current-agent-id',
        }),
        ['operational', 'behavioral', 'business']
      );
      expect(errorSpy).toHaveBeenCalledWith('Failed to drop conference participant', {
        module: 'cc',
        method: 'dropConferenceParticipant',
        trackingId: 'failure-tracking-id',
        interactionId: 'main-interaction-id',
      });
      expect(JSON.stringify([trackEventSpy.mock.calls, errorSpy.mock.calls])).not.toContain(
        participantId
      );
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['string', 'primitive failure'],
      ['number', 503],
    ])('records failure telemetry and preserves a %s rejection', async (_label, failure) => {
      dummyContact.dropConferenceParticipant.mockRejectedValueOnce(failure);
      const voice = new Voice(dummyContact, createBaseData(), {}, undefined, 'current-agent-id');
      const metricsManager = MetricsManager.getInstance();
      const failureFieldsSpy = jest.spyOn(
        MetricsManager,
        'getCommonTrackingFieldForAQMResponseFailed'
      );
      jest.spyOn(metricsManager, 'timeEvent').mockImplementation();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent').mockImplementation();
      const errorSpy = jest.spyOn(LoggerProxy, 'error').mockImplementation();

      await expect(voice.dropConferenceParticipant({participantId: 'participant-id'})).rejects.toBe(
        failure
      );

      expect(failureFieldsSpy).toHaveBeenCalledWith({});
      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
        expect.objectContaining({
          taskId: 'int1',
          requestInteractionId: 'int1',
          agentId: 'current-agent-id',
        }),
        ['operational', 'behavioral', 'business']
      );
      expect(errorSpy).toHaveBeenCalledWith('Failed to drop conference participant', {
        module: 'cc',
        method: 'dropConferenceParticipant',
        trackingId: undefined,
        interactionId: 'int1',
      });
    });
  });

  describe('setEnableWxBetterTogether', () => {
    it('updates runtime flag, uiControlConfig, and emits ui control updates', () => {
      const voice = new Voice(dummyContact, createBaseData(), {enableWxBetterTogether: true});
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.setEnableWxBetterTogether(false);

      expect(voice['enableWxBetterTogether']).toBe(false);
      expect(voice['uiControlConfig'].enableWxBetterTogether).toBe(false);
      expect(emitSpy).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_UI_CONTROLS_UPDATED,
        expect.any(Object)
      );
    });
  });

  describe('applyWxAppMuteStateFromSync', () => {
    const wxAppParticipant = {
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    };

    const makeWxAppTaskData = () =>
      createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });

    it('emits TASK_WXAPP_MUTE_STATE_UPDATED when callId matches via endsWith', () => {
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.applyWxAppMuteStateFromSync('prefix:call-id-1', true);

      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {
        muted: true,
      });
    });

    it('no-ops when callId does not match active call', () => {
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.applyWxAppMuteStateFromSync('other-call-id', true);

      expect(emitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED,
        expect.anything()
      );
    });

    it('no-ops when enableWxBetterTogether is false', () => {
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: false});
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.applyWxAppMuteStateFromSync('prefix:call-id-1', true);

      expect(emitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED,
        expect.anything()
      );
    });

    it('no-ops when muted state is unchanged', () => {
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.applyWxAppMuteStateFromSync('prefix:call-id-1', true);
      emitSpy.mockClear();

      voice.applyWxAppMuteStateFromSync('prefix:call-id-1', true);

      expect(emitSpy).not.toHaveBeenCalledWith(
        TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED,
        expect.anything()
      );
    });
  });

  describe('syncWxAppMuteFromCallDetails', () => {
    const wxAppParticipant = {
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    };

    const makeWxAppTaskData = () =>
      createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });

    it('seeds mute state from telephony GET call details on engaged wxApp call', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {
        muted: true,
      });
      expect(voice.getWxAppMuted()).toBe(true);
    });

    it('returns resolved mute state from syncWxAppMuteFromCallDetails', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      const result = await voice.syncWxAppMuteFromCallDetails();

      expect(result).toBe(true);
      expect(voice.getWxAppMuted()).toBe(true);
    });

    it('seeds mute via participant deviceCallId when state machine is still IDLE', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      const emitSpy = jest.spyOn(voice, 'emit');

      const result = await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
      expect(result).toBe(true);
      expect(voice.getWxAppMuted()).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {
        muted: true,
      });
    });

    it('no-ops when enableWxBetterTogether is false', async () => {
      const mockSvc = {getCallDetails: jest.fn()};
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: false,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).not.toHaveBeenCalled();
    });

    it('syncs mute state after task assignment once CONNECTED (onTaskAssigned)', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });

      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      expect(voice.getWxAppMuted()).toBe(false);
      voice.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData});

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
      expect(voice.getWxAppMuted()).toBe(true);
    });

    it('seeds mute on ASSIGN when wxApp offer was accepted on another session', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });

      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      expect(voice['uiControlConfig']?.wxAppAnswerPending).toBeFalsy();
      voice.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData});

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
    });

    it('syncs mute state after task hydrate (onTaskHydrated)', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);
      const emitSpy = jest.spyOn(voice, 'emit');

      voice.onTaskHydrated();
      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
      expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, {
        muted: true,
      });
    });

    it('preserves wxAppAnswerPending on hydrate while OFFERED and answer is pending', async () => {
      const mockSvc = {
        answerCall: jest.fn().mockResolvedValue(undefined),
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.accept();
      expect(voice.uiControlConfig.wxAppAnswerPending).toBe(true);

      voice.onTaskHydrated();

      expect(voice.uiControlConfig.wxAppAnswerPending).toBe(true);
    });

    it('clears wxAppAnswerPending on hydrate when task is no longer OFFERED', async () => {
      const mockSvc = {
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      voice.uiControlConfig = {...voice.uiControlConfig, wxAppAnswerPending: true};
      primeConnectedState(voice, taskData);

      voice.onTaskHydrated();

      expect(voice.uiControlConfig.wxAppAnswerPending).toBe(false);
    });

    it('coalesces parallel syncWxAppMuteFromCallDetails into one getCallDetails', async () => {
      let resolveGetCallDetails: (value: {muted: boolean}) => void;
      const getCallDetailsPromise = new Promise<{muted: boolean}>((resolve) => {
        resolveGetCallDetails = resolve;
      });
      const mockSvc = {
        getCallDetails: jest.fn().mockReturnValue(getCallDetailsPromise),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      const sync1 = voice.syncWxAppMuteFromCallDetails();
      const sync2 = voice.syncWxAppMuteFromCallDetails();

      resolveGetCallDetails!({muted: true});
      const [result1, result2] = await Promise.all([sync1, sync2]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockSvc.getCallDetails).toHaveBeenCalledTimes(1);
    });

    it('issues a new getCallDetails on sequential syncWxAppMuteFromCallDetails after the first completes', async () => {
      const mockSvc = {
        getCallDetails: jest
          .fn()
          .mockResolvedValueOnce({muted: false})
          .mockResolvedValueOnce({muted: true}),
      };
      const taskData = makeWxAppTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      await voice.syncWxAppMuteFromCallDetails();
      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalledTimes(2);
    });

    it('skips mute GET for terminated wxApp outdial with deviceCallId', async () => {
      const mockSvc = {getCallDetails: jest.fn()};
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          outboundType: 'OUTDIAL',
          isTerminated: true,
          participants: {
            'agent-1': {
              id: 'agent-1',
              deviceType: 'wxApp',
              deviceId: 'device-id-1',
              deviceCallId: 'callhalf-dead',
            },
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).not.toHaveBeenCalled();
    });

    it('skips mute GET for pre-accept wxApp OFFERED offer', async () => {
      const mockSvc = {getCallDetails: jest.fn()};
      const wxAppParticipant = {
        deviceType: 'wxApp',
        deviceId: 'device-id-1',
        deviceCallId: 'call-id-1',
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          outboundType: 'OUTDIAL',
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).not.toHaveBeenCalled();
    });

    it('still calls mute GET for post-accept OFFERED wxApp offer', async () => {
      const mockSvc = {
        answerCall: jest.fn().mockResolvedValue(undefined),
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const wxAppParticipant = {
        deviceType: 'wxApp',
        deviceId: 'device-id-1',
        deviceCallId: 'call-id-1',
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          outboundType: 'OUTDIAL',
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      await voice.accept();

      expect(voice.uiControlConfig.wxAppAcceptInFlight).toBe(false);
      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalledWith({callId: 'call-id-1'});
    });

    it('does not log error for expected wxApp call-not-found on mute sync', async () => {
      const errorSpy = jest.spyOn(LoggerProxy, 'error');
      const mockSvc = {
        getCallDetails: jest.fn().mockRejectedValue({status: 400, message: 'Call not found'}),
      };
      const wxAppParticipant = {
        deviceType: 'wxApp',
        deviceId: 'device-id-1',
        deviceCallId: 'call-id-1',
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      await voice.syncWxAppMuteFromCallDetails();

      expect(mockSvc.getCallDetails).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('decline', () => {
    const wxAppParticipant = {
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    };

    const makeWxAppOutdialTaskData = () =>
      createBaseData({
        agentId: 'agent-1',
        interaction: {
          outboundType: 'OUTDIAL',
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });

    it('cancels wxApp outdial via contact.cancelTask', async () => {
      const taskData = makeWxAppOutdialTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.decline();

      expect(dummyContact.cancelTask).toHaveBeenCalledWith({interactionId: 'int1'});
    });

    it('clears wxAppAnswerPending when declining outdial', async () => {
      const mockSvc = {
        answerCall: jest.fn().mockResolvedValue(undefined),
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const taskData = makeWxAppOutdialTaskData();
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.accept();
      expect(voice.uiControlConfig.wxAppAnswerPending).toBe(true);
      expect(voice.uiControlConfig.wxAppAcceptInFlight).toBe(false);

      await voice.decline();

      expect(voice.uiControlConfig.wxAppAnswerPending).toBe(false);
      expect(dummyContact.cancelTask).toHaveBeenCalledWith({interactionId: 'int1'});
    });

    it('throws unsupported for non-outdial voice tasks', async () => {
      const taskData = createBaseData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});

      await expect(voice.decline()).rejects.toThrow('Unsupported operation: decline');
      expect(dummyContact.cancelTask).not.toHaveBeenCalled();
    });

    it('throws unsupported when enableWxBetterTogether is false', async () => {
      const taskData = makeWxAppOutdialTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: false});

      await expect(voice.decline()).rejects.toThrow('Unsupported operation: decline');
      expect(dummyContact.cancelTask).not.toHaveBeenCalled();
    });
  });

  describe('unified task API routing (WXCC-6026)', () => {
    const wxAppParticipant = {
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    };

    it('accept() routes wxApp inbound offer to telephony answerCall', async () => {
      const mockSvc = {
        answerCall: jest.fn().mockResolvedValue(undefined),
        getCallDetails: jest.fn().mockResolvedValue({muted: false}),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.accept();

      expect(mockSvc.answerCall).toHaveBeenCalledWith({
        callId: 'call-id-1',
        endpointId: 'device-id-1',
        lineOwnerId: undefined,
      });
    });

    it('decline() routes wxApp inbound offer to telephony rejectCall', async () => {
      const mockSvc = {
        rejectCall: jest.fn().mockResolvedValue(undefined),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      await voice.decline();

      expect(mockSvc.rejectCall).toHaveBeenCalledWith({
        callId: 'call-id-1',
        lineOwnerId: undefined,
      });
      expect(dummyContact.cancelTask).not.toHaveBeenCalled();
    });

    it('toggleMute() routes wxApp engaged call to telephony muteCall', async () => {
      const mockSvc = {
        muteCall: jest.fn().mockResolvedValue(undefined),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      await voice.toggleMute({muted: true});

      expect(mockSvc.muteCall).toHaveBeenCalledWith({callId: 'call-id-1', lineOwnerId: undefined});
    });

    it('serializes concurrent no-arg toggleMute() so mute then unmute', async () => {
      let resolveMute: () => void;
      const muteGate = new Promise<void>((resolve) => {
        resolveMute = resolve;
      });
      const mockSvc = {
        muteCall: jest.fn().mockImplementation(() => muteGate),
        unmuteCall: jest.fn().mockResolvedValue(undefined),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);
      expect(voice.getWxAppMuted()).toBe(false);

      const firstToggle = voice.toggleMute();
      const secondToggle = voice.toggleMute();

      resolveMute!();
      await Promise.all([firstToggle, secondToggle]);

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(1);
      expect(mockSvc.unmuteCall).toHaveBeenCalledTimes(1);
      expect(voice.getWxAppMuted()).toBe(false);
    });

    it('continues queued toggleMute after predecessor failure', async () => {
      const mockSvc = {
        muteCall: jest.fn().mockRejectedValue(new Error('mute failed')),
        unmuteCall: jest.fn().mockResolvedValue(undefined),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      const firstToggle = voice.toggleMute({muted: true});
      const secondToggle = voice.toggleMute({muted: false});

      await expect(firstToggle).rejects.toThrow('mute failed');
      await secondToggle;

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(1);
      expect(mockSvc.unmuteCall).toHaveBeenCalledTimes(1);
    });

    it('transmitDtmf() routes wxApp engaged call to telephony transmitDtmf', async () => {
      const mockSvc = {
        transmitDtmf: jest.fn().mockResolvedValue(undefined),
      };
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {id: 'agent-1', ...wxAppParticipant},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {
        enableWxBetterTogether: true,
        answerCallOnWebexService: mockSvc as any,
      });
      primeConnectedState(voice, taskData);

      await voice.transmitDtmf({dtmf: '5'});

      expect(mockSvc.transmitDtmf).toHaveBeenCalledWith({
        callId: 'call-id-1',
        dtmf: '5',
        lineOwnerId: undefined,
      });
    });
  });
});
