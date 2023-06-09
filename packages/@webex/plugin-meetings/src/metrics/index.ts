/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {includes} from 'lodash';

import {MEETING_ERRORS} from '../constants';

import {error, eventType, errorCodes as ERROR_CODE, WebexAPIServiceErrorCodes} from './config';

/**
 * @description Metrics handles all the call metrics events
 * @export
 * @class Metrics
 */
class Metrics {
  static instance: Metrics;

  _events: any;
  keys: any;
  meetingCollection: any;
  webex: any;

  /**
   * Create Metrics Object
   * @constructor
   * @public
   * @memberof Meetings
   */
  constructor() {
    if (!Metrics.instance) {
      /**
       * @instance
       * @type {Array}
       * @private
       * @memberof Metrics
       */
      this._events = [];
      /**
       * @instance
       * @type {MeetingCollection}
       * @private
       * @memberof Metrics
       */
      this.meetingCollection = null;
      /**
       * @instance
       * @type {MeetingCollection}
       * @private
       * @memberof Metrics
       */
      this.keys = Object.values(eventType);
      /**
       * @instance
       * @type {Metrics}
       * @private
       * @memberof Metrics
       */
      Metrics.instance = this;
    }

    // eslint-disable-next-line no-constructor-return
    return Metrics.instance;
  }

  /**
   * Initializes the Metrics singleton with a meeting Collection.
   *
   * @param {Object} meetingCollection meetings object
   * @param {Object} webex  webex SDK object
   *
   * @returns {void}
   */
  initialSetup(meetingCollection: object, webex: object) {
    this.meetingCollection = meetingCollection;
    this.webex = webex;
  }

  postEvent(args) {
    throw new Error('Deprecated');
  }

  /**
   * This function Parses a Locus error and returns a diagnostic event payload.
   * It should keep updating from:
   * https://sqbu-github.cisco.com/WebExSquared/spark-client-framework/blob/master/spark-client-framework/Adapters/TelephonyAdapter/TelephonyAdapter.cpp#L920
   *
   * @param {Object} err the error Object from Locus response
   * @param {boolean} showToUser true if a toast is shown to user
   * @returns {{showToUser: boolean, category: string, errorDescription: string,
   *  errorCode: number, errorData: *, fatal: boolean, name: string}}
   */
  parseLocusError(err: any, showToUser: boolean) {
    let errorCode;

    if (err && err.statusCode && err.statusCode >= 500) {
      errorCode = 1003;
    } else if (err && err.body && err.body.errorCode) {
      // locus error codes: https://sqbu-github.cisco.com/WebExSquared/locus/blob/master/server/src/main/resources/locus-error-codes.properties
      switch (ERROR_CODE[err.body.errorCode]) {
        case MEETING_ERRORS.FREE_USER_MAX_PARTICIPANTS_EXCEEDED:
          errorCode = 3007;
          break;
        case MEETING_ERRORS.PAID_USER_MAX_PARTICIPANTS_EXCEEDED:
        case MEETING_ERRORS.SERVICE_MAX_PARTICIPANTS_EXCEEDED:
          errorCode = 3002;
          break;
        case MEETING_ERRORS.INACTIVE:
          errorCode = 4001;
          break;
        case MEETING_ERRORS.EXCEEDED_MAX_JOINED_PARTICIPANTS:
        case MEETING_ERRORS.EXCEEDED_SERVICE_MAX_PARTICIPANTS:
          errorCode = 3001;
          break;
        case MEETING_ERRORS.MEETING_IS_LOCKED:
          errorCode = 4002;
          break;
        case MEETING_ERRORS.MEETING_IS_TERMINATING:
          errorCode = 4003;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_PIN_INTENT:
          errorCode = 4004;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_PIN:
          errorCode = 4005;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_ROLE:
          errorCode = 4006;
          break;
        case MEETING_ERRORS.JOIN_RESTRICTED_USER:
        case MEETING_ERRORS.GET_RESTRICTED_USER:
        case MEETING_ERRORS.CREATE_MEDIA_RESTRICTED_USER:
          errorCode = 3005;
          break;
        case MEETING_ERRORS.JOIN_RESTRICTED_USER_NOT_IN_ROOM:
          errorCode = 4007;
          break;
        case MEETING_ERRORS.MEETING_NOT_FOUND:
          errorCode = 4011;
          break;
        case MEETING_ERRORS.NOT_WEBEX_SITE:
          errorCode = 4012;
          break;
        case MEETING_ERRORS.INVALID_JOIN_TIME:
          errorCode = 4013;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_NOT_A_NUMBER:
          errorCode = 4016;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_TOO_LONG:
          errorCode = 4017;
          break;
        case MEETING_ERRORS.INVALID_DIALABLE_KEY:
          errorCode = 4018;
          break;
        case MEETING_ERRORS.ONE_ON_ONE_TO_SELF_NOT_ALLOWED:
          errorCode = 4019;
          break;
        case MEETING_ERRORS.REMOVED_PARTICIPANT:
          errorCode = 4020;
          break;
        case MEETING_ERRORS.MEETING_LINK_NOT_FOUND:
          errorCode = 4021;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_TOO_SHORT_AFTER_IDD:
          errorCode = 4022;
          break;
        case MEETING_ERRORS.INVALID_INVITEE_ADDRESS:
          errorCode = 4023;
          break;
        case MEETING_ERRORS.PMR_ACCOUNT_LOCKED:
          errorCode = 4024;
          break;
        case MEETING_ERRORS.RESOURCE_GUEST_FORBIDDEN:
          errorCode = 4025;
          break;
        case MEETING_ERRORS.PMR_ACCOUNT_SUSPENDED:
          errorCode = 4026;
          break;
        case MEETING_ERRORS.EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE:
          errorCode = 4027;
          break;
        case MEETING_ERRORS.INVALID_SINCE_OR_SEQUENCE_HASH_IN_REQUEST:
          errorCode = 1006;
          break;
        case MEETING_ERRORS.CONVERSATION_NOT_FOUND:
          errorCode = 4028;
          break;
        case MEETING_ERRORS.RECORDING_CONTROL_NOT_SUPPORTED:
        case MEETING_ERRORS.RECORDING_NOT_STARTED:
        case MEETING_ERRORS.RECORDING_NOT_ENABLED:
          errorCode = 4029;
          break;
        default:
          errorCode = 4008;
      }
    } else {
      errorCode = 4008;
    }

    return this.generateErrorPayload(errorCode, showToUser, error.name.LOCUS_RESPONSE, err);
  }

  /**
   * Pareses webex api error.
   *
   * @param {object} err
   * @param {boolean} showToUser
   * @returns {object | null}
   */
  parseWebexApiError(err: any, showToUser: boolean) {
    const serviceErrorCode = err?.body?.code;
    const clientCodeError = WebexAPIServiceErrorCodes[serviceErrorCode];

    if (clientCodeError) {
      return this.generateErrorPayload(clientCodeError, showToUser, error.name.OTHER, err);
    }

    return this.generateErrorPayload(4100, showToUser, error.name.OTHER, err);
  }

  /**
   * Generates Error for the CA event
   *
   * @param {integer} errorCode
   * @param {boolean} shownToUser
   * @param {string} name
   * @param {any} err
   * @returns {any}
   */
  generateErrorPayload(errorCode, shownToUser, name, err) {
    if (error.errors[errorCode]) {
      const errorPayload: any = {
        shownToUser: shownToUser || false,
        category: error.errors[errorCode][2],
        errorDescription: error.errors[errorCode][0],
        errorCode,
        fatal: !includes(error.notFatalErrorList, errorCode),
        name: name || error.name.OTHER,
        serviceErrorCode: err?.body?.code,
      };

      if (err && err.body) {
        errorPayload.errorData = {error: err.body};
      }

      if (err && err.statusCode) {
        errorPayload.httpCode = err.statusCode;
      }

      return errorPayload;
    }

    return null;
  }

  /**
   * Uploads given metric to the Metrics service as an Behavioral metric.
   * Metadata about the environment such as browser, OS, SDK and their versions
   * are automatically added when the metric is sent.
   *
   * The Metrics service will send an Behavioral metric to InfluxDB for
   * aggregation.
   * See https://confluence-eng-gpk2.cisco.com/conf/display/WBXT/Getting+started+with+Metrics+Service.
   *
   * @param {string} metricName  Name of the metric (measurement) to send
   * @param {Object} metricFields  Key-valye pairs of data or values about this metric
   * @param {Object} metricTags  Key-value pairs of metric metadata
   *
   * @returns {void}
   */
  sendBehavioralMetric(metricName: string, metricFields: object = {}, metricTags: object = {}) {
    this.webex.internal.metrics.submitClientMetrics(metricName, {
      type: this.webex.config.metrics.type,
      fields: metricFields,
      tags: metricTags,
    });
  }
}

// Export Metrics singleton ---------------------------------------------------
const instance = new Metrics();

export default instance;
