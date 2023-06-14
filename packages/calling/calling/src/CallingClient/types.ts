import * as Media from '@webex/internal-media-core';
import {CallingClientError} from '../Errors';
import {ISDKConnector} from '../SDKConnector/types';

import {Eventing} from '../Events/impl';
import {CallingClientEventTypes} from '../Events/types';
import {
  CallDetails,
  CorrelationId,
  IDeviceInfo,
  MobiusDeviceId,
  MobiusStatus,
  ServiceData,
} from '../common/types';
import {ICall} from './calling/types';
import {METRIC_TYPE, METRIC_EVENT, REG_ACTION} from './metrics/types';

import {LOGGER} from '../Logger/types';
import {LoggerConfig} from '../Calling/types';


interface DiscoveryConfig {
  country: string;
  region: string;
}

export interface CallingClientConfig {
  logger: LoggerConfig;
  discovery?: DiscoveryConfig;
  serviceData?: ServiceData;
}

export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  mediaEngine: typeof Media;
  getSDKConnector: () => ISDKConnector;
  register: (retry: boolean) => void;
  sendKeepAlive: (_deviceInfo: IDeviceInfo) => Promise<void>;
  deregister: () => void;
  getRegistrationStatus: () => MobiusStatus;
  getLoggingLevel: () => LOGGER;
  getDeviceId: () => MobiusDeviceId | undefined;
  getMobiusUrl: () => string;
  sendMetric: (
    name: METRIC_EVENT,
    action: REG_ACTION,
    metric: METRIC_TYPE,
    error?: CallingClientError
  ) => void;
  makeCall: (dest: CallDetails) => ICall | undefined;
  setMobiusUrl: (uri: string) => void;
  getCall: (correlationId: CorrelationId) => ICall;
  restorePreviousRegistration: (caller: string) => Promise<boolean>;
}
