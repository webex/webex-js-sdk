import {
  ClientEvent as RawClientEvent,
  Event as RawEvent,
  MediaQualityEvent as RawMediaQualityEvent,
} from '@webex/event-dictionary-ts';

export type Event = Omit<RawEvent, 'event'> & {event: RawClientEvent | RawMediaQualityEvent};

export type ClientEventError = NonNullable<RawClientEvent['errors']>[0];

export type SubmitClientEventOptions = {
  meetingId?: string;
  mediaConnections?: any[];
  rawError?: any;
  showToUser?: boolean;
  correlationId?: string;
  preLoginId?: string;
};

export type SubmitMQEOptions = {
  meetingId: string;
  mediaConnections?: any[];
  networkType?: Event['origin']['networkType'];
};

export type InternalEvent = {
  name:
    | 'internal.client.meetinginfo.request'
    | 'internal.client.meetinginfo.response'
    | 'internal.reset.join.latencies'
    | 'internal.client.interstitial-window.launched'
    | 'internal.client.meeting.click.joinbutton'
    | 'internal.host.meeting.participant.admitted'
    | 'internal.client.meeting.interstitial-window.showed'
    | 'internal.client.interstitial-window.click.joinbutton';
  payload?: never;
  options?: never;
};

export interface ClientEvent {
  name: RawClientEvent['name'];
  payload?: RawClientEvent;
  options?: SubmitClientEventOptions;
}

export interface BehavioralEvent {
  // TODO: not implemented
  name: 'host.meeting.participant.admitted' | 'sdk.media-flow.started';
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

export type ClientInfo = NonNullable<RawEvent['origin']['clientInfo']>;
export type ClientType = NonNullable<RawEvent['origin']['clientInfo']>['clientType'];
export type SubClientType = NonNullable<RawEvent['origin']['clientInfo']>['subClientType'];
export type NetworkType = NonNullable<RawEvent['origin']>['networkType'];

export type ClientEventPayload = RecursivePartial<ClientEvent['payload']>;
export type ClientEventLeaveReason = ClientEvent['payload']['leaveReason'];
export type ClientEventPayloadError = ClientEvent['payload']['errors'];

export type MediaQualityEventAudioSetupDelayPayload = NonNullable<
  MediaQualityEvent['payload']
>['audioSetupDelay'];
export type MediaQualityEventVideoSetupDelayPayload = NonNullable<
  MediaQualityEvent['payload']
>['videoSetupDelay'];

export type SubmitMQEPayload = RecursivePartial<MediaQualityEvent['payload']> & {
  intervals: NonNullable<MediaQualityEvent['payload']>['intervals'];
};

export type SubmitInternalEvent = (args: {
  name: InternalEvent['name'];
  payload?: RecursivePartial<InternalEvent['payload']>;
  options?: any;
}) => void;

export type SubmitBehavioralEvent = (args: {
  name: BehavioralEvent['name'];
  payload?: RecursivePartial<BehavioralEvent['payload']>;
  options?: any;
}) => void;

export type SubmitClientEvent = (args: {
  name: ClientEvent['name'];
  payload?: RecursivePartial<ClientEvent['payload']>;
  options?: SubmitClientEventOptions;
}) => Promise<any>;

export type SubmitOperationalEvent = (args: {
  name: OperationalEvent['name'];
  payload?: RecursivePartial<OperationalEvent['payload']>;
  options?: any;
}) => void;

export type SubmitMQE = (args: {
  name: MediaQualityEvent['name'];
  payload: SubmitMQEPayload;
  options: any;
}) => void;

export type BuildClientEventFetchRequestOptions = (args: {
  name: ClientEvent['name'];
  payload?: RecursivePartial<ClientEvent['payload']>;
  options?: SubmitClientEventOptions;
}) => Promise<any>;
