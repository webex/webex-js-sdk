// Metric to do with WDM registration
const METRICS = {
  JS_SDK_CREDENTIALS_DOWNSCOPE_FAILED: 'JS_SDK_CREDENTIALS_DOWNSCOPE_FAILED',
  JS_SDK_CREDENTIALS_TOKEN_REFRESH_SCOPE_MISMATCH:
    'JS_SDK_CREDENTIALS_TOKEN_REFRESH_SCOPE_MISMATCH',
};

const NAMESPACE = 'services';
const SERVICE_CATALOGS = ['discovery', 'limited', 'signin', 'postauth', 'custom'];

const SERVICE_CATALOGS_ENUM_TYPES = {
  STRING: 'SERVICE_CATALOGS_ENUM_TYPES_STRING',
  NUMBER: 'SERVICE_CATALOGS_ENUM_TYPES_NUMBER',
};

// The default allowed domains that SDK can make requests to outside of service catalog
const COMMERCIAL_ALLOWED_DOMAINS = [
  'wbx2.com',
  'ciscospark.com',
  'webex.com',
  'webexapis.com',
  'broadcloudpbx.com',
  'broadcloud.eu',
  'broadcloud.com.au',
  'broadcloudpbx.net',
];

// Query parameter used to bypass the browser HTTP cache (U2C sends
// Cache-Control: max-age) when a catalog refresh is forced. It must not be
// `timestamp`: U2C gives that parameter a meaning (RR-005) and returns 204 with
// no body when it is newer than the invalidation threshold.
const U2C_CACHE_BUSTER_PARAM = '_';

export {
  SERVICE_CATALOGS_ENUM_TYPES,
  NAMESPACE,
  SERVICE_CATALOGS,
  COMMERCIAL_ALLOWED_DOMAINS,
  METRICS,
  U2C_CACHE_BUSTER_PARAM,
};
