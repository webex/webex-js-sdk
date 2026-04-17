import {WebexSDK} from '../../SDKConnector/types';

/** WDM device-settings key for routing Mobius traffic over WebSocket. */
export const WEBRTC_CALLING_OVER_WS_FEATURE_KEY = 'webrtc-calling-over-ws';

/**
 * Whether Webex Calling should use the Mobius WebSocket transport for API requests.
 * Reads WDM `webex.internal.device.settings['webrtc-calling-over-ws'].value`; must be
 * strictly `true` to enable WebSocket—otherwise use HTTP.
 */
export function isWsFeatureEnabled(webex: WebexSDK): boolean {
  return webex.internal?.device?.settings?.[WEBRTC_CALLING_OVER_WS_FEATURE_KEY]?.value === true;
}
