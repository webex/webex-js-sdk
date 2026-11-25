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
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import * as Utils from '../../../../../../src/services/core/Utils';

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
        const brokenTrack = {stop: jest.fn(() => {throw new Error('track stop failed');})};
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
          acquired({getTracks: () => [brokenTrack, track], getAudioTracks: () => [track]} as unknown as MediaStream);
          await new Promise(resolve => setImmediate(resolve));
          expect(brokenTrack.stop).toHaveBeenCalledTimes(1);
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

    it.each([false, true])('disposes SDK media while preserving host tracks and line ownership: replacement=%s', async (replace) => {
      const owned = [{stop: jest.fn()}, {stop: jest.fn()}];
      const host = {stop: jest.fn()};
      const getUserMedia = jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue({
        getTracks: () => owned, getAudioTracks: () => [owned[0]],
      } as unknown as MediaStream);
      const primary = new EventEmitter();
      const calling = new WebCallingService({} as WebexSDK);
      calling.setLoginOption(LoginOption.BROWSER);
      calling.setBrowserVoiceRequired(true);
      const line = {deregister: jest.fn()};
      calling['line'] = line as any;
      calling['handleLineRegistered'](line as any);
      const contact = {end: jest.fn(), decline: jest.fn(), wrapup: jest.fn()};
      const manager = new TaskManager(undefined, contact as any, calling, primary as any, new EventEmitter() as any);
      manager.setAgentId('agent-1');
      manager.setConfigFlags({isEndTaskEnabled: true, isEndConsultEnabled: true});
      manager.setWebRtcEnabled(true);
      const makeCall = () => Object.assign(new EventEmitter(), {
        getCallId: () => 'owned-call', answer: jest.fn(), end: jest.fn(),
      });
      const call = makeCall();
      const replacement = replace ? makeCall() : undefined;
      try {
        manager.startSession({generation: 1, signal: new AbortController().signal, assertCommandAllowed: jest.fn()});
        const data = createTaskData({type: CC_EVENTS.AGENT_CONTACT});
        primary.emit('message', JSON.stringify({data}));
        const task = manager.getTask(data.interactionId) as WebRTC;
        calling['call'] = call as any;
        calling.emit(LINE_EVENTS.INCOMING_CALL, call);
        await task.accept();
        expect(call.answer).toHaveBeenCalledWith(task['localAudioStream']);
        const media = jest.fn();
        const ended = jest.fn();
        task.on(TASK_EVENTS.TASK_MEDIA, media);
        task.on(TASK_EVENTS.TASK_END, ended);
        call.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, host);
        expect(media.mock.calls).toEqual([[host]]);

        if (replacement) {
          const off = call.off.bind(call);
          jest.spyOn(call, 'off').mockImplementation((event, listener) => {
            off(event, listener);
            if (event === CALL_EVENT_KEYS.REMOTE_MEDIA) {
              calling['call'] = replacement as any;
              manager['call'] = replacement as any;
              calling.mapCallToTask(replacement.getCallId(), 'replacement-task');
              calling.answerCall({} as LocalMicrophoneStream, 'replacement-task');
            }
            return call;
          });
        }
        manager.invalidateRegionalTasks();
        manager.invalidateRegionalTasks();
        calling.cleanUpCall(call as any); // A stale owner may still try to clean up.
        call.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, host);
        call.emit(CALL_EVENT_KEYS.DISCONNECT);

        for (const track of owned) expect(track.stop).toHaveBeenCalledTimes(1);
        expect(task['localAudioStream']).toBeUndefined();
        expect(host.stop).not.toHaveBeenCalled();
        expect(media.mock.calls).toEqual([[host]]);
        expect(call.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(0);
        expect(call.listenerCount(CALL_EVENT_KEYS.DISCONNECT)).toBe(0);
        expect(manager['call']).toBe(replacement);
        expect(calling['call']).toBe(replacement ?? null);
        if (replacement) {
          expect(calling.getTaskIdForCall(replacement.getCallId())).toBe('replacement-task');
          expect(replacement.listenerCount(CALL_EVENT_KEYS.REMOTE_MEDIA)).toBe(1);
          expect(replacement.listenerCount(CALL_EVENT_KEYS.DISCONNECT)).toBe(1);
          expect(replacement.end).not.toHaveBeenCalled();
        }
        expect(call.end).not.toHaveBeenCalled();
        expect(contact.end).not.toHaveBeenCalled();
        expect(contact.decline).not.toHaveBeenCalled();
        expect(contact.wrapup).not.toHaveBeenCalled();
        expect(ended).not.toHaveBeenCalled();
        expect(line.deregister).not.toHaveBeenCalled();
        expect(calling.isVoiceReady()).toBe(true);
      } finally {
        manager.stopSession();
        calling.cleanUpCall();
        getUserMedia.mockRestore();
      }
    });
  });
});

describe('WebRTC command admission', () => {
  it.each(['accept', 'decline', 'toggleMute'] as const)('blocks %s before accessing calling or media', async (operation) => {
    const calling = {on: jest.fn(), off: jest.fn(), answerCall: jest.fn(), declineCall: jest.fn(), muteUnmuteCall: jest.fn()};
    const task = new WebRTC({} as any, calling as unknown as WebCallingService, createTaskData());
    const error = Utils.createRegionRecoveryError('RECOVERY_IN_PROGRESS');
    task.bindRecoveryGuard({generation: 1, signal: new AbortController().signal, assertCommandAllowed: () => {throw error;}});
    const getUserMedia = jest.spyOn(navigator.mediaDevices, 'getUserMedia');
    try {
      await expect(task[operation]()).rejects.toBe(error);
      expect(getUserMedia).not.toHaveBeenCalled();
      expect(calling.answerCall).not.toHaveBeenCalled();
      expect(calling.declineCall).not.toHaveBeenCalled();
      expect(calling.muteUnmuteCall).not.toHaveBeenCalled();
    } finally {
      task.invalidateForRegionRecovery();
      getUserMedia.mockRestore();
    }
  });

  describe.each([
    ['accept', METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED],
    ['decline', METRIC_EVENT_NAMES.TASK_DECLINE_FAILED],
    ['toggleMute', undefined],
  ] as const)('%s dependency failure', (operation, failureMetric) => {
    it.each(['recovery', 'ordinary'] as const)('preserves %s error behavior', async (kind) => {
      const error = kind === 'recovery'
        ? Utils.createRegionRecoveryError('REGION_RELOAD_REQUIRED', {status: 409})
        : new Error('ordinary Calling failure');
      const fail = jest.fn(() => {throw error;});
      const calling = {on: jest.fn(), off: jest.fn(), declineCall: fail, muteUnmuteCall: fail};
      const task = new WebRTC({} as any, calling as unknown as WebCallingService, createTaskData());
      const media = jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(error);
      const metrics = jest.spyOn(MetricsManager.getInstance(), 'trackEvent').mockImplementation();
      try {
        const action = task[operation]();
        if (kind === 'recovery') await expect(action).rejects.toBe(error);
        else await expect(action).rejects.toThrow('Error while performing');
        expect(operation === 'accept' ? media : fail).toHaveBeenCalledTimes(1);
        expect(metrics.mock.calls.map(([event]) => event))
          .toEqual(kind === 'ordinary' && failureMetric ? [failureMetric] : []);
      } finally {
        task.invalidateForRegionRecovery();
        media.mockRestore();
        metrics.mockRestore();
      }
    });
  });
});
