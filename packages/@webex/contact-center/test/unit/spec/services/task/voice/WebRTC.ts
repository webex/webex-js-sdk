import 'jsdom-global/register';
import {LocalMicrophoneStream, CALL_EVENT_KEYS, LINE_EVENTS} from '@webex/calling';
import EventEmitter from 'events';
import WebRTC from '../../../../../../src/services/task/voice/WebRTC';
import TaskManager from '../../../../../../src/services/task/TaskManager';
import WebCallingService from '../../../../../../src/services/WebCallingService';
import {TaskData, TASK_EVENTS} from '../../../../../../src/services/task/types';
import {LoginOption} from '../../../../../../src/types';
import type {WebexSDK} from '../../../../../../src/types';
import {TaskEvent, TaskEventPayload} from '../../../../../../src/services/task/state-machine';
import {createTaskData} from '../taskTestUtils';
import {CC_EVENTS} from '../../../../../../src/services/config/types';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import LoggerProxy from '../../../../../../src/logger-proxy';
import WebexRequest from '../../../../../../src/services/core/WebexRequest';
import * as Utils from '../../../../../../src/services/core/Utils';
import {flushEventLoopTurn} from '../../../../fixtures/aiSummaryTestUtils';

jest.mock('@webex/calling', () => ({
  LocalMicrophoneStream: class {
    constructor(stream) {
      this.outputStream = stream;
    }
  },
  CALL_EVENT_KEYS: {REMOTE_MEDIA: 'remoteMedia', DISCONNECT: 'disconnect'},
  LINE_EVENTS: {INCOMING_CALL: 'incomingCall'},
}));

beforeAll(() => {
  navigator.mediaDevices = {getUserMedia: jest.fn()};
  // @ts-ignore
  global.MediaStream = class {
    constructor(private tracks: MediaStreamTrack[]) {}
    getAudioTracks() {
      return this.tracks;
    }
    getTracks() {
      return this.tracks;
    }
  } as typeof MediaStream;
});

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn().mockResolvedValue(undefined)}),
  },
}));

const sendStateEvents = (task: WebRTC, events: TaskEventPayload[]) => {
  events.forEach((event) => {
    if (!event) {
      throw new Error('Task event payload is required');
    }
    task.stateMachineService?.send(event);
  });
};

describe('WebRTC Task', () => {
  const dummyContact = {} as any;
  let taskData: TaskData;
  let webCallingService: WebCallingService;
  let onSpy: jest.SpyInstance;
  let offSpy: jest.SpyInstance;
  let answerSpy: jest.SpyInstance;
  let declineSpy: jest.SpyInstance;
  let muteSpy: jest.SpyInstance;

  let webRtc: WebRTC;

  beforeAll(() => {
    const webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    } as unknown as WebexSDK;

    webCallingService = new WebCallingService(webex);
    onSpy = jest.spyOn(webCallingService, 'on');
    offSpy = jest.spyOn(webCallingService, 'off');
    answerSpy = jest.spyOn(webCallingService, 'answerCall');
    declineSpy = jest.spyOn(webCallingService, 'declineCall');
    muteSpy = jest.spyOn(webCallingService, 'muteUnmuteCall');
  });

  beforeEach(() => {
    taskData = createTaskData();
    webRtc = new WebRTC(dummyContact, webCallingService, taskData, {
      isEndTaskEnabled: true,
      isEndConsultEnabled: true,
    });
  });

  it('accept() obtains media and answers call', async () => {
    const fakeTrack = {} as any;
    const fakeStream = {getAudioTracks: () => [fakeTrack], getTracks: () => [fakeTrack]} as any;
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(fakeStream);
    await webRtc.accept();
    expect(answerSpy).toHaveBeenCalled();
    const [[streamArg, interactionIdArg]] = webCallingService.answerCall.mock.calls;
    expect(streamArg).toBeInstanceOf(LocalMicrophoneStream);
    expect(interactionIdArg).toBe(taskData.interactionId);
  });

  it('decline() calls declineCall and unregisters listeners', async () => {
    jest.spyOn(webRtc, 'unregisterWebCallListeners');
    const res = await webRtc.decline();
    expect(declineSpy).toHaveBeenCalledWith(taskData.interactionId);
    expect(webRtc.unregisterWebCallListeners).toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  it('toggleMute() calls muteUnmuteCall with stored localAudioStream', async () => {
    const dummyStream = {} as any;
    webRtc.localAudioStream = dummyStream;
    await webRtc.toggleMute();
    expect(muteSpy).toHaveBeenCalledWith(dummyStream);
  });

  describe('WebRTC internal methods', () => {
    it('registerWebCallListeners binds remote media event', () => {
      webRtc.registerWebCallListeners();
      expect(onSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, webRtc.handleRemoteMedia);
    });

    it('handleRemoteMedia emits TASK_MEDIA event', () => {
      const fakeTrack = {} as any;
      jest.spyOn(webRtc, 'emit');
      webRtc.handleRemoteMedia(fakeTrack);
      expect(webRtc.emit).toHaveBeenCalledWith(TASK_EVENTS.TASK_MEDIA, fakeTrack);
    });
  });

  describe('UI controls', () => {
    beforeEach(() => {
      taskData = createTaskData();
      webRtc = new WebRTC(dummyContact, webCallingService, taskData, {
        isEndTaskEnabled: true,
        isEndConsultEnabled: true,
      });
    });

    it('initialiseUIControls sets accept and decline visible', () => {
      sendStateEvents(webRtc, [{type: TaskEvent.TASK_INCOMING, taskData}]);
      expect(webRtc.uiControls.main.accept.isVisible).toBe(true);
      expect(webRtc.uiControls.main.decline.isVisible).toBe(true);
    });

    it('setUIControls for AGENT_CONTACT_ASSIGNED shows mute enabled', () => {
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.ASSIGN, taskData},
      ]);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(true);
      expect(webRtc.uiControls.main.mute.isEnabled).toBe(true);
    });

    it('default setUIControls hides mute when wrapup visible', () => {
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.ASSIGN, taskData},
        {type: TaskEvent.TASK_WRAPUP},
      ]);
      expect(webRtc.uiControls.main.wrapup.isVisible).toBe(true);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_HELD disables mute', () => {
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.ASSIGN, taskData},
        {type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId},
        {type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId},
      ]);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(true);
      expect(webRtc.uiControls.main.mute.isEnabled).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_UNHELD re-enables mute', () => {
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.ASSIGN, taskData},
        {type: TaskEvent.HOLD_INITIATED, mediaResourceId: taskData.mediaResourceId},
        {type: TaskEvent.HOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId},
        {type: TaskEvent.UNHOLD_INITIATED, mediaResourceId: taskData.mediaResourceId},
        {type: TaskEvent.UNHOLD_SUCCESS, mediaResourceId: taskData.mediaResourceId},
      ]);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(true);
      expect(webRtc.uiControls.main.mute.isEnabled).toBe(true);
    });

    it('setUIControls for AGENT_OFFER_CONTACT shows accept and decline', () => {
      sendStateEvents(webRtc, [{type: TaskEvent.TASK_INCOMING, taskData}]);
      expect(webRtc.uiControls.main.accept.isVisible).toBe(true);
      expect(webRtc.uiControls.main.decline.isVisible).toBe(true);
    });

    it('setUIControls for AGENT_OFFER_CONSULT shows accept and decline', () => {
      const consultedTaskData = {...taskData, isConsulted: true};
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.OFFER_CONSULT, taskData: consultedTaskData},
      ]);
      expect(webRtc.uiControls.main.accept.isVisible).toBe(true);
      expect(webRtc.uiControls.main.decline.isVisible).toBe(true);
    });

    it('setUIControls for AGENT_CONSULTING hides accept/decline and shows mute when consulted', () => {
      const consultedTaskData = {...taskData, isConsulted: true};
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.OFFER_CONSULT, taskData: consultedTaskData},
        {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
          taskData: consultedTaskData,
        },
      ]);
      expect(webRtc.uiControls.main.accept.isVisible).toBe(false);
      expect(webRtc.uiControls.main.decline.isVisible).toBe(false);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(true);
      expect(webRtc.uiControls.main.mute.isEnabled).toBe(true);
    });

    it('setUIControls for AGENT_CONSULT_ENDED returns mute to connected state behavior', () => {
      const consultedTaskData = {...taskData, isConsulted: true};
      sendStateEvents(webRtc, [
        {type: TaskEvent.TASK_INCOMING, taskData},
        {type: TaskEvent.OFFER_CONSULT, taskData: consultedTaskData},
        {
          type: TaskEvent.CONSULTING_ACTIVE,
          consultDestinationAgentJoined: true,
          taskData: consultedTaskData,
        },
        {type: TaskEvent.CONSULT_END},
      ]);
      expect(webRtc.uiControls.main.mute.isVisible).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_OFFER_RONA hides accept and decline', () => {
      sendStateEvents(webRtc, [{type: TaskEvent.TASK_INCOMING, taskData}, {type: TaskEvent.RONA}]);
      expect(webRtc.uiControls.main.accept.isVisible).toBe(false);
      expect(webRtc.uiControls.main.decline.isVisible).toBe(false);
    });
  });
  describe('T-008/T-009 owned media recovery', () => {
    const lifecycle = jest.requireActual('../../../../../../src/services/core/Utils');

    it('registered remote media handler delivers live media and suppresses it during interruption', () => {
      const calling = new WebCallingService({} as WebexSDK);
      calling.setLoginOption(LoginOption.BROWSER);
      const manager = new TaskManager(
        undefined, {} as any, calling, new EventEmitter() as any, new EventEmitter() as any
      );
      const controller = new AbortController();
      const task = new WebRTC({} as any, calling, createTaskData());
      task.bindRecoveryGuard({
        generation: 1, signal: controller.signal, assertCommandAllowed: jest.fn(),
      });
      manager['taskCollection'] = {[task.data.interactionId]: task};
      const media = jest.fn();
      task.on(TASK_EVENTS.TASK_MEDIA, media);
      const liveTrack = {stop: jest.fn()};
      const lateTrack = {stop: jest.fn()};
      try {
        expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
        calling.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, liveTrack);
        expect(media.mock.calls).toEqual([[liveTrack]]);

        manager.interruptTaskOperations(() => lifecycle.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        controller.abort();
        // Keep the handler registered and the Task in the collection to exercise its own fence.
        expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
        expect(manager.getTask(task.data.interactionId)).toBe(task);
        calling.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, lateTrack);

        expect(media.mock.calls).toEqual([[liveTrack]]);
        expect(liveTrack.stop).not.toHaveBeenCalled();
        expect(lateTrack.stop).not.toHaveBeenCalled();
      } finally {
        manager.stopSession();
      }
      expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(0);
    });

    it.each(['parent-abort', 'task-manager'].flatMap(path => [false, true].map(cleanup => [path, cleanup] as const)))(
      'lateMediaDuringWaitAndAfterWipeStopsTracks: path=%s cleanup=%s', async (path, cleanup) => {
        let acquired: (stream: MediaStream) => void;
        const stream = new Promise<MediaStream>(resolve => { acquired = resolve; });
        const track = {stop: jest.fn()};
        jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValue(stream);
        const contact = {end: jest.fn()};
        const calling = new WebCallingService({} as WebexSDK);
        calling.setLoginOption(LoginOption.BROWSER);
        const call = {answer: jest.fn(), end: jest.fn(), off: jest.fn(), getCallId: () => 'pending-call'};
        calling['call'] = call as any;
        const answer = jest.spyOn(calling, 'answerCall');
        const deregister = jest.spyOn(calling, 'deregisterWebCallingLine');
        const manager = new TaskManager(undefined, contact as any, calling, new EventEmitter() as any, new EventEmitter() as any);
        const controller = new AbortController();
        const task = new WebRTC(contact as any, calling, createTaskData());
        task.bindRecoveryGuard({generation: 1, signal: controller.signal, assertCommandAllowed: jest.fn()});
        manager['taskCollection'] = {[task.data.interactionId]: task};
        manager['call'] = call as any;
        calling.mapCallToTask(call.getCallId(), task.data.interactionId);
        const ended = jest.fn(); task.on(TASK_EVENTS.TASK_END, ended);
        const rejected = jest.fn();
        try {
          const result = task.accept().catch(error => {rejected(error); return error;});
          expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio: true});
          if (path === 'parent-abort') controller.abort();
          else manager.interruptTaskOperations(() => lifecycle.createRegionRecoveryError('RECOVERY_INTERRUPTED'));
          await new Promise(resolve => setImmediate(resolve));
          // Check before invalidation or media resolution so a later guard cannot mask a missing listener.
          expect(rejected).toHaveBeenCalledTimes(1);
          expect((await result).data.reason).toBe('RECOVERY_INTERRUPTED');
          expect(controller.signal.aborted).toBe(path === 'parent-abort');
          expect(manager.getTask(task.data.interactionId)).toBe(task);
          if (cleanup) manager.invalidateRegionalTasks();
          expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(cleanup ? 0 : 1);
          expect(track.stop).not.toHaveBeenCalled();
          acquired({getTracks: () => [track], getAudioTracks: () => [track]} as unknown as MediaStream);
          await new Promise(resolve => setImmediate(resolve));
          expect(track.stop).toHaveBeenCalledTimes(1);
          expect(answer).not.toHaveBeenCalled();
          expect(call.answer).not.toHaveBeenCalled();
          expect(call.end).not.toHaveBeenCalled();
          expect(contact.end).not.toHaveBeenCalled();
          expect(ended).not.toHaveBeenCalled();
          expect(deregister).not.toHaveBeenCalled();
        } finally {
          manager.stopSession();
          task.unregisterWebCallListeners();
        }
      }
    );

    it.each(['none', 'different-id', 'same-id'])(
      'existingOwnedTracksDisposed / hostTracksUntouched / noAnswerEndOrHealthyDeregister: replacement=%s',
      async replacementMode => {
        const owned = [{stop: jest.fn()}, {stop: jest.fn()}];
        const host = {stop: jest.fn()};
        const mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
        const getUserMedia = jest.fn().mockResolvedValue({
          getTracks: () => owned, getAudioTracks: () => [owned[0]],
        });
        Object.defineProperty(navigator, 'mediaDevices', {value: {getUserMedia}, configurable: true});
        const primary = new EventEmitter();
        const calling = new WebCallingService({} as WebexSDK);
        calling.setLoginOption(LoginOption.BROWSER);
        calling.setBrowserVoiceRequired(true);
        const line = {deregister: jest.fn()};
        calling['line'] = line as any;
        calling['handleLineRegistered'](line as any);
        expect(calling.isVoiceReady()).toBe(true);
        const contact = {end: jest.fn(), decline: jest.fn(), wrapup: jest.fn()};
        const manager = new TaskManager(undefined, contact as any, calling, primary as any, new EventEmitter() as any);
        manager.setAgentId('agent-1');
        manager.setConfigFlags({isEndTaskEnabled: true, isEndConsultEnabled: true});
        manager.setWebRtcEnabled(true);
        const makeCall = (id: string) => Object.assign(new EventEmitter(), {
          getCallId: () => id, answer: jest.fn(), end: jest.fn(),
        });
        const call = makeCall('owned-call');
        const replacement = replacementMode === 'none' ? undefined
          : makeCall(replacementMode === 'same-id' ? call.getCallId() : 'replacement-call');
        const cleanup = jest.spyOn(calling, 'cleanUpCall');
        const decline = jest.spyOn(calling, 'declineCall');
        const deregister = jest.spyOn(calling, 'deregisterWebCallingLine');
        try {
          manager.startSession({generation: 1, signal: new AbortController().signal, assertCommandAllowed: jest.fn()});
          const data = createTaskData({type: CC_EVENTS.AGENT_CONTACT});
          primary.emit('message', JSON.stringify({data}));
          const task = manager.getTask(data.interactionId) as WebRTC;
          expect(task).toBeInstanceOf(WebRTC);
          expect(jest.isMockFunction(task.accept)).toBe(false);
          // The calling line owns the call; the real INCOMING_CALL handler must correlate it.
          calling['call'] = call as any;
          calling.emit(LINE_EVENTS.INCOMING_CALL, call);
          expect(manager['call']).toBe(call);
          expect([...calling['callTaskMap']]).toEqual([[call.getCallId(), data.interactionId]]);
          await task.accept();
          expect(getUserMedia.mock.calls).toEqual([[{audio: true}]]);
          expect(call.answer.mock.calls).toEqual([[task['localAudioStream']]]);
          expect(task['localAudioStream']).toBeInstanceOf(LocalMicrophoneStream);
          expect(task['ownedTracks'].size).toBe(2);
          expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
          expect(call.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
          expect(call.listenerCount(CALL_EVENT_KEYS.DISCONNECT)).toBe(1);
          const delivered = jest.fn();
          task.on(TASK_EVENTS.TASK_MEDIA, delivered);
          call.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, host);
          expect(delivered.mock.calls).toEqual([[host]]);

          manager['taskCollection'].alias = task;
          const listeners = [...manager['taskListeners'].get(task)];
          expect(listeners.length).toBeGreaterThan(0);
          for (const [event, listener] of listeners) expect(task.listeners(event)).toContain(listener);
          const invalidated = jest.spyOn(task, 'invalidateForRegionRecovery');
          const controls = task.uiControls;
          const disabledLeg = (leg: typeof controls.main) => Object.fromEntries(
            Object.entries(leg).map(([key, value]) => [key, {...value, isEnabled: false}])
          );
          const disabledControls = {
            ...controls, main: disabledLeg(controls.main), consult: disabledLeg(controls.consult),
          };
          const updated = jest.fn();
          task.on(TASK_EVENTS.TASK_UI_CONTROLS_UPDATED, updated);
          const syntheticSuccess = jest.fn();
          for (const event of [TASK_EVENTS.TASK_END, CC_EVENTS.CONTACT_ENDED, TASK_EVENTS.TASK_WRAPPEDUP]) {
            task.on(event, syntheticSuccess);
            manager.on(event, syntheticSuccess);
          }
          const trackMetric = jest.spyOn(task['metricsManager'], 'trackEvent');
          const off = call.off.bind(call);
          const detached = jest.spyOn(call, 'off').mockImplementation((event, listener) => {
            off(event, listener);
            if (replacement && event === CALL_EVENT_KEYS.REMOTE_MEDIA) {
              // A reentrant calling owner replaces the call while the captured call is detached.
              calling['call'] = replacement as any;
              manager['call'] = replacement as any;
              calling.mapCallToTask(replacement.getCallId(), 'replacement-task');
              calling.answerCall({} as LocalMicrophoneStream, 'replacement-task');
            }
            return call;
          });

          manager.invalidateRegionalTasks();
          manager.invalidateRegionalTasks();
          expect(invalidated).toHaveBeenCalledTimes(1);
          expect(task.uiControls).toEqual(disabledControls);
          expect(updated.mock.calls).toEqual([[disabledControls]]);
          expect(cleanup.mock.calls).toEqual([[call]]);
          for (const track of owned) expect(track.stop).toHaveBeenCalledTimes(1);
          expect(task['ownedTracks'].size).toBe(0);
          expect(task['localAudioStream']).toBeUndefined();
          expect(manager.getAllTasks()).toEqual({});
          expect(manager['taskListeners'].size).toBe(0);
          for (const [event, listener] of listeners) expect(task.listeners(event)).not.toContain(listener);
          expect(task.listeners(TASK_EVENTS.TASK_MEDIA)).toEqual([delivered]);
          expect(calling.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(0);
          expect(call.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(0);
          expect(call.listenerCount(CALL_EVENT_KEYS.DISCONNECT)).toBe(0);
          expect(detached.mock.calls).toEqual([
            [CALL_EVENT_KEYS.REMOTE_MEDIA, calling['handleMediaEvent']],
            [CALL_EVENT_KEYS.DISCONNECT, calling['handleDisconnectEvent']],
          ]);
          expect(manager['call']).toBe(replacement);
          expect(calling['call']).toBe(replacement ?? null);
          expect([...calling['callTaskMap']]).toEqual(replacement
            ? [[replacement.getCallId(), 'replacement-task']] : []);
          // Replaying stale call cleanup cannot detach a replacement, even with the same call ID.
          calling.cleanUpCall(call as any);
          calling.cleanUpCall(call as any);
          expect(detached).toHaveBeenCalledTimes(2);
          expect(manager['call']).toBe(replacement);
          expect(calling['call']).toBe(replacement ?? null);
          expect([...calling['callTaskMap']]).toEqual(replacement
            ? [[replacement.getCallId(), 'replacement-task']] : []);
          if (replacement) {
            expect(replacement.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
            expect(replacement.listenerCount(CALL_EVENT_KEYS.DISCONNECT)).toBe(1);
            expect(replacement.end).not.toHaveBeenCalled();
          }
          call.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, host);
          call.emit(CALL_EVENT_KEYS.DISCONNECT);
          expect(delivered.mock.calls).toEqual([[host]]);
          expect(host.stop).not.toHaveBeenCalled();
          expect(call.end).not.toHaveBeenCalled();
          expect(decline).not.toHaveBeenCalled();
          expect(contact.end).not.toHaveBeenCalled();
          expect(contact.decline).not.toHaveBeenCalled();
          expect(contact.wrapup).not.toHaveBeenCalled();
          expect(syntheticSuccess).not.toHaveBeenCalled();
          expect(trackMetric.mock.calls.filter(([event]) => event === METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS)).toEqual([]);
          expect(deregister).not.toHaveBeenCalled();
          expect(line.deregister).not.toHaveBeenCalled();
          expect(calling['line']).toBe(line);
          expect(calling.isVoiceReady()).toBe(true);
          for (const track of owned) expect(track.stop).toHaveBeenCalledTimes(1);
        } finally {
          manager.stopSession();
          calling.cleanUpCall();
          if (mediaDevices) Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
          else Reflect.deleteProperty(navigator, 'mediaDevices');
          cleanup.mockRestore(); decline.mockRestore(); deregister.mockRestore();
        }
      }
    );

  });

});

describe.each(['accept', 'decline', 'toggleMute'] as const)(
  'T-008 WebRTC %s lifecycle caller catch diagnostics', (operation) => {
    const uploadLogs = WebexRequest.getInstance().uploadLogs;
    let helper: jest.SpyInstance;
    let errorLog: jest.SpyInstance;
    let metrics: jest.SpyInstance;
    let timing: jest.SpyInstance;
    let answerCall: jest.Mock;
    let task: WebRTC;
    let dependency: jest.Mock | jest.SpyInstance;
    let admission: jest.Mock;

    beforeEach(() => {
      helper = jest.spyOn(Utils, 'getErrorDetails');
      errorLog = jest.spyOn(LoggerProxy, 'error').mockImplementation();
      metrics = jest.spyOn(MetricsManager.getInstance(), 'trackEvent').mockImplementation();
      timing = jest.spyOn(MetricsManager.getInstance(), 'timeEvent').mockImplementation();
      answerCall = jest.fn();
      const calling = {
        on: jest.fn(),
        off: jest.fn(),
        answerCall,
        declineCall: jest.fn(),
        muteUnmuteCall: jest.fn(),
      };
      task = new WebRTC({} as any, calling as unknown as WebCallingService, createTaskData());
      dependency = operation === 'accept'
        ? jest.spyOn(navigator.mediaDevices, 'getUserMedia')
        : calling[operation === 'decline' ? 'declineCall' : 'muteUnmuteCall'];
      admission = jest.fn();
      task.bindRecoveryGuard({generation: 1, signal: new AbortController().signal, assertCommandAllowed: admission});
    });

    afterEach(() => {
      task.invalidateForRegionRecovery();
      if (operation === 'accept') (dependency as jest.SpyInstance).mockRestore();
      helper.mockRestore();
      errorLog.mockRestore();
      metrics.mockRestore();
      timing.mockRestore();
    });

    function failDependency(error: Error) {
      if (operation === 'accept') dependency.mockRejectedValue(error);
      else dependency.mockImplementation(() => { throw error; });
    }

    it.each(['RECOVERY_INTERRUPTED', 'STALE_TASK', 'RECOVERY_IN_PROGRESS', 'REGION_RELOAD_REQUIRED'])(
      'lifecycleCallerCatchPreservesIdentityAndReason: %s', async (reason) => {
        const diagnostics = {trackingId: 'webrtc-lifecycle-tracking', status: 409};
        const error = Utils.createRegionRecoveryError(reason, diagnostics);
        const data = error.data;
        failDependency(error);

        await expect(task[operation]()).rejects.toBe(error);
        await flushEventLoopTurn();

        expect(dependency).toHaveBeenCalledTimes(1);
        expect(admission).toHaveBeenCalled();
        expect(helper.mock.calls).toEqual([[error, operation, 'cc']]);
        expect(helper.mock.results[0].value).toEqual({error, reason});
        expect(error.data).toBe(data);
        expect(error.data).toEqual({reason, ...diagnostics});
        expect(error.message).toBe(reason);
        expect(metrics).not.toHaveBeenCalled();
        expect(errorLog).not.toHaveBeenCalled();
        expect(uploadLogs).not.toHaveBeenCalled();
      }
    );

    it('ordinary failure reaches the diagnostic sinks', async () => {
      const error = new Error('ordinary WebRTC failure');
      failDependency(error);
      const method = operation === 'toggleMute' ? 'mute' : operation;

      await expect(task[operation]()).rejects.toThrow(`Error while performing ${method}`);
      await flushEventLoopTurn();

      expect(metrics.mock.calls.map(([event]) => event)).toEqual(operation === 'toggleMute' ? [] : [
        operation === 'accept' ? METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED : METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
      ]);
      expect(errorLog).toHaveBeenCalledTimes(1);
      expect(uploadLogs).toHaveBeenCalledTimes(1);
      expect(uploadLogs).toHaveBeenCalledWith({correlationId: undefined});
    });

    it.each(['RECOVERY_INTERRUPTED', 'STALE_TASK', 'RECOVERY_IN_PROGRESS', 'REGION_RELOAD_REQUIRED'])(
      'admission rejects %s before media, service and diagnostic work', async (reason) => {
        const error = Utils.createRegionRecoveryError(reason);
        admission.mockImplementation(() => { throw error; });

        await expect(task[operation]()).rejects.toBe(error);
        await flushEventLoopTurn();

        expect(admission).toHaveBeenCalledTimes(1);
        expect(dependency).not.toHaveBeenCalled();
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
        expect(answerCall).not.toHaveBeenCalled();
        expect(timing).not.toHaveBeenCalled();
        expect(helper).not.toHaveBeenCalled();
        expect(metrics).not.toHaveBeenCalled();
        expect(errorLog).not.toHaveBeenCalled();
        expect(uploadLogs).not.toHaveBeenCalled();
      }
    );
  }
);
