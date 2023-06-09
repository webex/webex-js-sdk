/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import {BrowserDetection} from '@webex/common';
import uuid from 'uuid';
import {merge} from 'lodash';
import {anonymizeIPAddress, clearEmpty, userAgentToString} from './call-diagnostic-metrics.util';
import {CLIENT_NAME} from '../config';
import {Event as RawEvent} from './types/Event';
import {FeatureEvent} from './types/FeatureEvent';
import {MediaQualityEvent} from './types/MediaQualityEvent';
import {ClientEvent} from './types/ClientEvent';
import CallDiagnosticEventsBatcher from './call-diagnostic-metrics-batcher';
import {RecursivePartial} from '../types';

type Event = Omit<RawEvent, 'event'> & {event: ClientEvent | FeatureEvent | MediaQualityEvent};

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

type GetOriginOptions = {
  clientType: NonNullable<Event['origin']['clientInfo']>['clientType'];
  subClientType: NonNullable<Event['origin']['clientInfo']>['subClientType'];
  networkType?: Event['origin']['networkType'];
};

type GetIdentifiersOptions = {
  meeting?: any;
  meetingLookupUrl?: string;
  trackingId?: string;
  mediaConnections?: any[];
};

export type SubmitClientEventOptions = {
  meetingId?: string;
  mediaConnections?: any[];
  error?: any;
  showToUser?: boolean;
};

/**
 * @description Util class to handle Call Analyzer Metrics
 * @export
 * @class CallDiagnosticMetrics
 */
export default class CallDiagnosticMetrics {
  // eslint-disable-next-line no-use-before-define
  meetingCollection: any;
  webex: any;
  // @ts-ignore
  private callDiagnosticEventsBatcher: CallDiagnosticEventsBatcher;

  /**
   * Constructor
   * @constructor
   * @public
   */
  constructor() {
    this.meetingCollection = null;
    // eslint-disable-next-line no-constructor-return
  }

  /**
   * Initializes the CallDiagnosticMetrics singleton with a meeting Collection.
   *
   * @param meetingCollection meetings object
   * @param webex  webex SDK object
   *
   * @returns
   */
  public initialSetup(meetingCollection: any, webex: object) {
    this.meetingCollection = meetingCollection;
    this.webex = webex;
    this.callDiagnosticEventsBatcher = new CallDiagnosticEventsBatcher({}, {parent: this.webex});
  }

  /**
   * Gather origin details.
   */
  getOrigin(options: GetOriginOptions, meetingId?: string) {
    let defaultClientType: Event['origin']['clientInfo']['clientType'];
    let defaultSubClientType: Event['origin']['clientInfo']['subClientType'];
    let environment: Event['origin']['environment'];

    if (meetingId) {
      const meeting = this.meetingCollection.get(meetingId);

      defaultClientType = meeting.config.metrics?.clientType;
      defaultSubClientType = meeting.config.metrics?.subClientType;
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
          clientName: this.webex.meetings?.metrics?.clientName,
          webexVersion: this.webex.version,
        }),
        clientInfo: {
          clientType: defaultClientType || options.clientType,
          clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
          localNetworkPrefix:
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
   * Gather identifier details.
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
      // @ts-ignore fix type
      identifiers.locusUrl = this.webex.internal.services.get('locus');
    }

    if (meeting.locusUrl && meeting.locusInfo.fullState) {
      identifiers.locusUrl = meeting.locusUrl;
      identifiers.locusId = meeting.locusUrl && meeting.locusUrl.split('/').pop();
      identifiers.locusStartTime =
        meeting.locusInfo.fullState && meeting.locusInfo.fullState.lastActive;
    }

    if (mediaConnections) {
      identifiers.mediaAgentAlias = mediaConnections?.[0].mediaAgentAlias;
      identifiers.mediaAgentGroupId = mediaConnections?.[0].mediaAgentGroupId;
    }

    if (identifiers.correlationId === 'undefined') {
      throw new Error('Identifiers initialization failed.');
    }

    return identifiers;
  }

  /**
   * Create diagnostic event, and pass in concrete event
   * data for Client Event or Feature Event etc..
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
      senderCountryCode: this.webex.meetings.geoHintInfo?.countryCode,
      event: eventData,
    };

    // sanitize (remove empty properties, CA requires it)
    // but we don't want to sanitize MQE as most of the times
    // values will be 0, [] etc, and they are required.
    if (eventData.name !== 'client.mediaquality.event') {
      clearEmpty(event);
    }

    return event;
  }

  /**
   * Submit CA event
   * @returns
   */
  public submitFeatureEvent(params: {
    name: FeatureEvent['name'];
    payload?: RecursivePartial<FeatureEvent>;
    // custom properties that we derive actual CA properties on
    options: {
      meetingId?: string;
    };
  }) {
    const {options, name, payload} = params;
    const {meetingId} = options;

    // events that will most likely happen inside the meeting
    if (meetingId) {
      const meeting = this.meetingCollection.get(meetingId);

      // merge identifiers
      const identifiers = this.getIdentifiers({
        meeting,
      });

      // create feature event object
      let featureEventObject: FeatureEvent = {
        canProceed: true,
        name,
        identifiers,
      };

      // merge any new properties, or override existing ones
      featureEventObject = merge(featureEventObject, payload);

      // append feature event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(featureEventObject, options);
      this.submitToCallDiagnostics(diagnosticEvent);
    } else {
      // most likely will be events that are happening outside the meeting.
      throw new Error('Not implemented');
    }
  }

  /**
   * TODO: NOT IMPLEMENTED
   * @param rawError
   */
  generateErrorPayload(rawError?: any) {
    // grab the type of the elements in the errors array
    let error: NonNullable<ClientEvent['errors']>[0];

    if (rawError) {
      error = {
        shownToUser: false,
        category: 'expected',
        fatal: false,
        name: 'other',
      };

      return error;
    }

    return undefined;
  }

  /**
   * Submit Client Event CA event
   * @param event - event key
   * @param payload - payload for the event
   * @param options - payload
   * @throws
   */
  public submitClientEvent({
    name,
    // additional payload to be merged with default payload
    payload,
    options,
  }: {
    name: ClientEvent['name'];
    // additional payload to be merged with default payload
    payload?: RecursivePartial<ClientEvent>;
    options: SubmitClientEventOptions;
  }) {
    const {meetingId, mediaConnections, error} = options;

    // events that will most likely happen in join phase
    if (meetingId) {
      const meeting = this.meetingCollection.get(meetingId);

      // merge identifiers
      const identifiers = this.getIdentifiers({
        meeting,
        mediaConnections: meeting.mediaConnections || mediaConnections,
      });

      // check if we need to generate errros
      const errors: ClientEvent['errors'] = [];

      if (error) {
        const generatedError = this.generateErrorPayload(error);
        if (generatedError) {
          errors.push(generatedError);
        }
      }

      // create feature event object
      let clientEventObject: ClientEvent = {
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

      // append feature event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);
      this.submitToCallDiagnostics(diagnosticEvent);
    } else {
      // any pre join events or events that are outside the meeting.
      throw new Error('Not implemented');
    }
  }

  /**
   * Submit Media Quality Event
   * @param args
   */
  submitMQE({
    name,
    // additional payload to be merged with default payload
    payload,
    options,
  }: {
    name: MediaQualityEvent['name'];
    // additional payload to be merged with default payload
    payload: RecursivePartial<MediaQualityEvent> & {intervals: MediaQualityEvent['intervals']};
    options: {
      meetingId: string;
      mediaConnections?: any[];
      networkType?: Event['origin']['networkType'];
    };
  }) {
    const {meetingId, mediaConnections} = options;

    // events that will most likely happen in join phase
    if (meetingId) {
      const meeting = this.meetingCollection.get(meetingId);

      // merge identifiers
      const identifiers = this.getIdentifiers({
        meeting,
        mediaConnections: meeting.mediaConnections || mediaConnections,
      });

      // create feature event object
      let clientEventObject: MediaQualityEvent = {
        name,
        canProceed: true,
        identifiers,
        eventData: {
          webClientDomain: window.location.hostname,
        },
        intervals: payload.intervals,
        sourceMetadata: {
          applicationSoftwareType: CLIENT_NAME,
          applicationSoftwareVersion: this.webex.version,
          mediaEngineSoftwareType: getBrowserName() || 'browser',
          mediaEngineSoftwareVersion: getOSVersion() || 'unknown',
          startTime: new Date().toISOString(),
        },
      };

      // merge any new properties, or override existing ones
      clientEventObject = merge(clientEventObject, payload);

      // append feature event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);
      this.submitToCallDiagnostics(diagnosticEvent);
    } else {
      // any pre join events or events that are outside the meeting.
      throw new Error('Not implemented');
    }
  }

  /**
   * Prepare the event and send the request to metrics-a.
   * @param event
   */
  submitToCallDiagnostics(event: Event) {
    // build metrics-a event type
    const finalEvent = {
      eventPayload: event,
      type: ['diagnostic-event'],
    };

    this.callDiagnosticEventsBatcher.request(finalEvent);
  }
}
