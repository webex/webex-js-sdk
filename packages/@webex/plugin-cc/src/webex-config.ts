import {MemoryStoreAdapter} from '@webex/webex-core';

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
    boundedAdapter: MemoryStoreAdapter,
    unboundedAdapter: MemoryStoreAdapter,
  },
};
