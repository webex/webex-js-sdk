/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import * as Media from '@webex/internal-media-core';
import {Mutex} from 'async-mutex';
import {METHOD_START_MESSAGE} from '../common/constants';
import {
  filterMobiusUris,
  handleCallingClientErrors,
  uploadLogs,
  validateServiceData,
} from '../common/Utils';
import {LOGGER} from '../Logger/types';
import SDKConnector from '../SDKConnector';
import {ClientRegionInfo, ISDKConnector, ServiceHost, WebexSDK} from '../SDKConnector/types';
import {Eventing} from '../Events/impl';
import {
  CallingClientEventTypes,
  MOBIUS_EVENT_KEYS,
  CallSessionEvent,
  SessionType,
  CALLING_CLIENT_EVENT_KEYS,
} from '../Events/types';
import {
  ServiceIndicator,
  RegionInfo,
  ALLOWED_SERVICES,
  HTTP_METHODS,
  IpInfo,
  MobiusServers,
  WebexRequestPayload,
  RegistrationStatus,
  UploadLogsResponse,
} from '../common/types';
import {ICallingClient, CallingClientConfig} from './types';
import {ICall, ICallManager} from './calling/types';
import log from '../Logger';
import {getCallManager} from './calling/callManager';
import {
  CALLING_CLIENT_FILE,
  CALLS_CLEARED_HANDLER_UTIL,
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DISCOVERY_URL,
  GET_MOBIUS_SERVERS_UTIL,
  IP_ENDPOINT,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
  API_V1,
  MOBIUS_US_PROD,
  MOBIUS_EU_PROD,
  MOBIUS_US_INT,
  MOBIUS_EU_INT,
  METHODS,
  NETWORK_FLAP_TIMEOUT,
} from './constants';
import Line from './line';
import {ILine} from './line/types';
import {
  METRIC_EVENT,
  REG_ACTION,
  METRIC_TYPE,
  IMetricManager,
  CONNECTION_ACTION,
  MOBIUS_SERVER_ACTION,
} from '../Metrics/types';
import {getMetricManager} from '../Metrics';
import windowsChromiumIceWarmup from './windowsChromiumIceWarmupUtils';

/**
 * The `CallingClient` module provides a set of APIs for line registration and calling functionalities within the SDK.
 *
 * The following code snippet demonstrates how to create an instance of `CallingClient` using a `webex` instance and `callingConfig`:
 *
 * @example
 * ```javascript
 * const callingClient = createClient(webex, callingConfig);
 * ```
 */

export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private mutex: Mutex;

  private callManager: ICallManager;

  private metricManager: IMetricManager;

  private sdkConfig?: CallingClientConfig;

  private primaryMobiusUris: string[];

  private backupMobiusUris: string[];

  private mobiusClusters: ServiceHost[];

  private mobiusHost: string;

  public mediaEngine: typeof Media;

  private lineDict: Record<string, ILine> = {};

  private isNetworkDown = false;

  private networkDownTimestamp = '';

  private networkUpTimestamp = '';

  private mercuryDownTimestamp = '';

  private mercuryUpTimestamp = '';

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, config?: CallingClientConfig) {
    super();
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
      if (config?.logger?.level && webex.logger.config) {
        webex.logger.config.level = config.logger.level; // override the webex logger level
      }
      log.setWebexLogger(webex.logger);
    }
    this.mutex = new Mutex();
    this.webex = this.sdkConnector.getWebex();

    this.sdkConfig = config;
    const serviceData = this.sdkConfig?.serviceData?.indicator
      ? this.sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    const logLevel = this.sdkConfig?.logger?.level ? this.sdkConfig.logger.level : LOGGER.ERROR;
    log.setLogger(logLevel, CALLING_CLIENT_FILE);
    validateServiceData(serviceData);

    this.callManager = getCallManager(this.webex, serviceData.indicator);
    this.metricManager = getMetricManager(this.webex, serviceData.indicator);

    this.mediaEngine = Media;

    const adaptedLogger: Media.Logger = {
      log: (...args) => webex.logger.log(args.join(' : ')),
      error: (...args) => webex.logger.error(args.join(' : ')),
      warn: (...args) => webex.logger.warn(args.join(' : ')),
      info: (...args) => webex.logger.info(args.join(' : ')),
      trace: (...args) => webex.logger.trace(args.join(' : ')),
      debug: (...args) => webex.logger.debug(args.join(' : ')),
    };

    this.mediaEngine.setLogger(adaptedLogger);

    this.primaryMobiusUris = [];
    this.backupMobiusUris = [];
    let mobiusServiceHost = '';
    try {
      mobiusServiceHost = new URL(this.webex.internal.services._serviceUrls.mobius).host;
    } catch (error) {
      log.warn(`Failed to parse mobius service URL`, {
        file: CALLING_CLIENT_FILE,
        method: this.constructor.name,
      });
    }

    // TODO: This is a temp fix - https://jira-eng-sjc12.cisco.com/jira/browse/CAI-6809
    if (this.webex.internal.services._hostCatalog) {
      this.mobiusClusters =
        (mobiusServiceHost && this.webex.internal.services._hostCatalog[mobiusServiceHost]) ||
        this.webex.internal.services._hostCatalog[MOBIUS_US_PROD] ||
        this.webex.internal.services._hostCatalog[MOBIUS_EU_PROD] ||
        this.webex.internal.services._hostCatalog[MOBIUS_US_INT] ||
        this.webex.internal.services._hostCatalog[MOBIUS_EU_INT];
    } else {
      // @ts-ignore
      const mobiusObject = this.webex.internal.services._services.find(
        // @ts-ignore
        (item) => item.serviceName === 'mobius'
      );
      this.mobiusClusters = [mobiusObject.serviceUrls[0].baseUrl];
    }
    this.mobiusHost = '';

    this.registerSessionsListener();

    this.registerCallsClearedListener();
  }

  /**
   * Initializes the `CallingClient` by performing the following steps:
   *
   * 1. Retrieves list of servers.
   * 2. Creates a line.
   * 3. Sets up network change detection.
   *
   * This method should be called once to initialize the `callingClient`.
   *
   * @returns A promise that resolves when the initialization is complete.
   * @ignore
   */
  public async init() {
    // Only for Windows Chromium based browsers we need to do the ICE warmup
    if (typeof window !== 'undefined' && window?.navigator?.userAgent) {
      const ua = window.navigator.userAgent;
      if (ua.toLowerCase().includes('windows')) {
        log.info('Starting ICE warmup for Windows Chromium based browser', {
          file: CALLING_CLIENT_FILE,
          method: 'init',
        });
        try {
          await windowsChromiumIceWarmup({
            iceServers: [],
            timeoutMs: 1000,
          });
          log.info(`ICE warmup completed`, {
            file: CALLING_CLIENT_FILE,
            method: 'init',
          });
        } catch (err) {
          log.warn(`ICE warmup failed: ${err}`, {
            file: CALLING_CLIENT_FILE,
            method: 'init',
          });
        }
      }
    }

    await this.getMobiusServers();
    await this.createLine();

    this.setupNetworkEventListeners();
  }

  /**
   * Ping a reliable external endpoint with a short timeout to infer connectivity.
   */
  private async checkNetworkReachability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Using a common connectivity check endpoint that returns 204 with minimal payload.
      // no-cors mode yields an opaque response but a successful fetch implies reachability.
      await fetch('https://www.google.com/generate_204', {
        method: 'GET',
        cache: 'no-cache',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return true;
    } catch (error) {
      log.warn(`Network connectivity probe failed: ${error}`, {
        file: CALLING_CLIENT_FILE,
        method: 'pingExternal',
      });

      return false;
    }
  }

  private async checkCallStatus() {
    const loggerContext = {
      file: CALLING_CLIENT_FILE,
      method: 'checkCallStatus',
    };
    const calls = Object.values(this.callManager.getActiveCalls());
    for (const call of calls) {
      call
        .postStatus()
        .then(() => {
          log.info(`Call is active`, loggerContext);
          /*
           * Media Renegotiation Possibility if call keepalive succeeds,
           * for cases like WebRTC disconnect and media inactivity.
           */
        })
        .catch((err) => {
          log.warn(`Call Keepalive failed: ${err}`, loggerContext);

          call.sendCallStateMachineEvt({type: 'E_SEND_CALL_DISCONNECT'});
        });
    }
  }

  private handleNetworkOffline = async () => {
    this.networkDownTimestamp = new Date().toISOString();
    this.isNetworkDown = !(await this.checkNetworkReachability());
    log.warn(`Network has gone down, wait for it to come back up`, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.NETWORK_OFFLINE,
    });

    if (this.isNetworkDown) {
      const line = Object.values(this.lineDict)[0];
      line.registration.clearKeepaliveTimer();
    }
  };

  // Wondering if we should keep this for timestamp recording purpose
  private handleNetworkOnline = () => {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.NETWORK_ONLINE,
    });
    this.networkUpTimestamp = new Date().toISOString();
  };

  private handleMercuryOffline = () => {
    log.warn(`Mercury down, waiting for connection to be up`, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.MERCURY_OFFLINE,
    });
    this.mercuryDownTimestamp = new Date().toISOString();
    this.metricManager.submitConnectionMetrics(
      METRIC_EVENT.CONNECTION_ERROR,
      CONNECTION_ACTION.MERCURY_DOWN,
      METRIC_TYPE.BEHAVIORAL,
      this.mercuryDownTimestamp,
      this.mercuryUpTimestamp
    );
  };

  private handleMercuryOnline = async () => {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.MERCURY_ONLINE,
    });
    this.mercuryUpTimestamp = new Date().toISOString();
    if (this.isNetworkDown) {
      const callCheckInterval = setInterval(async () => {
        if (!Object.keys(this.callManager.getActiveCalls()).length) {
          clearInterval(callCheckInterval);
          const line = Object.values(this.lineDict)[0];

          if (line.getStatus() !== RegistrationStatus.IDLE) {
            this.isNetworkDown = await line.registration.handleConnectionRestoration(
              this.isNetworkDown
            );
          } else {
            this.isNetworkDown = false;
          }
        }
      }, NETWORK_FLAP_TIMEOUT);

      if (Object.keys(this.callManager.getActiveCalls()).length) {
        await this.checkCallStatus();
      }

      this.metricManager.submitConnectionMetrics(
        METRIC_EVENT.CONNECTION_ERROR,
        CONNECTION_ACTION.NETWORK_FLAP,
        METRIC_TYPE.BEHAVIORAL,
        this.networkDownTimestamp,
        this.networkUpTimestamp
      );
    } else {
      if (Object.keys(this.callManager.getActiveCalls()).length) {
        await this.checkCallStatus();
      }
      this.metricManager.submitConnectionMetrics(
        METRIC_EVENT.CONNECTION_ERROR,
        CONNECTION_ACTION.MERCURY_UP,
        METRIC_TYPE.BEHAVIORAL,
        this.mercuryDownTimestamp,
        this.mercuryUpTimestamp
      );
    }
  };

  private setupNetworkEventListeners(): void {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', this.handleNetworkOnline);

      window.addEventListener('offline', this.handleNetworkOffline);
    }

    this.webex.internal.mercury.on('offline', () => {
      this.handleMercuryOffline();
    });

    this.webex.internal.mercury.on('online', () => {
      this.handleMercuryOnline();
    });
  }

  /**
   * Fetches countryCode and region of the client.
   */
  private async getClientRegionInfo(): Promise<RegionInfo> {
    let abort;
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.GET_CLIENT_REGION_INFO,
    });
    const regionInfo = {} as RegionInfo;

    for (const mobius of this.mobiusClusters) {
      if (mobius.host) {
        this.mobiusHost = `https://${mobius.host}${API_V1}`;
      } else {
        this.mobiusHost = mobius as unknown as string;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const temp = <WebexRequestPayload>await this.webex.request({
          uri: `${this.mobiusHost}${URL_ENDPOINT}${IP_ENDPOINT}`,
          method: HTTP_METHODS.GET,
          headers: {
            [CISCO_DEVICE_URL]: this.webex.internal.device.url,
            [SPARK_USER_AGENT]: CALLING_USER_AGENT,
          },
          service: ALLOWED_SERVICES.MOBIUS,
        });

        log.log(`Response trackingId: ${temp?.headers?.trackingid}`, {
          file: CALLING_CLIENT_FILE,
          method: METHODS.GET_CLIENT_REGION_INFO,
        });

        const myIP = (temp.body as IpInfo).ipv4;

        // eslint-disable-next-line no-await-in-loop
        const response = <WebexRequestPayload>await this.webex.request({
          uri: `${DISCOVERY_URL}/${myIP}`,
          method: HTTP_METHODS.GET,
          addAuthHeader: false,
          headers: {
            [SPARK_USER_AGENT]: null,
          },
        });

        log.log(`Response trackingId: ${response?.headers?.trackingid}`, {
          file: CALLING_CLIENT_FILE,
          method: METHODS.GET_CLIENT_REGION_INFO,
        });

        const clientRegionInfo = response.body as ClientRegionInfo;

        regionInfo.clientRegion = clientRegionInfo?.clientRegion
          ? clientRegionInfo.clientRegion
          : '';

        regionInfo.countryCode = clientRegionInfo?.countryCode ? clientRegionInfo.countryCode : '';

        log.log(
          `Successfully fetched Client region info: ${regionInfo.clientRegion}, countryCode: ${regionInfo.countryCode}, and response trackingid: ${response?.headers?.trackingid}`,
          {
            file: CALLING_CLIENT_FILE,
            method: METHODS.GET_CLIENT_REGION_INFO,
          }
        );

        // Metrics for region info - trying clusters in loop
        this.metricManager.submitRegionInfoMetric(
          METRIC_EVENT.MOBIUS_DISCOVERY,
          MOBIUS_SERVER_ACTION.REGION_INFO,
          METRIC_TYPE.BEHAVIORAL,
          this.mobiusHost,
          clientRegionInfo.clientRegion,
          clientRegionInfo.countryCode,
          response?.headers?.trackingid ?? ''
        );

        break;
      } catch (err: unknown) {
        log.error(`Failed to get client region info: ${JSON.stringify(err)}`, {
          method: METHODS.GET_CLIENT_REGION_INFO,
          file: CALLING_CLIENT_FILE,
        });

        // eslint-disable-next-line no-await-in-loop
        abort = await handleCallingClientErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.metricManager.submitRegistrationMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              GET_MOBIUS_SERVERS_UTIL,
              'UNKNOWN',
              (err as WebexRequestPayload).headers?.trackingId ?? '',
              undefined,
              clientError
            );
            this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, clientError);
          },
          {method: GET_MOBIUS_SERVERS_UTIL, file: CALLING_CLIENT_FILE}
        );

        regionInfo.clientRegion = '';
        regionInfo.countryCode = '';

        if (abort) {
          // eslint-disable-next-line no-await-in-loop
          await uploadLogs();

          return regionInfo;
        }
      }
    }

    return regionInfo;
  }

  /**
   * Local method for finding the mobius servers.
   */
  private async getMobiusServers() {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.GET_MOBIUS_SERVERS,
    });
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
      log.log('Updating region and country from the SDK config', {
        file: CALLING_CLIENT_FILE,
        method: GET_MOBIUS_SERVERS_UTIL,
      });
      clientRegion = this.sdkConfig?.discovery?.region;
      countryCode = this.sdkConfig?.discovery?.country;
      this.mobiusHost = this.webex.internal.services._serviceUrls.mobius;
    } else {
      log.log('Updating region and country through Region discovery', {
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
        {
          file: CALLING_CLIENT_FILE,
          method: GET_MOBIUS_SERVERS_UTIL,
        }
      );

      try {
        // eslint-disable-next-line no-await-in-loop
        const response = <WebexRequestPayload>await this.webex.request({
          uri: `${this.mobiusHost}${URL_ENDPOINT}?regionCode=${clientRegion}&countryCode=${countryCode}`,
          method: HTTP_METHODS.GET,
          headers: {
            [CISCO_DEVICE_URL]: this.webex.internal.device.url,
            [SPARK_USER_AGENT]: CALLING_USER_AGENT,
          },
          service: ALLOWED_SERVICES.MOBIUS,
        });

        log.log(
          `Mobius Server found for the region. Response trackingId: ${response?.headers?.trackingid}`,
          {
            file: CALLING_CLIENT_FILE,
            method: GET_MOBIUS_SERVERS_UTIL,
          }
        );

        const mobiusServers = response.body as MobiusServers;

        // Metrics for mobius servers
        this.metricManager.submitMobiusServersMetric(
          METRIC_EVENT.MOBIUS_DISCOVERY,
          MOBIUS_SERVER_ACTION.MOBIUS_SERVERS,
          METRIC_TYPE.BEHAVIORAL,
          mobiusServers,
          response?.headers?.trackingid ?? ''
        );

        /* update arrays of Mobius Uris. */
        const mobiusUris = filterMobiusUris(mobiusServers, this.mobiusHost);
        this.primaryMobiusUris = mobiusUris.primary;
        this.backupMobiusUris = mobiusUris.backup;

        log.log(
          `Final list of Mobius Servers, primary: ${mobiusUris.primary} and backup: ${mobiusUris.backup}`,
          {
            file: CALLING_CLIENT_FILE,
            method: GET_MOBIUS_SERVERS_UTIL,
          }
        );
      } catch (err: unknown) {
        log.error(`Failed to get Mobius servers: ${JSON.stringify(err)}`, {
          method: METHODS.GET_MOBIUS_SERVERS,
          file: CALLING_CLIENT_FILE,
        });

        const abort = await handleCallingClientErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.metricManager.submitRegistrationMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              GET_MOBIUS_SERVERS_UTIL,
              'UNKNOWN',
              (err as WebexRequestPayload).headers?.trackingId ?? '',
              undefined,
              clientError
            );
            this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, clientError);
          },
          {method: GET_MOBIUS_SERVERS_UTIL, file: CALLING_CLIENT_FILE}
        );

        if (abort) {
          // Upload logs on final error
          await uploadLogs();
        }

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
      log.warn(
        `Couldn't resolve the region and country code. Defaulting to the catalog entries to discover mobius servers`,
        {
          file: CALLING_CLIENT_FILE,
          method: GET_MOBIUS_SERVERS_UTIL,
        }
      );
      this.mobiusHost = `https://${this.mobiusClusters[0].host}${API_V1}`;
      this.primaryMobiusUris = [`${this.mobiusHost}${URL_ENDPOINT}`];
    }
  }

  /**
   * Registers a listener/handler for ALL_CALLS_CLEARED
   * event emitted by callManager when all the calls
   * present on sdk are cleaned up.
   */
  private registerCallsClearedListener() {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.REGISTER_CALLS_CLEARED_LISTENER,
    });

    this.callManager.on(CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED, this.callsClearedHandler);
  }

  /**
   * Handler registered for ALL_CALLS_CLEARED event emitted by callManager.
   *
   * If re-register attempt was deferred earlier due to active call(s), then it
   * will be attempted here on receiving a notification from callManager that all
   * calls are cleaned up.
   */
  private callsClearedHandler = async () => {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.CALLS_CLEARED_HANDLER,
    });
    // this is a temporary logic to get registration obj
    // it will change once we have proper lineId and multiple lines as well
    const {registration} = Object.values(this.lineDict)[0];

    if (!registration.isDeviceRegistered()) {
      await this.mutex.runExclusive(async () => {
        if (registration.isReconnectPending()) {
          log.info('All calls cleared, reconnecting', {
            file: CALLING_CLIENT_FILE,
            method: CALLS_CLEARED_HANDLER_UTIL,
          });
          await registration.reconnectOnFailure(CALLS_CLEARED_HANDLER_UTIL);
        }
      });
    }
  };

  /**
   * To get the current log Level.
   * @ignore
   */
  public getLoggingLevel(): LOGGER {
    return log.getLogLevel();
  }

  /**
   *  To return the `sdkConnector` instance that was used during sdk initialisation.
   * @ignore
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }

  private registerSessionsListener() {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.REGISTER_SESSIONS_LISTENER,
    });
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
          this.emit(CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO, event as CallSessionEvent);
        }
      }
    );
  }

  /**
   * Creates line object inside calling client per user
   * NOTE: currently multiple lines are not supported
   */
  private async createLine(): Promise<void> {
    log.info(METHOD_START_MESSAGE, {
      file: CALLING_CLIENT_FILE,
      method: METHODS.CREATE_LINE,
    });
    const line = new Line(
      this.webex.internal.device.userId,
      this.webex.internal.device.url,
      this.mutex,
      this.primaryMobiusUris,
      this.backupMobiusUris,
      this.getLoggingLevel(),
      this.sdkConfig?.serviceData,
      this.sdkConfig?.jwe
    );

    this.lineDict[line.lineId] = line;
  }

  /**
   * Retrieves details of all the Line objects belonging to a User
   * NOTE: currently multiple lines are not supported
   */
  public getLines(): Record<string, ILine> {
    return this.lineDict;
  }

  /**
   * Retrieves call objects for all the active calls present in the client
   */
  public getActiveCalls(): Record<string, ICall[]> {
    const activeCalls = {};
    const calls = this.callManager.getActiveCalls();
    Object.keys(calls).forEach((correlationId) => {
      const call = calls[correlationId];
      if (!activeCalls[call.lineId]) {
        activeCalls[call.lineId] = [];
      }
      activeCalls[call.lineId].push(call);
    });

    return activeCalls;
  }

  /**
   * Retrieves call object for the connected call in the client
   */
  public getConnectedCall(): ICall | undefined {
    let connectCall;
    const calls = this.callManager.getActiveCalls();

    Object.keys(calls).forEach((correlationId) => {
      if (calls[correlationId].isConnected() && !calls[correlationId].isHeld()) {
        connectCall = calls[correlationId];
      }
    });

    return connectCall;
  }

  /**
   * Uploads logs to help troubleshoot SDK issues.
   *
   * This method collects the current SDK logs including network requests, WebSocket
   * messages, and client-side events, then securely submits them to Webex's diagnostics
   * service. The returned tracking ID, feedbackID can be provided to Webex support for faster
   * issue resolution.
   * @returns Promise<UploadLogsResponse>
   * @throws Error
   */
  public async uploadLogs(): Promise<UploadLogsResponse> {
    const result = await uploadLogs({}, true);
    if (!result) {
      throw new Error('Failed to upload logs: No response received.');
    }

    return result;
  }
}

/**
 * Create the `CallingClient` instance using the `webex` object and callingSdk `config`
 * @param webex - A webex instance.
 * @param config - Config to start the CallingClient with.
 */
export const createClient = async (
  webex: WebexSDK,
  config?: CallingClientConfig
): Promise<ICallingClient> => {
  const callingClientInstance = new CallingClient(webex, config);
  await callingClientInstance.init();

  return callingClientInstance;
};
