import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';
import {Buffer} from 'safe-buffer';
import '@webex/plugin-authorization';
import '@webex/internal-plugin-mercury';
import '@webex/plugin-logger';
import '@webex/internal-plugin-support';

import './index';

import config from './webex-config';

/**
 * Ensures global Buffer is defined, which is required for SDK functionality in some environments.
 * @ignore
 */
if (!global.Buffer) {
  global.Buffer = Buffer;
}

/**
 * Webex SDK class extended from the core SDK.
 * Includes custom configuration and plugin registration for CC (Contact Center) use cases.
 * @ignore
 */
const Webex = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

/**
 * Initializes a new Webex instance with merged configuration.
 *
 * @param {Object} [attrs={}] - Initialization attributes.
 * @param {Object} [attrs.config] - Optional custom config to override defaults.
 * @param {Object} [attrs.config.logger] - Logging configuration.
 * @param {string} [attrs.config.logger.level='info'] - Logging level (e.g., 'debug', 'info').
 * @param {string} [attrs.config.logger.bufferLogLevel='log'] - Log buffering level for log uploads.
 * @param {Object} [attrs.config.cc] - Contact Center (CC) specific configurations.
 * @param {boolean} [attrs.config.cc.allowMultiLogin=false] - Whether to allow multiple logins.
 * @param {boolean} [attrs.config.cc.allowAutomatedRelogin=true] - Whether to allow automated re-login.
 * @param {string} [attrs.config.cc.clientType='WebexCCSDK'] - Type of the client.
 * @param {boolean} [attrs.config.cc.isKeepAliveEnabled=false] - Whether to enable keep-alive functionality.
 * @param {boolean} [attrs.config.cc.force=true] - Whether to force specific CC configurations.
 * @param {Object} [attrs.config.cc.metrics] - Metrics configuration for CC.
 * @param {string} [attrs.config.cc.metrics.clientName='WEBEX_JS_SDK'] - Metrics client name.
 * @param {string} [attrs.config.cc.metrics.clientType='WebexCCSDK'] - Metrics client type.
 * @returns {Webex} A new Webex instance.
 *
 * @see {@link https://developer.webex.com/meeting/docs/sdks/webex-meetings-sdk-web-quickstart#webex-object-attribute-reference} - Webex Object Attribute Reference for SDK Configuration.
 *
 * This configuration merges the default `webex-config` with any custom configuration provided as `attrs.config`.
 * The merged configuration governs various SDK behaviors, such as authorization, logging, and CC-specific settings.
 *
 * @example <caption>Basic Usage</caption>
 * import Webex from '@webex/plugin-cc';
 *
 * // Initialize Webex SDK with default configuration
 * const webex = Webex.init();
 *
 * @example <caption>Custom Configuration</caption>
 * import Webex from '@webex/plugin-cc';
 *
 * const customConfig = {
 *   logger: {
 *     level: 'debug', // Enable debug logging
 *     bufferLogLevel: 'log', // Used for upload logs
 *   },
 *   credentials: {
 *     client_id: 'your-client-id', // Replace with your Webex application's client ID
 *     client_secret: 'your-client-secret', // Replace with your Webex application's client secret
 *     redirect_uri: 'https://your-redirect-uri', // Replace with your app's redirect URI
 *   },
 *   cc: {
 *     allowMultiLogin: false, // Disallow multiple logins
 *     allowAutomatedRelogin: true, // Enable automated re-login
 *     clientType: 'WebexCCSDK', // Specify the Contact Center client type
 *     isKeepAliveEnabled: false, // Disable keep-alive functionality
 *     force: true, // Force CC-specific configurations
 *     metrics: {
 *       clientName: 'WEBEX_JS_SDK', // Metrics client name
 *       clientType: 'WebexCCSDK', // Metrics client type
 *     },
 *   },
 * };
 *
 * // Initialize Webex SDK with custom configuration
 * const webex = Webex.init({ config: customConfig });
 */
Webex.init = function init(attrs = {}) {
  attrs.config = merge({}, config, attrs.config);

  return new Webex(attrs);
};

export default Webex;
