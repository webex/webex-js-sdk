/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-feature';
import '@webex/internal-plugin-metrics';

import MobiusSocket from './mobius-socket';
import config, {MobiusSocketConfig} from './config';

/**
 * Creates a calling-owned Mobius socket client for the provided Webex instance.
 *
 * @param webex
 * @param [mobiusSocketConfig]
 * @returns
 */
let mobiusSocketInstance: MobiusSocket | undefined; // Keeping just one instance of MobiusSocket since there won't be multiple connections

/**
 * Creates or returns the singleton Mobius socket client for the provided Webex instance.
 * @param webex - The Webex SDK instance
 * @param [mobiusSocketConfig] - Optional configuration overrides
 * @returns The singleton MobiusSocket instance
 */
export function getMobiusSocketInstance(
  webex: any,
  mobiusSocketConfig?: Partial<MobiusSocketConfig>
): MobiusSocket {
  if (mobiusSocketInstance) {
    return mobiusSocketInstance;
  }

  mobiusSocketInstance = new MobiusSocket(webex, {
    ...config.mobiusSocket,
    ...mobiusSocketConfig,
  });

  return mobiusSocketInstance;
}

/**
 * Resets the singleton MobiusSocket instance, allowing a new one to be created.
 * @returns
 */
export function resetMobiusSocketInstance() {
  mobiusSocketInstance = undefined;
}

export default MobiusSocket;
export {MobiusSocket};
export {default as Socket} from './socket';
export {config};
export {BadRequest, ConnectionError, Forbidden, NotAuthorized, UnknownResponse} from './errors';
