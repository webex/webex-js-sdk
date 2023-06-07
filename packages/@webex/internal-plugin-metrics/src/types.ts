import {ClientEvent as RawClientEvent} from './call-diagnostic/types/ClientEvent';
import {FeatureEvent as RawFeatureEvent} from './call-diagnostic/types/FeatureEvent';
import {SubmitClientEventOptions} from './call-diagnostic/call-diagnostic-metrics';

export type InternalEvent = {
  name: 'client.pageJMT.received';
  payload?: RawClientEvent;
  options: SubmitClientEventOptions;
};

export interface GenericMetric {
  name: string;
  payload?: any;
  options?: any;
}

export interface ClientEvent extends GenericMetric {
  name: RawClientEvent['name'];
  payload?: RawClientEvent;
  options: SubmitClientEventOptions;
}

export interface BehavioralEvent extends GenericMetric {
  name: 'client.interstitial.joinButton.clicked' | 'client.meeting.initialize';
  payload?: {some: 'string'};
  options?: never;
}

export interface OperationalEvent extends GenericMetric {
  name: 'a' | 'b' | 'c'; // TODO: not implemented
  payload?: {some: 'string'};
  options?: never;
}

export interface FeatureEvent extends GenericMetric {
  name: RawFeatureEvent['name'];
  payload?: RawFeatureEvent;
  options?: never;
}

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

export type MetricEventNames =
  | ClientEvent['name']
  | BehavioralEvent['name']
  | OperationalEvent['name']
  | FeatureEvent['name']
  | InternalEvent['name'];
