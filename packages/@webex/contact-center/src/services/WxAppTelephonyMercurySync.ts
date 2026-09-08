import LoggerProxy from '../logger-proxy';
import {METHODS} from '../constants';
import {WebexSDK} from '../types';

const WXAPP_TELEPHONY_MERCURY_SYNC_FILE = 'WxAppTelephonyMercurySync';

export const TELEPHONY_CALL_MUTED = 'event:telephony_calls.muted';
export const TELEPHONY_CALL_UNMUTED = 'event:telephony_calls.unmuted';

export type UpdatedCallMuteStateEvent = {
  data: {
    actorId: string;
    callId: string;
    muted: boolean;
  };
};

type MuteChangeHandler = (callId: string, muted: boolean) => void;

/**
 * Subscribes to Mercury telephony mute/unmute events for wxApp thick-client sync (AD parity).
 */
export default class WxAppTelephonyMercurySync {
  private webex: WebexSDK;
  private subscribedAgentId?: string;
  private muteChangeHandler?: MuteChangeHandler;
  private boundMuteHandler?: (event: UpdatedCallMuteStateEvent) => void;
  private boundUnmuteHandler?: (event: UpdatedCallMuteStateEvent) => void;

  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  private decodeBase64(value: string): string {
    try {
      return atob(value);
    } catch {
      return value;
    }
  }

  private handleMuteStateEvent = (agentId: string, event: UpdatedCallMuteStateEvent): void => {
    const {actorId, callId, muted} = event?.data ?? {};
    if (!actorId || !callId || muted === undefined) {
      return;
    }

    const decodedActorId = this.decodeBase64(actorId);
    const decodedCallId = this.decodeBase64(callId);

    if (!decodedActorId.endsWith(agentId)) {
      return;
    }

    LoggerProxy.info('WxApp telephony mute state sync received', {
      module: WXAPP_TELEPHONY_MERCURY_SYNC_FILE,
      method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
      data: {muted},
    });

    this.muteChangeHandler?.(decodedCallId, muted);
  };

  public subscribe(agentId: string, onMuteChange: MuteChangeHandler): void {
    this.unsubscribe();

    const mercury = this.webex.internal.mercury;
    if (!mercury) {
      LoggerProxy.error('Mercury is unavailable for wxApp mute sync', {
        module: WXAPP_TELEPHONY_MERCURY_SYNC_FILE,
        method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
      });

      return;
    }

    this.subscribedAgentId = agentId;
    this.muteChangeHandler = onMuteChange;

    this.boundMuteHandler = (event: UpdatedCallMuteStateEvent) => {
      this.handleMuteStateEvent(agentId, event);
    };
    this.boundUnmuteHandler = (event: UpdatedCallMuteStateEvent) => {
      this.handleMuteStateEvent(agentId, event);
    };

    mercury.on(TELEPHONY_CALL_MUTED, this.boundMuteHandler);
    mercury.on(TELEPHONY_CALL_UNMUTED, this.boundUnmuteHandler);

    LoggerProxy.info('Subscribed to wxApp telephony Mercury mute sync', {
      module: WXAPP_TELEPHONY_MERCURY_SYNC_FILE,
      method: METHODS.SYNC_WXAPP_MUTE_FROM_MERCURY,
    });
  }

  public unsubscribe(): void {
    const mercury = this.webex.internal.mercury;

    if (mercury && this.boundMuteHandler) {
      mercury.off(TELEPHONY_CALL_MUTED, this.boundMuteHandler);
    }
    if (mercury && this.boundUnmuteHandler) {
      mercury.off(TELEPHONY_CALL_UNMUTED, this.boundUnmuteHandler);
    }

    this.subscribedAgentId = undefined;
    this.muteChangeHandler = undefined;
    this.boundMuteHandler = undefined;
    this.boundUnmuteHandler = undefined;
  }

  public isSubscribed(): boolean {
    return Boolean(this.subscribedAgentId && this.muteChangeHandler);
  }
}
