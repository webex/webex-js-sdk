/**
 * Authentication module for Contact Center
 */

export function generateWebexConfig({credentials}) {
  return {
    appName: 'sdk-samples',
    appPlatform: 'testClient',
    fedramp: false,
    logger: {
      level: 'info'
    },
    credentials,
  };
}

export async function initOauth() {
  let redirectUri = `${window.location.protocol}//${window.location.host}`;

  if (window.location.pathname) {
    redirectUri += window.location.pathname;
  }

  // Reference: https://developer.webex-cx.com/documentation/integrations
  const ccMandatoryScopes = [
    "cjp:config_read",
    "cjp:config_write",
    "cjp:config",
    "cjp:user",
  ];

  const webRTCCallingScopes = [
    "spark:webrtc_calling",
    "spark:calls_read",
    "spark:calls_write",
    "spark:xsi"
  ];

  const additionalScopes = [
    "spark:kms", // to avoid token downscope to only spark:kms error on SDK init
  ];

  const requestedScopes = Array.from(
    new Set(
      ccMandatoryScopes
      .concat(webRTCCallingScopes)
      .concat(additionalScopes))
  ).join(' ');

  const webex = window.webex = Webex.init({
    config: generateWebexConfig({
      credentials: {
        client_id: 'C07d7fa2815fc2bc925c687d202b83cc35ffa868399347eda2effceeb4418fc12', // Replace with your client ID
        redirect_uri: redirectUri,
        scope: requestedScopes,
      }
    })
  });

 await webex.authorization.initiateLogin();

  return webex;
}

export function initWithAccessToken(accessToken) {
  const webexConfig = generateWebexConfig({});

  const webex = window.webex = Webex.init({
    config: webexConfig,
    credentials: {
      access_token: accessToken
    }
  });

  return new Promise((resolve, reject) => {
    webex.once('ready', () => {
      console.log('Authentication#initWebex() :: Webex Ready');
      resolve(webex);
    });

    // Add a timeout for initialization
    setTimeout(() => {
      reject(new Error('Webex initialization timed out'));
    }, 10000);
  });
}
