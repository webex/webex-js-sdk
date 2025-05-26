/**
 * @fileoverview This module defines the core types and interfaces for Contact Center service
 * requests, configurations, and response handling. It includes definitions for request structures,
 * service configurations, notification bindings, timeouts, and callback types used across
 * the plugin’s HTTP and event-driven APIs.
 */
import {HTTP_METHODS, RequestBody, WebexRequestPayload} from '../../types';
import * as Err from './Err';
import {Msg} from './GlobalTypes';

/**
 * Represents a pending message handler in core services.
 * Contains logic to check for a matching message and handle it.
 */
export type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  alternateBind?: string;
};

/**
 * Defines the valid types for notification bindings.
 * Can be a string, array of strings, or nested object of bindings.
 * @internal
 */
export type BindType = string | string[] | {[key: string]: BindType};

/**
 * Represents a notification binding with its type and optional data.
 * @internal
 */
interface Bind {
  type: BindType;
  data?: any;
}

/**
 * Specifies the timeout for a request in milliseconds or 'disabled' to turn it off.
 * @internal
 */
export type Timeout = number | 'disabled';

/**
 * Describes a service request configuration including URL, method, payload,
 * and notification bindings for success, failure, and cancel events.
 * @internal
 */
export type Req<TRes, TErr> = {
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

/**
 * Function that returns a request configuration for a given request payload.
 * @internal
 */
export type Conf<TRes, TErr, TReq> = (p: TReq) => Req<TRes, TErr>;

/**
 * Function that returns a request configuration without any input parameters.
 * @internal
 */
export type ConfEmpty<TRes, TErr> = () => Req<TRes, TErr>;

/**
 * Executes a service request with a payload and optional callback, returning a promise of the response.
 * @internal
 */
export type Res<TRes, TReq> = (p: TReq, cbRes?: CbRes<TRes>) => Promise<TRes>;

/**
 * Executes a service request without payload, with optional callback, returning a promise of the response.
 * @internal
 */
export type ResEmpty<TRes> = (cbRes?: CbRes<TRes>) => Promise<TRes>;

/**
 * Callback invoked with the raw response; may return a transformed result.
 * @internal
 */
export type CbRes<TRes> = (res: any) => void | TRes;
