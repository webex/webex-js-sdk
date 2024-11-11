import {HTTP_METHODS, RequestBody, WebexRequestPayload} from '../../types';
import * as Err from './Err';
import {Msg} from './GlobalTypes';

export type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  alternateBind?: string;
};

export type BindType = string | string[] | {[key: string]: BindType};
interface Bind {
  type: BindType;
  data?: any;
}

export type Timeout = number | 'disabled';

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

export type Conf<TRes, TErr, TReq> = (p: TReq) => Req<TRes, TErr>;
export type ConfEmpty<TRes, TErr> = () => Req<TRes, TErr>;
export type Res<TRes, TReq> = (p: TReq, cbRes?: CbRes<TRes>) => Promise<TRes>;
export type ResEmpty<TRes> = (cbRes?: CbRes<TRes>) => Promise<TRes>;
export type CbRes<TRes> = (res: any) => void | TRes;
