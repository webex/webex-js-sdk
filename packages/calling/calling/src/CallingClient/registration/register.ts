/* eslint-disable valid-jsdoc */
import {v4 as uuid} from 'uuid';
import {Mutex} from 'async-mutex';
import {ERROR_CODE} from '../../Errors/types';
import {emitFinalFailure, handleRegistrationErrors} from '../../common';

import {IMetricManager, METRIC_EVENT, METRIC_TYPE, REG_ACTION} from '../metrics/types';
import {getMetricManager} from '../metrics';
import {CallingClientEmitterCallback} from '../types';
import {EVENT_KEYS} from '../../Events/types';
import {CallingClientError} from '../../Errors';
import {ICallManager} from '../calling/types';
import {getCallManager} from '../calling';
import {LOGGER} from '../../Logger/types';
import log from '../../Logger';
import {IRegistration} from './types';
import SDKConnector from '../../SDKConnector';
import {
  ALLOWED_SERVICES,
  HTTP_METHODS,
  IDeviceInfo,
  MobiusStatus,
  ServiceData,
  WebexRequestPayload,
} from '../../common/types';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DEVICES_ENDPOINT_RESOURCE,
  SPARK_USER_AGENT,
  WEBEX_WEB_CLIENT,
  BASE_REG_RETRY_TIMER_VAL_IN_SEC,
  BASE_REG_TIMER_MFACTOR,
  SEC_TO_MSEC_MFACTOR,
  REG_RANDOM_T_FACTOR_UPPER_LIMIT,
  REG_TRY_BACKUP_TIMER_VAL_IN_SEC,
  MINUTES_TO_SEC_MFACTOR,
  FAILBACK_429_RETRY_UTIL,
  REG_FAILBACK_429_MAX_RETRIES,
  FAILBACK_UTIL,
  REGISTRATION_FILE,
  DEFAULT_REHOMING_INTERVAL_MIN,
  DEFAULT_REHOMING_INTERVAL_MAX,
  NETWORK_FLAP_TIMEOUT,
  DEFAULT_KEEPALIVE_INTERVAL,
} from '../constants';

/**
 *
 */
export class Registration implements IRegistration {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private userId = '';

  private serviceData: ServiceData;

  private failback429RetryAttempts: number;
  private registrationStatus: MobiusStatus;
  private failbackTimer?: NodeJS.Timer;
  private activeMobiusUrl!: string;

  private keepaliveTimer: NodeJS.Timer | undefined;
  private rehomingIntervalMin: number;

  private rehomingIntervalMax: number;
  private mutex: Mutex;
  private metricManager: IMetricManager;
  private emitter: CallingClientEmitterCallback;
  private callManager: ICallManager;
  private deviceInfo: IDeviceInfo = {};
  private primaryMobiusUris: string[];
  private backupMobiusUris: string[];
  private registerRetry = false;
  private reconnectPending = false;

  /**
   * @param webex - A webex instance.
   * @param serviceData - indicates whether the backend service is calling or contactcentre
   * @param mutex - mutex which is used to run any registration scenario exclusively
   * @param callingClientEmitter - CallingClient emitter for registration related events
   * @param logLevel - log level option for registration module
   */
  constructor(
    webex: WebexSDK,
    serviceData: ServiceData,
    mutex: Mutex,
    callingClientEmitter: CallingClientEmitterCallback,
    logLevel: LOGGER
  ) {
    this.sdkConnector = SDKConnector;
    this.serviceData = serviceData;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.userId = this.webex.internal.device.userId;
    this.registrationStatus = MobiusStatus.DEFAULT;
    this.failback429RetryAttempts = 0;
    log.setLogger(logLevel, REGISTRATION_FILE);
    this.rehomingIntervalMin = DEFAULT_REHOMING_INTERVAL_MIN;
    this.rehomingIntervalMax = DEFAULT_REHOMING_INTERVAL_MAX;
    this.mutex = mutex;
    this.callManager = getCallManager(this.webex, serviceData.indicator);
    this.metricManager = getMetricManager(this.webex, serviceData.indicator);
    this.emitter = callingClientEmitter;

    this.primaryMobiusUris = [];
    this.backupMobiusUris = [];
    /* Better to run the timer once rather than after every registration */
    this.detectNetworkChange('class');
  }

  public getActiveMobiusUrl(): string {
    return this.activeMobiusUrl;
  }

  public setActiveMobiusUrl(url: string) {
    log.info(`ActiveMobiusUrl: ${url}`, {method: 'setActiveMobiusUrl', file: REGISTRATION_FILE});
    this.activeMobiusUrl = url;
    this.callManager.updateActiveMobius(url);
  }

  public setMobiusServers(primaryMobiusUris: string[], backupMobiusUris: string[]) {
    this.primaryMobiusUris = primaryMobiusUris;
    this.backupMobiusUris = backupMobiusUris;
  }

  /**
   *  Implementation of sending keepalive.
   *
   * @param url - Entire device url.
   * @returns Promise<boolean>.
   */
  private async postKeepAlive(url: string) {
    return <WebexRequestPayload>this.webex.request({
      uri: `${url}/status`,
      method: HTTP_METHODS.POST,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      service: ALLOWED_SERVICES.MOBIUS,
    });
  }

  /**
   * Implementation of delete device.
   *
   * @param url -.
   * @param deviceId -.
   * @param deviceUrl -.
   */
  private async deleteRegistration(url: string, deviceId: string, deviceUrl: string) {
    const response = await fetch(`${url}${DEVICES_ENDPOINT_RESOURCE}/${deviceId}`, {
      method: HTTP_METHODS.DELETE,
      headers: {
        [CISCO_DEVICE_URL]: deviceUrl,
        Authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${WEBEX_WEB_CLIENT}_${uuid()}`,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
    });

    return <WebexRequestPayload>response.json();
  }

  /**
   * Implementation of POST request for device registration.
   *
   * @param url - backend service url for registration
   */
  private async postRegistration(url: string) {
    const deviceInfo = {
      userId: this.userId,
      clientDeviceUri: this.webex.internal.device.url,
      serviceData: this.serviceData,
    };

    return <WebexRequestPayload>this.webex.request({
      uri: `${url}device`,
      method: HTTP_METHODS.POST,
      headers: {
        [CISCO_DEVICE_URL]: deviceInfo.clientDeviceUri,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: deviceInfo,
      service: ALLOWED_SERVICES.MOBIUS,
    });
  }

  /**
   * Re-attempts registration with the mobius url it was last registered
   * to, that mobius url is expected to be updated already in this.activeMobiusUrl.
   * @param caller - Caller of this method.
   */
  private async restorePreviousRegistration(caller: string): Promise<boolean> {
    let abort = false;

    if (this.activeMobiusUrl) {
      abort = await this.attemptRegistrationWithServers(caller, [this.activeMobiusUrl]);
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
    if (this.failback429RetryAttempts >= REG_FAILBACK_429_MAX_RETRIES) {
      return;
    }
    this.clearFailbackTimer();
    this.failback429RetryAttempts += 1;
    log.log(`Received 429 while rehoming, 429 retry count : ${this.failback429RetryAttempts}`, {
      file: REGISTRATION_FILE,
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
   * interval calculated based on the number of times registration retry is already done
   * Once the time taken since the beginning of retry attempt exceeds the
   * retry threshold, it switches over to backup mobius servers.
   *
   * @param attempt - Number of times registration has been attempted already.
   * @param timeElapsed - Time elapsed since the first registration attempt.
   */
  private async startFailoverTimer(attempt = 1, timeElapsed = 0) {
    const loggerContext = {
      file: REGISTRATION_FILE,
      method: this.startFailoverTimer.name,
    };

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
          abort = await this.attemptRegistrationWithServers(this.startFailoverTimer.name);
          const currentTime = Math.floor(Date.now() / 1000);

          if (!abort && !this.isDeviceRegistered()) {
            await this.startFailoverTimer(attempt + 1, timeElapsed + (currentTime - scheduledTime));
          }
        });
      }, interval * SEC_TO_MSEC_MFACTOR);
      log.log(
        `Scheduled retry with primary in ${interval} seconds, number of attempts : ${attempt}`,
        loggerContext
      );
    } else if (this.backupMobiusUris.length) {
      log.log('Failing over to backup servers.', loggerContext);
      abort = await this.attemptRegistrationWithServers(
        this.startFailoverTimer.name,
        this.backupMobiusUris
      );
      if (!abort && !this.isDeviceRegistered()) {
        interval = this.getRegRetryInterval();
        setTimeout(async () => {
          await this.mutex.runExclusive(async () => {
            abort = await this.attemptRegistrationWithServers(
              this.startFailoverTimer.name,
              this.backupMobiusUris
            );
            if (!abort && !this.isDeviceRegistered()) {
              emitFinalFailure((clientError: CallingClientError) => {
                this.emitter(EVENT_KEYS.ERROR, undefined, clientError);
              }, loggerContext);
            }
          });
        }, interval * SEC_TO_MSEC_MFACTOR);
        log.log(`Scheduled retry with backup servers in ${interval} seconds.`, loggerContext);
      }
    } else {
      emitFinalFailure((clientError: CallingClientError) => {
        this.emitter(EVENT_KEYS.ERROR, undefined, clientError);
      }, loggerContext);
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
  private isFailbackRequired(): boolean {
    return this.isDeviceRegistered() && this.primaryMobiusUris.indexOf(this.activeMobiusUrl) === -1;
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
    if (this.isFailbackRequired()) {
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
      file: REGISTRATION_FILE,
      method: this.startFailbackTimer.name,
    });
  }

  /**
   * Core logic for the failback processing, scheduled and executed
   * at failback timer expiry.
   */
  private async executeFailback() {
    await this.mutex.runExclusive(async () => {
      if (this.isFailbackRequired()) {
        if (Object.keys(this.callManager.getActiveCalls()).length === 0) {
          log.info(`Attempting failback to primary.`, {
            file: REGISTRATION_FILE,
            method: this.executeFailback.name,
          });
          await this.deregister();
          const abort = await this.attemptRegistrationWithServers(FAILBACK_UTIL);
          if (!abort && !this.isDeviceRegistered()) {
            const abortNew = await this.restorePreviousRegistration(FAILBACK_UTIL);

            if (abortNew) {
              this.clearFailbackTimer();

              return;
            }

            if (!this.isDeviceRegistered()) {
              await this.restartRegistration(this.executeFailback.name);
            } else {
              this.failbackTimer = undefined;
              this.initiateFailback();
            }
          }
        } else {
          log.info('Active calls present, deferring failback to next cycle.', {
            file: REGISTRATION_FILE,
            method: this.executeFailback.name,
          });
          this.failbackTimer = undefined;
          this.initiateFailback();
        }
      }
    });
  }

  /**
   * Register callbacks for network changes.
   *
   */
  private async detectNetworkChange(flag = 'test') {
    let retry = false;

    setInterval(async () => {
      if (
        !this.webex.internal.mercury.connected &&
        !retry &&
        Object.keys(this.callManager.getActiveCalls()).length === 0
      ) {
        log.warn(`Network has flapped, waiting for mercury connection to be up`, {
          file: REGISTRATION_FILE,
          method: this.detectNetworkChange.name,
        });

        this.emitter(EVENT_KEYS.UNREGISTERED);
        this.clearKeepaliveTimer();

        retry = true;
      }

      if (retry && this.webex.internal.mercury.connected) {
        retry = await this.handleConnectionRestoration(retry);
      }
    }, NETWORK_FLAP_TIMEOUT);
  }

  /**
   * Updates rehomingIntervalMin and rehomingIntervalMax values
   * if received in registration response from a primary mobius
   * server.
   *
   * @param deviceInfo - Device info.
   */
  private setIntervalValues(deviceInfo: IDeviceInfo) {
    if (this.primaryMobiusUris.indexOf(this.activeMobiusUrl) !== -1) {
      this.rehomingIntervalMin = deviceInfo?.rehomingIntervalMin
        ? deviceInfo.rehomingIntervalMin
        : DEFAULT_REHOMING_INTERVAL_MIN;
      this.rehomingIntervalMax = deviceInfo?.rehomingIntervalMax
        ? deviceInfo.rehomingIntervalMax
        : DEFAULT_REHOMING_INTERVAL_MAX;
    }
  }

  public getDeviceInfo(): IDeviceInfo {
    return this.deviceInfo;
  }

  /**
   * .
   *
   * @returns True if this device is in registered state
   *          by checking if isRegistered state is set to
   *          ACTIVE, else false.
   */
  public isDeviceRegistered(): boolean {
    return this.registrationStatus === MobiusStatus.ACTIVE;
  }

  public getStatus(): MobiusStatus {
    return this.registrationStatus;
  }

  public setStatus(value: MobiusStatus) {
    this.registrationStatus = value;
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
    const abort = await this.attemptRegistrationWithServers(caller, this.primaryMobiusUris);

    if (!abort && !this.isDeviceRegistered()) {
      await this.startFailoverTimer();
    }
  }

  private async handleConnectionRestoration(retry: boolean): Promise<boolean> {
    await this.mutex.runExclusive(async () => {
      /* Check retry once again to see if another timer thread has not finished the job already. */
      if (retry) {
        log.info('Mercury connection is up again, Re-registering with Mobius', {
          file: REGISTRATION_FILE,
          method: this.handleConnectionRestoration.name,
        });
        this.clearKeepaliveTimer();
        if (this.isDeviceRegistered()) {
          // eslint-disable-next-line no-await-in-loop
          await this.deregister();
        }

        /*
         * Do not attempt registration if mobius url is not set in this.activeMobiusUrl
         * as that'd mean initial registration itself is not finished yet, let
         * failover timer handle the registration in that case.
         */
        if (this.activeMobiusUrl) {
          /*
           * When restoring connectivity, register with same url first
           * where it was registered last even if it was a backup url,
           * because failback timer may already be running to register
           * it back to primary.
           */
          const abort = await this.restorePreviousRegistration(
            this.handleConnectionRestoration.name
          );

          if (!abort && !this.isDeviceRegistered()) {
            await this.restartRegistration(this.handleConnectionRestoration.name);
          }
        }
        retry = false;
      }
    });

    return retry;
  }

  /**
   * Callback function for restoring registration in case of failure during initial registration
   * due to device registration already exists.
   *
   */
  private restoreRegistrationCallBack() {
    return async (restoreData: IDeviceInfo, caller: string) => {
      const logContext = {file: REGISTRATION_FILE, method: caller};
      if (!this.isRegRetry()) {
        log.info('Registration restoration in progress.', logContext);
        const restore = this.getExistingDevice(restoreData);

        if (restore) {
          this.setRegRetry(true);
          await this.deregister();
          const finalError = await this.restorePreviousRegistration(caller);
          this.setRegRetry(false);
          if (this.isDeviceRegistered()) {
            log.info('Registration restored successfully.', logContext);
          }

          return finalError;
        }
        this.emitter(EVENT_KEYS.UNREGISTERED);
      } else {
        this.emitter(EVENT_KEYS.UNREGISTERED);
      }

      return false;
    };
  }

  /**
   * Triggers the registration with the given list of Mobius servers
   * Registration is attempted with primary and backup until it succeeds or the list is exhausted
   */
  public async triggerRegistration() {
    if (this.primaryMobiusUris.length > 0) {
      const abort = await this.attemptRegistrationWithServers(
        this.triggerRegistration.name,
        this.primaryMobiusUris
      );

      if (!this.isDeviceRegistered() && !abort) {
        await this.startFailoverTimer();
      }
    }
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
  private async attemptRegistrationWithServers(
    caller: string,
    servers: string[] = this.primaryMobiusUris
  ): Promise<boolean> {
    let abort = false;

    if (this.isDeviceRegistered()) {
      log.log(`[${caller}] : Device already registered with : ${this.activeMobiusUrl}`, {
        file: REGISTRATION_FILE,
        method: this.attemptRegistrationWithServers.name,
      });

      return abort;
    }
    for (const url of servers) {
      try {
        abort = false;
        this.registrationStatus = MobiusStatus.DEFAULT;
        this.emitter(EVENT_KEYS.CONNECTING);
        log.log(`[${caller}] : Mobius url to contact: ${url}`, {
          file: REGISTRATION_FILE,
          method: this.attemptRegistrationWithServers.name,
        });
        // eslint-disable-next-line no-await-in-loop
        const resp = await this.postRegistration(url);

        this.deviceInfo = resp.body as IDeviceInfo;
        this.emitter(EVENT_KEYS.REGISTERED, resp.body as IDeviceInfo);
        this.registrationStatus = MobiusStatus.ACTIVE;
        this.setActiveMobiusUrl(url);
        this.setIntervalValues(this.deviceInfo);
        this.metricManager.setDeviceInfo(this.deviceInfo);
        this.metricManager.submitRegistrationMetric(
          METRIC_EVENT.REGISTRATION,
          REG_ACTION.REGISTER,
          METRIC_TYPE.BEHAVIORAL,
          undefined
        );
        this.startKeepaliveTimer(
          this.deviceInfo.device?.uri as string,
          this.deviceInfo.keepaliveInterval as number
        );
        this.initiateFailback();
        break;
      } catch (err: unknown) {
        const body = err as WebexRequestPayload;

        // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-unused-vars
        abort = await handleRegistrationErrors(
          body,
          (clientError, finalError) => {
            if (finalError) {
              this.emitter(EVENT_KEYS.ERROR, undefined, clientError);
            } else {
              this.emitter(EVENT_KEYS.UNREGISTERED);
            }
            this.sendMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              clientError
            );
          },
          {method: this.attemptRegistrationWithServers.name, file: REGISTRATION_FILE},
          this.restoreRegistrationCallBack()
        );
        if (this.registrationStatus === MobiusStatus.ACTIVE) {
          log.info(
            `[${caller}] : Device is already restored, active mobius url: ${this.activeMobiusUrl}`,
            {
              file: REGISTRATION_FILE,
              method: this.attemptRegistrationWithServers.name,
            }
          );
          break;
        }
        if (abort) {
          break;
        } else if (caller === this.executeFailback.name) {
          const error = body.statusCode;

          if (error === ERROR_CODE.TOO_MANY_REQUESTS) {
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
   * This method sets up a timer to periodically send keep-alive requests to maintain a connection.
   * It handles retries, error handling, and re-registration attempts based on the response, ensuring continuous connectivity with the server.
   * @param keepAliveRetryCount
   * @param url
   * @param logContext
   * @param interval
   * @returns
   */
  public startKeepaliveTimer(url: string, interval: number) {
    let keepAliveRetryCount = 0;
    this.clearKeepaliveTimer();
    this.keepaliveTimer = setInterval(async () => {
      const logContext = {
        file: REGISTRATION_FILE,
        method: this.startKeepaliveTimer.name,
      };
      await this.mutex.runExclusive(async () => {
        if (this.isDeviceRegistered() && keepAliveRetryCount < 5) {
          try {
            const res = await this.postKeepAlive(url);
            log.info(`Sent Keepalive, status: ${res.statusCode}`, logContext);
            if (keepAliveRetryCount > 0) {
              this.emitter(EVENT_KEYS.RECONNECTED);
            }
            keepAliveRetryCount = 0;
          } catch (err: unknown) {
            keepAliveRetryCount += 1;
            const error = <WebexRequestPayload>err;

            log.warn(
              `Keep-alive missed ${keepAliveRetryCount} times. Status -> ${error.statusCode} `,
              logContext
            );

            const abort = await handleRegistrationErrors(
              error,
              (clientError, finalError) => {
                if (finalError) {
                  this.emitter(EVENT_KEYS.ERROR, undefined, clientError);
                }
                this.sendMetric(
                  METRIC_EVENT.REGISTRATION,
                  REG_ACTION.KEEPALIVE_FAILURE,
                  METRIC_TYPE.BEHAVIORAL,
                  clientError
                );
              },
              {method: this.startKeepaliveTimer.name, file: REGISTRATION_FILE}
            );

            if (abort || keepAliveRetryCount >= 5) {
              this.setStatus(MobiusStatus.DEFAULT);
              this.clearKeepaliveTimer();
              this.clearFailbackTimer();
              this.emitter(EVENT_KEYS.UNREGISTERED);

              if (!abort) {
                /* In case of non-final error, re-attempt registration */
                await this.reconnectOnFailure(this.startKeepaliveTimer.name);
              }
            } else {
              this.emitter(EVENT_KEYS.RECONNECTING);
            }
          }
        }
      });
    }, interval * 1000);
  }

  /**
   * Clears the keepalive timer if running.
   */
  public clearKeepaliveTimer() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = undefined;
    }
  }

  public isReconnectPending(): boolean {
    return this.reconnectPending;
  }

  public async deregister() {
    try {
      await this.deleteRegistration(
        this.activeMobiusUrl as string,
        this.deviceInfo.device?.deviceId as string,
        this.deviceInfo.device?.clientDeviceUri as string
      );
    } catch (err) {
      log.warn(`Delete failed with Mobius`, {});
    }

    this.clearKeepaliveTimer();
    this.setStatus(MobiusStatus.DEFAULT);
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

  /**
   * @returns The value of instance variable registerRetry.
   *          Indicates whether the calling client is in a mode
   *          to retry registration.
   */
  private isRegRetry(): boolean {
    return this.registerRetry;
  }

  /**
   * Sets the received value in instance variable
   * registerRetry for registration retry cases.
   *
   * @param value - for registerRetry
   */
  private setRegRetry(value: boolean) {
    this.registerRetry = value;
  }

  /**
   * Restores the deviceInfo object in callingClient when receiving a 403 with error code 101.
   *
   * @param callingClient - Instance of CallingClient.
   * @param restoreData - Data from Mobius with existing device information.
   * @returns Boolean.
   */
  private getExistingDevice(restoreData: IDeviceInfo) {
    if (restoreData.devices && restoreData.devices.length > 0) {
      this.deviceInfo = {
        userId: restoreData.userId,
        device: restoreData.devices[0],
        keepaliveInterval: DEFAULT_KEEPALIVE_INTERVAL,
        rehomingIntervalMax: DEFAULT_REHOMING_INTERVAL_MAX,
        rehomingIntervalMin: DEFAULT_REHOMING_INTERVAL_MIN,
      };

      const stringToReplace = `${DEVICES_ENDPOINT_RESOURCE}/${restoreData.devices[0].deviceId}`;

      const uri = restoreData.devices[0].uri.replace(stringToReplace, '');
      this.setActiveMobiusUrl(uri);
      this.registrationStatus = MobiusStatus.ACTIVE;

      return true;
    }

    return false;
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
  public async reconnectOnFailure(caller: string) {
    this.reconnectPending = false;
    if (!this.isDeviceRegistered()) {
      if (Object.keys(this.callManager.getActiveCalls()).length === 0) {
        const abort = await this.restorePreviousRegistration(caller);

        if (!abort && !this.isDeviceRegistered()) {
          await this.restartRegistration(caller);
        }
      } else {
        this.reconnectPending = true;
        log.info('Active call(s) present, deferred reconnect till call cleanup.', {
          file: REGISTRATION_FILE,
          method: this.reconnectOnFailure.name,
        });
      }
    }
  }
}

/**
 * @param webex - A webex instance.
 * @param serviceData - indicates whether the backend service is calling or contactcentre
 * @param mutex - mutex which is used to run any registration scenario exclusively
 * @param callingClientEmitter - CallingClient emitter for registration related events
 * @param logLevel - log level option for registration module
 */
export const createRegistration = (
  webex: WebexSDK,
  serviceData: ServiceData,
  mutex: Mutex,
  callingClientemitter: CallingClientEmitterCallback,
  logLevel: LOGGER
): IRegistration => new Registration(webex, serviceData, mutex, callingClientemitter, logLevel);
