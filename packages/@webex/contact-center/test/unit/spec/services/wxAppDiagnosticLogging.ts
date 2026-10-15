import LoggerProxy from '../../../../src/logger-proxy';
import {
  callIdSuffix,
  deriveWxAppAcceptReason,
  logWxAppOfferDecision,
  logWxAppOfferParticipantMismatch,
  logWxAppSessionReadiness,
  logWxAppTelephonyAction,
  WXAPP_LOG_PREFIX,
} from '../../../../src/services/wxAppDiagnosticLogging';

jest.mock('../../../../src/logger-proxy', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('wxAppDiagnosticLogging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('callIdSuffix', () => {
    it('returns last 8 characters for long call ids', () => {
      expect(callIdSuffix('prefix:abcdefghijklmnop')).toBe('ijklmnop');
    });

    it('returns full id when length is 8 or less', () => {
      expect(callIdSuffix('abc')).toBe('abc');
    });
  });

  describe('deriveWxAppAcceptReason', () => {
    it('returns wxApp_offer_ready for wxApp inbound offer', () => {
      expect(
        deriveWxAppAcceptReason({
          isWxAppInboundOffer: true,
          isWxAppOutdialOffer: false,
          isWebrtc: false,
          isOutdial: false,
          wxAppAcceptInFlight: false,
          wxAppAnswerPending: false,
          enableWxBetterTogether: true,
          hasDeviceCallId: true,
        })
      ).toBe('wxApp_offer_ready');
    });

    it('returns extension_non_wxApp_offer when flag on but no device call id', () => {
      expect(
        deriveWxAppAcceptReason({
          isWxAppInboundOffer: false,
          isWxAppOutdialOffer: false,
          isWebrtc: false,
          isOutdial: false,
          wxAppAcceptInFlight: false,
          wxAppAnswerPending: false,
          enableWxBetterTogether: true,
          hasDeviceCallId: false,
        })
      ).toBe('extension_non_wxApp_offer');
    });

    it('returns wxApp_answer_pending when answer is pending', () => {
      expect(
        deriveWxAppAcceptReason({
          isWxAppInboundOffer: true,
          isWxAppOutdialOffer: false,
          isWebrtc: false,
          isOutdial: false,
          wxAppAcceptInFlight: false,
          wxAppAnswerPending: true,
          enableWxBetterTogether: true,
          hasDeviceCallId: true,
        })
      ).toBe('wxApp_answer_pending');
    });
  });

  describe('log helpers', () => {
    it('logs session readiness at log level with grep-friendly suffix', () => {
      logWxAppSessionReadiness({
        enableWxBetterTogether: true,
        loginOption: 'EXTENSION',
        wxAppHooksApplied: true,
        usersubPublished: true,
        mercurySubscribed: true,
        telephonyTaskType: 'Voice',
      });

      expect(LoggerProxy.log).toHaveBeenCalledWith(
        expect.stringContaining(`${WXAPP_LOG_PREFIX} session readiness`),
        expect.objectContaining({
          module: 'wxAppDiagnosticLogging',
          method: 'logWxAppSessionReadiness',
          data: expect.objectContaining({
            feature: 'wxApp',
            event: 'session_readiness',
            loginOption: 'EXTENSION',
            usersubPublished: true,
            mercurySubscribed: true,
          }),
        })
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        expect.stringContaining('usersubPublished=true'),
        expect.anything()
      );
    });

    it('logs offer decision at log level with acceptReason suffix', () => {
      logWxAppOfferDecision({
        interactionId: 'task-1',
        acceptVisible: true,
        acceptEnabled: false,
        acceptReason: 'extension_non_wxApp_offer',
        hasDeviceCallId: false,
        hasDeviceId: false,
        usersubPublished: true,
      });

      expect(LoggerProxy.log).toHaveBeenCalledWith(
        expect.stringContaining('acceptReason=extension_non_wxApp_offer'),
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'offer_decision',
            acceptReason: 'extension_non_wxApp_offer',
            interactionId: 'task-1',
            usersubPublished: true,
          }),
        })
      );
    });

    it('logs participant mismatch at warn level', () => {
      logWxAppOfferParticipantMismatch({
        interactionId: 'task-1',
        usersubPublished: true,
        hasDeviceCallId: false,
        hasDeviceId: false,
        participantDeviceType: 'wxApp',
        acceptVisible: true,
        acceptEnabled: false,
        acceptReason: 'extension_non_wxApp_offer',
      });

      expect(LoggerProxy.warn).toHaveBeenCalledWith(
        expect.stringContaining('participant fields mismatch'),
        expect.objectContaining({
          method: 'logWxAppOfferParticipantMismatch',
          data: expect.objectContaining({
            event: 'participant_fields_mismatch',
            usersubPublished: true,
            hasDeviceCallId: false,
          }),
        })
      );
    });

    it('logs telephony failures at error level with trackingId', () => {
      logWxAppTelephonyAction({
        action: 'accept',
        phase: 'failed',
        interactionId: 'task-1',
        trackingId: 'track-abc',
        failureReason: 'REST error',
      });

      expect(LoggerProxy.error).toHaveBeenCalledWith(
        expect.stringContaining('telephony accept failed'),
        expect.objectContaining({
          data: expect.objectContaining({
            trackingId: 'track-abc',
          }),
        })
      );
    });
  });
});
