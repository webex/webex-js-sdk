/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {HttpStatusInterceptor, defaults as requestDefaults} from '@ciscospark/http-core';
import {get, isFunction, merge} from 'lodash';
import AmpState from 'ampersand-state';
import NetworkTimingInterceptor from './interceptors/network-timing';
import RedirectInterceptor from './interceptors/redirect';
import RequestLoggerInterceptor from './interceptors/request-logger';
import RequestTimingInterceptor from './interceptors/request-timing';
import ResponseLoggerInterceptor from './interceptors/response-logger';
import SparkHttpError from './lib/spark-http-error';
import SparkTrackingIdInterceptor from './interceptors/spark-tracking-id';
import config from './config';

let constructorCalled = false;
const derived = {};

/**
 * List of loaded plugins. Only exported so that plugins can see which other
 * plugins have been loaded to avoid clobbering eachother (THIS IS A TEMPORARY
 * MEASURE!)
 * @private
 * @type {Object}
 */
export const children = {};

let Spark;

const interceptors = {
  SparkTrackingIdInterceptor() {
    return SparkTrackingIdInterceptor.create({
      prefix: get(this, `config.trackingIdPrefix`, `spark-js-sdk`)
    });
  },
  /* eslint no-extra-parens: [0] */
  RequestLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? RequestLoggerInterceptor.create : undefined,
  ResponseLoggerInterceptor: (process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING) ? ResponseLoggerInterceptor.create : undefined,
  RequestTimingInterceptor: RequestTimingInterceptor.create,
  UrlInterceptor: undefined,
  AuthInterceptor: undefined,
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
  `NetworkTimingInterceptor`,
  `RequestLoggerInterceptor`
];

const SparkCore = AmpState.extend({
  session: {
    config: {
      type: `object`
    },
    request: {
      setOnce: true,
      // It's supposed to be a function, but that's not a type defined in
      // Ampersand
      type: `any`
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

      // This is a bit of a hack, but we can enhance it later.
      const int = Reflect.apply(interceptor, this, []);
      if (int instanceof SparkTrackingIdInterceptor) {
        Reflect.defineProperty(this, `trackingId`, {
          enumerable: false,
          get() {
            return int._generateTrackingId();
          }
        });
      }

      ints.push(int);

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
  },

  logout(...args) {
    return this.credentials.logout(...args);
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

export {default as SparkHttpError} from './lib/spark-http-error';
export {default as SparkPlugin} from './lib/spark-plugin';
export {default as AuthInterceptor} from './plugins/credentials/auth-interceptor';
export {default as NetworkTimingInterceptor} from './interceptors/network-timing';
export {default as RedirectInterceptor} from './interceptors/redirect';
export {default as RequestLoggerInterceptor} from './interceptors/request-logger';
export {default as ResponseLoggerInterceptor} from './interceptors/response-logger';
export {default as RequestTimingInterceptor} from './interceptors/request-timing';
export {default as SparkTrackingIdInterceptor} from './interceptors/spark-tracking-id';
