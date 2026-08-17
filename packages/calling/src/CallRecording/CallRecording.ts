/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {CALLING_BACKEND} from '../common/types';
import log from '../Logger';
import {getCallingBackEnd} from '../common/Utils';
import {METHOD_START_MESSAGE} from '../common/constants';
import {CallRecordingEventTypes, COMMON_EVENT_KEYS, RecordingEvent} from '../Events/types';
import {Eventing} from '../Events/impl';
import {
  DeleteRecordingOptions,
  GetCallRecordingRequest,
  ICallRecording,
  LoggerInterface,
  RecordingDeleteResponse,
  RecordingResponseFor,
} from './types';
import {WxcCallRecordingConnector} from './WxcCallRecordingConnector';
import {CALL_RECORDING_FILE, METHODS} from './constants';

/**
 * `CallRecording` is the backend-agnostic facade for Post Call Recording. It selects a
 * backend-specific connector based on the resolved calling backend and delegates all read/delete
 * operations to it, while re-emitting the connector's recording lifecycle events.
 *
 * Post Call Recording (`convergedRecordings`) is a Webex Calling cloud capability, so only the
 * Webex Calling (WXC) backend is supported today; other backends (BWRKS/UCM/INVALID) are rejected,
 * following the same convention used by the Voicemail client. Adding support for another backend is
 * a matter of dropping in a new connector and a `case` here — no consumer-facing changes required.
 *
 * @example
 * ```javascript
 * const callRecording = createCallRecordingClient(webex, logger);
 * ```
 */
export class CallRecording extends Eventing<CallRecordingEventTypes> implements ICallRecording {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private callingBackend: CALLING_BACKEND;

  private backendConnector!: ICallRecording;

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, public logger: LoggerInterface) {
    super();
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();

    this.callingBackend = getCallingBackEnd(this.webex);
    this.initializeBackendConnector();
    this.forwardRecordingEvents();
    log.setLogger(logger.level, CALL_RECORDING_FILE);
  }

  /**
   * Sets up the backend-specific recording connector based on the resolved calling backend.
   */
  private initializeBackendConnector() {
    log.info(METHOD_START_MESSAGE, {
      file: CALL_RECORDING_FILE,
      method: METHODS.INITIALIZE_BACKEND_CONNECTOR,
    });

    switch (this.callingBackend) {
      case CALLING_BACKEND.WXC: {
        this.backendConnector = new WxcCallRecordingConnector(this.webex, this.logger);
        break;
      }

      default: {
        throw new Error('Calling backend is not identified, exiting....');
      }
    }
  }

  /**
   * Re-emits the active connector's recording lifecycle events as facade events so consumers can
   * subscribe on the `CallRecording` instance regardless of the underlying backend.
   */
  private forwardRecordingEvents() {
    this.backendConnector.on(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, (event: RecordingEvent) =>
      this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, event)
    );
    this.backendConnector.on(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, (event: RecordingEvent) =>
      this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, event)
    );
    this.backendConnector.on(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, (event: RecordingEvent) =>
      this.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, event)
    );
  }

  /**
   * Reads Post Call Recordings, delegating to the active backend connector. The operation is
   * selected by the request `type` and the response type is inferred per request.
   * @param request - The discriminated read request.
   */
  public getCallRecording<T extends GetCallRecordingRequest>(
    request: T
  ): Promise<RecordingResponseFor<T>> {
    return this.backendConnector.getCallRecording(request);
  }

  /**
   * Moves a single recording to the recycle bin (soft delete) via
   * `POST /convergedRecordings/softDelete`. Requires `spark:recordings_write` on the access token;
   * the recording can be restored from the recycle bin via the platform restore API.
   * @param recordingId - The recording id (`id`) to move to the recycle bin.
   * @param options - Deprecated. Ignored (compliance permanent delete is not exposed).
   */
  public async deleteRecording(
    recordingId: string,
    options?: DeleteRecordingOptions
  ): Promise<RecordingDeleteResponse> {
    return this.backendConnector.deleteRecording(recordingId, options);
  }
}

/**
 * Creates a `CallRecording` client instance for accessing Post Call Recording APIs.
 *
 * @param {WebexSDK} webex - `Webex SDK` instance.
 * @param {LoggerInterface} logger - An instance implementing LoggerInterface used to set the log level for the module.
 */
export const createCallRecordingClient = (
  webex: WebexSDK,
  logger: LoggerInterface
): ICallRecording => new CallRecording(webex, logger);
