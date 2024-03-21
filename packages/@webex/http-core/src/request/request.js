/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import request from 'request';
import {Buffer} from 'safe-buffer';
import {isBuffer} from '@webex/common';

import detect from '../lib/detect';
import ProgressEvent from '../progress-event';

/**
 * @param {Object} options
 * @private
 * @returns {Promise}
 */
function prepareOptions(options) {
  if (options.responseType === 'buffer' || options.responseType === 'blob') {
    options.encoding = null;
  }

  if (options.withCredentials) {
    options.jar = true;
  }

  if (isBuffer(options.body)) {
    return detect(options.body).then((type) => {
      options.headers['content-type'] = type;

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
    const {logger} = options;

    const r = request(options, (error, response) => {
      if (error) {
        logger.warn(error);
      }

      if (response) {
        response.options = options;

        // I'm not sure why this line is necessary. request seems to be creating
        // buffers that aren't Buffers.
        if (
          options.responseType === 'buffer' &&
          response.body.type === 'Buffer' &&
          !isBuffer(response.body)
        ) {
          response.body = Buffer.from(response.body);
        }

        if (isBuffer(response.body) && !response.body.type) {
          resolve(
            detect(response.body).then((type) => {
              response.body.type = type;

              return response;
            })
          );

          return;
        }

        resolve(response);
      } else {
        // Make a network error behave like a browser network error.
        resolve({
          statusCode: 0,
          options,
          headers: options.headers,
          method: options.method,
          url: options.url,
          body: error,
        });
      }
    });

    r.on('response', (response) => {
      const total = parseInt(response.headers['content-length'], 10);
      let loaded = 0;

      response.on('data', (data) => {
        loaded += data.length;
        options.download.emit('progress', new ProgressEvent(loaded, total));
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
  return prepareOptions(options).then(doRequest);
}
