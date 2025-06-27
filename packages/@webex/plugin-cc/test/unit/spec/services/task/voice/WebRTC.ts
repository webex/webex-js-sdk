import 'jsdom-global/register';
import { LocalMicrophoneStream, CALL_EVENT_KEYS } from '@webex/calling';
import WebRTC from '../../../../../../src/services/task/voice/WebRTC';
import WebCallingService from '../../../../../../src/services/WebCallingService';
import { TaskData, TASK_EVENTS } from '../../../../../../src/services/task/types';
import type { WebexSDK } from '../../../../../../src/types';
import { CC_EVENTS } from '../../../../../../src/services/config/types';

jest.mock('@webex/calling', () => ({
  LocalMicrophoneStream: class {
    constructor(stream) { this.outputStream = stream; }
  },
  CALL_EVENT_KEYS: { REMOTE_MEDIA: 'remoteMedia' },
}));

beforeAll(() => {
  navigator.mediaDevices = { getUserMedia: jest.fn() };
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
    getInstance: jest.fn().mockReturnValue({ uploadLogs: jest.fn() }),
  },
}));

describe('WebRTC Task', () => {
  const dummyContact = {} as any;
  const data = { interactionId: 'int1', type: 'dummyType', interaction: {state: 'connected'} } as TaskData;
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
    webRtc = new WebRTC(
      dummyContact,
      webCallingService,
      data,
      { isEndCallEnabled: true, isEndConsultEnabled: true }
    );
  });

  it('accept() obtains media and answers call', async () => {
    const fakeTrack = {} as any;
    const fakeStream = { getAudioTracks: () => [fakeTrack] } as any;
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(fakeStream);
    await webRtc.accept();
    expect(answerSpy).toHaveBeenCalled();
    const [[streamArg, interactionIdArg]] = webCallingService.answerCall.mock.calls;
    expect(streamArg).toBeInstanceOf(LocalMicrophoneStream);
    expect(interactionIdArg).toBe('int1');
  });

  it('decline() calls declineCall and unregisters listeners', async () => {
    jest.spyOn(webRtc, 'unregisterWebCallListeners');
    const res = await webRtc.decline();
    expect(declineSpy).toHaveBeenCalledWith('int1');
    expect((webRtc).unregisterWebCallListeners).toHaveBeenCalled();
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
      expect(onSpy).toHaveBeenCalledWith(
        CALL_EVENT_KEYS.REMOTE_MEDIA,
        webRtc.handleRemoteMedia
      );
    });

    it('handleRemoteMedia emits TASK_MEDIA event', () => {
      const fakeTrack = {} as any;
      jest.spyOn(webRtc, 'emit');
      (webRtc).handleRemoteMedia(fakeTrack);
      expect(webRtc.emit).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MEDIA,
        fakeTrack
      );
    });
  });

  describe('UI controls', () => {
    beforeEach(() => {
      webRtc = new WebRTC(dummyContact, webCallingService, data, {
        isEndCallEnabled: true,
        isEndConsultEnabled: true,
      });
    });

    it('initialiseUIControls sets accept and decline visible', () => {
      expect(webRtc.taskUiControls.accept.visible).toBe(true);
      expect(webRtc.taskUiControls.decline.visible).toBe(true);
    });

    it('setUIControls for AGENT_CONTACT_ASSIGNED shows mute enabled', () => {
      webRtc.updateTaskData({ ...data, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED });
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(true);
    });

    it('default setUIControls hides mute when wrapup visible', () => {
      webRtc.updateTaskData({ ...data, type: CC_EVENTS.CONTACT_ENDED });
      expect(webRtc.taskUiControls.wrapup.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.visible).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_HELD disables mute', () => {
      webRtc.updateTaskData({ ...data, type: CC_EVENTS.AGENT_CONTACT_HELD });
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_UNHELD re-enables mute', () => {
      webRtc.updateTaskData({ ...data, type: CC_EVENTS.AGENT_CONTACT_UNHELD });
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(true);
    });
  });
});
