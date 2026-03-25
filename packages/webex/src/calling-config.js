/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {MemoryStoreAdapter} from '@webex/webex-core';
import LocalStorageStoreAdapter from '@webex/storage-adapter-local-storage';

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
    boundedAdapter: new LocalStorageStoreAdapter('webex'),
    unboundedAdapter: MemoryStoreAdapter,
  },
};
