/* eslint camelcase: [0] */

import '@ciscospark/plugin-conversation';
import '@ciscospark/plugin-flag';
import Spark from '@ciscospark/spark-core';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default function createSpark(accessToken) {
  const credentials = JSON.parse(localStorage.getItem(`credentials`) || false);
  return new Spark({
    credentials: {
      authorization: {
        access_token: accessToken || process.env.CISCOSPARK_ACCESS_TOKEN || credentials.access_token
      }
    },
    config: {
      storage: {
        boundedAdapter: new LocalStorageStoreAdapter(`ciscospark-embedded`)
      }
    }
  });
}
