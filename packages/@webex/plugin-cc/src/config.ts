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
        // This is now being read dynamically based on the environment in WebCallingService registerWebCallingLine method
        domain: 'rtw.prod-us1.rtmsprod.net',
      },
    },
  },
};
