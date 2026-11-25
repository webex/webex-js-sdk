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

/** Command admission belongs to the current generation; retained for Req declarations. */
export type AqmOperationKind = 'command' | 'query' | 'session' | 'teardown';
export type AqmSessionOwner<P extends 'restore' | 'manual'> = Readonly<{
  generation: number;
  phase: P;
  signal: AbortSignal;
}>;
export type AqmRequestContext = Readonly<{
  generation: number;
  signal?: AbortSignal;
  sessionOwner?: AqmSessionOwner<'restore' | 'manual'>;
  correlationId?: string;
  requireCorrelation?: boolean;
}>;
export type AqmRecoveryGate =
  | Readonly<{state: 'open'}>
  | Readonly<{state: 'recovering'; sessionOwner?: AqmSessionOwner<'restore'>}>
  | Readonly<{state: 'manualLoginRequired'; sessionOwner?: AqmSessionOwner<'manual'>}>
  | Readonly<{state: 'unavailable'; reason: 'RECOVERY_INTERRUPTED' | 'REGION_RELOAD_REQUIRED'}>;

export type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  operationId: string;
  logicalBindKey: string;
};

export type BindType = string | string[] | {[key: string]: BindType};
interface Bind {
  type: BindType;
  data?: any;
}

export type Timeout = number | 'disabled';

export type Req<TRes, TErr> = {
  kind?: AqmOperationKind;
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
export type Res<TRes, TReq> = (
  p: TReq,
  cbRes?: CbRes<TRes>,
  context?: AqmRequestContext
) => Promise<TRes>;
export type ResEmpty<TRes> = (cbRes?: CbRes<TRes>, context?: AqmRequestContext) => Promise<TRes>;
export type CbRes<TRes> = (res: any) => void | TRes;

/** @internal Pending request completed by a correlated RTD response. */
export type PendingRtdRequest<T> = {
  detachAbort?: () => void;
  correlationId: string;
  rtdEventType: string;
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
