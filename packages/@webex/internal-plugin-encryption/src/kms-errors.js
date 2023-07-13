/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Exception} from '@webex/common';
import {WebexHttpError} from '@webex/webex-core';

/**
 * Error class for KMS errors
 */
export class KmsError extends Exception {
  static defaultMessage =
    'An unknown error occurred while communicating with the kms. This implies we received an error response without a body.';

  /**
   * @param {HttpResponse} body
   * @returns {string}
   */
  parse(body) {
    body = body.body || body;

    Object.defineProperties(this, {
      body: {
        enumerable: false,
        value: body,
      },
      reason: {
        enumerable: false,
        value: body.reason,
      },
      requestId: {
        enumerable: false,
        value: body.requestId,
      },
      status: {
        enumerable: false,
        value: body.status,
      },
    });

    let message = typeof body === 'string' ? body : body.reason;

    if (!message) {
      message = this.constructor.defaultMessage;
    }
    if (body.status) {
      message += `\nKMS_RESPONSE_STATUS: ${body.status}`;
    }
    if (body.requestId) {
      message += `\nKMS_REQUEST_ID: ${body.requestId}`;
    }

    if (body.statusCode) {
      message += `\nKMS_STATUS_CODE: ${body.statusCode}`;
    }

    if (body.errorCode) {
      message += `\nKMS_ErrorCode: ${body.errorCode}`;
    }

    return message;
  }
}

/**
 * Thrown when an expected KMSResponse is not received in a timely manner
 */
export class KmsTimeoutError extends KmsError {
  /**
   * @param {KmsRequest} options.request
   * @param {KmsRequest} options.timeout
   * @returns {string}
   */
  parse({request = {}, timeout} = {}) {
    let message = `The KMS did not respond within ${
      timeout ? `${timeout} milliseconds` : 'a timely fashion'
    }`;

    if (request) {
      if (request.method && request.uri) {
        message += `\nKMS_REQUEST: ${request.method} ${request.uri}`;
      }

      if (request.requestId) {
        message += `\nKMS_REQUEST_ID: ${request.requestId}`;
      }
    }

    return message;
  }
}

/**
 * Emitted when a REST request includes an encrypter error
 */
export class DryError extends WebexHttpError {
  static defaultMessage = 'An unknown error was received from a service that proxies to the KMS';

  /**
   * @param {WebexHttpError} reason
   * @returns {string}
   */
  parse(reason) {
    Reflect.apply(WebexHttpError.prototype.parse, this, [reason._res]);
    const body = reason._res.body.message;

    let message = body.reason || body;

    if (!message) {
      message = this.constructor.defaultMessage;
    }
    if (this.options.url) {
      message += `\n${this.options.method} ${this.options.url}`;
    } else if (this.options.uri) {
      message += `\n${this.options.method} ${this.options.uri}`;
    } else {
      message += `\n${this.options.method} ${this.options.service.toUpperCase()}/${
        this.options.resource
      }`;
    }
    message += `\nWEBEX_TRACKING_ID: ${this.options.headers.trackingid}`;

    if (body.status) {
      message += `\nKMS_RESPONSE_STATUS: ${body.status}`;
    }
    if (body.requestId) {
      message += `\nKMS_REQUEST_ID: ${body.requestId}`;
    }

    Object.defineProperties(this, {
      reason: {
        enumerable: false,
        value: body.reason,
      },
      requestId: {
        enumerable: false,
        value: body.requestId,
      },
      status: {
        enumerable: false,
        value: body.status,
      },
    });

    return message;
  }
}
