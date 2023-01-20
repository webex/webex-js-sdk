/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {NotFoundError} from './errors';

/**
 * Binds a namespace
 * @param {string} namespace
 * @param {Object} options
 * @param {Object} options.data
 * @private
 * @returns {Promise<Object>}
 */
function _bind(namespace, options = {}) {
  options = options || {};
  if (!namespace) {
    return Promise.reject(new Error('`namespace` is required'));
  }

  if (!options.logger) {
    return Promise.reject(new Error('`options.logger` is required'));
  }

  const {logger} = options;

  const map = new Map([['@', {}]]);

  if (options.data) {
    Object.keys(options.data).forEach((key) => {
      map.set(key, options.data[key]);
    });
  }

  logger.debug('memory-store-adapter: returning binding');

  return Promise.resolve({
    clear() {
      logger.debug('memory-store-adapter: clearing the binding');

      return Promise.resolve(map.clear());
    },
    del(key) {
      logger.debug(`memory-store-adapter: deleting \`${key}\``);

      return Promise.resolve(map.delete(key));
    },
    get(key) {
      logger.debug(`memory-store-adapter: reading \`${key}\``);
      const res = map.get(key);

      if (typeof res === 'undefined') {
        return Promise.reject(new NotFoundError());
      }

      return Promise.resolve(res);
    },
    put(key, value) {
      logger.debug(`memory-store-adapter: writing \`${key}\``);

      return Promise.resolve(map.set(key, value));
    },
  });
}

export default {
  bind: _bind,
  preload(data) {
    return {
      bind(namespace, options = {}) {
        if (data[namespace]) {
          options.data = data[namespace];
        }

        return _bind(namespace, options);
      },
    };
  },
};
