import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {
  deriveWxAppAcceptReason,
  logWxAppOfferDecision,
  logWxAppOfferParticipantMismatch,
  WxAppAcceptReason,
} from '../../wxAppDiagnosticLogging';
import {TaskState} from '../state-machine';
import {VoiceVariant, VOICE_VARIANT} from '../types';
import {
  getCallingDeviceDetails,
  getWxAppParticipantDiagnostics,
  WxAppVoiceDependencies,
} from './wxAppVoiceMethods';

/** Defer mismatch WARN/metric so transient WS ordering gaps (~200–300 ms) do not false-alarm. */
export const WXAPP_PARTICIPANT_MISMATCH_GRACE_MS = 500;

export type WxAppOfferObservabilityContext = {
  getInteractionId: () => string;
  getTaskState: () => TaskState | undefined;
  getAcceptControl: () => {isVisible: boolean; isEnabled: boolean} | undefined;
  getVoiceVariant: () => VoiceVariant;
  isOutdial: () => boolean;
  isWxAppInboundOffer: () => boolean;
  isWxAppCallingOffer: () => boolean;
  getWxAppAcceptInFlight: () => boolean;
  getWxAppAnswerPending: () => boolean;
  getEnableWxBetterTogether: () => boolean;
  getUsersubPublished: () => boolean;
  getWxAppVoiceDependencies: () => WxAppVoiceDependencies;
  getMetricsManager: () => MetricsManager;
};

/**
 * OFFERED-state wxApp offer diagnostics: acceptReason logging and deferred participant mismatch.
 * Invoked from Voice.updateUiControls — observability only.
 */
export class WxAppOfferObservability {
  private lastLoggedWxAppAcceptReason?: WxAppAcceptReason;
  private lastLoggedWxAppParticipantMismatch = false;
  private wxAppParticipantMismatchGraceTimer?: ReturnType<typeof setTimeout>;

  public handleUiControlsUpdate(ctx: WxAppOfferObservabilityContext): void {
    if (!ctx.getEnableWxBetterTogether()) {
      this.cancelGraceTimer();

      return;
    }

    const state = ctx.getTaskState();
    if (state !== TaskState.OFFERED) {
      this.cancelGraceTimer();

      return;
    }

    const accept = ctx.getAcceptControl();
    if (!accept?.isVisible) {
      return;
    }

    const deps = ctx.getWxAppVoiceDependencies();
    const isOutdial = ctx.isOutdial();
    const isWxAppInboundOffer = ctx.isWxAppInboundOffer();
    const isWxAppOutdialOffer = ctx.isWxAppCallingOffer() && isOutdial;
    const deviceDetails = getCallingDeviceDetails(deps);
    const participantDiagnostics = getWxAppParticipantDiagnostics(deps);
    const usersubPublished = ctx.getUsersubPublished();
    const acceptReason = deriveWxAppAcceptReason({
      isWxAppInboundOffer,
      isWxAppOutdialOffer,
      isWebrtc: ctx.getVoiceVariant() === VOICE_VARIANT.WEBRTC,
      isOutdial,
      wxAppAcceptInFlight: ctx.getWxAppAcceptInFlight(),
      wxAppAnswerPending: ctx.getWxAppAnswerPending(),
      enableWxBetterTogether: ctx.getEnableWxBetterTogether(),
      hasDeviceCallId: participantDiagnostics.hasDeviceCallId,
    });

    if (acceptReason !== this.lastLoggedWxAppAcceptReason) {
      this.lastLoggedWxAppAcceptReason = acceptReason;

      logWxAppOfferDecision({
        interactionId: ctx.getInteractionId(),
        acceptVisible: accept.isVisible,
        acceptEnabled: accept.isEnabled,
        acceptReason,
        wxAppParticipantDeviceType:
          deviceDetails?.deviceType ?? participantDiagnostics.participantDeviceType,
        hasDeviceCallId: participantDiagnostics.hasDeviceCallId,
        hasDeviceId: participantDiagnostics.hasDeviceId,
        usersubPublished,
      });
    }

    if (participantDiagnostics.hasValidWxAppParticipant || !usersubPublished) {
      this.cancelGraceTimer();
    } else if (!ctx.isOutdial() && !this.lastLoggedWxAppParticipantMismatch) {
      this.scheduleGraceTimer(ctx);
    }
  }

  public dispose(): void {
    this.cancelGraceTimer();
  }

  private cancelGraceTimer(): void {
    if (this.wxAppParticipantMismatchGraceTimer !== undefined) {
      clearTimeout(this.wxAppParticipantMismatchGraceTimer);
      this.wxAppParticipantMismatchGraceTimer = undefined;
    }
  }

  private scheduleGraceTimer(ctx: WxAppOfferObservabilityContext): void {
    if (
      this.lastLoggedWxAppParticipantMismatch ||
      this.wxAppParticipantMismatchGraceTimer !== undefined
    ) {
      return;
    }

    this.wxAppParticipantMismatchGraceTimer = setTimeout(() => {
      this.wxAppParticipantMismatchGraceTimer = undefined;
      this.emitParticipantMismatchIfStillNeeded(ctx);
    }, WXAPP_PARTICIPANT_MISMATCH_GRACE_MS);
  }

  private emitParticipantMismatchIfStillNeeded(ctx: WxAppOfferObservabilityContext): void {
    if (!ctx.getEnableWxBetterTogether() || this.lastLoggedWxAppParticipantMismatch) {
      return;
    }

    if (ctx.isOutdial()) {
      return;
    }

    if (ctx.getTaskState() !== TaskState.OFFERED) {
      return;
    }

    const accept = ctx.getAcceptControl();
    if (!accept?.isVisible) {
      return;
    }

    const deps = ctx.getWxAppVoiceDependencies();
    const participantDiagnostics = getWxAppParticipantDiagnostics(deps);
    const usersubPublished = ctx.getUsersubPublished();

    if (!usersubPublished || participantDiagnostics.hasValidWxAppParticipant) {
      return;
    }

    const isOutdial = ctx.isOutdial();
    const acceptReason = deriveWxAppAcceptReason({
      isWxAppInboundOffer: ctx.isWxAppInboundOffer(),
      isWxAppOutdialOffer: ctx.isWxAppCallingOffer() && isOutdial,
      isWebrtc: ctx.getVoiceVariant() === VOICE_VARIANT.WEBRTC,
      isOutdial,
      wxAppAcceptInFlight: ctx.getWxAppAcceptInFlight(),
      wxAppAnswerPending: ctx.getWxAppAnswerPending(),
      enableWxBetterTogether: ctx.getEnableWxBetterTogether(),
      hasDeviceCallId: participantDiagnostics.hasDeviceCallId,
    });

    this.lastLoggedWxAppParticipantMismatch = true;

    logWxAppOfferParticipantMismatch({
      interactionId: ctx.getInteractionId(),
      usersubPublished,
      hasDeviceCallId: participantDiagnostics.hasDeviceCallId,
      hasDeviceId: participantDiagnostics.hasDeviceId,
      participantDeviceType: participantDiagnostics.participantDeviceType,
      acceptVisible: accept.isVisible,
      acceptEnabled: accept.isEnabled,
      acceptReason,
    });

    ctx.getMetricsManager().trackEvent(
      METRIC_EVENT_NAMES.WXAPP_OFFER_PARTICIPANT_FIELDS_MISSING,
      {
        taskId: ctx.getInteractionId(),
        usersubPublished,
        hasDeviceCallId: participantDiagnostics.hasDeviceCallId,
        hasDeviceId: participantDiagnostics.hasDeviceId,
        acceptReason,
      },
      ['operational', 'behavioral']
    );
  }
}
