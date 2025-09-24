/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Note: this file uses ES module syntax (import/export) for consistency
// with the rest of the codebase and modern JavaScript standards

/* eslint camelcase: [0] */

import '@webex/plugin-authorization';
// explicitly load wdm, since we're relying on preDiscoveryServices and the
// url interceptor
import '@webex/internal-plugin-calendar';
import '@webex/internal-plugin-device';
import '@webex/internal-plugin-dss';
import '@webex/internal-plugin-presence';
import '@webex/internal-plugin-support';
import '@webex/internal-plugin-llm';
import '@webex/plugin-attachment-actions';
import '@webex/plugin-device-manager';
import '@webex/plugin-logger';
import '@webex/plugin-meetings';
import '@webex/plugin-messages';
import '@webex/plugin-memberships';
import '@webex/plugin-people';
import '@webex/plugin-rooms';
import '@webex/plugin-teams';
import '@webex/plugin-team-memberships';
import '@webex/plugin-webhooks';
import '@webex/plugin-encryption';
import '@webex/contact-center';

import merge from 'lodash/merge';
import WebexCore from '@webex/webex-core';

import config from './config';

// documentation.js puts hashes in relative urls, so need to specify full urls
// here
/**
 * See {@link https://webex.github.io/webex-js-sdk/example/browsers|Browser Guide} and
 * {@link https://webex.github.io/webex-js-sdk/example/servers|Server Guide}
 * @see {@link /example/browsers|Browser Guide}
 * @see {@link /example/servers|Server Guide}
 * @class Webex
 */
class Webex extends WebexCore {
  constructor(attrs) {
    super(attrs);
    this.webex = true;
    this.version = PACKAGE_VERSION;
  }

  /**
   * Create a new {@link Webex} instance
   *
   * @example
   * <caption>Create a new Webex instance configured for your OAuth client</caption>
   * const webex = Webex.init({
   *   config: {
   *     credentials: {
   *       authorizationString: `<AUTHORIZATION URL FROM DEVELOPER PORTAL>`
   *     }
   *   }
   * });
   *
   * @example
   * <caption>Create a new Webex instance configured for a Bot</caption>
   * const webex = Webex.init({
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
        sdkType: 'webex',
      },
      config,
      newAttrs.config
    );

    return new Webex(newAttrs);
  }
}
export default Webex;
