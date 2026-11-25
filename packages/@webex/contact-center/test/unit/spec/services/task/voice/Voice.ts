import Voice from '../../../../../../src/services/task/voice/Voice';
import LoggerProxy from '../../../../../../src/logger-proxy';
import WebexRequest from '../../../../../../src/services/core/WebexRequest';
import {
  TaskData,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  DESTINATION_TYPE,
  TASK_EVENTS,
  VOICE_VARIANT,
} from '../../../../../../src/services/task/types';
import {CC_EVENTS} from '../../../../../../src/services/config/types';
import {TaskEvent, TaskState} from '../../../../../../src/services/task/state-machine';
import * as uiControlsComputer from '../../../../../../src/services/task/state-machine/uiControlsComputer';
import * as Utils from '../../../../../../src/services/core/Utils';
import {createTaskData} from '../taskTestUtils';
import {AIAssistantEventName} from '../../../../../../src/types';
import {AI_SUMMARY_ERROR_CODES} from '../../../../../../src/constants';
import {AI_SUMMARY_REQUEST_CANCELLED} from '../../../../../../src/services/task/constants';
import {createAISummaryError, createDeferred, flushEventLoopTurn, flushMicrotasks} from '../../../../fixtures/aiSummaryTestUtils';
import type AnswerCallOnWebexService from '../../../../../../src/services/AnswerCallOnWebexService';
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import * as wxAppDiagnosticLogging from '../../../../../../src/services/wxAppDiagnosticLogging';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn().mockResolvedValue(undefined)}),
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
  exitConference: jest.fn().mockResolvedValue({
    trackingId: 'exit-tracking-id',
    data: {},
  }),
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
      const initialExpected = uiControlsComputer.computeUIControls(
        initialSnapshot?.value as TaskState,
        initialSnapshot?.context as any,
        voice.data
      );
      expect(voice.uiControls).toEqual(initialExpected);

      voice.updateTaskData(taskData);
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      voice.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData});

      const snapshot = voice.stateMachineService?.getSnapshot();
      const expected = uiControlsComputer.computeUIControls(
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

    const createSummaryAdapter = () => {
      let rejectPending: ((error: Error) => void) | undefined;
      const adapter: any = {
        sendEvent: jest.fn().mockResolvedValue(undefined),
        requestAndWaitForRtd: jest.fn(async (options: any) => {
          const result = new Promise((_resolve, reject) => {
            rejectPending = reject;
          });
          await adapter.sendEvent(
            options.agentId,
            options.interactionId,
            options.eventType,
            options.eventName,
            options.eventMetaData,
            undefined,
            undefined,
            Date.now(),
            options.timeout
          );
          return result;
        }),
        clear: jest.fn(() =>
          rejectPending?.(createAISummaryError(AI_SUMMARY_REQUEST_CANCELLED))
        ),
      };

      return adapter;
    };

    const injectAISummaryDependencies = (
      voice: Voice,
      adapter = createSummaryAdapter(),
      featureEnablement = {
        interactionId: 'int1',
        postCallEnabled: true,
        midCallEnabled: true,
      }
    ) => {
      adapter.aiFeature = {
        id: 'summary-flags',
        generatedSummaries: {
          wrapUpSummariesEnabled: true,
          consultTransferSummariesEnabled: true,
        },
      };
      (voice as any).apiAIAssistant = adapter;
      voice.setFeatureEnablement(featureEnablement);

      return {adapter, coordinator: adapter};
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
      expect(adapter.sendEvent).toHaveBeenCalledTimes(1);
      expect(adapter.sendEvent).toHaveBeenCalledWith(
        summaryAgentId,
        'int1',
        'CTI_EVENT',
        summaryEventName,
        expect.objectContaining({
          conversationId: 'int1',
          clientType: 'WxCC',
        }),
        undefined,
        undefined,
        expect.any(Number),
        15000
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
          const {adapter, coordinator} = injectAISummaryDependencies(harness.voice);
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
          const {adapter, coordinator} = injectAISummaryDependencies(harness.voice);
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

          adapter.sendEvent.mockRejectedValueOnce(adapterError);
          injectAISummaryDependencies(harness.voice, adapter);

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

  describe('exitConference()', () => {
    const conferenceTaskData = () =>
      createBaseData({
        agentId: 'agent-1',
        interaction: {
          state: 'conference',
          owner: 'agent-1',
          mainInteractionId: 'int1',
          interactionId: 'int1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
            'agent-2': {id: 'agent-2', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
            c1: {id: 'c1', pType: 'Customer', type: 'Customer', hasJoined: true, hasLeft: false},
          },
          media: {
            media1: {mediaResourceId: 'media1', isHold: false},
            int1: {
              mediaResourceId: 'int1',
              mType: 'mainCall',
              participants: ['agent-1', 'agent-2', 'c1'],
              isHold: false,
            },
          },
        } as any,
      });

    const primeConferencing = (voice: Voice, taskData: TaskData) => {
      primeConnectedState(voice, taskData);
      voice.stateMachineService?.send({type: TaskEvent.CONFERENCE_START, taskData});
      expect(voice.stateMachineService?.getSnapshot().value).toBe(TaskState.CONFERENCING);
    };

    it('transitions to WRAPPING_UP after exitConference when the actor stays CONNECTED', async () => {
      const taskData = conferenceTaskData();
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'agent-1');
      primeConnectedState(voice, taskData);
      expect(voice.stateMachineService?.getSnapshot().value).toBe(TaskState.CONNECTED);

      await voice.exitConference();

      expect(dummyContact.exitConference).toHaveBeenCalled();
      expect(voice.stateMachineService?.getSnapshot().value).toBe(TaskState.WRAPPING_UP);
    });

    it('stamps wrapUpRequired on EXIT_CONFERENCE_SUCCESS when this agent should wrap', async () => {
      const taskData = conferenceTaskData();
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'agent-1');
      primeConferencing(voice, taskData);
      const sendSpy = jest.spyOn(voice.stateMachineService as any, 'send');

      await voice.exitConference();

      const successEvent = sendSpy.mock.calls
        .map((call) => call[0])
        .find((event) => event?.type === TaskEvent.EXIT_CONFERENCE_SUCCESS);

      expect(dummyContact.exitConference).toHaveBeenCalled();
      expect(successEvent?.taskData.wrapUpRequired).toBe(true);
    });

    it('stamps wrapUpRequired false on EXIT_CONFERENCE_SUCCESS when this agent should not wrap', async () => {
      const taskData = createBaseData({
        agentId: 'agent-2',
        isConsulted: true,
        wrapUpRequired: false,
        interaction: {
          state: 'conference',
          owner: 'agent-1',
          mainInteractionId: 'int1',
          interactionId: 'int1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
            'agent-2': {
              id: 'agent-2',
              pType: 'Agent',
              type: 'Agent',
              hasJoined: true,
              hasLeft: false,
              isWrapUp: false,
            },
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'agent-2');
      primeConferencing(voice, taskData);
      const sendSpy = jest.spyOn(voice.stateMachineService as any, 'send');

      await voice.exitConference();

      const successEvent = sendSpy.mock.calls
        .map((call) => call[0])
        .find((event) => event?.type === TaskEvent.EXIT_CONFERENCE_SUCCESS);

      expect(successEvent?.taskData.wrapUpRequired).toBe(false);
    });

    it('stamps wrapUpRequired true on owner-changed exit when isConsulted is omitted', async () => {
      const taskData = createBaseData({
        agentId: 'agent-1',
        wrapUpRequired: false,
        interaction: {
          state: 'conference',
          owner: 'agent-2',
          mainInteractionId: 'int1',
          interactionId: 'int1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
            'agent-2': {id: 'agent-2', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'agent-1');
      primeConferencing(voice, taskData);
      const sendSpy = jest.spyOn(voice.stateMachineService as any, 'send');

      await voice.exitConference();

      const successEvent = sendSpy.mock.calls
        .map((call) => call[0])
        .find((event) => event?.type === TaskEvent.EXIT_CONFERENCE_SUCCESS);

      expect(successEvent?.taskData.wrapUpRequired).toBe(true);
    });

    it('ignores a stale cached pending list when the exit response omits it', async () => {
      const taskData = createBaseData({
        agentId: 'agent-1',
        wrapUpRequired: false,
        agentsPendingWrapUp: ['agent-2'],
        interaction: {
          state: 'conference',
          owner: 'agent-2',
          mainInteractionId: 'int1',
          interactionId: 'int1',
          participants: {
            'agent-1': {id: 'agent-1', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
            'agent-2': {id: 'agent-2', pType: 'Agent', type: 'Agent', hasJoined: true, hasLeft: false},
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {}, undefined, 'agent-1');
      primeConferencing(voice, taskData);
      const sendSpy = jest.spyOn(voice.stateMachineService as any, 'send');

      await voice.exitConference();

      const successEvent = sendSpy.mock.calls
        .map((call) => call[0])
        .find((event) => event?.type === TaskEvent.EXIT_CONFERENCE_SUCCESS);

      expect(successEvent?.taskData.wrapUpRequired).toBe(true);
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

  describe('wxApp offer observability integration', () => {
    it('delegates OFFERED ui control updates to wxApp offer observability', () => {
      const logSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferDecision');
      const taskData = createBaseData({
        agentId: 'agent-1',
        interaction: {
          participants: {
            'agent-1': {
              id: 'agent-1',
              deviceType: 'wxApp',
              deviceId: 'device-id-1',
              deviceCallId: 'call-id-1',
            },
          },
        } as any,
      });
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});

      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({acceptReason: 'wxApp_offer_ready'})
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

    it('emits TASK_DECLINE and WXAPP_TASK_DECLINE success metrics for wxApp outdial decline', async () => {
      const taskData = makeWxAppOutdialTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      const metricsManager = MetricsManager.getInstance();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent');

      await voice.decline();

      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
        expect.objectContaining({taskId: 'int1'}),
        ['operational', 'behavioral']
      );
      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
        expect.objectContaining({taskId: 'int1'}),
        ['operational', 'behavioral']
      );
    });

    it('emits TASK_DECLINE and WXAPP_TASK_DECLINE failed metrics when outdial cancel fails', async () => {
      const cancelError = Object.assign(new Error('AQM failed'), {
        details: {
          trackingId: 'aqm-track-1',
          orgId: 'org-1',
          type: 'Service.aqm.task.cancel',
          data: {reason: 'TASK_NOT_FOUND', reasonCode: 404, agentId: 'agent-1'},
        },
      });
      dummyContact.cancelTask = jest.fn().mockRejectedValue(cancelError);
      const taskData = makeWxAppOutdialTaskData();
      const voice = new Voice(dummyContact, taskData, {enableWxBetterTogether: true});
      voice.stateMachineService?.send({type: TaskEvent.TASK_INCOMING, taskData});
      const metricsManager = MetricsManager.getInstance();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent');

      await expect(voice.decline()).rejects.toThrow('AQM failed');

      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
        expect.objectContaining({
          taskId: 'int1',
          trackingId: 'aqm-track-1',
          failureReason: 'TASK_NOT_FOUND',
        }),
        ['operational', 'behavioral']
      );
      expect(trackEventSpy).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
        expect.objectContaining({
          taskId: 'int1',
          trackingId: 'aqm-track-1',
          failureReason: 'TASK_NOT_FOUND',
        }),
        ['operational', 'behavioral']
      );
      dummyContact.cancelTask = jest.fn().mockResolvedValue(undefined);
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

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(1);
      expect(mockSvc.unmuteCall).not.toHaveBeenCalled();

      resolveMute!();
      await Promise.all([firstToggle, secondToggle]);

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(1);
      expect(mockSvc.unmuteCall).toHaveBeenCalledTimes(1);
      expect(voice.getWxAppMuted()).toBe(false);
    });

    it('queues three concurrent no-arg toggleMute() calls in order', async () => {
      let resolveFirstMute: () => void;
      const firstMuteGate = new Promise<void>((resolve) => {
        resolveFirstMute = resolve;
      });
      const mockSvc = {
        muteCall: jest
          .fn()
          .mockImplementationOnce(() => firstMuteGate)
          .mockResolvedValue(undefined),
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
      const thirdToggle = voice.toggleMute();

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(1);
      expect(mockSvc.unmuteCall).not.toHaveBeenCalled();

      resolveFirstMute!();
      await Promise.all([firstToggle, secondToggle, thirdToggle]);

      expect(mockSvc.muteCall).toHaveBeenCalledTimes(2);
      expect(mockSvc.unmuteCall).toHaveBeenCalledTimes(1);
      expect(voice.getWxAppMuted()).toBe(true);
    });

    it('records duration_ms on each serialized toggleMute success metric', async () => {
      let resolveFirstMute: () => void;
      const firstMuteGate = new Promise<void>((resolve) => {
        resolveFirstMute = resolve;
      });
      const mockSvc = {
        muteCall: jest.fn().mockImplementationOnce(() => firstMuteGate),
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
      const metricsManager = MetricsManager.getInstance();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent');

      const firstToggle = voice.toggleMute();
      const secondToggle = voice.toggleMute();

      resolveFirstMute!();
      await Promise.all([firstToggle, secondToggle]);

      const successCalls = trackEventSpy.mock.calls.filter(
        ([eventName]) => eventName === METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS
      );
      expect(successCalls).toHaveLength(2);
      successCalls.forEach(([, payload]) => {
        expect(payload).toEqual(
          expect.objectContaining({
            duration_ms: expect.any(Number),
          })
        );
      });
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

    it('serializes concurrent transmitDtmf() so each digit completes before the next', async () => {
      let resolveFirst: () => void;
      const firstGate = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const mockSvc = {
        transmitDtmf: jest
          .fn()
          .mockImplementationOnce(() => firstGate)
          .mockResolvedValueOnce(undefined),
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

      const firstDtmf = voice.transmitDtmf({dtmf: '1'});
      const secondDtmf = voice.transmitDtmf({dtmf: '2'});

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.transmitDtmf).toHaveBeenCalledTimes(1);
      expect(mockSvc.transmitDtmf).toHaveBeenCalledWith({
        callId: 'call-id-1',
        dtmf: '1',
        lineOwnerId: undefined,
      });

      resolveFirst!();
      await Promise.all([firstDtmf, secondDtmf]);

      expect(mockSvc.transmitDtmf).toHaveBeenCalledTimes(2);
      expect(mockSvc.transmitDtmf).toHaveBeenNthCalledWith(2, {
        callId: 'call-id-1',
        dtmf: '2',
        lineOwnerId: undefined,
      });
    });

    it('queues three concurrent transmitDtmf() calls in order', async () => {
      let resolveFirst: () => void;
      const firstGate = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const mockSvc = {
        transmitDtmf: jest
          .fn()
          .mockImplementationOnce(() => firstGate)
          .mockResolvedValue(undefined),
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

      const firstDtmf = voice.transmitDtmf({dtmf: '1'});
      const secondDtmf = voice.transmitDtmf({dtmf: '2'});
      const thirdDtmf = voice.transmitDtmf({dtmf: '3'});

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(mockSvc.transmitDtmf).toHaveBeenCalledTimes(1);
      expect(mockSvc.transmitDtmf).toHaveBeenCalledWith({
        callId: 'call-id-1',
        dtmf: '1',
        lineOwnerId: undefined,
      });

      resolveFirst!();
      await Promise.all([firstDtmf, secondDtmf, thirdDtmf]);

      expect(mockSvc.transmitDtmf).toHaveBeenCalledTimes(3);
      expect(mockSvc.transmitDtmf).toHaveBeenNthCalledWith(2, {
        callId: 'call-id-1',
        dtmf: '2',
        lineOwnerId: undefined,
      });
      expect(mockSvc.transmitDtmf).toHaveBeenNthCalledWith(3, {
        callId: 'call-id-1',
        dtmf: '3',
        lineOwnerId: undefined,
      });
    });

    it('records duration_ms on each serialized transmitDtmf success metric', async () => {
      let resolveFirst: () => void;
      const firstGate = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const mockSvc = {
        transmitDtmf: jest
          .fn()
          .mockImplementationOnce(() => firstGate)
          .mockResolvedValueOnce(undefined),
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
      const metricsManager = MetricsManager.getInstance();
      const trackEventSpy = jest.spyOn(metricsManager, 'trackEvent');

      const firstDtmf = voice.transmitDtmf({dtmf: '1'});
      const secondDtmf = voice.transmitDtmf({dtmf: '2'});

      resolveFirst!();
      await Promise.all([firstDtmf, secondDtmf]);

      const successCalls = trackEventSpy.mock.calls.filter(
        ([eventName]) => eventName === METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_SUCCESS
      );
      expect(successCalls).toHaveLength(2);
      successCalls.forEach(([, payload]) => {
        expect(payload).toEqual(
          expect.objectContaining({
            duration_ms: expect.any(Number),
          })
        );
      });

      trackEventSpy.mockRestore();
    });
  });
});

describe('T-008 Voice regional lifetime', () => {
  it('keeps stale controls disabled after a Voice-specific setting update', () => {
    const task = new Voice(dummyContact, createBaseData());
    primeConnectedState(task, task.data);
    const controls = uiControlsComputer.getDefaultUIControls();
    controls.main.hold = {isVisible: true, isEnabled: true};
    const compute = jest.spyOn(uiControlsComputer, 'computeUIControls');
    try {
      compute.mockReturnValueOnce(controls);
      task['updateUiControls'](true);
      task.invalidateForRegionRecovery();
      const disabled = task.uiControls;
      expect(disabled.main.hold).toEqual({isVisible: true, isEnabled: false});
      compute.mockClear();

      task.setEnableWxBetterTogether(true);

      expect(task.uiControls).toEqual(disabled);
      expect(controls.main.hold.isEnabled).toBe(true);
      expect(compute).not.toHaveBeenCalled();
    } finally {
      compute.mockRestore();
    }
  });

  describe('wxApp mute backfill lifetime', () => {
    const retirements = ['interrupted', 'stale', 'aborted'] as const;
    let task: Voice;
    let controller: AbortController;
    let admission: jest.Mock;
    let service: {getCallDetails: jest.Mock};
    const flush = async () => { for (let i = 0; i < 40; i += 1) await Promise.resolve(); };
    const finishRetries = async () => {
      for (let i = 0; i < 3; i += 1) {
        jest.advanceTimersByTime(50);
        await flush();
      }
    };
    const retire = (boundary: typeof retirements[number]) => {
      if (boundary === 'stale') task.invalidateForRegionRecovery();
      else if (boundary === 'aborted') controller.abort();
      else task.interruptOperations(() => Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    };

    beforeEach(() => {
      jest.useFakeTimers();
      controller = new AbortController();
      admission = jest.fn(() => { throw Utils.createRegionRecoveryError('RECOVERY_IN_PROGRESS'); });
      service = {getCallDetails: jest.fn().mockResolvedValue({muted: true})};
      task = new Voice(dummyContact, createBaseData({agentId: 'agent-1', interaction: {
        participants: {'agent-1': {
          id: 'agent-1', deviceType: 'wxApp', deviceId: 'device-1', deviceCallId: 'call-1',
        }},
      } as TaskData['interaction']}), {
        enableWxBetterTogether: true,
        answerCallOnWebexService: service as unknown as AnswerCallOnWebexService,
      });
      task.bindRecoveryGuard({generation: 1, signal: controller.signal, assertCommandAllowed: admission});
    });

    afterEach(() => {
      task.invalidateForRegionRecovery();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it.each([false, true])('finishes retries and read continuations with commands blocked: rejected=%s', async (rejected) => {
      if (rejected) service.getCallDetails.mockRejectedValue({status: 400, message: 'Call not found'});
      const updated = jest.fn();
      task.on(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, updated);
      const result = task.syncWxAppMuteFromCallDetails();
      expect(jest.getTimerCount()).toBe(1);
      await finishRetries();
      await expect(result).resolves.toBe(rejected ? undefined : true);
      expect(service.getCallDetails.mock.calls).toEqual([[{callId: 'call-1', lineOwnerId: undefined}]]);
      expect(task.getWxAppMuted()).toBe(!rejected);
      expect(updated.mock.calls).toEqual(rejected ? [] : [[{muted: true}]]);
      expect(admission).not.toHaveBeenCalled();
      expect(task['taskOperations'].size).toBe(0);
      expect(task['wxAppMuteSyncInFlight']).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(retirements)('does not start reads for a task that is %s', async (boundary) => {
      retire(boundary);
      await expect(task.syncWxAppMuteFromCallDetails()).rejects.toMatchObject({data: {
        reason: boundary === 'stale' ? 'STALE_TASK' : 'RECOVERY_INTERRUPTED',
      }});
      expect(service.getCallDetails).not.toHaveBeenCalled();
      expect(admission).not.toHaveBeenCalled();
      expect(task['taskOperations'].size).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(retirements)('clears retry timers when a task becomes %s', async (boundary) => {
      const result = task.syncWxAppMuteFromCallDetails();
      const observed = expect(result).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      expect(jest.getTimerCount()).toBe(1);
      retire(boundary);
      await observed;
      expect(jest.getTimerCount()).toBe(0);
      jest.advanceTimersByTime(1000);
      await flush();
      expect(service.getCallDetails).not.toHaveBeenCalled();
      expect(admission).not.toHaveBeenCalled();
      expect(task['taskOperations'].size).toBe(0);
      expect(task['wxAppMuteSyncInFlight']).toBeUndefined();
    });

    it.each(retirements.flatMap(boundary => [false, true].map(rejected => ({boundary, rejected}))))(
      'observes late reads without applying or logging after $boundary: rejected=$rejected', async ({boundary, rejected}) => {
        const pending = createDeferred<{muted: boolean}>();
        service.getCallDetails.mockReturnValue(pending.promise);
        const updated = jest.fn();
        task.on(TASK_EVENTS.TASK_WXAPP_MUTE_STATE_UPDATED, updated);
        const log = jest.spyOn(LoggerProxy, 'error').mockImplementation();
        const result = task.syncWxAppMuteFromCallDetails();
        const observed = expect(result).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        await finishRetries();
        expect(service.getCallDetails).toHaveBeenCalledTimes(1);
        retire(boundary);
        await observed; // The backend read is still pending.
        expect(task['taskOperations'].size).toBe(0);
        expect(task['wxAppMuteSyncInFlight']).toBeUndefined();
        if (rejected) pending.reject(new Error('late call-details failure'));
        else pending.resolve({muted: true});
        await flush();
        expect(task.getWxAppMuted()).toBe(false);
        expect(updated).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        expect(service.getCallDetails).toHaveBeenCalledTimes(1);
        expect(admission).not.toHaveBeenCalled();
        expect(task['taskOperations'].size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      }
    );
  });

  describe('wxApp continuation guard wiring', () => {
    const actualUtils = jest.requireActual('../../../../../../src/services/core/Utils');
    const uploadLogs = WebexRequest.getInstance().uploadLogs;
    let task: Voice;

    afterEach(() => {
      task?.invalidateForRegionRecovery();
      jest.restoreAllMocks();
    });

    it.each([true, false])(
      'drains a pending answer through real Voice dependencies: interrupted=%s', async (interrupted) => {
        jest.clearAllMocks();
        jest.spyOn(Utils, 'getErrorDetails').mockImplementation(actualUtils.getErrorDetails);
        const errorLog = jest.spyOn(LoggerProxy, 'error').mockImplementation();
        const log = jest.spyOn(LoggerProxy, 'log').mockImplementation();
        const actionLog = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppTelephonyAction');
        const metricsManager = MetricsManager.getInstance();
        jest.spyOn(metricsManager, 'timeEvent').mockImplementation();
        const metrics = jest.spyOn(metricsManager, 'trackEvent').mockImplementation();
        const pendingAnswer = createDeferred<void>();
        const service = {
          answerCall: jest.fn(() => pendingAnswer.promise),
          getCallDetails: jest.fn().mockResolvedValue({muted: false}),
        };
        const taskData = createBaseData({
          agentId: 'agent-1',
          interaction: {
            participants: {
              'agent-1': {
                id: 'agent-1', deviceType: 'wxApp',
                deviceId: 'device-id-1', deviceCallId: 'call-id-1',
              },
            },
          } as TaskData['interaction'],
        });
        task = new Voice(dummyContact, taskData, {
          enableWxBetterTogether: true,
          answerCallOnWebexService: service as unknown as AnswerCallOnWebexService,
        });
        task.stateMachineService.send({type: TaskEvent.TASK_INCOMING, taskData});
        expect(task.isWebexAppCallingOffer()).toBe(true);
        // Make an erroneous late reset observable even though the default is false.
        task['wxAppMuted'] = true;
        const sync = jest.spyOn(task, 'syncWxAppMuteFromCallDetails');
        const inFlight = jest.spyOn(task as any, 'setWxAppAcceptInFlight');
        const answerPending = jest.spyOn(task as any, 'setWxAppAnswerPending');
        const updated = jest.fn();
        task.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, updated);
        // Ignore construction/offer diagnostics; the assertions below own this accept.
        metrics.mockClear();
        actionLog.mockClear();
        const result = task.accept();

        expect(service.answerCall.mock.calls).toEqual([[
          {callId: 'call-id-1', endpointId: 'device-id-1', lineOwnerId: undefined},
        ]]);
        expect(inFlight.mock.calls).toEqual([[true]]);
        expect(answerPending.mock.calls).toEqual([[true]]);
        expect(task.uiControlConfig.wxAppAcceptInFlight).toBe(true);
        expect(task.uiControlConfig.wxAppAnswerPending).toBe(true);
        expect(sync).not.toHaveBeenCalled();
        expect(metrics).not.toHaveBeenCalled();

        if (interrupted) {
          const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
          const rejected = expect(result).rejects.toBe(error);
          task.interruptOperations(() => error);
          // The public race rejects while answerCall remains abandoned and pending.
          await rejected;
          const controls = task.uiControls;
          const config = {...task.uiControlConfig};
          const updatesAtRetirement = updated.mock.calls.slice();
          const logsAtRetirement = log.mock.calls.slice();

          pendingAnswer.resolve();
          await pendingAnswer.promise;
          await flushEventLoopTurn();

          expect(actionLog.mock.calls).toEqual([
            [{action: 'accept', phase: 'started', interactionId: 'int1'}],
          ]);
          expect(log.mock.calls).toEqual(logsAtRetirement);
          expect(metrics).not.toHaveBeenCalled();
          expect(task.getWxAppMuted()).toBe(true);
          expect(sync).not.toHaveBeenCalled();
          expect(service.getCallDetails).not.toHaveBeenCalled();
          expect(inFlight.mock.calls).toEqual([[true]]);
          expect(answerPending.mock.calls).toEqual([[true]]);
          expect(task.uiControlConfig).toEqual(config);
          expect(task.uiControls).toBe(controls);
          expect(updated.mock.calls).toEqual(updatesAtRetirement);
        } else {
          pendingAnswer.resolve();
          await expect(result).resolves.toBeUndefined();
          await flushEventLoopTurn();

          expect(actionLog.mock.calls).toEqual([
            [{action: 'accept', phase: 'started', interactionId: 'int1'}],
            [{action: 'accept', phase: 'success', interactionId: 'int1'}],
          ]);
          expect(metrics.mock.calls).toEqual([[
            METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
            {
              taskId: 'int1', acceptReason: 'wxApp_offer_ready',
              hasDeviceCallId: true, hasDeviceId: true,
            },
            ['operational', 'behavioral'],
          ]]);
          expect(sync).toHaveBeenCalledTimes(1);
          expect(service.getCallDetails).toHaveBeenCalledTimes(1);
          expect(task.getWxAppMuted()).toBe(false);
          expect(inFlight.mock.calls).toEqual([[true], [false]]);
          expect(answerPending.mock.calls).toEqual([[true]]);
          expect(task.uiControlConfig.wxAppAcceptInFlight).toBe(false);
          expect(task.uiControlConfig.wxAppAnswerPending).toBe(true);
          expect(updated).toHaveBeenCalled();
        }
        expect(errorLog).not.toHaveBeenCalled();
        expect(uploadLogs).not.toHaveBeenCalled();
      }
    );
  });

  describe('command recovery fences', () => {
    const actualUtils = jest.requireActual('../../../../../../src/services/core/Utils');
    const uploadLogs = WebexRequest.getInstance().uploadLogs as jest.Mock;
    const consultPayload = {to: 'agent-2', destinationType: DESTINATION_TYPE.AGENT};
    const transferPayload = {to: 'agent-2', destinationType: DESTINATION_TYPE.AGENT};
    const mediaRequest = {interactionId: 'int1', data: {mediaResourceId: 'media1'}};
    const interactionRequest = {interactionId: 'int1'};
    type CommandCase = {
      label: string;
      state: 'offered' | 'connected' | 'held' | 'consulting' | 'conference';
      boundary: string;
      request: unknown;
      invoke: (voice: Voice) => Promise<unknown>;
      prime?: (voice: Voice, data: TaskData) => void;

      failureMetric: string;
      failureEvent?: TaskEvent;
    };
    const commandCases: CommandCase[] = [
      {
        label: 'decline outdial', state: 'offered', boundary: 'cancelTask',
        request: interactionRequest, invoke: (voice) => voice.decline(),
        failureMetric: METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
      },
      {
        label: 'decline inbound', state: 'offered', boundary: 'rejectCall',
        request: {callId: 'call-1', lineOwnerId: undefined}, invoke: (voice) => voice.decline(),
        failureMetric: METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      },
      {
        label: 'holdResume hold', state: 'connected', boundary: 'hold',
        request: mediaRequest, invoke: (voice) => voice.holdResume(),
        failureMetric: METRIC_EVENT_NAMES.TASK_HOLD_FAILED, failureEvent: TaskEvent.HOLD_FAILED,
      },
      {
        label: 'holdResume resume', state: 'held', boundary: 'unHold',
        request: mediaRequest, invoke: (voice) => voice.holdResume(),
        failureMetric: METRIC_EVENT_NAMES.TASK_RESUME_FAILED, failureEvent: TaskEvent.UNHOLD_FAILED,
      },
      {
        label: 'pauseRecording', state: 'connected', boundary: 'pauseRecording',
        request: interactionRequest, invoke: (voice) => voice.pauseRecording(),
        failureMetric: METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
      },
      {
        label: 'resumeRecording', state: 'connected', boundary: 'resumeRecording',
        request: {interactionId: 'int1', data: {autoResumed: false}},
        prime: (voice, taskData) => voice.stateMachineService.send({
          type: TaskEvent.PAUSE_RECORDING, taskData,
        }),
        invoke: (voice) => voice.resumeRecording(),
        failureMetric: METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
      },
      {
        label: 'consult', state: 'connected', boundary: 'consult',
        request: {interactionId: 'int1', data: consultPayload},
        invoke: (voice) => voice.consult({...consultPayload}),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
        failureEvent: TaskEvent.CONSULT_FAILED,
      },
      {
        label: 'endConsult', state: 'consulting', boundary: 'consultEnd',
        request: {interactionId: 'int1', data: undefined}, invoke: (voice) => voice.endConsult(),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
      },
      {
        label: 'transfer consult', state: 'consulting', boundary: 'consultTransfer',
        request: {interactionId: 'int1', data: {to: 'agent-2', destinationType: 'agent'}},
        invoke: (voice) => voice.transfer({...transferPayload}),
        failureMetric: METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      },
      {
        label: 'transfer blind', state: 'connected', boundary: 'blindTransfer',
        request: {interactionId: 'int1', data: transferPayload},
        invoke: (voice) => voice.transfer({...transferPayload}),
        failureMetric: METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      },
      {
        label: 'consultConference', state: 'consulting', boundary: 'consultConference',
        request: {
          interactionId: 'int1',
          data: {agentId: 'agent-1', to: 'agent-2', destinationType: DESTINATION_TYPE.AGENT},
        },
        invoke: (voice) => voice.consultConference(),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONFERENCE_START_FAILED,
        failureEvent: TaskEvent.CONFERENCE_FAILED,
      },
      {
        label: 'dropConferenceParticipant', state: 'conference', boundary: 'dropConferenceParticipant',
        request: {interactionId: 'int1', participantId: 'agent-2'},
        invoke: (voice) => voice.dropConferenceParticipant({participantId: 'agent-2'}),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED,
      },
      {
        label: 'exitConference', state: 'conference', boundary: 'exitConference',
        request: interactionRequest, invoke: (voice) => voice.exitConference(),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONFERENCE_EXIT_FAILED,
        failureEvent: TaskEvent.EXIT_CONFERENCE_FAILED,
      },
      {
        label: 'transferConference', state: 'conference', boundary: 'conferenceTransfer',
        request: interactionRequest, invoke: (voice) => voice.transferConference(),
        failureMetric: METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_FAILED,
        failureEvent: TaskEvent.TRANSFER_CONFERENCE_FAILED,
      },
      {
        label: 'switchCall to main', state: 'consulting', boundary: 'unHold',
        request: mediaRequest, invoke: (voice) => voice.switchCall(),
        failureMetric: METRIC_EVENT_NAMES.TASK_SWITCH_CALL_FAILED,
        failureEvent: TaskEvent.SWITCH_TO_CONSULT,
      },
      {
        label: 'switchCall to consult', state: 'consulting', boundary: 'hold',
        request: mediaRequest, invoke: (voice) => voice.switchCall(),
        prime: (voice) => voice.stateMachineService.send({type: TaskEvent.SWITCH_TO_MAIN_CALL}),
        failureMetric: METRIC_EVENT_NAMES.TASK_SWITCH_CALL_FAILED,
        failureEvent: TaskEvent.SWITCH_TO_MAIN_CALL,
      },
    ];
    let task: Voice;
    let errorLog: jest.SpyInstance;
    let metrics: jest.SpyInstance;
    let diagnosticSinks: jest.SpyInstance[];

    beforeEach(() => {
      jest.spyOn(Utils, 'getErrorDetails').mockImplementation(actualUtils.getErrorDetails);
      errorLog = jest.spyOn(LoggerProxy, 'error').mockImplementation();
      const manager = MetricsManager.getInstance();
      metrics = jest.spyOn(manager, 'trackEvent').mockImplementation();
      diagnosticSinks = [
        metrics, errorLog,
        jest.spyOn(manager, 'timeEvent').mockImplementation(),
        jest.spyOn(manager, 'cancelTimedEvent').mockImplementation(),
        jest.spyOn(LoggerProxy, 'info').mockImplementation(),
        jest.spyOn(LoggerProxy, 'log').mockImplementation(),
        jest.spyOn(LoggerProxy, 'warn').mockImplementation(),
        jest.spyOn(LoggerProxy, 'trace').mockImplementation(),
        jest.spyOn(wxAppDiagnosticLogging, 'logWxAppTelephonyAction'),
      ];
    });

    afterEach(() => {
      task?.invalidateForRegionRecovery();
      jest.restoreAllMocks();
    });

    const createHarness = (testCase: CommandCase) => {
      const pending = createDeferred<any>();
      const boundaries = Object.fromEntries([
        'cancelTask', 'rejectCall', 'hold', 'unHold', 'pauseRecording', 'resumeRecording',
        'consult', 'consultEnd', 'consultTransfer', 'blindTransfer', 'consultConference',
        'dropConferenceParticipant', 'exitConference', 'conferenceTransfer',
      ].map((method) => [method, jest.fn(() => pending.promise)]));
      const taskData = createBaseData({
        agentId: 'agent-1', destAgentId: 'agent-2', consultMediaResourceId: 'consult-media',
        interaction: {
          state: testCase.state === 'consulting' ? 'consulting' : 'connected',
          outboundType: testCase.label === 'decline outdial' ? 'OUTDIAL' : undefined,
          owner: 'agent-1',
          callProcessingDetails: {recordingStarted: true, recordInProgress: true},
          participants: {
            'agent-1': {
              id: 'agent-1', pType: 'Agent', type: 'Agent', hasLeft: false,
              deviceType: 'wxApp', deviceId: 'device-1', deviceCallId: 'call-1',
            },
            'agent-2': {id: 'agent-2', pType: 'Agent', type: 'Agent', hasLeft: false},
          },
          media: {
            media1: {mediaResourceId: 'media1', isHold: false},
            'consult-media': {
              mediaResourceId: 'consult-media', isHold: false, mType: 'consult',
              participants: ['agent-1', 'agent-2'],
            },
          },
        } as TaskData['interaction'],
      });
      task = new Voice(boundaries as any, taskData, {
        enableWxBetterTogether: testCase.state === 'offered',
        answerCallOnWebexService: {rejectCall: boundaries.rejectCall} as unknown as AnswerCallOnWebexService,
      }, undefined, 'agent-1');
      if (testCase.state === 'offered') {
        task.stateMachineService.send({type: TaskEvent.TASK_INCOMING, taskData});
        expect(task.isWebexAppCallingOffer()).toBe(true);
      } else if (testCase.state === 'held') {
        primeHeldState(task, taskData);
      } else {
        primeConnectedState(task, taskData);
        if (testCase.state === 'consulting') {
          task.stateMachineService.send({type: TaskEvent.CONSULT, ...{
            destination: consultPayload.to, destinationType: consultPayload.destinationType,
          }});
          task.stateMachineService.send({type: TaskEvent.CONSULT_SUCCESS, taskData});
        } else if (testCase.state === 'conference') {
          task.stateMachineService.send({type: TaskEvent.CONFERENCE_START, taskData});
        }
      }
      expect(task.stateMachineService.getSnapshot().value).toBe({
        offered: TaskState.OFFERED, connected: TaskState.CONNECTED, held: TaskState.HELD,
        consulting: TaskState.CONSULTING, conference: TaskState.CONFERENCING,
      }[testCase.state]);
      testCase.prime?.(task, taskData);
      const admission = jest.fn();
      task.bindRecoveryGuard({
        generation: 1, signal: new AbortController().signal, assertCommandAllowed: admission,
      });
      const actor = jest.spyOn(task.stateMachineService, 'send');
      const emit = jest.spyOn(task, 'emit');
      const updates = jest.spyOn(task, 'updateTaskData');
      const controls = jest.spyOn(task as any, 'updateUiControls');
      diagnosticSinks.forEach((sink) => sink.mockClear());
      uploadLogs.mockClear();
      const effects = () => ({
        // Clone values so an in-place mutation cannot also change our baseline.
        state: JSON.parse(JSON.stringify({
          value: task.stateMachineService.getSnapshot().value,
          context: task.stateMachineService.getSnapshot().context,
          data: task.data, controls: task.uiControls, config: task['uiControlConfig'],
          wxAppMuted: task.getWxAppMuted(),
        })),
        calls: [actor, emit, updates, controls, ...diagnosticSinks, uploadLogs,
          ...Object.values(boundaries)].map((sink) => sink.mock.calls.slice()),
      });
      const expectBoundary = () => {
        expect(admission).toHaveBeenCalled();
        expect(Object.fromEntries(Object.entries(boundaries).map(([name, mock]) => [
          name, mock.mock.calls,
        ]))).toEqual(Object.fromEntries(Object.keys(boundaries).map((name) => [
          name, name === testCase.boundary ? [[testCase.request]] : [],
        ])));
      };
      const response = {trackingId: 'voice-command-tracking', data: taskData};

      return {pending, admission, actor, effects, expectBoundary, response};
    };

    describe.each(commandCases)('$label', (testCase) => {
      it('blocks entry before I/O or local effects', async () => {
        const harness = createHarness(testCase);
        const error = Utils.createRegionRecoveryError('RECOVERY_IN_PROGRESS');
        harness.admission.mockImplementation(() => {throw error;});
        const before = harness.effects();

        await expect(testCase.invoke(task)).rejects.toBe(error);

        expect(harness.effects()).toEqual(before);
      });

      it('preserves a backend recovery rejection without ordinary failure effects', async () => {
        const harness = createHarness(testCase);
        const error = Utils.createRegionRecoveryError('REGION_RELOAD_REQUIRED', {status: 409});
        const observed = expect(testCase.invoke(task)).rejects.toBe(error);
        harness.expectBoundary();
        const initiated = harness.effects();

        harness.pending.reject(error);
        await observed;

        expect(harness.effects()).toEqual(initiated);
      });

      it.each(['resolve', 'reject'] as const)('interrupts pending work and drains late %s without effects or replay', async (settlement) => {
        const harness = createHarness(testCase);
        const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
        const observed = expect(testCase.invoke(task)).rejects.toBe(error);
        harness.expectBoundary();

        task.interruptOperations(() => error);
        await observed; // The backend remains pending.
        const retired = harness.effects();
        if (settlement === 'resolve') harness.pending.resolve(harness.response);
        else harness.pending.reject(new Error('abandoned ordinary backend failure'));
        await flushEventLoopTurn();

        expect(harness.effects()).toEqual(retired);
        expect(metrics).not.toHaveBeenCalled();
        expect(errorLog).not.toHaveBeenCalled();
        expect(uploadLogs).not.toHaveBeenCalled();
      });

      it('preserves ordinary backend failure handling', async () => {
        const harness = createHarness(testCase);
        const error = new Error('ordinary backend failure');
        const result = testCase.invoke(task);
        const observed = testCase.boundary === 'dropConferenceParticipant'
          ? expect(result).rejects.toBe(error)
          : expect(result).rejects.toThrow('Error while performing');
        harness.expectBoundary();
        harness.actor.mockClear();
        harness.pending.reject(error);
        await observed;

        expect(metrics.mock.calls.map(([name]) => name)).toContain(testCase.failureMetric);
        if (testCase.failureEvent) {
          expect(harness.actor.mock.calls.map(([event]) => event.type)).toEqual([testCase.failureEvent]);
        }
      });

      if (testCase.boundary === 'conferenceTransfer') {
        it('completes an admitted conference transfer through its actor', async () => {
          const harness = createHarness(testCase);
          const result = testCase.invoke(task);
          harness.expectBoundary();
          harness.pending.resolve(harness.response);

          await expect(result).resolves.toBe(harness.response);
          expect(harness.actor).toHaveBeenCalledWith({type: TaskEvent.TRANSFER_CONFERENCE_SUCCESS, taskData: harness.response.data});
        });
      }
    });
  });
});
