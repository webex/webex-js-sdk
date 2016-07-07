/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint camelcase: [0] */

module.exports = {
  trackingIdPrefix: 'spark-js-sdk',
  conversation: {
    keepEncryptedProperties: true
  },
  credentials: {
    allowedTags: {
      'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
    },
    clientType: 'confidential',
    oauth: {
      client_id: process.env.COMMON_IDENTITY_CLIENT_ID,
      client_secret: process.env.COMMON_IDENTITY_CLIENT_SECRET,
      redirect_uri: process.env.COMMON_IDENTITY_REDIRECT_URI,
      service: process.env.COMMON_IDENTITY_SERVICE,
      scope: process.env.COMMON_IDENTITY_SCOPE
    }
  },
  logger: {
    level: 'trace'
  },
  metrics: {
    // Disable metrics during tests
    enableMetrics: false
  },
  mercury: {
    // Suppress ping/pong for tests (unless explicitly requested)
    enablePingPong: false
  }
};
