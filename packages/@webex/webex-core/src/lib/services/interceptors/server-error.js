/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import {WebexHttpError} from '@webex/webex-core';
/**
 * Changes server url when it fails
 */
export default class ServerErrorInterceptor extends Interceptor {
  /**
  * @returns {HAMessagingInterceptor}
  */
  static create() {
    // eslint-disable-next-line no-invalid-this
    return new ServerErrorInterceptor({webex: this});
  }


  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Object} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    if ((reason instanceof WebexHttpError.InternalServerError || reason instanceof WebexHttpError.BadGateway || reason instanceof WebexHttpError.ServiceUnavailable) && options.uri) {
      const feature = this.webex.internal.device.features.developer.get('web-high-availability');

      if (feature && feature.value) {
        this.webex.internal.metrics.submitClientMetrics('web-ha', {
          fields: {success: false},
          tags: {action: 'failed', error: reason.message, url: options.uri}
        });

        return Promise.resolve(this.webex.internal.services.markFailedUrl(options.uri))
          .then(() => Promise.reject(reason));
      }
    }

    return Promise.reject(reason);
  }
}
