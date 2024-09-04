import {
  ClientEvent as RawClientEvent,
  Event as RawEvent,
  MediaQualityEvent as RawMediaQualityEvent,
} from '@webex/event-dictionary-ts';

export type Event = Omit<RawEvent, 'event'> & {event: RawClientEvent | RawMediaQualityEvent};

export type ClientEventError = NonNullable<RawClientEvent['errors']>[0];

export type EnvironmentType = NonNullable<RawEvent['origin']['environment']>;

export type NewEnvironmentType = NonNullable<RawEvent['origin']['newEnvironment']>;

export type ClientLaunchMethodType = NonNullable<
  RawEvent['origin']['clientInfo']
>['clientLaunchMethod'];

export type BrowserLaunchMethodType = NonNullable<
  RawEvent['origin']['clientInfo']
>['browserLaunchMethod'];

export type MetricEventProduct = 'webex' | 'wxcc_desktop';

export type MetricEventAgent = 'user' | 'browser' | 'system' | 'sdk' | 'redux' | 'service';

export type MetricEventVerb =
  | 'create'
  | 'get'
  | 'fetch'
  | 'update'
  | 'list'
  | 'delete'
  | 'select'
  | 'view'
  | 'set'
  | 'toggle'
  | 'load'
  | 'reload'
  | 'click'
  | 'hover'
  | 'register'
  | 'unregister'
  | 'enable'
  | 'disable'
  | 'use'
  | 'complete'
  | 'submit'
  | 'apply'
  | 'cancel'
  | 'abort'
  | 'sync'
  | 'login'
  | 'logout'
  | 'answer'
  | 'activate'
  | 'deactivate';

export type SubmitClientEventOptions = {
  meetingId?: string;
  mediaConnections?: any[];
  rawError?: any;
  correlationId?: string;
  preLoginId?: string;
  environment?: EnvironmentType;
  newEnvironmentType?: NewEnvironmentType;
  clientLaunchMethod?: ClientLaunchMethodType;
  browserLaunchMethod?: BrowserLaunchMethodType;
  webexConferenceIdStr?: string;
  globalMeetingId?: string;
};

export type SubmitMQEOptions = {
  meetingId: string;
  mediaConnections?: any[];
  networkType?: Event['origin']['networkType'];
  webexConferenceIdStr?: string;
  globalMeetingId?: string;
};

export type InternalEvent = {
  name:
    | 'internal.client.meetinginfo.request'
    | 'internal.client.meetinginfo.response'
    | 'internal.register.device.request'
    | 'internal.register.device.response'
    | 'internal.reset.join.latencies'
    | 'internal.client.meeting.click.joinbutton'
    | 'internal.host.meeting.participant.admitted'
    | 'internal.client.meeting.interstitial-window.showed'
    | 'internal.client.interstitial-window.click.joinbutton'
    | 'internal.client.add-media.turn-discovery.start'
    | 'internal.client.add-media.turn-discovery.end';

  payload?: never;
  options?: never;
};

export interface ClientEvent {
  name: RawClientEvent['name'];
  payload?: RawClientEvent;
  options?: SubmitClientEventOptions;
}

export interface BehavioralEventContext {
  app: {version: string};
  device: {id: string};
  locale: string;
  os: {
    name: string;
    version: string;
  };
}

export interface BehavioralEvent {
  context: BehavioralEventContext;
  metricName: string;
  tags: Record<string, string | number | boolean>;
  timestamp: number;
  type: string[];
}

export type BehavioralEventPayload = BehavioralEvent['tags'];

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
  | BehavioralEvent['metricName']
  | OperationalEvent['name']
  | FeatureEvent['name']
  | MediaQualityEvent['name'];

export type ClientInfo = NonNullable<RawEvent['origin']['clientInfo']>;
export type ClientType = NonNullable<RawEvent['origin']['clientInfo']>['clientType'];
export type SubClientType = NonNullable<RawEvent['origin']['clientInfo']>['subClientType'];
export type NetworkType = NonNullable<RawEvent['origin']>['networkType'];

export type ClientSubServiceType = ClientEvent['payload']['webexSubServiceType'];
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
  product: MetricEventProduct;
  agent: MetricEventAgent;
  target: string;
  verb: MetricEventVerb;
  payload?: BehavioralEventPayload;
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

export type PreComputedLatencies =
  | 'internal.client.pageJMT'
  | 'internal.download.time'
  | 'internal.get.cluster.time'
  | 'internal.click.to.interstitial'
  | 'internal.refresh.captcha.time'
  | 'internal.exchange.ci.token.time'
  | 'internal.get.u2c.time'
  | 'internal.call.init.join.req'
  | 'internal.other.app.api.time'
  | 'internal.api.fetch.intelligence.models';
