/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  user: {
    batcherWait: 100,
    batcherMaxCalls: 100,
    batcherMaxWait: 1500
  },
  device: {
    preDiscoveryServices: {
      scimServiceUrl: process.env.COMMON_IDENTITY_SCIM_SERVICE_URL || `https://identity.webex.com/identity/scim`
    }
  }
};
