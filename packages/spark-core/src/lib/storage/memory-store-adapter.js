/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {NotFoundError} from './errors';

export default {
  bind(namespace, options) {
    options = options || {};
    if (!namespace) {
      return Promise.reject(new Error(`\`namespace\` is required`));
    }

    if (!options.logger) {
      return Promise.reject(new Error(`\`options.logger\` is required`));
    }

    const logger = options.logger;

    const map = new Map();
    logger.info(`memory-store-adapter: returning binding`);
    return Promise.resolve({
      del(key) {
        logger.info(`memory-store-adapter: deleting \`${key}\``);
        return Promise.resolve(map.delete(key));
      },
      get(key) {
        logger.info(`memory-store-adapter: reading \`${key}\``);
        const res = map.get(key);
        if (res) {
          return Promise.resolve(res);
        }

        return Promise.reject(new NotFoundError());
      },
      put(key, value) {
        logger.info(`memory-store-adapter: writing \`${key}\``);
        return Promise.resolve(map.set(key, value));
      }
    });
  }
};
