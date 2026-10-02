/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {MEDIA_ENCRYPTION_SERVICE} from './constants';
import type {WebexRequestMethod} from '../common/types';
import type {IMlsHttpClient} from './types';

/**
 * Routes the MLS engine's protocol HTTP requests to the media-encryption service via
 * webex.request. The engine speaks raw bytes; this adapter (de)serializes JSON at the boundary.
 * Requests use standard webex auth (Authorization bearer token) — no custom header is needed.
 */
export default class MediaEncryptionService implements IMlsHttpClient {
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
   * @param {Uint8Array} body - JSON request payload as bytes.
   * @returns {Promise<Uint8Array>} JSON response payload as bytes.
   */
  async request(url: string, body: Uint8Array): Promise<Uint8Array> {
    const response = await this.webexRequest({
      method: 'POST',
      service: MEDIA_ENCRYPTION_SERVICE,
      url,
      body: JSON.parse(new TextDecoder().decode(body)),
    });

    // webex.request auto-parses JSON, so response.body is an object; the engine expects raw bytes.
    return new TextEncoder().encode(JSON.stringify(response.body));
  }
}
