/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

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

  // Helper function to get header value case insensitively
  getHeader(headers: Record<string, string>, name: string) {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());

    return key ? headers[key] : undefined;
  }

  /**
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Promise<HttpResponse>}
   */
  onResponse(options, response) {
    const locusId = this.getLocusIdByRequestUrl(options.uri);
    if (locusId) {
      const hasRouteToken = Object.keys(response.headers).some(
        (key) => key.toLowerCase() === X_CISCO_PART_ROUTE_TOKEN.toLowerCase()
      );
      const token = this.getHeader(response.headers, X_CISCO_PART_ROUTE_TOKEN);
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
    if (token === 'null' || token === null) {
      delete ROUTE_TOKEN[locusId];
    } else {
      ROUTE_TOKEN[locusId] = token;
    }
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
