/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import * as Media from '@webex/internal-media-core';
import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';
import {validateServiceData} from '../common/Utils';
import {ERROR_TYPE} from '../Errors/types';
import {LOGGER} from '../Logger/types';
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {Eventing} from '../Events/impl';
import {
  EVENT_KEYS,
  CallingClientEventTypes,
  MOBIUS_EVENT_KEYS,
  CallSessionEvent,
  SessionType,
} from '../Events/types';
import {
  MobiusStatus,
  CallDirection,
  CallDetails,
  CorrelationId,
  ServiceIndicator,
} from '../common/types';
import {ICallingClient, CallingClientConfig} from './types';
import {ICall, ICallManager} from './calling/types';
import log from '../Logger';
import {getCallManager} from './calling/callManager';
import {CALLING_CLIENT_FILE, VALID_PHONE, CALLS_CLEARED_HANDLER_UTIL} from './constants';
import {CallingClientError} from '../Errors';
import Line from './line';
import {LineStatus} from './line/types';

/**
 *
 */
export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private mutex: Mutex;

  private callManager: ICallManager;

  private sdkConfig: CallingClientConfig | undefined;

  public mediaEngine: typeof Media;

  private lineDict: object = {};

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
    validateServiceData(serviceData);

    this.callManager = getCallManager(this.webex, serviceData.indicator);

    this.mediaEngine = Media;
    this.registerSessionsListener();

    log.setLogger(logLevel, CALLING_CLIENT_FILE);

    this.incomingCallListener();
    this.registerCallsClearedListener();
    this.createLine();
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
   *
   * @returns - Log level.
   */
  public getLoggingLevel(): LOGGER {
    return log.getLogLevel();
  }

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

    // this is a temporary logic to get registration obj
    // it will change once we have proper lineId and multiple lines as well
    const {registration} = Object.values(this.lineDict)[0];

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
          registration.getDeviceInfo().device?.deviceId as string
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
   *
   */
  private createLine() {
    const lineId = uuid();

    const lineInstance = new Line(
      // dummy values
      this.webex.internal.device.userId,
      this.webex.internal.device.url,
      lineId,
      '131212345',
      '212343435',
      LineStatus.INACTIVE,
      ['add1', 'add2'],
      '321232343',
      '00',
      100,
      200,
      50,
      20,
      100100100,
      10,
      this.callManager,
      this.mutex,
      this.sdkConfig
    );

    this.lineDict[lineId] = lineInstance;
  }

  /**
   *
   */
  public getLines() {
    return this.lineDict;
  }
}

/**
 * @param webex - A webex instance.
 * @param config - Config to start the CallingClient with..
 */
export const createClient = (webex: WebexSDK, config?: CallingClientConfig): ICallingClient =>
  new CallingClient(webex, config);
