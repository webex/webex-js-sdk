/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import * as Media from '@webex/internal-media-core';
import {Mutex} from 'async-mutex';
import {filterMobiusUris, handleCallingClientErrors, validateServiceData} from '../common/Utils';
import {LOGGER, LogContext} from '../Logger/types';
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
  NETWORK_FLAP_TIMEOUT,
  API_V1,
  MOBIUS_US_PROD,
  MOBIUS_EU_PROD,
  MOBIUS_US_INT,
  MOBIUS_EU_INT,
} from './constants';
import Line from './line';
import {ILine} from './line/types';
import {METRIC_EVENT, REG_ACTION, METRIC_TYPE, IMetricManager} from '../Metrics/types';
import {getMetricManager} from '../Metrics';

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

  /**
   * @ignore
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
    validateServiceData(serviceData);

    this.callManager = getCallManager(this.webex, serviceData.indicator);
    this.metricManager = getMetricManager(this.webex, serviceData.indicator);

    this.mediaEngine = Media;

    this.primaryMobiusUris = [];
    this.backupMobiusUris = [];
    this.mobiusClusters =
      this.webex.internal.services._hostCatalog[MOBIUS_US_PROD] ||
      this.webex.internal.services._hostCatalog[MOBIUS_EU_PROD] ||
      this.webex.internal.services._hostCatalog[MOBIUS_US_INT] ||
      this.webex.internal.services._hostCatalog[MOBIUS_EU_INT];
    this.mobiusHost = '';

    this.registerSessionsListener();

    log.setLogger(logLevel, CALLING_CLIENT_FILE);

    this.registerCallsClearedListener();
  }

  // async calls required to run after constructor

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
    await this.getMobiusServers();
    await this.createLine();

    /* Better to run the timer once rather than after every registration */
    this.detectNetworkChange();
  }

  /**
   * Register callbacks for network changes.
   */
  private async detectNetworkChange() {
    let retry = false;

    // this is a temporary logic to get registration obj
    // it will change once we have proper lineId and multiple lines as well
    const line = Object.values(this.lineDict)[0];

    setInterval(async () => {
      if (
        !this.webex.internal.mercury.connected &&
        !retry &&
        !Object.keys(this.callManager.getActiveCalls()).length
      ) {
        log.warn(`Network has flapped, waiting for mercury connection to be up`, {
          file: CALLING_CLIENT_FILE,
          method: this.detectNetworkChange.name,
        });

        line.registration.clearKeepaliveTimer();

        retry = true;
      }

      if (retry && this.webex.internal.mercury.connected) {
        if (line.getStatus() !== RegistrationStatus.IDLE) {
          retry = await line.registration.handleConnectionRestoration(retry);
        } else {
          retry = false;
        }
      }
    }, NETWORK_FLAP_TIMEOUT);
  }

  /**
   * Fetches countryCode and region of the client.
   */
  private async getClientRegionInfo(): Promise<RegionInfo> {
    const regionInfo = {} as RegionInfo;

    for (const mobius of this.mobiusClusters) {
      this.mobiusHost = `https://${mobius.host}${API_V1}`;

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

        const clientRegionInfo = response.body as ClientRegionInfo;

        regionInfo.clientRegion = clientRegionInfo?.clientRegion
          ? clientRegionInfo.clientRegion
          : '';

        regionInfo.countryCode = clientRegionInfo?.countryCode ? clientRegionInfo.countryCode : '';
        break;
      } catch (err: unknown) {
        handleCallingClientErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.metricManager.submitRegistrationMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              clientError
            );
            this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, clientError);
          },
          {method: GET_MOBIUS_SERVERS_UTIL, file: CALLING_CLIENT_FILE}
        );
        regionInfo.clientRegion = '';
        regionInfo.countryCode = '';
      }
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
      this.mobiusHost = this.webex.internal.services._serviceUrls.mobius;
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
        // eslint-disable-next-line no-await-in-loop
        const temp = <WebexRequestPayload>await this.webex.request({
          uri: `${this.mobiusHost}${URL_ENDPOINT}?regionCode=${clientRegion}&countryCode=${countryCode}`,
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
        const mobiusUris = filterMobiusUris(mobiusServers, this.mobiusHost);
        this.primaryMobiusUris = mobiusUris.primary;
        this.backupMobiusUris = mobiusUris.backup;
        log.info(
          `Final list of Mobius Servers, primary: ${mobiusUris.primary} and backup: ${mobiusUris.backup}`,
          '' as LogContext
        );
      } catch (err: unknown) {
        handleCallingClientErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.metricManager.submitRegistrationMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              clientError
            );
            this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, clientError);
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
      log.warn(
        `Couldn't resolve the region and country code. Defaulting to the catalog entries to discover mobius servers`,
        '' as LogContext
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
    const logContext = {
      file: CALLING_CLIENT_FILE,
      method: this.registerCallsClearedListener.name,
    };

    log.log('Registering listener for all calls cleared event', logContext);
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
    // this is a temporary logic to get registration obj
    // it will change once we have proper lineId and multiple lines as well
    const {registration} = Object.values(this.lineDict)[0];

    if (!registration.isDeviceRegistered()) {
      await this.mutex.runExclusive(async () => {
        if (registration.isReconnectPending()) {
          log.log('All calls cleared, reconnecting', {
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
