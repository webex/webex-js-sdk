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

export {SERVICE_CATALOGS_ENUM_TYPES, NAMESPACE, SERVICE_CATALOGS, COMMERCIAL_ALLOWED_DOMAINS};
