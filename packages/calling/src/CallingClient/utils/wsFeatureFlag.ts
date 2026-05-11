import {WebexSDK} from '../../SDKConnector/types';
import log from '../../Logger';
import {METHODS, WS_FEATURE_FLAG_FILE} from '../constants';

/** WDM device-settings key for routing Mobius traffic over WebSocket. */
export const WEBRTC_CALLING_OVER_WS_FEATURE_KEY = 'webrtc-calling-over-ws-CALL-219562';
/**
 * Whether Webex Calling should use the Mobius WebSocket transport for API requests.
 * Reads WDM `webex.internal.device.settings['webrtc-calling-over-ws'].value`; must be
 * strictly `true` to enable WebSocket—otherwise use HTTP.
 */
export function isMobiusWssEnabled(webex: WebexSDK): boolean {
  const enabled =
    webex.internal?.device?.features?.developer?.get(WEBRTC_CALLING_OVER_WS_FEATURE_KEY)?.value ===
    true;

  log.trace(
    `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: ${enabled}`,
    {
      file: WS_FEATURE_FLAG_FILE,
      method: METHODS.IS_MOBIUS_WSS_ENABLED,
    }
  );

  return enabled;
}
