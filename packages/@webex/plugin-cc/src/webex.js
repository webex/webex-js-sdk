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
 */
if (!global.Buffer) {
  global.Buffer = Buffer;
}

/**
 * Webex SDK class extended from the core SDK.
 * Includes custom configuration and plugin registration for CC (Contact Center) use cases.
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
 * @returns {Webex} A new Webex instance.
 */
Webex.init = function init(attrs = {}) {
  attrs.config = merge({}, config, attrs.config);

  return new Webex(attrs);
};

export default Webex;
