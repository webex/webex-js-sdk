/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-feature';
import '@webex/internal-plugin-metrics';

import MobiusSocket from './mobius-socket';
import config from './config';

/**
 * Creates a calling-owned Mobius socket client for the provided Webex instance.
 *
 * Note: this mutates `webex.config` to ensure `WebexPlugin` can resolve
 * `this.config` via the Mobius socket namespace.
 *
 * @param {object} webex
 * @param {object} [mobiusSocketConfig={}]
 * @returns {MobiusSocket}
 */
export function createMobiusSocket(webex, mobiusSocketConfig = {}) {
  const webexConfig = webex.config || {};
  const mobiusConfig = {
    ...config.mobiusSocket,
    ...(webexConfig.mobiusSocket || {}),
    ...mobiusSocketConfig,
  };

  webex.config = {
    ...webexConfig,
    mobiussocket: mobiusConfig,
  };

  return new MobiusSocket({}, {parent: webex});
}

export default MobiusSocket;
export {MobiusSocket};
export {default as Socket} from './socket';
export {config};
export {BadRequest, ConnectionError, Forbidden, NotAuthorized, UnknownResponse} from './errors';
