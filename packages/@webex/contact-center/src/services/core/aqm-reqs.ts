import {Msg} from './GlobalTypes';
import * as Err from './Err';
import {HTTP_METHODS, WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {CbRes, Conf, ConfEmpty, Pending, Req, Res, ResEmpty} from './types';
import {TIMEOUT_REQ, METHODS} from './constants';
import {AQM_REQS_FILE} from '../../constants';
import WebexRequest from './WebexRequest';
import {WebSocketManager} from './websocket/WebSocketManager';

export default class AqmReqs {
  private pendingRequests: Record<string, Pending> = {};
  private pendingNotifCancelrequest: Record<string, Pending> = {};
  private webexRequest: WebexRequest;
  private webSocketManager: WebSocketManager;

  constructor(webSocketManager: WebSocketManager) {
    this.webexRequest = WebexRequest.getInstance();
    this.webSocketManager = webSocketManager;
    this.webSocketManager.on('message', this.onMessage.bind(this));
  }

  /**
   * Creates a request function for an API call with parameters
   * @param c - The configuration for the request
   * @returns A function that makes the API request
   */
  req<TRes, TErr, TReq>(c: Conf<TRes, TErr, TReq>): Res<TRes, TReq> {
    return (p: TReq, cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(p), cbRes);
  }

  /**
   * Creates a request function for an API call with no parameters
   * @param c - The configuration for the request
   * @returns A function that makes the API request
   */
  reqEmpty<TRes, TErr>(c: ConfEmpty<TRes, TErr>): ResEmpty<TRes> {
    return (cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(), cbRes);
  }

  /**
   * Makes an API request
   * @param c - The request configuration
   * @param cbRes - The callback for the response
   * @returns A promise that resolves with the response or rejects with an error
   */
  private async makeAPIRequest<TRes, TErr>(c: Req<TRes, TErr>, cbRes?: CbRes<TRes>): Promise<TRes> {
    return this.createPromise(c, cbRes);
  }

  /**
   * Creates a promise for an API request
   * @param c - The request configuration
   * @param cbRes - The callback for the response
   * @returns A promise that resolves with the response or rejects with an error
   */
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
              LoggerProxy.log(`Routing request failed: ${JSON.stringify(msg)}`, {
                module: AQM_REQS_FILE,
                method: METHODS.CREATE_PROMISE,
              });
              const eerr = new Err.Details(notifFail.errId, msg as any);
              LoggerProxy.log(`Routing request failed: ${eerr}`, {
                module: AQM_REQS_FILE,
                method: METHODS.CREATE_PROMISE,
              });
              reject(eerr);
            } else {
              reject(notifFail.err(msg as any));
            }
          },
        };
      }
      let response: WebexRequestPayload | null = null;
      this.webexRequest
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
            LoggerProxy.error(
              `Routing request timeout${keySuccess}${JSON.stringify(response)}${c.url}`,
              {
                module: AQM_REQS_FILE,
                method: METHODS.CREATE_PROMISE,
              }
            );
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

  /**
   * Converts a bind object to a string representation
   * @param bind - The bind object to convert
   * @returns A string representation of the bind object
   */
  private bindPrint(bind: any): string {
    let result = '';
    for (const key of Object.keys(bind).filter((prop) => prop !== '__typeMap')) {
      const value = bind[key];

      if (Array.isArray(value)) {
        result += `${key}=[${value.join(',')}],`;
      } else if (typeof value === 'object' && value !== null) {
        result += `${key}=(${this.bindPrint(value)}),`;
      } else {
        result += `${key}=${value},`;
      }
    }

    return result ? result.slice(0, -1) : result;
  }

  /**
   * Checks if a message matches a bind object
   * @param bind - The bind object to check against
   * @param msg - The message to check
   * @returns True if the message matches the bind object, false otherwise
   */
  private bindCheck(bind: any, msg: any): boolean {
    // Handle type-dependent field matching if __typeMap is present
    if (bind.__typeMap && typeof bind.__typeMap === 'object') {
      if (!AqmReqs.typeMapCheck(bind.__typeMap, msg)) {
        return false;
      }
    }

    for (const key of Object.keys(bind).filter((prop) => prop !== '__typeMap')) {
      const bindValue = bind[key];
      const msgValue = msg[key];

      if (Array.isArray(bindValue)) {
        // Check if the message value matches any of the values in the array
        if (!bindValue.includes(msgValue)) {
          return false;
        }
      } else if (typeof bindValue === 'object' && bindValue !== null) {
        if (typeof msgValue === 'object' && msgValue !== null) {
          if (!this.bindCheck(bindValue, msgValue)) {
            return false;
          }
        } else {
          return false;
        }
      } else if (!msgValue || msgValue !== bindValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks type-dependent field conditions defined in __typeMap.
   * @param typeMap - The type map to check against
   * @param msg - The message to check
   * @returns True if the message matches the type map, false otherwise
   * The typeMap has the shape:
   *   { typeField: "type", conditions: { EventA: { field: value }, EventB: { field: value } } }
   * It reads msg[typeField] to determine which condition set to apply,
   * then verifies all fields in that condition match the message.
   */
  private static typeMapCheck(typeMap: any, msg: any): boolean {
    const typeField = typeMap.typeField || 'type';
    const msgType = msg[typeField];

    if (typeMap.conditions && typeMap.conditions[msgType]) {
      const condition = typeMap.conditions[msgType];
      for (const field of Object.keys(condition)) {
        if (!msg[field] || msg[field] !== condition[field]) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Handles incoming messages from the WebSocket (must be a lambda fn)
   * @param msg - The message to handle
   * @returns
   */
  private readonly onMessage = (msg: any) => {
    const event = JSON.parse(msg);
    if (event.type === 'Welcome') {
      LoggerProxy.info(`Welcome message from Notifs Websocket`, {
        module: AQM_REQS_FILE,
        method: METHODS.ON_MESSAGE,
      });

      return;
    }

    if (event.keepalive === 'true') {
      return;
    }

    if (event.type === 'AgentReloginFailed') {
      LoggerProxy.info('Silently handling the agent relogin fail', {
        module: AQM_REQS_FILE,
        method: METHODS.ON_MESSAGE,
      });
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
      LoggerProxy.info(`event=missingEventHandler | [AqmReqs] missing routing message handler`, {
        module: AQM_REQS_FILE,
        method: METHODS.ON_MESSAGE,
      });
    }
  };
}
