import * as Media from '@webex/internal-media-core';
import {LOGGER} from '../Logger/types';
import {ISDKConnector} from '../SDKConnector/types';
import {Eventing} from '../Events/impl';
import {CallingClientEventTypes} from '../Events/types';
import {ServiceData} from '../common/types';
import {ICall} from './calling/types';
import {CallingClientError} from '../Errors';
import {ILine} from './line/types';

export interface LoggerConfig {
  level: LOGGER;
}

interface DiscoveryConfig {
  country: string;
  region: string;
}

export interface CallingClientConfig {
  logger?: LoggerConfig;
  discovery?: DiscoveryConfig;
  serviceData?: ServiceData;
}

export type CallingClientErrorEmitterCallback = (
  err: CallingClientError,
  finalError?: boolean
) => void;

/**
 * Interface for `CallingClient` module.
 * `CallingClient` module is designed to offer set of APIs that are related to doing line registration, calling functionalities on the SDK
 */
export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  // TODO: do we need this?
  mediaEngine: typeof Media;
  getSDKConnector(): ISDKConnector;
  getLoggingLevel(): LOGGER;

  /**
   * Retrieves details of the line object(s) belonging to a user.
   *
   * @returns A dictionary where each key is a line identifier and the corresponding
   *          value is the {@link ILine} object associated with that identifier.
   *
   * @example
   * ```typescript
   * const lines = callingClient.getLines();
   * // {
   * //   'lineId1': lineObj1,
   * //   'lineId2': lineObj2,
   * // }
   */
  getLines(): Record<string, ILine>;

  /**
   * Retrieves a dictionary of active calls grouped by `lineId`.
   *
   * This method gathers active call objects and organizes them into a dictionary
   * where keys represent `lineId`s and values are arrays of active calls associated
   * with each line.
   *
   * @returns A dictionary where each key is a `lineId` and the corresponding value
   *          is an array of {@link ICall} objects that are active and associated with that line.
   *
   * @example
   * ```typescript
   * const activeCalls = callingClient.getActiveCalls();
   * // {
   * //   'line1': [call1, call2],
   * //   'line2': [call3],
   * // }
   * ```
   */
  getActiveCalls(): Record<string, ICall[]>;

  /**
   * Retrieves the call object for the currently connected call in the client.
   *
   * This method iterates through active call objects and returns the call
   * that is currently connected (not on hold).
   *
   * @returns The {@link ICall} object for the connected call, or undefined if no connected
   *          call is found.
   *
   * @example
   * ```typescript
   * const connectedCall = callingClient.getConnectedCall();
   * if (connectedCall) {
   *   console.log(`Connected call ID: ${connectedCall.callId}`);
   * } else {
   *   console.log('No connected calls.');
   * }
   * ```
   */
  getConnectedCall(): ICall | undefined;
}
