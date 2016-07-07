/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

// Note: several code paths are ignored in this file. As far as I can tell, any
// error conditions that would provoke those paths are otherwise prevented and
// reported.

import {defaults, pick} from 'lodash';
import qs from 'qs';
import xhr from 'xhr';

/**
 * @name request
 * @param {Object} options
 * @returns {Promise}
 */
export default function _request(options) {
  return new Promise((resolve) => {
    const params = pick(options, `method`, `uri`, `withCredentials`, `headers`, `timeout`, `responseType`);

    // Set `response` to `true` to approximate an `HttpResponse` object
    params.response = true;

    bindProgressEvents(params, options);
    setAuth(params, options);
    setCookies(params, options);
    setDefaults(params, options);
    setFileType(params, options);
    setPayload(params, options);
    setQs(params, options);

    const x = xhr(params, (error, response) => {
      /* istanbul ignore next */
      if (error) {
        options.logger.warn(error);
      }

      /* istanbul ignore else */
      if (response) {
        response.options = options;
        processResponseJson(response, params);
        resolve(response);
      }
      else {
        resolve({
          statusCode: 0,
          options,
          headers: options.headers,
          method: options.method,
          url: options.uri,
          body: error
        });
      }
    });

    x.onprogress = options.download.emit.bind(options.download, `progress`);
  })
  .catch((error) => {
    /* eslint arrow-body-style: [0] */
    /* istanbul ignore next */
    return {
      statusCode: 0,
      options,
      headers: options.headers,
      method: options.method,
      url: options.uri,
      body: error
    };
  });

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function bindProgressEvents(params, o) {
    if (params.method && [`PATCH`, `POST`, `PUT`].includes(params.method.toUpperCase())) {
      params.xhr = new XMLHttpRequest();
      params.xhr.upload.onprogress = o.upload.emit.bind(o.upload, `progress`);
    }
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setAuth(params, o) {
    if (o.auth) {
      if (o.auth.bearer) {
        params.headers.authorization = `Bearer ${o.auth.bearer}`;
      }
      else {
        const user = o.auth.user || o.auth.username;
        const pass = o.auth.pass || o.auth.password;

        const token = btoa(`${user}:${pass}`);
        params.headers.authorization = `Basic ${token}`;
      }
    }
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setCookies(params, o) {
    if (o.jar) {
      params.withCredentials = true;
    }
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setDefaults(params, o) {
    const defs = {
      cors: true,
      // raynos/xhr defaults withCredentials to true if cors is true, so we need
      // to make it explicitly false by default
      withCredentials: false,
      timeout: 0
    };

    defaults(params, pick(o, Object.keys(defs)), defs);
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setFileType(params, o) {
    if (o.responseType === `buffer`) {
      params.responseType = `arraybuffer`;
    }
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setQs(params, o) {
    if (o.qs) {
      params.uri += `?${qs.stringify(o.qs)}`;
    }
  }

  /**
   * @param {Object} params
   * @param {Object} o
   * @private
   * @returns {undefined}
   */
  function setPayload(params, o) {
    if ((!(`json` in o) || o.json === true) && o.body) {
      params.json = o.body;
    }
    else if (o.form) {
      params.headers[`Content-Type`] = `application/x-www-form-urlencoded`;
      params.body = qs.stringify(o.form);
      Reflect.deleteProperty(params, `json`);
    }
    else {
      params.body = o.body;
      Reflect.deleteProperty(params, `json`);
    }
  }

  /**
   * @param {Object} response
   * @param {Object} params
   * @private
   * @returns {undefined}
   */
  function processResponseJson(response, params) {
    // If params.json is not defined, xhr won't deserialize the response
    // so we should give it a shot just in case.
    if (!params.json && typeof response.body !== `object`) {
      try {
        response.body = JSON.parse(response.body);
      }
      catch (e) {
        /* eslint no-empty: [0] */
      }
    }
  }
}
