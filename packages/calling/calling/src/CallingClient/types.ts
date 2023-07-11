import * as Media from '@webex/internal-media-core';
import {CallingClientError} from '../Errors';
import {LOGGER} from '../Logger/types';
import {ISDKConnector} from '../SDKConnector/types';

import {Eventing} from '../Events/impl';
import {CallingClientEventTypes, EVENT_KEYS} from '../Events/types';
import {
  CallDetails,
  CorrelationId,
  IDeviceInfo,
  MobiusDeviceId,
  MobiusStatus,
  ServiceData,
} from '../common/types';
import {ICall} from './calling/types';

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

export type CallingClientEmitterCallback = (
  event: EVENT_KEYS,
  deviceInfo?: IDeviceInfo,
  clientError?: CallingClientError
) => void;
export type CallingClientErrorEmitterCallback = (
  err: CallingClientError,
  finalError?: boolean
) => void;

export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  mediaEngine: typeof Media;
  getSDKConnector: () => ISDKConnector;
  register: () => void;
  sendKeepAlive: (_deviceInfo: IDeviceInfo) => Promise<void>;
  deregister: () => void;
  getRegistrationStatus: () => MobiusStatus;
  getLoggingLevel: () => LOGGER;
  getDeviceId: () => MobiusDeviceId | undefined;
  getActiveMobiusUrl: () => string;
  setActiveMobiusUrl: (uri: string) => void;
  makeCall: (dest: CallDetails) => ICall | undefined;
  getCall: (correlationId: CorrelationId) => ICall;
}
