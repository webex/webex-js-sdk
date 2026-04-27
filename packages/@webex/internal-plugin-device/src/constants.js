// Feature constants.
export const FEATURE_COLLECTION_DEVELOPER = 'developer';
export const FEATURE_COLLECTION_ENTITLEMENT = 'entitlement';
export const FEATURE_COLLECTION_USER = 'user';

export const CISCO_DEVICE_URL = 'cisco-device-url';

export const FEATURE_COLLECTION_NAMES = [
  FEATURE_COLLECTION_DEVELOPER,
  FEATURE_COLLECTION_ENTITLEMENT,
  FEATURE_COLLECTION_USER,
];

export const FEATURE_TYPES = {
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  STRING: 'string',
};

// Device constants.
export const DEVICE_EVENT_REGISTRATION_SUCCESS = 'registration:success';

export const DEVICE_EVENTS = [DEVICE_EVENT_REGISTRATION_SUCCESS];

// Device deletion constants.
export const MIN_DEVICES_FOR_CLEANUP = 5;
export const MAX_DELETION_CONFIRMATION_ATTEMPTS = 5;
export const DELETION_CONFIRMATION_DELAY_MS = 3000;
