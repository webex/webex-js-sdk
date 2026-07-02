import {WebexSDK} from '../../SDKConnector/types';
import log from '../../Logger';
import {METHODS, WS_FEATURE_FLAG_FILE} from '../constants';

/** WDM device-settings key for routing Mobius traffic over WebSocket. */
export const WEBRTC_CALLING_OVER_WS_FEATURE_KEY = 'webrtc-calling-over-ws-CALL-219562';

/** Allowed origins for samples page localStorage override */
const ALLOWED_ORIGINS = ['localhost', '127.0.0.1', 'web-sdk.webex.com'];

/**
 * Returns tri-state localStorage override: true (force-enable), false (force-disable), or null (defer to backend).
 */
function samplesPageToggleValue(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const hostname = window.location.hostname;
  const isAllowedOrigin = ALLOWED_ORIGINS.some(
    (origin) => hostname === origin || hostname.endsWith(`.${origin}`)
  );

  if (!isAllowedOrigin) {
    return null;
  }

  const localStorageValue = localStorage.getItem('mobius-wss-enabled');

  if (localStorageValue === 'true') {
    log.trace(`Mobius WSS force-enabled via samples page localStorage override on ${hostname}`, {
      file: WS_FEATURE_FLAG_FILE,
      method: METHODS.IS_MOBIUS_WSS_ENABLED,
    });

    return true;
  }

  if (localStorageValue === 'false') {
    log.trace(`Mobius WSS force-disabled via samples page localStorage override on ${hostname}`, {
      file: WS_FEATURE_FLAG_FILE,
      method: METHODS.IS_MOBIUS_WSS_ENABLED,
    });

    return false;
  }

  return null;
}

/**
 * Whether Webex Calling should use the Mobius WebSocket transport for API requests.
 * Reads WDM `webex.internal.device.settings['webrtc-calling-over-ws'].value`; must be
 * strictly `true` to enable WebSocket—otherwise use HTTP.
 *
 * Additionally checks browser localStorage for 'mobius-wss-enabled' flag on allowed origins
 * (localhost, 127.0.0.1, web-sdk.webex.com) to enable testing via samples page.
 * localStorage can force-enable ('true'), force-disable ('false'), or defer to backend (null/unset).
 */
export function isMobiusWssEnabled(webex: WebexSDK): boolean {
  const enabled =
    webex.internal?.device?.features?.developer?.get(WEBRTC_CALLING_OVER_WS_FEATURE_KEY)?.value ===
    true;

  const localStorageOverride = samplesPageToggleValue();
  const finalValue = localStorageOverride !== null ? localStorageOverride : enabled;

  log.trace(
    `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: ${finalValue} (backend: ${enabled}, localStorage: ${localStorageOverride})`,
    {
      file: WS_FEATURE_FLAG_FILE,
      method: METHODS.IS_MOBIUS_WSS_ENABLED,
    }
  );

  return finalValue;
}
