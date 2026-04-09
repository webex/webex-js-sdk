import path from 'path';

export type ServiceIndicator = 'calling' | 'contactcenter' | 'guestcalling';

// App paths
export const SAMPLE_APP_PATH = '/samples/calling/';
export const CC_SERVICE_DOMAIN = 'rtw.prod-us1.rtmsprod.net';

// Discovery
export const REGION = 'US-EAST';
export const COUNTRY = 'US';

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
export {AWAIT_TIMEOUT, SDK_INIT_TIMEOUT, REGISTRATION_TIMEOUT, OPERATION_TIMEOUT} from './timeouts';
