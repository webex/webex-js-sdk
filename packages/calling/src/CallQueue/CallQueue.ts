import SDKConnector from '../SDKConnector';
import {WebexSDK} from '../SDKConnector/types';
import {CALLING_BACKEND, HTTP_METHODS, WebexRequestPayload} from '../common/types';
import log from '../Logger';
import {getCallingBackEnd, serviceErrorCodeHandler, uploadLogs} from '../common/Utils';
import {
  FAILURE_MESSAGE,
  METHOD_START_MESSAGE,
  STATUS_CODE,
  SUCCESS_MESSAGE,
  WEBEX_API_BTS,
  WEBEX_API_FEDRAMP,
  WEBEX_API_PROD,
} from '../common/constants';
import {Eventing} from '../Events/impl';
import {COMMON_EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';
import {
  CALL_QUEUE_FILE,
  LINE_OWNER_ID_PATTERN,
  METHODS,
  MAX_QUEUE_CATALOG_PAGES,
  QUEUES_CATALOG_PATH,
  QUEUES_PATH,
  SECONDARY_LINES_PATH,
  SYNC_PATH,
  UNSUPPORTED_BACKEND_MESSAGE,
} from './constants';
import actorIdentity, {
  applyCallQueueEvent,
  applyQueueNames,
  normalizeAcdState,
  parseCallQueueCatalog,
  parseCallQueueSettings,
  publicApiId,
  queueIdKey,
  unwrapAgentPayload,
  hasReadyEntitlementModels,
} from './utils';
import {
  ACD_STATE,
  CallQueueAgentStatus,
  CallQueueClientOptions,
  CallQueueEventKind,
  CallQueueEventTypes,
  CallQueueResponse,
  EventLine,
  ICallQueue,
  LoggerInterface,
  UpdateCallQueueSettingsRequest,
} from './types';

const SUPPORTED_STATES = new Set<string>(Object.values(ACD_STATE));

/**
 * Webex Calling cloud client for call-queue agent status.
 *
 * Reads and updates `GET/PUT /v1/telephony/config/people/me/settings/queues`,
 * asks CXAPI to sync with `POST /v1/telephony/calls/sync/invoke`, and keeps the
 * local status current from Mercury `telephony_agents` events.
 *
 * @example
 * ```javascript
 * const callQueue = createCallQueueClient(webex, logger, {
 *   webexApiBaseUrl: 'https://webexapis.com',
 * });
 * const status = await callQueue.getCallQueueSettings();
 * ```
 */
export class CallQueueClient extends Eventing<CallQueueEventTypes> implements ICallQueue {
  private webex: WebexSDK;

  private callingBackend: CALLING_BACKEND;

  private readonly webexApiEndpoint?: string;

  private currentByLine = new Map<string | undefined, CallQueueAgentStatus>();

  private queueNames = new Map<string, string>();

  private eventGeneration = new Map<string | undefined, number>();

  private requestSequence = 0;

  private committedSequence = new Map<string | undefined, number>();

  private pendingEventRefresh = new Map<string | undefined, Promise<void>>();

  private mercuryListeners: Array<{event: string; listener: (data?: unknown) => void}> = [];

  private disposed = false;

  private lifecycleEpoch = 0;

  constructor(webex: WebexSDK, logger: LoggerInterface, options: CallQueueClientOptions) {
    super();
    if (!SDKConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    if (SDKConnector.getWebex() !== webex) {
      throw new Error('Call queue Webex instance must match the SDKConnector instance');
    }
    this.webex = SDKConnector.getWebex();
    const apiBaseUrl = options?.webexApiBaseUrl;
    const allowedOrigins = [WEBEX_API_BTS, WEBEX_API_PROD, WEBEX_API_FEDRAMP];
    const normalized = typeof apiBaseUrl === 'string' ? apiBaseUrl.replace(/\/$/, '') : '';
    this.webexApiEndpoint = allowedOrigins.includes(normalized) ? `${normalized}/v1` : undefined;
    this.callingBackend = hasReadyEntitlementModels(this.webex)
      ? getCallingBackEnd(this.webex)
      : CALLING_BACKEND.INVALID;
    log.setLogger(logger.level, CALL_QUEUE_FILE);
    this.registerAgentListeners();
  }

  /**
   * Reads the signed-in agent's ACD state and queue join list.
   * Pass `lineOwnerId` to read a secondary line.
   * Queue display names are filled from the queue catalog when settings omit them.
   *
   * @param lineOwnerId - Optional secondary line owner ID; omit for the primary line.
   * @returns The current call queue settings or an error response.
   * @example
   * ```js
   * const result = await callQueue.getCallQueueSettings();
   * ```
   * @public
   */
  public async getCallQueueSettings(lineOwnerId?: string): Promise<CallQueueResponse> {
    const loggerContext = {file: CALL_QUEUE_FILE, method: METHODS.GET_CALL_QUEUE_SETTINGS};
    log.info(METHOD_START_MESSAGE, loggerContext);
    const rejected = this.rejectBeforeRequest(lineOwnerId);
    if (rejected) {
      return rejected;
    }

    const epoch = this.lifecycleEpoch;
    const generation = this.eventGeneration.get(lineOwnerId) ?? 0;
    this.requestSequence += 1;
    const sequence = this.requestSequence;
    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.GET,
      });
      if (epoch !== this.lifecycleEpoch) {
        return {
          statusCode: 409,
          data: {error: 'Call queue client was reinitialized; refresh settings'},
          message: FAILURE_MESSAGE,
        };
      }
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      const parsed = parseCallQueueSettings(response.body, this.currentByLine.get(lineOwnerId));
      const named = parsed ? await this.fillQueueNames(parsed) : undefined;
      if (epoch !== this.lifecycleEpoch) {
        return {
          statusCode: 409,
          data: {error: 'Call queue client was reinitialized; refresh settings'},
          message: FAILURE_MESSAGE,
        };
      }
      if (
        (this.eventGeneration.get(lineOwnerId) ?? 0) !== generation ||
        (this.committedSequence.get(lineOwnerId) ?? 0) > sequence
      ) {
        await this.waitForEventRefreshes(lineOwnerId);
        if (epoch !== this.lifecycleEpoch) {
          return {
            statusCode: 409,
            data: {error: 'Call queue client was reinitialized; refresh settings'},
            message: FAILURE_MESSAGE,
          };
        }
        const latest = this.currentByLine.get(lineOwnerId);

        return latest
          ? {
              statusCode: Number(response[STATUS_CODE]) || 200,
              data: {callQueue: latest},
              message: SUCCESS_MESSAGE,
            }
          : {
              statusCode: 409,
              data: {error: 'Call queue settings changed while loading; retry the request'},
              message: FAILURE_MESSAGE,
            };
      }
      if (!named) {
        return {
          statusCode: 502,
          data: {error: 'Call queue settings response did not include agent status'},
          message: FAILURE_MESSAGE,
        };
      }
      this.currentByLine.set(lineOwnerId, named);
      this.committedSequence.set(lineOwnerId, sequence);
      const current = this.currentByLine.get(lineOwnerId);
      log.log(
        `Call queue settings loaded, state=${current?.acdState ?? 'unknown'}, queues=${
          current?.queues.length ?? 0
        }`,
        loggerContext
      );

      return {
        statusCode: Number(response[STATUS_CODE]) || 200,
        data: {callQueue: named},
        message: SUCCESS_MESSAGE,
      };
    } catch (err: unknown) {
      const failure =
        epoch === this.lifecycleEpoch
          ? await this.fail(err, loggerContext, 'Failed to get call queue settings')
          : undefined;
      if (failure && epoch === this.lifecycleEpoch) return failure;

      return {
        statusCode: 409,
        data: {error: 'Call queue client was reinitialized; refresh settings'},
        message: FAILURE_MESSAGE,
      };
    }
  }

  /**
   * Sets ACD state, queue join, or both.
   * A queue with `allowLogOffEnabled: false` stays joined.
   *
   * @param request - The agent state and/or queue membership updates.
   * @param lineOwnerId - Optional secondary line owner ID; omit for the primary line.
   * @returns The updated call queue settings or an error response.
   * @example
   * ```js
   * await callQueue.updateCallQueueSettings({agentACDState: 'AVAILABLE'});
   * ```
   * @public
   */
  public async updateCallQueueSettings(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): Promise<CallQueueResponse> {
    const loggerContext = {file: CALL_QUEUE_FILE, method: METHODS.UPDATE_CALL_QUEUE_SETTINGS};
    log.info(METHOD_START_MESSAGE, loggerContext);
    const rejected = this.rejectBeforeRequest(lineOwnerId) ?? this.rejectUpdate(request);
    if (rejected) {
      return rejected;
    }

    const epoch = this.lifecycleEpoch;
    let requestSent = false;
    try {
      if (this.needsQueuePolicyRefresh(request, lineOwnerId)) {
        const settings = await this.getCallQueueSettings(lineOwnerId);
        if (epoch !== this.lifecycleEpoch) {
          return {
            statusCode: 409,
            data: {error: 'Call queue client was reinitialized; refresh settings'},
            message: FAILURE_MESSAGE,
          };
        }
        if (settings.statusCode >= 400) {
          return settings;
        }
        if (!settings.data.callQueue) {
          return {
            statusCode: 400,
            data: {error: 'Call queue settings are required before updating queue membership'},
            message: FAILURE_MESSAGE,
          };
        }
      }

      const body = this.buildUpdateBody(request, lineOwnerId);
      const generation = this.eventGeneration.get(lineOwnerId) ?? 0;
      this.requestSequence += 1;
      const sequence = this.requestSequence;
      requestSent = true;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.PUT,
        body,
      });
      if (epoch !== this.lifecycleEpoch) {
        return {
          statusCode: 409,
          data: {
            error:
              'Call queue client was reinitialized; request may have completed; refresh settings before retrying',
          },
          message: FAILURE_MESSAGE,
        };
      }
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      const current = this.currentByLine.get(lineOwnerId);
      const parsed = parseCallQueueSettings(response.body, current);
      const local = parsed ?? (current ? this.applyLocalUpdate(request, lineOwnerId) : undefined);
      const named = local ? await this.fillQueueNames(local) : undefined;
      if (epoch !== this.lifecycleEpoch) {
        return {
          statusCode: 409,
          data: {
            error:
              'Call queue client was reinitialized; request may have completed; refresh settings before retrying',
          },
          message: FAILURE_MESSAGE,
        };
      }
      if (
        !named ||
        (this.eventGeneration.get(lineOwnerId) ?? 0) !== generation ||
        (this.committedSequence.get(lineOwnerId) ?? 0) > sequence
      ) {
        const refreshed = await this.getCallQueueSettings(lineOwnerId);

        if (epoch !== this.lifecycleEpoch) {
          return {
            statusCode: 409,
            data: {
              error:
                'Call queue client was reinitialized; request may have completed; refresh settings before retrying',
            },
            message: FAILURE_MESSAGE,
          };
        }

        return refreshed.data.callQueue
          ? {
              statusCode: Number(response[STATUS_CODE]) || 200,
              data: {callQueue: refreshed.data.callQueue},
              message: SUCCESS_MESSAGE,
            }
          : refreshed;
      }
      this.currentByLine.set(lineOwnerId, named);
      this.committedSequence.set(lineOwnerId, sequence);
      log.log(
        `Call queue settings updated, state=${named.acdState}, queues=${named.queues.length}`,
        loggerContext
      );

      return {
        statusCode: Number(response[STATUS_CODE]) || 200,
        data: {callQueue: named},
        message: SUCCESS_MESSAGE,
      };
    } catch (err: unknown) {
      const failure =
        epoch === this.lifecycleEpoch
          ? await this.fail(err, loggerContext, 'Failed to update call queue settings')
          : undefined;
      if (failure && epoch === this.lifecycleEpoch) return failure;

      return {
        statusCode: 409,
        data: {
          error: requestSent
            ? 'Call queue client was reinitialized; request may have completed; refresh settings before retrying'
            : 'Call queue client was reinitialized; refresh settings',
        },
        message: FAILURE_MESSAGE,
      };
    }
  }

  /**
   * Asks the calling service to publish the current agent state on Mercury.
   * Sends the registered WDM device URL. The queue list arrives on `telephony_agents.sync`.
   *
   * @returns The sync request result or an error response.
   * @example
   * ```js
   * await callQueue.syncTelephonyCalls();
   * ```
   * @public
   */
  public async syncTelephonyCalls(): Promise<CallQueueResponse> {
    const loggerContext = {file: CALL_QUEUE_FILE, method: METHODS.SYNC_TELEPHONY_CALLS};
    log.info(METHOD_START_MESSAGE, loggerContext);
    const rejected = this.rejectBeforeRequest();
    if (rejected) {
      return rejected;
    }

    const wdmUrl = this.webex.internal.device?.url;
    if (!wdmUrl || !this.wdmDeviceId()) {
      return {
        statusCode: 400,
        data: {error: 'A registered device is required to sync telephony calls'},
        message: FAILURE_MESSAGE,
      };
    }

    const epoch = this.lifecycleEpoch;
    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.joinUrl(SYNC_PATH),
        method: HTTP_METHODS.POST,
        body: {wdmUrl, resources: [{resource: 'telephony_agents'}]},
      });
      if (epoch !== this.lifecycleEpoch) {
        return {
          statusCode: 409,
          data: {error: 'Call queue client was reinitialized; refresh settings'},
          message: FAILURE_MESSAGE,
        };
      }
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      // The sync endpoint returns 204; authoritative settings arrive via Mercury.

      const current = this.currentByLine.get(undefined);

      return {
        statusCode: Number(response[STATUS_CODE]) || 200,
        data: current ? {callQueue: current} : {},
        message: SUCCESS_MESSAGE,
      };
    } catch (err: unknown) {
      const failure =
        epoch === this.lifecycleEpoch
          ? await this.fail(err, loggerContext, 'Failed to sync telephony calls')
          : undefined;
      if (failure && epoch === this.lifecycleEpoch) return failure;

      return {
        statusCode: 409,
        data: {error: 'Call queue client was reinitialized; refresh settings'},
        message: FAILURE_MESSAGE,
      };
    }
  }

  private registerAgentListeners() {
    if (this.callingBackend !== CALLING_BACKEND.WXC) {
      return;
    }
    const events: Array<[string, CallQueueEventKind]> = [
      [MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC, 'sync'],
      [MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE, 'state'],
      [MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN, 'join'],
      ['event:telephony_agent.sync', 'sync'],
      ['event:telephony_agent.state', 'state'],
      ['event:telephony_agent.join', 'join'],
    ];
    const startingCount = this.mercuryListeners.length;
    try {
      events.forEach(([event, kind]) => {
        const listener = (data?: unknown) => this.handleAgentEvent(kind, data);
        this.mercuryListeners.push({event, listener});
        this.webex.internal.mercury.on(event, listener);
      });
    } catch (error) {
      const added = this.mercuryListeners.splice(startingCount);
      added.forEach(({event, listener}) => {
        try {
          this.webex.internal.mercury.off(event, listener);
        } catch {
          this.mercuryListeners.push({event, listener});
          log.warn('Failed to remove call queue Mercury listener after registration failed', {
            file: CALL_QUEUE_FILE,
            method: 'registerAgentListeners',
          });
        }
      });
      throw error;
    }
  }

  /**
   * Refresh backend readiness before reusing this client without issuing a request.
   *
   * @returns False if the client is disposed or its registered backend changed.
   * @example
   * ```js
   * const reusable = callQueue.prepareForReuse();
   * ```
   * @public
   */
  public prepareForReuse(): boolean {
    if (this.disposed) return false;

    const backend = hasReadyEntitlementModels(this.webex)
      ? getCallingBackEnd(this.webex)
      : CALLING_BACKEND.INVALID;
    if (this.mercuryListeners.length && backend !== CALLING_BACKEND.WXC) return false;

    this.lifecycleEpoch += 1;
    this.currentByLine.clear();
    this.queueNames.clear();
    this.eventGeneration.clear();
    this.committedSequence.clear();
    this.pendingEventRefresh.clear();
    this.callingBackend = backend;
    if (backend === CALLING_BACKEND.WXC && !this.mercuryListeners.length) {
      this.registerAgentListeners();
    }

    return true;
  }

  /**
   * Unsubscribe this client from queue Mercury events and clear its local state.
   *
   * @returns Nothing.
   * @example
   * ```js
   * callQueue.dispose();
   * ```
   * @public
   */
  public dispose(): void {
    this.disposed = true;
    this.lifecycleEpoch += 1;
    this.mercuryListeners.forEach(({event, listener}) => {
      this.webex.internal.mercury.off(event, listener);
    });
    this.mercuryListeners = [];
    this.currentByLine.clear();
    this.queueNames.clear();
    this.eventGeneration.clear();
    this.committedSequence.clear();
    this.pendingEventRefresh.clear();
    this.removeAllListeners();
  }

  private eventLine(event: unknown): EventLine {
    const payload = unwrapAgentPayload(event);
    if (payload?.actorType !== undefined && typeof payload.actorType !== 'string') {
      return {kind: 'ignore'};
    }
    const type = payload?.actorType?.toUpperCase();
    const actorId =
      payload?.actorId ?? (type === 'VIRTUAL_LINE' ? undefined : payload?.actorPersonId);
    if (!actorId) {
      return type ? {kind: 'ignore'} : {kind: 'primary'};
    }
    if (typeof actorId !== 'string') return {kind: 'ignore'};
    const actor = actorIdentity(actorId);
    const actorType = type ?? actor.type;
    const primaryId = this.webex.internal.device?.userId;
    if (actorType === 'PERSON' || actorType === 'PEOPLE') {
      return primaryId && actor.id === actorIdentity(primaryId).id
        ? {kind: 'primary'}
        : {kind: 'ignore'};
    }
    if (actorType && actorType !== 'VIRTUAL_LINE') return {kind: 'ignore'};
    const cachedLine = [...this.currentByLine.keys()].find(
      (id) => id !== undefined && actorIdentity(id).id === actor.id
    );
    if (actorType === 'VIRTUAL_LINE') {
      const lineOwnerId = cachedLine ?? actor.id;

      return LINE_OWNER_ID_PATTERN.test(lineOwnerId)
        ? {kind: 'secondary', lineOwnerId}
        : {kind: 'ignore'};
    }
    if (primaryId && actor.id === actorIdentity(primaryId).id) return {kind: 'primary'};

    return cachedLine ? {kind: 'secondary', lineOwnerId: cachedLine} : {kind: 'ignore'};
  }

  private handleAgentEvent(kind: CallQueueEventKind, event: unknown) {
    if (this.disposed) return;
    const epoch = this.lifecycleEpoch;
    const line = this.eventLine(event);
    if (line.kind === 'ignore') return;
    const lineOwnerId = line.kind === 'secondary' ? line.lineOwnerId : undefined;
    const generation = (this.eventGeneration.get(lineOwnerId) ?? 0) + 1;
    this.eventGeneration.set(lineOwnerId, generation);
    const current = this.currentByLine.get(lineOwnerId);
    const payload = unwrapAgentPayload(event);
    const eventState = normalizeAcdState(
      payload?.agentACDState ?? payload?.acdStateInfo?.state ?? payload?.state
    );
    if (!current) {
      if (eventState || Array.isArray(payload?.joinInfo) || Array.isArray(payload?.queues)) {
        const pending = this.refreshEventLine(lineOwnerId, generation);
        if (epoch !== this.lifecycleEpoch) return;
        this.pendingEventRefresh.set(lineOwnerId, pending);
        pending.then(() => {
          if (this.pendingEventRefresh.get(lineOwnerId) === pending) {
            this.pendingEventRefresh.delete(lineOwnerId);
          }
        });
      }

      return;
    }
    const next = applyCallQueueEvent(current, kind, event);
    if (
      !next ||
      (current && next.acdState === current.acdState && next.queues === current.queues)
    ) {
      return;
    }
    const named = applyQueueNames(next, this.queueNames);
    this.currentByLine.set(lineOwnerId, named);
    log.log(
      `Call queue ${kind} event applied, state=${named.acdState}, queues=${named.queues.length}`,
      {file: CALL_QUEUE_FILE, method: 'handleAgentEvent'}
    );
    this.emit(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, lineOwnerId ? {...named, lineOwnerId} : named);
    if (epoch !== this.lifecycleEpoch) return;
    if (named.queues.some((queue) => !queue.name)) {
      this.refreshQueueNames(named, generation, lineOwnerId).catch((err: unknown) => {
        log.error(`Failed to refresh call queue names: ${String(err)}`, {
          file: CALL_QUEUE_FILE,
          method: 'refreshQueueNames',
        });
      });
    }
  }

  private async waitForEventRefreshes(lineOwnerId: string | undefined): Promise<void> {
    let pending = this.pendingEventRefresh.get(lineOwnerId);
    while (pending) {
      // A replacement refresh is discoverable only after the previous one settles.
      // eslint-disable-next-line no-await-in-loop
      await pending;
      const next = this.pendingEventRefresh.get(lineOwnerId);
      if (next === pending) return;
      pending = next;
    }
  }

  private async refreshEventLine(lineOwnerId: string | undefined, generation: number) {
    if (this.rejectBeforeRequest(lineOwnerId)) return;
    const epoch = this.lifecycleEpoch;
    this.requestSequence += 1;
    const sequence = this.requestSequence;
    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.GET,
      });
      if (epoch !== this.lifecycleEpoch) return;
      const parsed = parseCallQueueSettings(response.body, this.currentByLine.get(lineOwnerId));
      if (!parsed) return;
      const named = await this.fillQueueNames(parsed);
      if (
        epoch !== this.lifecycleEpoch ||
        generation !== this.eventGeneration.get(lineOwnerId) ||
        (this.committedSequence.get(lineOwnerId) ?? 0) > sequence
      )
        return;
      this.currentByLine.set(lineOwnerId, named);
      this.committedSequence.set(lineOwnerId, sequence);
      this.emit(
        COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED,
        lineOwnerId ? {...named, lineOwnerId} : named
      );
    } catch {
      log.error('Failed to refresh call queue settings after an event', {
        file: CALL_QUEUE_FILE,
        method: 'refreshEventLine',
      });
    }
  }

  private async refreshQueueNames(
    status: CallQueueAgentStatus,
    generation: number,
    lineOwnerId?: string
  ) {
    const epoch = this.lifecycleEpoch;
    const named = await this.fillQueueNames(status);
    if (
      epoch !== this.lifecycleEpoch ||
      generation !== this.eventGeneration.get(lineOwnerId) ||
      this.currentByLine.get(lineOwnerId) !== status ||
      named === status
    ) {
      return;
    }
    this.currentByLine.set(lineOwnerId, named);
    this.emit(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, lineOwnerId ? {...named, lineOwnerId} : named);
  }

  private async fillQueueNames(status: CallQueueAgentStatus): Promise<CallQueueAgentStatus> {
    const missingIds = status.queues
      .filter((queue) => !queue.name && !this.queueNames.has(queueIdKey(queue.id)))
      .map((queue) => queueIdKey(queue.id));
    if (missingIds.length > 0) {
      await this.loadQueueCatalog(missingIds);
    }

    return applyQueueNames(status, this.queueNames);
  }

  private async loadQueueCatalog(neededIds: string[]): Promise<void> {
    const loggerContext = {file: CALL_QUEUE_FILE, method: METHODS.GET_CALL_QUEUE_NAMES};
    const epoch = this.lifecycleEpoch;
    const loadPage = async (uri: string, remainingPages: number): Promise<void> => {
      if (
        epoch !== this.lifecycleEpoch ||
        remainingPages === 0 ||
        neededIds.every((id) => this.queueNames.has(id))
      ) {
        return;
      }

      const response = <WebexRequestPayload>await this.webex.request({
        uri,
        method: HTTP_METHODS.GET,
      });
      if (epoch !== this.lifecycleEpoch) return;
      const catalog = parseCallQueueCatalog(response.body);
      catalog.entries.forEach((entry) => {
        if (entry.name) {
          this.queueNames.set(queueIdKey(entry.id), entry.name);
        }
      });
      const link = response.headers?.link || response.headers?.Link;
      const headerNext = link
        ?.split(',')
        .map((entry) => /<([^>]+)>\s*;\s*rel=["']?next["']?/i.exec(entry)?.[1])
        .find(Boolean);
      const next = this.catalogNextUrl(headerNext || catalog.next);
      if (next) {
        await loadPage(next, remainingPages - 1);
      }
    };

    try {
      await loadPage(this.joinUrl(QUEUES_CATALOG_PATH), MAX_QUEUE_CATALOG_PAGES);
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as {statusCode?: number}).statusCode
          : undefined;
      log.error(
        `Failed to load call queue names: status=${statusCode ?? 'unknown'}`,
        loggerContext
      );
    }
  }

  private catalogNextUrl(next: string | undefined): string | undefined {
    if (!next || next.includes('..') || next.includes('\\') || next.includes('@')) {
      return undefined;
    }
    try {
      const catalog = new URL(this.joinUrl(QUEUES_CATALOG_PATH));
      const candidate = new URL(
        next.startsWith(QUEUES_CATALOG_PATH) ? this.joinUrl(next) : next,
        catalog
      );

      return candidate.origin === catalog.origin && candidate.pathname === catalog.pathname
        ? candidate.toString()
        : undefined;
    } catch {
      return undefined;
    }
  }

  private wdmDeviceId(): string | undefined {
    const url = this.webex.internal.device?.url;
    const id = typeof url === 'string' ? url.split('/').filter(Boolean).pop() : undefined;
    if (!id || !/^[A-Za-z0-9-]{1,128}$/.test(id)) {
      return undefined;
    }

    return id;
  }

  private queuesUrl(lineOwnerId?: string): string {
    if (!lineOwnerId) {
      return this.joinUrl(QUEUES_PATH);
    }

    return this.joinUrl(
      `${SECONDARY_LINES_PATH}/${encodeURIComponent(
        publicApiId(lineOwnerId, 'VIRTUAL_LINE')
      )}/queues`
    );
  }

  private joinUrl(path: string): string {
    const endpoint = this.webexApiEndpoint || '';
    const base = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;

    return `${base}${path}`;
  }

  private rejectBeforeRequest(lineOwnerId?: string): CallQueueResponse | undefined {
    if (this.disposed) {
      return {
        statusCode: 400,
        data: {error: 'Call queue client has been disposed'},
        message: FAILURE_MESSAGE,
      };
    }
    // Device entitlement data may arrive after the client is constructed.
    this.callingBackend = hasReadyEntitlementModels(this.webex)
      ? getCallingBackEnd(this.webex)
      : CALLING_BACKEND.INVALID;
    if (this.callingBackend !== CALLING_BACKEND.WXC) {
      return {
        statusCode: 501,
        data: {error: UNSUPPORTED_BACKEND_MESSAGE},
        message: FAILURE_MESSAGE,
      };
    }
    if (!this.mercuryListeners.length) this.registerAgentListeners();
    if (lineOwnerId !== undefined && !LINE_OWNER_ID_PATTERN.test(lineOwnerId)) {
      return {
        statusCode: 400,
        data: {error: 'lineOwnerId is not a valid line id'},
        message: FAILURE_MESSAGE,
      };
    }
    if (!this.webexApiEndpoint) {
      return {
        statusCode: 400,
        data: {error: 'A supported Webex API base URL is required for call queues'},
        message: FAILURE_MESSAGE,
      };
    }

    return undefined;
  }

  private rejectUpdate(request: UpdateCallQueueSettingsRequest): CallQueueResponse | undefined {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return {
        statusCode: 400,
        data: {error: 'a call queue settings update is required'},
        message: FAILURE_MESSAGE,
      };
    }
    const hasState = request.agentACDState !== undefined;
    const hasQueues = request.queues !== undefined;
    if (!hasState && !hasQueues) {
      return {
        statusCode: 400,
        data: {error: 'agentACDState or queues is required'},
        message: FAILURE_MESSAGE,
      };
    }
    if (hasState && !SUPPORTED_STATES.has(request.agentACDState as string)) {
      return {
        statusCode: 400,
        data: {error: 'agentACDState is not a supported ACD state'},
        message: FAILURE_MESSAGE,
      };
    }
    if (hasQueues && !Array.isArray(request.queues)) {
      return {
        statusCode: 400,
        data: {error: 'queues must be an array of queue updates'},
        message: FAILURE_MESSAGE,
      };
    }
    if (hasQueues && request.queues?.length === 0) {
      return {
        statusCode: 400,
        data: {error: 'queues must include at least one queue update'},
        message: FAILURE_MESSAGE,
      };
    }
    if (hasQueues) {
      const invalid = request.queues?.some(
        (queue) =>
          !queue ||
          typeof queue.id !== 'string' ||
          !queue.id.trim() ||
          typeof queue.available !== 'boolean'
      );
      if (invalid) {
        return {
          statusCode: 400,
          data: {error: 'each queue update needs an id and an available flag'},
          message: FAILURE_MESSAGE,
        };
      }
    }

    return undefined;
  }

  private buildUpdateBody(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (request.agentACDState) {
      body.agentACDState = request.agentACDState;
    }
    if (request.queues) {
      body.queues = request.queues.map((queue) => ({
        id: publicApiId(queue.id, 'CALL_QUEUE'),
        available: this.canChangeJoin(queue.id, lineOwnerId) ? queue.available : true,
      }));
    }

    return body;
  }

  private canChangeJoin(queueId: string, lineOwnerId?: string): boolean {
    const known = this.currentByLine
      .get(lineOwnerId)
      ?.queues.find((queue) => queueIdKey(queue.id) === queueIdKey(queueId));
    if (!known || known.allowLogOffEnabled === undefined) {
      return true;
    }

    return known.allowLogOffEnabled;
  }

  private needsQueuePolicyRefresh(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): boolean {
    const status = this.currentByLine.get(lineOwnerId);

    return Boolean(
      request.queues?.some(
        (queue) =>
          !queue.available &&
          !status?.queues.some(
            (known) =>
              queueIdKey(known.id) === queueIdKey(queue.id) &&
              known.allowLogOffEnabled !== undefined
          )
      )
    );
  }

  private applyLocalUpdate(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): CallQueueAgentStatus {
    const base = this.currentByLine.get(lineOwnerId) as CallQueueAgentStatus;
    const queues = request.queues
      ? request.queues.reduce((list, update) => {
          const index = list.findIndex((queue) => queueIdKey(queue.id) === queueIdKey(update.id));
          const available = this.canChangeJoin(update.id, lineOwnerId) ? update.available : true;
          if (index === -1) {
            return list.concat({id: update.id, available});
          }
          const next = list.slice();
          next[index] = {...list[index], available};

          return next;
        }, base.queues)
      : base.queues;

    return {
      acdState: request.agentACDState ?? base.acdState,
      queues,
    };
  }

  private async fail(
    err: unknown,
    loggerContext: {file: string; method: string},
    message: string
  ): Promise<CallQueueResponse> {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as {statusCode?: number}).statusCode
        : undefined;
    log.error(`${message}: status=${statusCode ?? 'unknown'}`, loggerContext);
    try {
      await uploadLogs();
    } catch {
      log.warn('Unable to upload call queue diagnostic logs', loggerContext);
    }

    return serviceErrorCodeHandler(
      (err ?? {}) as WebexRequestPayload,
      loggerContext
    ) as Promise<CallQueueResponse>;
  }
}

const clientConfigurations = new WeakMap<
  CallQueueClient,
  {webex: WebexSDK; apiBaseUrl?: string; loggerLevel?: string; userId?: string; orgId?: string}
>();

/**
 * Creates a call-queue client for the signed-in Webex Calling user.
 *
 * @param webex - The Webex SDK instance used for requests and events.
 * @param logger - Logging configuration for the Calling SDK.
 * @param options - Call queue options, including the public API base URL.
 * @param previousClient - Optional existing client to reuse when its configuration still matches.
 * @returns A call-queue client.
 * @example
 * ```js
 * const callQueue = createCallQueueClient(webex, logger, {webexApiBaseUrl});
 * ```
 * @public
 */
export const createCallQueueClient = (
  webex: WebexSDK,
  logger: LoggerInterface,
  options: CallQueueClientOptions,
  previousClient?: CallQueueClient
): CallQueueClient => {
  const config = {
    webex,
    apiBaseUrl: options?.webexApiBaseUrl,
    loggerLevel: logger?.level,
    userId: webex.internal.device?.userId,
    orgId: webex.internal.device?.orgId,
  };
  const previousConfig = previousClient && clientConfigurations.get(previousClient);
  const compatible =
    previousConfig &&
    previousConfig.webex === config.webex &&
    previousConfig.apiBaseUrl === config.apiBaseUrl &&
    previousConfig.loggerLevel === config.loggerLevel &&
    previousConfig.userId === config.userId &&
    previousConfig.orgId === config.orgId;

  if (previousClient && compatible) {
    try {
      if (previousClient.prepareForReuse()) return previousClient;
    } catch (error) {
      previousClient.dispose();
      throw error;
    }
  }
  previousClient?.dispose();

  const client = new CallQueueClient(webex, logger, options);
  clientConfigurations.set(client, config);

  return client;
};
