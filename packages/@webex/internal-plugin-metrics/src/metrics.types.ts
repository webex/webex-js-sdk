import {ClientEvent as RawClientEvent} from './call-diagnostic/generated-types-temp/ClientEvent';
import {Event as RawEvent} from './call-diagnostic/generated-types-temp/Event';
import {MediaQualityEvent as RawMediaQualityEvent} from './call-diagnostic/generated-types-temp/MediaQualityEvent';

export type Event = Omit<RawEvent, 'event'> & {event: RawClientEvent | RawMediaQualityEvent};

export type ClientEventError = NonNullable<RawClientEvent['errors']>[0];

export type SubmitClientEventOptions = {
  meetingId?: string;
  mediaConnections?: any[];
  rawError?: any;
  showToUser?: boolean;
};

export type SubmitMQEOptions = {
  meetingId: string;
  mediaConnections?: any[];
  networkType?: Event['origin']['networkType'];
};

export type InternalEvent = {
  name: 'internal.client.meetinginfo.request' | 'internal.client.meetinginfo.response';
  payload?: never;
  options?: never;
};

export interface ClientEvent {
  name: RawClientEvent['name'];
  payload?: RawClientEvent;
  options: SubmitClientEventOptions;
}

export interface BehavioralEvent {
  // TODO: not implemented
  name: 'host.meeting.participant.admitted' | 'client.pageJMT.received' | 'sdk.media-flow.started';
  payload?: never;
  options?: never;
}

export interface OperationalEvent {
  // TODO: not implemented
  name: never;
  payload?: never;
  options?: never;
}

export interface FeatureEvent {
  // TODO: not implemented
  name: never;
  payload?: never;
  options?: never;
}

export interface MediaQualityEvent {
  name: RawMediaQualityEvent['name'];
  payload?: RawMediaQualityEvent;
  options: SubmitMQEOptions;
}

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

export type MetricEventNames =
  | InternalEvent['name']
  | ClientEvent['name']
  | BehavioralEvent['name']
  | OperationalEvent['name']
  | FeatureEvent['name']
  | MediaQualityEvent['name'];

export type ClientType = NonNullable<RawEvent['origin']['clientInfo']>['clientType'];
export type SubClientType = NonNullable<RawEvent['origin']['clientInfo']>['subClientType'];
export type NetworkType = RawEvent['origin']['networkType'];

export type MediaQualityEventAudioSetupDelayPayload =
  MediaQualityEvent['payload']['audioSetupDelay'];
export type MediaQualityEventVideoSetupDelayPayload =
  MediaQualityEvent['payload']['videoSetupDelay'];

export type SubmitMQEPayload = RecursivePartial<MediaQualityEvent['payload']> & {
  intervals: MediaQualityEvent['payload']['intervals'];
};
