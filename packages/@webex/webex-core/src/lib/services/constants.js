const NAMESPACE = 'services';
const WEBEXAPI = 'https://webexapis.com/';
const SERVICE_CATALOGS = [
  'discovery',
  'limited',
  'signin',
  'postauth',
  'custom'
];

const SERVICE_CATALOGS_ENUM_TYPES = {
  STRING: 'SERVICE_CATALOGS_ENUM_TYPES_STRING',
  NUMBER: 'SERVICE_CATALOGS_ENUM_TYPES_NUMBER'
};

export {
  WEBEXAPI,
  SERVICE_CATALOGS_ENUM_TYPES,
  NAMESPACE,
  SERVICE_CATALOGS
};
