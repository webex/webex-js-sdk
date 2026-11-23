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
  runWxAppOutdialDecline,
  runWxAppReject,
  runWxAppToggleMute,
  runWxAppTransmitDtmf,
  mapWxAppVoiceError,
  WxAppVoiceDeps,
  WxAppVoiceLifecycle,
} from '../../../../../../src/services/task/voice/wxAppVoiceMethods';
import {METHODS} from '../../../../../../src/constants';
import {TaskState} from '../../../../../../src/services/task/state-machine';
import {TaskData} from '../../../../../../src/services/task/types';
import AnswerCallOnWebexService from '../../../../../../src/services/AnswerCallOnWebexService';
import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import LoggerProxy from '../../../../../../src/logger-proxy';
import WebexRequest from '../../../../../../src/services/core/WebexRequest';
import * as Utils from '../../../../../../src/services/core/Utils';
import * as wxAppDiagnosticLogging from '../../../../../../src/services/wxAppDiagnosticLogging';
import {createDeferred, flushEventLoopTurn} from '../../../../fixtures/aiSummaryTestUtils';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({uploadLogs: jest.fn().mockResolvedValue(undefined)}),
  },
}));

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

function makeMockMetricsManager(): jest.Mocked<Pick<MetricsManager, 'timeEvent' | 'trackEvent'>> {
  return {
    timeEvent: jest.fn(),
    trackEvent: jest.fn(),
  };
}

function makeDeps(overrides: Partial<WxAppVoiceDeps> = {}): WxAppVoiceDeps {
  let muted = false;

  return {
    enableWxBetterTogether: true,
    answerCallOnWebexService: makeMockService(),
    agentId: 'agent-1',
    metricsManager: makeMockMetricsManager() as unknown as MetricsManager,
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

    expect(deps.metricsManager.timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED,
    ]);
    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_offer_ready',
        hasDeviceCallId: true,
        hasDeviceId: true,
      }),
      ['operational', 'behavioral']
    );
    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenNthCalledWith(1, true);
    expect(lifecycle.setWxAppAnswerPending).toHaveBeenCalledWith(true);
    expect(deps.answerCallOnWebexService!.answerCall).toHaveBeenCalled();
    expect(lifecycle.resetWxAppMuted).toHaveBeenCalled();
    expect(lifecycle.syncWxAppMuteFromCallDetails).toHaveBeenCalled();
    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenLastCalledWith(false);
  });

  it('clears pending and maps error when answer fails', async () => {
    const deps = makeDeps();
    const error = Object.assign(new Error('answer failed'), {trackingId: 'track-1'});
    deps.answerCallOnWebexService!.answerCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(runWxAppAccept(deps, lifecycle)).rejects.toThrow('answer failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED,
      expect.objectContaining({
        taskId: 'interaction-1',
        trackingId: 'track-1',
        acceptReason: 'wxApp_offer_ready',
      }),
      ['operational', 'behavioral']
    );
    expect(lifecycle.setWxAppAnswerPending).toHaveBeenCalledWith(false);
    expect(lifecycle.mapWxAppVoiceError).toHaveBeenCalledWith(error, METHODS.ACCEPT);
    expect(lifecycle.setWxAppAcceptInFlight).toHaveBeenLastCalledWith(false);
  });

  it('includes captured acceptReason on accept success when pending', async () => {
    const deps = makeDeps();
    const lifecycle = makeLifecycle();

    await runWxAppAccept(deps, lifecycle, {acceptReason: 'wxApp_answer_pending'});

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_answer_pending',
      }),
      ['operational', 'behavioral']
    );
  });

  it('includes captured acceptReason on accept failure when pending', async () => {
    const deps = makeDeps();
    const error = new Error('answer failed');
    deps.answerCallOnWebexService!.answerCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(
      runWxAppAccept(deps, lifecycle, {acceptReason: 'wxApp_answer_pending'})
    ).rejects.toThrow('answer failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_answer_pending',
      }),
      ['operational', 'behavioral']
    );
  });
});

describe('runWxAppReject', () => {
  it('tracks wxApp decline success metric', async () => {
    const deps = makeDeps();
    const lifecycle = makeLifecycle();

    await runWxAppReject(deps, lifecycle);

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_offer_ready',
        hasDeviceCallId: true,
        hasDeviceId: true,
      }),
      ['operational', 'behavioral']
    );
  });

  it('maps error when reject fails', async () => {
    const deps = makeDeps();
    const error = new Error('reject failed');
    deps.answerCallOnWebexService!.rejectCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(runWxAppReject(deps, lifecycle)).rejects.toThrow('reject failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_offer_ready',
      }),
      ['operational', 'behavioral']
    );
    expect(lifecycle.mapWxAppVoiceError).toHaveBeenCalledWith(error, METHODS.REJECT);
  });

  it('includes captured acceptReason on decline success when pending', async () => {
    const deps = makeDeps();
    const lifecycle = makeLifecycle();

    await runWxAppReject(deps, lifecycle, {acceptReason: 'wxApp_answer_pending'});

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_answer_pending',
      }),
      ['operational', 'behavioral']
    );
  });

  it('includes captured acceptReason on decline failure when pending', async () => {
    const deps = makeDeps();
    const error = new Error('reject failed');
    deps.answerCallOnWebexService!.rejectCall = jest.fn().mockRejectedValue(error);
    const lifecycle = makeLifecycle();

    await expect(
      runWxAppReject(deps, lifecycle, {acceptReason: 'wxApp_answer_pending'})
    ).rejects.toThrow('reject failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_answer_pending',
      }),
      ['operational', 'behavioral']
    );
  });
});

describe('runWxAppOutdialDecline', () => {
  it('tracks wxApp decline success metric for outdial cancel', async () => {
    const deps = makeDeps();
    const cancelResult = {type: 'RoutingMessage', trackingId: 'track-1', data: {}};

    const result = await runWxAppOutdialDecline(deps, async () => cancelResult);

    expect(result).toBe(cancelResult);
    expect(deps.metricsManager.timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
    ]);
    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_offer_ready',
        hasDeviceCallId: true,
        hasDeviceId: true,
      }),
      ['operational', 'behavioral']
    );
  });

  it('tracks post-accept acceptReason on outdial cancel when provided', async () => {
    const deps = makeDeps();
    const cancelResult = {type: 'RoutingMessage', trackingId: 'track-1', data: {}};

    await runWxAppOutdialDecline(deps, async () => cancelResult, {
      acceptReason: 'wxApp_answer_pending',
    });

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        acceptReason: 'wxApp_answer_pending',
      }),
      ['operational', 'behavioral']
    );
  });

  it('tracks wxApp decline failed metric and rethrows when cancel fails', async () => {
    const deps = makeDeps();
    const error = new Error('cancel failed');

    await expect(
      runWxAppOutdialDecline(deps, async () => {
        throw error;
      })
    ).rejects.toThrow('cancel failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      expect.objectContaining({taskId: 'interaction-1'}),
      ['operational', 'behavioral']
    );
  });

  it('preserves AQM correlation fields when cancel fails with error.details', async () => {
    const deps = makeDeps();
    const error = Object.assign(new Error('AQM failed'), {
      details: {
        trackingId: 'aqm-track-1',
        orgId: 'org-1',
        type: 'Service.aqm.task.cancel',
        data: {reason: 'TASK_NOT_FOUND', reasonCode: 404, agentId: 'agent-1'},
      },
    });

    await expect(
      runWxAppOutdialDecline(deps, async () => {
        throw error;
      })
    ).rejects.toThrow('AQM failed');

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED,
      expect.objectContaining({
        taskId: 'interaction-1',
        trackingId: 'aqm-track-1',
        failureReason: 'TASK_NOT_FOUND',
        reasonCode: 404,
        hasDeviceCallId: true,
        hasDeviceId: true,
      }),
      ['operational', 'behavioral']
    );
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

describe('runWxAppToggleMute metrics', () => {
  it('tracks mute success metric', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.CONNECTED});
    const lifecycle = makeLifecycle();

    await runWxAppToggleMute(deps, lifecycle);

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS,
      expect.objectContaining({taskId: 'interaction-1', targetMuted: true}),
      ['operational', 'behavioral']
    );
  });
});

describe('runWxAppTransmitDtmf metrics', () => {
  it('tracks dtmf success metric with digit length only', async () => {
    const deps = makeDeps({getTaskState: () => TaskState.CONNECTED});
    const lifecycle = makeLifecycle();

    await runWxAppTransmitDtmf(deps, lifecycle, {dtmf: '123'});

    expect(deps.metricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_SUCCESS,
      expect.objectContaining({
        taskId: 'interaction-1',
        dtmfLength: 3,
        hasDeviceCallId: true,
        hasDeviceId: true,
      }),
      ['operational', 'behavioral']
    );
  });
});

describe.each([
  ['accept', 'answerCall', METHODS.ACCEPT, METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_FAILED],
  ['reject', 'rejectCall', METHODS.REJECT, METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED],
  ['toggleMute', 'muteCall', METHODS.TOGGLE_MUTE, METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_FAILED],
  ['transmitDtmf', 'transmitDtmf', METHODS.TRANSMIT_DTMF, METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_FAILED],
  ['outdialDecline', 'cancelTask', METHODS.REJECT, METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_FAILED],
] as const)('T-008/T-009 wxApp %s regional lifetime', (operation, serviceMethod, method, failedMetric) => {
  const uploadLogs = WebexRequest.getInstance().uploadLogs;
  let helper: jest.SpyInstance;
  let errorLog: jest.SpyInstance;
  let actionLog: jest.SpyInstance;
  let log: jest.SpyInstance;
  let deps: WxAppVoiceDeps;
  let lifecycle: WxAppVoiceLifecycle;
  let dependency: jest.Mock;
  let admission: jest.Mock;
  let invoke: () => Promise<unknown>;
  let onCancelCompleted: () => void;

  const successMetric = {
    accept: METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS,
    reject: METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
    toggleMute: METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS,
    transmitDtmf: METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_SUCCESS,
    outdialDecline: METRIC_EVENT_NAMES.WXAPP_TASK_DECLINE_SUCCESS,
  }[operation];
  const action = {
    accept: 'accept', reject: 'decline', toggleMute: 'mute', transmitDtmf: 'dtmf',
  }[operation];

  beforeEach(() => {
    helper = jest.spyOn(Utils, 'getErrorDetails');
    errorLog = jest.spyOn(LoggerProxy, 'error').mockImplementation();
    log = jest.spyOn(LoggerProxy, 'log').mockImplementation();
    actionLog = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppTelephonyAction');
    const service = makeMockService();
    const cancelTask = jest.fn().mockResolvedValue(undefined);
    onCancelCompleted = () => undefined;
    dependency = serviceMethod === 'cancelTask' ? cancelTask : service[serviceMethod];
    admission = jest.fn();
    deps = makeDeps({
      answerCallOnWebexService: service,
      assertCommandAllowed: admission,
      getTaskState: () => operation === 'toggleMute' || operation === 'transmitDtmf'
        ? TaskState.CONNECTED : TaskState.OFFERED,
    });
    jest.spyOn(deps, 'setWxAppMuted');
    lifecycle = makeLifecycle({
      mapWxAppVoiceError: jest.fn((error, name) => mapWxAppVoiceError(error, name, 'cc')),
    });
    const runners = {
      accept: () => runWxAppAccept(deps, lifecycle),
      reject: () => runWxAppReject(deps, lifecycle),
      toggleMute: () => runWxAppToggleMute(deps, lifecycle, {muted: true}),
      transmitDtmf: () => runWxAppTransmitDtmf(deps, lifecycle, {dtmf: '123'}),
      outdialDecline: () => runWxAppOutdialDecline(deps, async () => {
        const result = await cancelTask();
        // Cancellation is supplied by Voice, rather than a wxApp telephony helper.
        onCancelCompleted();
        return result;
      }),
    };
    invoke = runners[operation];
  });

  afterEach(() => {
    helper.mockRestore();
    errorLog.mockRestore();
    actionLog.mockRestore();
    log.mockRestore();
  });

  function expectNoCompletionDiagnostics() {
    expect(deps.metricsManager.trackEvent).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(uploadLogs).not.toHaveBeenCalled();
    expect(lifecycle.mapWxAppVoiceError).not.toHaveBeenCalled();
  }

  function expectNoFailureEffects() {
    expectNoCompletionDiagnostics();
    expect(deps.setWxAppMuted).not.toHaveBeenCalled();
    expect(lifecycle.resetWxAppMuted).not.toHaveBeenCalled();
    expect(lifecycle.syncWxAppMuteFromCallDetails).not.toHaveBeenCalled();
  }

  it.each(['RECOVERY_INTERRUPTED', 'STALE_TASK', 'RECOVERY_IN_PROGRESS', 'REGION_RELOAD_REQUIRED'])(
    'lifecycleCallerCatchPreservesIdentityAndReason: %s', async (reason) => {
      const diagnostics = {trackingId: 'wxapp-lifecycle-tracking', status: 409};
      const error = Utils.createRegionRecoveryError(reason, diagnostics);
      const data = error.data;
      dependency.mockRejectedValue(error);

      await expect(invoke()).rejects.toBe(error);
      await flushEventLoopTurn();

      expect(dependency).toHaveBeenCalledTimes(1);
      expect(admission).toHaveBeenCalled();
      expect(helper.mock.calls).toEqual([[error, method, 'cc']]);
      expect(helper.mock.results[0].value).toEqual({error, reason});
      expect(error.data).toBe(data);
      expect(error.data).toEqual({reason, ...diagnostics});
      expect(error.message).toBe(reason);
      expectNoFailureEffects();
    }
  );

  it.each(['service pending', 'inner action completed'] as const)(
    'chainedWxAppContinuationGuarded interruption at %s', async (boundary) => {
      const pending = createDeferred<void>();
      dependency.mockReturnValue(pending.promise);
      const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
      let callsAtRetirement: unknown[][] | undefined;
      let logsAtRetirement: unknown[][] | undefined;
      const retire = jest.fn(() => {
        callsAtRetirement = actionLog.mock.calls.slice();
        logsAtRetirement = log.mock.calls.slice();
        admission.mockImplementation(() => { throw error; });
      });
      if (boundary === 'inner action completed') {
        // Let the inner post-service guard pass. Retire synchronously at its success
        // diagnostic, before the outer runner resumes from awaiting that helper.
        actionLog.mockImplementation((params) => {
          if (params.phase === 'success') retire();
        });
        onCancelCompleted = retire;
      }
      const result = invoke();
      const rejected = expect(result).rejects.toBe(error);
      expect(dependency).toHaveBeenCalledTimes(1);
      if (boundary === 'service pending') retire();
      pending.resolve();

      await rejected;
      await flushEventLoopTurn();

      expect(helper.mock.calls).toEqual([[error, method, 'cc']]);
      expect(retire).toHaveBeenCalledTimes(1);
      expect(actionLog.mock.calls).toEqual(callsAtRetirement);
      expect(log.mock.calls).toEqual(logsAtRetirement);
      expect(actionLog.mock.calls).toEqual(operation === 'outdialDecline' ? [] : [
        [{action, phase: 'started', interactionId: 'interaction-1'}],
        ...(boundary === 'inner action completed'
          ? [[{action, phase: 'success', interactionId: 'interaction-1'}]] : []),
      ]);
      expectNoCompletionDiagnostics();
      // The mute helper legitimately commits before the outer boundary is retired.
      expect((deps.setWxAppMuted as jest.Mock).mock.calls).toEqual(
        operation === 'toggleMute' && boundary === 'inner action completed' ? [[true]] : []
      );
      expect(lifecycle.resetWxAppMuted).not.toHaveBeenCalled();
      expect(lifecycle.syncWxAppMuteFromCallDetails).not.toHaveBeenCalled();
      if (operation === 'accept') {
        expect((lifecycle.setWxAppAnswerPending as jest.Mock).mock.calls).toEqual([[true]]);
        expect((lifecycle.setWxAppAcceptInFlight as jest.Mock).mock.calls).toEqual([[true]]);
      } else {
        expect(lifecycle.setWxAppAnswerPending).not.toHaveBeenCalled();
        expect(lifecycle.setWxAppAcceptInFlight).not.toHaveBeenCalled();
      }
    }
  );

  if (operation === 'accept') {
    it('interrupts the continuation after deferred mute sync without undoing admitted mutations', async () => {
      const syncing = createDeferred<void>();
      const pendingSync = createDeferred<boolean>();
      lifecycle.syncWxAppMuteFromCallDetails = jest.fn(() => {
        syncing.resolve();
        return pendingSync.promise;
      });
      const result = invoke();
      const error = Utils.createRegionRecoveryError('RECOVERY_INTERRUPTED');
      const rejected = expect(result).rejects.toBe(error);
      await syncing.promise;

      expect(dependency).toHaveBeenCalledTimes(1);
      expect(lifecycle.resetWxAppMuted).toHaveBeenCalledTimes(1);
      expect(lifecycle.syncWxAppMuteFromCallDetails).toHaveBeenCalledTimes(1);
      expect(actionLog.mock.calls).toEqual([
        [{action: 'accept', phase: 'started', interactionId: 'interaction-1'}],
        [{action: 'accept', phase: 'success', interactionId: 'interaction-1'}],
      ]);
      const callsAtRetirement = actionLog.mock.calls.slice();
      const logsAtRetirement = log.mock.calls.slice();
      admission.mockImplementation(() => { throw error; });
      pendingSync.resolve(true);

      await rejected;
      await flushEventLoopTurn();

      expect(helper.mock.calls).toEqual([[error, method, 'cc']]);
      expectNoCompletionDiagnostics();
      expect(actionLog.mock.calls).toEqual(callsAtRetirement);
      expect(log.mock.calls).toEqual(logsAtRetirement);
      expect(deps.setWxAppMuted).not.toHaveBeenCalled();
      expect(lifecycle.resetWxAppMuted).toHaveBeenCalledTimes(1);
      expect(lifecycle.syncWxAppMuteFromCallDetails).toHaveBeenCalledTimes(1);
      expect((lifecycle.setWxAppAnswerPending as jest.Mock).mock.calls).toEqual([[true]]);
      expect((lifecycle.setWxAppAcceptInFlight as jest.Mock).mock.calls).toEqual([[true]]);
    });
  }

  it('admitted continuations complete and accept finally clears only the in-flight flag', async () => {
    await expect(invoke()).resolves.toBeUndefined();

    expect(dependency).toHaveBeenCalledTimes(1);
    expect(admission).toHaveBeenCalled();
    expect((deps.metricsManager.trackEvent as jest.Mock).mock.calls).toEqual([
      [successMetric, {
        taskId: 'interaction-1',
        hasDeviceCallId: true,
        hasDeviceId: true,
        ...(operation === 'toggleMute' ? {targetMuted: true} : {}),
        ...(operation === 'transmitDtmf' ? {dtmfLength: 3} : {}),
        ...(['accept', 'reject', 'outdialDecline'].includes(operation)
          ? {acceptReason: 'wxApp_offer_ready'} : {}),
      }, ['operational', 'behavioral']],
    ]);
    expect(helper).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(uploadLogs).not.toHaveBeenCalled();
    expect((deps.setWxAppMuted as jest.Mock).mock.calls).toEqual(
      operation === 'toggleMute' ? [[true]] : []
    );
    expect((lifecycle.setWxAppAcceptInFlight as jest.Mock).mock.calls).toEqual(
      operation === 'accept' ? [[true], [false]] : []
    );
    expect((lifecycle.setWxAppAnswerPending as jest.Mock).mock.calls).toEqual(
      operation === 'accept' ? [[true]] : []
    );
    expect(lifecycle.resetWxAppMuted).toHaveBeenCalledTimes(operation === 'accept' ? 1 : 0);
    expect(lifecycle.syncWxAppMuteFromCallDetails).toHaveBeenCalledTimes(operation === 'accept' ? 1 : 0);
  });

  it('ordinary failure reaches the operation failure sinks', async () => {
    const error = new Error('ordinary wxApp failure');
    dependency.mockRejectedValue(error);

    if (operation === 'outdialDecline') await expect(invoke()).rejects.toBe(error);
    else await expect(invoke()).rejects.toThrow(`Error while performing ${method}`);
    await flushEventLoopTurn();

    expect((deps.metricsManager.trackEvent as jest.Mock).mock.calls.map(([event]) => event)).toEqual([failedMetric]);
    expect(errorLog).toHaveBeenCalledTimes(operation === 'outdialDecline' ? 1 : 2);
    if (operation === 'accept') {
      expect((lifecycle.setWxAppAcceptInFlight as jest.Mock).mock.calls).toEqual([[true], [false]]);
      expect((lifecycle.setWxAppAnswerPending as jest.Mock).mock.calls).toEqual([[true], [false]]);
    }
    if (operation === 'outdialDecline') {
      // Outdial cancellation retains the original AQM error without helper mapping.
      expect(helper).not.toHaveBeenCalled();
      expect(uploadLogs).not.toHaveBeenCalled();
    } else {
      expect(helper.mock.calls).toEqual([[error, method, 'cc']]);
      expect(uploadLogs).toHaveBeenCalledTimes(1);
      expect(uploadLogs).toHaveBeenCalledWith({correlationId: undefined});
    }
  });
});
