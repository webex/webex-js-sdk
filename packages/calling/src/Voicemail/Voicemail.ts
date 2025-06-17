/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
import ExtendedError from 'Errors/catalog/ExtendedError';
import {METHOD_START_MESSAGE} from '../common/constants';
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {IVoicemail, VoicemailResponseEvent, LoggerInterface, CallingPartyInfo} from './types';
import {CALLING_BACKEND, DisplayInformation, SORT} from '../common/types';
import log from '../Logger';
import {getCallingBackEnd, uploadLogs} from '../common/Utils';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {VoicemailEventTypes} from '../Events/types';
import {Eventing} from '../Events/impl';
import {UcmBackendConnector} from './UcmBackendConnector';
import {IMetricManager, METRIC_EVENT, METRIC_TYPE, VOICEMAIL_ACTION} from '../Metrics/types';
import {getMetricManager} from '../Metrics';
import {VOICEMAIL_FILE, METHODS} from './constants';

/**
 * The `Voicemail` module is designed to simplify voicemail-related operations by offering a set of APIs.
 *
 * The following code snippet demonstrates how to create an instance of `Voicemail` using a `webex` instance and a logger:
 *
 * Example:
 * ```javascript
 * const voicemailInstance = createVoicemailClient(webex, logger);
 * ```
 */
export class Voicemail extends Eventing<VoicemailEventTypes> implements IVoicemail {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private callingBackend: CALLING_BACKEND;

  private backendConnector!: IVoicemail;

  private metricManager: IMetricManager;

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
    this.metricManager = getMetricManager(this.webex, undefined);
    this.callingBackend = getCallingBackEnd(this.webex);
    this.initializeBackendConnector();
    log.setLogger(logger.level, VOICEMAIL_FILE);
  }

  /**
   * Voicemail connector initialization.
   *
   */
  public async init() {
    try {
      log.info(METHOD_START_MESSAGE, {
        file: VOICEMAIL_FILE,
        method: METHODS.INIT,
      });

      const response = this.backendConnector.init();

      log.log('Voicemail connector initialized successfully', {
        file: VOICEMAIL_FILE,
        method: METHODS.INIT,
      });

      return response;
    } catch (err: unknown) {
      const extendedError = new Error(`Failed to initialize voicemail: ${err}`) as ExtendedError;
      log.error(extendedError, {
        file: VOICEMAIL_FILE,
        method: METHODS.INIT,
      });

      await uploadLogs();

      throw err;
    }
  }

  /**
   * Setup and initialize the voicemail backend connector class object.
   */
  private initializeBackendConnector() {
    log.info(METHOD_START_MESSAGE, {
      file: VOICEMAIL_FILE,
      method: METHODS.INITIALIZE_BACKEND_CONNECTOR,
    });

    switch (this.callingBackend) {
      case CALLING_BACKEND.WXC: {
        this.backendConnector = new WxCallBackendConnector(this.webex, this.logger);
        break;
      }

      case CALLING_BACKEND.BWRKS: {
        this.backendConnector = new BroadworksBackendConnector(this.webex, this.logger);
        break;
      }

      case CALLING_BACKEND.UCM: {
        this.backendConnector = new UcmBackendConnector(this.webex, this.logger);
        break;
      }

      default: {
        throw new Error('Calling backend is not identified, exiting....');
      }
    }
  }

  /**
   * @param response - VoicemailResponseEvent to be used in submitting metric.
   * @param metricAction - Action for the metric being submitted.
   * @param messageId - Message identifier of the voicemail message.
   */
  private submitMetric(response: VoicemailResponseEvent, metricAction: string, messageId?: string) {
    const {
      statusCode,
      data: {error: errorMessage},
    } = response;

    if (statusCode >= 200 && statusCode < 300) {
      this.metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL,
        metricAction,
        METRIC_TYPE.BEHAVIORAL,
        messageId
      );
    } else {
      this.metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL_ERROR,
        metricAction,
        METRIC_TYPE.BEHAVIORAL,
        messageId,
        errorMessage,
        statusCode
      );
    }
  }

  /**
   * Retrieves a list of voicemails with optional pagination and sorting options.
   *
   * @param offset - Number of records to skip.
   * @param offsetLimit - The limit on the number of voicemails to retrieve from the offset.
   * @param sort - Sort voicemail list (ASC | DESC).
   * @param refresh - Set to `true` to force a refresh of voicemail data from backend (optional).
   */
  public async getVoicemailList(
    offset: number,
    offsetLimit: number,
    sort: SORT,
    refresh?: boolean
  ): Promise<VoicemailResponseEvent> {
    try {
      log.info(
        `${METHOD_START_MESSAGE} with: offset=${offset}, limit=${offsetLimit}, sort=${sort}, refresh=${refresh}`,
        {
          file: VOICEMAIL_FILE,
          method: METHODS.GET_VOICEMAIL_LIST,
        }
      );

      const response = await this.backendConnector.getVoicemailList(
        offset,
        offsetLimit,
        sort,
        refresh
      );

      this.submitMetric(response, VOICEMAIL_ACTION.GET_VOICEMAILS);

      log.log(`Successfully retrieved voicemail list: statusCode=${response.statusCode}`, {
        file: VOICEMAIL_FILE,
        method: METHODS.GET_VOICEMAIL_LIST,
      });

      return response;
    } catch (err: unknown) {
      const extendedError = new Error(`Failed to get voicemail list: ${err}`) as ExtendedError;
      log.error(extendedError, {
        file: VOICEMAIL_FILE,
        method: METHODS.GET_VOICEMAIL_LIST,
      });

      await uploadLogs();

      throw err;
    }
  }

  /**
   * Retrieves the content of a voicemail message based on its messageId.
   *
   * @param messageId - The identifier of the voicemail message.
   */
  public async getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent> {
    log.info(`${METHOD_START_MESSAGE} with: messageId=${messageId}`, {
      file: VOICEMAIL_FILE,
      method: METHODS.GET_VOICEMAIL_CONTENT,
    });

    const response = await this.backendConnector.getVoicemailContent(messageId);

    this.submitMetric(response, VOICEMAIL_ACTION.GET_VOICEMAIL_CONTENT, messageId);

    log.log(
      `Successfully retrieved voicemail content for messageId=${messageId}, statusCode=${response.statusCode}`,
      {
        file: VOICEMAIL_FILE,
        method: METHODS.GET_VOICEMAIL_CONTENT,
      }
    );

    return response;
  }

  /**
   * Retrieves a quantitative summary of voicemails for a user.
   *
   */
  public async getVoicemailSummary(): Promise<VoicemailResponseEvent | null> {
    log.info(METHOD_START_MESSAGE, {
      file: VOICEMAIL_FILE,
      method: METHODS.GET_VOICEMAIL_SUMMARY,
    });

    const response = await this.backendConnector.getVoicemailSummary();

    /* istanbul ignore else */
    if (response !== null) {
      this.submitMetric(response, VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY);

      log.log(`Successfully retrieved voicemail summary: statusCode=${response.statusCode}`, {
        file: VOICEMAIL_FILE,
        method: METHODS.GET_VOICEMAIL_SUMMARY,
      });
    }

    return response;
  }

  /**
   * Fetch voicemail read message status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   */
  public async voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent> {
    log.info(`${METHOD_START_MESSAGE} with: messageId=${messageId}`, {
      file: VOICEMAIL_FILE,
      method: METHODS.VOICEMAIL_MARK_AS_READ,
    });

    const response = await this.backendConnector.voicemailMarkAsRead(messageId);

    this.submitMetric(response, VOICEMAIL_ACTION.MARK_READ, messageId);

    log.log(
      `Successfully marked voicemail as read: messageId=${messageId}, statusCode=${response.statusCode}`,
      {
        file: VOICEMAIL_FILE,
        method: METHODS.VOICEMAIL_MARK_AS_READ,
      }
    );

    return response;
  }

  /**
   * Fetch voicemail unread status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   */
  public async voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent> {
    log.info(`${METHOD_START_MESSAGE} with: messageId=${messageId}`, {
      file: VOICEMAIL_FILE,
      method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
    });

    const response = await this.backendConnector.voicemailMarkAsUnread(messageId);

    this.submitMetric(response, VOICEMAIL_ACTION.MARK_UNREAD, messageId);

    log.log(
      `Successfully marked voicemail as unread: messageId=${messageId}, statusCode=${response.statusCode}`,
      {
        file: VOICEMAIL_FILE,
        method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
      }
    );

    return response;
  }

  /**
   * Fetch voicemail delete status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   */
  public async deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent> {
    log.info(`${METHOD_START_MESSAGE} with: messageId=${messageId}`, {
      file: VOICEMAIL_FILE,
      method: METHODS.DELETE_VOICEMAIL,
    });

    const response = await this.backendConnector.deleteVoicemail(messageId);

    this.submitMetric(response, VOICEMAIL_ACTION.DELETE, messageId);

    log.log(
      `Successfully deleted voicemail: messageId=${messageId}, statusCode=${response.statusCode}`,
      {
        file: VOICEMAIL_FILE,
        method: METHODS.DELETE_VOICEMAIL,
      }
    );

    return response;
  }

  /**
   * Fetch the voicemail transcripts for the messageId.
   *
   * @param messageId - MessageId for which we need the transcript.
   */
  public async getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null> {
    log.info(`${METHOD_START_MESSAGE} with: messageId=${messageId}`, {
      file: VOICEMAIL_FILE,
      method: METHODS.GET_VM_TRANSCRIPT,
    });

    const response = await this.backendConnector.getVMTranscript(messageId);

    if (response !== null) {
      this.submitMetric(response, VOICEMAIL_ACTION.TRANSCRIPT, messageId);

      log.log(
        `Successfully retrieved voicemail transcript: messageId=${messageId}, statusCode=${response.statusCode}`,
        {
          file: VOICEMAIL_FILE,
          method: METHODS.GET_VM_TRANSCRIPT,
        }
      );
    }

    return response;
  }

  /**
   * Resolve the Contact from userId or display name.
   *
   * @param callingPartyInfo - Calling Party Info.
   */
  public resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null> {
    log.info(METHOD_START_MESSAGE, {
      file: VOICEMAIL_FILE,
      method: METHODS.RESOLVE_CONTACT,
    });

    const response = this.backendConnector.resolveContact(callingPartyInfo);

    log.log('Contact resolution completed successfully', {
      file: VOICEMAIL_FILE,
      method: METHODS.RESOLVE_CONTACT,
    });

    return response;
  }

  /**
   * SDK connector function.
   * @ignore
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }
}

/**
 * @param webex - webex instance
 * @param logger - logger instance
 */
export const createVoicemailClient = (webex: WebexSDK, logger: LoggerInterface): IVoicemail =>
  new Voicemail(webex, logger);
