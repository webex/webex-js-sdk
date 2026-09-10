import MetricsManager from '../../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../../src/metrics/constants';
import {TaskState} from '../../../../../../src/services/task/state-machine';
import {TaskData, VOICE_VARIANT} from '../../../../../../src/services/task/types';
import {
  WxAppOfferObservability,
  WxAppOfferObservabilityContext,
  WXAPP_PARTICIPANT_MISMATCH_GRACE_MS,
} from '../../../../../../src/services/task/voice/wxAppOfferObservability';
import {WxAppVoiceDependencies} from '../../../../../../src/services/task/voice/wxAppVoiceMethods';
import * as wxAppDiagnosticLogging from '../../../../../../src/services/wxAppDiagnosticLogging';
import {createTaskData} from '../taskTestUtils';

const wxAppParticipant = {
  deviceType: 'wxApp',
  deviceId: 'device-id-1',
  deviceCallId: 'call-id-1',
};

function makeTaskDataWithoutWxAppFields(): TaskData {
  return createTaskData({
    agentId: 'agent-1',
    interaction: {
      participants: {
        'agent-1': {id: 'agent-1'},
      },
    } as TaskData['interaction'],
  });
}

function makeTaskDataWithWxAppFields(): TaskData {
  return createTaskData({
    agentId: 'agent-1',
    interaction: {
      participants: {
        'agent-1': {id: 'agent-1', ...wxAppParticipant},
      },
    } as TaskData['interaction'],
  });
}

function makeMockMetricsManager(): jest.Mocked<Pick<MetricsManager, 'trackEvent'>> {
  return {trackEvent: jest.fn()};
}

function makeContext(
  overrides: {
    taskData?: TaskData;
    taskState?: TaskState;
    usersubPublished?: boolean;
    wxAppAcceptInFlight?: boolean;
    wxAppAnswerPending?: boolean;
    voiceVariant?: typeof VOICE_VARIANT.PSTN;
    acceptEnabled?: boolean;
  } = {}
): WxAppOfferObservabilityContext & {setTaskData: (data: TaskData) => void; setTaskState: (s: TaskState) => void} {
  let taskData = overrides.taskData ?? makeTaskDataWithoutWxAppFields();
  let taskState = overrides.taskState ?? TaskState.OFFERED;
  const metricsManager = makeMockMetricsManager() as unknown as MetricsManager;

  const deps = (): WxAppVoiceDependencies => ({
    enableWxBetterTogether: true,
    agentId: 'agent-1',
    metricsManager,
    getTaskData: () => taskData,
    getTaskState: () => taskState,
    getWxAppMuted: () => false,
    setWxAppMuted: jest.fn(),
    getUsersubPublished: () => overrides.usersubPublished ?? true,
  });

  return {
    getInteractionId: () => taskData.interactionId,
    getTaskState: () => taskState,
    getAcceptControl: () => ({
      isVisible: true,
      isEnabled: overrides.acceptEnabled ?? false,
    }),
    getVoiceVariant: () => overrides.voiceVariant ?? VOICE_VARIANT.PSTN,
    isOutdial: () => false,
    isWxAppInboundOffer: () => {
      const p = taskData.interaction?.participants?.['agent-1'] as
        | {deviceType?: string; deviceCallId?: string; deviceId?: string}
        | undefined;
      return (
        p?.deviceType === 'wxApp' &&
        typeof p.deviceCallId === 'string' &&
        p.deviceCallId.trim() !== '' &&
        typeof p.deviceId === 'string' &&
        p.deviceId.trim() !== ''
      );
    },
    isWxAppCallingOffer: () => {
      const p = taskData.interaction?.participants?.['agent-1'] as
        | {deviceType?: string; deviceCallId?: string; deviceId?: string}
        | undefined;
      return (
        p?.deviceType === 'wxApp' &&
        typeof p.deviceCallId === 'string' &&
        p.deviceCallId.trim() !== '' &&
        typeof p.deviceId === 'string' &&
        p.deviceId.trim() !== ''
      );
    },
    getWxAppAcceptInFlight: () => overrides.wxAppAcceptInFlight ?? false,
    getWxAppAnswerPending: () => overrides.wxAppAnswerPending ?? false,
    getEnableWxBetterTogether: () => true,
    getUsersubPublished: () => overrides.usersubPublished ?? true,
    getWxAppVoiceDependencies: deps,
    getMetricsManager: () => metricsManager,
    setTaskData: (data: TaskData) => {
      taskData = data;
    },
    setTaskState: (state: TaskState) => {
      taskState = state;
    },
  };
}

describe('WxAppOfferObservability', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('offer decision logging', () => {
    it('logs wxApp_offer_ready when participant fields are present', () => {
      const logSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferDecision');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext({taskData: makeTaskDataWithWxAppFields(), acceptEnabled: true});

      observability.handleUiControlsUpdate(ctx);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({acceptReason: 'wxApp_offer_ready'})
      );
    });

    it('logs accept reason transitions only once per reason', () => {
      const logSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferDecision');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext({
        taskData: makeTaskDataWithWxAppFields(),
        wxAppAcceptInFlight: true,
      });

      observability.handleUiControlsUpdate(ctx);
      observability.handleUiControlsUpdate(ctx);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({acceptReason: 'wxApp_accept_in_flight'})
      );
    });

    it('logs browser_webrtc_offer for WebRTC variant without wxApp participant', () => {
      const logSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferDecision');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext({
        taskData: createTaskData({
          agentId: 'agent-1',
          interaction: {
            participants: {
              'agent-1': {id: 'agent-1', deviceType: 'phone', deviceId: 'device-id-1'},
            },
          } as TaskData['interaction'],
        }),
        voiceVariant: VOICE_VARIANT.WEBRTC,
      });

      observability.handleUiControlsUpdate(ctx);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({acceptReason: 'browser_webrtc_offer'})
      );
    });
  });

  describe('deferred participant mismatch', () => {
    it('does not warn when wxApp fields arrive before grace period elapses', () => {
      const warnSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferParticipantMismatch');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext();

      observability.handleUiControlsUpdate(ctx);
      expect(warnSpy).not.toHaveBeenCalled();

      ctx.setTaskData(makeTaskDataWithWxAppFields());
      observability.handleUiControlsUpdate(ctx);

      jest.advanceTimersByTime(WXAPP_PARTICIPANT_MISMATCH_GRACE_MS);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(ctx.getMetricsManager().trackEvent).not.toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_OFFER_PARTICIPANT_FIELDS_MISSING,
        expect.anything(),
        expect.anything()
      );
    });

    it('warns and emits metric when fields remain missing after grace period', () => {
      const warnSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferParticipantMismatch');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext();

      observability.handleUiControlsUpdate(ctx);
      expect(warnSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(WXAPP_PARTICIPANT_MISMATCH_GRACE_MS);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          interactionId: 'interaction-1',
          usersubPublished: true,
          hasDeviceCallId: false,
          hasDeviceId: false,
          acceptReason: 'extension_non_wxApp_offer',
        })
      );
      expect(ctx.getMetricsManager().trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.WXAPP_OFFER_PARTICIPANT_FIELDS_MISSING,
        expect.objectContaining({
          taskId: 'interaction-1',
          usersubPublished: true,
          hasDeviceCallId: false,
          hasDeviceId: false,
          acceptReason: 'extension_non_wxApp_offer',
        }),
        ['operational', 'behavioral']
      );
    });

    it('cancels pending mismatch when task leaves OFFERED before grace period', () => {
      const warnSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferParticipantMismatch');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext();

      observability.handleUiControlsUpdate(ctx);
      ctx.setTaskState(TaskState.TERMINATED);
      observability.handleUiControlsUpdate(ctx);

      jest.advanceTimersByTime(WXAPP_PARTICIPANT_MISMATCH_GRACE_MS);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('clears grace timer on dispose', () => {
      const warnSpy = jest.spyOn(wxAppDiagnosticLogging, 'logWxAppOfferParticipantMismatch');
      const observability = new WxAppOfferObservability();
      const ctx = makeContext();

      observability.handleUiControlsUpdate(ctx);
      observability.dispose();

      jest.advanceTimersByTime(WXAPP_PARTICIPANT_MISMATCH_GRACE_MS);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
