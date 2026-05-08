/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-feature';
import '@webex/internal-plugin-metrics';

import type {WebexSDK} from '../SDKConnector/types';
import MobiusSocket from './mobius-socket';
import config, {MobiusSocketConfig} from './config';

// Singleton instance - keeping just one instance of MobiusSocket since there won't be multiple connections
let mobiusSocketInstance: MobiusSocket | undefined;

/**
 * Creates or returns the singleton Mobius socket client for the provided Webex instance.
 *
 * @param webex - The Webex SDK instance
 * @param mobiusSocketConfig - Optional configuration overrides
 * @returns The singleton MobiusSocket instance
 */
export function getMobiusSocketInstance(
  webex: WebexSDK,
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
 */
export function resetMobiusSocketInstance() {
  mobiusSocketInstance = undefined;
}

export default MobiusSocket;
export {MobiusSocket};
