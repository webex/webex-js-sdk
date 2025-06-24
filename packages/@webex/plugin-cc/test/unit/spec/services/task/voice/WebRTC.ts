import 'jsdom-global/register';
import { LocalMicrophoneStream, CALL_EVENT_KEYS } from '@webex/calling';
import WebRTC from '../../../../../../src/services/task/voice/WebRTC';
import { TaskData, TASK_EVENTS } from '../../../../../../src/services/task/types';
import { CC_EVENTS } from '../../../../../../src/services/config/types';

jest.mock('@webex/calling', () => ({
  LocalMicrophoneStream: class {
    constructor(stream: any) { this.outputStream = stream; }
  },
  CALL_EVENT_KEYS: { REMOTE_MEDIA: 'remoteMedia' },
}));

beforeAll(() => {
  navigator.mediaDevices = { getUserMedia: jest.fn() };
  // @ts-ignore
  global.MediaStream = class {
    constructor(private tracks: any[]) {}
    getAudioTracks() { return this.tracks; }
  };
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
  const webCallingService = {
    on: jest.fn(),
    off: jest.fn(),
    answerCall: jest.fn(),
    declineCall: jest.fn(),
    muteUnmuteCall: jest.fn(),
  };

  let webRtc: WebRTC;

  beforeEach(() => {
    webRtc = new WebRTC(
      dummyContact,
      webCallingService as any,
      data,
      { isEndCallEnabled: true, isEndConsultEnabled: true }
    );
  });

  it('accept() obtains media and answers call', async () => {
    const fakeTrack = {} as any;
    const fakeStream = { getAudioTracks: () => [fakeTrack] } as any;
    jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(fakeStream);
    await webRtc.accept();
    expect(webCallingService.answerCall).toHaveBeenCalled();
    const [[streamArg, interactionIdArg]] = webCallingService.answerCall.mock.calls;
    expect(streamArg).toBeInstanceOf(LocalMicrophoneStream);
    expect(interactionIdArg).toBe('int1');
  });

  it('decline() calls declineCall and unregisters listeners', async () => {
    jest.spyOn(webRtc as any, 'unregisterWebCallListeners');
    const res = await webRtc.decline();
    expect(webCallingService.declineCall).toHaveBeenCalledWith('int1');
    expect((webRtc as any).unregisterWebCallListeners).toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  it('toggleMute() calls muteUnmuteCall with stored localAudioStream', async () => {
    const dummyStream = {} as any;
    (webRtc as any).localAudioStream = dummyStream;
    await webRtc.toggleMute();
    expect(webCallingService.muteUnmuteCall).toHaveBeenCalledWith(dummyStream);
  });

  describe('WebRTC internal methods', () => {
    it('registerWebCallListeners binds remote media event', () => {
      (webRtc as any).registerWebCallListeners();
      expect(webCallingService.on).toHaveBeenCalledWith(
        CALL_EVENT_KEYS.REMOTE_MEDIA,
        (webRtc as any).handleRemoteMedia
      );
    });

    it('handleRemoteMedia emits TASK_MEDIA event', () => {
      const fakeTrack = {} as any;
      jest.spyOn(webRtc, 'emit');
      (webRtc as any).handleRemoteMedia(fakeTrack);
      expect(webRtc.emit).toHaveBeenCalledWith(
        TASK_EVENTS.TASK_MEDIA,
        fakeTrack
      );
    });
  });

  describe('UI controls', () => {
    let webRtc: WebRTC;
    beforeEach(() => {
      webRtc = new WebRTC(dummyContact, webCallingService as any, data, {
        isEndCallEnabled: true,
        isEndConsultEnabled: true,
      });
    });

    it('initialiseUIControls sets accept and decline visible', () => {
      expect(webRtc.taskUiControls.accept.visible).toBe(true);
      expect(webRtc.taskUiControls.decline.visible).toBe(true);
    });

    it('setUIControls for AGENT_CONTACT_ASSIGNED shows mute', () => {
      const assignedData = { ...data, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED } as any;
      webRtc.updateTaskData(assignedData);
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(true);
    });

    it('default setUIControls hides mute when wrapup visible', () => {
      const endedData = { ...data, type: CC_EVENTS.CONTACT_ENDED } as any;
      webRtc.updateTaskData(endedData);
      expect(webRtc.taskUiControls.wrapup.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.visible).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_HELD disables mute', () => {
      const endedData = { ...data, type: CC_EVENTS.AGENT_CONTACT_HELD } as any;
      webRtc.updateTaskData(endedData);
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(false);
    });

    it('setUIControls for AGENT_CONTACT_UNHELD re-enables mute', () => {
      const endedData = { ...data, type: CC_EVENTS.AGENT_CONTACT_UNHELD } as any;
      webRtc.updateTaskData(endedData);
      expect(webRtc.taskUiControls.mute.visible).toBe(true);
      expect(webRtc.taskUiControls.mute.enabled).toBe(true);
    });
  });
});
