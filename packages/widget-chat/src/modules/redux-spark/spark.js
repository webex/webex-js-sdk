/* eslint camelcase: [0] */

import '@ciscospark/plugin-conversation';
import Spark from '@ciscospark/spark-core';

export default function createSpark(accessToken) {
  const credentials = JSON.parse(localStorage.getItem(`credentials`) || false);
  return new Spark({
    credentials: {
      authorization: {
        access_token: accessToken || process.env.CISCOSPARK_ACCESS_TOKEN || credentials.access_token
      }
    }
  });
}
