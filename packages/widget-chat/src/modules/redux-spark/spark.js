/* eslint camelcase: [0] */

import '@ciscospark/plugin-conversation';
import Spark from '@ciscospark/spark-core';

const spark = new Spark({
  credentials: {
    authorization: {
      access_token: process.env.CISCOSPARK_ACCESS_TOKEN
    }
  }
});

export default spark;
