/* eslint-disable no-underscore-dangle */
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
  WEBEX_CALLING_GATEWAY_INT,
  WEBEX_CALLING_GATEWAY_PROD,
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
import {
  applyCallQueueEvent,
  applyQueueNames,
  normalizeAcdState,
  parseCallQueueCatalog,
  parseCallQueueSettings,
  queueIdKey,
  unwrapAgentPayload,
} from './state';
import {
  ACD_STATE,
  CallQueueAgentStatus,
  CallQueueEventKind,
  CallQueueEventTypes,
  CallQueueResponse,
  ICallQueue,
  LoggerInterface,
  UpdateCallQueueSettingsRequest,
} from './types';

const SUPPORTED_STATES = new Set<string>(Object.values(ACD_STATE));

type EventLine = {kind: 'primary'} | {kind: 'secondary'; lineOwnerId: string} | {kind: 'ignore'};

function actorIdentity(value: string): {id: string; type?: string} {
  const parse = (candidate: string) =>
    /^ciscospark:\/\/[^/]+\/(PEOPLE|PERSON|VIRTUAL_LINE)\/([^/]+)$/i.exec(candidate);
  let match = parse(value);
  if (!match) {
    try {
      match = parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      // An unencoded actor ID is also valid.
    }
  }

  return match
    ? {type: match[1].toUpperCase(), id: match[2].toLowerCase()}
    : {id: value.toLowerCase()};
}

/**
 * Webex Calling cloud client for call-queue agent status.
 *
 * Reads and updates `GET/PATCH /api/v1/users/me/settings/queues`,
 * asks CXAPI to sync with `POST /v1/telephony/calls/sync/invoke`, and keeps the
 * local status current from Mercury `telephony_agents` events.
 *
 * @example
 * ```javascript
 * const callQueue = createCallQueueClient(webex, logger);
 * const status = await callQueue.getCallQueueSettings();
 * ```
 */
export class CallQueueClient extends Eventing<CallQueueEventTypes> implements ICallQueue {
  private webex: WebexSDK;

  private callingBackend: CALLING_BACKEND;

  private hydraEndpoint: string;

  private webexCallingGatewayEndpoint: string;

  private currentByLine = new Map<string | undefined, CallQueueAgentStatus>();

  private queueNames = new Map<string, string>();

  private eventGeneration = new Map<string | undefined, number>();

  private requestSequence = 0;

  private committedSequence = new Map<string | undefined, number>();

  private pendingEventRefresh = new Map<string | undefined, Promise<void>>();

  private mercuryListeners: Array<{event: string; listener: (data?: unknown) => void}> = [];

  constructor(webex: WebexSDK, logger: LoggerInterface) {
    super();
    if (!SDKConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = webex;
    this.callingBackend = getCallingBackEnd(this.webex);
    this.hydraEndpoint =
      this.webex.internal.services._serviceUrls?.hydra ||
      this.webex.internal.services.get(this.webex.internal.services._activeServices.hydra);
    const deviceUrl = this.webex.internal.device?.url || '';
    const u2cDiscoveryUrl = this.webex.config?.services?.discovery?.u2c || '';
    const callingGatewayOverride = this.webex.config?.services?.discovery?.callingGateway;
    // In some Integration accounts, device registration succeeds against WDM
    // Integration but returns a device URL without `-int`. Prefer either
    // environment signal so an Integration token is never sent to Production.
    const isIntegration = deviceUrl.includes('-int') || u2cDiscoveryUrl.includes('-int');
    this.webexCallingGatewayEndpoint =
      callingGatewayOverride ||
      (isIntegration ? WEBEX_CALLING_GATEWAY_INT : WEBEX_CALLING_GATEWAY_PROD);
    this.registerAgentListeners();
    log.setLogger(logger.level, CALL_QUEUE_FILE);
  }

  /**
   * Reads the signed-in agent's ACD state and queue join list.
   * Pass `lineOwnerId` to read a secondary line.
   * Queue display names are filled from the queue catalog when settings omit them.
   */
  public async getCallQueueSettings(lineOwnerId?: string): Promise<CallQueueResponse> {
    const loggerContext = {file: CALL_QUEUE_FILE, method: METHODS.GET_CALL_QUEUE_SETTINGS};
    log.info(METHOD_START_MESSAGE, loggerContext);
    const rejected = this.rejectBeforeRequest(lineOwnerId);
    if (rejected) {
      return rejected;
    }

    const generation = this.eventGeneration.get(lineOwnerId) ?? 0;
    this.requestSequence += 1;
    const sequence = this.requestSequence;
    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.GET,
      });
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      const parsed = parseCallQueueSettings(response.body, this.currentByLine.get(lineOwnerId));
      const named = parsed ? await this.fillQueueNames(parsed) : undefined;
      if (
        (this.eventGeneration.get(lineOwnerId) ?? 0) !== generation ||
        (this.committedSequence.get(lineOwnerId) ?? 0) > sequence
      ) {
        await this.waitForEventRefreshes(lineOwnerId);
        const latest = this.currentByLine.get(lineOwnerId);

        return latest
          ? this.success(response, latest)
          : this.failure(409, 'Call queue settings changed while loading; retry the request');
      }
      if (!named) {
        return this.failure(502, 'Call queue settings response did not include agent status');
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

      return this.success(response, named);
    } catch (err: unknown) {
      return this.fail(err, loggerContext, 'Failed to get call queue settings');
    }
  }

  /**
   * Sets ACD state, queue join, or both.
   * A queue with `allowLogOffEnabled: false` stays joined.
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

    try {
      if (this.needsQueuePolicyRefresh(request, lineOwnerId)) {
        const settings = await this.getCallQueueSettings(lineOwnerId);
        if (settings.statusCode >= 400) {
          return settings;
        }
        if (!settings.data.callQueue) {
          return this.failure(
            400,
            'Call queue settings are required before updating queue membership'
          );
        }
      }

      const body = this.buildUpdateBody(request, lineOwnerId);
      const generation = this.eventGeneration.get(lineOwnerId) ?? 0;
      this.requestSequence += 1;
      const sequence = this.requestSequence;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.PATCH,
        body,
      });
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      const current = this.currentByLine.get(lineOwnerId);
      const parsed = parseCallQueueSettings(response.body, current);
      const local = parsed ?? (current ? this.applyLocalUpdate(request, lineOwnerId) : undefined);
      const named = local ? await this.fillQueueNames(local) : undefined;
      if (
        !named ||
        (this.eventGeneration.get(lineOwnerId) ?? 0) !== generation ||
        (this.committedSequence.get(lineOwnerId) ?? 0) > sequence
      ) {
        const refreshed = await this.getCallQueueSettings(lineOwnerId);

        return refreshed.data.callQueue
          ? this.success(response, refreshed.data.callQueue)
          : refreshed;
      }
      this.currentByLine.set(lineOwnerId, named);
      this.committedSequence.set(lineOwnerId, sequence);
      log.log(
        `Call queue settings updated, state=${named.acdState}, queues=${named.queues.length}`,
        loggerContext
      );

      return this.success(response, named);
    } catch (err: unknown) {
      return this.fail(err, loggerContext, 'Failed to update call queue settings');
    }
  }

  /**
   * Asks the calling service to publish the current agent state on Mercury.
   * Sends the registered WDM device URL. The queue list arrives on `telephony_agents.sync`.
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
      return this.failure(400, 'A registered device is required to sync telephony calls');
    }

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.joinUrl(SYNC_PATH),
        method: HTTP_METHODS.POST,
        body: {wdmUrl, resources: [{resource: 'telephony_agents'}]},
      });
      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);
      // The sync endpoint returns 204; authoritative settings arrive via Mercury.

      return this.success(response, this.currentByLine.get(undefined));
    } catch (err: unknown) {
      return this.fail(err, loggerContext, 'Failed to sync telephony calls');
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
    events.forEach(([event, kind]) => {
      const listener = (data?: unknown) => this.handleAgentEvent(kind, data);
      this.webex.internal.mercury.on(event, listener);
      this.mercuryListeners.push({event, listener});
    });
  }

  /** Unsubscribe only the Mercury listeners created by this client. */
  public dispose(): void {
    this.mercuryListeners.forEach(({event, listener}) => {
      this.webex.internal.mercury.off(event, listener);
    });
    this.mercuryListeners = [];
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
    this.requestSequence += 1;
    const sequence = this.requestSequence;
    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: this.queuesUrl(lineOwnerId),
        method: HTTP_METHODS.GET,
      });
      const parsed = parseCallQueueSettings(response.body, this.currentByLine.get(lineOwnerId));
      if (!parsed) return;
      const named = await this.fillQueueNames(parsed);
      if (
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
    const named = await this.fillQueueNames(status);
    if (
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
    const loadPage = async (uri: string, remainingPages: number): Promise<void> => {
      if (remainingPages === 0 || neededIds.every((id) => this.queueNames.has(id))) {
        return;
      }

      const response = <WebexRequestPayload>await this.webex.request({
        uri,
        method: HTTP_METHODS.GET,
      });
      const catalog = parseCallQueueCatalog(response.body);
      catalog.entries.forEach((entry) => {
        if (entry.name) {
          this.queueNames.set(queueIdKey(entry.id), entry.name);
        }
      });
      const next = this.catalogNextUrl(catalog.next);
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
    const base = this.hydraEndpoint.endsWith('/') ? this.hydraEndpoint : `${this.hydraEndpoint}/`;
    if (next.startsWith(base)) {
      return next;
    }
    if (next.startsWith(QUEUES_CATALOG_PATH)) {
      return this.joinUrl(next);
    }

    return undefined;
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
      return this.joinWebexCallingGatewayUrl(QUEUES_PATH);
    }

    return this.joinWebexCallingGatewayUrl(
      `${SECONDARY_LINES_PATH}/${encodeURIComponent(lineOwnerId)}/queues`
    );
  }

  private joinWebexCallingGatewayUrl(path: string): string {
    const base = this.webexCallingGatewayEndpoint.endsWith('/')
      ? this.webexCallingGatewayEndpoint
      : `${this.webexCallingGatewayEndpoint}/`;

    return `${base}${path}`;
  }

  private joinUrl(path: string): string {
    const base = this.hydraEndpoint.endsWith('/') ? this.hydraEndpoint : `${this.hydraEndpoint}/`;

    return `${base}${path}`;
  }

  private rejectBeforeRequest(lineOwnerId?: string): CallQueueResponse | undefined {
    if (this.callingBackend !== CALLING_BACKEND.WXC) {
      return this.failure(501, UNSUPPORTED_BACKEND_MESSAGE);
    }
    if (lineOwnerId !== undefined && !LINE_OWNER_ID_PATTERN.test(lineOwnerId)) {
      return this.failure(400, 'lineOwnerId is not a valid line id');
    }

    return undefined;
  }

  private rejectUpdate(request: UpdateCallQueueSettingsRequest): CallQueueResponse | undefined {
    const hasState = request.agentACDState !== undefined;
    const hasQueues = request.queues !== undefined;
    if (!hasState && !hasQueues) {
      return this.failure(400, 'agentACDState or queues is required');
    }
    if (hasState && !SUPPORTED_STATES.has(request.agentACDState as string)) {
      return this.failure(400, 'agentACDState is not a supported ACD state');
    }
    if (hasQueues && request.queues?.length === 0) {
      return this.failure(400, 'queues must include at least one queue update');
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
        return this.failure(400, 'each queue update needs an id and an available flag');
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
        id: queue.id,
        available: this.canChangeJoin(queue.id, lineOwnerId) ? queue.available : true,
      }));
    }

    return body;
  }

  private canChangeJoin(queueId: string, lineOwnerId?: string): boolean {
    const known = this.currentByLine.get(lineOwnerId)?.queues.find((queue) => queue.id === queueId);
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
            (known) => known.id === queue.id && known.allowLogOffEnabled !== undefined
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
          const index = list.findIndex((queue) => queue.id === update.id);
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

  private success(
    response: WebexRequestPayload,
    callQueue?: CallQueueAgentStatus
  ): CallQueueResponse {
    return {
      statusCode: Number(response[STATUS_CODE]) || 200,
      data: callQueue ? {callQueue} : {},
      message: SUCCESS_MESSAGE,
    };
  }

  private failure(statusCode: number, error: string): CallQueueResponse {
    return {
      statusCode,
      data: {error},
      message: FAILURE_MESSAGE,
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
    await uploadLogs();

    return serviceErrorCodeHandler(
      err as WebexRequestPayload,
      loggerContext
    ) as Promise<CallQueueResponse>;
  }
}

/**
 * Creates a call-queue client for the signed-in Webex Calling user.
 */
export const createCallQueueClient = (webex: WebexSDK, logger: LoggerInterface): CallQueueClient =>
  new CallQueueClient(webex, logger);
