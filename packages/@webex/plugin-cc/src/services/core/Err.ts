import {WebexRequestPayload} from '../../types';
import {Failure} from './GlobalTypes';

export type ErrDetails = {status: number; type: string; trackingId: string};

export type AgentErrorIds =
  | {'Service.aqm.agent.stationLogin': ErrDetails}
  | {'Service.aqm.agent.stationLoginFailed': Failure}
  | {'Service.aqm.agent.stateChange': Failure}
  | {'Service.aqm.agent.reload': Failure}
  | {'Service.aqm.agent.logout': Failure}
  | {'Service.reqs.generic.failure': {trackingId: string}}
  | {'Service.aqm.agent.BuddyAgentsRetrieveFailed': Failure};

export type ReqError =
  | 'Service.aqm.reqs.GenericRequestError'
  | {'Service.aqm.reqs.Pending': {key: string; msg: string}}
  | {'Service.aqm.reqs.PendingEvent': {key: string}}
  | {'Service.aqm.reqs.Timeout': {key: string; response: WebexRequestPayload}}
  | {'Service.aqm.reqs.TimeoutEvent': {key: string}};

export interface Ids {
  'Service.aqm.agent': AgentErrorIds;
  'Service.aqm.reqs': ReqError;
}

export type IdsGlobal =
  | 'system' // to handle errors that was not created by 'new Err.WithId()'
  | 'handle'
  | 'fallback';

export type IdsSub = Ids[keyof Ids];

export type IdsMessage = IdsGlobal | keyof Ids | Exclude<IdsSub, object>;

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

export type FlattenUnion<T> = {
  [K in keyof UnionToIntersection<T>]: K extends keyof T
    ? T[K] extends any[]
      ? T[K]
      : T[K] extends object
      ? FlattenUnion<T[K]>
      : T[K]
    : UnionToIntersection<T>[K];
};
export type IdsDetailsType = FlattenUnion<Exclude<IdsSub, string>>;

export type IdsDetails = keyof IdsDetailsType;

export type Id = IdsMessage | IdsDetails;

export class Message extends Error {
  readonly id: Id;

  constructor(id: IdsMessage);
  constructor(id: IdsMessage, message: string);
  constructor(id: IdsMessage, errror: Error);
  constructor(id: IdsMessage, value?: string | Error) {
    super();

    this.id = id;
    this.stack = new Error().stack!;

    if (typeof value === 'string') {
      this.message = value;
    } else if (value instanceof Error) {
      this.message = value.message;
      this.name = value.name;
    } else {
      this.message = '';
    }
  }

  // Marker to distinct Err class from other errors
  private isErr = 'yes';
}

export class Details<T extends IdsDetails> extends Error {
  readonly id: Id;
  readonly details: IdsDetailsType[T];

  constructor(id: T, details: IdsDetailsType[T]) {
    super();

    this.id = id;
    this.stack = new Error().stack!;
    this.details = details;
  }

  // Marker to distinct Err class from other errors
  private isErr = 'yes';
}
