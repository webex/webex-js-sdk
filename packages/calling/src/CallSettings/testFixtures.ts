import {CallForwardSetting, VoicemailSetting} from './types';

export const xsiEndpointUrlResponse = {
  items: [
    {
      id: 'Y2lzY',
      displayName: 'Atlas_Test_WxC_SI_AS10_VAR_WebrtcMobius_DND',
      created: '2022-03-16T11:20:04.561Z',
      xsiDomain: 'api-proxy-si.net',
      xsiActionsEndpoint: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions',
      xsiEventsEndpoint: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-events',
      xsiEventsChannelEndpoint:
        'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.async/com.broadsoft.xsi-events',
    },
  ],
};

export const callForwardPayload: CallForwardSetting = {
  callForwarding: {
    always: {
      enabled: true,
      destination: '123456789',
      ringReminderEnabled: false,
      destinationVoicemailEnabled: false,
    },
    busy: {
      enabled: false,
    },
    noAnswer: {
      enabled: true,
      destination: '123123',
      numberOfRings: 3,
    },
  },
  businessContinuity: {
    enabled: false,
  },
};

export const dummyEmail = 'abc@test.com';

export const voicemailPayload: VoicemailSetting = {
  enabled: true,
  sendAllCalls: {
    enabled: true,
  },
  sendBusyCalls: {
    enabled: true,
  },
  sendUnansweredCalls: {
    enabled: true,
    numberOfRings: 3,
  },
  notifications: {
    enabled: true,
    destination: dummyEmail,
  },
  emailCopyOfMessage: {
    enabled: true,
    emailId: dummyEmail,
  },
  messageStorage: {
    mwiEnabled: true,
    storageType: 'INTERNAL',
    externalEmail: dummyEmail,
  },
  voiceMessageForwardingEnabled: false,
};
