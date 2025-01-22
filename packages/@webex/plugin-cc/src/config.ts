import {LOGGER} from '@webex/calling';

export default {
  cc: {
    allowMultiLogin: false,
    allowAutomatedRelogin: true,
    clientType: 'WebexCCSDK',
    isKeepAliveEnabled: false,
    force: true,
    metrics: {
      clientName: 'WEBEX_JS_SDK',
      clientType: 'WebexCCSDK',
    },
    callingClientConfig: {
      logger: {
        level: LOGGER.INFO,
      },
      serviceData: {
        indicator: 'contactcenter',
        // TODO: This should be dynamic based on the environment
        domain: 'rtw.prod-us1.rtmsprod.net',
      },
    },
  },
};
