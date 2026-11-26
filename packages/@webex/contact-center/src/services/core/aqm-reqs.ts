import {v4 as uuidv4} from 'uuid';
import type {Msg} from './GlobalTypes';
import * as Err from './Err';
import {HTTP_METHODS} from '../../types';
import type {WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import type {CbRes, Conf, ConfEmpty, Pending, Req, Res, ResEmpty, AqmRequestContext} from './types';
import {TIMEOUT_REQ, METHODS} from './constants';
import {AQM_REQS_FILE} from '../../constants';
import WebexRequest from './WebexRequest';
import type {WebSocketManager} from './websocket/WebSocketManager';
import {
  createRegionRecoveryError,
  isRecord,
  isRegionRecoveryError,
  normalizeRecoveryFailure,
} from './Utils';

export default class AqmReqs {
  private pendingRequests: Record<string, Pending> = {};
  private pendingNotifCancelrequest: Record<string, Pending> = {};
  // Retain recent IDs across registration replacement to recognize late local notifications.
  private readonly trackingIds = new Map<string, {url: string; session: boolean}>();
  private webexRequest: WebexRequest;

  constructor(webSocketManager: WebSocketManager) {
    this.webexRequest = WebexRequest.getInstance();
    webSocketManager.on('message', this.onMessage);
  }

  public isLocalSessionTrackingId(trackingId: string): boolean {
    return this.trackingIds.get(trackingId)?.session === true;
  }

  private rememberTrackingId(id: string, url: string, session: boolean): void {
    this.trackingIds.set(id, {url, session});
    if (this.trackingIds.size > 128) this.trackingIds.delete(this.trackingIds.keys().next().value);
  }

  /**
   * Creates a request function for an API call with parameters
   * @param config - The configuration for the request
   * @returns A function that makes the API request
   */
  req<TRes, TErr, TReq>(config: Conf<TRes, TErr, TReq>): Res<TRes, TReq> {
    return (p: TReq, cbRes?: CbRes<TRes>, context?: AqmRequestContext) =>
      this.createPromise(config(p), cbRes, context);
  }

  /**
   * Creates a request function for an API call with no parameters
   * @param config - The configuration for the request
   * @returns A function that makes the API request
   */
  reqEmpty<TRes, TErr>(config: ConfEmpty<TRes, TErr>): ResEmpty<TRes> {
    return (cbRes?: CbRes<TRes>, context?: AqmRequestContext) =>
      this.createPromise(config(), cbRes, context);
  }

  private async createPromise<TRes, TErr>(
    c: Req<TRes, TErr>,
    cbRes?: CbRes<TRes>,
    context?: AqmRequestContext
  ): Promise<TRes> {
    return new Promise<TRes>((resolve, reject) => {
      const signal = context?.signal;
      if (signal?.aborted) {
        reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));

        return;
      }
      const keySuccess = this.bindPrint(c.notifSuccess.bind);
      const keyFail = c.notifFail && this.bindPrint(c.notifFail.bind);
      const duplicateSuccess = this.pendingRequests[keySuccess];
      const duplicateFail = keyFail && keyFail !== keySuccess && this.pendingRequests[keyFail];
      if ((duplicateSuccess || duplicateFail) && c.timeout !== 'disabled') {
        reject(
          new Err.Details('Service.aqm.reqs.Pending', {
            key: `${duplicateSuccess ? keySuccess : ''}${duplicateFail ? keyFail : ''}`,
            msg: 'The request has been already created, multiple requests are not allowed.',
          })
        );

        return;
      }
      const operationId = uuidv4();
      const session = c.kind === 'session';
      const correlationId = session ? uuidv4() : context?.correlationId;
      const correlate = (bind: any) =>
        context?.requireCorrelation && correlationId
          ? {...bind, data: {...bind.data, trackingId: correlationId}}
          : bind;
      const successBind = correlate(c.notifSuccess.bind);
      const failBind = c.notifFail && correlate(c.notifFail.bind);
      const cancelBind = c.notifCancel?.bind;
      const keyCancel = cancelBind && this.bindPrint(cancelBind);
      let response: WebexRequestPayload | null = null;
      let timeoutId: ReturnType<typeof setTimeout>;
      let settled = false;
      const finish = (result: {value: TRes} | {error: Error}) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        [keySuccess, keyFail].forEach((key) => {
          if (key && this.pendingRequests[key]?.operationId === operationId)
            delete this.pendingRequests[key];
        });
        if (keyCancel && this.pendingNotifCancelrequest[keyCancel]?.operationId === operationId)
          delete this.pendingNotifCancelrequest[keyCancel];
        if ('error' in result) reject(result.error);
        else resolve(result.value);
      };
      const rejectOperation = (error: Error) => finish({error});
      const onAbort = () => {
        rejectOperation(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        AqmReqs.diagnose('info', 'Routing operation aborted');
      };
      const matches = (bind: any, msg: Msg): boolean => {
        const id = msg.data?.trackingId;
        if (id !== correlationId && this.trackingIds.get(id)?.url === c.url) return false;

        return this.bindCheck(bind, msg);
      };
      const success = (msg: Msg) => {
        if (settled) return;
        // Legacy binds also own the server-assigned ID of a matched local station outcome.
        if (session && typeof msg.data?.trackingId === 'string')
          this.rememberTrackingId(msg.data.trackingId, c.url, true);
        finish({value: msg as unknown as TRes});
      };
      this.pendingRequests[keySuccess] = {
        operationId,
        check: (msg) => matches(successBind, msg),
        handle: success,
      };
      if (keyFail) {
        this.pendingRequests[keyFail] = {
          operationId,
          check: (msg) => matches(failBind, msg),
          handle: (msg) => {
            if (settled) return;
            try {
              const failure = c.notifFail!;
              const error =
                'errId' in failure
                  ? new Err.Details(failure.errId, msg as any)
                  : failure.err(msg as any);
              rejectOperation(error);
            } catch (error) {
              rejectOperation(error);
            }
            AqmReqs.diagnose('log', 'Routing notification failed', msg);
          },
        };
      }
      if (keyCancel) {
        this.pendingNotifCancelrequest[keyCancel] = {
          operationId,
          check: (msg) => this.bindCheck(cancelBind, msg),
          handle: success,
        };
      }
      signal?.addEventListener('abort', onAbort, {once: true});
      if (c.timeout !== 'disabled') {
        timeoutId = setTimeout(
          () => {
            if (settled) return;
            const {status, reasonCode, trackingId, id} = normalizeRecoveryFailure(response);
            // Copy selected scalars only; the shared acknowledgement can contain credentials.
            const safeResponse = response
              ? {
                  ...(status !== undefined ? {statusCode: status} : {}),
                  ...(reasonCode !== undefined ? {reasonCode} : {}),
                  ...(trackingId ? {trackingId} : {}),
                  ...(id ? {id} : {}),
                }
              : null;
            rejectOperation(
              new Err.Details('Service.aqm.reqs.Timeout', {
                key: this.bindPrint(successBind),
                response: safeResponse,
              })
            );
            AqmReqs.diagnose('error', 'Routing request timeout', response);
          },
          c.timeout && c.timeout > 0 ? c.timeout : TIMEOUT_REQ
        );
      }
      if (correlationId) this.rememberTrackingId(correlationId, c.url, session);
      const onHttpFailure = (error: WebexRequestPayload) => {
        if (settled) return;
        if (isRegionRecoveryError(error)) {
          rejectOperation(error);

          return;
        }
        try {
          rejectOperation(
            typeof c.err === 'function'
              ? c.err(error)
              : new Err.Message(c.err ?? 'Service.aqm.reqs.GenericRequestError')
          );
        } catch (translated) {
          rejectOperation(translated);
        }
        AqmReqs.diagnose('info', 'Routing HTTP request failed', error);
      };
      try {
        this.webexRequest
          .request({
            service: c.host ?? '',
            resource: c.url,
            method: c.method ?? (c.data ? HTTP_METHODS.POST : HTTP_METHODS.GET),
            body: c.data,
            ...(correlationId ? {headers: {trackingid: `webex-js-sdk_${correlationId}`}} : {}),
          })
          .then((res) => {
            if (settled) return;
            response = res as unknown as WebexRequestPayload;
            try {
              if (cbRes) Promise.resolve(cbRes(res)).then(() => undefined, onHttpFailure);
            } catch (error) {
              onHttpFailure(error);
            }
          }, onHttpFailure);
      } catch (error) {
        onHttpFailure(error);
      }
    });
  }

  /** Diagnostics select scalars only; response/options/headers/body/URL never reach a sink. */
  private static diagnose(
    level: 'info' | 'log' | 'error',
    message: string,
    error?: unknown,
    method = METHODS.CREATE_PROMISE
  ): void {
    const {status, reasonCode, trackingId, id} = normalizeRecoveryFailure(error);
    try {
      LoggerProxy[level](message, {
        module: AQM_REQS_FILE,
        method,
        ...(trackingId ? {trackingId} : {}),
        ...(status !== undefined || reasonCode !== undefined || id
          ? {
              data: {
                ...(status !== undefined ? {status} : {}),
                ...(reasonCode !== undefined ? {reasonCode} : {}),
                ...(id ? {id} : {}),
              },
            }
          : {}),
      });
    } catch {
      /* Logging never owns operation matching or settlement. */
    }
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

    if (typeMap.conditions && Object.prototype.hasOwnProperty.call(typeMap.conditions, msgType)) {
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

  /** Matches notifications independently of diagnostic sink failures. */
  private readonly onMessage = (payload: string): void => {
    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      AqmReqs.diagnose('info', 'Invalid routing notification');

      return;
    }
    if (!isRecord(event) || Array.isArray(event)) return;
    if (event.type === 'Welcome') {
      AqmReqs.diagnose(
        'info',
        'Welcome message from Notifs Websocket',
        undefined,
        METHODS.ON_MESSAGE
      );

      return;
    }
    if (event.keepalive === 'true') return;
    let handled = false;
    for (const key of Object.keys(this.pendingRequests)) {
      const entry = this.pendingRequests[key];
      try {
        if (entry?.check(event as Msg)) {
          entry.handle(event as Msg);
          handled = true;
          break;
        }
      } catch {
        AqmReqs.diagnose('info', 'Routing notification handler failed');
      }
    }
    for (const key of Object.keys(this.pendingNotifCancelrequest)) {
      const entry = this.pendingNotifCancelrequest[key];
      try {
        if (entry?.check(event as Msg)) {
          entry.handle(event as Msg);
          handled = true;
        }
      } catch {
        AqmReqs.diagnose('info', 'Routing cancellation handler failed');
      }
    }
    if (!handled) AqmReqs.diagnose('info', 'Routing notification has no pending handler');
  };
}
