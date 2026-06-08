/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

export const RETRY_AFTER_HEADER = 'retry-after';

export const DEFAULT_APP_LEVEL_RETRY_CONFIG = {
  enabled: false,
  statuses: {
    429: true,
    503: true,
  },
  methods: {
    GET: true,
    POST: true,
    PUT: true,
    HEAD: false,
    OPTIONS: false,
  },
  maxRetries: 3,
  retryAfter: {
    enabled: true,
    maxDelay: 3600000,
  },
  fallback: {
    enabled: true,
    delays: [400, 1600, 3200],
  },
  services: {},
};
