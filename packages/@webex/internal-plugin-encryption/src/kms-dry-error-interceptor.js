/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

import {DryError} from './kms-errors';
/**
 * Interceptor (only to be used in test mode) intended to replay requests that
 * fail as a result of the test-user incompatibility in KMS.
 * @class
 */
export default class KmsDryErrorInterceptor extends Interceptor {
  /**
   * @returns {KmsDryErrorInterceptor}
   */
  static create() {
    return new KmsDryErrorInterceptor({webex: this});
  }

  /**
   * @param {Object} options
   * @param {Exception} reason
   * @returns {Promise}
   */
  onResponseError(options, reason) {
    if (
      reason instanceof DryError &&
      reason.message.match(/Failed to resolve authorization token in KmsMessage request for user/)
    ) {
      this.webex.logger.error('DRY Request Failed due to kms/test-user flakiness');
      this.webex.logger.error(reason);

      return this.replay(options, reason);
    }

    return Promise.reject(reason);
  }

  /**
   * Replays the request
   * @param {Object} options
   * @param {DryError} reason
   * @returns {Object}
   */
  replay(options, reason) {
    if (options.replayCount) {
      options.replayCount += 1;
    } else {
      options.replayCount = 1;
    }

    if (options.replayCount > this.webex.config.maxAuthenticationReplays) {
      this.webex.logger.error(
        `kms: failed after ${this.webex.config.maxAuthenticationReplays} replay attempts`
      );

      return Promise.reject(reason);
    }

    this.webex.logger.info(`kms: replaying request ${options.replayCount} time`);

    return this.webex.request(options);
  }
}
