import {v4 as uuidv4} from 'uuid';
import type {Msg} from './GlobalTypes';
import * as Err from './Err';
import {HTTP_METHODS} from '../../types';
import type {WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import type {
  CbRes,
  Conf,
  ConfEmpty,
  Pending,
  Req,
  Res,
  ResEmpty,
  OperationRecord,
  AqmRequestContext,
  AqmRecoveryGate,
} from './types';
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
  private readonly operations = new Map<string, OperationRecord>();
  // Retain recent IDs across registration replacement to recognize late local notifications.
  private readonly trackingIds = new Map<string, {url: string; session: boolean}>();
  private generation = 0;
  private recoveryGate: AqmRecoveryGate = {state: 'open'};
  private webexRequest: WebexRequest;
  private readonly primary: WebSocketManager;

  constructor(webSocketManager: WebSocketManager) {
    this.webexRequest = WebexRequest.getInstance();
    this.primary = webSocketManager;
    webSocketManager.on('message', this.onMessage);
  }

  public beginGeneration(generation: number): void {
    this.generation = generation;
  }

  public setRecoveryGate(gate: AqmRecoveryGate): void {
    this.recoveryGate = gate;
  }

  public interruptPending(createError: () => Error): void {
    [...this.operations.values()].forEach((record) => {
      try {
        record.reject(createError());
      } catch {
        record.reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      }
    });
    AqmReqs.diagnose('info', 'Routing operations interrupted');
  }

  public isLocalSessionTrackingId(trackingId: string): boolean {
    return this.trackingIds.get(trackingId)?.session === true;
  }

  private rememberTrackingId(id: string, url: string, session: boolean): void {
    this.trackingIds.set(id, {url, session});
    if (this.trackingIds.size > 128) this.trackingIds.delete(this.trackingIds.keys().next().value);
  }

  req<TRes, TErr, TReq>(config: Conf<TRes, TErr, TReq>): Res<TRes, TReq> {
    return (p: TReq, cbRes?: CbRes<TRes>, context?: AqmRequestContext) => {
      const request = config(p);

      return this.makeAPIRequest(
        {...request, context: context ?? request.context ?? {generation: this.generation}},
        cbRes
      );
    };
  }

  reqEmpty<TRes, TErr>(config: ConfEmpty<TRes, TErr>): ResEmpty<TRes> {
    return (cbRes?: CbRes<TRes>, context?: AqmRequestContext) => {
      const request = config();

      return this.makeAPIRequest(
        {...request, context: context ?? request.context ?? {generation: this.generation}},
        cbRes
      );
    };
  }

  private async makeAPIRequest<TRes, TErr>(c: Req<TRes, TErr>, cbRes?: CbRes<TRes>): Promise<TRes> {
    return this.createPromise(c, cbRes);
  }

  private assertAdmission<TRes, TErr>(c: Req<TRes, TErr>, context: AqmRequestContext): void {
    if (context.generation !== this.generation || context.signal?.aborted) {
      throw createRegionRecoveryError('RECOVERY_INTERRUPTED');
    }
    const kind = c.kind ?? 'command';
    const gate = this.recoveryGate;
    if (gate.state === 'open' || kind === 'query') return;
    if (kind === 'teardown') {
      if (!this.hasUsablePrimary()) throw createRegionRecoveryError('RECOVERY_INTERRUPTED');

      return;
    }
    if (gate.state === 'unavailable') throw createRegionRecoveryError(gate.reason);
    if (kind === 'session') {
      const owner = gate.sessionOwner;
      const phase = gate.state === 'recovering' ? 'restore' : 'manual';
      if (
        owner &&
        owner === context.sessionOwner &&
        owner.generation === this.generation &&
        owner.phase === phase &&
        !owner.signal.aborted &&
        context.signal === owner.signal
      )
        return;
    }
    throw createRegionRecoveryError('RECOVERY_IN_PROGRESS');
  }

  private hasUsablePrimary(): boolean {
    return this.primary.hasUsableSocket();
  }

  private createPromise<TRes, TErr>(c: Req<TRes, TErr>, cbRes?: CbRes<TRes>): Promise<TRes> {
    return new Promise<TRes>((resolve, reject) => {
      const context = c.context ?? {generation: this.generation};
      this.assertAdmission(c, context);
      const logicalSuccess = this.bindPrint(c.notifSuccess.bind);
      const logicalFail = c.notifFail ? this.bindPrint(c.notifFail.bind) : undefined;
      const duplicates = Object.values(this.pendingRequests).filter(
        (entry) =>
          entry.logicalBindKey === logicalSuccess ||
          (logicalFail && entry.logicalBindKey === logicalFail)
      );
      if (duplicates.length && c.timeout !== 'disabled') {
        reject(
          new Err.Details('Service.aqm.reqs.Pending', {
            key: [...new Set(duplicates.map((entry) => entry.logicalBindKey))].join(''),
            msg: 'The request has been already created, multiple requests are not allowed.',
          })
        );

        return;
      }
      const operationId = uuidv4();
      const session = c.kind === 'session';
      const correlationId = session ? uuidv4() : context.correlationId;
      const strict = context.requireCorrelation || !!context.sessionOwner;
      const correlate = (bind: any) =>
        strict && correlationId ? {...bind, data: {...bind.data, trackingId: correlationId}} : bind;
      const successBind = correlate(c.notifSuccess.bind);
      const failBind = c.notifFail && correlate(c.notifFail.bind);
      const cancelBind = c.notifCancel?.bind;
      const keySuccess = this.bindPrint(successBind);
      const keyFail = failBind && this.bindPrint(failBind);
      const keyCancel = cancelBind && this.bindPrint(cancelBind);
      let response: WebexRequestPayload | null = null;
      const cleanup = () => {
        this.operations.delete(operationId);
        clearTimeout(record.timeoutId);
        context.signal?.removeEventListener('abort', onAbort);
        [keySuccess, keyFail].forEach((key) => {
          if (key && this.pendingRequests[key]?.operationId === operationId)
            delete this.pendingRequests[key];
        });
        if (keyCancel && this.pendingNotifCancelrequest[keyCancel]?.operationId === operationId)
          delete this.pendingNotifCancelrequest[keyCancel];
      };
      const finish = (result: {value: TRes} | {error: Error}) => {
        if (record.settled) return;
        record.settled = true;
        record.cleanup();
        if ('error' in result) reject(result.error);
        else resolve(result.value);
      };
      const onAbort = () => {
        const operation = this.operations.get(operationId);
        operation?.reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        if (operation) AqmReqs.diagnose('info', 'Routing operation aborted');
      };
      const record: OperationRecord = {
        operationId,
        generation: context.generation,
        settled: false,
        cleanup,
        reject: (error) => finish({error}),
      };
      this.operations.set(operationId, record);
      const current = () => {
        if (record.settled) return false;
        if (record.generation !== this.generation || context.signal?.aborted) {
          record.reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));

          return false;
        }

        return true;
      };
      const matches = (bind: any, msg: Msg): boolean => {
        const id = msg.data?.trackingId;
        if (id !== correlationId && this.trackingIds.get(id)?.url === c.url) return false;

        return this.bindCheck(bind, msg);
      };
      const success = (msg: Msg) => {
        if (!current()) return;
        // Legacy binds also own the server-assigned ID of a matched local station outcome.
        if (session && typeof msg.data?.trackingId === 'string')
          this.rememberTrackingId(msg.data.trackingId, c.url, true);
        finish({value: msg as unknown as TRes});
      };
      this.pendingRequests[keySuccess] = {
        operationId,
        logicalBindKey: logicalSuccess,
        check: (msg) => matches(successBind, msg),
        handle: success,
        ...(keyCancel ? {alternateBind: keyCancel} : {}),
      };
      if (keyFail) {
        this.pendingRequests[keyFail] = {
          operationId,
          logicalBindKey: logicalFail,
          check: (msg) => matches(failBind, msg),
          handle: (msg) => {
            if (!current()) return;
            try {
              const failure = c.notifFail!;
              const error =
                'errId' in failure
                  ? new Err.Details(failure.errId, msg as any)
                  : failure.err(msg as any);
              record.reject(error);
            } catch (error) {
              record.reject(error);
            }
            AqmReqs.diagnose('log', 'Routing notification failed', msg);
          },
        };
      }
      if (keyCancel) {
        this.pendingNotifCancelrequest[keyCancel] = {
          operationId,
          logicalBindKey: this.bindPrint(cancelBind),
          alternateBind: keySuccess,
          check: (msg) => this.bindCheck(cancelBind, msg),
          handle: success,
        };
      }
      context.signal?.addEventListener('abort', onAbort, {once: true});
      if (!current()) return;
      if (c.timeout !== 'disabled') {
        record.timeoutId = setTimeout(
          () => {
            if (!current()) return;
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
            record.reject(
              new Err.Details('Service.aqm.reqs.Timeout', {key: keySuccess, response: safeResponse})
            );
            AqmReqs.diagnose('error', 'Routing request timeout', response);
          },
          c.timeout && c.timeout > 0 ? c.timeout : TIMEOUT_REQ
        );
      }
      if (correlationId) this.rememberTrackingId(correlationId, c.url, session);
      const onHttpFailure = (error: WebexRequestPayload) => {
        if (!current()) return;
        if (isRegionRecoveryError(error)) {
          record.reject(error);

          return;
        }
        try {
          record.reject(
            typeof c.err === 'function'
              ? c.err(error)
              : new Err.Message(c.err ?? 'Service.aqm.reqs.GenericRequestError')
          );
        } catch (translated) {
          record.reject(translated);
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
            ...(c.headers || correlationId
              ? {
                  headers: {
                    ...c.headers,
                    ...(correlationId ? {trackingid: `webex-js-sdk_${correlationId}`} : {}),
                  },
                }
              : {}),
          })
          .then((res) => {
            if (!current()) return;
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
