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
  ClientEventError,
} from '../metrics.types';
import CallDiagnosticEventsBatcher from './call-diagnostic-metrics-batcher';
import {
  CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD,
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
   * Get origin object for Call Diagnostic Event payload.
   * @param options
   * @param meetingId
   * @returns
   */
  getOrigin(options: GetOriginOptions, meetingId?: string) {
    let defaultClientType: Event['origin']['clientInfo']['clientType'];
    let defaultSubClientType: Event['origin']['clientInfo']['subClientType'];
    let environment: Event['origin']['environment'];

    if (meetingId) {
      // @ts-ignore
      const meeting = this.webex.meetings.meetingCollection.get(meetingId);

      defaultClientType = meeting.config?.metrics?.clientType;
      defaultSubClientType = meeting.config?.metrics?.subClientType;
      environment = meeting.environment;
    }

    if (
      (defaultClientType && defaultSubClientType) ||
      (options.clientType && options.subClientType)
    ) {
      const origin: Event['origin'] = {
        name: 'endpoint',
        networkType: options.networkType || 'unknown',
        userAgent: userAgentToString({
          // @ts-ignore
          clientName: this.webex.meetings?.metrics?.clientName,
          // @ts-ignore
          webexVersion: this.webex.version,
        }),
        clientInfo: {
          clientType: defaultClientType || options.clientType,
          // @ts-ignore
          clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
          localNetworkPrefix:
            // @ts-ignore
            anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress) || undefined,
          osVersion: getOSVersion() || 'unknown',
          subClientType: defaultSubClientType || options.subClientType,
          os: getOSNameInternal(),
          browser: getBrowserName(),
          browserVersion: getBrowserVersion(),
        },
        environment,
      };

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
    const {meeting, mediaConnections} = options;
    const identifiers: Event['event']['identifiers'] = {correlationId: 'unknown'};

    if (meeting) {
      identifiers.correlationId = meeting.correlationId;
      identifiers.userId = meeting.userId;
      identifiers.deviceId = meeting.deviceUrl;
      identifiers.orgId = meeting.orgId;
      // @ts-ignore
      identifiers.locusUrl = this.webex.internal.services.get('locus');
    }

    if (meeting?.locusUrl && meeting?.locusInfo?.fullState) {
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

    // clear any empty properties on the event object (required by CA)
    clearEmptyKeysRecursively(event);

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
   * Return Client Event payload by client error code
   * @param clientErrorCode
   * @returns
   */
  public getErrorPayloadForClientErrorCode(clientErrorCode: number): ClientEventError {
    let error: ClientEventError;

    if (clientErrorCode) {
      const partialParsedError = CLIENT_ERROR_CODE_TO_ERROR_PAYLOAD[clientErrorCode];

      if (partialParsedError) {
        error = merge(
          {fatal: true, shownToUser: false, name: 'other', category: 'other'}, // default values
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
  generateClientEventErrorPayload({rawError}: {rawError?: any}) {
    const errorCode = rawError?.body?.errorCode || rawError?.body?.code;
    if (errorCode) {
      const clientErrorCode = SERVICE_ERROR_CODES_TO_CLIENT_ERROR_CODES_MAP[errorCode];
      if (clientErrorCode) {
        return this.getErrorPayloadForClientErrorCode(clientErrorCode);
      }

      // by default, if it is locus error, return nre locus err
      if (isLocusServiceErrorCode(errorCode)) {
        return this.getErrorPayloadForClientErrorCode(NEW_LOCUS_ERROR_CLIENT_CODE);
      }

      // otherwise return meeting info
      return this.getErrorPayloadForClientErrorCode(MEETING_INFO_LOOKUP_ERROR_CLIENT_CODE);
    }

    return undefined;
  }

  /**
   * Submit Client Event CA event.
   * @param event - event key
   * @param payload - additional payload to be merged with default payload
   * @param options - payload
   * @throws
   */
  public submitClientEvent({
    name,
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    // additional payload to be merged with default payload
    payload?: RecursivePartial<ClientEvent['payload']>;
    options: SubmitClientEventOptions;
  }) {
    const {meetingId, mediaConnections, rawError} = options;

    // events that will most likely happen in join phase
    if (meetingId) {
      // @ts-ignore
      const meeting = this.webex.meetings.meetingCollection.get(meetingId);

      // grab identifiers
      const identifiers = this.getIdentifiers({
        meeting,
        mediaConnections: meeting?.mediaConnections || mediaConnections,
      });

      // check if we need to generate errors
      const errors: ClientEvent['payload']['errors'] = [];

      if (rawError) {
        const generatedError = this.generateClientEventErrorPayload({rawError});
        if (generatedError) {
          errors.push(generatedError);
        }
      }

      // create client event object
      let clientEventObject: ClientEvent['payload'] = {
        name,
        canProceed: true,
        identifiers,
        errors,
        eventData: {
          webClientDomain: window.location.hostname,
        },
        userType: meeting.getCurUserType(),
        loginType: meeting.getCurLoginType(),
      };

      // merge any new properties, or override existing ones
      clientEventObject = merge(clientEventObject, payload);

      // append client event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);
      this.submitToCallDiagnostics(diagnosticEvent);
    } else {
      // any pre join events or events that are outside the meeting.
      throw new Error('Not implemented');
    }
  }

  /**
   * Prepare the event and send the request to metrics-a service.
   * @param event
   * @returns promise
   */
  submitToCallDiagnostics(event: Event): Promise<void> {
    // build metrics-a event type
    const finalEvent = {
      eventPayload: event,
      type: ['diagnostic-event'],
    };

    return this.callDiagnosticEventsBatcher.request(finalEvent);
  }
}
