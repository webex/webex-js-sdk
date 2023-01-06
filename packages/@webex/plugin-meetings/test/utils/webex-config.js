const SCOPE = [
  'webexsquare:get_conversation',
  'Identity:SCIM',
  'spark:kms',
  'spark:people_read',
  'spark:rooms_read',
  'spark:rooms_write',
  'spark:memberships_read',
  'spark:memberships_write',
  'spark:messages_read',
  'spark:messages_write',
].join(' ');

const Config = {
  version: () => process.env.BUILD_VERSION || -1,
  appType: () => {
    const type = 'Web';

    return type;
  },
  clientId: process.env.WEBEX_CLIENT_ID,
  clientSecret: process.env.WEBEX_CLIENT_SECRET,
};

Config.allowedOutboundTags = {
  'webex-mention': ['data-object-type', 'data-object-id', 'data-group-type', 'data-object-url'],
};

Config.webex = {
  maxReconnectAttempts: 5,
  conversation: {
    allowedInboundTags: Config.allowedInboundTags,
    allowedOutboundTags: Config.allowedOutboundTags,
  },
  credentials: {
    clientType: 'confidential',
    oauth: {
      /* eslint camelcase: [0] */
      client_id: Config.clientId,
      client_secret: Config.clientSecret,
      redirect_uri: process.env.LAUNCH_URL,
      scope: SCOPE,
    },
  },
  encryption: {
    decryptionFailureMessage: 'This message cannot be decrypted',
  },
  logger: {
    level: process.env.NODE_ENV === 'test' ? 'error' : 'error',
  },
  meetings: {
    metrics: {
      autoSendMQA: true,
    },
    autoUploadLogs: false,
    reconnection: {
      enabled: true,
    },
    enableRtx: true,
  },
  people: {
    showAllTypes: true,
  },
  metrics: {
    appVersion: Config.version,
    appType: Config.appType,
  },
  support: {
    appVersion: Config.version,
    appType: Config.appType,
    languageCode: 'en',
  },
  trackingIdPrefix: 'ITCLIENT',
  trackingIdSuffix: 'imu:false_imi:true',
};

module.exports = Config;
