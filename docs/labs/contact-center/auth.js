/**
 * Authentication functionality for Contact Center SDK
 * Shows both simple window.webex usage and robust implementation
 */

// Required Contact Center scopes
const ccMandatoryScopes = [
    "cjp:config_read",   // Read configuration
    "cjp:config_write",  // Modify configuration  
    "cjp:config",        // General configuration access
    "cjp:user"          // User operations
];

const webRTCCallingScopes = [
    "spark:webrtc_calling", // Browser calling
    "spark:calls_read",     // Read call data
    "spark:calls_write",    // Modify call state
    "spark:xsi"            // Extended services
];

const additionalScopes = [
    "spark:kms"  // Required for encryption 
];

// Combine all required scopes
const requestedScopes = Array.from(
    new Set(ccMandatoryScopes
        .concat(webRTCCallingScopes)
        .concat(additionalScopes))
).join(' ');

/**
 * Initialize SDK with access token
 * Simple usage from lab.html:
 * window.webex = Webex.init({
 *     credentials: {
 *         access_token: 'your_token'
 *     }
 * });
 */
export async function initWithAccessToken(accessToken) {
    const webex = Webex.init({
        credentials: {
            access_token: accessToken
        }
    });

    // Return promise that resolves when auth is complete
    return new Promise((resolve, reject) => {
        const onReady = () => {
            webex.off('ready', onReady);
            webex.off('ready.authorization', onReady);
            clearTimeout(timeout);
            resolve(webex);
        };

        webex.on('ready', onReady);
        webex.on('ready.authorization', onReady);

        // Add timeout
        const timeout = setTimeout(() => {
             webex.off('ready', onReady);
webex.off('ready.authorization', onReady);
            reject(new Error('Initialization timed out'));
        }, 10000);
    });
}

/**
 * Initialize SDK with OAuth
 * Simple usage from lab.html:
 * window.webex = Webex.init({
 *     credentials: {
 *         client_id: 'your_client_id',
 *         redirect_uri: 'your_app_url',
 *         scope: 'spark:all spark:kms'
 *     }
 * });
 * await window.webex.authorization.initiateLogin();
 */
export async function initOauth(config = {}) {
    const defaultConfig = {
        client_id: 'C07d7fa2815fc2bc925c687d202b83cc35ffa868399347eda2effceeb4418fc12', // Replace with your client ID
        redirect_uri: window.location.origin + window.location.pathname,
        scope: requestedScopes
    };

    const webex = Webex.init({
        config: {
            credentials: {
                ...defaultConfig,
                ...config
            }
        }
    });

    // Start OAuth flow
    await webex.authorization.initiateLogin({
        state: {} // Optional state data
    });

    return webex;
}
