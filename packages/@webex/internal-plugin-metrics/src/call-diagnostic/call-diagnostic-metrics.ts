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
} from './call-diagnostic-metrics.util';
import {CLIENT_NAME} from '../config';
import {
  RecursivePartial,
  Event,
  ClientType,
  SubClientType,
  NetworkType,
  ClientEvent,
  SubmitClientEventOptions,
  MediaQualityEvent,
  SubmitMQEOptions,
  SubmitMQEPayload,
  ClientEventError,
  ClientEventPayload,
} from '../metrics.types';
import CallDiagnosticEventsBatcher from './call-diagnostic-metrics-batcher';
import {
  CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD,
  CALL_DIAGNOSTIC_EVENT_FAILED_TO_SEND,
  MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE,
  NEW_LOCUS_ERROR_CLIENT_CODE,
  SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP,
} from './config';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

type GetOriginOptions = {
  clientType: ClientType;
  subClientType: SubClientType;
  networkType?: NetworkType;
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

  /**
   * Constructor
   * @param args
   */
  constructor(...args) {
    super(...args);
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
          // @ts-ignore
          clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
          localNetworkPrefix:
            // @ts-ignore
            anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress) || undefined,
          osVersion: getOSVersion() || 'unknown',
          subClientType: options?.subClientType || defaultSubClientType,
          os: getOSNameInternal(),
          browser: getBrowserName(),
          browserVersion: getBrowserVersion(),
        },
      };

      if (meetingId) {
        // @ts-ignore
        const meeting = this.webex.meetings.meetingCollection.get(meetingId);
        if (meeting?.environment) {
          origin.environment = meeting.environment;
        }
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
  }: {
    clientErrorCode: number;
    serviceErrorCode: any;
  }): ClientEventError {
    let error: ClientEventError;

    if (clientErrorCode) {
      const partialParsedError = CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD[clientErrorCode];

      if (partialParsedError) {
        error = merge(
          {fatal: true, shownToUser: false, name: 'other', category: 'other'}, // default values
          {errorCode: clientErrorCode},
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
    const serviceErrorCode = rawError?.body?.errorCode || rawError?.body?.code;
    if (serviceErrorCode) {
      const clientErrorCode = SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP[serviceErrorCode];
      if (clientErrorCode) {
        return this.getErrorPayloadForClientErrorCode({clientErrorCode, serviceErrorCode});
      }

      // by default, if it is locus error, return nre locus err
      if (isLocusServiceErrorCode(serviceErrorCode)) {
        return this.getErrorPayloadForClientErrorCode({
          clientErrorCode: NEW_LOCUS_ERROR_CLIENT_CODE,
          serviceErrorCode,
        });
      }

      // otherwise return meeting info
      return this.getErrorPayloadForClientErrorCode({
        clientErrorCode: MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE,
        serviceErrorCode,
      });
    }

    return undefined;
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
  }: {
    name: ClientEvent['name'];
    options: SubmitClientEventOptions;
  }) {
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

    // check if we need to generate errors
    const errors: ClientEvent['payload']['errors'] = [];

    if (rawError) {
      const generatedError = this.generateClientEventErrorPayload(rawError);
      if (generatedError) {
        errors.push(generatedError);
      }
    }

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
  }: {
    name: ClientEvent['name'];
    options: SubmitClientEventOptions;
  }) {
    const {correlationId} = options;

    // grab identifiers
    const identifiers = this.getIdentifiers({
      correlationId,
    });

    // create client event object
    const clientEventObject: ClientEvent['payload'] = {
      name,
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
    const {meetingId, correlationId} = options;
    let clientEventObject: ClientEvent['payload'];

    // events that will most likely happen in join phase
    if (meetingId) {
      clientEventObject = this.createClientEventObjectInMeeting({name, options});
    } else if (correlationId) {
      // any pre join events or events that are outside the meeting.
      clientEventObject = this.createClientEventObjectPreMeeting({name, options});
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
    const diagnosticEvent = this.prepareClientEvent({name, payload, options});

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

    return this.callDiagnosticEventsBatcher.request(finalEvent);
  }

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
    options: SubmitClientEventOptions;
  }): Promise<any> {
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
