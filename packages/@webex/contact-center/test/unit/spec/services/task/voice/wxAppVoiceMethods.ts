import {expect} from '@jest/globals';
import {
  isWebexAppCallingOffer,
  getCallingDeviceDetails,
  getWebexCallingCallId,
  acceptOnWebex,
  rejectOnWebex,
  toggleMuteOnWebex,
  transmitDtmfOnWebex,
  runWxAppAccept,
  runWxAppReject,
  mapWxAppVoiceError,
  WxAppVoiceDeps,
  WxAppVoiceLifecycle,
} from '../../../../../../src/services/task/voice/wxAppVoiceMethods';
import {METHODS} from '../../../../../../src/constants';
import {TaskState} from '../../../../../../src/services/task/state-machine';
import {TaskData} from '../../../../../../src/services/task/types';
import AnswerCallOnWebexService from '../../../../../../src/services/AnswerCallOnWebexService';

const WX_APP_DEVICE = {
  deviceType: 'wxApp',
  deviceId: 'device-id-1',
  deviceCallId: 'call-id-1',
};

function makeParticipants() {
  return {
    'agent-1': {id: 'agent-1', ...WX_APP_DEVICE},
    'customer-1': {id: 'customer-1', pType: 'Customer'},
  };
}

function makeTaskData(overrides: Partial<TaskData> = {}): TaskData {
  return {
    interactionId: 'interaction-1',
    agentId: 'agent-1',
    mediaResourceId: 'media-1',
    interaction: {
      participants: makeParticipants(),
    },
    ...overrides,
  } as unknown as TaskData;
}

function makeMockService(): jest.Mocked<AnswerCallOnWebexService> {
  return {
    answerCall: jest.fn().mockResolvedValue({}),
    rejectCall: jest.fn().mockResolvedValue({}),
    muteCall: jest.fn().mockResolvedValue({}),
    unmuteCall: jest.fn().mockResolvedValue({}),
    transmitDtmf: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<AnswerCallOnWebexService>;
}

function makeDeps(overrides: Partial<WxAppVoiceDeps> = {}): WxAppVoiceDeps {
  let muted = false;

  return {
    enableWxBetterTogether: true,
    answerCallOnWebexService: makeMockService(),
    agentId: 'agent-1',
    getTaskData: () => makeTaskData(),
    getTaskState: () => TaskState.OFFERED,
    getWxAppMuted: () => muted,
    setWxAppMuted: (val) => {
      muted = val;
    },
    ...overrides,
  };
}

function makeLifecycle(overrides: Partial<WxAppVoiceLifecycle> = {}): WxAppVoiceLifecycle {
  return {
    setWxAppAcceptInFlight: jest.fn(),
    setWxAppAnswerPending: jest.fn(),
    resetWxAppMuted: jest.fn(),
    syncWxAppMuteFromCallDetails: jest.fn().mockResolvedValue(undefined),
    mapWxAppVoiceError: jest.fn((error: unknown) => {
      throw error;
    }),
    ...overrides,
  };
}

describe('isWebexAppCallingOffer', () => {
  it('returns true when enableWxBetterTogether is true, state is OFFERED, and wxApp device details exist', () => {
    expect(isWebexAppCallingOffer(makeDeps())).toBe(true);
  });

  it('returns false when enableWxBetterTogether is false', () => {
    expect(isWebexAppCallingOffer(makeDeps({enableWxBetterTogether: false}))).toBe(false);
  });

  it('returns false when task state is not OFFERED', () => {
    expect(isWebexAppCallingOffer(makeDeps({getTaskState: () => TaskState.CONNECTED}))).toBe(false);
  });

  it('returns false when no wxApp participant is found', () => {
    const deps = makeDeps({
      getTaskData: () =>
        makeTaskData({
          interaction: {
            participants: {'customer-1': {id: 'customer-1'}},
          } as any,
        }),
    });

    expect(isWebexAppCallingOffer(deps)).toBe(false);
  });
});

describe('getCallingDeviceDetails', () => {
  it('returns device details for wxApp participant', () => {
    const result = getCallingDeviceDetails(makeDeps());

    expect(result).toEqual({
      deviceType: 'wxApp',
      deviceId: 'device-id-1',
      deviceCallId: 'call-id-1',
    });
  });

  it('returns undefined when no wxApp participant is present', () => {
    const deps = makeDeps({
      getTaskData: () =>
        makeTaskData({
          interaction: {
            participants: {'customer-1': {id: 'customer-1'}},
          } as any,
        }),
    });

    expect(getCallingDeviceDetails(deps)).toBeUndefined();
  });
});

describe('getWebexCallingCallId', () => {
  it('returns null when state is OFFERED', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.OFFERED}))).toBeNull();
  });

  it('returns null when state is IDLE', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.IDLE}))).toBeNull();
  });

  it('returns null when state is TERMINATED', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.TERMINATED}))).toBeNull();
  });

  it('returns null when state is COMPLETED', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.COMPLETED}))).toBeNull();
  });

  it('returns null when state is WRAPPING_UP', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.WRAPPING_UP}))).toBeNull();
  });

  it('returns the deviceCallId when state is CONNECTED', () => {
    expect(getWebexCallingCallId(makeDeps({getTaskState: () => TaskState.CONNECTED}))).toBe(
      'call-id-1'
    );
  });

  it('returns null when state is CONNECTED but no wxApp participant', () => {
    const deps = makeDeps({
      getTaskState: () => TaskState.CONNECTED,
      getTaskData: () =>
        makeTaskData({
          interaction: {
            participants: {'customer-1': {id: 'customer-1'}},
          } as any,
        }),
    });

    expect(getWebexCallingCallId(deps)).toBeNull();
  });
});

describe('acceptOnWebex', () => {
  it('calls answerCall with deviceCallId and deviceId', async () => {
    const mockSvc = makeMockService();
    const deps = makeDeps({answerCallOnWebexService: mockSvc});

    await acceptOnWebex(deps);

    expect(mockSvc.answerCall).toHaveBeenCalledWith({
      callId: 'call-id-1',
      endpointId: 'device-id-1',
      lineOwnerId: undefined,
    });
  });

  it('passes lineOwnerId when provided', async () => {
    const mockSvc = makeMockService();
    const deps = makeDeps({answerCallOnWebexService: mockSvc});

    await acceptOnWebex(deps, {lineOwnerId: 'lo-1'});

    expect(mockSvc.answerCall).toHaveBeenCalledWith(
      expect.objectContaining({lineOwnerId: 'lo-1'})
    );
  });

  it('defaults lineOwnerId from encoded participant owner when not provided', async () => {
    const encodedOwner = Buffer.from('people/lo-decoded').toString('base64');
    const mockSvc = makeMockService();
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskData: () =>
        makeTaskData({
          interaction: {
            participants: {
              'agent-1': {id: 'agent-1', ...WX_APP_DEVICE, lineOwnerId: encodedOwner},
              'customer-1': {id: 'customer-1', pType: 'Customer'},
            },
          } as any,
        }),
    });

    await acceptOnWebex(deps);

    expect(mockSvc.answerCall).toHaveBeenCalledWith(
      expect.objectContaining({lineOwnerId: 'lo-decoded'})
    );
  });

  it('throws when enableWxBetterTogether is false', async () => {
    const deps = makeDeps({enableWxBetterTogether: false});

    await expect(acceptOnWebex(deps)).rejects.toThrow();
  });

  it('throws when task is not in OFFERED state', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.CONNECTED});

    await expect(acceptOnWebex(deps)).rejects.toThrow();
  });

  it('throws when device details are unavailable', async () => {
    const deps = makeDeps({
      getTaskData: () =>
        makeTaskData({
          interaction: {
            participants: {'customer-1': {id: 'customer-1'}},
          } as any,
        }),
    });

    await expect(acceptOnWebex(deps)).rejects.toThrow();
  });
});

describe('rejectOnWebex', () => {
  it('calls rejectCall with deviceCallId', async () => {
    const mockSvc = makeMockService();
    const deps = makeDeps({answerCallOnWebexService: mockSvc});

    await rejectOnWebex(deps);

    expect(mockSvc.rejectCall).toHaveBeenCalledWith({
      callId: 'call-id-1',
      lineOwnerId: undefined,
    });
  });

  it('throws when task is not in OFFERED state', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.CONNECTED});

    await expect(rejectOnWebex(deps)).rejects.toThrow();
  });

  it('throws when enableWxBetterTogether is false', async () => {
    const deps = makeDeps({enableWxBetterTogether: false});

    await expect(rejectOnWebex(deps)).rejects.toThrow();
  });
});

describe('toggleMuteOnWebex', () => {
  it('calls muteCall when not currently muted', async () => {
    const mockSvc = makeMockService();
    let muted = false;
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
      getWxAppMuted: () => muted,
      setWxAppMuted: (val) => {
        muted = val;
      },
    });

    await toggleMuteOnWebex(deps);

    expect(mockSvc.muteCall).toHaveBeenCalledWith({callId: 'call-id-1', lineOwnerId: undefined});
    expect(muted).toBe(true);
  });

  it('calls unmuteCall when currently muted', async () => {
    const mockSvc = makeMockService();
    let muted = true;
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
      getWxAppMuted: () => muted,
      setWxAppMuted: (val) => {
        muted = val;
      },
    });

    await toggleMuteOnWebex(deps);

    expect(mockSvc.unmuteCall).toHaveBeenCalled();
    expect(muted).toBe(false);
  });

  it('throws when call ID is unavailable (state is OFFERED)', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.OFFERED});

    await expect(toggleMuteOnWebex(deps)).rejects.toThrow('WxApp call ID is unavailable');
  });

  it('throws when enableWxBetterTogether is false', async () => {
    const deps = makeDeps({enableWxBetterTogether: false, getTaskState: () => TaskState.CONNECTED});

    await expect(toggleMuteOnWebex(deps)).rejects.toThrow();
  });

  it('uses options.muted=true even when internal wxAppMuted is true (desync regression)', async () => {
    const mockSvc = makeMockService();
    let muted = true;
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
      getWxAppMuted: () => muted,
      setWxAppMuted: (val) => {
        muted = val;
      },
    });

    await toggleMuteOnWebex(deps, {muted: true});

    expect(mockSvc.muteCall).toHaveBeenCalledWith({callId: 'call-id-1', lineOwnerId: undefined});
    expect(mockSvc.unmuteCall).not.toHaveBeenCalled();
    expect(muted).toBe(true);
  });

  it('uses options.muted=false even when internal wxAppMuted is false (desync regression)', async () => {
    const mockSvc = makeMockService();
    let muted = false;
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
      getWxAppMuted: () => muted,
      setWxAppMuted: (val) => {
        muted = val;
      },
    });

    await toggleMuteOnWebex(deps, {muted: false});

    expect(mockSvc.unmuteCall).toHaveBeenCalledWith({callId: 'call-id-1', lineOwnerId: undefined});
    expect(mockSvc.muteCall).not.toHaveBeenCalled();
    expect(muted).toBe(false);
  });
});

describe('transmitDtmfOnWebex', () => {
  it('calls transmitDtmf with callId and dtmf', async () => {
    const mockSvc = makeMockService();
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
    });

    await transmitDtmfOnWebex(deps, {dtmf: '5'});

    expect(mockSvc.transmitDtmf).toHaveBeenCalledWith({
      callId: 'call-id-1',
      dtmf: '5',
      lineOwnerId: undefined,
    });
  });

  it('passes lineOwnerId when provided', async () => {
    const mockSvc = makeMockService();
    const deps = makeDeps({
      answerCallOnWebexService: mockSvc,
      getTaskState: () => TaskState.CONNECTED,
    });

    await transmitDtmfOnWebex(deps, {dtmf: '9', lineOwnerId: 'lo-1'});

    expect(mockSvc.transmitDtmf).toHaveBeenCalledWith(
      expect.objectContaining({lineOwnerId: 'lo-1'})
    );
  });

  it('throws when call ID is unavailable', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.OFFERED});

    await expect(transmitDtmfOnWebex(deps, {dtmf: '1'})).rejects.toThrow(
      'WxApp call ID is unavailable'
    );
  });
});

describe('runWxAppAccept', () => {
  it('sets in-flight and pending flags, resets mute, and syncs after answer', async () => {
    const deps = makeDeps();
    const lifecycle = makeLifecycle();

    await runWxAppAccept(deps, lifecycle);

    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenNthCalledWith(1, true);
    expect(lifecycle.setWxAppAnswerPending).toHaveBeenCalledWith(true);
    expect(deps.answerCallOnWebexService!.answerCall).toHaveBeenCalled();
    expect(lifecycle.resetWxAppMuted).toHaveBeenCalled();
    expect(lifecycle.syncWxAppMuteFromCallDetails).toHaveBeenCalled();
    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenLastCalledWith(false);
  });

  it('clears pending and maps error when answer fails', async () => {
    const deps = makeDeps();
    const error = new Error('answer failed');
    deps.answerCallOnWebexService!.answerCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(runWxAppAccept(deps, lifecycle)).rejects.toThrow('answer failed');

    expect(lifecycle.setWxAppAnswerPending).toHaveBeenCalledWith(false);
    expect(lifecycle.mapWxAppVoiceError).toHaveBeenCalledWith(error, METHODS.ACCEPT);
    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenLastCalledWith(false);
  });
});

describe('runWxAppReject', () => {
  it('maps error when reject fails', async () => {
    const deps = makeDeps();
    const error = new Error('reject failed');
    deps.answerCallOnWebexService!.rejectCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(runWxAppReject(deps, lifecycle)).rejects.toThrow('reject failed');

    expect(lifecycle.mapWxAppVoiceError).toHaveBeenCalledWith(error, METHODS.REJECT);
  });
});

describe('mapWxAppVoiceError', () => {
  it('rethrows normalized wxApp telephony errors without remapping', () => {
    const normalized = Object.assign(new Error('TELEPHONY_ERROR'), {
      isWxAppTelephonyError: true,
      trackingId: 'track-wxapp-1',
    });

    expect(() => mapWxAppVoiceError(normalized, 'accept', 'cc')).toThrow(normalized);
  });
});
