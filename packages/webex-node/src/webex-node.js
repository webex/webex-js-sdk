/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Note: this file is written using commonjs instead of import/export to
// simplify consumption by those less familiar with the current state of
// JavaScript modularization

/* eslint camelcase: [0] */

require('@webex/plugin-authorization');
require('@webex/internal-plugin-calendar');
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-presence');
require('@webex/internal-plugin-support');
require('@webex/internal-plugin-llm');
require('@webex/plugin-attachment-actions');
require('@webex/plugin-device-manager');
require('@webex/plugin-logger');
require('@webex/plugin-messages');
require('@webex/plugin-memberships');
require('@webex/plugin-people');
require('@webex/plugin-rooms');
require('@webex/plugin-teams');
require('@webex/plugin-team-memberships');
require('@webex/plugin-webhooks');
require('@webex/plugin-encryption');

const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = require('./config');

const WebexNode = WebexCore.extend({
  webex: true,
  version: PACKAGE_VERSION,
});

/**
 * Create a new {@link Webex} instance
 *
 * @example
 * <caption>Create a new WebexNode instance configured for your OAuth client</caption>
 * const webex = WebexNode.init({
 *   config: {
 *     credentials: {
 *       authorizationString: `<AUTHORIZATION URL FROM DEVELOPER PORTAL>`
 *     }
 *   }
 * });
 *
 * @example
 * <caption>Create a new WebexNode instance configured for a Bot</caption>
 * const webex = WebexNode.init({
 *   credentials: `<BOT TOKEN FROM DEVELOPER PORTAL>`
 * });
 *
 *
 * @param {Object} attrs
 * @param {Object} attrs.config (optional)
 * @memberof Webex
 * @returns {Webex}
 */
WebexNode.init = function init(attrs = {}) {
  attrs.config = merge(
    {
      sdkType: 'webex-node',
    },
    config,
    attrs.config
  ); // eslint-disable-line no-param-reassign

  return new WebexNode(attrs);
};

module.exports = WebexNode;
