/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var authProcessor = require('./processors/auth');
var SparkBase = require('../../lib/spark-base');
var cloneDeep = require('lodash.clonedeep');
var decryptProcessor = require('./processors/decrypt');
var defaults = require('lodash.defaults');
var deviceUrlProcessor = require('./processors/device-url');
var EventEmitter = require('events').EventEmitter;
var isFunction = require('lodash.isfunction');
var isObject = require('lodash.isobject');
var omit = require('lodash.omit');
var redirectProcessor = require('./processors/redirect');
var requestEventsProcessor = require('./processors/request-events');
var retry = require('../../util/retry');
var SparkHttpErrors = require('../../lib/exceptions/spark-http-errors');
var trackingIdProcessor = require('./processors/tracking-id');
var urlProcessor = require('./processors/url');
var uuid = require('uuid');

/**
 * @class
 * @extends {SparkBase}
 */
var ClientBase = SparkBase.extend({
  derived: {
    trackingId: {
      cache: false,
      deps: [
        'trackingIdBase'
      ],
      fn: function trackingId() {
        this.trackingIdCount += 1;
        var suffix = this.spark.config.trackingIdSuffix ? '_' + this.spark.config.trackingIdSuffix : '';
        return this.spark.config.trackingIdPrefix + '_' + this.trackingIdBase + '_' + this.trackingIdCount + suffix;
      }
    }
  },

  props: {
    trackingIdBase: {
      default: function trackingIdBase() {
        return uuid.v4();
      },
      required: true,
      setOnce: true,
      type: 'string'
    }
  },

  session: {
    trackingIdCount: {
      default: 0,
      required: true,
      type: 'number'
    }
  },

  processors: [
    requestEventsProcessor,
    urlProcessor,
    trackingIdProcessor,
    authProcessor,
    deviceUrlProcessor,
    decryptProcessor,
    redirectProcessor
  ],

  requestDefaults: {
    json: true,
    shouldRefreshAccessToken: true
  },

  /**
   * Makes requests against Spark apis.
   * @param {string} uri (optional) for compatibility with request/request
   * @param {Object} options Accepts same parameters as
   * [request](https://github.com/request/request) for full documentation.
   * Properties described here are extensions not in the request documentation
   * @param {string} options.api (required if `uri` is not specified) Combine
   * `api` and `resource` to make requests to the specified service using its
   * url in the service catalog
   * @param {string} options.resource (required if `uri` is not specified)
   * Combine `api` and `resource` to make requests to the specified service
   * using its url in the service catalog
   * @param {EventEmitter} options.upload Added by `request()`. Can be used to
   * listen for upload progress events
   * @param {EventEmitter} options.download Added by `request()`. Can be used
   * to listen for download progress events
   * @param {boolean} options.shouldRefreshAccessToken (default: true) indicate
   * whether or not a 401 response should induce a reauthentication attempt
   * @return {Promise} Resolves or Rejects with an HttpRequestObject. Promise
   * has an `on` method with can be used to bind the `upload-progress` and
   * `download-progress` events. (Note: `on` is only a method on the initial
   * promise in the chain).
   */
  request: function request(uri, options) {
    if (isObject(uri)) {
      options = uri;
      uri = undefined;
    }
    else {
      options.uri = uri;
    }

    if (options.url) {
      options.uri = options.url;
      delete options.url;
    }

    // need to use cloneDeep so that nested properties in requestDefaults
    // don't get changed.
    defaults(options, cloneDeep(this.requestDefaults));

    options.headers = options.headers || {};

    options.download = new EventEmitter();
    options.upload = new EventEmitter();

    var promise = this.preprocess.call(this, options)
      .then(this._request.bind(this, options))
      .then(this.postprocess.bind(this));

    promise.on = function on(key, callback) {
      if (key === 'download-progress') {
        options.download.on('progress', callback);
      }
      else if (key === 'upload-progress') {
        options.upload.on('progress', callback);
      }
      return promise;
    };

    return promise;
  },

  preprocess: function preprocess(options) {
    var preprocessors = (options.preprocessors || []).concat(this.processors);

    return preprocessors.reduce(function reduceProcessor(promise, processor) {
      var onResolve;
      var onReject;

      if (processor.pre) {
        if (isFunction(processor.pre)) {
          onResolve = processor.pre.bind(this, options);
        }
        else {
          if (isFunction(processor.pre.onResolve)) {
            onResolve = processor.pre.onResolve.bind(this, options);
          }
          if (isFunction(processor.pre.onReject)) {
            onReject = processor.pre.onReject.bind(this, options);
          }
        }

        return promise.then(onResolve, onReject);
      }

      return promise;
    }.bind(this), Promise.resolve());
  },

  postprocess: function postprocess(res) {
    var promise;
    if (res.statusCode && res.statusCode < 400) {
      promise = Promise.resolve(res);
    }
    else {
      // Note: the extra parenthesis below are required to make sure `new` is
      // applied to the correct method (i.e., the result of `select()`, not
      // `select()` itself).
      promise = Promise.reject(new (SparkHttpErrors.select(res.statusCode))(res));
    }

    var postprocessors = (res.options.postprocessors || []).concat(this.processors);
    postprocessors.reverse();

    return postprocessors.reduce(function reduceProcessor(promise, processor) {
      var onResolve;
      var onReject;

      if (processor.post) {
        if (isFunction(processor.post)) {
          onResolve = processor.post.bind(this);
        }
        else {
          if (isFunction(processor.post.onResolve)) {
            onResolve = processor.post.onResolve.bind(this);
          }

          if (isFunction(processor.post.onReject)) {
            onReject = processor.post.onReject.bind(this);
          }
        }

        return promise.then(onResolve, onReject);
      }

      return promise;
    }.bind(this), promise);
  },

  upload: function upload(options) {
    var emitter = new EventEmitter();

    if (!options.file) {
      return Promise.reject(new Error('`options.file` is required'));
    }

    options.phases = options.phases || {};
    options.phases.initialize = options.phases.initialize || {};
    options.phases.upload = options.phases.upload || {};
    options.phases.finalize = options.phases.finalize || {};

    defaults(options.phases.initialize, {
      method: 'POST'
    }, omit(options, 'file', 'phases'));

    defaults(options.phases.upload, {
      method: 'PUT',
      json: false,
      withCredentials: false,
      body: options.file,
      headers: {
        'x-trans-id': uuid.v4()
      }
    });

    defaults(options.phases.finalize, {
      method: 'POST'
    });

    var promise = this._uploadPhaseInitialize(options)
      .then(function callPhaseUpload() {
        return this._uploadPhaseUpload(options)
          .on('progress', emitter.emit.bind(emitter, 'progress'));
      }.bind(this))
      .then(this._uploadPhaseFinalize.bind(this, options))
      .then(function processResponse(res) {
        return res.body;
      });

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    return promise;
  },

  _uploadPhaseInitialize: function _uploadPhaseInitialize(options) {
    this.logger.debug('client: initiating upload session');
    return this.request(options.phases.initialize)
      .then(this._uploadApplySession.bind(this, options))
      .then(function logCompletion(res) {
        this.logger.debug('client: initiated upload session');
        return res;
      }.bind(this));
  },

  _uploadApplySession: function _uploadApplySession(options, res) {
    var session = res.body;
    ['upload', 'finalize'].reduce(function applySessionToOptions(options, key) {
      options[key] = Object.keys(options[key]).reduce(function applySessionToPhaseOptions(phaseOptions, phaseKey) {
        if (phaseKey.indexOf('$') === 0) {
          phaseOptions[phaseKey.substr(1)] = phaseOptions[phaseKey](session);
          delete phaseOptions[phaseKey];
        }

        return phaseOptions;
      }, options[key]);

      return options;
    }, options.phases);
  },

  _uploadPhaseUpload: retry(function _uploadPhaseUpload(options) {
    this.logger.debug('client: uploading file');

    var emitter = new EventEmitter();

    var promise = this.request(options.phases.upload)
      .on('upload-progress', emitter.emit.bind(emitter, 'progress'))
      .then(function logCompletion(res) {
        this.logger.debug('client: uploaded file');
        return res;
      }.bind(this));

    promise.on = function on(key, callback) {
      emitter.on(key, callback);
      return promise;
    };

    /* istanbul ignore else */
    if (process.env.NODE_ENV === 'test') {
      promise.on('progress', function logProgress(event) {
        this.logger.log('upload progress', event.loaded, event.total);
      }.bind(this));
    }

    return promise;
  }),

  _uploadPhaseFinalize: function _uploadPhaseFinalize(options) {
    this.logger.debug('client: finalizing upload session');

    return this.request(options.phases.finalize)
      .then(function logCompletion(res) {
        this.logger.debug('client: finalized upload session');
        return res;
      }.bind(this));
  }
});

// Enable ridiculously verbose logging on all network requests
if (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
  ClientBase.prototype.processors.push(require('./processors/test-logger'));
}

module.exports = ClientBase;
