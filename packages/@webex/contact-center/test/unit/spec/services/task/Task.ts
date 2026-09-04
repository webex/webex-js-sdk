import Task from '../../../../../src/services/task/Task';
import {
  TaskData,
  DESTINATION_TYPE,
  TASK_EVENTS,
  TASK_CHANNEL_TYPE,
  TransferPayLoad,
  VOICE_VARIANT,
  AISummaryActionType,
  PostCallSummaryResponsePayload,
  MidCallSummaryResponsePayload,
} from '../../../../../src/services/task/types';
import {TaskEvent} from '../../../../../src/services/task/state-machine';
import {ENTRY_POINT_TRANSFER_DESTINATION_TYPE} from '../../../../../src/services/task/constants';
import LoggerProxy from '../../../../../src/logger-proxy';
import {createTaskData} from './taskTestUtils';
import {AIAssistantEventName} from '../../../../../src/types';
import {AI_SUMMARY_ERROR_CODES} from '../../../../../src/constants';
import {METRIC_EVENT_NAMES} from '../../../../../src/metrics/constants';
import RtdRequestResolver from '../../../../../src/services/core/RtdRequestResolver';
import {
  AI_SUMMARY_DURATION_MS,
  AI_SUMMARY_REQUEST_CANCELLED,
  METHODS,
} from '../../../../../src/services/task/constants';
import {getAISummaryCorrelation} from '../../../../../src/services/task/TaskUtils';
import {
  createAISummaryError,
  createAISummaryErrorExpectation,
  createDeferred,
  flushEventLoopTurn,
} from '../../../fixtures/aiSummaryTestUtils';

const AI_SUMMARY_TRANSPORT_ERROR_CODES = {
  VALIDATION_FAILED: 'AI_SUMMARY_TRANSPORT_VALIDATION_FAILED',
  HTTP_REQUEST_FAILED: 'AI_SUMMARY_HTTP_REQUEST_FAILED',
  TIMEOUT: 'AI_SUMMARY_TRANSPORT_TIMEOUT',
} as const;

class DummyTask extends Task {
  constructor(contact: any, data: TaskData, agentId = 'agent-1', agentName = 'Receiving Agent') {
    super(
      contact,
      data,
      {
        channelType: 'voice',
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      },
      undefined,
      agentId,
      agentName
    );
  }

  public accept() {
    return Promise.resolve({} as any);
  }
}

class ConferenceTask extends DummyTask {
  protected override getChannelSpecificActionOverrides() {
    return {
      ...super.getChannelSpecificActionOverrides(),
      emitTaskParticipantLeft: this.createEmitSelfAction(TASK_EVENTS.TASK_PARTICIPANT_LEFT, {
        updateTaskData: true,
      }),
      emitTaskConferenceEnded: this.createEmitSelfAction(TASK_EVENTS.TASK_CONFERENCE_ENDED, {
        updateTaskData: true,
      }),
    };
  }
}

class SpyAcceptTask extends Task {
  public acceptMock: jest.Mock;

  constructor(contact: any, data: TaskData, configOverrides: any = {}) {
    super(contact, data, {
      channelType: TASK_CHANNEL_TYPE.VOICE,
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
      ...configOverrides,
    });
    this.acceptMock = jest.fn().mockResolvedValue({} as any);
  }

  public accept() {
    return this.acceptMock();
  }
}

jest.mock('xstate', () => ({
  createActor: jest.fn((machine) => {
    let snapshot = {value: 'IDLE', context: {}, event: undefined as any};
    const subscribers = new Set<any>();
    const actions = machine?.options?.actions ?? {};
    const notify = () => {
      subscribers.forEach((subscriber) => subscriber(snapshot));
    };
    const transition = (value: string, event: any) => {
      snapshot = {value, context: {}, event};
      notify();
    };

    return {
      subscribe: jest.fn((subscriber) => {
        subscribers.add(subscriber);

        return {unsubscribe: () => subscribers.delete(subscriber)};
      }),
      start: jest.fn(() => notify()),
      stop: jest.fn(),
      getSnapshot: jest.fn(() => snapshot),
      send: jest.fn((event) => {
        switch (event?.type) {
          case 'TASK_INCOMING':
            actions.emitTaskIncoming?.({event});
            transition('OFFERED', event);
            break;
          case 'TASK_OFFERED':
            actions.requestAutoAnswer?.({event});
            transition('OFFERED', event);
            break;
          case 'ASSIGN':
            actions.emitTaskAssigned?.({event});
            transition('CONNECTED', event);
            break;
          case 'CONTACT_UPDATED':
            actions.syncTaskDataFromEvent?.({event});
            transition(snapshot.value, event);
            break;
          case 'CONTACT_OWNER_CHANGED':
            actions.emitTaskHydrate?.({event});
            transition(snapshot.value, event);
            break;
          case 'CONFERENCE_START':
            transition('CONFERENCING', event);
            break;
          case 'PARTICIPANT_LEAVE':
            actions.emitTaskParticipantLeft?.({event});
            transition(snapshot.value, event);
            break;
          case 'CONTACT_ENDED':
            actions.requestCleanup?.({event});
            transition('WRAPUP', event);
            break;
          case 'RONA':
            actions.cleanupResources?.({event});
            transition('ENDED', event);
            break;
          default:
            transition(snapshot.value, event);
        }
      }),
    };
  }),
}));

jest.mock('../../../../../src/services/task/state-machine', () => ({
  __esModule: true,
  TaskEvent: {
    TASK_INCOMING: 'TASK_INCOMING',
    TASK_OFFERED: 'TASK_OFFERED',
    ASSIGN: 'ASSIGN',
    CONTACT_UPDATED: 'CONTACT_UPDATED',
    CONTACT_OWNER_CHANGED: 'CONTACT_OWNER_CHANGED',
    CONFERENCE_START: 'CONFERENCE_START',
    PARTICIPANT_LEAVE: 'PARTICIPANT_LEAVE',
    CONTACT_ENDED: 'CONTACT_ENDED',
    RONA: 'RONA',
    TASK_WRAPUP: 'TASK_WRAPUP',
  },
  createTaskStateMachine: jest.fn((_config, options) => ({options})),
}));

jest.mock('../../../../../src/services/task/state-machine/uiControlsComputer', () => {
  const createControl = () => ({isVisible: false, isEnabled: false});
  const createLegControls = () => ({
    accept: createControl(),
    decline: createControl(),
    hold: createControl(),
    transfer: createControl(),
    consult: createControl(),
    end: createControl(),
    recording: createControl(),
    mute: createControl(),
    consultTransfer: createControl(),
    endConsult: createControl(),
    conference: createControl(),
    exitConference: createControl(),
    transferConference: createControl(),
    mergeToConference: createControl(),
    wrapup: createControl(),
    switch: createControl(),
  });
  const createDefaultControls = () => ({
    main: createLegControls(),
    consult: createLegControls(),
    activeLeg: 'main',
  });

  return {
    __esModule: true,
    computeUIControls: jest.fn((state) => {
      const controls = createDefaultControls();
      if (state === 'CONFERENCING') {
        controls.main.exitConference = {isVisible: true, isEnabled: true};
      }

      return controls;
    }),
    getDefaultUIControls: jest.fn(createDefaultControls),
    haveUIControlsChanged: jest.fn(() => false),
  };
});

jest.mock('../../../../../src/services/task/AutoWrapup', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    clear: jest.fn(),
  })),
}));

jest.mock('../../../../../src/services/task/TaskUtils', () => ({
  getAISummaryCorrelation: jest.fn((taskData) => {
    const interactionId = taskData?.interactionId;
    const conversationId = taskData?.interaction?.mainInteractionId ?? interactionId;

    if (
      typeof interactionId !== 'string' ||
      interactionId.length === 0 ||
      typeof conversationId !== 'string' ||
      conversationId.length === 0
    ) {
      const error = new Error('AI_SUMMARY_CORRELATION_NOT_AVAILABLE') as Error & {
        data?: Record<string, unknown>;
      };

      error.data = {errorCode: 'AI_SUMMARY_CORRELATION_NOT_AVAILABLE'};
      throw error;
    }

    return {conversationId, interactionId};
  }),
}));

jest.mock('../../../../../src/services/core/Utils', () => ({
  getErrorDetails: jest.fn((_error, method) => ({
    error: new Error(`Error while performing ${method}`),
  })),
}));

jest.mock('../../../../../src/metrics/MetricsManager', () => {
  const metricsInstance = {
    trackEvent: jest.fn(),
    timeEvent: jest.fn(),
  };
  const MetricsManager = jest.fn();

  (MetricsManager as any).getInstance = jest.fn(() => metricsInstance);
  (MetricsManager as any).getCommonTrackingFieldForAQMResponse = jest.fn(() => ({}));
  (MetricsManager as any).getCommonTrackingFieldForAQMResponseFailed = jest.fn(() => ({}));

  return {
    __esModule: true,
    default: MetricsManager,
  };
});

jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn()}),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Task (base class)', () => {
  const dummyContact = {} as any;
  const initialData = {
    foo: 'bar',
    nested: {a: 1, b: 2},
  } as unknown as TaskData;

  let task: DummyTask;

  beforeEach(() => {
    task = new DummyTask(dummyContact, initialData);
  });

  it('merges updateTaskData when shouldOverwrite is false', () => {
    const updated = {foo: 'baz', nested: {b: 3}} as unknown as TaskData;
    task.updateTaskData(updated);
    expect(task.data.foo).toBe('baz');
    // nested.a remains, nested.b updated
    expect((task.data as any).nested).toEqual({a: 1, b: 3});
  });

  it('overwrites data when shouldOverwrite is true', () => {
    const updated = {x: 42} as unknown as TaskData;
    task.updateTaskData(updated, true);
    expect((task.data as any).x).toBe(42);
    expect((task.data as any).foo).toBeUndefined();
  });

  it('drops stale interaction.media/participants entries the backend no longer sends (merge keeps other fields)', () => {
    const withConsult = createTaskData({
      interaction: {
        callAssociatedData: {a: {value: 'keep-me'}},
        media: {
          main: {mediaResourceId: 'main', mType: 'mainCall', isHold: true},
          consult: {mediaResourceId: 'consult', mType: 'consult', isHold: false},
        },
        participants: {
          'customer-1': {id: 'customer-1', pType: 'Customer'},
          'agent-1': {id: 'agent-1', pType: 'Agent'},
          'agent-2': {id: 'agent-2', pType: 'Agent', consultState: 'consulting'},
        },
      } as any,
    }) as unknown as TaskData;
    task.updateTaskData(withConsult, true);

    // Backend resume snapshot: consult leg gone (only main media + main participants).
    const resumeData = createTaskData({
      interaction: {
        media: {main: {mediaResourceId: 'main', mType: 'mainCall', isHold: false}},
        participants: {
          'customer-1': {id: 'customer-1', pType: 'Customer'},
          'agent-1': {id: 'agent-1', pType: 'Agent', consultState: null},
        },
      } as any,
    }) as unknown as TaskData;
    task.updateTaskData(resumeData);

    const interaction = (task.data as any).interaction;
    // Stale consult media + consultee participant (absent from the resume snapshot) are removed.
    expect(interaction.media.consult).toBeUndefined();
    expect(interaction.participants['agent-2']).toBeUndefined();
    // Entries still present in the incoming snapshot survive and reflect the new values.
    expect(interaction.media.main).toBeDefined();
    expect(interaction.media.main.isHold).toBe(false);
    expect(interaction.participants['agent-1']).toBeDefined();
    expect(interaction.participants['customer-1']).toBeDefined();
    // Unrelated merge-able fields (CAD) are preserved.
    expect(interaction.callAssociatedData.a.value).toBe('keep-me');
  });

  it('does not touch interaction maps when the incoming payload omits them', () => {
    const withConsult = createTaskData({
      interaction: {
        media: {main: {mediaResourceId: 'main'}, consult: {mediaResourceId: 'consult'}},
        participants: {'agent-1': {id: 'agent-1'}, 'agent-2': {id: 'agent-2'}},
      } as any,
    }) as unknown as TaskData;
    task.updateTaskData(withConsult, true);

    // A partial update with no interaction maps must not prune existing media/participants.
    task.updateTaskData({foo: 'changed'} as unknown as TaskData);

    const interaction = (task.data as any).interaction;
    expect(interaction.media.main).toBeDefined();
    expect(interaction.media.consult).toBeDefined();
    expect(interaction.participants['agent-1']).toBeDefined();
    expect(interaction.participants['agent-2']).toBeDefined();
  });

  it('getUIControls returns default controls shape for idle voice task', () => {
    const controls = task.uiControls;
    const mainControls = controls.main;

    // IDLE state: no active call, ALL controls should be hidden AND disabled
    expect(mainControls.accept.isVisible).toBe(false);
    expect(mainControls.accept.isEnabled).toBe(false);
    expect(mainControls.decline.isVisible).toBe(false);
    expect(mainControls.decline.isEnabled).toBe(false);
    expect(mainControls.end.isVisible).toBe(false);
    expect(mainControls.end.isEnabled).toBe(false);
    expect(mainControls.transfer.isVisible).toBe(false);
    expect(mainControls.transfer.isEnabled).toBe(false);
    expect(mainControls.hold.isVisible).toBe(false);
    expect(mainControls.hold.isEnabled).toBe(false);
    expect(mainControls.mute.isVisible).toBe(false);
    expect(mainControls.mute.isEnabled).toBe(false);
    expect(mainControls.consult.isVisible).toBe(false);
    expect(mainControls.consult.isEnabled).toBe(false);
    expect(mainControls.consultTransfer.isVisible).toBe(false);
    expect(mainControls.consultTransfer.isEnabled).toBe(false);
    expect(mainControls.endConsult.isVisible).toBe(false);
    expect(mainControls.endConsult.isEnabled).toBe(false);
    expect(mainControls.recording.isVisible).toBe(false);
    expect(mainControls.recording.isEnabled).toBe(false);
    expect(mainControls.conference.isVisible).toBe(false);
    expect(mainControls.conference.isEnabled).toBe(false);
    expect(mainControls.wrapup.isVisible).toBe(false);
    expect(mainControls.wrapup.isEnabled).toBe(false);
  });

  it('calls updateUiControls when updateTaskData is invoked', () => {
    const spy = jest.spyOn(task as any, 'updateUiControls');
    task.updateTaskData({foo: 'new'} as TaskData);
    expect(spy).toHaveBeenCalled();
  });

  it('logs state transitions using locally tracked previous state', () => {
    const logSpy = jest.spyOn(LoggerProxy, 'log');
    const statefulData = createTaskData();
    const transitionTask = new DummyTask(dummyContact, statefulData);

    logSpy.mockClear();

    transitionTask.stateMachineService?.send({
      type: TaskEvent.TASK_INCOMING,
      taskData: statefulData,
    });
    transitionTask.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData: statefulData});

    const transitionMessages = logSpy.mock.calls
      .filter(
        ([msg]) => typeof msg === 'string' && (msg as string).startsWith('State machine transition')
      )
      .map(([msg]) => msg);

    expect(transitionMessages).toEqual([
      'State machine transition: IDLE -> OFFERED',
      'State machine transition: OFFERED -> CONNECTED',
    ]);

    transitionTask.stateMachineService?.stop();
  });

  it('emits task:wrapup when wrap-up is required', () => {
    const overrides = (task as any).getStateMachineActionOverrides();
    const emitSpy = jest.spyOn(task, 'emit');

    task.updateTaskData(createTaskData({wrapUpRequired: true}) as TaskData);
    overrides.emitTaskWrapup({event: {type: TaskEvent.TASK_WRAPUP}});

    expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_WRAPUP, task);
  });

  it('does not emit task:wrapup when wrap-up is not required', () => {
    const overrides = (task as any).getStateMachineActionOverrides();
    const emitSpy = jest.spyOn(task, 'emit');

    task.updateTaskData(createTaskData({wrapUpRequired: false}) as TaskData);
    overrides.emitTaskWrapup({event: {type: TaskEvent.TASK_WRAPUP}});

    expect(emitSpy).not.toHaveBeenCalledWith(TASK_EVENTS.TASK_WRAPUP, task);
  });

  it('adapts incoming, consulting, and rejection state-machine actions to task events', () => {
    const actions = (task as any).getStateMachineActionOverrides();
    const incomingData = createTaskData({interactionId: 'action-incoming'});
    const emitSpy = jest.spyOn(task, 'emit');

    actions.emitTaskIncoming({event: {type: 'TASK_INCOMING', taskData: incomingData}});
    actions.emitTaskConsulting({
      event: {
        type: 'CONSULTING_ACTIVE',
        taskData: {...incomingData, isConsulted: false},
      },
    });
    actions.emitTaskConsulting({
      event: {
        type: 'CONSULTING_ACTIVE',
        taskData: {...incomingData, isConsulted: true},
      },
    });
    actions.emitTaskReject({event: {type: 'ASSIGN_FAILED', reason: 'busy'}});
    actions.emitTaskReject({event: undefined});

    expect(task.data.interactionId).toBe('action-incoming');
    expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULTING, task);
    expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_CONSULT_ACCEPTED, task);
    expect(emitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_REJECT, 'busy');
  });

  it('throws for unsupported voice operations in the base class', async () => {
    const fullData = createTaskData();
    const voiceTask = new DummyTask(dummyContact, fullData);

    const cases: Array<() => Promise<unknown>> = [
      () => voiceTask.decline(),
      () => voiceTask.pauseRecording(),
      () => voiceTask.resumeRecording({} as any),
      () => voiceTask.consult({} as any),
      () => voiceTask.endConsult({} as any),
      () => voiceTask.consultTransfer({} as any),
      () => voiceTask.consultConference(),
      () => voiceTask.dropConferenceParticipant({participantId: 'participant-id'}),
      () => voiceTask.exitConference(),
      () => voiceTask.transferConference(),
      () => voiceTask.toggleMute(),
      () => voiceTask.hold(),
      () => voiceTask.resume(),
      () => voiceTask.holdResume(),
    ];

    for (const fn of cases) {
      await expect(fn()).rejects.toThrow('Unsupported operation');
    }

    expect(() => voiceTask.unregisterWebCallListeners()).not.toThrow();
  });

  it('syncs task.data from CONTACT_UPDATED', () => {
    const fullData = createTaskData({foo: 'old'} as any);
    const voiceTask = new DummyTask(dummyContact, fullData);

    voiceTask.sendStateMachineEvent({
      type: TaskEvent.CONTACT_UPDATED,
      taskData: {...fullData, foo: 'new'} as any,
    });

    expect((voiceTask.data as any).foo).toBe('new');
  });

  it('syncs owner changes and emits task:hydrate without changing task state', () => {
    const originalData = createTaskData({
      interaction: {owner: 'agent-1'} as any,
    });
    const voiceTask = new DummyTask(dummyContact, originalData);
    const hydrateHandler = jest.fn();

    voiceTask.stateMachineService?.send({
      type: TaskEvent.TASK_INCOMING,
      taskData: originalData,
    });
    voiceTask.stateMachineService?.send({type: TaskEvent.ASSIGN, taskData: originalData});
    const stateBeforeOwnerChange = voiceTask.stateMachineService?.getSnapshot().value;
    voiceTask.on(TASK_EVENTS.TASK_HYDRATE, hydrateHandler);

    const updatedData = createTaskData({
      interaction: {owner: 'agent-2'} as any,
    });
    voiceTask.sendStateMachineEvent({
      type: TaskEvent.CONTACT_OWNER_CHANGED,
      taskData: updatedData,
    });

    expect(voiceTask.data.interaction.owner).toBe('agent-2');
    expect(hydrateHandler).toHaveBeenCalledWith(voiceTask);
    expect(voiceTask.stateMachineService?.getSnapshot().value).toBe(stateBeforeOwnerChange);
  });

  it('synchronizes the roster from PARTICIPANT_LEAVE without an unrelated state transition', () => {
    const conferenceData = createTaskData({
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      interaction: {
        state: 'conference',
        owner: 'agent-1',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
          'agent-2': {id: 'agent-2', pType: 'Agent', hasLeft: false},
          'agent-3': {id: 'agent-3', pType: 'Agent', hasLeft: false},
          customer: {id: 'customer', pType: 'Customer', hasLeft: false},
        },
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            participants: ['agent-1', 'agent-2', 'agent-3', 'customer'],
            isHold: false,
          },
        },
      } as any,
    });
    const voiceTask = new ConferenceTask(dummyContact, conferenceData);
    const participantLeftHandler = jest.fn();

    voiceTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: conferenceData});
    voiceTask.sendStateMachineEvent({type: TaskEvent.ASSIGN, taskData: conferenceData});
    voiceTask.sendStateMachineEvent({type: TaskEvent.CONFERENCE_START, taskData: conferenceData});
    const conferenceState = voiceTask.stateMachineService?.getSnapshot().value;
    voiceTask.on(TASK_EVENTS.TASK_PARTICIPANT_LEFT, participantLeftHandler);

    const updatedData = createTaskData({
      ...conferenceData,
      participantId: 'agent-2',
      interaction: {
        ...conferenceData.interaction,
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
          'agent-3': {id: 'agent-3', pType: 'Agent', hasLeft: false},
          customer: {id: 'customer', pType: 'Customer', hasLeft: false},
        },
        media: {
          'interaction-1': {
            ...conferenceData.interaction.media['interaction-1'],
            participants: ['agent-1', 'agent-3', 'customer'],
          },
        },
      } as any,
    });

    voiceTask.sendStateMachineEvent({
      type: TaskEvent.PARTICIPANT_LEAVE,
      taskData: updatedData,
      participantId: 'agent-2',
    });

    expect(voiceTask.data.interaction.participants['agent-2']).toBeUndefined();
    expect(participantLeftHandler).toHaveBeenCalledWith(voiceTask);
    expect(voiceTask.stateMachineService?.getSnapshot().value).toBe(conferenceState);
  });

  it('keeps the conference participant controls after the customer leaves', () => {
    const conferenceData = createTaskData({
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      isConferenceInProgress: true,
      isConferencing: true,
      interaction: {
        state: 'conference',
        mediaType: 'telephony',
        owner: 'agent-1',
        interactionId: 'interaction-1',
        mainInteractionId: 'interaction-1',
        callProcessingDetails: {isConferencing: true},
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
          'agent-2': {id: 'agent-2', pType: 'Agent', hasLeft: false},
          customer: {id: 'customer', pType: 'Customer', hasLeft: false},
        },
        media: {
          'interaction-1': {
            mediaResourceId: 'interaction-1',
            mType: 'mainCall',
            participants: ['agent-1', 'agent-2', 'customer'],
            isHold: false,
          },
        },
      } as any,
    });
    const voiceTask = new ConferenceTask(dummyContact, conferenceData);
    const participantLeftHandler = jest.fn();
    const conferenceEndedHandler = jest.fn();

    voiceTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: conferenceData});
    voiceTask.sendStateMachineEvent({type: TaskEvent.ASSIGN, taskData: conferenceData});
    voiceTask.sendStateMachineEvent({type: TaskEvent.CONFERENCE_START, taskData: conferenceData});
    voiceTask.on(TASK_EVENTS.TASK_PARTICIPANT_LEFT, participantLeftHandler);
    voiceTask.on(TASK_EVENTS.TASK_CONFERENCE_ENDED, conferenceEndedHandler);

    const customerLeftData = createTaskData({
      ...conferenceData,
      participantId: 'customer',
      interaction: {
        ...conferenceData.interaction,
        participants: {
          'agent-1': {id: 'agent-1', pType: 'Agent', hasLeft: false},
          'agent-2': {id: 'agent-2', pType: 'Agent', hasLeft: false},
        },
        media: {
          'interaction-1': {
            ...conferenceData.interaction.media['interaction-1'],
            participants: ['agent-1', 'agent-2'],
          },
        },
      } as any,
    });

    voiceTask.sendStateMachineEvent({
      type: TaskEvent.PARTICIPANT_LEAVE,
      taskData: customerLeftData,
      participantId: 'customer',
    });

    expect(voiceTask.data.interaction.participants.customer).toBeUndefined();
    expect(voiceTask.data.interaction.participants['agent-2']).toBeDefined();
    expect(voiceTask.stateMachineService?.getSnapshot().value).toBe('CONFERENCING');
    expect(voiceTask.uiControls.main.exitConference).toEqual({
      isVisible: true,
      isEnabled: true,
    });
    expect(participantLeftHandler).toHaveBeenCalledWith(voiceTask);
    expect(conferenceEndedHandler).not.toHaveBeenCalled();
  });

  it('stopStateMachine clears state snapshot access', () => {
    const fullData = createTaskData();
    const voiceTask = new DummyTask(dummyContact, fullData);

    expect((voiceTask as any).getCurrentState()).toBeDefined();
    (voiceTask as any).stopStateMachine();
    expect((voiceTask as any).getCurrentState()).toBeUndefined();
  });

  it('auto-answers on offer when supported and flagged', async () => {
    const data = createTaskData({isAutoAnswering: true});
    const webrtcTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.WEBRTC});
    const autoAnsweredSpy = jest.fn();
    webrtcTask.on(TASK_EVENTS.TASK_AUTO_ANSWERED, autoAnsweredSpy);

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    webrtcTask.sendStateMachineEvent({
      type: TaskEvent.TASK_OFFERED,
      taskData: {...data, isAutoAnswering: true} as any,
    });

    await flushEventLoopTurn();
    expect(webrtcTask.acceptMock).toHaveBeenCalled();
    expect(autoAnsweredSpy).toHaveBeenCalledWith(webrtcTask);
  });

  it('does not auto-answer when isAutoAnswering is false', async () => {
    const data = createTaskData({isAutoAnswering: false});
    const webrtcTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.WEBRTC});

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushEventLoopTurn();
    expect(webrtcTask.acceptMock).not.toHaveBeenCalled();
  });

  it('does not auto-answer for voice tasks when variant is not WebRTC', async () => {
    const data = createTaskData({isAutoAnswering: true});
    const pstnTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.PSTN});

    pstnTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    pstnTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushEventLoopTurn();
    expect(pstnTask.acceptMock).not.toHaveBeenCalled();
  });

  it('clears isAutoAnswering when auto-answer fails', async () => {
    const data = createTaskData({isAutoAnswering: true});
    const webrtcTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.WEBRTC});
    webrtcTask.acceptMock.mockRejectedValue(new Error('fail'));

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushEventLoopTurn();
    expect(webrtcTask.data.isAutoAnswering).toBe(false);
  });

  it('emits task:cleanup (non-removal) on CONTACT_ENDED when wrap-up is required', () => {
    const cleanupSpy = jest.fn();
    const base = createTaskData({
      wrapUpRequired: true,
      interaction: {state: 'connected'},
    } as any);
    const webrtcTask = new SpyAcceptTask(dummyContact, base, {voiceVariant: VOICE_VARIANT.WEBRTC});
    webrtcTask.on(TASK_EVENTS.TASK_CLEANUP, cleanupSpy);

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: base});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: base});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.ASSIGN, taskData: base});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.CONTACT_ENDED, taskData: base});

    expect(cleanupSpy).toHaveBeenCalledWith(webrtcTask, {removeFromCollection: false});
  });

  it('emits task:cleanup (removal) when entering a final state', () => {
    const cleanupSpy = jest.fn();
    const base = createTaskData({wrapUpRequired: false});
    const webrtcTask = new SpyAcceptTask(dummyContact, base, {voiceVariant: VOICE_VARIANT.WEBRTC});
    webrtcTask.on(TASK_EVENTS.TASK_CLEANUP, cleanupSpy);

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: base});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.RONA, taskData: base, reason: 'RONA'} as any);

    expect(cleanupSpy).toHaveBeenCalledWith(webrtcTask, {removeFromCollection: true});
  });
});

describe('Task common methods', () => {
  let contact: any;
  let task: DummyTask;
  const taskData = {interactionId: '123', foo: 'bar', nested: {a: 1, b: 2}} as TaskData;

  beforeEach(() => {
    contact = {
      vteamTransfer: jest.fn().mockResolvedValue({result: 'vt'}),
      blindTransfer: jest.fn().mockResolvedValue({result: 'bt'}),
      end: jest.fn().mockResolvedValue({result: 'end'}),
      wrapup: jest.fn().mockResolvedValue({result: 'wrap'}),
    };
    task = new DummyTask(contact, taskData);
  });

  it('transfer uses blindTransfer for agent destinations', async () => {
    const payload = {to: 'dest', destinationType: DESTINATION_TYPE.AGENT} as any;
    const result = await task.transfer(payload);
    expect(contact.blindTransfer).toHaveBeenCalledWith({
      interactionId: taskData.interactionId,
      data: payload,
    });
    expect(result).toEqual({result: 'bt'});
  });

  it('transfer uses vteamTransfer for queue destinations', async () => {
    const payload = {to: 'queue1', destinationType: DESTINATION_TYPE.QUEUE} as any;
    const result = await task.transfer(payload);
    expect(contact.vteamTransfer).toHaveBeenCalledWith({
      interactionId: taskData.interactionId,
      data: payload,
    });
    expect(result).toEqual({result: 'vt'});
  });

  it('transfer uses vteamTransfer with the backend destination type for entry-point destinations', async () => {
    const payload: TransferPayLoad = {
      to: 'entry-point-1',
      destinationType: DESTINATION_TYPE.ENTRYPOINT,
    };
    const result = await task.transfer(payload);

    expect(contact.vteamTransfer).toHaveBeenCalledWith({
      interactionId: taskData.interactionId,
      data: {
        to: payload.to,
        destinationType: ENTRY_POINT_TRANSFER_DESTINATION_TYPE,
      },
    });
    expect(contact.blindTransfer).not.toHaveBeenCalled();
    expect(result).toEqual({result: 'vt'});
  });

  it('end invokes contact.end and returns its response', async () => {
    const result = await task.end();
    expect(contact.end).toHaveBeenCalledWith({
      interactionId: taskData.interactionId,
    });
    expect(result).toEqual({result: 'end'});
  });

  it('wrapup invokes contact.wrapup with proper args', async () => {
    const payload = {auxCodeId: 'code1', wrapUpReason: 'reason1'} as any;
    const result = await task.wrapup(payload);
    expect(contact.wrapup).toHaveBeenCalledWith({
      interactionId: taskData.interactionId,
      data: payload,
    });
    expect(result).toEqual({result: 'wrap'});
  });
});

describe('Task failure scenarios', () => {
  let contact: any;
  let task: DummyTask;
  const taskData = {interactionId: '123', foo: 'bar', nested: {a: 1, b: 2}} as TaskData;

  beforeEach(() => {
    contact = {
      vteamTransfer: jest.fn(),
      blindTransfer: jest.fn(),
      end: jest.fn(),
      wrapup: jest.fn(),
    };
    task = new DummyTask(contact, taskData);
  });

  it('transfer rejects when blindTransfer throws', async () => {
    const payload = {to: 'dest', destinationType: DESTINATION_TYPE.AGENT} as any;
    const err = new Error('Error while performing transfer');
    contact.blindTransfer.mockRejectedValue(err);

    await expect(task.transfer(payload)).rejects.toThrow('Error while performing transfer');
  });

  it('transfer rejects when vteamTransfer throws', async () => {
    const payload = {to: 'queue1', destinationType: DESTINATION_TYPE.QUEUE} as any;
    const err = new Error('Error while performing transfer');
    contact.vteamTransfer.mockRejectedValue(err);

    await expect(task.transfer(payload)).rejects.toThrow('Error while performing transfer');
  });

  it('end rejects when contact.end throws', async () => {
    const err = new Error('Error while performing end');
    contact.end.mockRejectedValue(err);

    await expect(task.end()).rejects.toThrow('Error while performing end');
  });

  it('wrapup throws when auxCodeId is missing', async () => {
    await expect(task.wrapup({auxCodeId: '', wrapUpReason: 'reason1'} as any)).rejects.toThrow(
      'Error while performing wrapup'
    );
  });

  it('wrapup throws when wrapUpReason is missing', async () => {
    await expect(task.wrapup({auxCodeId: 'code1', wrapUpReason: ''} as any)).rejects.toThrow(
      'Error while performing wrapup'
    );
  });

  it('wrapup rejects when contact.wrapup throws', async () => {
    const payload = {auxCodeId: 'code1', wrapUpReason: 'reason1'} as any;
    const err = new Error('Error while performing wrapup');
    contact.wrapup.mockRejectedValue(err);

    await expect(task.wrapup(payload)).rejects.toThrow('Error while performing wrapup');
  });
});

const createAISummaryTaskData = (overrides: Partial<TaskData> = {}): TaskData => {
  const {interaction: interactionOverrides, ...taskOverrides} = overrides;
  const interactionId = taskOverrides.interactionId ?? 'interaction-1';

  return createTaskData({
    taskId: 'task-owner-1',
    ...taskOverrides,
    interactionId,
    interaction: {
      interactionId,
      mainInteractionId: 'conversation-1',
      ...(interactionOverrides as Record<string, unknown> | undefined),
    },
  });
};

const createPostCallSummaryPayload = () => ({
  conversationId: 'conversation-1',
  summaryText: 'generated post-call summary',
  sections: {initialContactReason: 'billing'},
});

const createMidCallSummaryPayload = () => ({
  conversationId: 'conversation-1',
  summaryText: 'generated mid-call summary',
  sections: {reasonForTransferOrConsult: 'specialist'},
});

const createPostCallResponsePayloadWithoutTimestamps = (
  overrides: Partial<PostCallSummaryResponsePayload> = {}
): PostCallSummaryResponsePayload =>
  ({
    summary: {summarySectionKeySentinel: 'summary-section-value-sentinel'} as any,
    feedback: 'thumbs_up',
    state: 'DEFAULT',
    wrapUpCode: 'resolved',
    numberOfTimesViewed: 1,
    numberOfTimesEdited: 0,
    numberOfTimesCopied: 0,
    ...overrides,
  } as PostCallSummaryResponsePayload);

const createPostCallResponsePayload = (
  overrides: Partial<PostCallSummaryResponsePayload> = {}
): PostCallSummaryResponsePayload =>
  createPostCallResponsePayloadWithoutTimestamps({
    actionTimeStamp: 11,
    publishTimestamp: 12,
    ...overrides,
  });

const createMidCallResponsePayloadWithoutTimestamps = (
  overrides: Partial<MidCallSummaryResponsePayload> = {}
): MidCallSummaryResponsePayload =>
  ({
    summaryReceived: true,
    summary: {midCallSectionKeySentinel: 'mid-call-section-value-sentinel'} as any,
    feedback: 'none',
    state: 'DEFAULT',
    numberOfTimesViewed: 1,
    numberOfTimesEdited: 0,
    numberOfTimesCopied: 0,
    ...overrides,
  } as MidCallSummaryResponsePayload);

const createMidCallResponsePayload = (
  overrides: Partial<MidCallSummaryResponsePayload> = {}
): MidCallSummaryResponsePayload =>
  createMidCallResponsePayloadWithoutTimestamps({
    actionTimeStamp: 21,
    publishTimestamp: 22,
    ...overrides,
  });

const summaryRequestCases: Array<{
  label: string;
  invoke: (task: DummyTask) => Promise<any>;
  eventName: AIAssistantEventName;
  timeoutCode: string;
  createPayload: () => any;
}> = [
  {
    label: 'post-call',
    invoke: (task) => task.requestPostCallSummary(),
    eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY,
    timeoutCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT,
    createPayload: createPostCallSummaryPayload,
  },
  {
    label: 'consult mid-call',
    invoke: (task) => task.requestMidCallSummary('CONSULT'),
    eventName: AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY,
    timeoutCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT,
    createPayload: createMidCallSummaryPayload,
  },
  {
    label: 'transfer mid-call',
    invoke: (task) => task.requestMidCallSummary('TRANSFER'),
    eventName: AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY,
    timeoutCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT,
    createPayload: createMidCallSummaryPayload,
  },
];

describe('Task AI summary APIs', () => {
  const dummyContact = {} as any;

  const createSummaryMocks = (
    task: DummyTask,
    options: {
      postCallEnabled?: boolean;
      midCallEnabled?: boolean;
      wrapUpSummariesEnabled?: boolean;
      consultTransferSummariesEnabled?: boolean;
      registrationResult?: Promise<any>;
    } = {}
  ) => {
    const adapter = {
      sendSummaryGetEvent: jest.fn().mockResolvedValue(undefined),
      sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
    };
    const coordinator = {
      request: jest.fn(async ({sendRequest}: {sendRequest: () => Promise<unknown>}) => {
        await sendRequest();

        return options.registrationResult ?? Promise.resolve(createPostCallSummaryPayload());
      }),
      resolve: jest.fn(),
      cancel: jest.fn(),
      clear: jest.fn(),
      clearAll: jest.fn(),
    };
    const postCallEnabled = Object.prototype.hasOwnProperty.call(options, 'postCallEnabled')
      ? options.postCallEnabled
      : true;
    const midCallEnabled = Object.prototype.hasOwnProperty.call(options, 'midCallEnabled')
      ? options.midCallEnabled
      : true;
    const wrapUpSummariesEnabled = Object.prototype.hasOwnProperty.call(
      options,
      'wrapUpSummariesEnabled'
    )
      ? options.wrapUpSummariesEnabled
      : true;
    const consultTransferSummariesEnabled = Object.prototype.hasOwnProperty.call(
      options,
      'consultTransferSummariesEnabled'
    )
      ? options.consultTransferSummariesEnabled
      : true;

    const getFeatureEnablement = jest.fn(() => ({
      interactionId: 'interaction-1',
      postCallEnabled,
      midCallEnabled,
    }));
    const getGeneratedSummaryFlags = jest.fn(() => ({
      wrapUpSummariesEnabled,
      consultTransferSummariesEnabled,
    }));

    task.configureAISummary(
      adapter as any,
      coordinator as any,
      getGeneratedSummaryFlags,
      getFeatureEnablement
    );

    return {adapter, coordinator, getGeneratedSummaryFlags, getFeatureEnablement};
  };

  const createRealSummaryMocks = (task: DummyTask) => {
    const adapter = {
      sendSummaryGetEvent: jest.fn().mockResolvedValue(undefined),
      sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
    };
    const featureEnablement = {
      interactionId: 'interaction-1',
      postCallEnabled: true,
      midCallEnabled: true,
    };
    const coordinator = new RtdRequestResolver();
    const getFeatureEnablement = jest.fn(() => featureEnablement);
    const getGeneratedSummaryFlags = jest.fn(() => ({
      wrapUpSummariesEnabled: true,
      consultTransferSummariesEnabled: true,
    }));

    task.configureAISummary(
      adapter as any,
      coordinator,
      getGeneratedSummaryFlags,
      getFeatureEnablement
    );

    return {adapter, coordinator, getGeneratedSummaryFlags, getFeatureEnablement};
  };

  const spyOnAISummaryMetrics = (task: DummyTask) => {
    const metricsManager = (task as any).metricsManager;

    return {
      trackEvent: jest.spyOn(metricsManager, 'trackEvent').mockImplementation(() => undefined),
      timeEvent: jest.spyOn(metricsManager, 'timeEvent').mockImplementation(() => undefined),
    };
  };

  const getPendingRequest = (
    coordinator: RtdRequestResolver,
    eventType: 'POST_CALL_SUMMARY' | 'MID_CALL_SUMMARY',
    conversationId: string
  ) =>
    (coordinator as any).pendingRequests.get(JSON.stringify([eventType, conversationId]));

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('defines the exact AI summary operation metric names', () => {
    expect(METRIC_EVENT_NAMES).toMatchObject({
      AI_SUMMARY_GET_POST_CALL_SUCCESS: 'Post Call Summary Get Success',
      AI_SUMMARY_GET_POST_CALL_FAILED: 'Post Call Summary Get Failed',
      AI_SUMMARY_GET_MID_CALL_SUCCESS: 'Mid Call Summary Get Success',
      AI_SUMMARY_GET_MID_CALL_FAILED: 'Mid Call Summary Get Failed',
      AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS: 'Post Call Summary Response Success',
      AI_SUMMARY_POST_CALL_RESPONSE_FAILED: 'Post Call Summary Response Failed',
      AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS: 'Mid Call Summary Response Success',
      AI_SUMMARY_MID_CALL_RESPONSE_FAILED: 'Mid Call Summary Response Failed',
    });
  });

  it('requests a post-call summary through accepted registration, HTTP acknowledgement, and matching RTD result', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const postCallResult = createPostCallSummaryPayload();
    const {adapter, coordinator, getGeneratedSummaryFlags, getFeatureEnablement} =
      createSummaryMocks(task, {
        registrationResult: Promise.resolve(postCallResult),
      });

    await expect(task.requestPostCallSummary()).resolves.toBe(postCallResult);

    expect(getGeneratedSummaryFlags).toHaveBeenCalledTimes(1);
    expect(getFeatureEnablement).toHaveBeenCalledWith('interaction-1');
    expect(coordinator.request).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'task-owner-1',
        correlationId: 'conversation-1',
        eventType: 'POST_CALL_SUMMARY',
        timeoutMs: AI_SUMMARY_DURATION_MS,
      })
    );
    expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
      'agent-1',
      'interaction-1',
      'conversation-1',
      AIAssistantEventName.GET_POST_CALL_SUMMARY
    );
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
      expect.objectContaining({
        conversationId: 'conversation-1',
        interactionId: 'interaction-1',
        duration_ms: expect.any(Number),
      }),
      ['operational']
    );
    expect(metrics.timeEvent).not.toHaveBeenCalled();
  });

  it('maps consult and transfer mid-call summary requests to their exact outbound event names', async () => {
    const consultTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const consultMetrics = spyOnAISummaryMetrics(consultTask);
    const consultResult = createMidCallSummaryPayload();
    const consultMocks = createSummaryMocks(consultTask, {
      registrationResult: Promise.resolve(consultResult),
    });

    await expect(consultTask.requestMidCallSummary('CONSULT')).resolves.toBe(consultResult);

    expect(consultMocks.coordinator.request).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'task-owner-1',
        correlationId: 'conversation-1',
        eventType: 'MID_CALL_SUMMARY',
        timeoutMs: AI_SUMMARY_DURATION_MS,
      })
    );
    expect(consultMocks.adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
      'agent-1',
      'interaction-1',
      'conversation-1',
      AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY
    );
    expect(consultMetrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
      expect.objectContaining({
        operation: METHODS.REQUEST_MID_CALL_SUMMARY,
        actionType: 'CONSULT',
        conversationId: 'conversation-1',
        interactionId: 'interaction-1',
        duration_ms: expect.any(Number),
      }),
      ['operational']
    );

    const transferTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const transferResult = createMidCallSummaryPayload();
    const transferMocks = createSummaryMocks(transferTask, {
      registrationResult: Promise.resolve(transferResult),
    });

    await expect(transferTask.requestMidCallSummary('TRANSFER')).resolves.toBe(transferResult);
    expect(transferMocks.adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
      'agent-1',
      'interaction-1',
      'conversation-1',
      AIAssistantEventName.GET_MID_CALL_TRANSFER_SUMMARY
    );
  });

  it.each([
    {
      label: 'post-call registration first',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      inboundType: 'POST_CALL_SUMMARY' as const,
      timeoutCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT,
      eventName: AIAssistantEventName.GET_POST_CALL_SUMMARY,
      payload: createPostCallSummaryPayload(),
      successMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_SUCCESS,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
      settleFirst: 'result' as const,
    },
    {
      label: 'mid-call acknowledgement first',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      inboundType: 'MID_CALL_SUMMARY' as const,
      timeoutCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT,
      eventName: AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY,
      payload: createMidCallSummaryPayload(),
      successMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
      settleFirst: 'acknowledgement' as const,
    },
  ])(
    'sends the HTTP request and waits for both request branches on $label',
    async ({
      invoke,
      inboundType,
      timeoutCode,
      eventName,
      payload,
      successMetric,
      operation,
      actionType,
      settleFirst,
    }) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const metrics = spyOnAISummaryMetrics(task);
      const acknowledgement = createDeferred<void>();
      const result = createDeferred<any>();
      const {adapter, coordinator} = createSummaryMocks(task, {
        registrationResult: result.promise,
      });
      let publicSettled = false;

      adapter.sendSummaryGetEvent.mockReturnValueOnce(acknowledgement.promise);

      const publicRequest = invoke(task);

      publicRequest.then(
        () => {
          publicSettled = true;
        },
        () => {
          publicSettled = true;
        }
      );
      await Promise.resolve();

      expect(coordinator.request).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'task-owner-1',
          correlationId: 'conversation-1',
          eventType: inboundType,
          timeoutMs: AI_SUMMARY_DURATION_MS,
        })
      );
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
        'agent-1',
        'interaction-1',
        'conversation-1',
        eventName
      );
      expect(publicSettled).toBe(false);

      if (settleFirst === 'result') {
        result.resolve(payload);
        await Promise.resolve();
        expect(publicSettled).toBe(false);
        expect(metrics.trackEvent).not.toHaveBeenCalled();

        acknowledgement.resolve(undefined);
      } else {
        acknowledgement.resolve(undefined);
        await Promise.resolve();
        expect(publicSettled).toBe(false);
        expect(metrics.trackEvent).not.toHaveBeenCalled();

        result.resolve(payload);
      }

      await expect(publicRequest).resolves.toBe(payload);
      expect(metrics.trackEvent).toHaveBeenCalledTimes(1);
      expect(metrics.trackEvent).toHaveBeenCalledWith(
        successMetric,
        expect.objectContaining({
          operation,
          ...(actionType ? {actionType} : {}),
          conversationId: 'conversation-1',
          interactionId: 'interaction-1',
          duration_ms: expect.any(Number),
        }),
        ['operational']
      );
      expect(metrics.timeEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: 'post-call organization false',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      options: {wrapUpSummariesEnabled: false, postCallEnabled: true},
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
    },
    {
      label: 'post-call organization undefined',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      options: {wrapUpSummariesEnabled: undefined, postCallEnabled: true},
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
    },
    {
      label: 'post-call interaction false',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      options: {wrapUpSummariesEnabled: true, postCallEnabled: false},
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
    },
    {
      label: 'post-call interaction undefined',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      options: {wrapUpSummariesEnabled: true, postCallEnabled: undefined},
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
    },
    {
      label: 'mid-call organization false',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      options: {consultTransferSummariesEnabled: false, midCallEnabled: true},
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
    },
    {
      label: 'mid-call organization undefined',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      options: {consultTransferSummariesEnabled: undefined, midCallEnabled: true},
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
    },
    {
      label: 'mid-call interaction false',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      options: {consultTransferSummariesEnabled: true, midCallEnabled: false},
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
    },
    {
      label: 'mid-call interaction undefined',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      options: {consultTransferSummariesEnabled: true, midCallEnabled: undefined},
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
    },
  ])(
    'rejects disabled $label summary requests before registration or HTTP',
    async ({invoke, options, disabledCode, failureMetric, operation, actionType}) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const metrics = spyOnAISummaryMetrics(task);
      const {adapter, coordinator} = createSummaryMocks(task, options);

      await expect(invoke(task)).rejects.toMatchObject(
        createAISummaryErrorExpectation(disabledCode)
      );
      expect(coordinator.request).not.toHaveBeenCalled();
      expect(adapter.sendSummaryGetEvent).not.toHaveBeenCalled();
      expect(metrics.trackEvent).toHaveBeenCalledTimes(1);
      expect(metrics.trackEvent).toHaveBeenCalledWith(
        failureMetric,
        expect.objectContaining({
          operation,
          ...(actionType ? {actionType} : {}),
          failureCode: disabledCode,
          duration_ms: expect.any(Number),
        }),
        ['operational']
      );
      expect(metrics.timeEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: 'post-call',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      featureEnablement: {postCallEnabled: false, midCallEnabled: true},
    },
    {
      label: 'mid-call',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      featureEnablement: {postCallEnabled: true, midCallEnabled: false},
    },
  ])(
    'uses the top-level interaction feature key only for $label requests',
    async ({invoke, disabledCode, featureEnablement}) => {
      const task = new DummyTask(
        dummyContact,
        createAISummaryTaskData({
          interactionId: 'child-interaction-1',
          interaction: {mainInteractionId: 'conversation-1'} as any,
        })
      );
      const {adapter, coordinator, getFeatureEnablement} = createSummaryMocks(task);

      getFeatureEnablement.mockImplementation((interactionId) => ({
        interactionId,
        ...featureEnablement,
      }));

      await expect(invoke(task)).rejects.toMatchObject(
        createAISummaryErrorExpectation(disabledCode)
      );
      expect(getFeatureEnablement).toHaveBeenCalledWith('child-interaction-1');
      expect(getFeatureEnablement).not.toHaveBeenCalledWith('conversation-1');
      expect(coordinator.request).not.toHaveBeenCalled();
      expect(adapter.sendSummaryGetEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: 'post-call organization false',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      inboundType: 'POST_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: false, consultTransferSummariesEnabled: true},
      featureEnablement: {interactionId: 'interaction-1', postCallEnabled: true},
    },
    {
      label: 'post-call raw undefined interaction flag',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      inboundType: 'POST_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true},
    },
    {
      label: 'post-call mainInteractionId mismatch',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      inboundType: 'POST_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true},
      taskData: createAISummaryTaskData({
        interactionId: 'child-interaction-1',
        interaction: {mainInteractionId: 'conversation-1'} as any,
      }),
      featureEnablement: {interactionId: 'conversation-1', postCallEnabled: true},
    },
    {
      label: 'mid-call organization false',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      inboundType: 'MID_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: false},
      featureEnablement: {interactionId: 'interaction-1', midCallEnabled: true},
    },
    {
      label: 'mid-call raw undefined interaction flag',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      inboundType: 'MID_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true},
    },
    {
      label: 'mid-call mainInteractionId mismatch',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      inboundType: 'MID_CALL_SUMMARY' as const,
      disabledCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_DISABLED,
      flags: {wrapUpSummariesEnabled: true, consultTransferSummariesEnabled: true},
      taskData: createAISummaryTaskData({
        interactionId: 'child-interaction-1',
        interaction: {mainInteractionId: 'conversation-1'} as any,
      }),
      featureEnablement: {interactionId: 'conversation-1', midCallEnabled: true},
    },
  ])(
    'leaves the real coordinator idle when $label disables a request',
    async ({invoke, inboundType, disabledCode, flags, taskData, featureEnablement}) => {
      jest.useFakeTimers();
      const task = new DummyTask(dummyContact, taskData ?? createAISummaryTaskData());
      const adapter = {
        sendSummaryGetEvent: jest.fn().mockResolvedValue(undefined),
        sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
      };
      const coordinator = new RtdRequestResolver();
      const registerSpy = jest.spyOn(coordinator, 'request');
      const getGeneratedSummaryFlags = jest.fn(() => flags);

      task.configureAISummary(
        adapter as any,
        coordinator,
        getGeneratedSummaryFlags,
        (interactionId) =>
          featureEnablement?.interactionId === interactionId ? featureEnablement : undefined
      );

      await expect(invoke(task)).rejects.toMatchObject(
        createAISummaryErrorExpectation(disabledCode)
      );
      expect(registerSpy).not.toHaveBeenCalled();
      expect(adapter.sendSummaryGetEvent).not.toHaveBeenCalled();
      expect(getPendingRequest(coordinator, inboundType, 'conversation-1')).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it('calls the injected generated-summary accessor on each request so live config changes are observed', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const firstFlags = {
      wrapUpSummariesEnabled: false,
      consultTransferSummariesEnabled: true,
    };
    const secondFlags = {
      wrapUpSummariesEnabled: true,
      consultTransferSummariesEnabled: true,
    };
    let generatedSummaryFlags = firstFlags;
    const adapter = {
      sendSummaryGetEvent: jest.fn().mockResolvedValue(undefined),
      sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
    };
    const featureEnablement = {interactionId: 'interaction-1', postCallEnabled: true};
    const coordinator = new RtdRequestResolver();
    const getGeneratedSummaryFlags = jest.fn(() => generatedSummaryFlags);

    task.configureAISummary(
      adapter as any,
      coordinator,
      getGeneratedSummaryFlags,
      (interactionId) =>
        featureEnablement.interactionId === interactionId ? featureEnablement : undefined
    );

    await expect(task.requestPostCallSummary()).rejects.toMatchObject(
      createAISummaryErrorExpectation(AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED)
    );
    expect(adapter.sendSummaryGetEvent).not.toHaveBeenCalled();

    generatedSummaryFlags = secondFlags;
    const request = task.requestPostCallSummary();

    await Promise.resolve();
    expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);
    expect(
      coordinator.resolve('POST_CALL_SUMMARY', 'conversation-1', createPostCallSummaryPayload())
    ).toBe('resolved');
    await expect(request).resolves.toEqual(createPostCallSummaryPayload());
    expect(getGeneratedSummaryFlags).toHaveBeenCalledTimes(2);
  });

  it('cleans up only the accepted request token when the request acknowledgement rejects', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const neverSettlingResult = createDeferred<any>();
    const {adapter, coordinator} = createSummaryMocks(task, {
      registrationResult: neverSettlingResult.promise,
    });
    const baseUrlError = createAISummaryError(
      AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
    );

    adapter.sendSummaryGetEvent.mockRejectedValue(baseUrlError);

    await expect(task.requestPostCallSummary()).rejects.toBe(baseUrlError);
    expect(coordinator.request).toHaveBeenCalled();
  });

  it.each([
    {
      label: 'base URL unavailable',
      error: createAISummaryError(AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE),
    },
    {
      label: 'HTTP status/network failure',
      error: createAISummaryError(AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED),
    },
    {
      label: 'transport timeout',
      error: createAISummaryError(AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT),
    },
  ])(
    'clears the exact real pending entry and timer without settling the RTD result on $label',
    async ({error}) => {
      jest.useFakeTimers();
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const adapter = {
        sendSummaryGetEvent: jest.fn(),
        sendSummaryResponseEvent: jest.fn().mockResolvedValue(undefined),
      };
    const coordinator = new RtdRequestResolver();
      const requestSpy = jest.spyOn(coordinator, 'request');
      const resultObserver = jest.fn();
      let requestToken: symbol | undefined;
      let requestOptions: any;

      task.configureAISummary(
        adapter as any,
        coordinator,
        jest.fn(() => ({
          wrapUpSummariesEnabled: true,
          consultTransferSummariesEnabled: true,
        })),
        () => ({interactionId: 'interaction-1', postCallEnabled: true})
      );
      adapter.sendSummaryGetEvent.mockImplementation(async () => {
        requestOptions = requestSpy.mock.calls[0][0];
        const pendingEntry = getPendingRequest(coordinator, 'POST_CALL_SUMMARY', 'conversation-1');

        requestToken = (pendingEntry as any)?.requestToken;
        expect(requestToken).toEqual(expect.any(Symbol));
        const pendingResult = (pendingEntry as any)?.result;
        pendingResult?.then(resultObserver, resultObserver);
        expect(pendingEntry?.ownerId).toBe('task-owner-1');
        expect(pendingEntry?.requestToken).toBe(requestToken);
        expect(pendingEntry?.timeoutId).toBeDefined();
        expect(jest.getTimerCount()).toBe(1);

        throw error;
      });

      const publicRequest = task.requestPostCallSummary();

      await expect(publicRequest).rejects.toBe(error);
      expect(requestToken).toEqual(expect.any(Symbol));
      expect(requestOptions).toEqual(
        expect.objectContaining({
          ownerId: 'task-owner-1',
          correlationId: 'conversation-1',
          eventType: 'POST_CALL_SUMMARY',
        })
      );
      expect(getPendingRequest(coordinator, 'POST_CALL_SUMMARY', 'conversation-1')).toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
      await Promise.resolve();
      expect(resultObserver).not.toHaveBeenCalled();
      expect(
        coordinator.resolve('POST_CALL_SUMMARY', 'conversation-1', createPostCallSummaryPayload())
      ).toBe('not-found');
    }
  );

  it('HTTP status/network rejection without a consumer handler', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const neverSettlingResult = createDeferred<any>();
    const {adapter, coordinator} = createSummaryMocks(task, {
      registrationResult: neverSettlingResult.promise,
    });
    const transportError = createAISummaryError(
      AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
    );
    const unhandledRejections: unknown[] = [];
    const listener = jest.fn((reason) => {
      unhandledRejections.push(reason);
    });

    process.on('unhandledRejection', listener);
    try {
      adapter.sendSummaryGetEvent.mockRejectedValue(transportError);

      const publicRequest = task.requestPostCallSummary();

      await flushEventLoopTurn();

      expect(listener).not.toHaveBeenCalled();
      expect(unhandledRejections).toHaveLength(0);
      await expect(publicRequest).rejects.toBe(transportError);
      expect(coordinator.request).toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('keeps same-conversation CONSULT and TRANSFER overlap isolated through the real coordinator slot', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const {adapter, coordinator} = createRealSummaryMocks(task);
    const midCallResult = createMidCallSummaryPayload();
    let consultSettled = false;

    try {
      const consultRequest = task.requestMidCallSummary('CONSULT');

      consultRequest.then(
        () => {
          consultSettled = true;
        },
        () => {
          consultSettled = true;
        }
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
        'agent-1',
        'interaction-1',
        'conversation-1',
        AIAssistantEventName.GET_MID_CALL_CONSULT_SUMMARY
      );
      expect(metrics.trackEvent).not.toHaveBeenCalled();
      expect(consultSettled).toBe(false);
      const firstPendingEntry = getPendingRequest(
        coordinator,
        'MID_CALL_SUMMARY',
        'conversation-1'
      );
      const firstTimeoutId = firstPendingEntry?.timeoutId;

      expect(firstPendingEntry?.ownerId).toBe('task-owner-1');
      expect(firstPendingEntry?.requestToken).toEqual(expect.any(Symbol));
      expect(firstTimeoutId).toBeDefined();
      expect(jest.getTimerCount()).toBe(1);

      jest.advanceTimersByTime(100);

      const transferRequest = task.requestMidCallSummary('TRANSFER');

      jest.advanceTimersByTime(15);

      await expect(transferRequest).rejects.toMatchObject(
        createAISummaryErrorExpectation(AI_SUMMARY_ERROR_CODES.AI_SUMMARY_REQUEST_ALREADY_PENDING)
      );

      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);
      expect(getPendingRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')).toBe(
        firstPendingEntry
      );
      expect(getPendingRequest(coordinator, 'MID_CALL_SUMMARY', 'conversation-1')?.timeoutId).toBe(
        firstTimeoutId
      );
      expect(jest.getTimerCount()).toBe(1);
      expect(metrics.trackEvent).toHaveBeenCalledTimes(1);
      expect(metrics.trackEvent).toHaveBeenNthCalledWith(
        1,
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
        expect.objectContaining({
          operation: METHODS.REQUEST_MID_CALL_SUMMARY,
          actionType: 'TRANSFER',
          conversationId: 'conversation-1',
          interactionId: 'interaction-1',
          failureCode: AI_SUMMARY_ERROR_CODES.AI_SUMMARY_REQUEST_ALREADY_PENDING,
          duration_ms: 15,
        }),
        ['operational']
      );
      expect(consultSettled).toBe(false);

      jest.advanceTimersByTime(85);

      expect(
        coordinator.resolve('MID_CALL_SUMMARY', 'conversation-1', midCallResult)
      ).toBe('resolved');
      await expect(consultRequest).resolves.toBe(midCallResult);

      expect(metrics.trackEvent).toHaveBeenCalledTimes(2);
      expect(metrics.trackEvent).toHaveBeenNthCalledWith(
        2,
        METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_SUCCESS,
        expect.objectContaining({
          operation: METHODS.REQUEST_MID_CALL_SUMMARY,
          actionType: 'CONSULT',
          conversationId: 'conversation-1',
          interactionId: 'interaction-1',
          duration_ms: 200,
        }),
        ['operational']
      );
      expect(metrics.trackEvent.mock.invocationCallOrder[0]).toBeLessThan(
        metrics.trackEvent.mock.invocationCallOrder[1]
      );
      expect(metrics.timeEvent).not.toHaveBeenCalled();
    } finally {
      coordinator.clearAll();
      jest.useRealTimers();
    }
  });

  it.each(summaryRequestCases.map((testCase) => [testCase.label, testCase] as const))(
    '%s request sends one outbound adapter invocation when it later fails from inbound timeout',
    async (_label, {invoke, eventName, timeoutCode}) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const timeoutResult = createDeferred<any>();
      const {adapter} = createSummaryMocks(task, {registrationResult: timeoutResult.promise});

      const timedOutRequest = invoke(task);
      await flushEventLoopTurn();

      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
        'agent-1',
        'interaction-1',
        'conversation-1',
        eventName
      );

      timeoutResult.reject(createAISummaryError(timeoutCode));

      await expect(timedOutRequest).rejects.toMatchObject({
        message: timeoutCode,
        data: {errorCode: timeoutCode},
      });
    }
  );

  it.each([
    {
      label: 'post-call',
      invoke: (task: DummyTask) => task.requestPostCallSummary(),
      inboundType: 'POST_CALL_SUMMARY' as const,
      timeoutCode: AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_POST_CALL_FAILED,
      operation: METHODS.REQUEST_POST_CALL_SUMMARY,
      latePayload: createPostCallSummaryPayload(),
    },
    {
      label: 'mid-call',
      invoke: (task: DummyTask) => task.requestMidCallSummary('CONSULT'),
      inboundType: 'MID_CALL_SUMMARY' as const,
      timeoutCode: AI_SUMMARY_ERROR_CODES.MID_CALL_SUMMARY_TIMEOUT,
      failureMetric: METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      operation: METHODS.REQUEST_MID_CALL_SUMMARY,
      actionType: 'CONSULT',
      latePayload: createMidCallSummaryPayload(),
    },
  ])(
    'rejects $label public requests at AI_SUMMARY_DURATION_MS and drops late events',
    async ({
      invoke,
      inboundType,
      timeoutCode,
      failureMetric,
      operation,
      actionType,
      latePayload,
    }) => {
      jest.useFakeTimers();
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const metrics = spyOnAISummaryMetrics(task);
      const {adapter, coordinator} = createRealSummaryMocks(task);
      let settled = false;

      try {
        const publicRequest = invoke(task);

        publicRequest.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          }
        );

        await Promise.resolve();
        expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS - 1);
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(metrics.trackEvent).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await Promise.resolve();
        jest.useRealTimers();
        await flushEventLoopTurn();

        const timeoutError = await publicRequest.catch((error) => error);

        expect(timeoutError).toMatchObject(createAISummaryErrorExpectation(timeoutCode));
        expect(
          coordinator.resolve(inboundType, 'conversation-1', latePayload as any)
        ).toBe('not-found');
        await expect(publicRequest).rejects.toBe(timeoutError);
        expect(metrics.trackEvent).toHaveBeenCalledTimes(1);
        expect(metrics.trackEvent).toHaveBeenCalledWith(
          failureMetric,
          expect.objectContaining({
            operation,
            ...(actionType ? {actionType} : {}),
            failureCode: timeoutCode,
            duration_ms: expect.any(Number),
          }),
          ['operational']
        );
        expect(metrics.timeEvent).not.toHaveBeenCalled();
      } finally {
        coordinator.clearAll();
        jest.useRealTimers();
      }
    }
  );

  it('AI_SUMMARY_DURATION_MS rejection without a consumer handler', async () => {
    jest.useFakeTimers();
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter, coordinator} = createRealSummaryMocks(task);
    const unhandledRejections: unknown[] = [];
    const listener = jest.fn((reason) => {
      unhandledRejections.push(reason);
    });

    process.on('unhandledRejection', listener);
    try {
      const publicRequest = task.requestPostCallSummary();

      await Promise.resolve();
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(AI_SUMMARY_DURATION_MS);
      jest.useRealTimers();
      await flushEventLoopTurn();

      expect(listener).not.toHaveBeenCalled();
      expect(unhandledRejections).toHaveLength(0);

      const timeoutError = await publicRequest.catch((error) => error);

      expect(timeoutError).toMatchObject(
        createAISummaryErrorExpectation(AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_TIMEOUT)
      );
      expect(
        coordinator.resolve('POST_CALL_SUMMARY', 'conversation-1', createPostCallSummaryPayload())
      ).toBe('not-found');
      await expect(publicRequest).rejects.toBe(timeoutError);
    } finally {
      process.off('unhandledRejection', listener);
      coordinator.clearAll();
      jest.useRealTimers();
    }
  });

  it.each(summaryRequestCases.map((testCase) => [testCase.label, testCase] as const))(
    'issues a fresh second adapter call when %s request is invoked again after settlement',
    async (_label, {invoke, eventName, createPayload}) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const firstPayload = createPayload();
      const secondPayload = createPayload();
      const {adapter, coordinator} = createSummaryMocks(task);

      expect(firstPayload).not.toBe(secondPayload);
      coordinator.request
        .mockImplementationOnce(async ({sendRequest}: {sendRequest: () => Promise<unknown>}) => {
          await sendRequest();

          return firstPayload;
        })
        .mockImplementationOnce(async ({sendRequest}: {sendRequest: () => Promise<unknown>}) => {
          await sendRequest();

          return secondPayload;
        });

      await expect(invoke(task)).resolves.toBe(firstPayload);
      await expect(invoke(task)).resolves.toBe(secondPayload);

      expect(coordinator.request).toHaveBeenCalledTimes(2);
      expect(adapter.sendSummaryGetEvent).toHaveBeenCalledTimes(2);
      expect(adapter.sendSummaryGetEvent).toHaveBeenNthCalledWith(
        1,
        'agent-1',
        'interaction-1',
        'conversation-1',
        eventName
      );
      expect(adapter.sendSummaryGetEvent).toHaveBeenNthCalledWith(
        2,
        'agent-1',
        'interaction-1',
        'conversation-1',
        eventName
      );
    }
  );

  it('owner-task cleanup rejection without a consumer handler', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {coordinator} = createRealSummaryMocks(task);
    const unhandledRejections: unknown[] = [];
    const listener = jest.fn((reason) => {
      unhandledRejections.push(reason);
    });

    process.on('unhandledRejection', listener);
    try {
      const publicRequest = task.requestMidCallSummary('CONSULT');

      await Promise.resolve();
      coordinator.clear('task-owner-1', 'conversation-1');
      await flushEventLoopTurn();

      expect(listener).not.toHaveBeenCalled();
      expect(unhandledRejections).toHaveLength(0);
      await expect(publicRequest).rejects.toMatchObject({
        message: AI_SUMMARY_REQUEST_CANCELLED,
        data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
      });
    } finally {
      process.off('unhandledRejection', listener);
      coordinator.clearAll();
    }
  });

  it('settles public request promises when coordinator rejects owner cleanup results', async () => {
    const cleanupTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const cleanupResult = createDeferred<any>();

    createSummaryMocks(cleanupTask, {registrationResult: cleanupResult.promise});

    const cancelledRequest = cleanupTask.requestMidCallSummary('CONSULT');
    await flushEventLoopTurn();
    cleanupResult.reject(createAISummaryError(AI_SUMMARY_REQUEST_CANCELLED));

    await expect(cancelledRequest).rejects.toMatchObject({
      message: AI_SUMMARY_REQUEST_CANCELLED,
      data: {errorCode: AI_SUMMARY_REQUEST_CANCELLED},
    });
  });

  it('serializes post-call responses from retained request context after TaskManager cleanup state is gone', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const taskRegistry: Record<string, DummyTask> = {'interaction-1': task};
    const metrics = spyOnAISummaryMetrics(task);
    const postCallResult = createPostCallSummaryPayload();
    const {adapter, coordinator, getGeneratedSummaryFlags, getFeatureEnablement} =
      createRealSummaryMocks(task);

    const postCallRequest = task.requestPostCallSummary();
    await flushEventLoopTurn();

    expect(adapter.sendSummaryGetEvent).toHaveBeenCalledWith(
      'agent-1',
      'interaction-1',
      'conversation-1',
      AIAssistantEventName.GET_POST_CALL_SUMMARY
    );
    expect(
      coordinator.resolve('POST_CALL_SUMMARY', 'conversation-1', postCallResult)
    ).toBe('resolved');
    await expect(postCallRequest).resolves.toBe(postCallResult);
    expect(getGeneratedSummaryFlags).toHaveBeenCalledTimes(1);
    expect(getFeatureEnablement).toHaveBeenCalledTimes(1);

    delete taskRegistry['interaction-1'];
    coordinator.clear('task-owner-1', 'conversation-1');
    task.updateTaskData(
      createAISummaryTaskData({
        interactionId: 'current-interaction',
        interaction: {mainInteractionId: 'current-conversation'} as any,
      }),
      true
    );
    const correlationCallsAfterRequest = (getAISummaryCorrelation as jest.Mock).mock.calls.length;

    const responsePayload = createPostCallResponsePayload({
      summary: {humanAuthoredSectionKeySentinel: 'human-authored-section-value-sentinel'} as any,
    });

    await expect(task.sendPostCallSummaryResponse(responsePayload)).resolves.toBeUndefined();

    expect(taskRegistry['interaction-1']).toBeUndefined();
    expect(getGeneratedSummaryFlags).toHaveBeenCalledTimes(1);
    expect(getFeatureEnablement).toHaveBeenCalledTimes(1);
    expect(getAISummaryCorrelation).toHaveBeenCalledTimes(correlationCallsAfterRequest);
    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
    expect(adapter.sendSummaryResponseEvent.mock.calls[0][1]).toStrictEqual({
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      conversationId: 'conversation-1',
      eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      summary: {humanAuthoredSectionKeySentinel: 'human-authored-section-value-sentinel'},
      feedback: 'thumbs_up',
      wrapUpCode: 'resolved',
      actionTimeStamp: 11,
      publishTimestamp: 12,
      numberOfTimesViewed: 1,
      numberOfTimesEdited: 0,
      numberOfTimesCopied: 0,
      state: 'DEFAULT',
    });
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS,
      expect.objectContaining({
        operation: METHODS.SEND_POST_CALL_SUMMARY_RESPONSE,
        conversationId: 'conversation-1',
        interactionId: 'interaction-1',
        duration_ms: expect.any(Number),
      }),
      ['operational']
    );
    expect(JSON.stringify(metrics.trackEvent.mock.calls)).not.toContain(
      'humanAuthoredSectionKeySentinel'
    );
    expect(JSON.stringify(metrics.trackEvent.mock.calls)).not.toContain(
      'human-authored-section-value-sentinel'
    );
    expect(metrics.timeEvent).not.toHaveBeenCalled();
  });

  it('does not reject an accepted post-call response when success telemetry fails', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const {adapter} = createSummaryMocks(task);

    metrics.trackEvent.mockImplementationOnce(() => {
      throw new Error('metrics unavailable');
    });

    await expect(
      task.sendPostCallSummaryResponse(createPostCallResponsePayload())
    ).resolves.toBeUndefined();
    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
  });

  it('uses current correlation for direct post-call responses that have no retained request context', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(
      task.sendPostCallSummaryResponse(createPostCallResponsePayload())
    ).resolves.toBeUndefined();

    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      })
    );
  });

  it('does not retain correlation when a post-call summary request fails', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);
    const requestError = createAISummaryError(
      AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
    );

    adapter.sendSummaryGetEvent.mockRejectedValueOnce(requestError);

    await expect(task.requestPostCallSummary()).rejects.toBe(requestError);

    task.updateTaskData(
      createAISummaryTaskData({
        interactionId: 'current-interaction',
        interaction: {mainInteractionId: 'current-conversation'} as any,
      }),
      true
    );

    await expect(
      task.sendPostCallSummaryResponse(createPostCallResponsePayload())
    ).resolves.toBeUndefined();
    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        interactionId: 'current-interaction',
        conversationId: 'current-conversation',
      })
    );
  });

  it.each([
    {
      label: 'post-call',
      invoke: (task: DummyTask) =>
        task.sendPostCallSummaryResponse(
          createPostCallResponsePayload({
            summary: 'Caller reported a billing discrepancy.',
            numberOfTimesViewed: 2,
            numberOfTimesEdited: 1,
            numberOfTimesCopied: 3,
          })
        ),
      expected: {
        agentId: 'agent-1',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        summary: 'Caller reported a billing discrepancy.',
        feedback: 'thumbs_up',
        wrapUpCode: 'resolved',
        actionTimeStamp: 11,
        publishTimestamp: 12,
        numberOfTimesViewed: 2,
        numberOfTimesEdited: 1,
        numberOfTimesCopied: 3,
        state: 'DEFAULT',
      },
    },
    {
      label: 'mid-call',
      invoke: (task: DummyTask) =>
        task.sendMidCallSummaryResponse(
          createMidCallResponsePayload({
            summary: 'Caller reported a billing discrepancy.',
            numberOfTimesViewed: 2,
            numberOfTimesEdited: 1,
            numberOfTimesCopied: 3,
          }),
          'TRANSFER'
        ),
      expected: {
        agentId: 'agent-1',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
        summary: 'Caller reported a billing discrepancy.',
        feedback: 'none',
        agentName: 'Receiving Agent',
        actionTimeStamp: 21,
        publishTimestamp: 22,
        numberOfTimesViewed: 2,
        numberOfTimesEdited: 1,
        numberOfTimesCopied: 3,
        state: 'DEFAULT',
      },
    },
  ])('forwards $label plain-text response summaries unchanged', async ({invoke, expected}) => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(invoke(task)).resolves.toBeUndefined();

    expect(adapter.sendSummaryResponseEvent.mock.calls[0][1]).toStrictEqual(expected);
  });

  it.each([
    {
      label: 'post-call',
      invoke: (task: DummyTask) =>
        task.sendPostCallSummaryResponse(createPostCallResponsePayloadWithoutTimestamps()),
      expected: {
        agentId: 'agent-1',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
        summary: {summarySectionKeySentinel: 'summary-section-value-sentinel'},
        feedback: 'thumbs_up',
        wrapUpCode: 'resolved',
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        state: 'DEFAULT',
      },
    },
    {
      label: 'mid-call',
      invoke: (task: DummyTask) =>
        task.sendMidCallSummaryResponse(createMidCallResponsePayloadWithoutTimestamps(), 'CONSULT'),
      expected: {
        agentId: 'agent-1',
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
        summary: {midCallSectionKeySentinel: 'mid-call-section-value-sentinel'},
        feedback: 'none',
        agentName: 'Receiving Agent',
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
        state: 'DEFAULT',
      },
    },
  ])('omits absent timestamp keys from $label response transport', async ({invoke, expected}) => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(invoke(task)).resolves.toBeUndefined();

    const transportPayload = adapter.sendSummaryResponseEvent.mock.calls[0][1];

    expect(adapter.sendSummaryResponseEvent.mock.calls[0][1]).toStrictEqual(expected);
    expect(Object.prototype.hasOwnProperty.call(transportPayload, 'actionTimeStamp')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(transportPayload, 'publishTimestamp')).toBe(false);
  });

  it('sends the exact post-call NOT_RECEIVED response transport payload', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(
      task.sendPostCallSummaryResponse(
        createPostCallResponsePayload({
          summary: '',
          feedback: 'none',
          state: 'NOT_RECEIVED',
          wrapUpCode: 'resolved',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
          actionTimeStamp: 31,
          publishTimestamp: 32,
        })
      )
    ).resolves.toBeUndefined();

    expect(adapter.sendSummaryResponseEvent.mock.calls[0][1]).toStrictEqual({
      agentId: 'agent-1',
      interactionId: 'interaction-1',
      conversationId: 'conversation-1',
      eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      summary: '',
      feedback: 'none',
      wrapUpCode: 'resolved',
      actionTimeStamp: 31,
      publishTimestamp: 32,
      numberOfTimesViewed: 0,
      numberOfTimesEdited: 0,
      numberOfTimesCopied: 0,
      state: 'NOT_RECEIVED',
    });
  });

  it.each([
    ['non-empty summary', {summary: 'summary unexpectedly arrived'}],
    ['nonzero numberOfTimesViewed', {numberOfTimesViewed: 1}],
    ['nonzero numberOfTimesEdited', {numberOfTimesEdited: 1}],
    ['nonzero numberOfTimesCopied', {numberOfTimesCopied: 1}],
  ] as const)(
    'rejects post-call NOT_RECEIVED responses with %s before transport',
    async (_label, overrides) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const {adapter} = createSummaryMocks(task);

      await expect(
        task.sendPostCallSummaryResponse(
          createPostCallResponsePayload({
            summary: '',
            feedback: 'none',
            state: 'NOT_RECEIVED',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
            ...overrides,
          } as any)
        )
      ).rejects.toMatchObject(
        createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD')
      );
      expect(adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
    }
  );

  it('serializes mid-call response branches without transport-only invalid fields', async () => {
    const consultTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const consultMetrics = spyOnAISummaryMetrics(consultTask);
    const consultMocks = createSummaryMocks(consultTask);

    await expect(
      consultTask.sendMidCallSummaryResponse(
        createMidCallResponsePayload({
          state: 'MID_CALL_CANCELLED',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        }),
        'CONSULT'
      )
    ).resolves.toBeUndefined();

    const consultPayload = consultMocks.adapter.sendSummaryResponseEvent.mock.calls[0][1];

    expect(consultPayload).toMatchObject({
      eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
      interactionId: 'interaction-1',
      conversationId: 'conversation-1',
      agentName: 'Receiving Agent',
      numberOfTimesViewed: 0,
      actionTimeStamp: 21,
      publishTimestamp: 22,
    });
    expect(consultPayload).not.toHaveProperty('summaryReceived');
    expect(consultPayload).not.toHaveProperty('wrapUpCode');
    expect(consultMetrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS,
      expect.objectContaining({
        operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
        actionType: 'CONSULT',
        conversationId: 'conversation-1',
        interactionId: 'interaction-1',
        duration_ms: expect.any(Number),
      }),
      ['operational']
    );

    const transferTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const transferMocks = createSummaryMocks(transferTask);

    await expect(
      transferTask.sendMidCallSummaryResponse(
        createMidCallResponsePayload({
          summaryReceived: false,
          summary: '',
          feedback: 'none',
          state: 'NOT_RECEIVED',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        }),
        'TRANSFER'
      )
    ).resolves.toBeUndefined();

    expect(transferMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
        interactionId: 'interaction-1',
        conversationId: 'conversation-1',
        summary: '',
        numberOfTimesViewed: 0,
      })
    );
  });

  it.each([
    {
      label: 'post-call received',
      invoke: (task: DummyTask) =>
        task.sendPostCallSummaryResponse(createPostCallResponsePayload()),
      eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      expected: {wrapUpCode: 'resolved', state: 'DEFAULT'},
      absent: ['agentName', 'summaryReceived'] as const,
    },
    {
      label: 'post-call NOT_RECEIVED',
      invoke: (task: DummyTask) =>
        task.sendPostCallSummaryResponse(
          createPostCallResponsePayload({
            summary: '',
            state: 'NOT_RECEIVED',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
          })
        ),
      eventName: AIAssistantEventName.POST_CALL_SUMMARY_RESPONSE,
      expected: {wrapUpCode: 'resolved', summary: '', state: 'NOT_RECEIVED'},
      absent: ['agentName', 'summaryReceived'] as const,
    },
    {
      label: 'mid-call received',
      invoke: (task: DummyTask) =>
        task.sendMidCallSummaryResponse(createMidCallResponsePayload(), 'CONSULT'),
      eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
      expected: {agentName: 'Receiving Agent', state: 'DEFAULT'},
      absent: ['wrapUpCode', 'summaryReceived'] as const,
    },
    {
      label: 'mid-call summaryReceived:false',
      invoke: (task: DummyTask) =>
        task.sendMidCallSummaryResponse(
          createMidCallResponsePayload({
            summaryReceived: false,
            summary: '',
            state: 'NOT_RECEIVED',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
          }),
          'TRANSFER'
        ),
      eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
      expected: {agentName: 'Receiving Agent', summary: '', state: 'NOT_RECEIVED'},
      absent: ['wrapUpCode', 'summaryReceived'] as const,
    },
  ])(
    'populates both identifiers on $label response transport',
    async ({invoke, eventName, expected, absent}) => {
      const task = new DummyTask(
        dummyContact,
        createAISummaryTaskData({
          interactionId: 'response-interaction-1',
          interaction: {mainInteractionId: 'response-conversation-1'} as any,
        })
      );
      const {adapter} = createSummaryMocks(task);

      await expect(invoke(task)).resolves.toBeUndefined();

      expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
      const [agentId, transportPayload] = adapter.sendSummaryResponseEvent.mock.calls[0];

      expect(agentId).toBe('agent-1');
      expect(transportPayload).toMatchObject({
        agentId: 'agent-1',
        interactionId: 'response-interaction-1',
        conversationId: 'response-conversation-1',
        eventName,
        ...expected,
      });
      absent.forEach((propertyName) => {
        expect(transportPayload).not.toHaveProperty(propertyName);
      });
    }
  );

  it.each(['CONSULT', 'TRANSFER'] as const)(
    'sends a successful summary-not-received MID_CALL_CANCELLED %s response',
    async (actionType) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const {adapter} = createSummaryMocks(task);

      await expect(
        task.sendMidCallSummaryResponse(
          createMidCallResponsePayload({
            summaryReceived: false,
            summary: '',
            feedback: 'none',
            state: 'MID_CALL_CANCELLED',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
          }),
          actionType
        )
      ).resolves.toBeUndefined();

      expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
        'agent-1',
        expect.objectContaining({
          eventName:
            actionType === 'CONSULT'
              ? AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE
              : AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
          summary: '',
          state: 'MID_CALL_CANCELLED',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        })
      );
    }
  );

  it('preserves a received MID_CALL_CANCELLED summary and viewed counter', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);
    const summary = {
      reasonForTransferOrConsult: 'Customer requested a specialist',
      issueResolution: 'Warm transfer completed',
    };

    await expect(
      task.sendMidCallSummaryResponse(
        createMidCallResponsePayload({
          summaryReceived: true,
          summary,
          state: 'MID_CALL_CANCELLED',
          numberOfTimesViewed: 1,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
        }),
        'CONSULT'
      )
    ).resolves.toBeUndefined();

    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        summary,
        state: 'MID_CALL_CANCELLED',
        numberOfTimesViewed: 1,
      })
    );
  });

  it.each([
    {
      actionType: 'CONSULT' as AISummaryActionType,
      eventName: AIAssistantEventName.MID_CALL_CONSULT_SUMMARY_RESPONSE,
    },
    {
      actionType: 'TRANSFER' as AISummaryActionType,
      eventName: AIAssistantEventName.MID_CALL_TRANSFER_SUMMARY_RESPONSE,
    },
  ])(
    'sends MID_CALL_CANCELLED $actionType responses without invoking a handoff',
    async ({actionType, eventName}) => {
      const task = new DummyTask(dummyContact, createAISummaryTaskData());
      const {adapter} = createSummaryMocks(task);
      const consultSpy = jest.spyOn(task, 'consult').mockResolvedValue({} as any);
      const transferSpy = jest.spyOn(task, 'transfer').mockResolvedValue({} as any);
      const sendResponseThenHandoff = async (
        payload: MidCallSummaryResponsePayload,
        handoffActionType: AISummaryActionType
      ) => {
        await task.sendMidCallSummaryResponse(payload, handoffActionType);

        if (payload.state === 'MID_CALL_CANCELLED') {
          return;
        }

        if (handoffActionType === 'CONSULT') {
          await task.consult({} as any);

          return;
        }

        await task.transfer({} as any);
      };

      await expect(
        sendResponseThenHandoff(
          createMidCallResponsePayload({
            state: 'MID_CALL_CANCELLED',
            numberOfTimesViewed: 0,
            numberOfTimesEdited: 0,
            numberOfTimesCopied: 0,
          }),
          actionType
        )
      ).resolves.toBeUndefined();

      expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
        'agent-1',
        expect.objectContaining({eventName, state: 'MID_CALL_CANCELLED'})
      );
      expect(consultSpy).not.toHaveBeenCalled();
      expect(transferSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['post-call IGNORED', 'post-call', 'IGNORED'],
    ['mid-call EXCLUDED', 'mid-call', 'EXCLUDED'],
    ['mid-call IGNORED', 'mid-call', 'IGNORED'],
  ] as const)('accepts %s response states', async (_label, flow, state) => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    if (flow === 'post-call') {
      await expect(
        task.sendPostCallSummaryResponse(createPostCallResponsePayload({state: state as any}))
      ).resolves.toBeUndefined();
    } else {
      await expect(
        task.sendMidCallSummaryResponse(
          createMidCallResponsePayload({state: state as any}),
          'CONSULT'
        )
      ).resolves.toBeUndefined();
    }

    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({state})
    );
  });

  it('accepts mid-call IGNORED on the unavailable branch (summaryReceived:false)', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(
      task.sendMidCallSummaryResponse(
        {
          summaryReceived: false,
          summary: '',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
          feedback: 'none',
          state: 'IGNORED',
        },
        'CONSULT'
      )
    ).resolves.toBeUndefined();

    expect(adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({state: 'IGNORED'})
    );
  });

  it.each(['none', 'thumbs_up', 'thumbs_down'] as const)(
    'forwards valid %s feedback unchanged for both response flows',
    async (feedback) => {
      const postTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const postMocks = createSummaryMocks(postTask);
      const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const midMocks = createSummaryMocks(midTask);

      await expect(
        postTask.sendPostCallSummaryResponse(createPostCallResponsePayload({feedback}))
      ).resolves.toBeUndefined();
      await expect(
        midTask.sendMidCallSummaryResponse(createMidCallResponsePayload({feedback}), 'CONSULT')
      ).resolves.toBeUndefined();

      expect(postMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
        'agent-1',
        expect.objectContaining({feedback})
      );
      expect(midMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
        'agent-1',
        expect.objectContaining({feedback})
      );
    }
  );

  it.each(['thumbs_sideways', '', 'THUMBS_UP', undefined, null, 0])(
    'rejects invalid %p feedback before either response transport',
    async (feedback) => {
      const postTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const postMocks = createSummaryMocks(postTask);
      const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const midMocks = createSummaryMocks(midTask);

      await expect(
        postTask.sendPostCallSummaryResponse(
          createPostCallResponsePayload({feedback: feedback as any})
        )
      ).rejects.toMatchObject(
        createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD')
      );
      await expect(
        midTask.sendMidCallSummaryResponse(
          createMidCallResponsePayload({feedback: feedback as any}),
          'CONSULT'
        )
      ).rejects.toMatchObject(
        createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD')
      );
      expect(postMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
      expect(midMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['numberOfTimesViewed', '2'],
    ['numberOfTimesEdited', -1],
    ['numberOfTimesCopied', Number.NaN],
    ['numberOfTimesViewed', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects invalid %s counter value %p before either response transport',
    async (field, value) => {
      const postTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const postMocks = createSummaryMocks(postTask);
      const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const midMocks = createSummaryMocks(midTask);
      const overrides = {[field]: value} as any;

      await expect(
        postTask.sendPostCallSummaryResponse(createPostCallResponsePayload(overrides))
      ).rejects.toMatchObject(
        createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD')
      );
      await expect(
        midTask.sendMidCallSummaryResponse(createMidCallResponsePayload(overrides), 'CONSULT')
      ).rejects.toMatchObject(
        createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD')
      );
      expect(postMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
      expect(midMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
    }
  );

  it('forwards valid non-zero counters unchanged for both response flows', async () => {
    const counters = {
      numberOfTimesViewed: 2,
      numberOfTimesEdited: 1,
      numberOfTimesCopied: 3,
    };
    const postTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(postTask);
    const postMocks = createSummaryMocks(postTask);
    const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const midMocks = createSummaryMocks(midTask);

    await expect(
      postTask.sendPostCallSummaryResponse(createPostCallResponsePayload(counters))
    ).resolves.toBeUndefined();
    await expect(
      midTask.sendMidCallSummaryResponse(createMidCallResponsePayload(counters), 'TRANSFER')
    ).resolves.toBeUndefined();

    expect(postMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining(counters)
    );
    expect(midMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining(counters)
    );
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS,
      expect.objectContaining({operation: METHODS.SEND_POST_CALL_SUMMARY_RESPONSE}),
      ['operational']
    );
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS,
      expect.objectContaining({
        operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
        actionType: 'TRANSFER',
      }),
      ['operational']
    );
  });

  it.each([
    ['actionTimeStamp', '123'],
    ['actionTimeStamp', Number.NaN],
    ['actionTimeStamp', Number.POSITIVE_INFINITY],
    ['actionTimeStamp', -1],
    ['publishTimestamp', '123'],
    ['publishTimestamp', Number.NaN],
    ['publishTimestamp', Number.POSITIVE_INFINITY],
    ['publishTimestamp', -1],
  ] as const)(
    'rejects invalid response %s value %p before either response transport',
    async (field, value) => {
      const postTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const postMocks = createSummaryMocks(postTask);
      const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
      const midMocks = createSummaryMocks(midTask);
      const overrides = {[field]: value} as any;

      await expect(
        postTask.sendPostCallSummaryResponse(createPostCallResponsePayload(overrides))
      ).rejects.toMatchObject({
        message: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD',
        data: {errorCode: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD'},
      });
      await expect(
        midTask.sendMidCallSummaryResponse(createMidCallResponsePayload(overrides), 'CONSULT')
      ).rejects.toMatchObject({
        message: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD',
        data: {errorCode: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD'},
      });
      expect(postMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
      expect(midMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
    }
  );

  it('rejects invalid response payloads and invalid mid-call actions before transport', async () => {
    const midTask = new DummyTask(dummyContact, createAISummaryTaskData());
    const midMocks = createSummaryMocks(midTask);

    await expect(
      midTask.sendMidCallSummaryResponse(
        {...createMidCallResponsePayload(), summaryReceived: undefined} as any,
        'CONSULT'
      )
    ).rejects.toMatchObject({message: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD'});
    await expect(
      midTask.sendMidCallSummaryResponse(
        {...createMidCallResponsePayload(), wrapUpCode: undefined} as any,
        'CONSULT'
      )
    ).rejects.toMatchObject({message: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD'});
    await expect(
      midTask.sendMidCallSummaryResponse(createMidCallResponsePayload(), 'INVALID' as any)
    ).rejects.toMatchObject({message: 'AI_SUMMARY_INVALID_ACTION_TYPE'});
    expect(midMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      'summaryReceived true with NOT_RECEIVED state',
      {
        summaryReceived: true,
        state: 'NOT_RECEIVED',
        summary: 'received summary',
        numberOfTimesViewed: 1,
        numberOfTimesEdited: 0,
        numberOfTimesCopied: 0,
      },
    ],
    ['summaryReceived false with DEFAULT state', {summaryReceived: false, state: 'DEFAULT'}],
    ['summaryReceived false with EXCLUDED state', {summaryReceived: false, state: 'EXCLUDED'}],
    ['NOT_RECEIVED with non-empty summary', {summaryReceived: false, summary: 'summary'}],
    [
      'MID_CALL_CANCELLED with non-empty summary',
      {summaryReceived: false, state: 'MID_CALL_CANCELLED', summary: 'summary'},
    ],
    ['NOT_RECEIVED with viewed counter', {summaryReceived: false, numberOfTimesViewed: 1}],
    [
      'MID_CALL_CANCELLED with viewed counter',
      {summaryReceived: false, state: 'MID_CALL_CANCELLED', numberOfTimesViewed: 1},
    ],
    ['NOT_RECEIVED with edited counter', {summaryReceived: false, numberOfTimesEdited: 1}],
    [
      'MID_CALL_CANCELLED with edited counter',
      {summaryReceived: false, state: 'MID_CALL_CANCELLED', numberOfTimesEdited: 1},
    ],
    ['NOT_RECEIVED with copied counter', {summaryReceived: false, numberOfTimesCopied: 1}],
    [
      'MID_CALL_CANCELLED with copied counter',
      {summaryReceived: false, state: 'MID_CALL_CANCELLED', numberOfTimesCopied: 1},
    ],
  ] as const)('rejects mid-call runtime response mismatch: %s', async (_label, overrides) => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const {adapter} = createSummaryMocks(task);

    await expect(
      task.sendMidCallSummaryResponse(
        createMidCallResponsePayload({
          summaryReceived: false,
          summary: '',
          feedback: 'none',
          state: 'NOT_RECEIVED',
          numberOfTimesViewed: 0,
          numberOfTimesEdited: 0,
          numberOfTimesCopied: 0,
          ...overrides,
        } as any),
        'CONSULT'
      )
    ).rejects.toMatchObject(createAISummaryErrorExpectation('AI_SUMMARY_INVALID_RESPONSE_PAYLOAD'));
    expect(adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
  });

  it('keeps unvalidated mid-call request actionType out of failure metrics', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const {adapter, coordinator} = createSummaryMocks(task);
    const unvalidatedActionType = 'caller-action-type-summary-section-value-sentinel';

    await expect(task.requestMidCallSummary(unvalidatedActionType as any)).rejects.toMatchObject({
      message: 'AI_SUMMARY_INVALID_ACTION_TYPE',
      data: {errorCode: 'AI_SUMMARY_INVALID_ACTION_TYPE'},
    });

    const serializedMetricArguments = JSON.stringify(metrics.trackEvent.mock.calls);
    const failureMetricFields = metrics.trackEvent.mock.calls[0][1] as Record<string, unknown>;

    expect(serializedMetricArguments).not.toContain(unvalidatedActionType);
    expect(failureMetricFields).not.toHaveProperty('actionType');
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_GET_MID_CALL_FAILED,
      expect.objectContaining({
        operation: METHODS.REQUEST_MID_CALL_SUMMARY,
        failureCode: 'AI_SUMMARY_INVALID_ACTION_TYPE',
      }),
      ['operational']
    );
    expect(coordinator.request).not.toHaveBeenCalled();
    expect(adapter.sendSummaryGetEvent).not.toHaveBeenCalled();
  });

  it('keeps unvalidated mid-call response actionType out of failure metrics', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const {adapter} = createSummaryMocks(task);
    const unvalidatedActionType = 'caller-action-type-summary-section-value-sentinel';

    await expect(
      task.sendMidCallSummaryResponse(createMidCallResponsePayload(), unvalidatedActionType as any)
    ).rejects.toMatchObject({
      message: 'AI_SUMMARY_INVALID_ACTION_TYPE',
      data: {errorCode: 'AI_SUMMARY_INVALID_ACTION_TYPE'},
    });

    const serializedMetricArguments = JSON.stringify(metrics.trackEvent.mock.calls);
    const failureMetricFields = metrics.trackEvent.mock.calls[0][1] as Record<string, unknown>;

    expect(serializedMetricArguments).not.toContain(unvalidatedActionType);
    expect(failureMetricFields).not.toHaveProperty('actionType');
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_FAILED,
      expect.objectContaining({
        operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
        failureCode: 'AI_SUMMARY_INVALID_ACTION_TYPE',
      }),
      ['operational']
    );
    expect(adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
  });

  it('maps plain adapter errors to a bounded failure code and preserves rejection identity', async () => {
    const task = new DummyTask(dummyContact, createAISummaryTaskData());
    const metrics = spyOnAISummaryMetrics(task);
    const {adapter} = createSummaryMocks(task);
    const adapterError = new Error('summary-section-value-sentinel');

    adapter.sendSummaryResponseEvent.mockRejectedValue(adapterError);

    await expect(
      task.sendMidCallSummaryResponse(createMidCallResponsePayload(), 'CONSULT')
    ).rejects.toBe(adapterError);

    expect(JSON.stringify(metrics.trackEvent.mock.calls)).not.toContain(
      'summary-section-value-sentinel'
    );
    expect(metrics.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_FAILED,
      expect.objectContaining({
        operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
        actionType: 'CONSULT',
        failureCode: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD',
      }),
      ['operational']
    );
  });

  it.each([
    {
      label: 'invalid payload',
      expectedCode: 'AI_SUMMARY_INVALID_RESPONSE_PAYLOAD',
      configure: true,
      payload: createPostCallResponsePayload({wrapUpCode: ''}),
      adapterError: undefined,
      expectAdapterCall: false,
    },
    {
      label: 'not initialized',
      expectedCode: 'AI_SUMMARY_NOT_INITIALIZED',
      configure: false,
      payload: createPostCallResponsePayload(),
      adapterError: undefined,
      expectAdapterCall: false,
    },
    {
      label: 'correlation unavailable',
      expectedCode: 'AI_SUMMARY_CORRELATION_NOT_AVAILABLE',
      configure: true,
      taskData: createAISummaryTaskData({interactionId: ''}),
      payload: createPostCallResponsePayload(),
      adapterError: undefined,
      expectAdapterCall: false,
    },
    {
      label: 'summary base URL unavailable',
      expectedCode: AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE,
      configure: true,
      payload: createPostCallResponsePayload(),
      adapterError: createAISummaryError(
        AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
      ),
      expectAdapterCall: true,
    },
    ...[
      AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
      AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED,
      AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT,
    ].map((expectedCode) => ({
      label: expectedCode,
      expectedCode,
      configure: true,
      payload: createPostCallResponsePayload(),
      adapterError: createAISummaryError(expectedCode),
      expectAdapterCall: true,
    })),
  ])(
    'records bounded post-call response failure metric for $label',
    async ({expectedCode, configure, taskData, payload, adapterError, expectAdapterCall}) => {
      const responseTask = new DummyTask(dummyContact, taskData ?? createAISummaryTaskData());
      const responseMetrics = spyOnAISummaryMetrics(responseTask);
      const summaryMocks = configure ? createSummaryMocks(responseTask) : undefined;

      if (adapterError) {
        summaryMocks?.adapter.sendSummaryResponseEvent.mockRejectedValue(adapterError);
      }

      const result = responseTask.sendPostCallSummaryResponse(payload);

      if (adapterError) {
        await expect(result).rejects.toBe(adapterError);
      } else {
        await expect(result).rejects.toMatchObject(createAISummaryErrorExpectation(expectedCode));
      }

      if (summaryMocks) {
        if (expectAdapterCall) {
          expect(summaryMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
        } else {
          expect(summaryMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
        }
      }
      expect(responseMetrics.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_POST_CALL_RESPONSE_FAILED,
        expect.objectContaining({
          operation: METHODS.SEND_POST_CALL_SUMMARY_RESPONSE,
          failureCode: expectedCode,
        }),
        ['operational']
      );
      expect(responseMetrics.timeEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: 'not initialized',
      expectedCode: 'AI_SUMMARY_NOT_INITIALIZED',
      configure: false,
      adapterError: undefined,
      taskData: undefined,
      expectAdapterCall: false,
      includeActionType: false,
    },
    {
      label: 'correlation unavailable',
      expectedCode: 'AI_SUMMARY_CORRELATION_NOT_AVAILABLE',
      configure: true,
      adapterError: undefined,
      taskData: createAISummaryTaskData({interactionId: ''}),
      expectAdapterCall: false,
      includeActionType: true,
    },
    {
      label: 'summary base URL unavailable',
      expectedCode: AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE,
      configure: true,
      adapterError: createAISummaryError(
        AI_SUMMARY_ERROR_CODES.AI_ASSISTANT_BASE_URL_NOT_AVAILABLE
      ),
      taskData: undefined,
      expectAdapterCall: true,
      includeActionType: true,
    },
    ...[
      AI_SUMMARY_TRANSPORT_ERROR_CODES.VALIDATION_FAILED,
      AI_SUMMARY_TRANSPORT_ERROR_CODES.HTTP_REQUEST_FAILED,
      AI_SUMMARY_TRANSPORT_ERROR_CODES.TIMEOUT,
    ].map((expectedCode) => ({
      label: expectedCode,
      expectedCode,
      configure: true,
      adapterError: createAISummaryError(expectedCode),
      taskData: undefined,
      expectAdapterCall: true,
      includeActionType: true,
    })),
  ])(
    'records bounded mid-call response failure metric for $label',
    async ({
      expectedCode,
      configure,
      taskData,
      adapterError,
      expectAdapterCall,
      includeActionType,
    }) => {
      const responseTask = new DummyTask(dummyContact, taskData ?? createAISummaryTaskData());
      const responseMetrics = spyOnAISummaryMetrics(responseTask);
      const summaryMocks = configure ? createSummaryMocks(responseTask) : undefined;

      if (adapterError) {
        summaryMocks?.adapter.sendSummaryResponseEvent.mockRejectedValue(adapterError);
      }

      const result = responseTask.sendMidCallSummaryResponse(
        createMidCallResponsePayload(),
        'CONSULT'
      );

      if (adapterError) {
        await expect(result).rejects.toBe(adapterError);
      } else {
        await expect(result).rejects.toMatchObject(createAISummaryErrorExpectation(expectedCode));
      }

      if (summaryMocks) {
        if (expectAdapterCall) {
          expect(summaryMocks.adapter.sendSummaryResponseEvent).toHaveBeenCalledTimes(1);
        } else {
          expect(summaryMocks.adapter.sendSummaryResponseEvent).not.toHaveBeenCalled();
        }
      }
      expect(responseMetrics.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.AI_SUMMARY_MID_CALL_RESPONSE_FAILED,
        expect.objectContaining({
          operation: METHODS.SEND_MID_CALL_SUMMARY_RESPONSE,
          ...(includeActionType ? {actionType: 'CONSULT'} : {}),
          failureCode: expectedCode,
        }),
        ['operational']
      );
      expect(responseMetrics.timeEvent).not.toHaveBeenCalled();
    }
  );
});
