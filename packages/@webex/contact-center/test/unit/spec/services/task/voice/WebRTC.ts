import 'jsdom-global/register';
import {LocalMicrophoneStream, CALL_EVENT_KEYS} from '@webex/calling';
import WebRTC from '../../../../../../src/services/task/voice/WebRTC';
import WebCallingService from '../../../../../../src/services/WebCallingService';
import {TaskData, TASK_EVENTS} from '../../../../../../src/services/task/types';
import type {WebexSDK} from '../../../../../../src/types';
import {TaskEvent, TaskEventPayload} from '../../../../../../src/services/task/state-machine';
import {createTaskData} from '../taskTestUtils';

jest.mock('@webex/calling', () => ({
  LocalMicrophoneStream: class {
    constructor(stream) {
      this.outputStream = stream;
    }
  },
  CALL_EVENT_KEYS: {REMOTE_MEDIA: 'remoteMedia'},
}));

beforeAll(() => {
  navigator.mediaDevices = {getUserMedia: jest.fn()};
  // @ts-ignore
  global.MediaStream = class {
    constructor(private tracks: MediaStreamTrack[]) {}
    getAudioTracks() {
      return this.tracks;
    }
  } as typeof MediaStream;
});

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn()}),
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
    const fakeStream = {getAudioTracks: () => [fakeTrack]} as any;
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
});
