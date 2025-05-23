import 'jsdom-global/register';
import { LocalMicrophoneStream } from '@webex/calling';
import WebRTC from '../../../../../../src/services/task/voice/WebRTC';
import { TaskData } from '../../../../../../src/services/task/types';

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
  const data = { interactionId: 'int1', type: 'dummyType' } as unknown as TaskData;
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
});
