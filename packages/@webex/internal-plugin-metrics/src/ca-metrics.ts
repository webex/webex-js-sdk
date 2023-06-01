/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import {BrowserDetection} from '@webex/common/src/browser-detection';
import uuid from 'uuid';
import {merge} from 'lodash';
import {anonymizeIPAddress, clearEmpty, userAgentToString} from './ca-metrics.util';
import {CLIENT_NAME} from './config';
import {Event as RawEvent} from './Event';
import {FeatureEvent} from './FeatureEvent';
import {ClientEvent} from './ClientEvent';
import {CallAnalyzerLatencies} from './ca-metrics-latencies';

type Event = Omit<RawEvent, 'event'> & {event: ClientEvent | FeatureEvent};

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

type GetOriginOptions = {
  clientType: NonNullable<Event['origin']['clientInfo']>['clientType'];
  subClientType: NonNullable<Event['origin']['clientInfo']>['subClientType'];
};

type GetIdentifiersOptions = {
  meeting?: any;
  meetingLookupUrl?: string;
  trackingId?: string;
  mediaConnections?: any[];
};

/**
 * @description Util class to handle Call Analyzer Metrics
 * @export
 * @class CallDiagnosticMetrics
 */
export class CallDiagnosticMetrics {
  // eslint-disable-next-line no-use-before-define
  static instance: CallDiagnosticMetrics;
  meetingCollection: any;
  webex: any;
  latencies: CallAnalyzerLatencies;

  /**
   * Constructor
   * @constructor
   * @public
   */
  constructor() {
    if (!CallDiagnosticMetrics.instance) {
      CallDiagnosticMetrics.instance = this;
      this.meetingCollection = null;
      this.latencies = new CallAnalyzerLatencies();
    }

    // eslint-disable-next-line no-constructor-return
    return CallDiagnosticMetrics.instance;
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
  }

  /**
   * Gather origin details.
   */
  getOrigin(options: GetOriginOptions) {
    const origin: Event['origin'] = {
      name: 'endpoint',
      networkType: 'unknown',
      userAgent: userAgentToString({
        clientName: this.webex.meetings?.metrics?.clientName,
        webexVersion: this.webex.version,
      }),
      clientInfo: {
        clientType: options.clientType,
        clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
        localNetworkPrefix:
          anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress) || undefined,
        osVersion: getOSVersion() || 'unknown',
        subClientType: options.subClientType,
        os: getOSNameInternal(),
        browser: getBrowserName(),
        browserVersion: getBrowserVersion(),
      },
    };

    return origin;
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
      // doesn't exist on the Type....
      // identifiers.mediaAgentCluster = mediaConnections?.[0].mediaAgentCluster;
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
    const origin = this.getOrigin(options);

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
    return clearEmpty(event);
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
      this.webex.internal.metrics.submitCallDiagnosticEvents(diagnosticEvent);
    } else {
      // most likely will be events that are happening outside the meeting.
      throw new Error('Not implemented');
    }
  }

  /**
   * TODO: NOT IMPLEMENTED
   * @param rawError
   * @returns
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
   * @returns
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
    options: {
      meetingId?: string;
      mediaConnections?: any[];
      joinTimes?: ClientEvent['joinTimes'];
      error?: any;
      showToUser?: boolean;
    };
  }) {
    const {meetingId, mediaConnections, joinTimes, error} = options;

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
        joinTimes,
        errors,
        eventData: {
          webClientDomain: window.location.hostname,
        },
      };

      // merge any new properties, or override existing ones
      clientEventObject = merge(clientEventObject, payload);

      // append feature event data to the call diagnostic event
      const diagnosticEvent = this.prepareDiagnosticEvent(clientEventObject, options);
      this.webex.internal.metrics.submitCallDiagnosticEvents(diagnosticEvent);
    } else {
      // any pre join events or events that are outside the meeting.
      throw new Error('Not implemented');
    }
  }
}

// Singleton
const instance = new CallDiagnosticMetrics();

export default instance;
