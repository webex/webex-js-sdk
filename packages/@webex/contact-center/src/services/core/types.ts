import {
  AIAssistantEventName,
  AIAssistantEventType,
  HTTP_METHODS,
  RequestBody,
  WebexRequestPayload,
} from '../../types';
import * as Err from './Err';
import {Msg} from './GlobalTypes';

/** Selected structured diagnostics; retained for module declaration consumers, not root-exported. */
export type RecoveryFailure = {
  status?: number;
  reason?: string;
  reasonCode?: number;
  trackingId?: string;
  id?: string;
};

/** @internal Options for SDK-driven station recovery and state requests. */
export type AqmRequestContext = Readonly<{
  signal?: AbortSignal;
  correlationId?: string;
  requireCorrelation?: boolean;
}>;

export type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  operationId: string;
};

export type BindType = string | string[] | {[key: string]: BindType};
interface Bind {
  type: BindType;
  data?: any;
}

export type Timeout = number | 'disabled';

export type Req<TRes, TErr> = {
  kind?: 'session';
  url: string;
  host?: string;
  method?: HTTP_METHODS;
  err?:
    | ((errObj: WebexRequestPayload) => Err.Details<'Service.reqs.generic.failure'>)
    | Err.IdsMessage
    | ((e: WebexRequestPayload) => Err.Message | Err.Details<Err.IdsDetails>);
  notifSuccess: {bind: Bind; msg: TRes};
  notifFail?:
    | {
        bind: Bind;
        errMsg: TErr;
        err: (e: TErr) => Err.Details<Err.IdsDetails>;
      }
    | {
        bind: Bind;
        errId: Err.IdsDetails;
      };
  data?: RequestBody;
  headers?: Record<string, string>;
  timeout?: Timeout;
  notifCancel?: {bind: Bind; msg: TRes};
};

export type Conf<TRes, TErr, TReq> = (p: TReq) => Req<TRes, TErr>;
export type ConfEmpty<TRes, TErr> = () => Req<TRes, TErr>;
export type CbRes<TRes> = (res: any) => void | TRes;
export type Res<TRes, TReq> = {
  /** @internal */
  (p: TReq, cbRes: CbRes<TRes> | undefined, context: AqmRequestContext | undefined): Promise<TRes>;
  (p: TReq, cbRes?: CbRes<TRes>): Promise<TRes>;
};
export type ResEmpty<TRes> = {
  /** @internal */
  (cbRes: CbRes<TRes> | undefined, context: AqmRequestContext | undefined): Promise<TRes>;
  (cbRes?: CbRes<TRes>): Promise<TRes>;
};

/** @internal Pending request completed by a correlated RTD response. */
export type PendingRtdRequest<T> = {
  detachAbort?: () => void;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolve: (payload: T) => void;
  reject: (error: Error) => void;
};

/** @internal Request configuration for an event completed by an RTD response. */
export type RtdRequestOptions = Readonly<{
  signal?: AbortSignal;
  correlationId: string;
  rtdEventType: string;
  timeoutMs: number;
  createTimeoutError: () => Error;
  agentId: string;
  interactionId: string;
  eventType: AIAssistantEventType;
  eventName: AIAssistantEventName;
  eventMetaData?: Record<string, unknown>;
  publishTimestamp?: number;
  timeout?: number;
}>;
