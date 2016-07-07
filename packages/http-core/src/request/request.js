/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import detect from '../lib/detect';
import ProgressEvent from '../progress-event';
import request from 'request';

/**
 * @param {Object} options
 * @private
 * @returns {Promise}
 */
function prepareOptions(options) {
  if (options.responseType === `buffer` || options.responseType === `blob`) {
    options.encoding = null;
  }

  if (options.withCredentials) {
    options.jar = true;
  }

  if (Buffer.isBuffer(options.body)) {
    return detect(options.body)
      .then((type) => {
        options.headers[`content-type`] = type;
        return options;
      });
  }

  return Promise.resolve(options);
}

/**
 * @param {Object} options
 * @private
 * @returns {Promise}
 */
function doRequest(options) {
  return new Promise((resolve) => {
    const r = request(options, (error, response) => {
      if (error) {
        options.logger.warn(error);
      }

      if (response) {
        response.options = options;
        resolve(response);
      }
      else {
        // Make a network error behave like a browser network error.
        resolve({
          statusCode: 0,
          options,
          headers: options.headers,
          method: options.method,
          url: options.url,
          body: error
        });
      }
    });

    r.on(`response`, (response) => {
      const total = parseInt(response.headers[`content-length`], 10);
      let loaded = 0;
      response.on(`data`, (data) => {
        loaded += data.length;
        options.download.emit(`progress`, new ProgressEvent(loaded, total));
      });
    });
  });
}

/**
 * @name request
 * @param {Object} options
 * @returns {Promise}
 */
export default function _request(options) {
  return prepareOptions(options)
    .then(doRequest);
}
