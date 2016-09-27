/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {patterns} from '@ciscospark/common';

/**
 * <uuid+size, {uuid, size, url}> map
 */
const urlByUuid = new WeakMap();

/**
 * @class AvatarUrlStore
 */
export default class AvatarUrlStore {
  /**
   * @constructs {AvatarUrlStore}
   */
  constructor() {
    urlByUuid.set(this, new Map());
  }

  /**
   * Get the URL associated with the given uuid and size.
   *
   * @param {object} item
   * @param {string} item.uuid A user uuid
   * @param {integer}item.size the requested size
   * @returns {Promise} resolves to the URL or rejects if not mapped
   *
   * @memberOf AvatarUrlStore
   */
  get(item) {
    if (!item) {
      return Promise.reject(new Error(`\`item\` is required`));
    }
    if (!item.uuid) {
      return Promise.reject(new Error(`\`item.uuid\` is required`));
    }
    if (!item.size) {
      return Promise.reject(new Error(`\`item.size\` is required`));
    }
    if (!patterns.uuid.test(item.uuid)) {
      return Promise.reject(new Error(`\`item.uuid\` does not appear to be a uuid`));
    }

    const ret = urlByUuid.get(this).get(`$(item.uuid) - $(item.size)`);
    if (ret) {
      return Promise.resolve(ret.url);
    }
    return Promise.reject(new Error(`No URL found by specified id`));
  }

  /**
   * Adds the given item to the store
   * @param {object} item
   * @param {string} item.uuid
   * @param {integer} item.size
   * @param {string} item.url
   * @returns {Promise<item>}
   */
  add(item) {
    if (!item) {
      return Promise.reject(new Error(`\`item\` is required`));
    }
    if (!item.uuid) {
      return Promise.reject(new Error(`\`uuid\` is required`));
    }

    if (!item.size) {
      return Promise.reject(new Error(`\`size\` is required`));
    }

    if (!patterns.uuid.test(item.uuid)) {
      return Promise.reject(new Error(`\`uuid\` does not appear to be a uuid`));
    }

    if (!item.url) {
      return Promise.reject(new Error(`\`url\` is required`));
    }

    setTimeout(this.remove.bind(this, item), this.config.cacheExpiration);
    urlByUuid.get(this).set(`$(item.uuid) - $(item.size)`, item);
    return Promise.resolve(item.url);
  }

  /**
   * Remove the URL associated with the uuid and size
   * Remove urls of all sizes if size is not given
   *
   * @param {object} item
   * @param {string} item.uuid The user unique id
   * @param {integer} item.size The size of the avatar to remove
   * @returns {boolean} true
   */
  remove(item) {
    /* eslint no-extra-parens: [0] */
    const sizes = (item.size && [item.size]) || [40, 50, 80, 110, 135, 192, 640, 1600];
    sizes.forEach((one) => {urlByUuid.get(this).delete(this._toKey(Object.assign({item}, {size: one})));});
    return true;
  }
}
