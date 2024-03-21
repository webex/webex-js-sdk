/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';
import {set} from 'lodash';

import {CISCO_DEVICE_URL} from '../constants';

/**
 * Adds 'cisco-device-url' header, as appropriate, to requests
 */
export default class DeviceUrlInterceptor extends Interceptor {
  /**
   * @returns {DeviceUrlInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new DeviceUrlInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const {headers, service, uri} = options;
    const {device, services} = this.webex.internal;

    // Check if header is already set before moving forward
    if (!device.url || (headers && CISCO_DEVICE_URL in headers && !!headers[CISCO_DEVICE_URL])) {
      return Promise.resolve(options);
    }

    // Wait for catalog and service to be defined.
    return services
      .waitForService({service, url: uri})
      .then((url) => {
        // Grab the service name with the url returned from waitForService
        const {name: serviceName} = services.getServiceFromUrl(url) || {};
        const invalidServices = ['idbroker', 'oauth', 'saml'];

        // Check if service is not one of the invalid services
        // Assign the url to the device header
        if (serviceName && !invalidServices.includes(serviceName)) {
          set(options, `headers['${CISCO_DEVICE_URL}']`, device.url);
        }

        return options;
      })
      .catch((error) => {
        // Validate that the error came from getServiceFromUrl
        if (error.message.match(/was not found after waiting/)) {
          return options;
        }

        return Promise.reject(error);
      });
  }
}
