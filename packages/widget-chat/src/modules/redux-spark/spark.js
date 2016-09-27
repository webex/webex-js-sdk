/* eslint camelcase: [0] */

import '@ciscospark/plugin-conversation';
import Spark from '@ciscospark/spark-core';

export default function createSpark(accessToken) {
  return new Spark({
    credentials: {
      authorization: {
        access_token: accessToken
      }
    }
  });
}
