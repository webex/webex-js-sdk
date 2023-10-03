import * as Media from '@webex/internal-media-core';
import {LOGGER} from '../Logger/types';
import {ISDKConnector} from '../SDKConnector/types';
import {Eventing} from '../Events/impl';
import {CallingClientEventTypes} from '../Events/types';
import {ServiceData} from '../common/types';
import {ICall} from './calling/types';
import {CallingClientError} from '../Errors';

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

export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  mediaEngine: typeof Media;
  getSDKConnector: () => ISDKConnector;
  getLoggingLevel: () => LOGGER;
  getActiveCalls: () => Record<string, ICall[]>;
  getConnectedCall: () => ICall | undefined;
}
