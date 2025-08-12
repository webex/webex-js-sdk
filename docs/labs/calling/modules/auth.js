export async function initCalling({ token, fedramp = false, useIntegration = false }) {
  if (!token) throw new Error('Access token is required');

  const webexConfig = {
    fedramp,
    config: { fedramp },
    credentials: { access_token: token }
  };

  if (useIntegration) {
    webexConfig.config.services = {
      discovery: {
        u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
        hydra: 'https://hydra-intb.ciscospark.com/v1/'
      }
    };
  }

  const callingConfig = {
    clientConfig: {
      calling: !fedramp,
      callHistory: true,
      voicemail: true,
      callSettings: !fedramp,
      contact: !fedramp
    },
    callingClientConfig: {
      discovery: { region: '', country: '' },
      serviceData: { indicator: 'calling', domain: '' }
    },
    logger: { level: 'info' }
  };

  const callingInstance = await Calling.init({ webexConfig, callingConfig });

  await new Promise((resolve) => {
    callingInstance.on('ready', resolve);
  });

  return { callingInstance, client: callingInstance.callingClient };
}

// OAuth scopes aligned to Calling/BNR
const callingScopes = [
  'spark:webrtc_calling',
  'spark:calls_read',
  'spark:calls_write',
  'spark:kms',
  'spark:xsi'
].join(' ');

/**
 * Start OAuth flow using Webex UMD
 * @param {Object} cfg
 * @param {string} cfg.clientId - Public client id from Webex Developer Portal
 * @param {string} [cfg.redirectUri] - Optional redirect override
 * @param {string} [cfg.scope] - Optional scopes override
 */
export async function initOauth({ clientId, redirectUri, scope } = {}) {
  const webex = Webex.init({
    config: {
      credentials: {
        client_id: clientId || 'YOUR_PUBLIC_CLIENT_ID',
        redirect_uri: redirectUri || (window.location.origin + window.location.pathname),
        scope: scope || callingScopes
      }
    }
  });

  await webex.authorization.initiateLogin({ state: {} });
  return webex;
}



