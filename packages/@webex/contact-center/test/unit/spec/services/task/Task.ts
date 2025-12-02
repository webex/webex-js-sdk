import Task from '../../../../../src/services/task/Task';
import {TaskData, DESTINATION_TYPE} from '../../../../../src/services/task/types';
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
    getInstance: jest.fn().mockReturnValue({ uploadLogs: jest.fn() }),
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

  it('getUIControls returns default controls shape for idle voice task', () => {
    const controls = task.uiControls;
    // accept/decline hidden because not offered
    expect(controls.accept.isVisible).toBe(false);
    expect(controls.accept.isEnabled).toBe(true);
    expect(controls.decline.isVisible).toBe(false);
    expect(controls.decline.isEnabled).toBe(true);

    // voice tasks always render end when enabled in config
    expect(controls.end.isVisible).toBe(true);
    expect(controls.end.isEnabled).toBe(true);

    expect(controls.transfer.isVisible).toBe(false);
    expect(controls.transfer.isEnabled).toBe(true);
    expect(controls.hold.isVisible).toBe(false);
    expect(controls.hold.isEnabled).toBe(false);
    expect(controls.mute.isVisible).toBe(false);
    expect(controls.mute.isEnabled).toBe(true);
    expect(controls.consult.isVisible).toBe(false);
    expect(controls.consult.isEnabled).toBe(false);
    expect(controls.consultTransfer.isVisible).toBe(false);
    expect(controls.consultTransfer.isEnabled).toBe(true);
    expect(controls.endConsult.isVisible).toBe(false);
    expect(controls.endConsult.isEnabled).toBe(true);
    expect(controls.recording.isVisible).toBe(false);
    expect(controls.recording.isEnabled).toBe(false);
    expect(controls.conference.isVisible).toBe(false);
    expect(controls.conference.isEnabled).toBe(false);
    expect(controls.wrapup.isVisible).toBe(false);
    expect(controls.wrapup.isEnabled).toBe(true);
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

    transitionTask.stateMachineService?.send({type: TaskEvent.OFFER, taskData: statefulData});
    transitionTask.stateMachineService?.send({type: TaskEvent.ACCEPT});

    const transitionMessages = logSpy.mock.calls
      .filter(([msg]) => typeof msg === 'string' && (msg as string).startsWith('State machine transition'))
      .map(([msg]) => msg);

    expect(transitionMessages).toEqual([
      'State machine transition: IDLE -> OFFERED',
      'State machine transition: OFFERED -> CONNECTED',
    ]);

    transitionTask.stateMachineService?.stop();
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

    await expect(task.transfer(payload))
      .rejects
      .toThrow('Error while performing transfer');
  });

  it('transfer rejects when vteamTransfer throws', async () => {
    const payload = {to: 'queue1', destinationType: DESTINATION_TYPE.QUEUE} as any;
    const err = new Error('Error while performing transfer');
    contact.vteamTransfer.mockRejectedValue(err);

    await expect(task.transfer(payload))
      .rejects
      .toThrow('Error while performing transfer');
  });

  it('end rejects when contact.end throws', async () => {
    const err = new Error('Error while performing end');
    contact.end.mockRejectedValue(err);

    await expect(task.end()).rejects.toThrow('Error while performing end');
  });

  it('wrapup throws when auxCodeId is missing', async () => {
    await expect(task.wrapup({auxCodeId: '', wrapUpReason: 'reason1'} as any)).rejects.toThrow('Error while performing wrapup');
  });

  it('wrapup throws when wrapUpReason is missing', async () => {
    await expect(task.wrapup({auxCodeId: 'code1', wrapUpReason: ''} as any)).rejects.toThrow('Error while performing wrapup');
  });

  it('wrapup rejects when contact.wrapup throws', async () => {
    const payload = {auxCodeId: 'code1', wrapUpReason: 'reason1'} as any;
    const err = new Error('Error while performing wrapup');
    contact.wrapup.mockRejectedValue(err);

    await expect(task.wrapup(payload)).rejects.toThrow('Error while performing wrapup');
  });
});
