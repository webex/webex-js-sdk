/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {proxyEvents, retry, transferEvents} from '@ciscospark/common';
import {HttpStatusInterceptor, defaults as requestDefaults} from '@ciscospark/http-core';
import {defaults, get, isFunction, merge, omit} from 'lodash';
import AmpState from 'ampersand-state';
import NetworkTimingInterceptor from './interceptors/network-timing';
import RedirectInterceptor from './interceptors/redirect';
import RequestLoggerInterceptor from './interceptors/request-logger';
import RequestTimingInterceptor from './interceptors/request-timing';
import ResponseLoggerInterceptor from './interceptors/response-logger';
import SparkHttpError from './lib/spark-http-error';
import SparkTrackingIdInterceptor from './interceptors/spark-tracking-id';
import config from './config';
import {makeSparkStore} from './lib/storage';
import uuid from 'uuid';
import {EventEmitter} from 'events';

let constructorCalled = false;
const derived = {};
export const children = {};

let Spark;

const interceptors = {
  SparkTrackingIdInterceptor: SparkTrackingIdInterceptor.create,
  /* eslint no-extra-parens: [0] */
  RequestLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? RequestLoggerInterceptor.create : undefined,
  ResponseLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? ResponseLoggerInterceptor.create : undefined,
  RequestTimingInterceptor: RequestTimingInterceptor.create,
  UrlInterceptor: undefined,
  AuthInterceptor: undefined,
  ConversationInterceptor: undefined,
  EncryptionInterceptor: undefined,
  RedirectInterceptor: RedirectInterceptor.create,
  HttpStatusInterceptor() {
    return HttpStatusInterceptor.create({
      error: SparkHttpError
    });
  },
  NetworkTimingInterceptor: NetworkTimingInterceptor.create
};

const preInterceptors = [
  `ResponseLoggerInterceptor`,
  `RequestTimingInterceptor`,
  `SparkTrackingIdInterceptor`
];

const postInterceptors = [
  `HttpStatusInterceptor`,
  `NetworkTimingInterceptor`,
  `RequestLoggerInterceptor`
];

const SparkCore = AmpState.extend({
  derived: {
    boundedStorage: {
      deps: [],
      fn() {
        return makeSparkStore(`bounded`, this);
      }
    },
    unboundedStorage: {
      deps: [],
      fn() {
        return makeSparkStore(`unbounded`, this);
      }
    }
  },

  session: {
    config: {
      type: `object`
    },
    request: {
      setOnce: true,
      // It's supposed to be a function, but that's not a type defined in
      // Ampersand
      type: `any`
    },
    sessionId: {
      setOnce: true,
      type: `string`
    }
  },

  authenticate(...args) {
    return this.credentials.authenticate(...args);
  },

  authorize(...args) {
    return this.credentials.authorize(...args);
  },

  refresh(...args) {
    return this.credentials.refresh(...args);
  },

  initialize() {
    this.config = merge({}, config, this.config);

    // Make nested events propagate in a consistent manner
    Object.keys(children).forEach((key) => {
      this.listenTo(this[key], `change`, (...args) => {
        args.unshift(`change:${key}`);
        this.trigger(...args);
      });
    });

    const addInterceptor = (ints, key) => {
      const interceptor = interceptors[key];

      if (!isFunction(interceptor)) {
        return ints;
      }

      ints.push(Reflect.apply(interceptor, this, []));

      return ints;
    };

    let ints = [];
    ints = preInterceptors.reduce(addInterceptor, ints);
    ints = Object.keys(interceptors).filter((key) => !(preInterceptors.includes(key) || postInterceptors.includes(key))).reduce(addInterceptor, ints);
    ints = postInterceptors.reduce(addInterceptor, ints);

    this.request = requestDefaults({
      json: true,
      interceptors: ints
    });

    this.sessionId = `${get(this, `config.trackingIdPrefix`, `spark-js-sdk`)}_${get(this, `config.trackingIdBase`, uuid.v4())}`;
  },

  logout(...args) {
    return this.credentials.logout(...args);
  },

  /**
   * General purpose wrapper to submit metrics via the metrics plugin (if the
   * metrics plugin is installed)
   * @returns {Promise}
   */
  measure(...args) {
    if (this.metrics) {
      return this.metrics.sendUnstructured(...args);
    }

    return Promise.resolve();
  },

  upload(options) {
    if (!options.file) {
      return Promise.reject(new Error(`\`options.file\` is required`));
    }

    options.phases = options.phases || {};
    options.phases.initialize = options.phases.initialize || {};
    options.phases.upload = options.phases.upload || {};
    options.phases.finalize = options.phases.finalize || {};

    defaults(options.phases.initialize, {
      method: `POST`
    }, omit(options, `file`, `phases`));

    defaults(options.phases.upload, {
      method: `PUT`,
      json: false,
      withCredentials: false,
      body: options.file,
      headers: {
        'x-trans-id': uuid.v4(),
        authorization: undefined
      }
    });

    defaults(options.phases.finalize, {
      method: `POST`
    }, omit(options, `file`, `phases`));

    const shunt = new EventEmitter();

    const promise = this._uploadPhaseInitialize(options)
      .then(() => {
        const p = this._uploadPhaseUpload(options);
        transferEvents(`progress`, p, shunt);
        return p;
      })
      .then((...args) => this._uploadPhaseFinalize(options, ...args))
      .then((res) => res.body);

    proxyEvents(shunt, promise);

    return promise;
  },

  _uploadPhaseInitialize: function _uploadPhaseInitialize(options) {
    this.logger.debug(`client: initiating upload session`);

    return this.request(options.phases.initialize)
      .then((...args) => this._uploadApplySession(options, ...args))
      .then((res) => {
        this.logger.debug(`client: initiated upload session`);
        return res;
      });
  },

  _uploadApplySession(options, res) {
    const session = res.body;
    [`upload`, `finalize`].reduce((opts, key) => {
      opts[key] = Object.keys(opts[key]).reduce((phaseOptions, phaseKey) => {
        if (phaseKey.startsWith(`$`)) {
          phaseOptions[phaseKey.substr(1)] = phaseOptions[phaseKey](session);
          Reflect.deleteProperty(phaseOptions, phaseKey);
        }

        return phaseOptions;
      }, opts[key]);

      return opts;
    }, options.phases);
  },

  @retry
  _uploadPhaseUpload(options) {
    this.logger.debug(`client: uploading file`);

    const promise = this.request(options.phases.upload)
      .then((res) => {
        this.logger.debug(`client: uploaded file`);
        return res;
      });

    proxyEvents(options.phases.upload.upload, promise);

    /* istanbul ignore else */
    if (process.env.NODE_ENV === `test`) {
      promise.on(`progress`, (event) => {
        this.logger.log(`upload progress`, event.loaded, event.total);
      });
    }

    return promise;
  },

  _uploadPhaseFinalize: function _uploadPhaseFinalize(options) {
    this.logger.debug(`client: finalizing upload session`);

    return this.request(options.phases.finalize)
      .then((res) => {
        this.logger.debug(`client: finalized upload session`);
        return res;
      });
  }
});

/**
 * @returns {undefined}
 */
function makeSparkConstructor() {
  Spark = SparkCore.extend({
    children,
    derived
  });
}

/**
 * @param {Object} attrs
 * @param {Object} attrs.credentials
 * @param {Object} attrs.config
 * @returns {Spark}
 */
export default function ProxySpark(...args) {
  if (!Spark) {
    makeSparkConstructor();
  }

  constructorCalled = true;

  const spark = new Spark(...args);
  return spark;
}

/**
 * @method registerPlugin
 * @param {string} name
 * @param {function} constructor
 * @param {Object} options
 * @param {Array<string>} options.proxies
 * @param {Object} options.interceptors
 * @returns {null}
 */
export function registerPlugin(name, constructor, options) {
  /* eslint complexity: [0] */
  if (constructorCalled) {
    const message = `registerPlugin() should not be called after instantiating a Spark instance`;
    /* eslint no-console: [0] */
    console.warn(message);
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== `production`) {
      throw new Error(message);
    }
  }

  options = options || {};

  if (!children[name] || options.replace) {
    children[name] = constructor;

    if (options.proxies) {
      options.proxies.forEach((key) => {
        derived[key] = {
          deps: [`${name}.${key}`],
          fn() {
            return this[name][key];
          }
        };
      });
    }

    if (options.interceptors) {
      Object.keys(options.interceptors).forEach((key) => {
        interceptors[key] = options.interceptors[key];
      });
    }

    if (options.config) {
      merge(config, options.config);
    }

    makeSparkConstructor();
  }
}
