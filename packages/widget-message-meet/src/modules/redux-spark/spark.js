/* eslint camelcase: [0] */

import '@ciscospark/plugin-avatar';
import '@ciscospark/plugin-conversation';
import '@ciscospark/plugin-flag';
import Spark from '@ciscospark/spark-core';
import LocalStorageStoreAdapter from '@ciscospark/storage-adapter-local-storage';

export default function createSpark(accessToken) {
  const credentials = JSON.parse(localStorage.getItem(`credentials`) || false);
  return new Spark({
    credentials: {
      authorization: {
        access_token: accessToken || credentials.access_token
      }
    },
    config: {
      conversation: {
        allowedInboundTags: {
          'spark-mention': [`data-object-type`, `data-object-id`, `data-object-url`],
          a: [`href`],
          b: [],
          blockquote: [`class`],
          strong: [],
          i: [],
          em: [],
          pre: [],
          code: [],
          br: [],
          hr: [],
          p: [],
          ul: [],
          ol: [],
          li: [],
          h1: [],
          h2: [],
          h3: []
        },
        allowedOutboundTags: {
          'spark-mention': [`data-object-type`, `data-object-id`, `data-object-url`],
          a: [`href`],
          b: [],
          blockquote: [`class`],
          strong: [],
          i: [],
          em: [],
          pre: [],
          code: [],
          br: [],
          hr: [],
          p: [],
          ul: [],
          ol: [],
          li: [],
          h1: [],
          h2: [],
          h3: []
        }
      },
      storage: {
        boundedAdapter: new LocalStorageStoreAdapter(`ciscospark-embedded`)
      }
    }
  });
}
