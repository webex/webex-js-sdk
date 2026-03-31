import path from 'path';

export type ServiceIndicator = 'calling' | 'contactcenter' | 'guestcalling';

// App paths
export const SAMPLE_APP_PATH = '/samples/calling/';
export const CC_SERVICE_DOMAIN = 'rtw.prod-us1.rtmsprod.net';

// Discovery
export const REGION = 'US-EAST';
export const COUNTRY = 'US';

// OAuth
export const ENV_PATH = path.resolve(__dirname, '../../../.env');
export const WIDGETS_URL = 'https://widgets.webex.com/samples-cc-react-app/index.html';

export {SELECTORS} from './selectors';
export {AWAIT_TIMEOUT, SDK_INIT_TIMEOUT, REGISTRATION_TIMEOUT, OPERATION_TIMEOUT} from './timeouts';
