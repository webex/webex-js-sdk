/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import storageConfig from './config-storage';

export default {
  hydra: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
  hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1',
  credentials: {
    clientType: 'confidential',
  },
  device: {
    validateDomains: true,
    ephemeral: true,
  },
  storage: {
    boundedAdapter: storageConfig,
    unboundedAdapter: storageConfig,
  },
};
