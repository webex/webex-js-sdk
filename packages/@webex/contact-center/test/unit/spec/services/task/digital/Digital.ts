import Digital from '../../../../../../src/services/task/digital/Digital';
import {MEDIA_CHANNEL, TaskData, TaskResponse} from '../../../../../../src/services/task/types';
import {TaskEvent, TaskEventPayload} from '../../../../../../src/services/task/state-machine';
import LoggerProxy from '../../../../../../src/logger-proxy';
import WebexRequest from '../../../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import * as Utils from '../../../../../../src/services/core/Utils';
import {flushEventLoopTurn} from '../../../../fixtures/aiSummaryTestUtils';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn().mockResolvedValue(undefined)}),
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

describe('T-008 Digital regional lifetime', () => {
  const uploadLogs = WebexRequest.getInstance().uploadLogs;
  let helper: jest.SpyInstance;
  let errorLog: jest.SpyInstance;
  let metrics: jest.SpyInstance;
  let task: Digital;
  let accept: jest.Mock;
  let admission: jest.Mock;

  beforeEach(() => {
    helper = jest.spyOn(Utils, 'getErrorDetails');
    errorLog = jest.spyOn(LoggerProxy, 'error').mockImplementation();
    metrics = jest.spyOn(MetricsManager.getInstance(), 'trackEvent').mockImplementation();
    accept = jest.fn();
    task = new Digital({accept} as any, {interactionId: 'digital', interaction: {mediaType: MEDIA_CHANNEL.CHAT}} as TaskData);
    admission = jest.fn();
    task.bindRecoveryGuard({generation: 1, signal: new AbortController().signal, assertCommandAllowed: admission});
  });

  afterEach(() => {
    task.invalidateForRegionRecovery();
    helper.mockRestore();
    errorLog.mockRestore();
    metrics.mockRestore();
  });

  it.each(['RECOVERY_INTERRUPTED', 'STALE_TASK', 'RECOVERY_IN_PROGRESS', 'REGION_RELOAD_REQUIRED'])(
    'lifecycleCallerCatchPreservesIdentityAndReason: %s', async (reason) => {
      const diagnostics = {trackingId: 'digital-lifecycle-tracking', status: 409};
      const error = Utils.createRegionRecoveryError(reason, diagnostics);
      const data = error.data;
      accept.mockRejectedValue(error);

      await expect(task.accept()).rejects.toBe(error);
      await flushEventLoopTurn();

      expect(accept).toHaveBeenCalledTimes(1);
      expect(admission).toHaveBeenCalled();
      expect(helper.mock.calls).toEqual([[error, 'accept', 'cc']]);
      expect(helper.mock.results[0].value).toEqual({error, reason});
      expect(error.data).toBe(data);
      expect(error.data).toEqual({reason, ...diagnostics});
      expect(error.message).toBe(reason);
      expect(metrics).not.toHaveBeenCalled();
      expect(errorLog).not.toHaveBeenCalled();
      expect(uploadLogs).not.toHaveBeenCalled();
    }
  );

  it('ordinary accept failure reaches the metric, error log and upload sinks', async () => {
    const error = new Error('ordinary accept failure');
    accept.mockRejectedValue(error);

    await expect(task.accept()).rejects.toThrow('Error while performing accept');
    await flushEventLoopTurn();

    expect(metrics).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      {taskId: 'digital', error: error.toString(), trackingId: undefined},
      ['operational', 'behavioral', 'business']
    );
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(uploadLogs).toHaveBeenCalledTimes(1);
    expect(uploadLogs).toHaveBeenCalledWith({correlationId: undefined});
  });
});
