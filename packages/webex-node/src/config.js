/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

// eslint-disable-next-line import/extensions
import storageConfig from './config-storage.js';

export default {
  hydra: process.env.HYDRA_SERVICE_URL || 'https://webexapis.com/v1',
  hydraServiceUrl: process.env.HYDRA_SERVICE_URL || 'https://webexapis.com/v1',
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
