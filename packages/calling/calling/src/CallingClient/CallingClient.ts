/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import * as Media from '@webex/internal-media-core';
import {Mutex} from 'async-mutex';
import {filterMobiusUris, handleRegistrationErrors} from '../common/Utils';
import {ERROR_TYPE} from '../Errors/types';
import {LogContext, LOGGER} from '../Logger/types';
import SDKConnector from '../SDKConnector';
import {ClientRegionInfo, ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {IRegistration} from './registration/types';
import {Eventing} from '../Events/impl';
import {
  EVENT_KEYS,
  CallingClientEventTypes,
  MOBIUS_EVENT_KEYS,
  CallSessionEvent,
  SessionType,
} from '../Events/types';
import {
  MobiusDeviceId,
  MobiusStatus,
  IDeviceInfo,
  MobiusServers,
  WebexRequestPayload,
  HTTP_METHODS,
  ALLOWED_SERVICES,
  CallDirection,
  CallDetails,
  CorrelationId,
  IpInfo,
  RegionInfo,
  ServiceData,
  ServiceIndicator,
} from '../common/types';
import {ICallingClient, CallingClientConfig} from './types';
import {ICall, ICallManager} from './calling/types';
import log from '../Logger';
import {createRegistration} from './registration';
import {getCallManager} from './calling/callManager';
import {
  CALLING_CLIENT_FILE,
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DISCOVERY_URL,
  IP_ENDPOINT,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
  VALID_PHONE,
  GET_MOBIUS_SERVERS_UTIL,
  KEEPALIVE_UTIL,
  CALLS_CLEARED_HANDLER_UTIL,
} from './constants';
import {CallingClientError} from '../Errors';
import {REG_ACTION, METRIC_TYPE, METRIC_EVENT} from './metrics/types';

/**
 *
 */
export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private deviceInfo: IDeviceInfo = {};

  private mutex: Mutex;

  private registration: IRegistration;

  private callManager: ICallManager;

  private sdkConfig: CallingClientConfig | undefined;

  private primaryMobiusUris: string[];

  private backupMobiusUris: string[];

  public mediaEngine: typeof Media;

  /**
   * @param webex - A webex instance.
   * @param config - Config to start the CallingClient with.
   */
  constructor(webex: WebexSDK, config?: CallingClientConfig) {
    super();
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.mutex = new Mutex();
    this.webex = this.sdkConnector.getWebex();

    this.sdkConfig = config;
    const serviceData = this.sdkConfig?.serviceData?.indicator
      ? this.sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    const logLevel = this.sdkConfig?.logger?.level ? this.sdkConfig.logger.level : LOGGER.ERROR;
    this.validateServiceData(serviceData);

    this.registration = createRegistration(
      this.webex,
      serviceData,
      this.mutex,
      this.callingClientEmitter,
      logLevel
    );
    this.callManager = getCallManager(this.webex, serviceData.indicator);

    this.mediaEngine = Media;

    this.primaryMobiusUris = [];
    this.backupMobiusUris = [];

    this.registration.setStatus(MobiusStatus.DEFAULT);
    this.registerSessionsListener();

    log.setLogger(logLevel, CALLING_CLIENT_FILE);

    this.incomingCallListener();
    this.registerCallsClearedListener();
  }

  private callingClientEmitter = (
    event: EVENT_KEYS,
    deviceInfo?: IDeviceInfo,
    clientError?: CallingClientError
  ) => {
    switch (event) {
      case EVENT_KEYS.REGISTERED:
        if (deviceInfo) {
          this.emit(event, deviceInfo);
        }
        break;
      case EVENT_KEYS.UNREGISTERED:
      case EVENT_KEYS.RECONNECTED:
      case EVENT_KEYS.RECONNECTING:
        this.emit(event);
        break;
      case EVENT_KEYS.ERROR:
        if (clientError) {
          this.emit(event, clientError);
        }
        break;
      default:
        break;
    }
  };

  /**
   *  Returns active url.
   *
   * @returns Url - Active url of Mobius.
   */
  public getActiveMobiusUrl(): string {
    return this.registration.getActiveMobiusUrl();
  }

  /**
   * Validates service data object(indicator & domain) and throws
   * exception with a message indicating the reason for validation
   * failure.
   *
   * @param serviceData - Input service data to be validated.
   */
  private validateServiceData(serviceData: ServiceData) {
    if (!this.isValidServiceIndicator(serviceData.indicator)) {
      throw new Error(
        `Invalid service indicator, Allowed values are: ${Object.values(ServiceIndicator)}`
      );
    }

    if (!this.isValidServiceDomain(serviceData)) {
      throw new Error('Invalid service domain.');
    }
  }

  /**
   * Validates service indicator.
   *
   * @param indicator - Must match with one of the values in ServiceIndicator enum.
   * @returns True if validation is successful else false.
   */
  private isValidServiceIndicator(indicator: ServiceIndicator): boolean {
    return Object.values(ServiceIndicator).some((v) => v === indicator);
  }

  /**
   * Validates domain field in input service data object.
   * Domain value must be in valid domain format for service
   * type contactcenter.
   * But for service type calling it's allowed to be empty or
   * undefined however if it's not empty/undefined for service
   * type calling then even that will be validated to see if it
   * is in valid domain format.
   *
   * @param serviceData - .
   * @returns True if validation is successful else false.
   */
  private isValidServiceDomain(serviceData: ServiceData): boolean {
    const regexp = /^[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,6}$/i;
    const {domain} = serviceData;

    if (!domain) {
      return serviceData.indicator === ServiceIndicator.CALLING;
    }

    return regexp.test(domain);
  }

  /**
   * An Incoming Call listener.
   */
  private incomingCallListener() {
    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: this.incomingCallListener.name,
    };

    log.log('Listening for incoming calls... ', logContext);
    this.callManager.on(EVENT_KEYS.INCOMING_CALL, (callObj: ICall) => {
      this.emit(EVENT_KEYS.INCOMING_CALL, callObj);
    });
  }

  /**
   * Fetches countryCode and region of the client.
   */
  private async getClientRegionInfo(): Promise<RegionInfo> {
    const regionInfo = {} as RegionInfo;

    try {
      const temp = <WebexRequestPayload>await this.webex.request({
        uri: `${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}${IP_ENDPOINT}`,
        method: HTTP_METHODS.GET,
        headers: {
          [CISCO_DEVICE_URL]: this.webex.internal.device.url,
          [SPARK_USER_AGENT]: CALLING_USER_AGENT,
        },
        service: ALLOWED_SERVICES.MOBIUS,
      });

      const myIP = (temp.body as IpInfo).ipv4;
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${DISCOVERY_URL}/${myIP}`,
        method: HTTP_METHODS.GET,
        addAuthHeader: false,
        headers: {
          [SPARK_USER_AGENT]: null,
        },
      });

      const clientRegionInfo = response.body as ClientRegionInfo;

      regionInfo.clientRegion = clientRegionInfo?.clientRegion ? clientRegionInfo.clientRegion : '';

      regionInfo.countryCode = clientRegionInfo?.countryCode ? clientRegionInfo.countryCode : '';
    } catch (err: unknown) {
      handleRegistrationErrors(
        err as WebexRequestPayload,
        (clientError) => {
          this.registration.sendMetric(
            METRIC_EVENT.REGISTRATION_ERROR,
            REG_ACTION.REGISTER,
            METRIC_TYPE.BEHAVIORAL,
            clientError
          );
          this.emit(EVENT_KEYS.ERROR, clientError);
        },
        {method: GET_MOBIUS_SERVERS_UTIL, file: CALLING_CLIENT_FILE}
      );
      regionInfo.clientRegion = '';
      regionInfo.countryCode = '';
    }

    return regionInfo;
  }

  /**
   * Local method for finding the mobius servers.
   */
  private async getMobiusServers() {
    /* Following operations are performed in a synchronous way ->

    1. Get RegionInfo
    2. Get Mobius Server with that RegionInfo
    3. Check whether Mobius server was found without any error
    4. If there is error , we don't need to send registration
    5. Otherwise send registration
    */

    let useDefault = false;

    let clientRegion: string;
    let countryCode: string;

    if (this.sdkConfig?.discovery?.country && this.sdkConfig?.discovery?.region) {
      log.info('Updating region and country from the SDK config', {
        file: CALLING_CLIENT_FILE,
        method: GET_MOBIUS_SERVERS_UTIL,
      });
      clientRegion = this.sdkConfig?.discovery?.region;
      countryCode = this.sdkConfig?.discovery?.country;
    } else {
      log.info('Updating region and country through Region discovery', {
        file: CALLING_CLIENT_FILE,
        method: GET_MOBIUS_SERVERS_UTIL,
      });

      const regionInfo = await this.getClientRegionInfo();

      clientRegion = regionInfo.clientRegion;
      countryCode = regionInfo.countryCode;
    }

    if (clientRegion && countryCode) {
      log.log(
        `Found Region: ${clientRegion} and country: ${countryCode}, going to fetch Mobius server`,
        '' as LogContext
      );

      try {
        const temp = <WebexRequestPayload>await this.webex.request({
          uri: `${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}?regionCode=${clientRegion}&countryCode=${countryCode}`,
          method: HTTP_METHODS.GET,
          headers: {
            [CISCO_DEVICE_URL]: this.webex.internal.device.url,
            [SPARK_USER_AGENT]: CALLING_USER_AGENT,
          },
          service: ALLOWED_SERVICES.MOBIUS,
        });

        log.log('Mobius Server found for the region', '' as LogContext);
        const mobiusServers = temp.body as MobiusServers;

        /* update arrays of Mobius Uris. */
        const mobiusUris = filterMobiusUris(
          mobiusServers,
          this.webex.internal.services._serviceUrls.mobius
        );
        this.primaryMobiusUris = mobiusUris.primary;
        this.backupMobiusUris = mobiusUris.backup;
        log.info(
          `Final list of Mobius Servers, primary: ${mobiusUris.primary} and backup: ${mobiusUris.backup}`,
          '' as LogContext
        );
      } catch (err: unknown) {
        handleRegistrationErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.registration.sendMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              clientError
            );
            this.emit(EVENT_KEYS.ERROR, clientError);
          },
          {method: GET_MOBIUS_SERVERS_UTIL, file: CALLING_CLIENT_FILE}
        );

        useDefault = true;
      }
    } else {
      /* Setting this to true because region info is possibly undefined */
      useDefault = true;
    }

    /* Use a default URL if Mobius discovery fails either because of region info failure
     * or because the discovered Mobius couldn't be reached
     */

    if (useDefault) {
      log.warn('Error in finding Mobius Servers. Will use the default URL.', '' as LogContext);
      this.primaryMobiusUris = [
        `${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`,
      ];
    }
  }

  /**
   * Request for the Device status.
   *
   * @param deviceInfo - Registered device Object.
   * @returns Promise.
   */
  public async sendKeepAlive(deviceInfo: IDeviceInfo): Promise<void> {
    const deviceId = deviceInfo.device?.deviceId as string;
    const interval = deviceInfo.keepaliveInterval as number;
    const url = deviceInfo.device?.uri as string;

    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: KEEPALIVE_UTIL,
    };

    this.registration.clearKeepaliveTimer();

    log.info(
      `Fetched details :-> deviceId: ${deviceId}, interval :-> ${interval}, url: ${url}`,
      logContext
    );

    if (this.registration.isDeviceRegistered()) {
      this.registration.startKeepaliveTimer(url, interval);
    } else {
      log.warn('Device is not active, exiting.', logContext);
    }
  }

  /**
   * Registers a listener/handler for ALL_CALLS_CLEARED
   * event emitted by callManager when all the calls
   * present on sdk are cleaned up.
   */
  private registerCallsClearedListener() {
    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: this.registerCallsClearedListener.name,
    };

    log.log('Registering listener for all calls cleared event', logContext);
    this.callManager.on(EVENT_KEYS.ALL_CALLS_CLEARED, this.callsClearedHandler);
  }

  /**
   * Handler registered for ALL_CALLS_CLEARED event emitted by callManager.
   *
   * If re-register attempt was deferred earlier due to active call(s), then it
   * will be attempted here on receiving a notification from callManager that all
   * calls are cleaned up.
   */
  private callsClearedHandler = async () => {
    if (!this.registration.isDeviceRegistered()) {
      await this.mutex.runExclusive(async () => {
        if (this.registration.isReconnectPending()) {
          log.log('All calls cleared, reconnecting', {
            file: CALLING_CLIENT_FILE,
            method: CALLS_CLEARED_HANDLER_UTIL,
          });
          await this.registration.reconnectOnFailure(CALLS_CLEARED_HANDLER_UTIL);
        }
      });
    }
  };

  /**
   * Wrapper to for device registration.
   *
   * @param retry - Retry in case of errors.
   */
  public async register() {
    await this.mutex.runExclusive(async () => {
      this.registration.setStatus(MobiusStatus.DEFAULT);
      this.emit(EVENT_KEYS.CONNECTING);

      /* Don't do a discovery if we already have the servers list */
      if (this.primaryMobiusUris.length === 0) {
        await this.getMobiusServers();
      }

      this.registration.setMobiusServers(this.primaryMobiusUris, this.backupMobiusUris);
      await this.registration.triggerRegistration();
    });
  }

  /**
   * To get the current log Level.
   *
   * @returns - Log level.
   */
  public getLoggingLevel(): LOGGER {
    return log.getLogLevel();
  }

  /**
   *  Setter for Mobius Url.
   *
   * @param uri - Active Mobius Url.
   */
  public setActiveMobiusUrl(uri: string) {
    /* Update the url in CallManager so that the Call Object can access it */
    this.callManager.updateActiveMobius(uri);
    this.registration.setActiveMobiusUrl(uri);
  }

  /**
   * Wrapper to for device  deregister.
   */
  public async deregister() {
    this.registration.deregister();
  }

  /**
   *
   */
  public getRegistrationStatus = (): MobiusStatus => this.registration.getStatus();

  /**
   *
   */
  public getDeviceId = (): MobiusDeviceId | undefined =>
    this.registration.getDeviceInfo().device?.deviceId;

  /**
   * @param callId -.
   * @param correlationId -.
   */
  public getCall = (correlationId: CorrelationId): ICall => {
    return this.callManager.getCall(correlationId);
  };

  /**
   * @param dest -.
   */
  public makeCall = (dest: CallDetails): ICall | undefined => {
    let call;

    if (dest) {
      const match = dest.address.match(VALID_PHONE);

      if (match && match[0].length === dest.address.length) {
        const sanitizedNumber = dest.address.replace(/[^[*+]\d#]/gi, '').replace(/\s+/gi, '');
        const formattedDest = {
          type: dest.type,
          address: `tel:${sanitizedNumber}`,
        };

        call = this.callManager.createCall(
          formattedDest,
          CallDirection.OUTBOUND,
          this.registration.getDeviceInfo().device?.deviceId as string
        );
        log.log(`New call created, callId: ${call.getCallId()}`, {});
      } else {
        log.warn('Invalid phone number detected', {});
        const err = new CallingClientError(
          'An invalid phone number was detected. Check the number and try again.',
          {},
          ERROR_TYPE.CALL_ERROR,
          MobiusStatus.ACTIVE
        );

        this.emit(EVENT_KEYS.ERROR, err);
      }

      return call;
    }

    return undefined;
  };

  /**
   *
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }

  /**
   *
   */
  private registerSessionsListener() {
    this.sdkConnector.registerListener<CallSessionEvent>(
      MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE,
      async (event?: CallSessionEvent) => {
        if (event && event.data.userSessions.userSessions) {
          const sessionArr = event?.data.userSessions.userSessions;

          if (sessionArr.length === 1) {
            if (sessionArr[0].sessionType !== SessionType.WEBEX_CALLING) {
              return;
            }
          }

          for (let i = 0; i < sessionArr.length; i += 1) {
            if (sessionArr[i].sessionType !== SessionType.WEBEX_CALLING) {
              sessionArr.splice(i, 1);
            }
          }
          this.emit(EVENT_KEYS.USER_SESSION_INFO, event as CallSessionEvent);
        }
      }
    );
  }
}

/**
 * @param webex - A webex instance.
 * @param config - Config to start the CallingClient with..
 */
export const createClient = (webex: WebexSDK, config?: CallingClientConfig): ICallingClient =>
  new CallingClient(webex, config);
