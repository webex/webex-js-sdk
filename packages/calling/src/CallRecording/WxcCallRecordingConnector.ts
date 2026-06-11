/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {ALLOWED_SERVICES, HTTP_METHODS, WebexRequestPayload} from '../common/types';
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
  GetRecordingsOptions,
  ICallRecording,
  LoggerInterface,
  Recording,
  RecordingDeleteResponse,
  RecordingListBody,
  RecordingListResponse,
  RecordingMetadata,
  RecordingMetadataResponse,
  RecordingResponse,
} from './types';
import {
  CALL_RECORDING_FILE,
  CONVERGED_RECORDINGS,
  DEFAULT_MAX,
  DEFAULT_NUMBER_OF_DAYS,
  DEFAULT_STATUS,
  FORMAT,
  FROM,
  LOCATION_ID,
  MAX,
  METADATA,
  METHODS,
  OWNER_TYPE,
  RECORDING_NOT_FOUND_MESSAGE,
  SERVICE_TYPE,
  STATUS,
  STORAGE_REGION,
  TO,
  TOPIC,
  WEBEX_USER_REQUEST_HEADER,
} from './constants';

/**
 * Webex Calling (WXC) backend connector for Post Call Recording.
 *
 * Owns everything backend-specific for the Webex Calling cloud `convergedRecordings` capability:
 * resolving the hydra developer API base URL from the u2c catalog, the REST read/delete calls, and
 * subscribing to the `convergedRecordings.*` Mercury events (re-emitting them as typed
 * `callRecording:*` events). The {@link CallRecording} facade selects this connector when the
 * resolved calling backend is WXC.
 */
export class WxcCallRecordingConnector
  extends Eventing<CallRecordingEventTypes>
  implements ICallRecording
{
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private recordingServiceUrl: string;

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

    // Resolve the Post Call Recording base URL (hydra developer API) directly from the u2c
    // service catalog. The catalog is populated by the host SDK's service discovery, so no
    // dedicated recording plugin is required.
    this.recordingServiceUrl =
      this.webex.internal.services._serviceUrls?.hydraDeveloperApi ||
      this.webex.internal.services.get(
        this.webex.internal.services._activeServices?.hydraDeveloperApi as string
      );

    this.registerRecordingListeners();
    log.setLogger(logger.level, CALL_RECORDING_FILE);
  }

  /**
   * Builds the `convergedRecordings` collection URL with the list query parameters.
   *
   * The converged recordings API only returns results when the request is bounded by BOTH a
   * `from` and a `to` timestamp, so this method always sends both (a `from`-only request comes
   * back empty). When the caller does not supply an explicit `from`, it is derived from the
   * `days` lookback (`now - days`, default {@link DEFAULT_NUMBER_OF_DAYS}); when `to` is omitted
   * it defaults to the current time (`now`). `status` and `max` default to `available` and `30`.
   * The remaining filters (`serviceType`, `format`, `ownerType`, `storageRegion`, `locationId`,
   * `topic`) are pass-through and only appended when the caller provides them.
   *
   * @param options - Optional time window/filtering/pagination from {@link GetRecordingsOptions}.
   * @returns The fully-qualified request URL.
   */
  private buildRecordingsUrl(options?: GetRecordingsOptions): string {
    const params = new URLSearchParams();

    let fromDate = options?.from;
    if (!fromDate) {
      const date = new Date();
      date.setDate(date.getDate() - (options?.days ?? DEFAULT_NUMBER_OF_DAYS));
      fromDate = date.toISOString();
    }
    const toDate = options?.to ?? new Date().toISOString();

    params.append(FROM, fromDate);
    params.append(TO, toDate);
    params.append(STATUS, options?.status ?? DEFAULT_STATUS);
    params.append(MAX, `${options?.max ?? DEFAULT_MAX}`);

    // Optional pass-through filters: only sent when the caller provides them so the API can apply
    // its own defaults for any that are omitted.
    const optionalParams: Array<[string, string | undefined]> = [
      [SERVICE_TYPE, options?.serviceType],
      [FORMAT, options?.format],
      [OWNER_TYPE, options?.ownerType],
      [STORAGE_REGION, options?.storageRegion],
      [LOCATION_ID, options?.locationId],
      [TOPIC, options?.topic],
    ];
    optionalParams.forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });

    return `${this.recordingServiceUrl}/${CONVERGED_RECORDINGS}?${params.toString()}`;
  }

  /**
   * Builds optional request headers. Adds the `WebexUserRequest` header only when explicitly
   * requested (ad-hoc rate-limit bypass).
   *
   * @param webexUserRequest - When true, includes the `WebexUserRequest: true` header.
   * @returns A headers object, or undefined when no extra headers are needed.
   */
  private buildHeaders(webexUserRequest?: boolean): {[key: string]: string} | undefined {
    if (webexUserRequest) {
      return {[WEBEX_USER_REQUEST_HEADER]: 'true'};
    }

    return undefined;
  }

  /**
   * Fetches the converged recordings for the current user.
   * @param options - Optional filters and pagination parameters.
   */
  public async getRecordings(options?: GetRecordingsOptions): Promise<RecordingListResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDINGS,
    };

    log.info(
      `${METHOD_START_MESSAGE} with options=${JSON.stringify(options ?? {})}`,
      loggerContext
    );

    try {
      const url = this.buildRecordingsUrl(options);

      const response = <WebexRequestPayload>await this.webex.request({
        uri: url,
        method: HTTP_METHODS.GET,
        service: ALLOWED_SERVICES.HYDRA_DEVELOPER_API,
        headers: this.buildHeaders(options?.webexUserRequest),
      });

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const body = (response.body ?? {}) as RecordingListBody;

      const responseDetails: RecordingListResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          recordings: body.items ?? [],
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(
        `Successfully retrieved ${responseDetails.data.recordings?.length ?? 0} recordings`,
        loggerContext
      );

      return responseDetails;
    } catch (err: unknown) {
      log.error(`Failed to get recordings: ${JSON.stringify(err)}`, loggerContext);
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(errorInfo, loggerContext) as Promise<RecordingListResponse>;
    }
  }

  /**
   * Fetches a single converged recording by its id.
   * @param recordingId - The recording id (`id`).
   */
  public async getRecording(recordingId: string): Promise<RecordingResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDING,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const url = `${this.recordingServiceUrl}/${CONVERGED_RECORDINGS}/${recordingId}`;

      const response = <WebexRequestPayload>await this.webex.request({
        uri: url,
        method: HTTP_METHODS.GET,
        service: ALLOWED_SERVICES.HYDRA_DEVELOPER_API,
      });

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const responseDetails: RecordingResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          recording: response.body as Recording,
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully retrieved recording ${recordingId}`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(`Failed to get recording: ${JSON.stringify(err)}`, loggerContext);
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
   * to {@link getRecordings} to let callers widen the time window/status/page when the target
   * session may fall outside the defaults.
   *
   * @param callSessionId - The call session id to filter by.
   * @param options - Optional list query forwarded to {@link getRecordings} to control the
   *   set of recordings scanned before filtering.
   */
  public async getRecordingsByCallSessionId(
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
  public async getRecordingMetadata(recordingId: string): Promise<RecordingMetadataResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.GET_RECORDING_METADATA,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const url = `${this.recordingServiceUrl}/${CONVERGED_RECORDINGS}/${recordingId}/${METADATA}`;

      const response = <WebexRequestPayload>await this.webex.request({
        uri: url,
        method: HTTP_METHODS.GET,
        service: ALLOWED_SERVICES.HYDRA_DEVELOPER_API,
      });

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const responseDetails: RecordingMetadataResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {
          metadata: response.body as RecordingMetadata,
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully retrieved metadata for recording ${recordingId}`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(`Failed to get recording metadata: ${JSON.stringify(err)}`, loggerContext);
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(
        errorInfo,
        loggerContext
      ) as Promise<RecordingMetadataResponse>;
    }
  }

  /**
   * Permanently deletes a single recording. Per the API the recording cannot be recovered.
   * @param recordingId - The recording id (`id`) to delete.
   * @param options - Optional `reason`/`comment`, only required for Compliance Officer deletions.
   */
  public async deleteRecording(
    recordingId: string,
    options?: DeleteRecordingOptions
  ): Promise<RecordingDeleteResponse> {
    const loggerContext = {
      file: CALL_RECORDING_FILE,
      method: METHODS.DELETE_RECORDING,
    };

    log.info(`${METHOD_START_MESSAGE} with recordingId=${recordingId}`, loggerContext);

    try {
      const url = `${this.recordingServiceUrl}/${CONVERGED_RECORDINGS}/${recordingId}`;

      const body: DeleteRecordingOptions = {};
      if (options?.reason) {
        body.reason = options.reason;
      }
      if (options?.comment) {
        body.comment = options.comment;
      }

      const response = <WebexRequestPayload>await this.webex.request({
        uri: url,
        method: HTTP_METHODS.DELETE,
        service: ALLOWED_SERVICES.HYDRA_DEVELOPER_API,
        ...(Object.keys(body).length > 0 ? {body} : {}),
      });

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const responseDetails: RecordingDeleteResponse = {
        statusCode: Number(response.statusCode) || SUCCESS_STATUS_CODE,
        data: {},
        message: SUCCESS_MESSAGE,
      };

      log.log(`Successfully deleted recording ${recordingId}`, loggerContext);

      return responseDetails;
    } catch (err: unknown) {
      log.error(`Failed to delete recording: ${JSON.stringify(err)}`, loggerContext);
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;

      return serviceErrorCodeHandler(errorInfo, loggerContext) as Promise<RecordingDeleteResponse>;
    }
  }

  handleRecordingCreatedEvent = async (event?: RecordingEvent) => {
    if (event?.data?.activity) {
      this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, event as RecordingEvent);
    }
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
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, event as RecordingEvent);
        break;

      case RECORDING_EVENT_SUBTYPE.RESTORE:
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, event as RecordingEvent);
        break;

      default:
        this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, event as RecordingEvent);
    }
  };

  handleRecordingDeletedEvent = async (event?: RecordingEvent) => {
    if (event?.data?.activity) {
      this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, event as RecordingEvent);
    }
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
