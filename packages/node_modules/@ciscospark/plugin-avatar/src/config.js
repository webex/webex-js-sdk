/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  avatar: {
    batcherWait: 100,
    batcherMaxCalls: 100,
    batcherMaxWait: 1500,

    /**
     * @description Milliseconds a cached avatar url is considered valid
     * @type {number}
     */
    cacheExpiration: 60 * 60 * 1000,
    /**
     * @description default avatar size to retrieve if no size is specified
     * @type {number}
     */
    defaultAvatarSize: 80
  }
};
