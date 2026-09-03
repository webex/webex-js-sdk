/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import FakeTimers from '@sinonjs/fake-timers';
import sinon from 'sinon';
import {cloneDeep} from 'lodash';

import HttpRetryInterceptor, {
  getHttpRetryDelay,
  resolveHttpRetryPolicy,
} from '../../../../src/interceptors/http-retry';
import config from '../../../../src/config';

const NOW = Date.UTC(2026, 0, 1);

const ENABLED_POLICY = {
  enabled: true,
  retryAfterStatuses: [429, 503],
  backoffStatuses: [408, 429, 500, 502, 503, 504],
  retryNetworkErrors: false,
  methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
  maxRetries: 3,
  retryAfter: {
    enabled: true,
    maxDelay: 3600000,
    sources: [
      {header: 'retry-after', format: 'retry-after'},
      {
        header: 'x-ratelimit-reset',
        format: 'epoch-seconds',
        remainingHeader: 'x-ratelimit-remaining',
      },
      {
        header: 'x-rate-limit-reset',
        format: 'epoch-seconds',
        remainingHeader: 'x-rate-limit-remaining',
      },
    ],
  },
  backoff: {
    initialDelay: 400,
    factor: 2,
    maxDelay: 3200,
    jitterRatio: 0.2,
  },
  bodyErrorCodes: {
    paths: ['errorCode', 'code', 'reason.reasonCode'],
    nonRetryable: [],
  },
};

const RETRY_CONFIG = {
  default: {
    ...ENABLED_POLICY,
    paths: [
      {match: {exact: ['/exact']}, policy: {maxRetries: 1}},
      {match: {prefixes: ['/v1/']}, policy: {backoff: {initialDelay: 250}}},
      {match: {suffixes: ['/disabled']}, policy: {enabled: false}},
    ],
  },
  services: {
    'post-service': {
      methods: [...ENABLED_POLICY.methods, 'POST'],
      maxRetries: 4,
    },
    locus: {
      backoff: {initialDelay: 700},
      paths: [{match: {suffixes: ['/sync', '/hashtree']}, policy: {enabled: false}}],
    },
    identity: false,
  },
};

const BODY_CODE_CONFIG = {
  default: {
    ...ENABLED_POLICY,
    bodyErrorCodes: {
      paths: ['default.code'],
      nonRetryable: ['DEFAULT_STOP'],
    },
  },
  services: {
    'body-service': {
      bodyErrorCodes: {
        paths: ['service.code'],
        nonRetryable: ['SERVICE_STOP'],
      },
      paths: [
        {
          match: {suffixes: ['/special']},
          policy: {
            bodyErrorCodes: {
              paths: ['path.code'],
              nonRetryable: ['PATH_STOP'],
            },
          },
        },
      ],
    },
  },
};

const RATE_LIMIT_SOURCE_CONFIG = {
  default: {
    ...ENABLED_POLICY,
    retryAfter: {
      ...ENABLED_POLICY.retryAfter,
      sources: [{header: 'x-default-retry-in', format: 'delay-seconds'}],
    },
  },
  services: {
    'rate-service': {
      retryAfter: {
        sources: [{header: 'x-service-retry-in', format: 'delay-seconds'}],
      },
      paths: [
        {
          match: {suffixes: ['/special']},
          policy: {
            retryAfter: {
              sources: [{header: 'x-path-retry-in', format: 'delay-seconds'}],
            },
          },
        },
      ],
    },
  },
};

const errorResponse = (statusCode, retryAfter, headerName, body) => ({
  ...(body !== undefined && {body}),
  headers: retryAfter === undefined ? {} : {[headerName ?? 'retry-after']: retryAfter},
  statusCode,
});

const errorResponseWithHeaders = (statusCode, headers, body) => ({
  ...(body !== undefined && {body}),
  headers,
  statusCode,
});

const RESOLUTION_CASES = {
  'sdk default is disabled': {config: config.httpRetry},
  'boolean default enables retry': {config: {default: true}},
  'configured default is enabled': {config: RETRY_CONFIG},
  'default exact path overrides retry count': {
    config: RETRY_CONFIG,
    uri: 'https://example.com/exact?ignored=true',
  },
  'default prefix path overrides nested backoff': {
    config: RETRY_CONFIG,
    uri: 'https://example.com/v1/items',
  },
  'default suffix path disables retry': {
    config: RETRY_CONFIG,
    uri: 'https://example.com/items/disabled?ignored=true#fragment',
  },
  'multiple default paths apply in declaration order': {
    config: RETRY_CONFIG,
    uri: 'https://example.com/v1/items/disabled',
  },
  'unknown service uses default': {
    config: RETRY_CONFIG,
    serviceName: 'unknown',
  },
  'service name lookup is case insensitive': {
    config: RETRY_CONFIG,
    serviceName: 'POST-SERVICE',
  },
  'service overrides default fields': {
    config: RETRY_CONFIG,
    serviceName: 'post-service',
  },
  'service nested fields merge with default': {
    config: RETRY_CONFIG,
    serviceName: 'locus',
  },
  'service path overrides service and default': {
    config: RETRY_CONFIG,
    serviceName: 'locus',
    uri: 'https://locus.example.com/locus/api/v1/datasets/main/sync?sequence=1',
  },
  'boolean service disables retry': {
    config: RETRY_CONFIG,
    serviceName: 'identity',
  },
  'request policy overrides service path': {
    config: RETRY_CONFIG,
    requestPolicy: {enabled: true, maxRetries: 1, methods: ['POST']},
    serviceName: 'locus',
    uri: 'https://locus.example.com/locus/api/v1/datasets/main/sync',
  },
  'boolean request policy disables retry': {
    config: RETRY_CONFIG,
    requestPolicy: false,
    serviceName: 'post-service',
  },
  'boolean request policy enables retry': {
    config: config.httpRetry,
    requestPolicy: true,
  },
  'skipRetries wins over every override': {
    config: RETRY_CONFIG,
    requestPolicy: {enabled: true},
    serviceName: 'post-service',
    skipRetries: true,
  },
  'default config defines body error-code cancellation': {config: BODY_CODE_CONFIG},
  'service config overrides body error-code cancellation': {
    config: BODY_CODE_CONFIG,
    serviceName: 'body-service',
  },
  'service path overrides body error-code cancellation': {
    config: BODY_CODE_CONFIG,
    serviceName: 'body-service',
    uri: 'https://example.com/special',
  },
  'request config overrides body error-code cancellation': {
    config: BODY_CODE_CONFIG,
    requestPolicy: {
      bodyErrorCodes: {
        paths: ['request.code'],
        nonRetryable: ['REQUEST_STOP'],
      },
    },
    serviceName: 'body-service',
    uri: 'https://example.com/special',
  },
};

const RESPONSE_CASES = {
  'SDK disabled default rejects retryable response': {
    config: config.httpRetry,
    error: errorResponse(429, '0'),
    options: {method: 'GET'},
  },
  '429 honors Retry-After seconds': {
    error: errorResponse(429, '1.5'),
    options: {method: 'GET'},
  },
  'Retry-After header lookup is case insensitive': {
    error: errorResponse(429, '1', 'Retry-After'),
    options: {method: 'GET'},
  },
  '429 accepts case-insensitive X-RateLimit headers': {
    error: errorResponseWithHeaders(429, {
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '0',
    }),
    options: {method: 'GET'},
  },
  'hyphenated X-Rate-Limit aliases are case insensitive': {
    error: errorResponseWithHeaders(429, {
      'X-RATE-LIMIT-REMAINING': '0',
      'X-RATE-LIMIT-RESET': '0',
    }),
    options: {method: 'GET'},
  },
  'Retry-After takes precedence over X-RateLimit-Reset': {
    error: errorResponseWithHeaders(429, {
      'retry-after': '1',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(NOW / 1000 + 10),
    }),
    options: {method: 'GET'},
  },
  'positive X-RateLimit-Remaining ignores reset and uses backoff': {
    error: errorResponseWithHeaders(429, {
      'x-ratelimit-remaining': '1',
      'x-ratelimit-reset': String(NOW / 1000 + 10),
    }),
    options: {method: 'GET'},
  },
  'invalid X-RateLimit-Remaining ignores reset and uses backoff': {
    error: errorResponseWithHeaders(429, {
      'x-ratelimit-remaining': 'unknown',
      'x-ratelimit-reset': String(NOW / 1000 + 10),
    }),
    options: {method: 'GET'},
  },
  'X-RateLimit quota metadata without reset uses backoff': {
    error: errorResponseWithHeaders(429, {
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
    }),
    options: {method: 'GET'},
  },
  'expired X-RateLimit-Reset retries immediately': {
    error: errorResponseWithHeaders(429, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(NOW / 1000 - 1),
    }),
    options: {method: 'GET'},
  },
  'configured server delay above its maximum is rejected': {
    error: errorResponseWithHeaders(429, {'x-service-retry-in': '2'}),
    options: {
      httpRetry: {
        retryAfter: {
          maxDelay: 1999,
          sources: [{header: 'x-service-retry-in', format: 'delay-seconds'}],
        },
      },
      method: 'GET',
    },
  },
  'custom delay-seconds header replaces default sources': {
    error: errorResponseWithHeaders(429, {'x-service-retry-in': '1.25'}),
    options: {
      httpRetry: {
        retryAfter: {
          sources: [{header: 'x-service-retry-in', format: 'delay-seconds'}],
        },
      },
      method: 'GET',
    },
  },
  'default policy overrides rate-limit sources': {
    config: RATE_LIMIT_SOURCE_CONFIG,
    error: errorResponseWithHeaders(429, {'x-default-retry-in': '1'}),
    options: {method: 'GET'},
  },
  'service policy overrides rate-limit sources': {
    config: RATE_LIMIT_SOURCE_CONFIG,
    error: errorResponseWithHeaders(429, {'x-service-retry-in': '2'}),
    options: {method: 'GET', service: 'rate-service'},
  },
  'service path policy overrides rate-limit sources': {
    config: RATE_LIMIT_SOURCE_CONFIG,
    error: errorResponseWithHeaders(429, {'x-path-retry-in': '3'}),
    options: {
      method: 'GET',
      service: 'rate-service',
      uri: 'https://example.com/special',
    },
  },
  'service source list replaces the default source list': {
    config: RATE_LIMIT_SOURCE_CONFIG,
    error: errorResponseWithHeaders(429, {'x-default-retry-in': '10'}),
    options: {method: 'GET', service: 'rate-service'},
  },
  'empty retry source list uses backoff': {
    error: errorResponse(429, '10'),
    options: {httpRetry: {retryAfter: {sources: []}}, method: 'GET'},
  },
  'body error code cancels X-RateLimit retry': {
    error: errorResponseWithHeaders(
      429,
      {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(NOW / 1000 + 2),
      },
      {errorCode: 'STOP'}
    ),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['STOP']}},
      method: 'GET',
    },
  },
  '429 without Retry-After uses backoff': {
    error: errorResponse(429),
    options: {method: 'GET'},
  },
  '503 with invalid Retry-After uses backoff': {
    error: errorResponse(503, 'not-a-date'),
    options: {method: 'GET'},
  },
  'negative Retry-After uses backoff': {
    error: errorResponse(429, '-1'),
    options: {method: 'GET'},
  },
  'Retry-After can be disabled independently': {
    error: errorResponse(429, '10'),
    options: {httpRetry: {retryAfter: {enabled: false}}, method: 'GET'},
  },
  'response retryAfter property is supported': {
    error: {headers: {}, retryAfter: '1', statusCode: 429},
    options: {method: 'GET'},
  },
  'custom Retry-After status replaces defaults': {
    error: errorResponse(409, '1'),
    options: {
      httpRetry: {backoffStatuses: [], retryAfterStatuses: [409]},
      method: 'GET',
    },
  },
  'Retry-After above its maximum is rejected': {
    error: errorResponse(429, '1'),
    options: {httpRetry: {retryAfter: {maxDelay: 999}}, method: 'GET'},
  },
  '429 body errorCode cancels Retry-After': {
    error: errorResponse(429, '1', 'retry-after', {errorCode: 'STOP'}),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['STOP']}},
      method: 'GET',
    },
  },
  'numeric body errorCode matches configured string': {
    error: errorResponse(429, '1', 'retry-after', {errorCode: 201409036}),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['201409036']}},
      method: 'GET',
    },
  },
  '503 body code cancels backoff': {
    error: errorResponse(503, undefined, 'retry-after', {code: 'STOP'}),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['STOP']}},
      method: 'GET',
    },
  },
  '500 nested reasonCode cancels backoff': {
    error: errorResponse(500, undefined, 'retry-after', {reason: {reasonCode: 'STOP'}}),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['STOP']}},
      method: 'GET',
    },
  },
  'unmatched body error code preserves retry': {
    error: errorResponse(429, '1', 'retry-after', {errorCode: 'CONTINUE'}),
    options: {
      httpRetry: {bodyErrorCodes: {nonRetryable: ['STOP']}},
      method: 'GET',
    },
  },
  'service body error-code override cancels retry': {
    config: BODY_CODE_CONFIG,
    error: errorResponse(500, undefined, 'retry-after', {
      default: {code: 'DEFAULT_STOP'},
      service: {code: 'SERVICE_STOP'},
    }),
    options: {method: 'GET', service: 'body-service'},
  },
  'service body error-code override replaces default paths': {
    config: BODY_CODE_CONFIG,
    error: errorResponse(500, undefined, 'retry-after', {default: {code: 'DEFAULT_STOP'}}),
    options: {method: 'GET', service: 'body-service'},
  },
  'service path body error-code override cancels retry': {
    config: BODY_CODE_CONFIG,
    error: errorResponse(500, undefined, 'retry-after', {path: {code: 'PATH_STOP'}}),
    options: {
      method: 'GET',
      service: 'body-service',
      uri: 'https://example.com/special',
    },
  },
  'request body error-code override cancels retry': {
    config: BODY_CODE_CONFIG,
    error: errorResponse(500, undefined, 'retry-after', {request: {code: 'REQUEST_STOP'}}),
    options: {
      httpRetry: {
        bodyErrorCodes: {
          paths: ['request.code'],
          nonRetryable: ['REQUEST_STOP'],
        },
      },
      method: 'GET',
      service: 'body-service',
      uri: 'https://example.com/special',
    },
  },
  'request body error-code override replaces inherited cancellation': {
    config: BODY_CODE_CONFIG,
    error: errorResponse(500, undefined, 'retry-after', {path: {code: 'PATH_STOP'}}),
    options: {
      httpRetry: {
        bodyErrorCodes: {
          paths: ['request.code'],
          nonRetryable: ['REQUEST_STOP'],
        },
      },
      method: 'GET',
      service: 'body-service',
      uri: 'https://example.com/special',
    },
  },
  '408 uses backoff': {error: errorResponse(408), options: {method: 'GET'}},
  '500 uses backoff': {error: errorResponse(500), options: {method: 'GET'}},
  '502 uses backoff': {error: errorResponse(502), options: {method: 'GET'}},
  '504 uses backoff': {error: errorResponse(504), options: {method: 'GET'}},
  'custom backoff status replaces defaults': {
    error: errorResponse(418),
    options: {httpRetry: {backoffStatuses: [418]}, method: 'GET'},
  },
  'empty backoff status list rejects default transient status': {
    error: errorResponse(500),
    options: {httpRetry: {backoffStatuses: []}, method: 'GET'},
  },
  'response status property is supported': {
    error: {headers: {}, status: 500},
    options: {method: 'GET'},
  },
  'unconfigured status is rejected': {
    error: errorResponse(400),
    options: {method: 'GET'},
  },
  'GET is retryable': {
    error: errorResponse(503, '0'),
    options: {method: 'GET'},
  },
  'HEAD is retryable': {
    error: errorResponse(503, '0'),
    options: {method: 'HEAD'},
  },
  'OPTIONS is retryable': {
    error: errorResponse(503, '0'),
    options: {method: 'OPTIONS'},
  },
  'PUT is retryable': {
    error: errorResponse(503, '0'),
    options: {method: 'PUT'},
  },
  'DELETE is retryable': {
    error: errorResponse(503, '0'),
    options: {method: 'DELETE'},
  },
  'missing method defaults to GET': {
    error: errorResponse(503, '0'),
    options: {},
  },
  'method matching is case insensitive': {
    error: errorResponse(503, '0'),
    options: {method: 'get'},
  },
  'POST is rejected by default': {
    error: errorResponse(429, '0'),
    options: {method: 'POST'},
  },
  'service override enables POST': {
    error: errorResponse(429, '0'),
    options: {method: 'POST', service: 'post-service'},
  },
  'api alias selects service override': {
    error: errorResponse(429, '0'),
    options: {api: 'post-service', method: 'POST'},
  },
  'catalog-derived service enables POST': {
    catalogService: 'POST-SERVICE',
    error: errorResponse(429, '0'),
    options: {method: 'POST'},
  },
  'unknown catalog service uses default': {
    catalogService: 'unknown',
    error: errorResponse(429, '0'),
    options: {method: 'POST'},
  },
  'disabled service rejects retryable response': {
    error: errorResponse(429, '0'),
    options: {method: 'GET', service: 'identity'},
  },
  'service retry budget permits a fourth replay': {
    error: errorResponse(500),
    options: {method: 'POST', service: 'post-service'},
    replayResponses: [
      errorResponse(500),
      errorResponse(500),
      errorResponse(500),
      errorResponse(500),
    ],
  },
  'ordinary locus path uses service backoff': {
    error: errorResponse(500),
    options: {method: 'GET', service: 'locus', uri: 'https://locus.example.com/loci/123'},
  },
  'locus sync path is disabled': {
    error: errorResponse(503, '0'),
    options: {
      method: 'GET',
      service: 'locus',
      uri: 'https://locus.example.com/locus/api/v1/datasets/main/sync?sequence=1',
    },
  },
  'locus hashtree path is disabled': {
    error: errorResponse(429, '0'),
    options: {
      method: 'GET',
      service: 'locus',
      uri: 'https://locus.example.com/locus/api/v1/datasets/main/hashtree',
    },
  },
  'request policy can re-enable a disabled service path': {
    error: errorResponse(503, '0'),
    options: {
      httpRetry: {enabled: true},
      method: 'GET',
      service: 'locus',
      uri: 'https://locus.example.com/locus/api/v1/datasets/main/sync',
    },
  },
  'default prefix path changes response backoff': {
    error: errorResponse(500),
    options: {method: 'GET', uri: 'https://example.com/v1/items'},
  },
  'default suffix path disables response retry': {
    error: errorResponse(500),
    options: {method: 'GET', uri: 'https://example.com/items/disabled?ignored=true'},
  },
  'request policy can opt out': {
    error: errorResponse(429, '0'),
    options: {httpRetry: false, method: 'GET'},
  },
  'skipRetries can opt out': {
    error: errorResponse(429, '0'),
    options: {method: 'GET', skipRetries: true},
  },
  'network error is rejected by default': {
    error: new TypeError('Failed to fetch'),
    options: {method: 'GET'},
  },
  'request policy enables network error retry': {
    error: new TypeError('Failed to fetch'),
    options: {httpRetry: {retryNetworkErrors: true}, method: 'GET'},
  },
  'retry count exhaustion rejects': {
    error: errorResponse(500),
    options: {$httpRetryCount: 3, method: 'GET'},
  },
  'zero retry budget rejects': {
    error: errorResponse(500),
    options: {httpRetry: {maxRetries: 0}, method: 'GET'},
  },
  'backoff is capped at configured maximum': {
    error: errorResponse(500),
    options: {
      $httpRetryCount: 3,
      httpRetry: {backoff: {maxDelay: 1000}, maxRetries: 5},
      method: 'GET',
    },
  },
  'jitter lower bound is deterministic': {
    error: errorResponse(500),
    options: {method: 'GET'},
    random: 0,
  },
  'jitter upper bound is deterministic': {
    error: errorResponse(500),
    options: {method: 'GET'},
    random: 1,
  },
  'request policy controls backoff factor': {
    error: errorResponse(500),
    options: {
      httpRetry: {backoff: {factor: 3, initialDelay: 100}, maxRetries: 2},
      method: 'GET',
    },
    replayResponses: [errorResponse(500), errorResponse(500)],
  },
  'getReader body is not replayed': {
    error: errorResponse(503, '0'),
    options: {body: {getReader() {}}, method: 'GET'},
  },
  'pipe body is not replayed': {
    error: errorResponse(503, '0'),
    options: {body: {pipe() {}}, method: 'GET'},
  },
  'reader body is not replayed': {
    error: errorResponse(503, '0'),
    options: {body: {read() {}, releaseLock() {}}, method: 'GET'},
  },
  'async iterable body is not replayed': {
    error: errorResponse(503, '0'),
    options: {body: {[Symbol.asyncIterator]() {}}, method: 'GET'},
  },
  'abort cancels a pending retry': {
    abort: true,
    error: errorResponse(500),
    options: {method: 'GET'},
  },
  'retry count is independent from authentication replay count': {
    error: errorResponse(429, '0'),
    options: {method: 'GET', replayCount: 1},
  },
  'three retries use exponential delays and stop': {
    error: errorResponse(500),
    options: {method: 'GET'},
    replayResponses: [errorResponse(500), errorResponse(500), errorResponse(500)],
  },
};

const GENERATED_POLICY_SOURCES = {
  default: {
    allowedBody: {default: {code: 'CONTINUE'}},
    blockedBody: {default: {code: 'DEFAULT_STOP'}},
    enabled: true,
    initialDelay: 400,
    methods: ['GET'],
    options: {},
  },
  service: {
    allowedBody: {service: {code: 'CONTINUE'}},
    blockedBody: {service: {code: 'SERVICE_STOP'}},
    enabled: true,
    initialDelay: 600,
    methods: ['GET', 'POST'],
    options: {service: 'matrix-service'},
  },
  'service-path': {
    allowedBody: {path: {code: 'CONTINUE'}},
    blockedBody: {path: {code: 'PATH_STOP'}},
    enabled: false,
    initialDelay: 600,
    methods: ['GET', 'POST'],
    options: {service: 'matrix-service', uri: 'https://example.com/items/disabled'},
  },
  request: {
    allowedBody: {request: {code: 'CONTINUE'}},
    blockedBody: {request: {code: 'REQUEST_STOP'}},
    enabled: true,
    initialDelay: 200,
    methods: ['GET', 'POST'],
    options: {
      httpRetry: {
        backoff: {initialDelay: 200},
        bodyErrorCodes: {
          paths: ['request.code'],
          nonRetryable: ['REQUEST_STOP'],
        },
        enabled: true,
        methods: ['GET', 'POST'],
      },
      service: 'matrix-service',
      uri: 'https://example.com/items/disabled',
    },
  },
};

const GENERATED_FAILURES = {
  '429-retry-after': {
    outcome: 429,
    retryAfter: '1',
    retryAfterDelay: 1000,
    retryable: true,
    statusCode: 429,
  },
  '429-body-code-cancelled': {
    blocked: true,
    outcome: 429,
    retryAfter: '1',
    retryable: true,
    statusCode: 429,
  },
  '429-x-ratelimit-reset': {
    headers: {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '0',
    },
    outcome: 429,
    retryAfterDelay: 0,
    retryable: true,
    statusCode: 429,
  },
  '429-x-rate-limit-reset': {
    headers: {
      'x-rate-limit-remaining': '0',
      'x-rate-limit-reset': '0',
    },
    outcome: 429,
    retryAfterDelay: 0,
    retryable: true,
    statusCode: 429,
  },
  '429-reset-with-positive-remaining': {
    headers: {
      'x-ratelimit-remaining': '1',
      'x-ratelimit-reset': String(NOW / 1000 + 10),
    },
    outcome: 429,
    retryable: true,
    statusCode: 429,
  },
  '429-quota-metadata-without-reset': {
    headers: {
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '0',
    },
    outcome: 429,
    retryable: true,
    statusCode: 429,
  },
  '503-no-retry-after': {
    outcome: 503,
    retryable: true,
    statusCode: 503,
  },
  '503-body-code-cancelled': {
    blocked: true,
    outcome: 503,
    retryable: true,
    statusCode: 503,
  },
  '500-backoff': {
    outcome: 500,
    retryable: true,
    statusCode: 500,
  },
  '500-body-code-cancelled': {
    blocked: true,
    outcome: 500,
    retryable: true,
    statusCode: 500,
  },
  '400-not-retryable': {
    outcome: 400,
    retryable: false,
    statusCode: 400,
  },
  network: {
    network: true,
    outcome: 'TypeError',
    retryable: true,
  },
};

const cartesianProduct = (axes) =>
  axes.reduce(
    (combinations, [dimension, values]) =>
      combinations.flatMap((combination) =>
        values.map((value) => ({...combination, [dimension]: value}))
      ),
    [{}]
  );

const GENERATED_COMBINATIONS = cartesianProduct([
  ['policySource', Object.keys(GENERATED_POLICY_SOURCES)],
  ['method', ['GET', 'POST']],
  ['body', ['replayable', 'stream']],
  ['retryBudget', ['available', 'exhausted']],
  ['failure', Object.keys(GENERATED_FAILURES)],
  ['networkErrors', [false, true]],
]);

const generatedCaseName = (combination) =>
  Object.entries(combination)
    .map(([dimension, value]) => `${dimension}:${value}`)
    .join('|');

const generatedConfig = (retryNetworkErrors) => ({
  default: {
    ...ENABLED_POLICY,
    backoff: {...ENABLED_POLICY.backoff, jitterRatio: 0},
    bodyErrorCodes: {
      paths: ['default.code'],
      nonRetryable: ['DEFAULT_STOP'],
    },
    maxRetries: 1,
    methods: ['GET'],
    retryNetworkErrors,
  },
  services: {
    'matrix-service': {
      backoff: {initialDelay: 600},
      bodyErrorCodes: {
        paths: ['service.code'],
        nonRetryable: ['SERVICE_STOP'],
      },
      methods: ['GET', 'POST'],
      paths: [
        {
          match: {suffixes: ['/disabled']},
          policy: {
            bodyErrorCodes: {
              paths: ['path.code'],
              nonRetryable: ['PATH_STOP'],
            },
            enabled: false,
          },
        },
      ],
    },
  },
});

const generatedScenario = (combination) => {
  const source = GENERATED_POLICY_SOURCES[combination.policySource];
  const failure = GENERATED_FAILURES[combination.failure];
  const responseBody = failure.blocked ? source.blockedBody : source.allowedBody;
  let error;

  if (failure.network) {
    error = new TypeError('Failed to fetch');
  } else if (failure.headers) {
    error = errorResponseWithHeaders(failure.statusCode, failure.headers, responseBody);
  } else {
    error = errorResponse(failure.statusCode, failure.retryAfter, 'retry-after', responseBody);
  }

  return {
    config: generatedConfig(combination.networkErrors),
    error,
    options: {
      ...source.options,
      ...(combination.body === 'stream' && {body: {pipe: sinon.stub()}}),
      ...(combination.retryBudget === 'exhausted' && {$httpRetryCount: 1}),
      method: combination.method,
    },
  };
};

const generatedExpectation = (combination) => {
  const source = GENERATED_POLICY_SOURCES[combination.policySource];
  const failure = GENERATED_FAILURES[combination.failure];
  const hasBudget = combination.retryBudget === 'available';
  const methodAllowed = source.methods.includes(combination.method);
  const networkAllowed = !failure.network || combination.networkErrors;
  const shouldRetry =
    source.enabled &&
    methodAllowed &&
    combination.body === 'replayable' &&
    hasBudget &&
    failure.retryable &&
    !failure.blocked &&
    networkAllowed;
  const retryCount = hasBudget ? Number(shouldRetry) : 1;

  return {
    delays: shouldRetry ? [failure.retryAfterDelay ?? source.initialDelay] : [],
    outcome: shouldRetry ? 'resolved:200' : `rejected:${failure.outcome}`,
    requestCount: Number(shouldRetry),
    retryCount,
    willRetry: shouldRetry,
  };
};

const GENERATED_RESPONSE_CASES = Object.fromEntries(
  GENERATED_COMBINATIONS.map((combination) => [
    generatedCaseName(combination),
    generatedScenario(combination),
  ])
);

const EXPECTED_GENERATED_RESPONSES = Object.fromEntries(
  GENERATED_COMBINATIONS.map((combination) => [
    generatedCaseName(combination),
    generatedExpectation(combination),
  ])
);

const EXPECTED_HTTP_RETRY_CONTRACT = {
  decisions: {
    '503 honors Retry-After HTTP date': 2000,
    '429 honors X-RateLimit-Reset epoch seconds': 2000,
    '429 honors X-Rate-Limit-Reset epoch seconds': 3000,
    'X-RateLimit-Reset above its maximum is rejected': undefined,
  },
  generatedCaseCount: 768,
  generatedOutcomeCounts: {
    noRetry: 693,
    retry: 75,
  },
  generatedResponses: EXPECTED_GENERATED_RESPONSES,
  resolvedPolicies: {
    'sdk default is disabled': {...ENABLED_POLICY, enabled: false},
    'boolean default enables retry': ENABLED_POLICY,
    'configured default is enabled': ENABLED_POLICY,
    'default exact path overrides retry count': {...ENABLED_POLICY, maxRetries: 1},
    'default prefix path overrides nested backoff': {
      ...ENABLED_POLICY,
      backoff: {...ENABLED_POLICY.backoff, initialDelay: 250},
    },
    'default suffix path disables retry': {...ENABLED_POLICY, enabled: false},
    'multiple default paths apply in declaration order': {
      ...ENABLED_POLICY,
      backoff: {...ENABLED_POLICY.backoff, initialDelay: 250},
      enabled: false,
    },
    'unknown service uses default': ENABLED_POLICY,
    'service name lookup is case insensitive': {
      ...ENABLED_POLICY,
      methods: [...ENABLED_POLICY.methods, 'POST'],
      maxRetries: 4,
    },
    'service overrides default fields': {
      ...ENABLED_POLICY,
      methods: [...ENABLED_POLICY.methods, 'POST'],
      maxRetries: 4,
    },
    'service nested fields merge with default': {
      ...ENABLED_POLICY,
      backoff: {...ENABLED_POLICY.backoff, initialDelay: 700},
    },
    'service path overrides service and default': {
      ...ENABLED_POLICY,
      backoff: {...ENABLED_POLICY.backoff, initialDelay: 700},
      enabled: false,
    },
    'boolean service disables retry': {...ENABLED_POLICY, enabled: false},
    'request policy overrides service path': {
      ...ENABLED_POLICY,
      backoff: {...ENABLED_POLICY.backoff, initialDelay: 700},
      enabled: true,
      maxRetries: 1,
      methods: ['POST'],
    },
    'boolean request policy disables retry': {
      ...ENABLED_POLICY,
      enabled: false,
      methods: [...ENABLED_POLICY.methods, 'POST'],
      maxRetries: 4,
    },
    'boolean request policy enables retry': ENABLED_POLICY,
    'skipRetries wins over every override': {
      ...ENABLED_POLICY,
      enabled: false,
      methods: [...ENABLED_POLICY.methods, 'POST'],
      maxRetries: 4,
    },
    'default config defines body error-code cancellation': {
      ...ENABLED_POLICY,
      bodyErrorCodes: {
        paths: ['default.code'],
        nonRetryable: ['DEFAULT_STOP'],
      },
    },
    'service config overrides body error-code cancellation': {
      ...ENABLED_POLICY,
      bodyErrorCodes: {
        paths: ['service.code'],
        nonRetryable: ['SERVICE_STOP'],
      },
    },
    'service path overrides body error-code cancellation': {
      ...ENABLED_POLICY,
      bodyErrorCodes: {
        paths: ['path.code'],
        nonRetryable: ['PATH_STOP'],
      },
    },
    'request config overrides body error-code cancellation': {
      ...ENABLED_POLICY,
      bodyErrorCodes: {
        paths: ['request.code'],
        nonRetryable: ['REQUEST_STOP'],
      },
    },
  },
  responses: {
    'SDK disabled default rejects retryable response': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    '429 honors Retry-After seconds': {
      delays: [1500],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'Retry-After header lookup is case insensitive': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '429 accepts case-insensitive X-RateLimit headers': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'hyphenated X-Rate-Limit aliases are case insensitive': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'Retry-After takes precedence over X-RateLimit-Reset': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'positive X-RateLimit-Remaining ignores reset and uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'invalid X-RateLimit-Remaining ignores reset and uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'X-RateLimit quota metadata without reset uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'expired X-RateLimit-Reset retries immediately': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'configured server delay above its maximum is rejected': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'custom delay-seconds header replaces default sources': {
      delays: [1250],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'default policy overrides rate-limit sources': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'service policy overrides rate-limit sources': {
      delays: [2000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'service path policy overrides rate-limit sources': {
      delays: [3000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'service source list replaces the default source list': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'empty retry source list uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'body error code cancels X-RateLimit retry': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    '429 without Retry-After uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '503 with invalid Retry-After uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'negative Retry-After uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'Retry-After can be disabled independently': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'response retryAfter property is supported': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'custom Retry-After status replaces defaults': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'Retry-After above its maximum is rejected': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    '429 body errorCode cancels Retry-After': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'numeric body errorCode matches configured string': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    '503 body code cancels backoff': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    '500 nested reasonCode cancels backoff': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'unmatched body error code preserves retry': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'service body error-code override cancels retry': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'service body error-code override replaces default paths': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'service path body error-code override cancels retry': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'request body error-code override cancels retry': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'request body error-code override replaces inherited cancellation': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '408 uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '500 uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '502 uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    '504 uses backoff': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'custom backoff status replaces defaults': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'empty backoff status list rejects default transient status': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'response status property is supported': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'unconfigured status is rejected': {
      delays: [],
      outcome: 'rejected:400',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'GET is retryable': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'HEAD is retryable': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'OPTIONS is retryable': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'PUT is retryable': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'DELETE is retryable': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'missing method defaults to GET': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'method matching is case insensitive': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'POST is rejected by default': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'service override enables POST': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'api alias selects service override': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'catalog-derived service enables POST': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'unknown catalog service uses default': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'disabled service rejects retryable response': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'service retry budget permits a fourth replay': {
      delays: [400, 800, 1600, 3200],
      outcome: 'rejected:500',
      requestCount: 4,
      retryCount: 4,
      willRetry: true,
    },
    'ordinary locus path uses service backoff': {
      delays: [700],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'locus sync path is disabled': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'locus hashtree path is disabled': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'request policy can re-enable a disabled service path': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'default prefix path changes response backoff': {
      delays: [250],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'default suffix path disables response retry': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'request policy can opt out': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'skipRetries can opt out': {
      delays: [],
      outcome: 'rejected:429',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'network error is rejected by default': {
      delays: [],
      outcome: 'rejected:TypeError',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'request policy enables network error retry': {
      delays: [400],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'retry count exhaustion rejects': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 3,
      willRetry: false,
    },
    'zero retry budget rejects': {
      delays: [],
      outcome: 'rejected:500',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'backoff is capped at configured maximum': {
      delays: [1000],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 4,
      willRetry: true,
    },
    'jitter lower bound is deterministic': {
      delays: [320],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'jitter upper bound is deterministic': {
      delays: [480],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'request policy controls backoff factor': {
      delays: [100, 300],
      outcome: 'rejected:500',
      requestCount: 2,
      retryCount: 2,
      willRetry: true,
    },
    'getReader body is not replayed': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'pipe body is not replayed': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'reader body is not replayed': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'async iterable body is not replayed': {
      delays: [],
      outcome: 'rejected:503',
      requestCount: 0,
      retryCount: 0,
      willRetry: false,
    },
    'abort cancels a pending retry': {
      delays: [],
      outcome: 'rejected:AbortError',
      requestCount: 0,
      retryCount: 0,
      willRetry: true,
    },
    'retry count is independent from authentication replay count': {
      delays: [0],
      outcome: 'resolved:200',
      requestCount: 1,
      retryCount: 1,
      willRetry: true,
    },
    'three retries use exponential delays and stop': {
      delays: [400, 800, 1600],
      outcome: 'rejected:500',
      requestCount: 3,
      retryCount: 3,
      willRetry: true,
    },
  },
};

const settle = (promise, onSettled) =>
  promise.then(
    (value) => {
      onSettled();

      return `resolved:${value.statusCode}`;
    },
    (error) => {
      onSettled();

      return `rejected:${error.statusCode ?? error.name}`;
    }
  );

const drainTimers = async ({clock, delays, isSettled, remaining = 10}) => {
  if (isSettled() || remaining === 0) {
    return undefined;
  }

  await Promise.resolve();

  if (clock.countTimers() > 0) {
    const before = clock.now;

    await clock.nextAsync();
    delays.push(clock.now - before);
  }

  return drainTimers({clock, delays, isSettled, remaining: remaining - 1});
};

const evaluateResponse = async (scenario) => {
  const clock = FakeTimers.install({now: NOW});
  const random = sinon.stub(Math, 'random').returns(scenario.random ?? 0.5);
  const controller = scenario.abort ? new AbortController() : undefined;
  const options = {
    uri: 'https://example.com/items',
    ...scenario.options,
    ...(controller && {signal: controller.signal}),
  };
  const webex = new MockWebex({
    config: {
      ...cloneDeep(config),
      httpRetry: cloneDeep(scenario.config || RETRY_CONFIG),
    },
  });

  webex.internal.services = {
    getServiceFromUrl: sinon
      .stub()
      .returns(scenario.catalogService === undefined ? undefined : {name: scenario.catalogService}),
  };

  const interceptor = Reflect.apply(HttpRetryInterceptor.create, webex, []);
  const replayResponses = scenario.replayResponses || [{statusCode: 200}];
  let replayIndex = 0;

  webex.request.callsFake(() => {
    const response = replayResponses[replayIndex] || {statusCode: 200};

    replayIndex += 1;

    return response.statusCode >= 400
      ? interceptor.onResponseError(options, response)
      : Promise.resolve(response);
  });

  try {
    await interceptor.onRequest(options);
    const willRetry = options.$httpRetryWillRetry(scenario.error);
    let settled = false;
    const outcomePromise = settle(interceptor.onResponseError(options, scenario.error), () => {
      settled = true;
    });
    const delays = [];

    controller?.abort();
    await drainTimers({clock, delays, isSettled: () => settled});

    assert.isTrue(settled, 'response scenario did not settle');

    return {
      delays,
      outcome: await outcomePromise,
      requestCount: webex.request.callCount,
      retryCount: options.$httpRetryCount || 0,
      willRetry,
    };
  } finally {
    random.restore();
    clock.uninstall();
  }
};

const evaluateResponses = async (entries, responses = {}) => {
  const [[name, scenario] = [], ...remaining] = entries;

  if (!name) {
    return responses;
  }

  return evaluateResponses(remaining, {
    ...responses,
    [name]: await evaluateResponse(scenario),
  });
};

describe('HTTP retry contract', () => {
  it('matches curated boundaries and bounded configuration combinations', async () => {
    const decisions = {
      '503 honors Retry-After HTTP date': getHttpRetryDelay({
        now: NOW,
        options: {method: 'GET'},
        policy: ENABLED_POLICY,
        reason: errorResponse(503, new Date(NOW + 2000).toUTCString()),
      }),
      '429 honors X-RateLimit-Reset epoch seconds': getHttpRetryDelay({
        now: NOW,
        options: {method: 'GET'},
        policy: ENABLED_POLICY,
        reason: errorResponseWithHeaders(429, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(NOW / 1000 + 2),
        }),
      }),
      '429 honors X-Rate-Limit-Reset epoch seconds': getHttpRetryDelay({
        now: NOW,
        options: {method: 'GET'},
        policy: ENABLED_POLICY,
        reason: errorResponseWithHeaders(429, {
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': String(NOW / 1000 + 3),
        }),
      }),
      'X-RateLimit-Reset above its maximum is rejected': getHttpRetryDelay({
        now: NOW,
        options: {method: 'GET'},
        policy: {...ENABLED_POLICY, retryAfter: {...ENABLED_POLICY.retryAfter, maxDelay: 1999}},
        reason: errorResponseWithHeaders(429, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(NOW / 1000 + 2),
        }),
      }),
    };
    const resolvedPolicies = Object.fromEntries(
      Object.entries(RESOLUTION_CASES).map(([name, input]) => [name, resolveHttpRetryPolicy(input)])
    );
    const generatedResponses = await evaluateResponses(Object.entries(GENERATED_RESPONSE_CASES));
    const generatedOutcomeCounts = Object.values(generatedResponses).reduce(
      (counts, response) => ({
        ...counts,
        [response.willRetry ? 'retry' : 'noRetry']:
          counts[response.willRetry ? 'retry' : 'noRetry'] + 1,
      }),
      {noRetry: 0, retry: 0}
    );
    const responses = await evaluateResponses(Object.entries(RESPONSE_CASES));

    assert.deepEqual(
      {
        decisions,
        generatedCaseCount: Object.keys(generatedResponses).length,
        generatedOutcomeCounts,
        generatedResponses,
        resolvedPolicies,
        responses,
      },
      EXPECTED_HTTP_RETRY_CONTRACT
    );
  });
});
