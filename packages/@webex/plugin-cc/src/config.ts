import {LOGGER} from '@webex/calling';

export default {
  cc: {
    allowMultiLogin: true,
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
        domain: 'rtw.prod-us1.rtmsprod.net',
      },
    },
  },
};
