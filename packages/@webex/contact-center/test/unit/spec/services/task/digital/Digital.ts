import Digital from '../../../../../../src/services/task/digital/Digital';
import {MEDIA_CHANNEL, TaskData, TaskResponse} from '../../../../../../src/services/task/types';
import {TaskEvent, TaskEventPayload} from '../../../../../../src/services/task/state-machine';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ uploadLogs: jest.fn() }),
  },
}));

const sendStateEvents = (task: Digital, events: TaskEventPayload[]) => {
  events.forEach((event) => {
    if (!event) {
      throw new Error('Task event payload is required');
    }
    task.stateMachineService?.send(event);
  });
};

describe('Digital Task', () => {
  const dummyData = {
    interactionId: 'dig1',
    interaction: {isTerminated: false, mediaType: MEDIA_CHANNEL.CHAT},
  } as TaskData;
  let dummyContact: { accept: jest.Mock<Promise<TaskResponse>> };

  beforeEach(() => {
    dummyContact = {
      accept: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
  });

  it('accept() calls contact.accept with interactionId', async () => {
    const task = new Digital(dummyContact, dummyData);
    const res = await task.accept();
    expect(dummyContact.accept).toHaveBeenCalledWith({ interactionId: 'dig1' });
    expect(res).toEqual({ status: 'ok' });
  });

  it('accept() throws an error when contact.accept rejects', async () => {
    const error = new Error('Error while performing accept');
    (dummyContact.accept as jest.Mock).mockRejectedValue(error);
    const task = new Digital(dummyContact, dummyData);
    await expect(task.accept()).rejects.toThrow('Error while performing accept');
  });

  it('constructor shows accept when offered', () => {
    const task = new Digital(dummyContact, dummyData);
    sendStateEvents(task, [{type: TaskEvent.TASK_INCOMING, taskData: dummyData}]);
    expect(task.uiControls.main.accept.isVisible).toBe(true);
    expect(task.uiControls.main.accept.isEnabled).toBe(true);
  });

  describe('UI controls derived from state machine events', () => {
    it('connected state shows transfer and end', () => {
      const task = new Digital(dummyContact, dummyData);
      sendStateEvents(task, [
        {type: TaskEvent.TASK_INCOMING, taskData: dummyData},
        {type: TaskEvent.ASSIGN, taskData: dummyData},
      ]);
      expect(task.uiControls.main.accept.isVisible).toBe(false);
      expect(task.uiControls.main.transfer.isVisible).toBe(true);
      expect(task.uiControls.main.end.isVisible).toBe(true);
      expect(task.uiControls.main.wrapup.isVisible).toBe(false);
    });

    it('wrapup state hides transfer/end and shows wrapup button', () => {
      const task = new Digital(dummyContact, dummyData);
      sendStateEvents(task, [
        {type: TaskEvent.TASK_INCOMING, taskData: dummyData},
        {type: TaskEvent.ASSIGN, taskData: dummyData},
        {type: TaskEvent.TASK_WRAPUP},
      ]);
      expect(task.uiControls.main.transfer.isVisible).toBe(false);
      expect(task.uiControls.main.end.isVisible).toBe(false);
      expect(task.uiControls.main.wrapup.isVisible).toBe(true);
    });

    it('terminated interaction toggles wrapup visibility even before END event', () => {
      const task = new Digital(dummyContact, dummyData);
      const terminatedData = {
        ...dummyData,
        interaction: {...(dummyData.interaction as any), isTerminated: true},
      } as TaskData;
      task.updateTaskData(terminatedData);
      sendStateEvents(task, [
        {type: TaskEvent.TASK_INCOMING, taskData: dummyData},
        {type: TaskEvent.ASSIGN, taskData: terminatedData},
      ]);
      expect(task.uiControls.main.wrapup.isVisible).toBe(true);
    });

    it('rona hides accept controls', () => {
      const task = new Digital(dummyContact, dummyData);
      sendStateEvents(task, [
        {type: TaskEvent.TASK_INCOMING, taskData: dummyData},
        {type: TaskEvent.RONA},
      ]);
      expect(task.uiControls.main.accept.isVisible).toBe(false);
      expect(task.uiControls.main.transfer.isVisible).toBe(false);
      expect(task.uiControls.main.end.isVisible).toBe(false);
    });
  });
});
