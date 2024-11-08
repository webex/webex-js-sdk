/* eslint-disable @typescript-eslint/no-explicit-any */
import {Signal} from './Signal';
import {Msg} from './GlobalTypes';
import * as Err from './Err';
import {HTTP_METHODS, WebexRequestPayload} from '../../types';
import HttpRequest from './HttpRequest';
import LoggerProxy from '../../logger-proxy';

export const TIMEOUT_REQ = 20000;
const TIMEOUT_EVT = TIMEOUT_REQ;
const FC_DESKTOP_VIEW = 'FC-DESKTOP-VIEW';
const fcDesktopView = 'fcDesktopView';

export class AqmReqs {
  private pendingRequests: Record<string, Pending> = {};
  private pendingEvents: Record<string, Pending> = {};
  // pendingNotifCancelrequest is used for handling request cancel events based on another action. When a promise can be resolved using multiple events.
  // example consult and cancelCtq(end in new API)  when we cancel consult to ques we need to resolve both consul and cancel ctq promises
  // #CX-14258 : Consult to DN failing if Consult to Queue is cancelled in the first try #2344
  private pendingNotifCancelrequest: Record<string, Pending> = {};
  private httpRequest: HttpRequest;
  constructor() {
    this.httpRequest = HttpRequest.getInstance();
    this.httpRequest.getWebSocket().on('event', (eventData) => {
      LoggerProxy.logger.log(`Received event: ${eventData.type}`);
      this.onMessage(eventData);
    });
  }

  req<TRes, TErr, TReq>(c: Conf<TRes, TErr, TReq>): Res<TRes, TReq> {
    return (p: TReq, cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(p), cbRes);
  }

  reqEmpty<TRes, TErr>(c: ConfEmpty<TRes, TErr>): ResEmpty<TRes> {
    return (cbRes?: CbRes<TRes>) => this.makeAPIRequest(c(), cbRes);
  }

  evt<T>(p: EvtConf<T>): EvtRes<T> {
    const {send, signal} = Signal.create.withData<T>();

    const k = this.bindPrint(p.bind);
    if (this.pendingEvents[k]) {
      throw new Err.Details('Service.aqm.reqs.PendingEvent', {key: k});
    }
    this.pendingEvents[k] = {
      check: (msg: Msg) => this.bindCheck(p.bind, msg),
      handle: (msg: any) => send(msg),
    };

    // add listenOnceAsync
    const evt: EvtRes<T> = signal as any;
    evt.listenOnceAsync = (promise?: {resolveIf?: (msg: T) => boolean; timeout?: Timeout}) => {
      return new Promise<T>((resolve, reject) => {
        const {stopListen} = signal.listen((msg) => {
          if (promise?.resolveIf ? promise.resolveIf(msg) : true) {
            stopListen();
            resolve(msg);
          }
        });

        if (promise?.timeout === 'disabled') {
          return;
        }

        const ms =
          promise && promise.timeout && promise.timeout > 0 ? promise.timeout : TIMEOUT_EVT;
        setTimeout(() => {
          const isStopped = stopListen();
          if (isStopped) {
            reject(new Err.Details('Service.aqm.reqs.TimeoutEvent', {key: k}));
          }
        }, ms);
      });
    };

    return evt;
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
      let resAxios: WebexRequestPayload | null = null;
      this.httpRequest
        .request({
          service: c.host ?? '',
          resource: c.url,
          // eslint-disable-next-line no-nested-ternary
          method: c.method ? c.method : c.data ? HTTP_METHODS.POST : HTTP_METHODS.GET,

          body: c.data,
        })
        .then((res: any) => {
          resAxios = res;
          if (cbRes) {
            cbRes(res);
          }
        })
        .catch((axiosErr: WebexRequestPayload) => {
          clear();
          if (axiosErr?.headers) {
            axiosErr.headers.Authorization = '*';
          }
          if (axiosErr?.headers) {
            axiosErr.headers.Authorization = '*';
          }
          if (typeof c.err === 'function') {
            reject(c.err(axiosErr));
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
            if (resAxios?.headers) {
              resAxios.headers.Authorization = '*';
            }
            LoggerProxy.logger.error(`Routing request timeout${keySuccess}${resAxios!}${c.url}`);
            reject(
              new Err.Details('Service.aqm.reqs.Timeout', {
                key: keySuccess,
                resAxios: resAxios!,
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

  private readonly identifyInteractionIsTaskObject = (event: any) => {
    // This method will return the callProcessingDetails are present inside the interaction object or task object
    return event?.data?.task?.callProcessingDetails ?? false;
  };

  private isFlowValuesEncrypted(event: any) {
    let fcDesktopView1: any;
    if (this.identifyInteractionIsTaskObject(event)) {
      fcDesktopView1 = event?.data?.task?.callAssociatedData[FC_DESKTOP_VIEW]?.value;
    } else {
      fcDesktopView1 = event?.data?.interaction?.callAssociatedData[FC_DESKTOP_VIEW]?.value;
    }

    return fcDesktopView1?.includes('pop-over') || fcDesktopView1?.includes('interaction-panel');
  }

  private isValidCADFlowValue(event: any) {
    // event?.data?.interaction:  CAD, CPD values are under the event?.data?.interaction for call events
    // event?.data?.task :CAD, CPD values are under the event?.data?.task for monitoring call events
    if (this.identifyInteractionIsTaskObject(event)) {
      return (
        (event?.data?.task?.callAssociatedData[FC_DESKTOP_VIEW]?.value &&
          event?.data?.task?.callAssociatedData[FC_DESKTOP_VIEW]?.value !== '') ??
        false
      );
    }
    // Interaction details are present like event?.data?.interaction

    return (
      (event?.data?.interaction?.callAssociatedData[FC_DESKTOP_VIEW]?.value &&
        event?.data?.interaction?.callAssociatedData[FC_DESKTOP_VIEW]?.value !== '') ??
      false
    );
  }

  private isValidCPDFlowValue(event: any) {
    const isDesktopCpdViewEnabled = false; // TODO: revisit this to get the feature flag value if needed by desktop client
    // event?.data?.interaction:  CAD, CPD values are under the event?.data?.interaction for call events
    // event?.data?.task :CAD, CPD values are under the event?.data?.task for monitoring call events
    // SERVICE.featureflag.isDesktopCpdViewEnabled()
    if (isDesktopCpdViewEnabled) {
      if (this.identifyInteractionIsTaskObject(event)) {
        return (
          event?.data?.task?.callProcessingDetails[fcDesktopView] &&
          event?.data?.task?.callProcessingDetails[fcDesktopView] !== ''
        );
      }

      return (
        event?.data?.interaction?.callProcessingDetails[fcDesktopView] &&
        event?.data?.interaction?.callProcessingDetails[fcDesktopView] !== ''
      );
    }

    return false;
  }

  private getDecompressedValue(encryptedValue: Buffer) {
    return encryptedValue;
    // TODO: Revisit this to get the decompressSync method from the compression library if needed by desktop client
    // const decryptedValue: Uint8Array = decompressSync(encryptedValue);
    // return strFromU8(decryptedValue);
  }

  // must be lambda
  private readonly onMessage = (event: any) => {
    // const event = JSON.parse(msg);
    if (event.type === 'Welcome') {
      LoggerProxy.logger.info(`Welcome message from Notifs Websocket${event}`);

      return;
    }

    if (event.keepalive) {
      LoggerProxy.logger.info(`Keepalive from notifs${event}`);

      return;
    }

    if (this.isValidCADFlowValue(event) && !this.isFlowValuesEncrypted(event)) {
      const isTaskObject = this.identifyInteractionIsTaskObject(event);
      try {
        const targetObject = isTaskObject ? event?.data?.task : event?.data?.interaction;
        const encryptedFcValue = targetObject?.callAssociatedData[FC_DESKTOP_VIEW]?.value;
        const encryptedValue = Buffer.from(encryptedFcValue, 'base64');
        // Update the decrypted value to same object
        targetObject.callAssociatedData[FC_DESKTOP_VIEW].value =
          this.getDecompressedValue(encryptedValue);

        const interactionId = targetObject?.interactionId;
        LoggerProxy.logger.info(
          `${FC_DESKTOP_VIEW} values decrypted successfully for Interaction ID: ${
            interactionId || ''
          }`
        );
      } catch {
        const targetObject = isTaskObject ? event?.data?.task : event?.data?.interaction;
        const interactionId = targetObject?.interactionId;
        const fcValue = targetObject?.callAssociatedData[FC_DESKTOP_VIEW]?.value || '';

        LoggerProxy.logger.error(
          `Error on decrypting ${FC_DESKTOP_VIEW} value for Interaction Id: ${interactionId}${fcValue}` ||
            ''
        );
      }
    } else if (this.isValidCPDFlowValue(event)) {
      const isTaskObject = this.identifyInteractionIsTaskObject(event);
      try {
        // When WXCC_DESKTOP_VIEW_IN_CPD FF is enabled, then values will be fcDesktopView values are always compressed.
        const targetObject = isTaskObject ? event?.data?.task : event?.data?.interaction;
        const encryptedFcValue = targetObject?.callProcessingDetails[fcDesktopView];
        const encryptedValue = Buffer.from(encryptedFcValue, 'base64');

        // Update the decrypted value to same object
        targetObject.callProcessingDetails[fcDesktopView] =
          this.getDecompressedValue(encryptedValue);

        const interactionId = targetObject?.interactionId;
        LoggerProxy.logger.info(
          `${fcDesktopView} values decrypted successfully for Interaction ID: ${
            interactionId || ''
          }`
        );
      } catch {
        const targetObject = isTaskObject ? event?.data?.task : event?.data?.interaction;
        const interactionId = targetObject?.interactionId;
        const fcValue = targetObject?.callProcessingDetails[fcDesktopView] || '';

        LoggerProxy.logger.error(
          `Error on decrypting ${fcDesktopView} value for Interaction Id: ${
            interactionId || ''
          }${fcValue}` || ''
        );
      }
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

    const kEvt = Object.keys(this.pendingEvents);
    for (const thisEvt of kEvt) {
      const evt = this.pendingEvents[thisEvt];
      if (evt.check(event)) {
        evt.handle(event);
        isHandled = true;
        break;
      }
    }

    if (!isHandled) {
      LoggerProxy.logger.info(
        `event=missingEventHandler | [AqmReqs] missing routing message handler${event}`
      );
    }
  };
}

type Pending = {
  check: (msg: Msg) => boolean;
  handle: (msg: Msg) => void;
  alternateBind?: string;
};

type BindType = string | string[] | {[key: string]: BindType};
interface Bind {
  type: BindType;
  data?: any;
}

type Req<TRes, TErr> = {
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
  data?: any;
  headers?: Record<string, string>;
  timeout?: Timeout;
  notifCancel?: {bind: Bind; msg: TRes};
};

type Timeout = number | 'disabled';

type Conf<TRes, TErr, TReq> = (p: TReq) => Req<TRes, TErr>;
type ConfEmpty<TRes, TErr> = () => Req<TRes, TErr>;
export type Res<TRes, TReq> = (p: TReq, cbRes?: CbRes<TRes>) => Promise<TRes>;
export type ResEmpty<TRes> = (cbRes?: CbRes<TRes>) => Promise<TRes>;
type CbRes<TRes> = (res: any) => void | TRes;

// evt
type EvtConf<T> = {bind: Bind; msg: T};
type EvtRes<T> = Signal.WithData<T> & {
  listenOnceAsync: (p?: {resolveIf?: (msg: T) => boolean; timeout?: Timeout}) => Promise<T>;
};
