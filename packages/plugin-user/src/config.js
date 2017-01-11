/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  user: {
    activationUrl: `https://idbroker.webex.com/idb/token/v1/actions/UserActivation/invoke`,
    batcherWait: 100,
    batcherMaxCalls: 100,
    batcherMaxWait: 1500,
    setPasswordUrl: `https://identity.webex.com/identity/scim/v1/Users`,
    verifyDefaults: {
      reqId: `DESKTOP`
    }
  }
};
