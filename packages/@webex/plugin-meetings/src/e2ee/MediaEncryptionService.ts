/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {MEDIA_ENCRYPTION_SERVICE} from './constants';
import type {WebexRequestMethod} from '../common/types';

/**
 * Routes the MLS engine's protocol HTTP requests to the media-encryption service via
 * webex.request. Bodies are plain JS objects; MLS owns the conversion to/from the engine's bytes.
 * Requests use standard webex auth (Authorization bearer token) — no custom header is needed.
 */
export default class MediaEncryptionService {
  private readonly webexRequest: WebexRequestMethod;

  /**
   * @param {Object} deps
   * @param {WebexRequestMethod} deps.webexRequest - The (bound) webex.request method.
   */
  constructor({webexRequest}: {webexRequest: WebexRequestMethod}) {
    this.webexRequest = webexRequest;
  }

  /**
   * @param {string} url - The absolute request URL provided by the engine.
   * @param {unknown} body - Request payload, sent as JSON.
   * @returns {Promise<unknown>} The JSON-parsed response body.
   */
  async request(url: string, body: unknown): Promise<unknown> {
    const {body: responseBody} = await this.webexRequest({
      method: 'POST',
      service: MEDIA_ENCRYPTION_SERVICE,
      url,
      body,
    });

    return responseBody;
  }
}
