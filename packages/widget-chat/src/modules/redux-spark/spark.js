/* eslint camelcase: [0] */

import '@ciscospark/plugin-conversation';
import Spark from '@ciscospark/spark-core';

const spark = new Spark({
  credentials: {
    authorization: process.env.CISCO_ACCESS_TOKEN
  }
});

export default spark;
