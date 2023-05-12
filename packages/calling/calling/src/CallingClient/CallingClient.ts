/* eslint-disable no-underscore-dangle */
import * as Media from '@webex/internal-media-core';
import {Mutex} from 'async-mutex';
import {emitFinalFailure, handleErrors} from '../common/Utils';
import {createClientError} from '../Errors/catalog/CallingDeviceError';
import {ERROR_CODE, ERROR_TYPE} from '../Errors/types';
import {LogContext, LOGGER} from '../Logger/types';
import SDKConnector from '../SDKConnector';
import {ClientRegionInfo, ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {IRegistrationClient} from './registration/types';
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
  BASE_REG_RETRY_TIMER_VAL_IN_SEC,
  BASE_REG_TIMER_MFACTOR,
  CALLING_CLIENT_FILE,
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DISCOVERY_URL,
  IP_ENDPOINT,
  SEC_TO_MSEC_MFACTOR,
  NETWORK_FLAP_TIMEOUT,
  REG_RANDOM_T_FACTOR_UPPER_LIMIT,
  REG_TRY_BACKUP_TIMER_VAL_IN_SEC,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
  VALID_PHONE,
  DEFAULT_REHOMING_INTERVAL_MIN,
  DEFAULT_REHOMING_INTERVAL_MAX,
  MINUTES_TO_SEC_MFACTOR,
  REG_FAILBACK_429_MAX_RETRIES,
  REGISTER_UTIL,
  GET_MOBIUS_SERVERS_UTIL,
  KEEPALIVE_UTIL,
  FAILBACK_UTIL,
  FAILBACK_429_RETRY_UTIL,
  FAILOVER_UTIL,
  NETWORK_CHANGE_DETECTION_UTIL,
  CALLS_CLEARED_HANDLER_UTIL,
  RECONNECT_UTIL,
} from './constants';
import {CallingClientError} from '../Errors';
import {REG_ACTION, IMetricManager, METRIC_TYPE, METRIC_EVENT} from './metrics/types';
import {getMetricManager} from './metrics';

/**
 *
 */
export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private mobiusServers: MobiusServers | undefined;

  private url!: string;

  private deviceInfo: IDeviceInfo = {};

  private keepaliveTimer: NodeJS.Timer | undefined;

  private failbackTimer?: NodeJS.Timer;

  private registerRetry = false;

  private mutex: Mutex;

  private rehomingIntervalMin: number;

  private rehomingIntervalMax: number;

  private failback429RetryAttempts: number;

  /**
   *
   */
  public getDeviceInfo(): IDeviceInfo {
    return this.deviceInfo;
  }

  /**
   * .
   *
   * @param value -.
   */
  public setDeviceInfo(value: IDeviceInfo) {
    this.deviceInfo = value;
  }

  /**
   * @returns The value of instance variable registerRetry.
   *          Indicates whether the calling client is in a mode
   *          to retry registration.
   */
  public isRegRetry(): boolean {
    return this.registerRetry;
  }

  /**
   * .
   *
   * @returns True if this device is in registered state
   *          by checking if isRegistered state is set to
   *          ACTIVE, else false.
   */
  public isDeviceRegistered(): boolean {
    return this.isRegistered === MobiusStatus.ACTIVE;
  }

  /**
   * .
   *
   * @param value - Sets the received value in instance variable
   *                registerRetry for registration retry cases.
   */
  public setRegRetry(value: boolean) {
    this.registerRetry = value;
  }

  private registration: IRegistrationClient;

  private clientError: CallingClientError;

  private callManager: ICallManager;

  private isRegistered: MobiusStatus;

  private sdkConfig: CallingClientConfig | undefined;

  private primaryMobiusUris: string[];

  private backupMobiusUris: string[];

  private metricManager: IMetricManager;

  private reconnectPending: boolean;

  /**
   * .
   *
   * @param value -.
   */
  public setIsRegistered(value: MobiusStatus) {
    this.isRegistered = value;
  }

  /**
   *  Returns active url.
   *
   * @returns Url - Active url of Mobius.
   */
  public getMobiusUrl(): string {
    return this.url;
  }

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

    this.webex = this.sdkConnector.getWebex();

    this.sdkConfig = config;
    const serviceData = this.sdkConfig?.serviceData?.indicator
      ? this.sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    this.validateServiceData(serviceData);

    this.registration = createRegistration(this.webex, serviceData);
    this.callManager = getCallManager(this.webex, serviceData.indicator);
    this.metricManager = getMetricManager(this.webex, serviceData.indicator);

    this.mediaEngine = Media;
    this.primaryMobiusUris = [];
    this.backupMobiusUris = [];
    this.rehomingIntervalMin = DEFAULT_REHOMING_INTERVAL_MIN;
    this.rehomingIntervalMax = DEFAULT_REHOMING_INTERVAL_MAX;
    this.failback429RetryAttempts = 0;
    this.clientError = createClientError('', {}, ERROR_TYPE.DEFAULT, MobiusStatus.DEFAULT);
    this.isRegistered = MobiusStatus.DEFAULT;
    this.reconnectPending = false;
    this.registerSessionsListener();
    const logLevel = this.sdkConfig?.logger?.level ? this.sdkConfig.logger.level : LOGGER.ERROR;

    this.mutex = new Mutex();
    log.setLogger(logLevel);
    /* Better to run the timer once rather than after every registration */
    this.detectNetworkChange();
    this.incomingCallListener();
    this.registerCallsClearedListener();
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
   * Create an array of Mobius Uris.
   */
  private updateMobiusUris() {
    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: this.updateMobiusUris.name,
    };

    const urisArrayPrimary = [];
    const urisArrayBackup = [];

    if (this.mobiusServers?.primary?.uris) {
      log.info('Adding Primary uris', logContext);
      for (const uri of this.mobiusServers.primary.uris) {
        urisArrayPrimary.push(`${uri}${URL_ENDPOINT}`);
      }
    }

    if (this.mobiusServers?.backup?.uris) {
      log.info('Adding Backup uris', logContext);
      for (const uri of this.mobiusServers.backup.uris) {
        urisArrayBackup.push(`${uri}${URL_ENDPOINT}`);
      }
    }

    /*
     * If there are no entries in both primary and backup arrays then add the default
     * uri in primary array, otherwise in backup.
     */
    log.info('Adding Default uri', logContext);
    if (!urisArrayPrimary.length && !urisArrayBackup.length) {
      urisArrayPrimary.push(`${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`);
    } else {
      urisArrayBackup.push(`${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`);
    }

    /* Flush the array if it contains old values */
    this.primaryMobiusUris.length = 0;
    this.backupMobiusUris.length = 0;

    /* Remove duplicates from primary by keeping the order intact */
    for (let i = 0; i < urisArrayPrimary.length; i += 1) {
      if (this.primaryMobiusUris.indexOf(urisArrayPrimary[i]) === -1) {
        this.primaryMobiusUris.push(urisArrayPrimary[i]);
      }
    }

    /* Remove duplicates from backup by keeping the order intact */
    for (let i = 0; i < urisArrayBackup.length; i += 1) {
      if (this.backupMobiusUris.indexOf(urisArrayBackup[i]) === -1) {
        this.backupMobiusUris.push(urisArrayBackup[i]);
      }
    }
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
   * Register callbacks for network changes.
   *
   */
  private async detectNetworkChange() {
    let retry = false;

    setInterval(async () => {
      if (
        !this.webex.internal.mercury.connected &&
        !retry &&
        Object.keys(this.callManager.getActiveCalls()).length === 0
      ) {
        log.warn(`Network has flapped, waiting for mercury connection to be up`, {
          file: CALLING_CLIENT_FILE,
          method: NETWORK_CHANGE_DETECTION_UTIL,
        });

        this.emit(EVENT_KEYS.UNREGISTERED);
        this.clearKeepaliveTimer();

        retry = true;
      }

      if (retry && this.webex.internal.mercury.connected) {
        await this.mutex.runExclusive(async () => {
          /* Check retry once again to see if another timer thread has not finished the job already. */
          if (retry) {
            log.log('Mercury connection is up again, Re-registering with Mobius', {
              file: CALLING_CLIENT_FILE,
              method: NETWORK_CHANGE_DETECTION_UTIL,
            });
            this.clearKeepaliveTimer();
            if (this.isRegistered === MobiusStatus.ACTIVE) {
              // eslint-disable-next-line no-await-in-loop
              await this.deregister();
            }

            /*
             * Do not attempt registration if mobius url is not set in this.url
             * as that'd mean initial registration itself is not finished yet, let
             * failover timer handle the registration in that case.
             */
            if (this.url) {
              /*
               * When restoring connectivity, register with same url first
               * where it was registered last even if it was a backup url,
               * because failback timer may already be running to register
               * it back to primary.
               */

              const abort = await this.restorePreviousRegistration(NETWORK_CHANGE_DETECTION_UTIL);

              if (!abort && !this.isDeviceRegistered()) {
                await this.restartRegistration(NETWORK_CHANGE_DETECTION_UTIL);
              }
            }
            retry = false;
          }
        });
      }
    }, NETWORK_FLAP_TIMEOUT);
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
      handleErrors(this, err as WebexRequestPayload, GET_MOBIUS_SERVERS_UTIL, CALLING_CLIENT_FILE);
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
        this.mobiusServers = temp.body as MobiusServers;
        this.updateMobiusUris();
      } catch (err: unknown) {
        handleErrors(
          this,
          err as WebexRequestPayload,
          GET_MOBIUS_SERVERS_UTIL,
          CALLING_CLIENT_FILE
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
      this.primaryMobiusUris.push(
        `${this.webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`
      );
    }
  }

  /**
   * Request for the Device status.
   *
   * @param _deviceInfo - Registered device Object.
   * @returns Promise.
   */
  public async sendKeepAlive(_deviceInfo: IDeviceInfo): Promise<void> {
    const deviceId = _deviceInfo.device?.deviceId as string;
    const interval = _deviceInfo.keepaliveInterval as number;
    const url = _deviceInfo.device?.uri as string;
    let keepAliveRetryCount = 0;

    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: KEEPALIVE_UTIL,
    };

    this.clearKeepaliveTimer();

    log.info(
      `Fetched details :-> deviceId: ${deviceId}, interval :-> ${interval}, url: ${url}`,
      logContext
    );
    if (this.isDeviceRegistered()) {
      this.keepaliveTimer = setInterval(async () => {
        const targetUrl = this.url;

        await this.mutex.runExclusive(async () => {
          if (this.isDeviceRegistered() && targetUrl === this.url && keepAliveRetryCount < 5) {
            try {
              const res = await this.registration.postKeepAlive(url);

              log.log(`Sent Keepalive, status: ${res.statusCode}`, logContext);
              if (keepAliveRetryCount > 0) {
                this.emit(EVENT_KEYS.RECONNECTED);
              }
              keepAliveRetryCount = 0;
            } catch (err: unknown) {
              keepAliveRetryCount += 1;
              const error = <WebexRequestPayload>err;

              log.warn(
                `Keep-alive missed ${keepAliveRetryCount} times. Status -> ${error.statusCode} `,
                logContext
              );
              const abort = await handleErrors(this, error, KEEPALIVE_UTIL, CALLING_CLIENT_FILE);

              if (abort || keepAliveRetryCount >= 5) {
                this.isRegistered = MobiusStatus.DEFAULT;
                this.clearKeepaliveTimer();
                this.clearFailbackTimer();
                this.emit(EVENT_KEYS.UNREGISTERED);

                if (!abort) {
                  /* In case of non-final error, re-attempt registration */
                  await this.reconnectOnFailure(KEEPALIVE_UTIL);
                }
              } else {
                this.emit(EVENT_KEYS.RECONNECTING);
              }
            }
          }
        });
      }, interval * 1000);
    } else {
      log.warn('Device is not active, exiting.', logContext);
    }
  }

  /**
   * Invoked to re-register in cases when the registration
   * is lost due to some failure.
   * If there are active calls, it will only mark reconnectPending
   * as true and then retry will happen when this method gets
   * invoked again on receiving all calls cleared event from
   * callManager.
   *
   * @param caller - Caller of this method.
   */
  private async reconnectOnFailure(caller: string) {
    this.reconnectPending = false;
    if (!this.isDeviceRegistered()) {
      if (Object.keys(this.callManager.getActiveCalls()).length === 0) {
        const abort = await this.restorePreviousRegistration(caller);

        if (!abort && !this.isDeviceRegistered()) {
          await this.restartRegistration(caller);
        }
      } else {
        this.reconnectPending = true;
        log.log('Active call(s) present, deferred reconnect till call cleanup.', {
          file: CALLING_CLIENT_FILE,
          method: RECONNECT_UTIL,
        });
      }
    }
  }

  /**
   * Clears the keepalive timer if running.
   */
  private clearKeepaliveTimer() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = undefined;
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
    if (!this.isDeviceRegistered()) {
      await this.mutex.runExclusive(async () => {
        if (this.reconnectPending) {
          log.log('All calls cleared, reconnecting', {
            file: CALLING_CLIENT_FILE,
            method: CALLS_CLEARED_HANDLER_UTIL,
          });
          await this.reconnectOnFailure(CALLS_CLEARED_HANDLER_UTIL);
        }
      });
    }
  };

  /**
   * Wrapper to for device registration.
   *
   * @param retry - Retry in case of errors.
   */
  public async register(retry: boolean) {
    // If retry is present , we don't need to find Mobius servers again. This is a retry-After case
    await this.mutex.runExclusive(async () => {
      if (!retry) {
        this.isRegistered = MobiusStatus.DEFAULT;
        this.emit(EVENT_KEYS.CONNECTING);
        await this.getMobiusServers();
      }
      const abort = await this.registerDevice(this.register.name);

      if (!this.isDeviceRegistered() && !retry && !abort) {
        await this.startFailoverTimer();
      }
    });
  }

  /**
   * Attempts registration with the server list received in
   * argument one by one until registration either succeeds with
   * one or all of them are tried.
   *
   * @param caller - Caller of this method.
   * @param servers - List of mobius server urls to try.
   * @returns Promise resolving to a boolean carrying true if registration
   *          attempt has hit a final error and a retry should not be scheduled
   *          else false.
   */
  private async registerDevice(
    caller: string,
    servers: string[] = this.primaryMobiusUris
  ): Promise<boolean> {
    let abort = false;

    if (this.isDeviceRegistered()) {
      log.log(`[${caller}] : Device already registered with : ${this.url}`, {
        file: CALLING_CLIENT_FILE,
        method: REGISTER_UTIL,
      });

      return abort;
    }
    for (const url of servers) {
      try {
        abort = false;
        this.isRegistered = MobiusStatus.DEFAULT;
        this.emit(EVENT_KEYS.CONNECTING);
        log.log(`[${caller}] : Mobius url to contact: ${url}`, {
          file: CALLING_CLIENT_FILE,
          method: REGISTER_UTIL,
        });
        // eslint-disable-next-line no-await-in-loop
        const resp = await this.registration.createDevice(url);

        this.deviceInfo = resp.body as IDeviceInfo;
        this.emit(EVENT_KEYS.REGISTERED, resp.body as IDeviceInfo);
        this.isRegistered = MobiusStatus.ACTIVE;
        this.reconnectPending = false;
        this.setMobiusUrl(url);
        this.setIntervalValues(this.deviceInfo);
        this.metricManager.setDeviceInfo(this.deviceInfo);
        this.metricManager.submitRegistrationMetric(
          METRIC_EVENT.REGISTRATION,
          REG_ACTION.REGISTER,
          METRIC_TYPE.BEHAVIORAL,
          undefined
        );
        this.sendKeepAlive(this.deviceInfo);
        this.initiateFailback();
        break;
      } catch (err: unknown) {
        const body = err as WebexRequestPayload;

        // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-unused-vars
        abort = await handleErrors(this, body, REGISTER_UTIL, CALLING_CLIENT_FILE);

        if (this.isRegistered === MobiusStatus.ACTIVE) {
          log.info(
            `[${caller}] : Device is already restored, active mobius url: ${this.getMobiusUrl()}`,
            {
              file: CALLING_CLIENT_FILE,
              method: REGISTER_UTIL,
            }
          );
          break;
        }
        if (abort) {
          break;
        } else if (caller === FAILBACK_UTIL) {
          const error = body.statusCode;

          if (
            error === ERROR_CODE.TOO_MANY_REQUESTS &&
            this.failback429RetryAttempts < REG_FAILBACK_429_MAX_RETRIES
          ) {
            // eslint-disable-next-line no-await-in-loop
            await this.scheduleFailback429Retry();
            abort = true;
            break;
          }
        }
      }
    }

    return abort;
  }

  /**
   * When a failback request is rejected with 429, it means the
   * request did not even land on primary mobius to know if it
   * can handle this device registration now, in such cases this
   * method is called to retry sooner than the rehoming timer value.
   */
  private async scheduleFailback429Retry() {
    this.clearFailbackTimer();
    this.failback429RetryAttempts += 1;
    log.log(`Received 429 while rehoming, 429 retry count : ${this.failback429RetryAttempts}`, {
      file: CALLING_CLIENT_FILE,
      method: FAILBACK_429_RETRY_UTIL,
    });
    const interval = this.getRegRetryInterval(this.failback429RetryAttempts);

    this.startFailbackTimer(interval);
    const abort = await this.restorePreviousRegistration(FAILBACK_429_RETRY_UTIL);

    if (!abort && !this.isDeviceRegistered()) {
      await this.restartRegistration(FAILBACK_429_RETRY_UTIL);
    }
  }

  /**
   * Calculates and returns a random interval value using input argument
   * attempt as the variable factor.
   *
   * @param attempt - Number of times registration has been
   *                  attempted already.
   */
  private getRegRetryInterval(attempt = 1): number {
    return (
      BASE_REG_RETRY_TIMER_VAL_IN_SEC +
      BASE_REG_TIMER_MFACTOR ** attempt +
      Math.floor(
        (Math.random() * (REG_RANDOM_T_FACTOR_UPPER_LIMIT - SEC_TO_MSEC_MFACTOR + 1) +
          SEC_TO_MSEC_MFACTOR) /
          SEC_TO_MSEC_MFACTOR
      )
    );
  }

  /**
   * Schedules registration retry with primary mobius servers at a random
   * interval calculated based on the  the number of times registration
   * retry is already done
   * After the total time since the beginning of retry attempt exceeds the
   * retry threshold, it switches over to backup mobius servers.
   *
   * @param attempt - Number of times registration has been attempted already.
   * @param timeElapsed - Time elapsed since the first registration attempt.
   */
  private async startFailoverTimer(attempt = 1, timeElapsed = 0) {
    let interval = this.getRegRetryInterval(attempt);

    if (timeElapsed + interval > REG_TRY_BACKUP_TIMER_VAL_IN_SEC) {
      const excessVal = timeElapsed + interval - REG_TRY_BACKUP_TIMER_VAL_IN_SEC;

      interval -= excessVal;
    }

    let abort;

    if (interval > BASE_REG_RETRY_TIMER_VAL_IN_SEC) {
      const scheduledTime = Math.floor(Date.now() / 1000);

      setTimeout(async () => {
        await this.mutex.runExclusive(async () => {
          abort = await this.registerDevice(FAILOVER_UTIL);
          const currentTime = Math.floor(Date.now() / 1000);

          if (!abort && !this.isDeviceRegistered()) {
            await this.startFailoverTimer(attempt + 1, timeElapsed + (currentTime - scheduledTime));
          }
        });
      }, interval * SEC_TO_MSEC_MFACTOR);
      log.log(
        `Scheduled retry with primary in ${interval} seconds, number of attempts : ${attempt}`,
        {
          file: CALLING_CLIENT_FILE,
          method: FAILOVER_UTIL,
        }
      );
    } else if (this.backupMobiusUris.length) {
      log.log('Failing over to backup servers.', {
        file: CALLING_CLIENT_FILE,
        method: FAILOVER_UTIL,
      });
      abort = await this.registerDevice(FAILOVER_UTIL, this.backupMobiusUris);
      if (!abort && !this.isDeviceRegistered()) {
        interval = this.getRegRetryInterval();
        setTimeout(async () => {
          await this.mutex.runExclusive(async () => {
            abort = await this.registerDevice(FAILOVER_UTIL, this.backupMobiusUris);
            if (!abort && !this.isDeviceRegistered()) {
              emitFinalFailure(this, FAILOVER_UTIL, CALLING_CLIENT_FILE);
            }
          });
        }, interval * SEC_TO_MSEC_MFACTOR);
        log.log(`Scheduled retry with backup servers in ${interval} seconds.`, {
          file: CALLING_CLIENT_FILE,
          method: FAILOVER_UTIL,
        });
      }
    } else {
      emitFinalFailure(this, FAILOVER_UTIL, CALLING_CLIENT_FILE);
    }
  }

  /**
   * Clears the failback timer if running.
   */
  private clearFailbackTimer() {
    if (this.failbackTimer) {
      clearTimeout(this.failbackTimer);
      this.failbackTimer = undefined;
    }
  }

  /**
   * Returns true if device is registered with a backup mobius.
   */
  private failbackRequired(): boolean {
    return this.isDeviceRegistered() && this.primaryMobiusUris.indexOf(this.url) === -1;
  }

  /**
   * Calculates and returns a random value between rehomingIntervalMin and
   * rehomingIntervalMax.
   */
  private getFailbackInterval(): number {
    return Math.floor(
      Math.random() * (this.rehomingIntervalMax - this.rehomingIntervalMin + 1) +
        this.rehomingIntervalMin
    );
  }

  /**
   * Starts failback timer to move to primary mobius if device
   * is registered with a backup mobius.
   */
  private initiateFailback() {
    if (this.failbackRequired()) {
      if (!this.failbackTimer) {
        this.failback429RetryAttempts = 0;
        const intervalInMinutes = this.getFailbackInterval();

        this.startFailbackTimer(intervalInMinutes * MINUTES_TO_SEC_MFACTOR);
      }
    } else {
      this.failback429RetryAttempts = 0;
      this.clearFailbackTimer();
    }
  }

  /**
   * Starts failback timer with the interval value received.
   *
   * @param intervalInSeconds - Failback timer interval value in seconds.
   */
  private startFailbackTimer(intervalInSeconds: number) {
    this.failbackTimer = setTimeout(
      async () => this.executeFailback(),
      intervalInSeconds * SEC_TO_MSEC_MFACTOR
    );
    log.log(`Failback scheduled after ${intervalInSeconds} seconds.`, {
      file: CALLING_CLIENT_FILE,
      method: this.startFailbackTimer.name,
    });
  }

  /**
   * Core logic for the failback processing, scheduled and executed
   * at failback timer expiry.
   */
  private async executeFailback() {
    await this.mutex.runExclusive(async () => {
      if (this.failbackRequired()) {
        if (Object.keys(this.callManager.getActiveCalls()).length === 0) {
          log.log(`Attempting failback to primary.`, {
            file: CALLING_CLIENT_FILE,
            method: FAILBACK_UTIL,
          });
          await this.deregister();
          const abort = await this.registerDevice(FAILBACK_UTIL);

          if (!abort && !this.isDeviceRegistered()) {
            const abort = await this.restorePreviousRegistration(FAILBACK_UTIL);

            if (abort) {
              this.clearFailbackTimer();

              return;
            }

            if (!this.isDeviceRegistered()) {
              await this.restartRegistration(FAILBACK_UTIL);
            } else {
              this.failbackTimer = undefined;
              this.initiateFailback();
            }
          }
        } else {
          log.log('Active calls present, deferring failback to next cycle.', {
            file: CALLING_CLIENT_FILE,
            method: FAILBACK_UTIL,
          });
          this.failbackTimer = undefined;
          this.initiateFailback();
        }
      }
    });
  }

  /**
   * Start fresh registration cycle with the mobius
   * server list already present.
   *
   * @param caller - Caller of this method.
   */
  private async restartRegistration(caller: string) {
    /*
     * Cancel any failback timer running
     * and start fresh registration attempt with retry as true.
     */
    this.clearFailbackTimer();
    this.failback429RetryAttempts = 0;
    const abort = await this.registerDevice(caller);

    if (!abort && !this.isDeviceRegistered()) {
      await this.startFailoverTimer();
    }
  }

  /**
   * Re-attempts registration with the mobius url it was last registered
   * to, that mobius url is expected to be updated already in this.url.
   *
   * @param caller - Caller of this method.
   */
  public async restorePreviousRegistration(caller: string): Promise<boolean> {
    let abort = false;

    if (this.url) {
      abort = await this.registerDevice(caller, [this.url]);
    }

    return abort;
  }

  /**
   * Updates rehomingIntervalMin and rehomingIntervalMax values
   * if received in registration response from a primary mobius
   * server.
   *
   * @param deviceInfo - Device info.
   */
  private setIntervalValues(deviceInfo: IDeviceInfo) {
    if (this.primaryMobiusUris.indexOf(this.url) !== -1) {
      this.rehomingIntervalMin = deviceInfo?.rehomingIntervalMin
        ? deviceInfo.rehomingIntervalMin
        : DEFAULT_REHOMING_INTERVAL_MIN;
      this.rehomingIntervalMax = deviceInfo?.rehomingIntervalMax
        ? deviceInfo.rehomingIntervalMax
        : DEFAULT_REHOMING_INTERVAL_MAX;
    }
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
  public setMobiusUrl(uri: string) {
    this.url = uri;

    /* Update the url in CallManager so that the Call Object can access it */
    this.callManager.updateActiveMobius(this.url);
  }

  /**
   * Wrapper to for device  deregister.
   */
  public async deregister() {
    try {
      await this.registration.deleteDevice(
        this.url,
        this.deviceInfo.device?.deviceId as string,
        this.deviceInfo.device?.clientDeviceUri as string
      );
    } catch (err) {
      log.warn(`Delete failed with Mobius`, {});
    }

    this.clearKeepaliveTimer();
    this.isRegistered = MobiusStatus.DEFAULT;

    this.metricManager.submitRegistrationMetric(
      METRIC_EVENT.REGISTRATION,
      REG_ACTION.DEREGISTER,
      METRIC_TYPE.BEHAVIORAL,
      undefined
    );
  }

  /**
   *
   */
  public getRegistrationStatus = (): MobiusStatus => this.isRegistered;

  /**
   *
   */
  public getDeviceId = (): MobiusDeviceId | undefined => this.deviceInfo.device?.deviceId;

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
          this.deviceInfo.device?.deviceId as string
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

  /**
   * @param name - Name of the metric.
   * @param action - Action that the metric is for.
   * @param metric - Type of metric (Operational/Behavioral).
   * @param error - Error details if an error metric is being sent.
   */
  public sendMetric(
    name: METRIC_EVENT,
    action: REG_ACTION,
    metric: METRIC_TYPE,
    error?: CallingClientError | undefined
  ) {
    this.metricManager.submitRegistrationMetric(name, action, metric, error);
  }
}

/**
 * @param webex - A webex instance.
 * @param config - Config to start the CallingClient with..
 */
export const createClient = (webex: WebexSDK, config?: CallingClientConfig): ICallingClient =>
  new CallingClient(webex, config);
