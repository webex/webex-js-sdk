import {Mutex} from 'async-mutex';
import {
  ALLOWED_SERVICES,
  HTTP_METHODS,
  IDeviceInfo,
  IpInfo,
  MobiusDeviceId,
  MobiusServers,
  MobiusStatus,
  RegionInfo,
  ServiceIndicator,
  WebexRequestPayload,
} from '../../common/types';
import {ICallSettingResponse, ILine, LINE_EVENTS, LineEventTypes, LineStatus} from './types';
import {
  LINE_FILE,
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DISCOVERY_URL,
  GET_MOBIUS_SERVERS_UTIL,
  IP_ENDPOINT,
  KEEPALIVE_UTIL,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
  REGISTRATION_FILE,
  NETWORK_FLAP_TIMEOUT,
} from '../constants';
import log from '../../Logger';
import {IRegistration} from '../registration/types';
import {createRegistration} from '../registration';
import {ClientRegionInfo, ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {CallingClientConfig} from '../types';
import {Eventing} from '../../Events/impl';
import {LineError} from '../../Errors/catalog/LineError';
import {METRIC_EVENT, REG_ACTION, METRIC_TYPE} from '../metrics/types';
import {LOGGER, LogContext} from '../../Logger/types';
import {handleRegistrationErrors, filterMobiusUris, validateServiceData} from '../../common';
import SDKConnector from '../../SDKConnector';
import {ICallManager} from '../calling/types';

export default class Line extends Eventing<LineEventTypes> implements ILine {
  #webex: WebexSDK;

  #mutex: Mutex;

  #registration: IRegistration;

  #sdkConfig: CallingClientConfig | undefined;

  #sdkConnector: ISDKConnector;

  #callManager: ICallManager;

  public userId: string;

  public clientDeviceUri: string;

  public lineId: string;

  public phoneNumber: string;

  public extension: string;

  public status: LineStatus;

  public sipAddresses: string[];

  public voicemail: string;

  public lastSeen: string;

  public keepaliveInterval: number;

  public callKeepaliveInterval: number;

  public rehomingIntervalMin: number;

  public rehomingIntervalMax: number;

  public voicePortalNumber: number;

  public voicePortalExtension: number;

  #primaryMobiusUris: string[];

  #backupMobiusUris: string[];

  constructor(
    userId: string,
    clientDeviceUri: string,
    lineId: string,
    phoneNumber: string,
    extension: string,
    status: LineStatus,
    sipAddresses: string[],
    voicemail: string,
    lastSeen: string,
    keepaliveInterval: number,
    callKeepaliveInterval: number,
    rehomingIntervalMin: number,
    rehomingIntervalMax: number,
    voicePortalNumber: number,
    voicePortalExtension: number,
    callManager: ICallManager,
    mutex: Mutex,
    config?: CallingClientConfig
  ) {
    super();
    this.userId = userId;
    this.clientDeviceUri = clientDeviceUri;
    this.lineId = lineId;
    this.phoneNumber = phoneNumber;
    this.extension = extension;
    this.status = status;
    this.sipAddresses = sipAddresses;
    this.voicemail = voicemail;
    this.lastSeen = lastSeen;
    this.keepaliveInterval = keepaliveInterval;
    this.callKeepaliveInterval = callKeepaliveInterval;
    this.rehomingIntervalMin = rehomingIntervalMin;
    this.rehomingIntervalMax = rehomingIntervalMax;
    this.voicePortalNumber = voicePortalNumber;
    this.voicePortalExtension = voicePortalExtension;

    this.#sdkConnector = SDKConnector;
    this.#webex = this.#sdkConnector.getWebex();
    this.#callManager = callManager;
    this.#mutex = mutex;

    this.#primaryMobiusUris = [];
    this.#backupMobiusUris = [];

    this.#sdkConfig = config;
    const serviceData = this.#sdkConfig?.serviceData?.indicator
      ? this.#sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    const logLevel = this.#sdkConfig?.logger?.level ? this.#sdkConfig.logger.level : LOGGER.ERROR;
    validateServiceData(serviceData);

    this.#registration = createRegistration(
      this.#webex,
      serviceData,
      this.#mutex,
      this.lineEmitter,
      logLevel
    );

    this.#registration.setStatus(MobiusStatus.DEFAULT);
    log.setLogger(logLevel, LINE_FILE);

    /* Better to run the timer once rather than after every registration */
    this.detectNetworkChange('class');
  }

  /**
   * Register callbacks for network changes.
   *
   */
  private async detectNetworkChange(flag = 'test') {
    let retry = false;

    setInterval(async () => {
      if (
        !this.#webex.internal.mercury.connected &&
        !retry &&
        Object.keys(this.#callManager.getActiveCalls()).length === 0
      ) {
        log.warn(`Network has flapped, waiting for mercury connection to be up`, {
          file: REGISTRATION_FILE,
          method: this.detectNetworkChange.name,
        });

        this.lineEmitter(LINE_EVENTS.UNREGISTERED);
        this.#registration.clearKeepaliveTimer();

        retry = true;
      }

      if (retry && this.#webex.internal.mercury.connected) {
        retry = await this.#registration.handleConnectionRestoration(retry);
      }
    }, NETWORK_FLAP_TIMEOUT);
  }

  /**
   * Fetches countryCode and region of the client.
   */
  private async getClientRegionInfo(): Promise<RegionInfo> {
    const regionInfo = {} as RegionInfo;

    try {
      const temp = <WebexRequestPayload>await this.#webex.request({
        uri: `${this.#webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}${IP_ENDPOINT}`,
        method: HTTP_METHODS.GET,
        headers: {
          [CISCO_DEVICE_URL]: this.#webex.internal.device.url,
          [SPARK_USER_AGENT]: CALLING_USER_AGENT,
        },
        service: ALLOWED_SERVICES.MOBIUS,
      });

      const myIP = (temp.body as IpInfo).ipv4;
      const response = <WebexRequestPayload>await this.#webex.request({
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
          this.#registration.sendMetric(
            METRIC_EVENT.REGISTRATION_ERROR,
            REG_ACTION.REGISTER,
            METRIC_TYPE.BEHAVIORAL,
            clientError
          );
          this.emit(LINE_EVENTS.ERROR, clientError);
        },
        {method: GET_MOBIUS_SERVERS_UTIL, file: LINE_FILE}
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

    if (this.#sdkConfig?.discovery?.country && this.#sdkConfig?.discovery?.region) {
      log.info('Updating region and country from the SDK config', {
        file: LINE_FILE,
        method: GET_MOBIUS_SERVERS_UTIL,
      });
      clientRegion = this.#sdkConfig?.discovery?.region;
      countryCode = this.#sdkConfig?.discovery?.country;
    } else {
      log.info('Updating region and country through Region discovery', {
        file: LINE_FILE,
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
        const temp = <WebexRequestPayload>await this.#webex.request({
          uri: `${
            this.#webex.internal.services._serviceUrls.mobius
          }${URL_ENDPOINT}?regionCode=${clientRegion}&countryCode=${countryCode}`,
          method: HTTP_METHODS.GET,
          headers: {
            [CISCO_DEVICE_URL]: this.#webex.internal.device.url,
            [SPARK_USER_AGENT]: CALLING_USER_AGENT,
          },
          service: ALLOWED_SERVICES.MOBIUS,
        });

        log.log('Mobius Server found for the region', '' as LogContext);
        const mobiusServers = temp.body as MobiusServers;

        /* update arrays of Mobius Uris. */
        const mobiusUris = filterMobiusUris(
          mobiusServers,
          this.#webex.internal.services._serviceUrls.mobius
        );
        this.#primaryMobiusUris = mobiusUris.primary;
        this.#backupMobiusUris = mobiusUris.backup;
        log.info(
          `Final list of Mobius Servers, primary: ${mobiusUris.primary} and backup: ${mobiusUris.backup}`,
          '' as LogContext
        );
      } catch (err: unknown) {
        handleRegistrationErrors(
          err as WebexRequestPayload,
          (clientError) => {
            this.#registration.sendMetric(
              METRIC_EVENT.REGISTRATION_ERROR,
              REG_ACTION.REGISTER,
              METRIC_TYPE.BEHAVIORAL,
              clientError
            );
            this.emit(LINE_EVENTS.ERROR, clientError);
          },
          {method: GET_MOBIUS_SERVERS_UTIL, file: LINE_FILE}
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
      this.#primaryMobiusUris = [
        `${this.#webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`,
      ];
    }
  }

  /**
   * Wrapper to for device registration.
   *
   * @param retry - Retry in case of errors.
   */
  public async register() {
    await this.#mutex.runExclusive(async () => {
      this.#registration.setStatus(MobiusStatus.DEFAULT);
      this.emit(LINE_EVENTS.CONNECTING);

      /* Don't do a discovery if we already have the servers list */
      if (this.#primaryMobiusUris.length === 0) {
        await this.getMobiusServers();
      }

      this.#registration.setMobiusServers(this.#primaryMobiusUris, this.#backupMobiusUris);
      await this.#registration.triggerRegistration();
    });
  }

  /**
   * Wrapper to for device  deregister.
   */
  public async deregister() {
    this.#registration.deregister();
  }

  // will be done as part of call related jira

  public getCallForwardSetting(): Promise<ICallSettingResponse> {
    return Promise.resolve({dummy: 'dummy'});
    // return callSettingInstance.getCallForwardSetting()
  }

  public getCallWaitingSetting(): Promise<ICallSettingResponse> {
    return Promise.resolve({dummy: 'dummy'});
    // return callSettingInstance.getCallWaitingSetting()
  }

  public setCallWaitingSetting(): Promise<ICallSettingResponse> {
    return Promise.resolve({dummy: 'dummy'});
    // return callSettingInstance.setCallWaitingSetting()
  }

  public setCallForwardSetting(): Promise<ICallSettingResponse> {
    return Promise.resolve({dummy: 'dummy'});
    // return callSettingInstance.setCallForwardSetting()
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
      file: LINE_FILE,
      method: KEEPALIVE_UTIL,
    };

    this.#registration.clearKeepaliveTimer();

    log.info(
      `Fetched details :-> deviceId: ${deviceId}, interval :-> ${interval}, url: ${url}`,
      logContext
    );

    if (this.#registration.isDeviceRegistered()) {
      this.#registration.startKeepaliveTimer(url, interval);
    } else {
      log.warn('Device is not active, exiting.', logContext);
    }
  }

  private lineEmitter = (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => {
    switch (event) {
      case LINE_EVENTS.REGISTERED:
        if (deviceInfo) {
          this.emit(event, deviceInfo);
        }
        break;
      case LINE_EVENTS.UNREGISTERED:
      case LINE_EVENTS.RECONNECTED:
      case LINE_EVENTS.RECONNECTING:
        this.emit(event);
        break;
      case LINE_EVENTS.ERROR:
        if (lineError) {
          this.emit(event, lineError);
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
    return this.#registration.getActiveMobiusUrl();
  }

  /**
   *
   */
  public getRegistrationStatus = (): MobiusStatus => this.#registration.getStatus();

  /**
   *
   */
  public getDeviceId = (): MobiusDeviceId | undefined =>
    this.#registration.getDeviceInfo().device?.deviceId;
}
