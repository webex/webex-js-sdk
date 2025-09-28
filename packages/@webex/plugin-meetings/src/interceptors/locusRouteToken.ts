/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import {has} from 'lodash';

const X_CISCO_PART_ROUTE_TOKEN = 'X-Cisco-Part-Route-Token';
const ROUTE_TOKEN = {};

/**
 * @class LocusRouteTokenInterceptor
 */
export default class LocusRouteTokenInterceptor extends Interceptor {
  /**
   * @returns {LocusRouteTokenInterceptor}
   */
  static create() {
    // @ts-ignore
    return new LocusRouteTokenInterceptor({webex: this});
  }

  getActiveMeetingId() {
    // @ts-ignore
    return this.webex.meetings.meetingCollection.getActiveWebrtcMeeting()?.id;
  }

  /**
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Promise<HttpResponse>}
   */
  onResponse(options, response) {
    const meetingId = this.getActiveMeetingId();
    if (meetingId) {
      const hasRouteToken = has(response.headers, X_CISCO_PART_ROUTE_TOKEN);
      const token = response.headers[X_CISCO_PART_ROUTE_TOKEN];
      if (hasRouteToken) {
        this.updateToken(meetingId, token);
      }
    }

    return Promise.resolve(response);
  }

  /**
   * @param {Object} options
   * @returns {Promise<Object>} options
   */
  onRequest(options) {
    const meetingId = this.getActiveMeetingId();
    if (meetingId) {
      const token = this.getToken(meetingId);
      if (token) {
        options.headers[X_CISCO_PART_ROUTE_TOKEN] = token;
      }
    }

    return Promise.resolve(options);
  }

  /**
   * Update the meeting route token
   * @param {string} meetingId
   * @param {string} token
   * @returns {void}
   */
  updateToken(meetingId, token) {
    ROUTE_TOKEN[meetingId] = token;
  }

  /**
   * Get the meeting route token
   * @param {string} meetingId
   * @returns {string|undefined}
   */
  getToken(meetingId) {
    return ROUTE_TOKEN[meetingId];
  }
}
