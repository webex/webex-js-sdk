/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

export default {
  device: {
    preDiscoveryServices: {
      wdmServiceUrl: process.env.WDM_SERVICE_URL || `https://wdm-a.wbx2.com/wdm/api/v1`,
      hydraServiceUrl: process.env.HYDRA_SERVICE_URL || `https://api.ciscospark.com/v1`
    },
    defaults: {
      name: process.title || typeof window !== `undefined` && `browser` || `javascript`,
      deviceType: `UNKNOWN`
    },
    enableInactivityEnforcement: false
  }
};
