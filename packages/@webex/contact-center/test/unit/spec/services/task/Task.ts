import Task from '../../../../../src/services/task/Task';
import {
  TaskData,
  DESTINATION_TYPE,
  TASK_EVENTS,
  TASK_CHANNEL_TYPE,
  VOICE_VARIANT,
} from '../../../../../src/services/task/types';
import {TaskEvent} from '../../../../../src/services/task/state-machine';
import LoggerProxy from '../../../../../src/logger-proxy';
import {createTaskData} from './taskTestUtils';

class DummyTask extends Task {
  constructor(contact: any, data: TaskData) {
    super(contact, data, {
      channelType: 'voice',
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
  }

  public accept() {
    return Promise.resolve({} as any);
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

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

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

    await flushPromises();
    expect(webrtcTask.acceptMock).toHaveBeenCalled();
    expect(autoAnsweredSpy).toHaveBeenCalledWith(webrtcTask);
  });

  it('does not auto-answer when isAutoAnswering is false', async () => {
    const data = createTaskData({isAutoAnswering: false});
    const webrtcTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.WEBRTC});

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushPromises();
    expect(webrtcTask.acceptMock).not.toHaveBeenCalled();
  });

  it('does not auto-answer for voice tasks when variant is not WebRTC', async () => {
    const data = createTaskData({isAutoAnswering: true});
    const pstnTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.PSTN});

    pstnTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    pstnTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushPromises();
    expect(pstnTask.acceptMock).not.toHaveBeenCalled();
  });

  it('clears isAutoAnswering when auto-answer fails', async () => {
    const data = createTaskData({isAutoAnswering: true});
    const webrtcTask = new SpyAcceptTask(dummyContact, data, {voiceVariant: VOICE_VARIANT.WEBRTC});
    webrtcTask.acceptMock.mockRejectedValue(new Error('fail'));

    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_INCOMING, taskData: data});
    webrtcTask.sendStateMachineEvent({type: TaskEvent.TASK_OFFERED, taskData: data});

    await flushPromises();
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
