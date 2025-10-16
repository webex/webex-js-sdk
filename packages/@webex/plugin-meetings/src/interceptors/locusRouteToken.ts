/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import {has} from 'lodash';

const LOCUS_ID_REGEX = /\/locus\/api\/v1\/loci\/([a-f0-9-]{36})/i;
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

  getLocusIdByRequestUrl(url: string) {
    return url?.match(LOCUS_ID_REGEX)?.[1];
  }

  /**
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Promise<HttpResponse>}
   */
  onResponse(options, response) {
    const locusId = this.getLocusIdByRequestUrl(options.uri);
    if (locusId) {
      const hasRouteToken = has(response.headers, X_CISCO_PART_ROUTE_TOKEN);
      const token = response.headers[X_CISCO_PART_ROUTE_TOKEN];
      if (hasRouteToken) {
        this.updateToken(locusId, token);
      }
    }

    return Promise.resolve(response);
  }

  /**
   * @param {Object} options
   * @returns {Promise<Object>} options
   */
  onRequest(options) {
    const locusId = this.getLocusIdByRequestUrl(options.uri);
    if (locusId) {
      const token = this.getToken(locusId);
      if (token) {
        options.headers[X_CISCO_PART_ROUTE_TOKEN] = token;
      }
    }

    return Promise.resolve(options);
  }

  /**
   * Update the meeting route token
   * @param {string} locusId
   * @param {string} token
   * @returns {void}
   */
  updateToken(locusId, token) {
    ROUTE_TOKEN[locusId] = token;
  }

  /**
   * Get the meeting route token
   * @param {string} locusId
   * @returns {string|undefined}
   */
  getToken(locusId) {
    return ROUTE_TOKEN[locusId];
  }
}
