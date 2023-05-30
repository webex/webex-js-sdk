/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import MeetingCollection from 'packages/@webex/plugin-meetings/src/meetings/collection';
import {getOSNameInternal} from '@webex/internal-plugin-metrics';
import {BrowserDetection} from '@webex/common/src/browser-detection';
import uuid from 'uuid';
import {isEmpty, merge} from 'lodash';
import {anonymizeIPAddress, clearEmpty, userAgentToString} from './ca-metrics.util';
import {CLIENT_NAME} from './config';
import {FeatureEvent} from './FeatureEvent';
import {ClientEvent} from './ClientEvent';
import {Event as RawEvent} from './Event';

const {getOSVersion, getBrowserName, getBrowserVersion} = BrowserDetection();

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

export enum LatencyTimestampKey {
  clickToInterstitialStart = 'clickToInterstitialStart',
  clickToInterstitialEnd = 'clickToInterstitialEnd',
  interstitialToJoinOK = 'interstitialToJoinOK',
  localSDPGenRemoteSDPRecvStart = 'localSDPGenRemoteSDPRecvStart',
  localSDPGenRemoteSDPRecvEnd = 'localSDPGenRemoteSDPRecvEnd',
}

// we only care about client event and feature event for now
type Event = Omit<RawEvent, 'event'> & {event: ClientEvent | FeatureEvent};

type GetIdentifiersOptions = {
  meeting?: any;
  meetingLookupUrl?: string;
  trackingId?: string;
  mediaConnections?: any[];
};

/**
 * @description Helper class to store latencies timestamp and to calculate various latencies for CA.
 * @exports
 * @class CallAnalyzerLatencies
 */
export class CallAnalyzerLatencies {
  latencyTimestamps: Map<LatencyTimestampKey, number>;

  /**
   * Store Latency value
   * @param key - key
   * @param  value -value
   * @throws
   * @returns
   */
  public saveLatency(key: LatencyTimestampKey, value: number) {
    this.latencyTimestamps.set(key, value);
  }

  /**
   * Click To Interstitial Latency
   * @returns - latency
   */
  public getClickToInterstitial() {
    const start = this.latencyTimestamps.get(LatencyTimestampKey.clickToInterstitialStart);
    const end = this.latencyTimestamps.get(LatencyTimestampKey.clickToInterstitialEnd);
    if (start && end) {
      return end - start;
    }

    return undefined;
  }

  /**
   * Local SDP Gen Remote SDP Recv
   * @returns - latency
   */
  public getlocalSDPGenRemoteSDPRecv() {
    const start = this.latencyTimestamps.get(LatencyTimestampKey.localSDPGenRemoteSDPRecvStart);
    const end = this.latencyTimestamps.get(LatencyTimestampKey.localSDPGenRemoteSDPRecvEnd);
    if (start && end) {
      return end - start;
    }

    return undefined;
  }

  /**
   * Get Total JMT
   * TODO: change this...
   * @returns  - latency
   */
  public getTotalJMT() {
    const clickToInterstitial = this.getClickToInterstitial();
    const localSDPGenRemoteSDPRecv = this.getlocalSDPGenRemoteSDPRecv();

    return clickToInterstitial + localSDPGenRemoteSDPRecv;
  }
}

/**
 * @description Util class to handle Call Analyzer Metrics
 * @export
 * @class CallAnalyzerMetrics
 */
export class CallAnalyzerMetrics {
  // eslint-disable-next-line no-use-before-define
  static instance: CallAnalyzerMetrics;
  meetingCollection: MeetingCollection;
  webex: any;
  latencies: CallAnalyzerLatencies;

  /**
   * Constructor
   * @constructor
   * @public
   */
  constructor() {
    if (!CallAnalyzerMetrics.instance) {
      CallAnalyzerMetrics.instance = this;
      this.meetingCollection = null;
      this.latencies = new CallAnalyzerLatencies();
    }

    // eslint-disable-next-line no-constructor-return
    return CallAnalyzerMetrics.instance;
  }

  /**
   * Initializes the CallAnalyzerMetrics singleton with a meeting Collection.
   *
   * @parammeetingCollection meetings object
   * @param  webex  webex SDK object
   *
   * @returns
   */
  public initialSetup(meetingCollection: MeetingCollection, webex: object) {
    this.meetingCollection = meetingCollection;
    this.webex = webex;
  }

  /**
   * Gather origin details.
   * @param options
   */
  getOrigin(options: {
    clientType: Event['origin']['clientInfo']['clientType'];
    subClientType: Event['origin']['clientInfo']['subClientType'];
  }) {
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
        localNetworkPrefix: anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress),
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
   * @param options
   */
  getIdentifiers(options: GetIdentifiersOptions) {
    const {meeting, mediaConnections} = options;
    let identifiers: Event['event']['identifiers'];

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
   * @param event - event key
   * @param options - payload
   * @returns
   */
  public submitFeatureEvent(
    name: FeatureEvent['name'],
    payload: Partial<FeatureEvent>,
    // custom properties that we derive actual CA properties on
    options?: {
      meetingId?: string;
    }
  ) {
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
        ...payload,
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
   * NOT IMPLEMENTED
   * @param rawError
   * @returns
   */
  generateErrorPayload(rawError?: any) {
    // NOT IMPLEMENTED
    let error: ClientEvent['errors'][0];

    if (rawError) {
      error = {
        shownToUser: false,
        category: 'expected',
        fatal: false,
        name: 'other',
      };
    }

    return error;
  }

  /**
   * Submit Client Event CA event
   * @param event - event key
   * @param payload - payload for the event
   * @param options - payload
   * @returns
   */
  public submitClientEvent(
    name: ClientEvent['name'],
    // additional payload to be merged with default payload
    payload: RecursivePartial<ClientEvent>,
    options: {
      meetingId?: string;
      mediaConnections?: any[];
      joinTimes?: ClientEvent['joinTimes'];
      error?: any;
      showToUser?: boolean;
    }
  ) {
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
      let errors: ClientEvent['errors'] = [];
      if (error) {
        errors = [this.generateErrorPayload(error)].filter((e) => isEmpty(e));
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
const instance = new CallAnalyzerMetrics();

export default instance;
