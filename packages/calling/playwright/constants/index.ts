import path from 'path';

export type ServiceIndicator = 'calling' | 'contactcenter' | 'guestcalling';

// App paths
export const SAMPLE_APP_PATH = '/samples/calling/';
export const CC_SERVICE_DOMAIN = 'rtw.prod-us1.rtmsprod.net';

// Discovery
export const REGION = 'US-EAST';
export const COUNTRY = 'US';

// Server region names returned in Mobius discovery response when REGION='US-EAST'.
// These are internal server names and don't match the logical regionCode in the request.
export const EXPECTED_PRIMARY_REGION = {
  PROD: 'us-east-1',
  INT: 'us-east-1-ngnix',
};
export const EXPECTED_BACKUP_REGION = {
  PROD: 'us-west-2',
  INT: 'us-east-1-istio',
};

// Mobius URLs for the test accounts (from service catalog)
export const PRIMARY_MOBIUS_URL = {
  PROD: 'https://mobius.asinwxt-prd-3.p4.prod.infra.webex.com/api/v1/calling/web/',
  INT: 'https://mobius.aintm-m-5.int.infra.webex.com/api/v1/calling/web/',
};
export const BACKUP_MOBIUS_URL = {
  PROD: 'https://mobius.asydwxt-prd-4.a2.prod.infra.webex.com/api/v1/calling/web/',
  INT: 'https://mobius.int-first-calling1.ciscospark.com/api/v1/calling/web/',
};

// OAuth
export const ENV_PATH = path.resolve(__dirname, '../../../../.env');
export const DEVELOPER_PORTAL_GETTING_STARTED_URL =
  'https://developer.webex.com/docs/getting-started';
export const DEVELOPER_PORTAL_INT_GETTING_STARTED_URL =
  'https://developer-portal-intb.ciscospark.com/docs/getting-started';

export {CALLING_SELECTORS} from './selectors';
export {
  AWAIT_TIMEOUT,
  SDK_INIT_TIMEOUT,
  REGISTRATION_TIMEOUT,
  OPERATION_TIMEOUT,
  UI_SETTLE_MS,
  POST_ACTION_SETTLE_MS,
  TRANSFER_SUITE_TIMEOUT,
} from './timeouts';
export {
  CALL_HISTORY_ANSWERED_DISPOSITIONS,
  CALL_HISTORY_MISSED_CALLER_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS,
  CALL_HISTORY_TIME_LOOKBACK_MS,
  CALL_HISTORY_RECENT_RECORD_TOLERANCE_MS,
  CALL_HISTORY_COUNTERPART_MATCH_MIN_DIGITS,
  CALL_HISTORY_URL_PATTERN,
  CALL_HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT,
  CALL_HISTORY_POLL_INTERVALS,
  CALL_HISTORY_TIMING_TOLERANCE_MS,
  CALL_HISTORY_DURATION_TOLERANCE_SECONDS,
} from './call-history';
