/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import log from '../Logger';
import {serviceErrorCodeHandler, uploadLogs} from '../common/Utils';
import {METHOD_START_MESSAGE, SUCCESS_MESSAGE, SUCCESS_STATUS_CODE} from '../common/constants';
import {
  CallRecordingEventTypes,
  COMMON_EVENT_KEYS,
  MOBIUS_EVENT_KEYS,
  RECORDING_EVENT_SUBTYPE,
  RecordingEvent,
} from '../Events/types';
import {Eventing} from '../Events/impl';
import {
  DeleteRecordingOptions,
  GetCallRecordingRequest,
  GetRecordingsOptions,
  ICallRecording,
  LoggerInterface,
  RecordingDeleteResponse,
  RecordingListResponse,
  RecordingMetadataResponse,
  RecordingRequestType,
  RecordingResponse,
  RecordingResponseFor,
} from './types';
import {
  CALL_RECORDING_FILE,
  CATEGORY,
  DEFAULT_CATEGORY,
  DEFAULT_MAX,
  DEFAULT_OFFSET,
  DEFAULT_ORDER_BY,
  DEFAULT_ORDER_TYPE,
  DEFAULT_STATUS,
  LIMIT,
  METHODS,
  OFFSET,
  ORDER_BY,
  ORDER_TYPE,
  RECORDING_NOT_FOUND_MESSAGE,
  SOFT_DELETE,
  STATUS,
  USERHUB_SERVICE_NAME,
  WEBEX_USER_REQUEST_HEADER,
} from './constants';
import {
  joinUserhubRecordingsUrl,
  mapUserhubMetadata,
  mapUserhubRecording,
  unwrapUserhubRecording,
  UserhubRecording,
  UserhubRecordingListBody,
} from './userhub';

/**
 * User Hub error bodies are non-enumerable on WebexHttpError, so JSON.stringify drops them.
 * Keep the server message (no tokens) so the sample can show why the list failed.
 */
function readUserhubErrorDetail(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return '';
  }
  const body = (err as {body?: unknown}).body;
  if (typeof body === 'string') {
    return body.slice(0, 500);
  }
  if (!body || typeof body !== 'object') {
    return '';
  }
  const record = body as {
    message?: unknown;
    error?: unknown;
    errorCode?: unknown;
    trackingId?: unknown;
  };
  const parts = [record.errorCode, record.message, record.error, record.trackingId].filter(
    (part) => typeof part === 'string' && part.trim()
  );
  if (parts.length > 0) {
    return parts.join(' ').slice(0, 500);
  }

  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return '';
  }
}

/**
 * Webex Calling (WXC) backend connector for Post Call Recording.
 *
 * Userhub NG only (`webex-user-hub-service` / `webappng/api/v1/hub/convergedRecordings`),
 * matching the working browser POC and native desktop. Hydra download links CORS-fail
 * in browser hosts; userhub playback / aibridge links do not.
 */
export class WxcCallRecordingConnector
  extends Eventing<CallRecordingEventTypes>
  implements ICallRecording
{
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  /**
   * @param webex - `Webex SDK` instance.
   * @param logger - Logger interface used to set the log level for the module.
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    super();
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();

    this.registerRecordingListeners();
    log.setLogger(logger.level, CALL_RECORDING_FILE);
  }

  private resolveUserhubBaseUrl(): string {
    const catalogUrl =
      this.webex.internal.services._serviceUrls?.[USERHUB_SERVICE_NAME] ||
      (typeof this.webex.internal.services.get === 'function'
        ? this.webex.internal.services.get(USERHUB_SERVICE_NAME)
        : '');

    return joinUserhubRecordingsUrl(catalogUrl || '');
  }

  /**
   * List query: `orderType=DESC&orderBy=appCreateTime&status=available&category=calling&offset&limit`.
   * User Hub does not need `siteurl` for calling recordings. A wrong site name returns 500.
   */
  private buildUserhubRecordingsUrl(options?: GetRecordingsOptions): string {
    const baseUrl = this.resolveUserhubBaseUrl();
    if (!baseUrl) {
      return '';
    }
    const params = new URLSearchParams();
    params.append(ORDER_TYPE, DEFAULT_ORDER_TYPE);
    params.append(ORDER_BY, DEFAULT_ORDER_BY);
    params.append(STATUS, options?.status ?? DEFAULT_STATUS);
    params.append(CATEGORY, DEFAULT_CATEGORY);
    params.append(OFFSET, DEFAULT_OFFSET);
    params.append(LIMIT, `${options?.max ?? DEFAULT_MAX}`);

    return `${baseUrl}?${params.toString()}`;
  }

  private buildUserhubRecordingUrl(recordingId: string): string {
    const baseUrl = this.resolveUserhubBaseUrl();
    if (!baseUrl) {
      return '';
    }

    return `${baseUrl}/${encodeURIComponent(recordingId)}`;
  }

  private buildUserhubSoftDeleteUrl(): string {
    const baseUrl = this.resolveUserhubBaseUrl();

    return baseUrl ? `${baseUrl}/${SOFT_DELETE}` : '';
  }

  private async userhubRequest(
    url: string,
    method: HTTP_METHODS,
    body?: Record<string, unknown>,
    logMethod: string = METHODS.GET_RECORDINGS
  ): Promise<WebexRequestPayload> {
    if (!url) {
      const error = new Error('User Hub recordings URL is empty') as Error & {statusCode: number};
      error.statusCode = 503;
      throw error;
    }

    const supertoken = (this.webex.credentials as {supertoken?: {toString: () => string}})
      .supertoken;
    // The pasted access token. webex.request calls getUserToken(), which downscopes
    // that token (drops spark:kms). User Hub 500s on the downscoped token. The Teams
    // POC sends the original user token with Accept and WebexUserRequest only.
    if (supertoken) {
      return this.userhubFetch(url, method, body, supertoken);
    }

    try {
      return await this.webex.request({
        uri: url,
        method,
        headers: {
          Accept: 'application/json',
          [WEBEX_USER_REQUEST_HEADER]: 'true',
        },
        ...(body ? {body} : {}),
      });
    } catch (error: unknown) {
      const statusCode = Number((error as WebexRequestPayload)?.statusCode);
      if (statusCode !== 500) {
        throw error;
      }
      log.info('User Hub returned 500 from webex.request; retrying with the user token only', {
        file: CALL_RECORDING_FILE,
        method: logMethod,
      });

      return this.userhubFetch(url, method, body);
    }
  }

  /**
   * Same request the Teams userhub POC uses: the original user token,
   * Accept, and WebexUserRequest. No cisco-device-url or spark-user-agent.
   */
  private async userhubFetch(
    url: string,
    method: HTTP_METHODS,
    body?: Record<string, unknown>,
    tokenOverride?: {toString: () => string}
  ): Promise<WebexRequestPayload> {
    const token = tokenOverride ?? (await this.webex.credentials.getUserToken());
    // Token#toString() is already "Bearer <access_token>". Prefixing again is a 401.
    const rendered = String(token);
    const authorization = /^Bearer\s/i.test(rendered) ? rendered : `Bearer ${rendered}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: authorization,
      [WEBEX_USER_REQUEST_HEADER]: 'true',
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, {
      method,
      headers,
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const text = await response.text();
    let parsed: unknown;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {message: text};
      }
    }
    const payload: WebexRequestPayload = {
      statusCode: response.status,
      body: parsed as WebexRequestPayload['body'],
    };
    if (!response.ok) {
      throw payload;
    }

    return payload;
  }

  /**
   * Reads Post Call Recordings, dispatching to the matching operation based on the request `type`.
   * The concrete response type is inferred per request via {@link RecordingResponseFor}.
   *
   * @param request - The discriminated read request.
   */
  public getCallRecording<T extends GetCallRecordingRequest>(
    request: T
  ): Promise<RecordingResponseFor<T>> {
    return this.dispatchGetCallRecording(request) as Promise<RecordingResponseFor<T>>;
  }

  /**
   * Internal dispatcher for {@link getCallRecording}. Routes the discriminated request to the
   * backend-specific read method. Kept separate from the public generic signature so the switch
   * runs against a concrete union (with exhaustiveness checking) and the conditional return type is
   * narrowed in exactly one place.
   *
   * @param request - The discriminated read request.
   */
  private dispatchGetCallRecording(
    request: GetCallRecordingRequest
  ): Promise<RecordingListResponse | RecordingResponse | RecordingMetadataResponse> {
    switch (request.type) {
      case RecordingRequestType.LIST:
        return this.getRecordings(request.options);

      case RecordingRequestType.DETAIL:
        return this.getRecording(request.recordingId);

      case RecordingRequestType.METADATA:
        return this.getRecordingMetadata(request.recordingId);

      case RecordingRequestType.BY_CALL_SESSION:
        return this.getRecordingsByCallSessionId(request.callSessionId, request.options);

      default: {
        const exhaustiveCheck: never = request;

        throw new Error(`Unsupported recording request type: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Fetches the converged recordings for the current user.
   * @param options - Optional filters and pagination parameters.
   */
  private async getRecordings(options?: GetRecordingsOptions): Promise<RecordingListResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDINGS,
    };

    log.info(
      `${METHOD_START_MESSAGE} with options=${JSON.stringify(options ?? {})}`,
      loggerContext
    );

    let requestUrl = '';
    try {
      requestUrl = await this.buildUserhubRecordingsUrl(options);
      const response = <WebexRequestPayload>await this.userhubRequest(requestUrl, HTTP_METHODS.GET);

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const body = (response.body ?? {}) as UserhubRecordingListBody;
      const recordings = (body.recordings ?? body.items ?? [])
        .map(mapUserhubRecording)
        .filter((item) => item.id);

      const responseDetails: RecordingListResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          recordings,
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(
        `Successfully retrieved ${responseDetails.data.recordings?.length ?? 0} recordings`,
        loggerContext
      );

      return responseDetails;
    } catch (err: unknown) {
      const serverDetail = readUserhubErrorDetail(err);
      log.error(`Failed to get recordings: ${serverDetail || JSON.stringify(err)}`, loggerContext);
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;
      const handled = (await serviceErrorCodeHandler(
        errorInfo,
        loggerContext
      )) as RecordingListResponse;
      if (Number(handled.statusCode) === 500) {
        const detail = [serverDetail || handled.data?.error, requestUrl ? `url=${requestUrl}` : '']
          .filter((part) => part)
          .join(' | ');
        if (detail) {
          handled.data.error = detail;
        }
      } else if (serverDetail) {
        handled.data.error = serverDetail;
      }

      return handled;
    }
  }

  /**
   * Fetches a single converged recording by its id.
   * @param recordingId - The recording id (`id`).
   */
  private async getRecording(recordingId: string): Promise<RecordingResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDING,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const response = <WebexRequestPayload>(
        await this.userhubRequest(
          this.buildUserhubRecordingUrl(recordingId),
          HTTP_METHODS.GET,
          undefined,
          METHODS.GET_RECORDING
        )
      );

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const recording = mapUserhubRecording(
        unwrapUserhubRecording(response.body as UserhubRecording)
      );

      const responseDetails: RecordingResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          recording,
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully retrieved recording ${recordingId}`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(
        `Failed to get recording: ${readUserhubErrorDetail(err) || JSON.stringify(err)}`,
        loggerContext
      );
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(errorInfo, loggerContext) as Promise<RecordingResponse>;
    }
  }

  /**
   * Returns all recordings linked to a given call session id.
   *
   * Note (documented API gap): the recording API does not expose a confirmed server-side query parameter
   * to filter by call session id, so a list is fetched and filtered client-side on
   * `serviceData.callSessionId`. The scan is bounded by the list query, so `options` is forwarded
   * to {@link getRecordings} to let callers change `status` or `max` when the target session may
   * fall outside the first page.
   *
   * @param callSessionId - The call session id to filter by.
   * @param options - Optional list query forwarded to {@link getRecordings} to control the
   *   set of recordings scanned before filtering.
   */
  private async getRecordingsByCallSessionId(
    callSessionId: string,
    options?: GetRecordingsOptions
  ): Promise<RecordingListResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDINGS_BY_CALL_SESSION_ID,
    };

    log.info(`${METHOD_START_MESSAGE} with callSessionId=${callSessionId}`, loggerContext);

    const listResponse = await this.getRecordings(options);

    if (listResponse.statusCode !== SUCCESS_STATUS_CODE) {
      return listResponse;
    }

    const filtered = (listResponse.data.recordings ?? []).filter(
      (recording) => recording.serviceData?.callSessionId === callSessionId
    );

    if (filtered.length === 0) {
      log.info(RECORDING_NOT_FOUND_MESSAGE, loggerContext);
    } else {
      log.log(
        `Successfully retrieved ${filtered.length} recordings for call session ${callSessionId}`,
        loggerContext
      );
    }

    return {
      statusCode: SUCCESS_STATUS_CODE,
      data: {
        recordings: filtered,
      },
      message: SUCCESS_MESSAGE,
    };
  }

  /**
   * Fetches the metadata for a single recording.
   * @param recordingId - The recording id (`id`).
   */
  private async getRecordingMetadata(recordingId: string): Promise<RecordingMetadataResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDING_METADATA,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const response = <WebexRequestPayload>(
        await this.userhubRequest(
          this.buildUserhubRecordingUrl(recordingId),
          HTTP_METHODS.GET,
          undefined,
          METHODS.GET_RECORDING_METADATA
        )
      );

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const metadata = mapUserhubMetadata(
        unwrapUserhubRecording(response.body as UserhubRecording)
      );

      const responseDetails: RecordingMetadataResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          metadata,
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully retrieved metadata for recording ${recordingId}`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(
        `Failed to get recording metadata: ${readUserhubErrorDetail(err) || JSON.stringify(err)}`,
        loggerContext
      );
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(
        errorInfo,
        loggerContext
      ) as Promise<RecordingMetadataResponse>;
    }
  }

  /**
   * Moves a recording to the recycle bin (soft delete).
   * `POST {userhub}/.../convergedRecordings/softDelete` with `recordUUIDs: [recordingId]`.
   * Requires `spark:recordings_write` on the access token.
   *
   * Mercury emits `convergedRecordings.updated` + `eventSubType: TRASH`, which this connector
   * surfaces as `callRecording:deleted`.
   *
   * @param recordingId - The recording id (`id`) to move to the recycle bin.
   * @param _options - Deprecated. Ignored. Compliance permanent delete uses a separate API.
   */
  public async deleteRecording(
    recordingId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for ICallRecording signature parity; soft delete ignores options
    _options?: DeleteRecordingOptions
  ): Promise<RecordingDeleteResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.DELETE_RECORDING,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const response = <WebexRequestPayload>(
        await this.userhubRequest(
          this.buildUserhubSoftDeleteUrl(),
          HTTP_METHODS.POST,
          {recordUUIDs: [recordingId]},
          METHODS.DELETE_RECORDING
        )
      );

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const responseDetails: RecordingDeleteResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully moved recording ${recordingId} to recycle bin`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(
        `Failed to delete recording: ${readUserhubErrorDetail(err) || JSON.stringify(err)}`,
        loggerContext
      );
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(errorInfo, loggerContext) as Promise<RecordingDeleteResponse>;
    }
  }

  // `event` is optional because SDKConnector.registerListener invokes callbacks as `(data?: T)`.
  // `data` uses optional chaining at runtime because malformed Mercury payloads may omit it.
  handleRecordingCreatedEvent = async (event?: RecordingEvent) => {
    if (!event?.data?.activity) {
      return;
    }

    this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, event);
  };

  /**
   * The backend expresses the full recording lifecycle through `convergedRecordings.updated` events
   * qualified by an `eventSubType` (rather than dedicated created/deleted events):
   * - `TRASH` (soft delete) / `PURGE` (permanent delete) -> surfaced as `callRecording:deleted`
   *   so consumers can drop the recording from the active list.
   * - `RESTORE` (restored from trash) -> surfaced as `callRecording:created` so it is re-added.
   * - `SUMMARY_CREATE` (AI summary/transcript ready) and anything else -> `callRecording:updated`.
   *
   * The full event (including `data.eventSubType`) is always forwarded, so consumers that need to
   * distinguish a soft delete from a permanent purge can still inspect it.
   */
  handleRecordingUpdatedEvent = async (event?: RecordingEvent) => {
    if (!event?.data?.activity) {
      return;
    }

    switch (event.data.eventSubType) {
      case RECORDING_EVENT_SUBTYPE.TRASH:
      case RECORDING_EVENT_SUBTYPE.PURGE:
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, event);
        break;

      case RECORDING_EVENT_SUBTYPE.RESTORE:
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, event);
        break;

      default:
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, event);
    }
  };

  handleRecordingDeletedEvent = async (event?: RecordingEvent) => {
    if (!event?.data?.activity) {
      return;
    }

    this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, event);
  };

  /**
   * Subscribes to the recording Mercury events and re-emits them as typed client events.
   */
  private registerRecordingListeners() {
    this.sdkConnector.registerListener<RecordingEvent>(
      MOBIUS_EVENT_KEYS.RECORDING_EVENT_CREATED,
      this.handleRecordingCreatedEvent
    );
    this.sdkConnector.registerListener<RecordingEvent>(
      MOBIUS_EVENT_KEYS.RECORDING_EVENT_UPDATED,
      this.handleRecordingUpdatedEvent
    );
    this.sdkConnector.registerListener<RecordingEvent>(
      MOBIUS_EVENT_KEYS.RECORDING_EVENT_DELETED,
      this.handleRecordingDeletedEvent
    );
  }
}
