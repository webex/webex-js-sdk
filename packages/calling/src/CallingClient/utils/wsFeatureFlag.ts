import {WebexSDK} from '../../SDKConnector/types';
import log from '../../Logger';
import {METHODS, WS_FEATURE_FLAG_FILE} from '../constants';

/** WDM device-settings key for routing Mobius traffic over WebSocket. */
export const WEBRTC_CALLING_OVER_WS_FEATURE_KEY = 'webrtc-calling-over-ws-CALL-219562';

/** Allowed origins for samples page localStorage override */
const ALLOWED_ORIGINS = ['localhost', '127.0.0.1', 'web-sdk.webex.com'];

function samplesPageToggleValue() {
  // Check for samples page localStorage override on allowed origins
  let localStorageOverride = false;

  if (typeof window !== 'undefined' && window.localStorage) {
    const hostname = window.location.hostname;
    const isAllowedOrigin = ALLOWED_ORIGINS.some(
      (origin) => hostname === origin || hostname.endsWith(`.${origin}`)
    );

    if (isAllowedOrigin && localStorage.getItem('mobius-wss-enabled') === 'true') {
      localStorageOverride = true;
      log.trace(`Mobius WSS enabled via samples page localStorage override on ${hostname}`, {
        file: WS_FEATURE_FLAG_FILE,
        method: METHODS.IS_MOBIUS_WSS_ENABLED,
      });
    }
  }

  return localStorageOverride;
}

/**
 * Whether Webex Calling should use the Mobius WebSocket transport for API requests.
 * Reads WDM `webex.internal.device.settings['webrtc-calling-over-ws'].value`; must be
 * strictly `true` to enable WebSocket—otherwise use HTTP.
 *
 * Additionally checks browser localStorage for 'mobius-wss-enabled' flag on allowed origins
 * (localhost, 127.0.0.1, web-sdk.webex.com) to enable testing via samples page.
 */
export function isMobiusWssEnabled(webex: WebexSDK): boolean {
  const enabled =
    webex.internal?.device?.features?.developer?.get(WEBRTC_CALLING_OVER_WS_FEATURE_KEY)?.value ===
    true;

  const localStorageOverride = samplesPageToggleValue();
  const finalValue = localStorageOverride || enabled;

  log.trace(
    `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: ${enabled}`,
    {
      file: WS_FEATURE_FLAG_FILE,
      method: METHODS.IS_MOBIUS_WSS_ENABLED,
    }
  );

  return finalValue;
}
