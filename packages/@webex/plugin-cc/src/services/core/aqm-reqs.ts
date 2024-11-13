import {Msg} from './GlobalTypes';
import * as Err from './Err';
import {HTTP_METHODS, WebexRequestPayload} from '../../types';
import {WebSocketManager} from './WebSocket/WebSocketManager';
import HttpRequest from './HttpRequest';
import LoggerProxy from '../../logger-proxy';
import {CbRes, Conf, ConfEmpty, Pending, Req, Res, ResEmpty} from './types';
import {TIMEOUT_REQ} from './constants';

export default class AqmReqs {
  private pendingRequests: Record<string, Pending> = {};
  private pendingNotifCancelrequest: Record<string, Pending> = {};
  private webSocketManager: WebSocketManager;
  private httpRequest: HttpRequest;

  constructor(webSocketManager: WebSocketManager) {
    this.httpRequest = HttpRequest.getInstance();
    this.webSocketManager = webSocketManager;
    this.webSocketManager.addEventListener('message', this.onMessage);
  }

  req<TRes, TErr, TReq>(c: Conf<TRes, TErr, TReq>): Res<TRes, TReq> {
    return (p: TReq, cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(p), cbRes);
  }

  reqEmpty<TRes, TErr>(c: ConfEmpty<TRes, TErr>): ResEmpty<TRes> {
    return (cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(), cbRes);
  }

  private async makeAPIRequest<TRes, TErr>(c: Req<TRes, TErr>, cbRes?: CbRes<TRes>): Promise<TRes> {
    return this.createPromise(c, cbRes);
  }

  private createPromise<TRes, TErr>(c: Req<TRes, TErr>, cbRes?: CbRes<TRes>) {
    return new Promise<TRes>((resolve, reject) => {
      const keySuccess = this.bindPrint(c.notifSuccess.bind);
      const keyFail = c.notifFail ? this.bindPrint(c.notifFail.bind) : null;
      const keyCancel = c.notifCancel?.bind ? this.bindPrint(c.notifCancel.bind) : null;
      let k = '';
      if (this.pendingRequests[keySuccess]) {
        k = keySuccess;
      }
      if (keyFail && this.pendingRequests[keyFail]) {
        k += keyFail;
      }
      if (k && c.timeout !== 'disabled') {
        reject(
          new Err.Details('Service.aqm.reqs.Pending', {
            key: k,
            msg: 'The request has been already created, multiple requests are not allowed.',
          })
        );

        return;
      }

      let isClear = false;
      const clear = () => {
        delete this.pendingRequests[keySuccess];
        if (keyFail) {
          delete this.pendingRequests[keyFail];
        }
        if (keyCancel) {
          delete this.pendingNotifCancelrequest[keyCancel];
        }
        isClear = true;
      };

      this.pendingRequests[keySuccess] = {
        check: (msg: Msg) => this.bindCheck(c.notifSuccess.bind, msg),
        handle: (msg: Msg) => {
          clear();
          resolve(msg as any);
        },
      };
      if (keyCancel) {
        this.pendingRequests[keySuccess].alternateBind = keyCancel;
        this.pendingNotifCancelrequest[keyCancel] = {
          check: (msg: Msg) => this.bindCheck(c.notifCancel?.bind, msg),
          handle: (msg: Msg) => {
            const alternateBindKey = this.pendingNotifCancelrequest[keyCancel].alternateBind;
            if (alternateBindKey) {
              this.pendingRequests[alternateBindKey].handle(msg);
            }
          },
          alternateBind: keySuccess,
        };
      }

      if (keyFail) {
        this.pendingRequests[keyFail] = {
          check: (msg: Msg) => this.bindCheck(c.notifFail!.bind, msg),
          handle: (msg: Msg) => {
            clear();
            const notifFail = c.notifFail!;
            if ('errId' in notifFail) {
              LoggerProxy.logger.log(`Routing request failed: ${msg}`);
              const eerr = new Err.Details(notifFail.errId, msg as any);
              LoggerProxy.logger.log(`Routing request failed: ${eerr}`);
              reject(eerr);
            } else {
              reject(notifFail.err(msg as any));
            }
          },
        };
      }
      let response: WebexRequestPayload | null = null;
      this.httpRequest
        .request({
          service: c.host ?? '',
          resource: c.url,
          // eslint-disable-next-line no-nested-ternary
          method: c.method ? c.method : c.data ? HTTP_METHODS.POST : HTTP_METHODS.GET,

          body: c.data,
        })
        .then((res: any) => {
          response = res;
          if (cbRes) {
            cbRes(res);
          }
        })
        .catch((error: WebexRequestPayload) => {
          clear();
          if (error?.headers) {
            error.headers.Authorization = '*';
          }
          if (error?.headers) {
            error.headers.Authorization = '*';
          }
          if (typeof c.err === 'function') {
            reject(c.err(error));
          } else if (typeof c.err === 'string') {
            reject(new Err.Message(c.err));
          } else {
            reject(new Err.Message('Service.aqm.reqs.GenericRequestError'));
          }
        });

      if (c.timeout !== 'disabled') {
        window.setTimeout(
          () => {
            if (isClear) {
              return;
            }
            clear();
            if (response?.headers) {
              response.headers.Authorization = '*';
            }
            LoggerProxy.logger.error(`Routing request timeout${keySuccess}${response!}${c.url}`);
            reject(
              new Err.Details('Service.aqm.reqs.Timeout', {
                key: keySuccess,
                response: response!,
              })
            );
          },
          c.timeout && c.timeout > 0 ? c.timeout : TIMEOUT_REQ
        );
      }
    });
  }

  private bindPrint(bind: any) {
    let result = '';
    // eslint-disable-next-line no-restricted-syntax
    for (const k in bind) {
      if (Array.isArray(bind[k])) {
        result += `${k}=[${bind[k].join(',')}],`;
      } else if (typeof bind[k] === 'object' && bind[k] !== null) {
        result += `${k}=(${this.bindPrint(bind[k])}),`;
      } else {
        result += `${k}=${bind[k]},`;
      }
    }

    return result ? result.slice(0, -1) : result;
  }

  private bindCheck(bind: any, msg: any) {
    // eslint-disable-next-line no-restricted-syntax
    for (const k in bind) {
      if (Array.isArray(bind[k])) {
        // Check if the message value matches any of the values in the array
        if (!bind[k].includes(msg[k])) {
          return false;
        }
      } else if (typeof bind[k] === 'object' && bind[k] !== null) {
        if (typeof msg[k] === 'object' && msg[k] !== null) {
          if (!this.bindCheck(bind[k], msg[k])) {
            return false;
          }
        } else {
          return false;
        }
      } else if (!msg[k] || msg[k] !== bind[k]) {
        return false;
      }
    }

    return true;
  }

  // must be lambda
  private readonly onMessage = (msg: any) => {
    const event = JSON.parse(msg.detail);
    if (event.type === 'Welcome') {
      LoggerProxy.logger.info(`Welcome message from Notifs Websocket`);

      return;
    }

    if (event.keepalive === 'true') {
      LoggerProxy.logger.info(`Keepalive from web socket`);

      return;
    }

    let isHandled = false;

    const kReq = Object.keys(this.pendingRequests);
    for (const thisReq of kReq) {
      const req = this.pendingRequests[thisReq];
      if (req.check(event)) {
        req.handle(event);
        isHandled = true;
        break;
      }
    }
    // pendingNotifCancelrequest stores the secondary bind key, checks for the secondary bind key and handles the event
    const kReqAlt = Object.keys(this.pendingNotifCancelrequest);
    for (const thisReq of kReqAlt) {
      const req = this.pendingNotifCancelrequest[thisReq];
      if (req.check(event)) {
        req.handle(event);
        isHandled = true;
      }
    }

    // TODO:  add event emitter for unhandled events to replicate event.listen or .on

    if (!isHandled) {
      LoggerProxy.logger.info(
        `event=missingEventHandler | [AqmReqs] missing routing message handler`
      );
    }
  };
}
