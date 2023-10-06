/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import {BrowserDetection} from '@webex/common';
import uuid from 'uuid';
import {merge} from 'lodash';
import {StatelessWebexPlugin} from '@webex/webex-core';

import {
  anonymizeIPAddress,
  clearEmptyKeysRecursively,
  isLocusServiceErrorCode,
  prepareDiagnosticMetricItem,
  userAgentToString,
  extractVersionMetadata,
  isMeetingInfoServiceError,
  isBrowserMediaErrorName,
} from './call-diagnostic-metrics.util';
import {CLIENT_NAME} from '../config';
import {
  Event,
  ClientType,
  SubClientType,
  NetworkType,
  EnvironmentType,
  ClientEvent,
  SubmitClientEventOptions,
  MediaQualityEvent,
  SubmitMQEOptions,
  SubmitMQEPayload,
  ClientLaunchMethodType,
  ClientEventError,
  ClientEventPayload,
  ClientInfo,
  ClientEventPayloadError,
} from '../metrics.types';
import CallDiagnosticEventsBatcher from './call-diagnostic-metrics-batcher';
import {
  CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD,
  CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND,
  NEW_LOCUS_ERROR_CLIENT_CODE,
  SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP,
  UNKNOWN_ERROR,
  BROWSER_MEDIA_ERROR_NAME_TO_CLIENT_ERROR_CODES_MAP,
  MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE,
  CALL_DIAGNOSTIC_LOG_IDENTIFIER,
} from './config';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

type GetOriginOptions = {
  clientType: ClientType;
  subClientType: SubClientType;
  networkType?: NetworkType;
  clientLaunchMethod?: ClientLaunchMethodType;
  environment?: EnvironmentType;
};

type GetIdentifiersOptions = {
  meeting?: any;
  mediaConnections?: any[];
  correlationId?: string;
};

/**
 * @description Util class to handle Call Analyzer Metrics
 * @export
 * @class CallDiagnosticMetrics
 */
export default class CallDiagnosticMetrics extends StatelessWebexPlugin {
  // @ts-ignore
  private callDiagnosticEventsBatcher: CallDiagnosticEventsBatcher;
  private logger: any; // to avoid adding @ts-ignore everywhere

  /**
   * Constructor
   * @param args
   */
  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.logger = this.webex.logger;
    // @ts-ignore
    this.callDiagnosticEventsBatcher = new CallDiagnosticEventsBatcher({}, {parent: this.webex});
  }

  /**
   * Returns the login type of the current user
   * @returns one of 'login-ci','unverified-guest', null
   */
  getCurLoginType() {
    // @ts-ignore
    if (this.webex.canAuthorize) {
      // @ts-ignore
      return this.webex.credentials.isUnverifiedGuest ? 'unverified-guest' : 'login-ci';
    }

    return null;
  }

  /**
   * Returns if the meeting has converged architecture enabled
   * @param options.meetingId
   */
  getIsConvergedArchitectureEnabled({meetingId}: {meetingId?: string}): boolean {
    if (meetingId) {
      // @ts-ignore
      const meeting = this.webex.meetings.meetingCollection.get(meetingId);

      return meeting?.meetingInfo?.enableConvergedArchitecture;
    }

    return undefined;
  }

  /**
   * Get origin object for Call Diagnostic Event payload.
   * @param options
   * @param meetingId
   * @returns
   */
  getOrigin(options: GetOriginOptions, meetingId?: string) {
    const defaultClientType: ClientType =
      // @ts-ignore
      this.webex.meetings.config?.metrics?.clientType;
    const defaultSubClientType: SubClientType =
      // @ts-ignore
      this.webex.meetings.config?.metrics?.subClientType;
    // @ts-ignore
    const providedClientVersion: string = this.webex.meetings.config?.metrics?.clientVersion;
    // @ts-ignore
    const defaultSDKClientVersion = `${CLIENT_NAME}/${this.webex.version}`;

    let versionMetadata: Pick<ClientInfo, 'majorVersion' | 'minorVersion'> = {};

    // sdk version split doesn't really make sense for now...
    if (providedClientVersion) {
      versionMetadata = extractVersionMetadata(providedClientVersion);
    }

    if (
      (defaultClientType && defaultSubClientType) ||
      (options.clientType && options.subClientType)
    ) {
      const origin: Event['origin'] = {
        name: 'endpoint',
        networkType: options?.networkType || 'unknown',
        userAgent: userAgentToString({
          // @ts-ignore
          clientName: this.webex.meetings?.metrics?.clientName,
          // @ts-ignore
          webexVersion: this.webex.version,
        }),
        clientInfo: {
          clientType: options?.clientType || defaultClientType,
          clientVersion: providedClientVersion || defaultSDKClientVersion,
          ...versionMetadata,
          localNetworkPrefix:
            // @ts-ignore
            anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress) || undefined,
          osVersion: getOSVersion() || 'unknown',
          subClientType: options?.subClientType || defaultSubClientType,
          os: getOSNameInternal(),
          browser: getBrowserName(),
          browserVersion: getBrowserVersion(),
          clientLaunchMethod: options?.clientLaunchMethod, // do we want something by default
        },
      };

      if (meetingId) {
        // @ts-ignore
        const meeting = this.webex.meetings.meetingCollection.get(meetingId);
        if (meeting?.environment) {
          origin.environment = meeting.environment;
        }
      }

      if (options?.environment) {
        origin.environment = options.environment;
      }

      return origin;
    }

    throw new Error("ClientType and SubClientType can't be undefined");
  }

  /**
   * Gather identifier details for call diagnostic payload.
   * @throws Error if initialization fails.
   * @param options
   */
  getIdentifiers(options: GetIdentifiersOptions) {
    const {meeting, mediaConnections, correlationId} = options;
    const identifiers: Event['event']['identifiers'] = {correlationId: 'unknown'};

    if (meeting) {
      identifiers.correlationId = meeting.correlationId;
    }

    if (correlationId) {
      identifiers.correlationId = correlationId;
    }
    // @ts-ignore
    if (this.webex.internal) {
      // @ts-ignore
      const {device} = this.webex.internal;
      identifiers.userId = device.userId;
      identifiers.deviceId = device.url;
      identifiers.orgId = device.orgId;
      // @ts-ignore
      identifiers.locusUrl = this.webex.internal.services.get('locus');
    }

    if (meeting?.locusInfo?.fullState) {
      identifiers.locusUrl = meeting.locusUrl;
      identifiers.locusId = meeting.locusUrl && meeting.locusUrl.split('/').pop();
      identifiers.locusStartTime =
        meeting.locusInfo.fullState && meeting.locusInfo.fullState.lastActive;
    }

    if (mediaConnections) {
      identifiers.mediaAgentAlias = mediaConnections?.[0]?.mediaAgentAlias;
      identifiers.mediaAgentGroupId = mediaConnections?.[0]?.mediaAgentGroupId;
    }

    if (identifiers.correlationId === undefined) {
      throw new Error('Identifiers initialization failed.');
    }

    return identifiers;
  }

  /**
   * Create diagnostic event, which can hold client event, feature event or MQE event data.
   * This just initiates the shared properties that are required for all the 3 event categories.
   * @param eventData
   * @param options
   * @returns
   */
  prepareDiagnosticEvent(eventData: Event['event'], options: any) {
    const {meetingId} = options;
    const origin = this.getOrigin(options, meetingId);

    const event: Event = {
      eventId: uuid.v4(),
      version: 1,
      origin,
      originTime: {
        triggered: new Date().toISOString(),
        // is overridden in prepareRequest batcher
        sent: 'not_defined_yet',
      },
      // @ts-ignore
      senderCountryCode: this.webex.meetings.geoHintInfo?.countryCode,
      event: eventData,
    };

    // sanitize (remove empty properties, CA requires it)
    // but we don't want to sanitize MQE as most of the times
    // values will be 0, [] etc, and they are required.
    if (eventData.name !== 'client.mediaquality.event') {
      clearEmptyKeysRecursively(event);
    }

    return event;
  }

  /**
   * TODO: NOT IMPLEMENTED
   * Submit Feature Event
   * @returns
   */
  public submitFeatureEvent() {
    throw Error('Not implemented');
  }

  /**
   * Submit Media Quality Event
   * @param args - submit params
   * @param arg.name - event key
   * @param arg.payload - additional payload to be merge with the default payload
   * @param arg.options - options
   */
  submitMQE({
    name,
    payload,
    options,
  }: {
    name: MediaQualityEvent['name'];
    payload: SubmitMQEPayload;
    options: SubmitMQEOptions;
  }) {
    const {meetingId, mediaConnections} = options;

    // events that will most likely happen in join phase
    if (meetingId) {
      // @ts-ignore
      const meeting = this.webex.meetings.meetingCollection.get(meetingId);

      if (!meeting) {
        console.warn(
          'Attempt to send MQE but no meeting was found...',
          `event: ${name}, meetingId: ${meetingId}`
        );
        // @ts-ignore
        this.webex.internal.metrics.submitClientMetrics(CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND, {
          fields: {
            meetingId,
            name,
          },
        });

        return;
      }

      // merge identifiers
      const identifiers = this.getIdentifiers({
        meeting,
        mediaConnections: meeting.mediaConnections || mediaConnections,
      });

      // create media quality event object
      let clientEventObject: MediaQualityEvent['payload'] = {
        name,
        canProceed: true,
        identifiers,
        eventData: {
          webClientDomain: window.location.hostname,
        },
        intervals: payload.intervals,
        sourceMetadata: {
          applicationSoftwareType: CLIENT_NAME,
          // @ts-ignore
          applicationSoftwareVersion: this.webex.version,
          mediaEngineSoftwareType: getBrowserName() || 'browser',
          mediaEngineSoftwareVersion: getOSVersion() || 'unknown',
          startTime: new Date().toISOString(),
        },
      };

      // merge any new properties, or override existing ones
      clientEventObject = merge(clientEventObject, payload);

      // append media quality event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);
      this.submitToCallDiagnostics(diagnosticEvent);
    } else {
      throw new Error(
        'Media quality events cant be sent outside the context of a meeting. Meeting id is required.'
      );
    }
  }

  /**
   * Return Client Event payload by client error code
   * @param arg - get error arg
   * @param arg.clientErrorCode
   * @param arg.serviceErrorCode
   * @returns
   */
  public getErrorPayloadForClientErrorCode({
    clientErrorCode,
    serviceErrorCode,
    serviceErrorName,
  }: {
    clientErrorCode: number;
    serviceErrorCode: any;
    serviceErrorName?: any;
  }): ClientEventError {
    let error: ClientEventError;

    if (clientErrorCode) {
      const partialParsedError = CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD[clientErrorCode];

      if (partialParsedError) {
        error = merge(
          {fatal: true, shownToUser: false, name: 'other', category: 'other'}, // default values
          {errorCode: clientErrorCode},
          serviceErrorName ? {errorData: {errorName: serviceErrorName}} : {},
          {serviceErrorCode},
          partialParsedError
        );

        return error;
      }
    }

    return undefined;
  }

  /**
   * Generate error payload for Client Event
   * @param rawError
   */
  generateClientEventErrorPayload(rawError: any) {
    if (rawError.name) {
      if (isBrowserMediaErrorName(rawError.name)) {
        return this.getErrorPayloadForClientErrorCode({
          serviceErrorCode: undefined,
          clientErrorCode: BROWSER_MEDIA_ERROR_NAME_TO_CLIENT_ERROR_CODES_MAP[rawError.name],
          serviceErrorName: rawError.name,
        });
      }
    }

    const serviceErrorCode =
      rawError?.error?.body?.errorCode ||
      rawError?.body?.errorCode ||
      rawError?.body?.code ||
      rawError?.body?.reason?.reasonCode;

    if (serviceErrorCode) {
      const clientErrorCode = SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP[serviceErrorCode];
      if (clientErrorCode) {
        return this.getErrorPayloadForClientErrorCode({clientErrorCode, serviceErrorCode});
      }

      // by default, if it is locus error, return new locus err
      if (isLocusServiceErrorCode(serviceErrorCode)) {
        return this.getErrorPayloadForClientErrorCode({
          clientErrorCode: NEW_LOCUS_ERROR_CLIENT_CODE,
          serviceErrorCode,
        });
      }
    }

    if (isMeetingInfoServiceError(rawError)) {
      return this.getErrorPayloadForClientErrorCode({
        clientErrorCode: MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE,
        serviceErrorCode,
      });
    }

    // otherwise return unkown error
    return this.getErrorPayloadForClientErrorCode({
      clientErrorCode: UNKNOWN_ERROR,
      serviceErrorCode: UNKNOWN_ERROR,
    });
  }

  /**
   * Create client event object for in meeting events
   * @param arg - create args
   * @param arg.event - event key
   * @param arg.options - options
   * @returns object
   */
  private createClientEventObjectInMeeting({
    name,
    options,
    errors,
  }: {
    name: ClientEvent['name'];
    options?: SubmitClientEventOptions;
    errors?: ClientEventPayloadError;
  }) {
    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      'CallDiagnosticMetrics: @prepareClientEvent. Creating in meeting event object.',
      name
    );
    const {meetingId, mediaConnections, rawError} = options;

    // @ts-ignore
    const meeting = this.webex.meetings.meetingCollection.get(meetingId);

    if (!meeting) {
      console.warn(
        'Attempt to send client event but no meeting was found...',
        `event: ${name}, meetingId: ${meetingId}`
      );
      // @ts-ignore
      this.webex.internal.metrics.submitClientMetrics(CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND, {
        fields: {
          meetingId,
          name,
        },
      });

      return undefined;
    }

    // grab identifiers
    const identifiers = this.getIdentifiers({
      meeting,
      mediaConnections: meeting?.mediaConnections || mediaConnections,
    });

    // create client event object
    const clientEventObject: ClientEvent['payload'] = {
      name,
      canProceed: true,
      identifiers,
      errors,
      eventData: {
        webClientDomain: window.location.hostname,
      },
      userType: meeting.getCurUserType(),
      loginType: this.getCurLoginType(),
      isConvergedArchitectureEnabled: this.getIsConvergedArchitectureEnabled({
        meetingId,
      }),
    };

    return clientEventObject;
  }

  /**
   * Create client event object for pre meeting events
   * @param arg - create args
   * @param arg.event - event key
   * @param arg.options - payload
   * @returns object
   */
  private createClientEventObjectPreMeeting({
    name,
    options,
    errors,
  }: {
    name: ClientEvent['name'];
    options?: SubmitClientEventOptions;
    errors?: ClientEventPayloadError;
  }) {
    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      'CallDiagnosticMetrics: @createClientEventObjectPreMeeting. Creating pre meeting event object.',
      name
    );
    const {correlationId} = options;

    // grab identifiers
    const identifiers = this.getIdentifiers({
      correlationId,
    });

    // create client event object
    const clientEventObject: ClientEvent['payload'] = {
      name,
      errors,
      canProceed: true,
      identifiers,
      eventData: {
        webClientDomain: window.location.hostname,
      },
      loginType: this.getCurLoginType(),
    };

    return clientEventObject;
  }

  /**
   * Prepare Client Event CA event.
   * @param arg - submit params
   * @param arg.event - event key
   * @param arg.payload - additional payload to be merged with default payload
   * @param arg.options - payload
   * @returns {any} options to be with fetch
   * @throws
   */
  private prepareClientEvent({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: ClientEventPayload;
    options?: SubmitClientEventOptions;
  }) {
    const {meetingId, correlationId, rawError} = options;
    let clientEventObject: ClientEvent['payload'];

    // check if we need to generate errors
    const errors: ClientEventPayloadError = [];

    if (rawError) {
      this.logger.log(
        CALL_DIAGNOSTIC_LOG_IDENTIFIER,
        'CallDiagnosticMetrics: @prepareClientEvent. Error detected, attempting to map and attach it to the event...',
        name,
        rawError
      );

      const generatedError = this.generateClientEventErrorPayload(rawError);
      if (generatedError) {
        errors.push(generatedError);
      }
      this.logger.log(
        CALL_DIAGNOSTIC_LOG_IDENTIFIER,
        'CallDiagnosticMetrics: @prepareClientEvent. Generated errors:',
        generatedError
      );
    }

    // events that will most likely happen in join phase
    if (meetingId) {
      clientEventObject = this.createClientEventObjectInMeeting({name, options, errors});
    } else if (correlationId) {
      // any pre join events or events that are outside the meeting.
      clientEventObject = this.createClientEventObjectPreMeeting({name, options, errors});
    } else {
      throw new Error('Not implemented');
    }

    // merge any new properties, or override existing ones
    clientEventObject = merge(clientEventObject, payload);

    // append client event data to the call diagnostic event
    const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);

    return diagnosticEvent;
  }

  /**
   * Submit Client Event CA event.
   * @param arg - submit params
   * @param arg.event - event key
   * @param arg.payload - additional payload to be merged with default payload
   * @param arg.options - payload
   * @throws
   */
  public submitClientEvent({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: ClientEventPayload;
    options?: SubmitClientEventOptions;
  }) {
    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      'CallDiagnosticMetrics: @submitClientEvent. Submit Client Event CA event.',
      name,
      payload,
      options
    );
    const diagnosticEvent = this.prepareClientEvent({name, payload, options});

    if (options?.preLoginId) {
      return this.submitToCallDiagnosticsPreLogin(diagnosticEvent, options?.preLoginId);
    }

    return this.submitToCallDiagnostics(diagnosticEvent);
  }

  /**
   * Prepare the event and send the request to metrics-a service.
   * @param event
   * @returns promise
   */
  submitToCallDiagnostics(event: Event): Promise<any> {
    // build metrics-a event type
    const finalEvent = {
      eventPayload: event,
      type: ['diagnostic-event'],
    };

    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      'CallDiagnosticMetrics: @submitToCallDiagnostics. Preparing to send the request',
      finalEvent
    );

    return this.callDiagnosticEventsBatcher.request(finalEvent);
  }

  /**
   * Pre login events are not batched. We make the request directly.
   * @param event
   * @param preLoginId
   * @returns
   */
  public submitToCallDiagnosticsPreLogin = (event: Event, preLoginId?: string): Promise<any> => {
    // build metrics-a event type
    // @ts-ignore
    const diagnosticEvent = prepareDiagnosticMetricItem(this.webex, {
      eventPayload: event,
      type: ['diagnostic-event'],
    });

    // append sent timestamp
    diagnosticEvent.eventPayload.originTime.sent = new Date().toISOString();

    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      `CallDiagnosticMetrics: @submitToCallDiagnosticsPreLogin. Sending the request:`,
      diagnosticEvent
    );

    // @ts-ignore
    return this.webex.internal.newMetrics.postPreLoginMetric(diagnosticEvent, preLoginId);
  };

  /**
   * Builds a request options object to later be passed to fetch().
   * @param arg - submit params
   * @param arg.event - event key
   * @param arg.payload - additional payload to be merged with default payload
   * @param arg.options - client event options
   * @returns {Promise<any>}
   * @throws
   */
  public async buildClientEventFetchRequestOptions({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    payload?: ClientEventPayload;
    options?: SubmitClientEventOptions;
  }): Promise<any> {
    this.logger.log(
      CALL_DIAGNOSTIC_LOG_IDENTIFIER,
      'CallDiagnosticMetrics: @buildClientEventFetchRequestOptions. Building request options object for fetch()...',
      name,
      payload,
      options
    );

    const clientEvent = this.prepareClientEvent({name, payload, options});

    // build metrics-a event type
    // @ts-ignore
    const diagnosticEvent = prepareDiagnosticMetricItem(this.webex, {
      eventPayload: clientEvent,
      type: ['diagnostic-event'],
    });

    // @ts-ignore
    return this.webex.prepareFetchOptions({
      method: 'POST',
      service: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: [diagnosticEvent],
      },
    });
  }
}
