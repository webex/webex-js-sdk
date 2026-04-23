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
 * @param {object} webex
 * @param {object} [mobiusSocketConfig]
 * @returns {MobiusSocket}
 */
let mobiusSocketInstance; // Keeping just one instance of MobiusSocket since there won't be multiple connections

/**
 * Creates or returns the singleton Mobius socket client for the provided Webex instance.
 * @param {object} webex - The Webex SDK instance
 * @param {object} [mobiusSocketConfig] - Optional configuration overrides
 * @returns {MobiusSocket} The singleton MobiusSocket instance
 */
export function getMobiusSocketInstance(webex, mobiusSocketConfig) {
  if (mobiusSocketInstance) {
    return mobiusSocketInstance;
  }

  mobiusSocketInstance = new MobiusSocket(webex, mobiusSocketConfig || config.mobiusSocket);

  return mobiusSocketInstance;
}

/**
 * Resets the singleton MobiusSocket instance, allowing a new one to be created.
 * @returns {void}
 */
export function resetMobiusSocketInstance() {
  mobiusSocketInstance = undefined;
}

export default MobiusSocket;
export {MobiusSocket};
export {default as Socket} from './socket';
export {config};
export {BadRequest, ConnectionError, Forbidden, NotAuthorized, UnknownResponse} from './errors';
