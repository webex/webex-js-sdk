/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import '@webex/plugin-authorization';
import '@webex/internal-plugin-calendar';
import '@webex/internal-plugin-device';
import '@webex/internal-plugin-presence';
import '@webex/internal-plugin-support';
import '@webex/internal-plugin-llm';
import '@webex/plugin-attachment-actions';
import '@webex/plugin-device-manager';
import '@webex/plugin-logger';
import '@webex/plugin-messages';
import '@webex/plugin-memberships';
import '@webex/plugin-people';
import '@webex/plugin-rooms';
import '@webex/plugin-teams';
import '@webex/plugin-team-memberships';
import '@webex/plugin-webhooks';
import '@webex/plugin-encryption';

import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';

import config from './config';

class WebexNode extends WebexCore {
  constructor(attrs) {
    super(attrs);
    this.webex = true;
    this.version = PACKAGE_VERSION;
  }
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
  static init(attrs = {}) {
    const newAttrs = {...attrs};
    newAttrs.config = merge(
      {
        sdkType: 'webex-node',
      },
      config,
      newAttrs.config
    ); 

    return new WebexNode(newAttrs);
  }
}


export default WebexNode;
